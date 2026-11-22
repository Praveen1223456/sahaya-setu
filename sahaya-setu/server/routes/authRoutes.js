const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateToken, authenticateJWT } = require('../middleware/jwtAuth');

// 1. Register new user
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, phone, role = 'citizen', department, skills } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ detail: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ detail: 'Password must be at least 6 characters long' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ detail: 'An account with this email already exists' });
    }

    // Assign safe role
    const validRoles = ['citizen', 'department_admin', 'field_employee', 'super_admin'];
    const assignedRole = validRoles.includes(role) ? role : 'citizen';

    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      phone: phone ? phone.trim() : '',
      role: assignedRole,
      department: department || null,
      skills: Array.isArray(skills) ? skills : [],
    });

    await user.save();
    const token = generateToken(user);

    res.status(201).json({
      token,
      user: user.toSafeObject(),
    });
  } catch (err) {
    next(err);
  }
});

// 2. Login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ detail: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ detail: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ detail: 'Invalid email or password' });
    }

    user.lastActiveAt = new Date();
    await user.save();

    const token = generateToken(user);
    res.json({
      token,
      user: user.toSafeObject(),
    });
  } catch (err) {
    next(err);
  }
});

// 3. Current User Profile
router.get('/me', authenticateJWT, async (req, res, next) => {
  try {
    if (req.user._id) {
      const user = await User.findById(req.user._id).select('-password');
      if (user) return res.json({ user });
    }
    res.json({ user: req.user });
  } catch (err) {
    next(err);
  }
});

// 4. Update Profile
router.put('/me', authenticateJWT, async (req, res, next) => {
  try {
    const { name, phone, availability, skills } = req.body || {};
    if (!req.user._id) {
      return res.status(400).json({ detail: 'User ID not found' });
    }
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }

    if (name) user.name = name.trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (availability && ['available', 'busy', 'off_duty'].includes(availability)) {
      user.availability = availability;
    }
    if (Array.isArray(skills)) user.skills = skills;

    await user.save();
    res.json({ user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
});

// 5. Demo Accounts Quick Reference for evaluators/judges
router.get('/demo-accounts', (req, res) => {
  res.json({
    accounts: [
      {
        role: 'Citizen',
        email: 'citizen@sahayasetu.gov.in',
        password: 'password123',
        description: 'Report civic issues, track status, verify repair with feedback',
      },
      {
        role: 'Department Administrator (Electricity)',
        email: 'elec.admin@sahayasetu.gov.in',
        password: 'password123',
        description: 'Manage electricity department queue, assign workers, monitor map',
      },
      {
        role: 'Department Administrator (Water)',
        email: 'water.admin@sahayasetu.gov.in',
        password: 'password123',
        description: 'Manage water supply & pipeline repairs, monitor workload',
      },
      {
        role: 'Field Employee (Electricity Linesman)',
        email: 'elec.field@sahayasetu.gov.in',
        password: 'password123',
        description: 'Accept tasks, GPS navigation, complete repairs with after-photos',
      },
      {
        role: 'Field Employee (Water Plumber/Welder)',
        email: 'water.field@sahayasetu.gov.in',
        password: 'password123',
        description: 'Field response for water pipeline bursts and sewage blocks',
      },
      {
        role: 'Super Administrator',
        email: 'admin@sahayasetu.gov.in',
        password: 'password123',
        description: 'Full city-wide control room, disaster mode activation, cross-dept analytics',
      },
    ],
  });
});

module.exports = router;
