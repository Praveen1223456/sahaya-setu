const express = require('express');
const router = express.Router();

const rules = require('../config/rules');
const alerts = require('../services/alerts');
const services = require('../services/services');
const sitrep = require('../services/sitrep');
const sms = require('../services/sms');
const formatters = require('../views/formatters');
const { currentStaff, controlStaff, checkAccess } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const Incident = require('../models/Incident');
const OutboxMessage = require('../models/OutboxMessage');
const Alert = require('../models/Alert');
const { getNextSequence } = require('../models/Counter');

async function getIncidentOr404(id) {
  const inc = await Incident.findOne({ id: parseInt(id, 10) });
  if (!inc) {
    const err = new Error(`Ticket ${id} not found`);
    err.status = 404;
    throw err;
  }
  return inc;
}

// 1. Current user
router.get('/auth/me', currentStaff, (req, res) => {
  res.json({
    name: req.staff.name,
    department: req.staff.department,
    role: req.staff.role,
  });
});

// 2. Incident queue
router.get('/incidents', currentStaff, async (req, res, next) => {
  try {
    let department = req.query.department;
    if (!req.staff.isControl) {
      department = req.staff.department;
    }
    const filter = {};
    if (department && department !== '*') {
      filter.department = department;
    }

    if (req.query.status) {
      const statuses = req.query.status
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      filter.status = { $in: statuses };
    } else if (req.query.open_only !== 'false') {
      filter.status = { $in: [...rules.ACTIVE_STATUSES, 'resolved'] };
    }

    if (req.query.sos !== undefined) {
      filter.is_sos = req.query.sos === 'true';
    }
    if (req.query.needs_review !== undefined) {
      filter.needs_review = req.query.needs_review === 'true';
    }

    const limit = Math.min(parseInt(req.query.limit || '300', 10), 1000);
    const incidents = await Incident.find(filter);
    const now = new Date();

    const formatted = await Promise.all(
      incidents.map((i) => formatters.incidentOut(i, now, false))
    );
    formatted.sort((a, b) => b.priority - a.priority);

    const items = formatted.slice(0, limit);
    res.json({
      count: items.length,
      items,
      server_time: formatters.iso(now),
    });
  } catch (err) {
    next(err);
  }
});

// 3. Single incident detail
router.get('/incidents/:id', currentStaff, async (req, res, next) => {
  try {
    const inc = await getIncidentOr404(req.params.id);
    checkAccess(req.staff, inc);
    const out = await formatters.incidentOut(inc, new Date(), true);
    res.json(out);
  } catch (err) {
    next(err);
  }
});

// 4. Update status
router.post(
  '/incidents/:id/status',
  currentStaff,
  upload.single('proof'),
  async (req, res, next) => {
    try {
      const inc = await getIncidentOr404(req.params.id);
      checkAccess(req.staff, inc);

      const status = req.body.status;
      if (!status) {
        return res.status(400).json({ detail: 'status is required' });
      }
      if (status === 'rejected' && !req.staff.isControl) {
        return res.status(403).json({ detail: 'Only the control room can reject a report' });
      }

      const actorParam = req.body.actor;
      const who =
        actorParam && actorParam !== req.staff.name
          ? `${actorParam} (${req.staff.name})`
          : req.staff.name;

      const proofPhoto = req.file ? req.file.buffer : null;
      const updated = await services.changeStatus(inc, status, {
        actor: who.slice(0, 40),
        note: req.body.note,
        proofPhoto,
      });

      const out = await formatters.incidentOut(updated, new Date(), true);
      res.json(out);
    } catch (err) {
      next(err);
    }
  }
);

// 5. Merge incident
router.post('/incidents/:id/merge-into/:target_id', controlStaff, async (req, res, next) => {
  try {
    const source = await getIncidentOr404(req.params.id);
    const target = await getIncidentOr404(req.params.target_id);
    const merged = await services.mergeIncidents(source, target, req.staff.name);
    const out = await formatters.incidentOut(merged, new Date(), true);
    res.json(out);
  } catch (err) {
    next(err);
  }
});

// 6. Run escalations
router.post('/admin/run-escalations', controlStaff, async (req, res, next) => {
  try {
    const list = await services.runEscalations();
    res.json({ escalated: list });
  } catch (err) {
    next(err);
  }
});

// 7. Outbox (SMS log)
router.get('/outbox', controlStaff, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.phone) {
      filter.to_phone = sms.normalizePhone(req.query.phone);
    }
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 500);
    const rows = await OutboxMessage.find(filter).sort({ id: -1 }).limit(limit);

    res.json(
      rows.map((m) => ({
        id: m.id,
        to: m.to_phone,
        body: m.body,
        incident_id: m.incident_id,
        delivered: m.delivered,
        at: formatters.iso(m.created_at),
      }))
    );
  } catch (err) {
    next(err);
  }
});

// 8. Situation report
router.get('/sitrep', controlStaff, async (req, res, next) => {
  try {
    const rep = await sitrep.generate();
    res.json(rep);
  } catch (err) {
    next(err);
  }
});

// 9. Alerts list
router.get('/alerts', currentStaff, async (req, res, next) => {
  try {
    const rows = await Alert.find().sort({ id: -1 });
    res.json(rows.map((a) => formatters.alertOut(a)));
  } catch (err) {
    next(err);
  }
});

// 10. Create alert
router.post('/alerts', controlStaff, async (req, res, next) => {
  try {
    const {
      level = 'orange',
      hazard = 'Cyclone',
      title,
      message,
      message_te,
      area_name,
      center_lat,
      center_lon,
      radius_km,
      expires_in_hours = 48,
    } = req.body || {};

    if (!title || !message) {
      return res.status(400).json({ detail: 'title and message are required' });
    }

    const now = new Date();
    const expiresAt = expires_in_hours
      ? new Date(now.getTime() + parseFloat(expires_in_hours) * 3600000)
      : null;

    const id = await getNextSequence('alerts');
    const alert = new Alert({
      id,
      level,
      hazard,
      title,
      message,
      message_te: message_te || null,
      area_name: area_name || null,
      center_lat: center_lat !== undefined && center_lat !== null ? parseFloat(center_lat) : null,
      center_lon: center_lon !== undefined && center_lon !== null ? parseFloat(center_lon) : null,
      radius_km: radius_km !== undefined && radius_km !== null ? parseFloat(radius_km) : null,
      source: 'manual',
      created_by: req.staff.name,
      created_at: now,
      expires_at: expiresAt,
      active: true,
    });
    await alert.save();
    res.json(formatters.alertOut(alert));
  } catch (err) {
    next(err);
  }
});

// 11. Import CAP
router.post('/alerts/import-cap', controlStaff, async (req, res, next) => {
  try {
    let xmlText = '';
    if (typeof req.body === 'object' && req.body && req.body.xml) {
      xmlText = req.body.xml;
    } else if (typeof req.body === 'string') {
      xmlText = req.body;
    } else if (Buffer.isBuffer(req.body)) {
      xmlText = req.body.toString('utf-8');
    }
    const { alert, created } = await alerts.importCap(xmlText, req.staff.name);
    res.json({ created, ...formatters.alertOut(alert) });
  } catch (err) {
    next(err);
  }
});

// 12. End alert
router.post('/alerts/:id/end', controlStaff, async (req, res, next) => {
  try {
    const alert = await Alert.findOne({ id: parseInt(req.params.id, 10) });
    if (!alert) {
      return res.status(404).json({ detail: 'Alert not found' });
    }
    alert.active = false;
    await alert.save();
    res.json(formatters.alertOut(alert));
  } catch (err) {
    next(err);
  }
});

// 13. Vulnerable citizens
router.get('/citizens/vulnerable', currentStaff, async (req, res, next) => {
  try {
    if (!req.staff.isControl && !['rescue', 'health', 'transport'].includes(req.staff.department)) {
      return res.status(403).json({
        detail: 'Only control room, rescue, health and transport can see this list',
      });
    }

    let lat = req.query.lat !== undefined ? parseFloat(req.query.lat) : null;
    let lon = req.query.lon !== undefined ? parseFloat(req.query.lon) : null;
    let radiusKm = req.query.radius_km !== undefined ? parseFloat(req.query.radius_km) : null;

    if (req.query.alert_id) {
      const alert = await Alert.findOne({ id: parseInt(req.query.alert_id, 10) });
      if (!alert) {
        return res.status(404).json({ detail: 'Alert not found' });
      }
      lat = alert.center_lat;
      lon = alert.center_lon;
      radiusKm = alert.radius_km;
    }

    const people = await alerts.vulnerableInArea(lat, lon, radiusKm);
    const needs = {};
    let peopleCount = 0;

    for (const c of people) {
      peopleCount += c.household_size || 1;
      for (const n of c.needs || []) {
        needs[n] = (needs[n] || 0) + 1;
      }
    }

    res.json({
      count: people.length,
      people_in_households: peopleCount,
      by_need: needs,
      people: people.map(formatters.citizenOut),
    });
  } catch (err) {
    next(err);
  }
});

// 14. All shelters
router.get('/shelters/all', currentStaff, (req, res) => {
  res.json(alerts.allShelters());
});

module.exports = router;
