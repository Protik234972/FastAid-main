require('dotenv').config();

const path = require('path');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const adminRoutes = require('./routes/admin.routes');
const emergencyRoutes = require('./routes/emergency.routes');
const publicRoutes = require('./routes/public.routes');
const authRoutes = require('./routes/auth.routes');
const pushRoutes = require('./routes/push.routes');
const { attachLocationSocket } = require('./realtime/locationSocket');
const webpush = require('web-push');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@fastaid.test',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const startedAt = Date.now();
const port = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, '..', 'public');

app.use(express.json({ limit: '2mb' }));
app.use(express.static(publicDir));

app.get('/api/health', (req, res) => {
  const memory = process.memoryUsage();

  res.json({
    status: 'ok',
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'not-connected',
    memoryMb: {
      rss: Math.round(memory.rss / 1024 / 1024),
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
    },
  });
});

app.get('/api/admin/metrics', (req, res) => {
  res.json({
    data: {
      uptime: '99.94%',
      cpuLoad: 49,
      alerts: [
        {
          level: 'Warning',
          title: 'Push latency elevated',
          detail: 'p95 response time above target.',
        },
      ],
    },
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/emergencies', emergencyRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/push', pushRoutes);
attachLocationSocket(io);

app.use((req, res) => {
  res.status(404).json({
    error: 'Not found.',
  });
});

app.use((error, req, res, next) => {
  const status = error.name === 'ValidationError' ? 400 : 500;

  res.status(status).json({
    error: error.message || 'Unexpected server error.',
  });
});

async function connectDatabase() {
  if (!process.env.MONGO_URI) {
    console.warn('MONGO_URI is not set. Static pages and demo endpoints will still run.');
    return;
  }
  console.log(process.env.MONGO_URI);
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  });
  console.log('MongoDB connected.');
}

server.listen(port, () => {
  console.log(`Fast Responder Volunteer Network running at http://localhost:${port}`);
  connectDatabase().catch((error) => {
    console.warn(`MongoDB connection failed: ${error.message}`);
  });
});

module.exports = {
  app,
  server,
};
