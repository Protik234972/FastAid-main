require('dotenv').config();

const mongoose = require('mongoose');

const {
  Emergency,
  Payment,
  User,
  VolunteerProfile,
} = require('../src/models/fastaid.models');

const ids = {
  admin: new mongoose.Types.ObjectId('665000000000000000000001'),
  victim: new mongoose.Types.ObjectId('665000000000000000000002'),
  victimTwo: new mongoose.Types.ObjectId('665000000000000000000003'),
  volunteer: new mongoose.Types.ObjectId('665000000000000000000101'),
  volunteerTwo: new mongoose.Types.ObjectId('665000000000000000000102'),
  volunteerThree: new mongoose.Types.ObjectId('665000000000000000000103'),
  emergency: new mongoose.Types.ObjectId('665000000000000000000201'),
};

const demoUsers = [
  {
    _id: ids.admin,
    name: 'Mahmud Hasan',
    phone: '+8801611112222',
    email: 'admin@fastresponder.local',
    passwordHash: 'demo-password-hash',
    role: 'Admin',
    verificationStatus: 'Verified',
  },
  {
    _id: ids.victim,
    name: 'Sadia Akter',
    phone: '+8801700001111',
    email: 'sadia.victim@example.com',
    passwordHash: 'demo-password-hash',
    role: 'Victim',
    verificationStatus: 'Verified',
  },
  {
    _id: ids.victimTwo,
    name: 'Rafi Ahmed',
    phone: '+8801700002222',
    email: 'rafi.victim@example.com',
    passwordHash: 'demo-password-hash',
    role: 'Victim',
    verificationStatus: 'Verified',
  },
  {
    _id: ids.volunteer,
    name: 'Ayesha Rahman',
    phone: '+8801711002200',
    email: 'ayesha.volunteer@example.com',
    passwordHash: 'demo-password-hash',
    role: 'Volunteer',
    verificationStatus: 'Verified',
  },
  {
    _id: ids.volunteerTwo,
    name: 'Farhan Karim',
    phone: '+8801812453344',
    email: 'farhan.volunteer@example.com',
    passwordHash: 'demo-password-hash',
    role: 'Volunteer',
    verificationStatus: 'Pending',
  },
  {
    _id: ids.volunteerThree,
    name: 'Nusrat Jahan',
    phone: '+8801912347788',
    email: 'nusrat.volunteer@example.com',
    passwordHash: 'demo-password-hash',
    role: 'Volunteer',
    verificationStatus: 'Verified',
  },
];

const demoProfiles = [
  {
    userId: ids.volunteer,
    certificationUrl: '/uploads/cert-ayesha.pdf',
    reliabilityScore: 91,
    isAvailable: true,
    lastKnownLocation: {
      type: 'Point',
      coordinates: [90.4219, 23.8176],
    },
    lastLocationUpdatedAt: new Date(),
    activeEmergencyId: null,
  },
  {
    userId: ids.volunteerTwo,
    certificationUrl: '/uploads/cert-farhan.pdf',
    reliabilityScore: 83,
    isAvailable: true,
    lastKnownLocation: {
      type: 'Point',
      coordinates: [90.4074, 23.8018],
    },
    lastLocationUpdatedAt: new Date(),
    activeEmergencyId: null,
  },
  {
    userId: ids.volunteerThree,
    certificationUrl: '/uploads/cert-nusrat.pdf',
    reliabilityScore: 74,
    isAvailable: false,
    lastKnownLocation: {
      type: 'Point',
      coordinates: [90.3917, 23.7806],
    },
    lastLocationUpdatedAt: new Date(),
    activeEmergencyId: null,
  },
];

async function upsertUsers() {
  await Promise.all(
    demoUsers.map((user) =>
      User.updateOne(
        { _id: user._id },
        { $set: user },
        { upsert: true }
      )
    )
  );
}

async function upsertVolunteerProfiles() {
  await Promise.all(
    demoProfiles.map((profile) =>
      VolunteerProfile.updateOne(
        { userId: profile.userId },
        { $set: profile },
        { upsert: true }
      )
    )
  );
}

async function upsertEmergency() {
  await Emergency.updateOne(
    { _id: ids.emergency },
    {
      $set: {
        victimId: ids.victim,
        assignedVolunteerId: null,
        notifiedResponderIds: [ids.volunteer, ids.volunteerTwo],
        description: 'Demo emergency near Gulshan.',
        photoUrl: '',
        status: 'Pending',
        location: {
          type: 'Point',
          coordinates: [90.4125, 23.8103],
        },
        history: [
          {
            status: 'Pending',
            changedBy: ids.victim,
            changedAt: new Date(),
            note: 'Seeded demo emergency.',
          },
        ],
      },
    },
    { upsert: true }
  );
}

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required. Copy .env.example to .env first.');
  }

  await mongoose.connect(process.env.MONGO_URI);
  await upsertUsers();
  await upsertVolunteerProfiles();
  await upsertEmergency();
  await Payment.deleteMany({ emergencyId: ids.emergency });

  console.log('Demo data inserted/updated.');
  console.log('');
  console.log('Use these IDs in the web app:');
  console.log(`Admin:     ${ids.admin}  Mahmud Hasan`);
  console.log(`Victim:    ${ids.victim}  Sadia Akter`);
  console.log(`Victim:    ${ids.victimTwo}  Rafi Ahmed`);
  console.log(`Volunteer: ${ids.volunteer}  Ayesha Rahman`);
  console.log(`Volunteer: ${ids.volunteerTwo}  Farhan Karim`);
  console.log(`Volunteer: ${ids.volunteerThree}  Nusrat Jahan`);
  console.log(`Emergency: ${ids.emergency}`);

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect();
  process.exitCode = 1;
});
