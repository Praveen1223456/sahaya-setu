const express = require('express');
const router = express.Router();

const env = require('../config/env');
const rules = require('../config/rules');
const geo = require('../services/geo');
const ai = require('../services/ai');
const sms = require('../services/sms');
const alerts = require('../services/alerts');
const services = require('../services/services');
const formatters = require('../views/formatters');
const { upload } = require('../middleware/upload');
const Incident = require('../models/Incident');
const Report = require('../models/Report');

// Helper to get incident by integer ID or throw 404
async function getIncidentOr404(id) {
  const inc = await Incident.findOne({ id: parseInt(id, 10) });
  if (!inc) {
    const err = new Error(`Ticket ${id} not found`);
    err.status = 404;
    throw err;
  }
  return inc;
}

// 1. Settings cached by app
router.get('/app/config', (req, res) => {
  const categories = {};
  for (const [k, v] of Object.entries(rules.CATEGORIES)) {
    categories[k] = { department: v[0], severity: v[1] };
  }
  res.json({
    version: '0.2.0',
    signing_secret: env.APP_SIGNING_SECRET,
    sms_number: env.SMS_INBOUND_NUMBER,
    categories,
    sos_types: Object.keys(rules.SOS_TYPES),
    departments: rules.DEPARTMENTS,
    ai_photo_check: ai.enabled(),
  });
});

// 2. Offline places list
router.get('/geo/places', (req, res) => {
  const list = geo.getPlaces().map((p) => ({
    name: p.name,
    name_te: p.name_te || null,
    district: p.district,
    lat: p.lat,
    lon: p.lon,
  }));
  res.json(list);
});

// 3. Reverse geocode
router.get('/geo/reverse', async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ detail: 'lat and lon are required numbers' });
    }
    const address = await geo.reverseGeocode(lat, lon);
    res.json({ address });
  } catch (err) {
    next(err);
  }
});

// 4. Classify photo
router.post('/ai/classify-photo', upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ detail: 'Empty photo' });
    }
    const suggestion = await ai.classifyPhoto(req.file.buffer);
    res.json({ suggestion, ai_enabled: ai.enabled() });
  } catch (err) {
    next(err);
  }
});

// 5. Submit report with photo
router.post('/reports', upload.single('photo'), async (req, res, next) => {
  try {
    let meta = {};
    if (req.body.meta) {
      try {
        meta = typeof req.body.meta === 'string' ? JSON.parse(req.body.meta) : req.body.meta;
      } catch (e) {
        return res.status(422).json({ detail: 'Invalid JSON in meta field' });
      }
    }
    const photoBuffer = req.file ? req.file.buffer : null;
    const result = await services.submitReport(meta, photoBuffer, {
      channel: meta.channel || 'app',
      isSos: false,
    });
    res.json(formatters.resultOut(result));
  } catch (err) {
    next(err);
  }
});

// 6. SOS
router.post('/sos', async (req, res, next) => {
  try {
    const body = req.body || {};
    const channel = body.relayed_by ? 'mesh' : 'app';
    const result = await services.submitReport(body, null, {
      channel,
      isSos: true,
    });
    res.json(formatters.resultOut(result));
  } catch (err) {
    next(err);
  }
});

// 7. SOS update
router.post('/sos/update', async (req, res, next) => {
  try {
    const { client_report_id, lat, lon, gps_accuracy_m, battery_pct } = req.body || {};
    if (!client_report_id) {
      return res.status(400).json({ detail: 'client_report_id is required' });
    }
    const inc = await services.sosUpdate(
      client_report_id,
      lat !== undefined ? parseFloat(lat) : null,
      lon !== undefined ? parseFloat(lon) : null,
      gps_accuracy_m !== undefined ? parseFloat(gps_accuracy_m) : null,
      battery_pct !== undefined ? parseInt(battery_pct, 10) : null
    );
    res.json({
      ticket_code: inc.ticket_code,
      status: inc.status,
      acknowledged: !['received', 'review'].includes(inc.status),
    });
  } catch (err) {
    next(err);
  }
});

// Helper for text handling (SMS, Voice)
async function handleText(phone, text, channel, location = null) {
  const normPhone = sms.normalizePhone(phone);
  const trimmed = (text || '').trim();

  // 1. Confirmation reply: "SS-0012 1"
  const reply = sms.parseConfirmation(trimmed);
  if (reply && !trimmed.toUpperCase().startsWith('SS|') && !trimmed.toUpperCase().startsWith('SOS|')) {
    const [ticketId, fixed] = reply;
    const inc = await Incident.findOne({ id: ticketId });
    if (!inc) {
      await sms.send(normPhone, `Sahaya Setu: ticket SS-${String(ticketId).padStart(4, '0')} not found.`);
      return { type: 'confirmation', ok: false, detail: 'ticket not found' };
    }
    try {
      await services.citizenConfirm(inc, fixed, normPhone);
    } catch (exc) {
      await sms.send(normPhone, `Sahaya Setu ${inc.ticket_code}: ${exc.message}`, inc.id);
      return { type: 'confirmation', ok: false, detail: exc.message };
    }
    return {
      type: 'confirmation',
      ok: true,
      ticket_code: inc.ticket_code,
      status: inc.status,
    };
  }

  // 2. Coded report
  const coded = sms.parseCoded(trimmed);
  if (coded) {
    coded.phone = coded.phone || normPhone;
    const res = await services.submitReport(coded, null, {
      channel,
      isSos: coded.is_sos,
    });
    return { type: 'coded_report', ...formatters.resultOut(res) };
  }

  // 3. Reply with village name
  if (normPhone) {
    const pending = await Report.findOne({
      phone: normPhone,
      location_source: 'none',
    }).sort({ id: -1 });

    const place = geo.findPlaceInText(trimmed);
    if (pending && place) {
      const inc = await Incident.findOne({ id: pending.incident_id });
      if (inc && inc.status === 'review') {
        pending.lat = inc.lat = place.lat;
        pending.lon = inc.lon = place.lon;
        pending.gps_accuracy_m = inc.gps_accuracy_m = env.TEXT_PLACE_ACCURACY_M;
        pending.location_source = 'text';
        pending.address = inc.address = `Approximate: ${place.name}, ${place.district} district`;
        inc.needs_review = false;
        inc.review_reason = null;
        inc.status = 'received';
        await pending.save();
        await inc.save();

        await services.logEvent(inc, 'received', `Citizen sent village name: ${place.name}`);
        await sms.send(normPhone, sms.render('received', inc), inc.id);
        return {
          type: 'location_update',
          ticket_code: inc.ticket_code,
          place: place.name,
        };
      }
    }
  }

  // 4. Plain text report
  const reportMeta = {
    phone: normPhone,
    description: trimmed,
    ...(location || {}),
  };
  const res = await services.submitReport(reportMeta, null, { channel });
  return { type: 'text_report', ...formatters.resultOut(res) };
}

// 8. SMS Inbound Webhook
router.post('/sms/inbound', async (req, res, next) => {
  try {
    const data = req.body || {};
    const phone = ['from', 'phone', 'sender', 'number'].reduce(
      (val, k) => val || (data[k] ? String(data[k]) : null),
      null
    );
    const text = ['message', 'body', 'text', 'content'].reduce(
      (val, k) => val || (data[k] ? String(data[k]) : ''),
      ''
    );
    if (!text.trim()) {
      return res.status(400).json({ detail: 'Empty message' });
    }
    const result = await handleText(phone, text.trim(), 'sms');
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 9. Mesh relay batch
router.post('/mesh/relay', async (req, res, next) => {
  try {
    const { relayed_by, messages } = req.body || {};
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ detail: 'messages array required' });
    }
    const results = [];
    for (const msg of messages) {
      const coded = sms.parseCoded(msg);
      if (!coded) {
        results.push({
          message: String(msg).slice(0, 40),
          ok: false,
          detail: 'Not a Sahaya Setu coded message',
        });
        continue;
      }
      coded.relayed_by = relayed_by;
      const r = await services.submitReport(coded, null, {
        channel: 'mesh',
        isSos: coded.is_sos,
      });
      results.push({ ok: true, ...formatters.resultOut(r) });
    }
    res.json({ processed: results.length, results });
  } catch (err) {
    next(err);
  }
});

// 10. Voice transcript
router.post('/voice/transcript', async (req, res, next) => {
  try {
    const { phone, text, lat, lon, gps_accuracy_m } = req.body || {};
    if (!text || !text.trim()) {
      return res.status(400).json({ detail: 'Text is required' });
    }
    let location = null;
    if (lat !== undefined && lat !== null && lon !== undefined && lon !== null) {
      location = {
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        gps_accuracy_m: gps_accuracy_m !== undefined ? parseFloat(gps_accuracy_m) : null,
      };
    }
    const result = await handleText(phone, text.trim(), 'voice', location);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 11. Track ticket
router.get('/track/:code', async (req, res, next) => {
  try {
    const code = req.params.code;
    const m = code.match(/^\s*(?:SS-?)?0*(\d+)\s*$/i);
    if (!m) {
      return res.status(400).json({ detail: 'Use a ticket code like SS-0012' });
    }
    const inc = await getIncidentOr404(m[1]);
    const out = await formatters.citizenTicketOut(inc);
    res.json(out);
  } catch (err) {
    next(err);
  }
});

// 12. Citizen confirm
router.post('/incidents/:incident_id/confirm', async (req, res, next) => {
  try {
    const inc = await getIncidentOr404(req.params.incident_id);
    const { fixed, phone } = req.body || {};
    if (typeof fixed !== 'boolean') {
      return res.status(400).json({ detail: 'fixed boolean is required' });
    }
    const updated = await services.citizenConfirm(inc, fixed, phone);
    res.json(await formatters.citizenTicketOut(updated));
  } catch (err) {
    next(err);
  }
});

// 13. Citizens pre-register
router.post('/citizens/register', async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!body.consent) {
      return res.status(400).json({ detail: 'Consent is needed to share these details with officials' });
    }
    const c = await services.registerCitizen(body);
    res.json({
      ok: true,
      id: c.id,
      village: c.village,
      located: c.lat !== null && c.lat !== undefined,
    });
  } catch (err) {
    next(err);
  }
});

// 14. Active alerts
router.get('/alerts/active', async (req, res, next) => {
  try {
    const lat = req.query.lat !== undefined ? parseFloat(req.query.lat) : null;
    const lon = req.query.lon !== undefined ? parseFloat(req.query.lon) : null;
    const list = await alerts.activeAlerts(lat, lon);
    res.json(list.map((a) => formatters.alertOut(a, lat, lon)));
  } catch (err) {
    next(err);
  }
});

// 15. Shelters
router.get('/shelters', (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 3;
  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ detail: 'lat and lon are required numbers' });
  }
  const result = alerts.nearestShelters(lat, lon, Math.min(Math.max(limit, 1), 20));
  res.json(result);
});

module.exports = router;
