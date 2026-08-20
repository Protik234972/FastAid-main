const mongoose = require('mongoose');

const { Schema } = mongoose;

const geoPointSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      validate: {
        validator(value) {
          return (
            Array.isArray(value) &&
            value.length === 2 &&
            value[0] >= -180 &&
            value[0] <= 180 &&
            value[1] >= -90 &&
            value[1] <= 90
          );
        },
        message: 'coordinates must be [longitude, latitude].',
      },
    },
  },
  { _id: false }
);

const medicalProfileSchema = new Schema(
  {
    bloodType: { type: String, trim: true, default: '' },
    allergies: { type: String, trim: true, default: '' },
    preExistingConditions: { type: String, trim: true, default: '' },
    emergencyContactName: { type: String, trim: true, default: '' },
    emergencyContactPhone: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ['Victim', 'Volunteer', 'Admin'],
      required: true,
      index: true,
    },
    verificationStatus: {
      type: String,
      enum: ['Unverified', 'Pending', 'Verified', 'Rejected', 'Suspended'],
      default: 'Unverified',
      index: true,
    },
    medicalProfile: {
      type: medicalProfileSchema,
      default: () => ({}),
    },
    pushSubscriptions: {
      type: [Schema.Types.Mixed],
      default: [],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  }
);

const volunteerProfileSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    certificationUrl: {
      type: String,
      trim: true,
    },
    reliabilityScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 50,
      index: true,
    },
    isAvailable: {
      type: Boolean,
      default: false,
      index: true,
    },
    lastKnownLocation: {
      type: geoPointSchema,
      required: true,
      index: '2dsphere',
    },
    lastLocationUpdatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    activeEmergencyId: {
      type: Schema.Types.ObjectId,
      ref: 'Emergency',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

volunteerProfileSchema.index({
  isAvailable: 1,
  reliabilityScore: -1,
  lastKnownLocation: '2dsphere',
});

const emergencyHistorySchema = new Schema(
  {
    status: {
      type: String,
      enum: ['Pending', 'Assigned', 'On the Way', 'Help Arrived', 'Closed', 'Cancelled'],
      required: true,
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    changedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    note: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const emergencySchema = new Schema(
  {
    victimId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    assignedVolunteerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    notifiedResponderIds: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    photoUrl: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Assigned', 'On the Way', 'Help Arrived', 'Closed', 'Cancelled'],
      default: 'Pending',
      required: true,
      index: true,
    },
    location: {
      type: geoPointSchema,
      required: true,
      index: '2dsphere',
    },
    aiAnalysis: {
      severity: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Critical'],
      },
      keyInjuries: [String],
      victimAdvice: [String],
      responderAdvice: [String],
      analyzedAt: Date
    },
    history: {
      type: [emergencyHistorySchema],
      default: () => [{ status: 'Pending', changedAt: new Date() }],
    },
  },
  {
    timestamps: true,
  }
);

emergencySchema.index({ status: 1, location: '2dsphere' });
emergencySchema.index(
  { _id: 1, status: 1, assignedVolunteerId: 1 },
  {
    partialFilterExpression: {
      status: 'Pending',
      assignedVolunteerId: null,
    },
  }
);

const paymentSchema = new Schema(
  {
    emergencyId: {
      type: Schema.Types.ObjectId,
      ref: 'Emergency',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    provider: {
      type: String,
      enum: ['Bkash', 'Nagad'],
      required: true,
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
      default: 'Pending',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ provider: 1, transactionId: 1 }, { unique: true });

const User = mongoose.model('User', userSchema);
const VolunteerProfile = mongoose.model('VolunteerProfile', volunteerProfileSchema);
const Emergency = mongoose.model('Emergency', emergencySchema);
const Payment = mongoose.model('Payment', paymentSchema);

const EMERGENCY_MATCH_RADIUS_METERS = 5000;
const EMERGENCY_PROCESSING_TIMEOUT_MS = 3000;
const RESPONDER_PUSH_TIMEOUT_MS = 2000;
const EMERGENCY_STATUSES = ['Pending', 'Assigned', 'On the Way', 'Help Arrived', 'Closed', 'Cancelled'];
const EMERGENCY_STATUS_TRANSITIONS = Object.freeze({
  Pending: ['Assigned', 'Cancelled'],
  Assigned: ['On the Way'],
  'On the Way': ['Help Arrived'],
  'Help Arrived': ['Closed'],
  Closed: [],
  Cancelled: [],
});

function assertValidObjectId(value, fieldName) {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error(`${fieldName} must be a valid ObjectId.`);
  }
}

function normalizeGpsPoint(autoGps) {
  const longitude = Number(autoGps && autoGps.longitude);
  const latitude = Number(autoGps && autoGps.latitude);

  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  ) {
    throw new Error('autoGps must include valid longitude and latitude values.');
  }

  return {
    type: 'Point',
    coordinates: [longitude, latitude],
  };
}

function assertEmergencyRequestInput({ victimId, description, autoGps }) {
  assertValidObjectId(victimId, 'victimId');

  if (!description || typeof description !== 'string' || !description.trim()) {
    throw new Error('description is required.');
  }

  return {
    victimId,
    description: description.trim(),
    location: normalizeGpsPoint(autoGps),
  };
}

function withTimeout(work, timeoutMs, message) {
  let timeoutId;

  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([work, timeout]).finally(() => clearTimeout(timeoutId));
}

function assertValidEmergencyStatus(status) {
  if (!EMERGENCY_STATUSES.includes(status)) {
    throw new Error(`status must be one of: ${EMERGENCY_STATUSES.join(', ')}.`);
  }
}

function canTransitionEmergencyStatus(fromStatus, toStatus) {
  return (EMERGENCY_STATUS_TRANSITIONS[fromStatus] || []).includes(toStatus);
}

function assertEmergencyStatusTransition(fromStatus, toStatus) {
  assertValidEmergencyStatus(fromStatus);
  assertValidEmergencyStatus(toStatus);

  if (!canTransitionEmergencyStatus(fromStatus, toStatus)) {
    throw new Error(`Invalid emergency status transition: ${fromStatus} -> ${toStatus}.`);
  }
}

function uniqueObjectIds(values) {
  return [...new Set((values || []).filter(Boolean).map((value) => value.toString()))];
}

function buildEmergencyNotificationPayload({ emergency, type }) {
  const payload = {
    type,
    emergencyId: emergency._id.toString(),
    status: emergency.status,
    location: emergency.location,
    assignedVolunteerId: emergency.assignedVolunteerId && emergency.assignedVolunteerId.toString(),
  };
  
  if (emergency.victimId && emergency.victimId.medicalProfile) {
    payload.medicalProfile = emergency.victimId.medicalProfile;
  }
  
  return payload;
}

async function notifyUserWithFallback({
  user,
  payload,
  sendPush,
  sendSms,
  pushTimeoutMs = RESPONDER_PUSH_TIMEOUT_MS,
}) {
  let pushResult = { status: 'skipped', reason: 'sendPush is not configured.' };

  if (typeof sendPush === 'function') {
    try {
      pushResult = await withTimeout(
        sendPush({ user, payload }),
        pushTimeoutMs,
        'Push notification exceeded 2 seconds.'
      );

      return {
        channel: 'push',
        status: 'sent',
        pushResult,
      };
    } catch (error) {
      pushResult = {
        status: 'failed',
        reason: error.message,
      };
    }
  }

  if (typeof sendSms !== 'function') {
    return {
      channel: 'none',
      status: 'failed',
      pushResult,
      smsResult: { status: 'skipped', reason: 'sendSms is not configured.' },
    };
  }

  const smsResult = await sendSms({
    user,
    payload,
    message: `FastAid update: emergency ${payload.emergencyId} is now ${payload.status}.`,
  });

  return {
    channel: 'sms',
    status: 'sent',
    pushResult,
    smsResult,
  };
}

async function findNearbyAvailableVolunteers({ longitude, latitude, maxDistanceMeters = 5000, limit = 20 }) {
  return VolunteerProfile.find({
    isAvailable: true,
    lastKnownLocation: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        $maxDistance: maxDistanceMeters,
      },
    },
  })
    .sort({ reliabilityScore: -1 })
    .limit(limit)
    .populate('userId', 'name phone email verificationStatus');
}

async function findRankedActiveResponders({
  location,
  maxDistanceMeters = EMERGENCY_MATCH_RADIUS_METERS,
  limit = 10,
  maxTimeMS = 2500,
}) {
  const [longitude, latitude] = location.coordinates;

  return VolunteerProfile.aggregate([
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        distanceField: 'distanceMeters',
        maxDistance: maxDistanceMeters,
        spherical: true,
        query: {
          isAvailable: true,
          activeEmergencyId: null,
        },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    {
      $match: {
        'user.role': 'Volunteer',
        'user.verificationStatus': 'Verified',
      },
    },
    {
      $addFields: {
        distanceScore: {
          $max: [0, { $subtract: [100, { $divide: ['$distanceMeters', 50] }] }],
        },
        responseHistoryScore: '$reliabilityScore',
      },
    },
    {
      $addFields: {
        matchScore: {
          $add: [
            { $multiply: ['$distanceScore', 0.6] },
            { $multiply: ['$responseHistoryScore', 0.4] },
          ],
        },
      },
    },
    {
      $sort: {
        matchScore: -1,
        distanceMeters: 1,
        reliabilityScore: -1,
      },
    },
    {
      $limit: limit,
    },
    {
      $project: {
        _id: 1,
        userId: 1,
        certificationUrl: 1,
        reliabilityScore: 1,
        isAvailable: 1,
        lastKnownLocation: 1,
        lastLocationUpdatedAt: 1,
        distanceMeters: 1,
        matchScore: 1,
        'user.name': 1,
        'user.phone': 1,
        'user.email': 1,
        'user.verificationStatus': 1,
      },
    },
  ]).option({ maxTimeMS });
}

async function initiateEmergencyRequest({
  victimId,
  description,
  photoUrl,
  autoGps,
  responderLimit = 10,
}) {
  const startedAt = Date.now();
  const payload = assertEmergencyRequestInput({ victimId, description, autoGps });

  return withTimeout(
    (async () => {
      const emergency = await Emergency.create({
        victimId: payload.victimId,
        description: payload.description,
        photoUrl,
        location: payload.location,
        status: 'Pending',
        history: [
          {
            status: 'Pending',
            changedBy: payload.victimId,
            changedAt: new Date(),
            note: 'Emergency request initiated from auto-GPS.',
          },
        ],
      });

      const remainingMs = Math.max(250, EMERGENCY_PROCESSING_TIMEOUT_MS - (Date.now() - startedAt) - 150);
      const rankedResponders = await findRankedActiveResponders({
        location: payload.location,
        maxDistanceMeters: EMERGENCY_MATCH_RADIUS_METERS,
        limit: responderLimit,
        maxTimeMS: remainingMs,
      });
      const notifiedResponderIds = uniqueObjectIds(rankedResponders.map((responder) => responder.userId));

      if (notifiedResponderIds.length > 0) {
        emergency.notifiedResponderIds = notifiedResponderIds;
        await emergency.save({ timestamps: false });
      }

      return {
        emergency,
        rankedResponders,
        processingTimeMs: Date.now() - startedAt,
      };
    })(),
    EMERGENCY_PROCESSING_TIMEOUT_MS,
    'Emergency request processing exceeded 3 seconds.'
  );
}

async function updateVolunteerLocation({ volunteerUserId, longitude, latitude }) {
  return VolunteerProfile.updateOne(
    { userId: volunteerUserId },
    {
      $set: {
        lastKnownLocation: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        lastLocationUpdatedAt: new Date(),
      },
    },
    {
      timestamps: false,
    }
  );
}

async function transitionEmergencyStatus({ emergencyId, nextStatus, changedByUserId, note }) {
  assertValidObjectId(emergencyId, 'emergencyId');
  assertValidObjectId(changedByUserId, 'changedByUserId');
  assertValidEmergencyStatus(nextStatus);

  const currentEmergency = await Emergency.findById(emergencyId).select('status assignedVolunteerId');

  if (!currentEmergency) {
    throw new Error('Emergency not found.');
  }

  assertEmergencyStatusTransition(currentEmergency.status, nextStatus);

  const updatedEmergency = await Emergency.findOneAndUpdate(
    {
      _id: emergencyId,
      status: currentEmergency.status,
    },
    {
      $set: {
        status: nextStatus,
      },
      $push: {
        history: {
          status: nextStatus,
          changedBy: changedByUserId,
          changedAt: new Date(),
          note,
        },
      },
    },
    {
      new: true,
    }
  );

  if (!updatedEmergency) {
    throw new Error('Emergency status changed before the transition could be applied.');
  }

  return updatedEmergency;
}

async function assignVolunteerToEmergency({
  emergencyId,
  volunteerUserId,
  assignedByUserId,
  notifiedResponderIds = [],
}) {
  assertValidObjectId(emergencyId, 'emergencyId');
  assertValidObjectId(volunteerUserId, 'volunteerUserId');

  const session = await mongoose.startSession();

  try {
    return await session.withTransaction(async () => {
      const responderIdsToStore = uniqueObjectIds(notifiedResponderIds);
      const emergencyUpdate = {
        $set: {
          assignedVolunteerId: volunteerUserId,
          status: 'Assigned',
        },
        $push: {
          history: {
            status: 'Assigned',
            changedBy: assignedByUserId || volunteerUserId,
            changedAt: new Date(),
            note: 'Volunteer assigned.',
          },
        },
      };

      if (responderIdsToStore.length > 0) {
        emergencyUpdate.$addToSet = {
          notifiedResponderIds: { $each: responderIdsToStore },
        };
      }

      const emergency = await Emergency.findOneAndUpdate(
        {
          _id: emergencyId,
          status: 'Pending',
          assignedVolunteerId: null,
        },
        emergencyUpdate,
        {
          new: true,
          session,
        }
      );

      if (!emergency) {
        throw new Error('Emergency is no longer pending or already has an assigned volunteer.');
      }

      const volunteer = await VolunteerProfile.findOneAndUpdate(
        {
          userId: volunteerUserId,
          isAvailable: true,
          activeEmergencyId: null,
        },
        {
          $set: {
            isAvailable: false,
            activeEmergencyId: emergency._id,
          },
        },
        {
          new: true,
          session,
        }
      );

      if (!volunteer) {
        throw new Error('Volunteer is no longer available.');
      }

      return emergency;
    });
  } finally {
    await session.endSession();
  }
}

async function acceptEmergencyCase({
  emergencyId,
  volunteerUserId,
  notifiedResponderIds = [],
  sendPush,
  sendSms,
}) {
  const emergency = await assignVolunteerToEmergency({
    emergencyId,
    volunteerUserId,
    assignedByUserId: volunteerUserId,
    notifiedResponderIds,
  });

  await emergency.populate('victimId', 'name medicalProfile');

  const acceptedResponder = await User.findById(volunteerUserId).select('name phone email');
  const assignmentPayload = buildEmergencyNotificationPayload({
    emergency,
    type: 'EMERGENCY_ASSIGNED',
  });

  const responderNotification = await notifyUserWithFallback({
    user: acceptedResponder,
    payload: assignmentPayload,
    sendPush,
    sendSms,
    pushTimeoutMs: RESPONDER_PUSH_TIMEOUT_MS,
  });

  const otherResponderIds = uniqueObjectIds(emergency.notifiedResponderIds).filter(
    (responderId) => responderId !== volunteerUserId.toString()
  );
  const otherResponders = await User.find({ _id: { $in: otherResponderIds } }).select('name phone email');
  const takenPayload = buildEmergencyNotificationPayload({
    emergency,
    type: 'EMERGENCY_TAKEN',
  });

  const otherResponderNotifications = await Promise.allSettled(
    otherResponders.map((user) =>
      notifyUserWithFallback({
        user,
        payload: takenPayload,
        sendPush,
        sendSms,
        pushTimeoutMs: RESPONDER_PUSH_TIMEOUT_MS,
      })
    )
  );

  return {
    emergency,
    responderNotification,
    otherResponderNotifications,
  };
}

module.exports = {
  User,
  VolunteerProfile,
  Emergency,
  Payment,
  EMERGENCY_STATUS_TRANSITIONS,
  assignVolunteerToEmergency,
  acceptEmergencyCase,
  canTransitionEmergencyStatus,
  findRankedActiveResponders,
  findNearbyAvailableVolunteers,
  initiateEmergencyRequest,
  transitionEmergencyStatus,
  updateVolunteerLocation,
};
