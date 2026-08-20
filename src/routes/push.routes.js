const express = require('express');
const { User } = require('../models/fastaid.models');
const { requireAuthenticatedUser } = require('../middleware/rbac');

const router = express.Router();

router.get('/public-key', (req, res) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return res.status(500).json({ error: 'VAPID_PUBLIC_KEY is not configured on the server.' });
  }
  res.json({ publicKey });
});

router.post('/subscribe', requireAuthenticatedUser, async (req, res, next) => {
  try {
    const subscription = req.body;
    
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid push subscription.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Check if subscription already exists based on endpoint
    const existingSub = user.pushSubscriptions.find(sub => sub.endpoint === subscription.endpoint);
    
    if (!existingSub) {
      user.pushSubscriptions.push(subscription);
      await user.save();
    }

    res.status(201).json({ message: 'Push subscription saved successfully.' });
  } catch (error) {
    next(error);
  }
});

router.delete('/unsubscribe', requireAuthenticatedUser, async (req, res, next) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: 'Missing endpoint.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    user.pushSubscriptions = user.pushSubscriptions.filter(sub => sub.endpoint !== endpoint);
    await user.save();

    res.json({ message: 'Push subscription removed successfully.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
