const express = require('express');

const { Emergency, User, VolunteerProfile } = require('../models/fastaid.models');
const { requireDatabase } = require('../middleware/database');
const { requireAdmin } = require('../middleware/rbac');

const router = express.Router();

router.get('/certifications', requireAdmin, requireDatabase, async (req, res, next) => {
  try {
    const pendingProfiles = await VolunteerProfile.find()
      .populate('userId', 'name phone email verificationStatus role')
      .sort({ updatedAt: -1 })
      .lean();

    return res.json({
      data: pendingProfiles.filter((profile) => profile.userId && profile.userId.role === 'Volunteer'),
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/certifications/:profileId/review', requireAdmin, requireDatabase, async (req, res, next) => {
  try {
    const { decision } = req.body;

    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({
        error: 'decision must be approve or reject.',
      });
    }

    const profile = await VolunteerProfile.findById(req.params.profileId).populate('userId');

    if (!profile || !profile.userId) {
      return res.status(404).json({
        error: 'Volunteer profile not found.',
      });
    }

    const newStatus = decision === 'approve' ? 'Verified' : 'Rejected';
    await User.findByIdAndUpdate(profile.userId._id, { verificationStatus: newStatus });
    profile.userId.verificationStatus = newStatus;

    return res.json({
      data: {
        profileId: profile._id,
        userId: profile.userId._id,
        verificationStatus: profile.userId.verificationStatus,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/sensitive-users', requireAdmin, requireDatabase, async (req, res, next) => {
  try {
    const users = await User.find()
      .select('name phone email role verificationStatus createdAt')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ data: users });
  } catch (error) {
    return next(error);
  }
});

router.get('/system-logs', requireAdmin, async (req, res) => {
  return res.json({
    data: [],
    message: 'Connect this endpoint to your structured log store.',
  });
});

router.get('/dashboard-data', requireAdmin, requireDatabase, async (req, res, next) => {
  try {
    const [profiles, users, emergencies] = await Promise.all([
      VolunteerProfile.find()
        .populate('userId', 'name phone email verificationStatus role')
        .sort({ updatedAt: -1 })
        .lean(),
      User.find()
        .select('name phone email role verificationStatus createdAt')
        .sort({ createdAt: -1 })
        .lean(),
      Emergency.find()
        .populate('victimId', 'name phone email')
        .populate('assignedVolunteerId', 'name phone email')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ]);

    return res.json({
      data: {
        certifications: profiles
          .filter((profile) => profile.userId && profile.userId.role === 'Volunteer')
          .map((profile) => ({
            id: profile._id,
            userId: profile.userId._id,
            name: profile.userId.name,
            email: profile.userId.email,
            phone: profile.userId.phone,
            certificationUrl: profile.certificationUrl,
            reliabilityScore: profile.reliabilityScore,
            verificationStatus: profile.userId.verificationStatus,
            isAvailable: profile.isAvailable,
            lastKnownLocation: profile.lastKnownLocation,
            lastLocationUpdatedAt: profile.lastLocationUpdatedAt,
          })),
        users,
        emergencies,
      },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
