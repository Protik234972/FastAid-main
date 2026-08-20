require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { User } = require('../src/models/fastaid.models');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/fastaid_db';

async function seedUsers() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const passwordHash = await bcrypt.hash('password123', 10);

    const users = [
      { name: 'Victim Demo', phone: '01700000001', role: 'Victim', passwordHash, verificationStatus: 'Unverified' },
      { name: 'Volunteer Demo', phone: '01700000002', role: 'Volunteer', passwordHash, verificationStatus: 'Unverified' },
      { name: 'Admin Demo', phone: '01700000003', role: 'Admin', passwordHash, verificationStatus: 'Verified' },
    ];

    for (const u of users) {
      await User.findOneAndUpdate({ phone: u.phone }, u, { upsert: true });
    }

    console.log('Demo users seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding users:', error);
    process.exit(1);
  }
}

seedUsers();
