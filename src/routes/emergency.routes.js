const express = require('express');
const rateLimit = require('express-rate-limit');

const requestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Increased for development testing
  message: { error: 'Too many emergency requests from this IP, please try again later.' }
});

const {
  acceptEmergencyCase,
  initiateEmergencyRequest,
  transitionEmergencyStatus,
} = require('../models/fastaid.models');
const { analyzeEmergency } = require('../services/llm.service');
const { requireDatabase } = require('../middleware/database');
const { requireAuthenticatedUser, requireRole } = require('../middleware/rbac');
const { User, Emergency } = require('../models/fastaid.models');
const webpush = require('web-push');

const router = express.Router();

async function sendPushNotification({ user, payload }) {
  if (!user || !user.pushSubscriptions || user.pushSubscriptions.length === 0) {
    return { provider: 'web-push', status: 'skipped', reason: 'No subscriptions' };
  }

  const results = await Promise.allSettled(
    user.pushSubscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, JSON.stringify(payload));
        return { success: true };
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          // Remove invalid subscription
          await User.updateOne({ _id: user._id }, { $pull: { pushSubscriptions: { endpoint: sub.endpoint } } });
        }
        return { success: false, error: err.message };
      }
    })
  );

  return { provider: 'web-push', results };
}

router.post('/requests', requireAuthenticatedUser, requestLimiter, requireDatabase, async (req, res, next) => {
  try {
    const result = await initiateEmergencyRequest({
      victimId: req.user._id || req.user.id,
      description: req.body.description,
      photoUrl: req.body.photoUrl,
      autoGps: req.body.autoGps,
      responderLimit: req.body.responderLimit,
    });

    // Trigger asynchronous LLM analysis
    if (req.body.description) {
      analyzeEmergency(req.body.description).then(async (analysis) => {
        if (analysis) {
          await Emergency.findByIdAndUpdate(
            result.emergency._id,
            { $set: { aiAnalysis: analysis } }
          );
        }
      }).catch(err => console.error('LLM error:', err));
    }

    // Send push notifications to nearby responders
    if (result.rankedResponders && result.rankedResponders.length > 0) {
      const responderIds = result.rankedResponders.map(r => r.userId);
      const responders = await User.find({ _id: { $in: responderIds } }).select('pushSubscriptions');
      
      const payload = {
        title: 'Emergency Request',
        body: req.body.description,
        url: '/volunteer-phone/',
        type: 'EMERGENCY_REQUESTED',
        emergencyId: result.emergency._id
      };

      Promise.allSettled(responders.map(user => sendPushNotification({ user, payload })))
        .catch(console.error); // Fire and forget
    }

    return res.status(201).json({
      data: result,
    });
  } catch (error) {
    return next(error);
  }
});

router.post(
  '/:emergencyId/accept',
  requireRole('Volunteer', 'Admin'),
  requireDatabase,
  async (req, res, next) => {
    try {
      const result = await acceptEmergencyCase({
        emergencyId: req.params.emergencyId,
        volunteerUserId: req.user._id || req.user.id,
        notifiedResponderIds: req.body.notifiedResponderIds,
        sendPush: async ({ user, payload }) => {
          const pushPayload = {
            title: 'Emergency Assigned',
            body: `You have been assigned to emergency ${payload.emergencyId}`,
            url: '/volunteer-phone/',
            ...payload
          };
          return sendPushNotification({ user, payload: pushPayload });
        },
        sendSms: async ({ user, message }) => ({
          provider: 'demo-sms',
          recipient: user && user.phone,
          message,
        }),
      });

      return res.json({
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.patch(
  '/:emergencyId/status',
  requireRole('Volunteer', 'Admin'),
  requireDatabase,
  async (req, res, next) => {
    try {
      const emergency = await transitionEmergencyStatus({
        emergencyId: req.params.emergencyId,
        nextStatus: req.body.nextStatus,
        changedByUserId: req.user._id || req.user.id,
        note: req.body.note,
      });

      return res.json({
        data: emergency,
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.patch(
  '/:emergencyId/cancel',
  requireAuthenticatedUser,
  requireDatabase,
  async (req, res, next) => {
    try {
      const emergency = await transitionEmergencyStatus({
        emergencyId: req.params.emergencyId,
        nextStatus: 'Cancelled',
        changedByUserId: req.user._id || req.user.id,
        note: 'Cancelled by user',
      });

      return res.json({
        data: emergency,
      });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;

// Add GET endpoint for fetching emergency details including AI analysis
router.get(
  '/:emergencyId',
  requireAuthenticatedUser,
  requireDatabase,
  async (req, res, next) => {
    try {
      const emergency = await Emergency.findById(req.params.emergencyId)
        .populate('victimId', 'name phone medicalProfile')
        .populate('assignedVolunteerId', 'name phone');
      
      if (!emergency) {
        return res.status(404).json({ error: 'Emergency not found' });
      }

      return res.json({ data: emergency });
    } catch (error) {
      return next(error);
    }
  }
);
