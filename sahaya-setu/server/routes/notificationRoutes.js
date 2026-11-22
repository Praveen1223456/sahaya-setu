const express = require('express');
const router = express.Router();

const Notification = require('../models/Notification');
const { optionalJWT, authenticateJWT } = require('../middleware/jwtAuth');

// 1. Get notifications for current user / role / department
router.get('/', optionalJWT, async (req, res, next) => {
  try {
    const filter = {};

    if (req.user) {
      const orClauses = [{ recipient_role: 'all' }];
      if (req.user.id || req.user._id) {
        orClauses.push({ recipient_id: req.user.id || req.user._id });
      }
      if (req.user.role) {
        orClauses.push({ recipient_role: req.user.role });
      }
      if (req.user.department && req.user.department !== '*') {
        orClauses.push({ department: req.user.department });
      }
      filter.$or = orClauses;
    }

    const limit = Math.min(parseInt(req.query.limit || '40', 10), 100);
    const notifications = await Notification.find(filter)
      .sort({ created_at: -1 })
      .limit(limit);

    const unreadCount = await Notification.countDocuments({ ...filter, read: false });

    res.json({
      unread_count: unreadCount,
      notifications,
    });
  } catch (err) {
    next(err);
  }
});

// 2. Mark Notification as Read
router.patch('/:id/read', optionalJWT, async (req, res, next) => {
  try {
    const notif = await Notification.findById(req.params.id);
    if (!notif) {
      return res.status(404).json({ detail: 'Notification not found' });
    }
    notif.read = true;
    await notif.save();
    res.json({ ok: true, id: notif._id, read: true });
  } catch (err) {
    next(err);
  }
});

// 3. Mark All Notifications as Read
router.post('/mark-all-read', optionalJWT, async (req, res, next) => {
  try {
    const filter = { read: false };
    if (req.user && (req.user.id || req.user._id)) {
      filter.$or = [
        { recipient_id: req.user.id || req.user._id },
        { recipient_role: req.user.role || 'all' },
      ];
    }
    await Notification.updateMany(filter, { $set: { read: true } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
