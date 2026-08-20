const mongoose = require('mongoose');

function requireDatabase(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      error: 'Database connection is not ready.',
      setup: 'Set MONGO_URI in .env and start MongoDB before using this endpoint.',
    });
  }

  return next();
}

module.exports = {
  requireDatabase,
};
