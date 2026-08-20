const mongoose = require('mongoose');

const { User, VolunteerProfile } = require('../models/fastaid.models');

const activeResponders = new Map();
const lastDbWrites = new Map();

function isValidCoordinate(latitude, longitude) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

async function persistVolunteerLocation({ volunteerUserId, latitude, longitude }) {
  if (mongoose.connection.readyState !== 1 || !mongoose.Types.ObjectId.isValid(volunteerUserId)) {
    return { persisted: false };
  }

  const now = Date.now();
  const lastWrite = lastDbWrites.get(volunteerUserId) || 0;
  
  // Throttle DB writes to once every 15 seconds
  if (now - lastWrite < 15000) {
    return { persisted: false, throttled: true };
  }

  lastDbWrites.set(volunteerUserId, now);

  await VolunteerProfile.updateOne(
    { userId: volunteerUserId },
    {
      $set: {
        isAvailable: true,
        lastKnownLocation: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        lastLocationUpdatedAt: new Date(),
      },
      $setOnInsert: {
        userId: volunteerUserId,
        reliabilityScore: 50,
        activeEmergencyId: null,
      },
    },
    {
      upsert: true,
      timestamps: false,
    }
  );

  return { persisted: true };
}

async function resolveUserName(userId, fallbackName) {
  if (mongoose.connection.readyState !== 1 || !mongoose.Types.ObjectId.isValid(userId)) {
    return fallbackName;
  }

  const user = await User.findById(userId).select('name').lean();
  return user ? user.name : fallbackName;
}

async function resolveUserMedicalProfile(userId) {
  if (mongoose.connection.readyState !== 1 || !mongoose.Types.ObjectId.isValid(userId)) {
    return null;
  }

  const user = await User.findById(userId).select('medicalProfile').lean();
  return user ? user.medicalProfile : null;
}

function attachLocationSocket(io) {
  io.on('connection', (socket) => {
    socket.emit('tracking:snapshot', Array.from(activeResponders.values()));

    socket.on('volunteer:join', (payload = {}) => {
      socket.data.volunteerUserId = payload.volunteerUserId || socket.id;
      socket.data.displayName = payload.displayName || 'Volunteer';
      socket.data.phone = payload.phone || '';
      socket.data.emergencyId = payload.emergencyId || null;

      if (socket.data.emergencyId) {
        socket.join(`emergency_${socket.data.emergencyId}`);
      }

      socket.emit('tracking:ready', {
        volunteerUserId: socket.data.volunteerUserId,
        connectedAt: new Date().toISOString(),
      });
    });

    socket.on('victim:join', (payload = {}) => {
      if (payload.emergencyId) {
        socket.join(`emergency_${payload.emergencyId}`);
      }
    });

    socket.on('volunteer:join_emergency', (payload = {}) => {
      if (payload.emergencyId) {
        socket.data.emergencyId = payload.emergencyId;
        socket.join(`emergency_${payload.emergencyId}`);
      }
    });

    socket.on('admin:join', () => {
      socket.join('admin');
    });

    socket.on('volunteer:location', async (payload = {}, acknowledge) => {
      const latitude = Number(payload.latitude);
      const longitude = Number(payload.longitude);
      const volunteerUserId = payload.volunteerUserId || socket.data.volunteerUserId || socket.id;

      if (!isValidCoordinate(latitude, longitude)) {
        const error = { ok: false, error: 'Invalid latitude or longitude.' };
        if (typeof acknowledge === 'function') {
          acknowledge(error);
        }
        return;
      }

      const displayName = await resolveUserName(
        volunteerUserId,
        payload.displayName || socket.data.displayName || 'Volunteer'
      );
      const location = {
        volunteerUserId,
        displayName,
        phone: payload.phone || socket.data.phone || '',
        emergencyId: payload.emergencyId || socket.data.emergencyId || null,
        latitude,
        longitude,
        accuracy: Number(payload.accuracy) || null,
        speed: Number(payload.speed) || null,
        heading: Number(payload.heading) || null,
        updatedAt: new Date().toISOString(),
      };

      activeResponders.set(volunteerUserId, location);
      const persistence = await persistVolunteerLocation(location);

      const emitPayload = {
        ...location,
        persisted: persistence.persisted,
      };

      if (location.emergencyId) {
        io.to(`emergency_${location.emergencyId}`).emit('responder:location', emitPayload);
      } else {
        io.emit('responder:location', emitPayload);
      }
      
      // Always emit to admins so they can monitor all responders
      io.to('admin').emit('responder:location', emitPayload);

      if (typeof acknowledge === 'function') {
        acknowledge({ ok: true, persisted: persistence.persisted });
      }
    });

    socket.on('emergency:requested', async (payload = {}) => {
      const victimName = await resolveUserName(payload.victimId, payload.victimName || 'Victim');
      const medicalProfile = await resolveUserMedicalProfile(payload.victimId);
      io.emit('emergency:live', {
        ...payload,
        victimName,
        medicalProfile,
        receivedAt: new Date().toISOString(),
      });
    });

    socket.on('webrtc:offer', (payload) => {
      if (payload.emergencyId) {
        socket.to(`emergency_${payload.emergencyId}`).emit('webrtc:offer', payload);
      }
    });

    socket.on('webrtc:answer', (payload) => {
      if (payload.emergencyId) {
        socket.to(`emergency_${payload.emergencyId}`).emit('webrtc:answer', payload);
      }
    });

    socket.on('webrtc:candidate', (payload) => {
      if (payload.emergencyId) {
        socket.to(`emergency_${payload.emergencyId}`).emit('webrtc:candidate', payload);
      }
    });

    socket.on('disconnect', () => {
      const volunteerUserId = socket.data.volunteerUserId;

      if (!volunteerUserId) {
        return;
      }

      const location = activeResponders.get(volunteerUserId);

      if (!location) {
        return;
      }

      activeResponders.set(volunteerUserId, {
        ...location,
        disconnectedAt: new Date().toISOString(),
      });

      io.emit('responder:offline', {
        volunteerUserId,
        disconnectedAt: new Date().toISOString(),
      });
    });
  });
}

module.exports = {
  attachLocationSocket,
};
