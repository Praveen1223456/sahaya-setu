const env = require('../config/env');
const OutboxMessage = require('../models/OutboxMessage');
const { getNextSequence } = require('../models/Counter');
const { DEPARTMENTS } = require('../config/rules');

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) {
    return digits.slice(-10);
  }
  return digits || null;
}

function _hhmmToUtc(hhmm, now) {
  const hh = parseInt(hhmm.slice(0, 2), 10);
  const mm = parseInt(hhmm.slice(2), 10);
  if (hh > 23 || mm > 59) return null;

  // IST offset is +5.5 hours (+330 minutes)
  const base = now ? new Date(now) : new Date();
  const utcMs = base.getTime() + base.getTimezoneOffset() * 60000;
  const istDate = new Date(utcMs + 330 * 60000);

  const capturedIst = new Date(istDate);
  capturedIst.setHours(hh, mm, 0, 0);

  if (capturedIst.getTime() > istDate.getTime() + 5 * 60000) {
    // Yesterday
    capturedIst.setDate(capturedIst.getDate() - 1);
  }

  // Convert back from IST to UTC
  return new Date(capturedIst.getTime() - 330 * 60000);
}

function parseCoded(body) {
  const text = (body || '').trim();
  const parts = text.split('|').map((p) => p.trim());
  if (parts.length < 2) return null;
  const tag = parts[0].toUpperCase();
  if (tag !== 'SS' && tag !== 'SOS') return null;

  const out = {
    is_sos: tag === 'SOS',
    people_count: tag === 'SOS' ? 1 : 0,
  };

  const code = parts[1].toUpperCase();
  if (out.is_sos) {
    out.sos_type = code;
  } else {
    const [category, subtype] = code.split('-');
    out.category = category;
    out.subtype = subtype || null;
  }

  for (let i = 2; i < parts.length; i++) {
    const p = parts[i].toUpperCase();
    if (p.startsWith('SEV') && /^\d+$/.test(p.slice(3))) {
      out.severity = Math.max(1, Math.min(5, parseInt(p.slice(3), 10)));
    } else if (p.startsWith('PPL') && /^\d+$/.test(p.slice(3))) {
      out.people_count = parseInt(p.slice(3), 10);
    } else if (p.startsWith('ACC') && /^\d+(\.\d+)?$/.test(p.slice(3))) {
      out.gps_accuracy_m = parseFloat(p.slice(3));
    } else if (p.startsWith('BAT') && /^\d+$/.test(p.slice(3))) {
      out.battery_pct = parseInt(p.slice(3), 10);
    } else if (p.startsWith('ID') && p.length > 2) {
      out.client_report_id = p.slice(2);
    } else if (p.startsWith('PH') && /^\+?\d+$/.test(p.slice(2))) {
      out.phone = p.slice(2).replace(/^\+/, '');
    } else if (p.includes(',')) {
      const [latStr, lonStr] = p.split(',');
      const lat = parseFloat(latStr);
      const lon = parseFloat(lonStr);
      if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        out.lat = lat;
        out.lon = lon;
      }
    } else if (/^\d{4}$/.test(p)) {
      out.captured_at_dt = _hhmmToUtc(p);
    } else if (/^\d{9,12}$/.test(p)) {
      out.captured_at_dt = new Date(parseInt(p, 10) * 1000);
    }
  }

  return out;
}

function encodeCoded({
  category,
  lat,
  lon,
  report_id,
  severity = 3,
  people = 0,
  accuracy_m = null,
  hhmm = null,
  sos = false,
  battery_pct = null,
  phone = null,
}) {
  const parts = [sos ? 'SOS' : 'SS', category.toUpperCase()];
  if (!sos) parts.push(`SEV${severity}`);
  parts.push(`PPL${people}`);
  parts.push(`${Number(lat).toFixed(6)},${Number(lon).toFixed(6)}`);
  if (accuracy_m !== null && accuracy_m !== undefined) parts.push(`ACC${Math.round(accuracy_m)}`);
  if (battery_pct !== null && battery_pct !== undefined) parts.push(`BAT${battery_pct}`);
  if (hhmm) parts.push(hhmm);
  parts.push(`ID${report_id.toUpperCase()}`);
  if (phone) parts.push(`PH${phone}`);
  return parts.join('|');
}

function parseConfirmation(body) {
  const text = (body || '').trim();
  const m = text.match(/SS-?0*(\d+)/i);
  if (!m) return null;
  const ticketId = parseInt(m[1], 10);
  const rest = text.slice(m.index + m[0].length).replace(/^[\s:\-.,]+/, '').toLowerCase();
  if (rest.startsWith('1') || rest.startsWith('yes') || rest.startsWith('అవును')) {
    return [ticketId, true];
  }
  if (rest.startsWith('2') || rest.startsWith('no') || rest.startsWith('కాదు') || rest.startsWith('లేదు')) {
    return [ticketId, false];
  }
  return null;
}

const TEMPLATES = {
  received: "Sahaya Setu {code}: Report received ({dept}). Updates will come by SMS. / మీ ఫిర్యాదు అందింది.",
  merged: "Sahaya Setu {code}: {n} people reported this same problem. Your report is added. / ఇదే సమస్యపై మీ ఫిర్యాదు జోడించబడింది.",
  review: "Sahaya Setu {code}: Report received and being verified. / మీ ఫిర్యాదు పరిశీలనలో ఉంది.",
  sos: "Sahaya Setu {code}: SOS received. Help is being arranged. Stay safe; call 112 if you can. / మీ SOS అందింది. సహాయం ఏర్పాటు చేస్తున్నాం.",
  ask_location: "Sahaya Setu {code}: We could not find your location. Reply with your village name. / మీ గ్రామం పేరు పంపండి.",
  assigned: "Sahaya Setu {code}: Assigned to {dept}. / సంబంధిత శాఖకు అప్పగించబడింది.",
  in_progress: "Sahaya Setu {code}: Team is on the way. / బృందం బయలుదేరింది.",
  resolved: "Sahaya Setu {code}: Marked as fixed. Is it fixed? Reply '{code} 1' for YES or '{code} 2' for NO. / సమస్య పరిష్కారమైతే 1, కాకపోతే 2 పంపండి.",
  closed: "Sahaya Setu {code}: Closed. Thank you. / ఫిర్యాదు మూసివేయబడింది. ధన్యవాదాలు.",
  escalated: "Sahaya Setu {code}: Sent to a senior officer for action. / ఉన్నతాధికారికి పంపబడింది.",
  rejected: "Sahaya Setu {code}: Closed after verification. For emergencies call 112.",
  merged_by_official: "Sahaya Setu {old}: Combined with ticket {code}. Updates will come for {code}.",
};

function render(key, incident, extra = {}) {
  const tmpl = TEMPLATES[key] || '';
  const vars = {
    code: incident.ticket_code,
    dept: DEPARTMENTS[incident.department] || incident.department,
    n: incident.report_count,
    ...extra,
  };
  return tmpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''));
}

async function send(toPhone, body, incidentId = null) {
  if (!toPhone) return null;
  const norm = normalizePhone(toPhone);
  if (!norm) return null;

  const id = await getNextSequence('outbox');
  const msg = new OutboxMessage({
    id,
    to_phone: norm,
    body,
    incident_id: incidentId,
    delivered: false,
    created_at: new Date(),
  });
  await msg.save();

  if (env.SMS_SENDER === 'http' && env.SMS_GATEWAY_URL) {
    try {
      const res = await fetch(env.SMS_GATEWAY_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: norm, message: body }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        msg.delivered = true;
        await msg.save();
      }
    } catch (err) {
      console.warn(`SMS gateway failed for ${norm}: ${err.message}`);
    }
  }
  return msg;
}

async function notifyReporters(incident, body) {
  const Report = require('../models/Report');
  const reports = await Report.find({ incident_id: incident.id });
  const phones = [...new Set(reports.map((r) => r.phone).filter(Boolean))].sort();
  for (const phone of phones) {
    await send(phone, body, incident.id);
  }
}

module.exports = {
  normalizePhone,
  parseCoded,
  encodeCoded,
  parseConfirmation,
  TEMPLATES,
  render,
  send,
  notifyReporters,
};
