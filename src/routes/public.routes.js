const express = require('express');

const { User, VolunteerProfile } = require('../models/fastaid.models');
const { requireDatabase } = require('../middleware/database');

const router = express.Router();

router.get('/victims', requireDatabase, async (req, res, next) => {
  try {
    const victims = await User.find({ role: 'Victim' })
      .select('name phone email verificationStatus')
      .sort({ name: 1 })
      .lean();

    return res.json({ data: victims });
  } catch (error) {
    return next(error);
  }
});

router.get('/volunteers', requireDatabase, async (req, res, next) => {
  try {
    const profiles = await VolunteerProfile.find()
      .populate('userId', 'name phone email verificationStatus role')
      .sort({ updatedAt: -1 })
      .lean();

    return res.json({
      data: profiles
        .filter((profile) => profile.userId && profile.userId.role === 'Volunteer')
        .map((profile) => ({
          profileId: profile._id,
          userId: profile.userId._id,
          name: profile.userId.name,
          phone: profile.userId.phone,
          email: profile.userId.email,
          verificationStatus: profile.userId.verificationStatus,
          reliabilityScore: profile.reliabilityScore,
          isAvailable: profile.isAvailable,
          lastKnownLocation: profile.lastKnownLocation,
        })),
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
