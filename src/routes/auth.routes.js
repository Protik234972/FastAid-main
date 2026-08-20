const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models/fastaid.models');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';
const { requireAuthenticatedUser } = require('../middleware/rbac');

router.post('/register', async (req, res, next) => {
  try {
    const { name, phone, email, password, role } = req.body;

    if (!['Victim', 'Volunteer', 'Admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ error: 'Phone number already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      phone,
      email,
      passwordHash,
      role,
      verificationStatus: role === 'Admin' ? 'Verified' : 'Unverified'
    });

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    const user = await User.findOne({ $or: [{ phone: phone }, { email: phone }] }).select('+passwordHash');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({ token, user: { id: user._id, name: user.name, role: user.role } });
  } catch (error) {
    next(error);
  }
});

router.get('/medical-profile', requireAuthenticatedUser, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('medicalProfile').lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ data: user.medicalProfile || {} });
  } catch (error) {
    next(error);
  }
});

router.patch('/medical-profile', requireAuthenticatedUser, async (req, res, next) => {
  try {
    const { bloodType, allergies, preExistingConditions, emergencyContactName, emergencyContactPhone } = req.body;
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.medicalProfile = {
      bloodType: bloodType || user.medicalProfile?.bloodType || '',
      allergies: allergies || user.medicalProfile?.allergies || '',
      preExistingConditions: preExistingConditions || user.medicalProfile?.preExistingConditions || '',
      emergencyContactName: emergencyContactName || user.medicalProfile?.emergencyContactName || '',
      emergencyContactPhone: emergencyContactPhone || user.medicalProfile?.emergencyContactPhone || '',
    };

    await user.save();
    res.json({ data: user.medicalProfile });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
