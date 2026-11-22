const env = require('../config/env');
const rules = require('../config/rules');
const geo = require('./geo');
const imaging = require('./imaging');
const sms = require('./sms');
const dedup = require('./dedup');

const Incident = require('../models/Incident');
const Report = require('../models/Report');
const StatusEvent = require('../models/StatusEvent');
const Citizen = require('../models/Citizen');
const { getNextSequence } = require('../models/Counter');

class WorkflowError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WorkflowError';
    this.status = 409;
  }
}

class SubmitResult {
  constructor(report, incident, decision, detail) {
    this.report = report;
    this.incident = incident;
    this.decision = decision;
    this.detail = detail;
  }
}

function parseTime(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

async function logEvent(incident, status, note, actor = 'system') {
  const id = await getNextSequence('status_events');
  const ev = new StatusEvent({
    id,
    incident_id: incident.id,
    status,
    note: (note || '').slice(0, 500),
    actor: (actor || 'system').slice(0, 40),
    created_at: new Date(),
  });
  await ev.save();
  return ev;
}

function refreshPriority(incident) {
  incident.priority = rules.priorityScore(incident, new Date());
}

async function attachPhoto(report, photoBuffer, meta = {}) {
  await imaging.validateAndInspect(photoBuffer);
  report.photo_sha256 = imaging.sha256Hex(photoBuffer);
  report.photo_path = await imaging.saveImage(photoBuffer, 'reports');
  report.phash = await imaging.phashHex(photoBuffer);
  report.sharpness = await imaging.sharpness(photoBuffer);
  report.embedding = imaging.embedding(photoBuffer);

  const signature = meta.signature;
  const captured = meta.captured_at;
  if (signature && report.lat !== null && report.lat !== undefined && captured) {
    const ok = imaging.verifySignature(
      report.photo_sha256,
      report.lat,
      report.lon,
      String(captured),
      signature
    );
    report.integrity = ok ? 'verified' : 'failed';
  }
}

function maybeBestPhoto(incident, report) {
  if (
    report.photo_path &&
    (incident.best_photo_sharpness === null ||
      incident.best_photo_sharpness === undefined ||
      (report.sharpness || 0) >= incident.best_photo_sharpness)
  ) {
    incident.best_photo_path = report.photo_path;
    incident.best_photo_sharpness = report.sharpness;
  }
}

async function submitReport(
  meta = {},
  photoBuffer = null,
  { channel = 'app', isSos = false } = {}
) {
  const now = new Date();
  const cid = (meta.client_report_id || '').trim().toUpperCase() || null;

  // 1. Same report already arrived through another channel? Count once.
  if (cid) {
    const existing = await Report.findOne({ client_report_id: cid });
    if (existing) {
      const inc = await Incident.findOne({ id: existing.incident_id });
      if (photoBuffer && !existing.photo_path) {
        await attachPhoto(existing, photoBuffer, meta);
        await existing.save();
        if (inc) {
          maybeBestPhoto(inc, existing);
          await inc.save();
          await logEvent(inc, inc.status, `Photo for report #${existing.id} arrived later via ${channel}`);
        }
        return new SubmitResult(existing, inc, 'photo_attached', 'Photo added to the earlier SMS/mesh report');
      }
      return new SubmitResult(existing, inc, 'duplicate_submission', 'This report was already received');
    }
  }

  // 2. Classify problem
  const text = meta.description || '';
  const found = rules.classifyText(text);

  let category;
  let subtypeFromCode = '';
  let department;
  let severity;
  let people;

  if (isSos) {
    category = (meta.sos_type || 'OTHER').toUpperCase();
    if (!rules.SOS_TYPES[category]) category = 'OTHER';
    department = rules.SOS_TYPES[category];
    severity = 5;
    people = Math.max(parseInt(meta.people_count || 1, 10), 1);
  } else {
    const raw = (meta.category || '').toUpperCase();
    const [rawCat, rawSub] = raw.split('-');
    if (rules.CATEGORIES[rawCat]) {
      category = rawCat;
      subtypeFromCode = rawSub || '';
    } else {
      category = found.category;
      subtypeFromCode = '';
    }
    const [dept, baseSev] = rules.CATEGORIES[category];
    department = dept;
    severity = Math.min(5, parseInt(meta.severity || baseSev, 10) + found.severity_boost);
    people = parseInt(meta.people_count || 0, 10);
  }

  const reportId = await getNextSequence('reports');
  const report = new Report({
    id: reportId,
    client_report_id: cid,
    channel,
    phone: sms.normalizePhone(meta.phone),
    relayed_by: sms.normalizePhone(meta.relayed_by),
    lat: meta.lat !== undefined && meta.lat !== null ? parseFloat(meta.lat) : null,
    lon: meta.lon !== undefined && meta.lon !== null ? parseFloat(meta.lon) : null,
    gps_accuracy_m: meta.gps_accuracy_m !== undefined && meta.gps_accuracy_m !== null ? parseFloat(meta.gps_accuracy_m) : null,
    captured_at: parseTime(meta.captured_at_dt || meta.captured_at),
    received_at: now,
    address: meta.address || null,
    category,
    subtype: meta.subtype || (isSos ? null : subtypeFromCode) || null,
    severity,
    people_count: people,
    description: text || meta.medical_notes || null,
    battery_pct: meta.battery_pct !== undefined && meta.battery_pct !== null ? parseInt(meta.battery_pct, 10) : null,
    is_sos: isSos,
    is_mocked: Boolean(meta.is_mocked),
    input_method: meta.inputMethod || meta.input_method || 'MANUAL',
    voice_metadata: meta.voiceMetadata || meta.voice_metadata || undefined,
  });

  // 3. Location: GPS first, else village name found in text
  if (report.lat === null || report.lon === null) {
    report.lat = report.lon = null;
    const place = geo.findPlaceInText(text);
    if (place) {
      report.lat = place.lat;
      report.lon = place.lon;
      report.gps_accuracy_m = env.TEXT_PLACE_ACCURACY_M;
      report.location_source = 'text';
      report.address = report.address || `Approximate: ${place.name}, ${place.district} district`;
    } else {
      report.location_source = 'none';
    }
  }

  if (report.lat !== null && !report.address) {
    report.address = await geo.reverseGeocode(report.lat, report.lon);
  }

  // 4. Photo fingerprints & tamper check
  if (photoBuffer) {
    await attachPhoto(report, photoBuffer, meta);
  }

  // 5. Decide action: new, merge, review, suspicious, sos_area
  let decision = await dedup.decide(report);
  const problems = [];
  if (report.is_mocked) {
    problems.append ? problems.append('Fake GPS app detected on the phone') : problems.push('Fake GPS app detected on the phone');
  }
  if (report.integrity === 'failed') {
    problems.push('Photo or location was changed after capture');
  }
  if (env.REQUIRE_SIGNATURE && photoBuffer && report.integrity !== 'verified') {
    problems.push('Photo is not signed by the app');
  }
  if (problems.length > 0 && decision.action !== 'suspicious') {
    const linked = ['merge', 'review'].includes(decision.action) ? decision.incident_id : null;
    decision = new dedup.Decision('suspicious', linked, problems.join('; '));
  }

  report.dedup_decision = decision.action;
  report.dedup_detail = (decision.reason || '').slice(0, 300);

  let inc;
  if (decision.action === 'merge') {
    inc = await Incident.findOne({ id: decision.incident_id });
    if (!inc) {
      throw new WorkflowError(`Incident ${decision.incident_id} not found to merge`);
    }
    report.incident_id = inc.id;
    await report.save();

    inc.report_count += 1;
    inc.people_count = Math.max(inc.people_count, report.people_count);
    inc.severity = Math.max(inc.severity, report.severity);
    inc.vulnerable = inc.vulnerable || found.vulnerable;

    if (
      report.gps_accuracy_m !== null &&
      (inc.gps_accuracy_m === null || report.gps_accuracy_m < inc.gps_accuracy_m)
    ) {
      inc.lat = report.lat;
      inc.lon = report.lon;
      inc.gps_accuracy_m = report.gps_accuracy_m;
    }
    maybeBestPhoto(inc, report);
    refreshPriority(inc);
    await inc.save();

    await logEvent(
      inc,
      inc.status,
      `Duplicate merged via ${channel} (${decision.reason}); ${inc.report_count} reports`
    );
    await sms.send(report.phone, sms.render('merged', inc), inc.id);
  } else {
    const flagged =
      ['review', 'suspicious'].includes(decision.action) ||
      (report.location_source === 'none' && !isSos);

    const incidentId = await getNextSequence('incidents');
    inc = new Incident({
      id: incidentId,
      title: meta.title || meta.voiceMetadata?.title || meta.voice_metadata?.title || null,
      description: text || null,
      landmark: meta.landmark || meta.voiceMetadata?.landmark || meta.voice_metadata?.landmark || null,
      citizen_phone: report.phone || null,
      category,
      department,
      status: flagged ? 'review' : 'received',
      lat: report.lat,
      lon: report.lon,
      gps_accuracy_m: report.gps_accuracy_m,
      address: report.address,
      is_sos: isSos,
      severity,
      vulnerable: found.vulnerable || Boolean(meta.medical_notes),
      people_count: people,
      report_count: 1,
      created_at: now,
      sla_due_at: rules.slaDue(category, isSos, now),
    });

    if (['review', 'suspicious'].includes(decision.action)) {
      inc.needs_review = true;
      inc.review_reason = (decision.reason || '').slice(0, 300);
      inc.possible_duplicate_of = decision.incident_id;
    } else if (report.location_source === 'none') {
      inc.needs_review = true;
      inc.review_reason = 'No location. Call back or wait for the village name.';
    }

    if (decision.action === 'sos_area') {
      inc.sos_area_id = decision.incident_id;
    } else if (isSos && inc.sos_area_id === null) {
      inc.sos_area_id = inc.id;
    }

    report.incident_id = inc.id;
    maybeBestPhoto(inc, report);
    refreshPriority(inc);

    await inc.save();
    await report.save();

    await logEvent(inc, inc.status, `Report received via ${channel}. ${decision.reason}`);

    let key;
    if (isSos) {
      key = 'sos';
    } else if (report.location_source === 'none') {
      key = 'ask_location';
    } else if (flagged) {
      key = 'review';
    } else {
      key = 'received';
    }

    await sms.send(report.phone, sms.render(key, inc), inc.id);
  }

  return new SubmitResult(report, inc, decision.action, decision.reason);
}

const TRANSITIONS = {
  review: new Set(['received', 'assigned', 'rejected']),
  received: new Set(['assigned', 'in_progress', 'resolved', 'rejected']),
  assigned: new Set(['in_progress', 'resolved', 'received']),
  in_progress: new Set(['resolved', 'assigned']),
  escalated: new Set(['assigned', 'in_progress', 'resolved']),
  resolved: new Set(['closed', 'escalated']),
};

async function changeStatus(
  incident,
  newStatus,
  { actor = 'official', note = null, proofPhoto = null } = {}
) {
  const allowed = TRANSITIONS[incident.status] || new Set();
  if (!allowed.has(newStatus)) {
    const list = [...allowed].sort().join(', ') || 'none (ticket is finished)';
    throw new WorkflowError(
      `Cannot move ${incident.ticket_code} from '${incident.status}' to '${newStatus}'. Allowed: ${list}`
    );
  }

  const now = new Date();
  if (newStatus === 'resolved') {
    incident.resolved_at = now;
    if (proofPhoto) {
      incident.resolution_photo_path = await imaging.saveImage(proofPhoto, 'resolutions');
    }
  }
  if (['received', 'assigned'].includes(newStatus)) {
    incident.needs_review = false;
  }
  if (['rejected', 'closed'].includes(newStatus)) {
    incident.closed_at = now;
  }
  if (newStatus === 'escalated') {
    incident.escalation_level = (incident.escalation_level || 0) + 1;
  }

  incident.status = newStatus;
  incident.updated_at = now;
  refreshPriority(incident);
  await incident.save();

  await logEvent(incident, newStatus, note || `Status changed to ${newStatus}`, actor);
  await sms.notifyReporters(incident, sms.render(newStatus, incident));
  return incident;
}

async function citizenConfirm(incident, fixed, phone = null) {
  if (incident.status !== 'resolved') {
    throw new WorkflowError(`${incident.ticket_code} is '${incident.status}', not waiting for confirmation`);
  }
  const normPhone = sms.normalizePhone(phone);
  if (normPhone) {
    const reports = await Report.find({ incident_id: incident.id });
    const reporterPhones = new Set(reports.map((r) => r.phone).filter(Boolean));
    if (!reporterPhones.has(normPhone)) {
      throw new WorkflowError('Only people who reported this problem can confirm it');
    }
  }

  const now = new Date();
  if (fixed) {
    incident.status = 'closed';
    incident.closed_at = now;
    await logEvent(incident, 'closed', `Citizen ${normPhone || ''} confirmed the fix`.trim(), 'citizen');
    await sms.notifyReporters(incident, sms.render('closed', incident));
  } else {
    incident.status = 'escalated';
    incident.escalation_level = (incident.escalation_level || 0) + 1;
    incident.resolved_at = null;
    const addHours = Math.max(1, rules.slaHours(incident.category, incident.is_sos) / 2);
    incident.sla_due_at = new Date(now.getTime() + addHours * 3600000);
    await logEvent(
      incident,
      'escalated',
      `Citizen ${normPhone || ''} said NOT fixed; escalation level ${incident.escalation_level}`,
      'citizen'
    );
    await sms.notifyReporters(incident, sms.render('escalated', incident));
  }
  incident.updated_at = now;
  refreshPriority(incident);
  await incident.save();
  return incident;
}

async function mergeIncidents(source, target, actor = 'official') {
  if (source.id === target.id) {
    throw new WorkflowError('Cannot merge a ticket into itself');
  }
  if (source.is_sos || target.is_sos) {
    throw new WorkflowError('SOS tickets are never merged; each person is counted separately');
  }
  if (!rules.ACTIVE_STATUSES.includes(source.status) || !rules.ACTIVE_STATUSES.includes(target.status)) {
    throw new WorkflowError('Both tickets must be open to merge');
  }

  const reports = await Report.find({ incident_id: source.id });
  for (const r of reports) {
    r.incident_id = target.id;
    r.dedup_decision = 'merge';
    r.dedup_detail = `Merged by ${actor} from ${source.ticket_code}`;
    await r.save();
  }

  target.report_count += source.report_count;
  target.people_count = Math.max(target.people_count, source.people_count);
  target.severity = Math.max(target.severity, source.severity);
  target.vulnerable = target.vulnerable || source.vulnerable;

  if (
    source.best_photo_sharpness &&
    (target.best_photo_sharpness || 0) < source.best_photo_sharpness
  ) {
    target.best_photo_path = source.best_photo_path;
    target.best_photo_sharpness = source.best_photo_sharpness;
  }

  source.status = 'merged';
  source.merged_into = target.id;
  source.needs_review = false;
  source.closed_at = new Date();
  source.updated_at = new Date();
  await source.save();

  await logEvent(source, 'merged', `Merged into ${target.ticket_code}`, actor);
  await logEvent(target, target.status, `${source.ticket_code} merged in; ${target.report_count} reports`, actor);

  target.updated_at = new Date();
  refreshPriority(target);
  await target.save();

  await sms.notifyReporters(target, sms.render('merged_by_official', target, { old: source.ticket_code }));
  return target;
}

async function runEscalations() {
  const now = new Date();
  const escalated = [];
  const activeIncidents = await Incident.find({ status: { $in: rules.ACTIVE_STATUSES } });

  for (const inc of activeIncidents) {
    if (rules.isOverdue(inc, now)) {
      inc.escalation_level = (inc.escalation_level || 0) + 1;
      const addHours = Math.max(1, rules.slaHours(inc.category, inc.is_sos) / 2);
      inc.sla_due_at = new Date(now.getTime() + addHours * 3600000);
      inc.updated_at = now;
      refreshPriority(inc);
      await inc.save();
      await logEvent(inc, inc.status, `Deadline missed; escalation level ${inc.escalation_level}`);
      escalated.push(inc.ticket_code);
    }
  }
  return escalated;
}

async function sosUpdate(clientReportId, lat = null, lon = null, accuracy = null, battery = null) {
  const cid = (clientReportId || '').trim().toUpperCase();
  const report = await Report.findOne({ client_report_id: cid });
  if (!report || !report.is_sos) {
    throw new WorkflowError('No SOS found with that ID');
  }

  const inc = await Incident.findOne({ id: report.incident_id });
  if (!inc) {
    throw new WorkflowError('Incident for SOS report not found');
  }

  const parts = [];
  if (lat !== null && lat !== undefined && lon !== null && lon !== undefined) {
    report.lat = lat;
    report.lon = lon;
    report.gps_accuracy_m = accuracy;
    report.location_source = 'gps';
    inc.lat = lat;
    inc.lon = lon;
    inc.gps_accuracy_m = accuracy;
    parts.push(`location ${lat.toFixed(5)},${lon.toFixed(5)}${accuracy !== null ? ` ±${Math.round(accuracy)} m` : ''}`);
  }
  if (battery !== null && battery !== undefined) {
    report.battery_pct = battery;
    parts.push(`battery ${battery}%`);
  }

  await report.save();
  await logEvent(inc, inc.status, `SOS update: ${parts.join(', ') || 'still waiting'}`);
  inc.updated_at = new Date();
  refreshPriority(inc);
  await inc.save();
  return inc;
}

async function registerCitizen(data) {
  const phone = sms.normalizePhone(data.phone);
  if (!phone) {
    throw new WorkflowError('A valid phone number is needed');
  }
  const familyContacts = (data.family_contacts || [])
    .map(sms.normalizePhone)
    .filter(Boolean);

  let citizen = await Citizen.findOne({ phone });
  if (!citizen) {
    const id = await getNextSequence('citizens');
    citizen = new Citizen({ id, phone });
  }

  citizen.name = data.name || null;
  citizen.village = data.village || null;
  citizen.lat = data.lat !== undefined && data.lat !== null ? parseFloat(data.lat) : null;
  citizen.lon = data.lon !== undefined && data.lon !== null ? parseFloat(data.lon) : null;
  citizen.household_size = parseInt(data.household_size || 1, 10);
  citizen.needs = data.needs || [];
  citizen.medical_notes = data.medical_notes || null;
  citizen.family_contacts = familyContacts;
  citizen.consent = Boolean(data.consent);
  citizen.updated_at = new Date();

  if ((citizen.lat === null || citizen.lat === undefined) && citizen.village) {
    const place = geo.findPlaceInText(citizen.village);
    if (place) {
      citizen.lat = place.lat;
      citizen.lon = place.lon;
    }
  }

  await citizen.save();
  return citizen;
}

module.exports = {
  WorkflowError,
  SubmitResult,
  logEvent,
  submitReport,
  changeStatus,
  citizenConfirm,
  mergeIncidents,
  runEscalations,
  sosUpdate,
  registerCitizen,
};
