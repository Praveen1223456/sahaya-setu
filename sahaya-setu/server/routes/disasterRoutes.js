const express = require('express');
const router = express.Router();

const DisasterEvent = require('../models/DisasterEvent');
const Incident = require('../models/Incident');
const { authenticateJWT, requireRole, optionalJWT } = require('../middleware/jwtAuth');
const { notifyAll, createAndPushNotification } = require('../services/socket');

// 1. Get Current Disaster Mode Status and Active Advisories
router.get('/status', async (req, res, next) => {
  try {
    const activeEvents = await DisasterEvent.find({ status: 'active' }).sort({ activatedAt: -1 });

    const isDisasterActive = activeEvents.length > 0;
    const primaryEvent = activeEvents[0] || null;

    res.json({
      is_disaster_mode: isDisasterActive,
      active_events_count: activeEvents.length,
      primary_event: primaryEvent,
      active_events: activeEvents,
      safety_advisory:
        'SAFETY ADVISORY: Do not approach damaged electrical lines, unstable structures, floodwaters, or other dangerous locations. Report the hazard from a safe distance and contact emergency services (112) when life is in danger.',
    });
  } catch (err) {
    next(err);
  }
});

// 2. List All Disaster Events
router.get('/events', async (req, res, next) => {
  try {
    const events = await DisasterEvent.find().sort({ activatedAt: -1 });
    res.json(events);
  } catch (err) {
    next(err);
  }
});

// 3. Declare / Activate Disaster Event (Admin / Super Admin)
router.post(
  '/events',
  authenticateJWT,
  requireRole('department_admin', 'super_admin'),
  async (req, res, next) => {
    try {
      const {
        title,
        hazardType = 'cyclone',
        severity = 'critical',
        areaName,
        center_lat,
        center_lon,
        radius_km = 25,
        safetyGuidelines,
      } = req.body || {};

      if (!title || !areaName || center_lat === undefined || center_lon === undefined) {
        return res.status(400).json({
          detail: 'title, areaName, center_lat, and center_lon are required',
        });
      }

      const event = new DisasterEvent({
        title: title.trim(),
        hazardType,
        severity,
        areaName: areaName.trim(),
        center_lat: parseFloat(center_lat),
        center_lon: parseFloat(center_lon),
        radius_km: parseFloat(radius_km),
        location: {
          type: 'Point',
          coordinates: [parseFloat(center_lon), parseFloat(center_lat)],
        },
        safetyGuidelines: Array.isArray(safetyGuidelines) && safetyGuidelines.length > 0
          ? safetyGuidelines
          : undefined,
        status: 'active',
        activatedBy: req.user.name,
        activatedAt: new Date(),
      });

      await event.save();

      // Broadcast disaster mode activation to all connected clients
      notifyAll('disaster_mode_activated', {
        event_id: event._id,
        title: event.title,
        severity: event.severity,
        area: event.areaName,
        radius_km: event.radius_km,
        center: [event.center_lat, event.center_lon],
      });

      await createAndPushNotification({
        recipient_role: 'all',
        title: `EMERGENCY ALERT: ${event.title}`,
        message: `Disaster response mode activated for ${event.areaName}. Severity: ${event.severity.toUpperCase()}.`,
        type: 'disaster_alert',
      });

      res.status(201).json(event);
    } catch (err) {
      next(err);
    }
  }
);

// 4. End / Deactivate Disaster Event
router.post(
  '/events/:id/end',
  authenticateJWT,
  requireRole('department_admin', 'super_admin'),
  async (req, res, next) => {
    try {
      const event = await DisasterEvent.findById(req.params.id);
      if (!event) {
        return res.status(404).json({ detail: 'Disaster event not found' });
      }

      event.status = 'ended';
      event.endedAt = new Date();
      await event.save();

      notifyAll('disaster_mode_ended', {
        event_id: event._id,
        title: event.title,
      });

      res.json(event);
    } catch (err) {
      next(err);
    }
  }
);

// 5. Emergency Incidents Queue (Prioritized by Criticality)
router.get('/incidents', optionalJWT, async (req, res, next) => {
  try {
    const filter = {
      $or: [
        { is_disaster_mode: true },
        { emergency_severity: { $in: ['critical', 'high'] } },
        { category: { $in: ['ELEC-POLE', 'ELEC-WIRE', 'DISASTER-FLOOD', 'DISASTER-CYCLONE', 'PUBLIC-SAFETY', 'FLOOD'] } },
      ],
    };

    if (req.query.status) {
      filter.status = { $in: req.query.status.split(',').map((s) => s.trim()) };
    }

    const incidents = await Incident.find(filter)
      .sort({
        emergency_severity: 1, // critical first
        priority: -1,
        created_at: -1,
      })
      .limit(150);

    res.json(incidents);
  } catch (err) {
    next(err);
  }
});

// 6. Infrastructure Restoration Statistics
router.get('/restoration-stats', async (req, res, next) => {
  try {
    const emergencyFilter = {
      $or: [
        { is_disaster_mode: true },
        { emergency_severity: { $in: ['critical', 'high'] } },
        { category: { $in: ['ELEC-POLE', 'ELEC-WIRE', 'DISASTER-FLOOD', 'DISASTER-CYCLONE', 'PUBLIC-SAFETY', 'FLOOD'] } },
      ],
    };

    const [totalEmergency, restoredEmergency, inProgressEmergency, criticalUnresolved] =
      await Promise.all([
        Incident.countDocuments(emergencyFilter),
        Incident.countDocuments({ ...emergencyFilter, status: { $in: ['resolved', 'closed'] } }),
        Incident.countDocuments({ ...emergencyFilter, status: 'in_progress' }),
        Incident.countDocuments({
          ...emergencyFilter,
          emergency_severity: 'critical',
          status: { $in: ['received', 'assigned', 'review', 'escalated'] },
        }),
      ]);

    // Breakdown by department
    const departments = ['electricity', 'water', 'roads', 'sanitation', 'horticulture', 'drainage', 'emergency'];
    const deptBreakdown = {};

    for (const d of departments) {
      const [total, resolved] = await Promise.all([
        Incident.countDocuments({ ...emergencyFilter, department: d }),
        Incident.countDocuments({ ...emergencyFilter, department: d, status: { $in: ['resolved', 'closed'] } }),
      ]);
      deptBreakdown[d] = {
        total,
        resolved,
        pending: total - resolved,
        rate: total > 0 ? Math.round((resolved / total) * 100) : 100,
      };
    }

    const restorationRate =
      totalEmergency > 0 ? Math.round((restoredEmergency / totalEmergency) * 100) : 100;

    res.json({
      total_emergency_reports: totalEmergency,
      restored_count: restoredEmergency,
      in_progress_count: inProgressEmergency,
      pending_count: totalEmergency - restoredEmergency,
      critical_unresolved: criticalUnresolved,
      restoration_rate_percentage: restorationRate,
      departments: deptBreakdown,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
