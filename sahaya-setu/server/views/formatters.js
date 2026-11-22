const rules = require('../config/rules');
const alertsMod = require('../services/alerts');

function iso(dt) {
  if (!dt) return null;
  const d = new Date(dt);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function maskPhone(phone) {
  if (!phone) return null;
  const p = String(phone);
  return '*'.repeat(Math.max(p.length - 4, 0)) + p.slice(-4);
}

function hideNumbers(text) {
  if (!text) return text;
  return String(text).replace(/\d{6,}/g, (m) => maskPhone(m));
}

function uploadUrl(filePath) {
  if (!filePath) return null;
  const str = String(filePath).trim();
  if (!str) return null;

  // 1. Preserve Cloudinary / full external URLs
  if (/^https?:\/\//i.test(str)) {
    return str;
  }

  // 2. Preserve Data/Blob URIs
  if (str.startsWith('data:') || str.startsWith('blob:')) {
    return str;
  }

  // 3. Clean leading slashes and protocol-relative '//'
  let clean = str.replace(/^\/+/, '');

  // 4. Clean repeated uploads/ prefixes and embedded multiple slashes
  while (clean.startsWith('uploads/') || clean.startsWith('/')) {
    clean = clean.replace(/^(uploads\/+|\/+)/, '');
  }

  // 5. If it's a bare filename like 14734.png or pole_before.jpg
  if (!clean.includes('/')) {
    const isResolution = clean.includes('after') || clean.includes('resol');
    clean = `${isResolution ? 'resolutions' : 'reports'}/${clean}`;
  }

  return `/uploads/${clean}`;
}

function reportOut(r) {
  return {
    id: r.id,
    client_report_id: r.client_report_id,
    channel: r.channel,
    phone: r.phone,
    relayed_by: r.relayed_by,
    lat: r.lat,
    lon: r.lon,
    gps_accuracy_m: r.gps_accuracy_m,
    location_source: r.location_source,
    address: r.address,
    category: r.category,
    subtype: r.subtype,
    severity: r.severity,
    people_count: r.people_count,
    description: r.description,
    battery_pct: r.battery_pct,
    is_mocked: r.is_mocked,
    integrity: r.integrity,
    photo_url: uploadUrl(r.photo_path),
    dedup_decision: r.dedup_decision,
    dedup_detail: r.dedup_detail,
    input_method: r.input_method || 'MANUAL',
    inputMethod: r.input_method || 'MANUAL',
    voice_metadata: r.voice_metadata || undefined,
    voice: r.voice_metadata || undefined,
    captured_at: iso(r.captured_at),
    received_at: iso(r.received_at),
  };
}

async function incidentOut(inc, now = new Date(), detail = false) {
  const Report = require('../models/Report');
  const StatusEvent = require('../models/StatusEvent');

  const out = {
    id: inc.id,
    ticket_code: inc.ticket_code,
    ticketCode: inc.ticket_code,
    title: inc.title || null,
    landmark: inc.landmark || null,
    category: inc.category,
    department: inc.department,
    department_name: rules.DEPARTMENTS[inc.department] || inc.department,
    status: inc.status,
    is_sos: inc.is_sos,
    sos_area_id: inc.sos_area_id,
    lat: inc.lat,
    lon: inc.lon,
    gps_accuracy_m: inc.gps_accuracy_m,
    address: inc.address,
    severity: inc.severity,
    vulnerable: inc.vulnerable,
    people_count: inc.people_count,
    report_count: inc.report_count,
    priority: rules.priorityScore(inc, now),
    escalation_level: inc.escalation_level || 0,
    overdue: rules.isOverdue(inc, now),
    needs_review: inc.needs_review,
    review_reason: inc.review_reason,
    possible_duplicate_of: inc.possible_duplicate_of,
    merged_into: inc.merged_into,
    photo_url: uploadUrl(inc.best_photo_path),
    resolution_photo_url: uploadUrl(inc.resolution_photo_path),
    created_at: iso(inc.created_at),
    updated_at: iso(inc.updated_at),
    sla_due_at: iso(inc.sla_due_at),
    resolved_at: iso(inc.resolved_at),
    closed_at: iso(inc.closed_at),
  };

  if (inc.is_sos || detail) {
    const reports = await Report.find({ incident_id: inc.id }).sort({ id: 1 });
    if (inc.is_sos && reports.length > 0) {
      const last = reports[reports.length - 1];
      out.battery_pct = last.battery_pct;
      out.sos_phone = last.phone;
      out.medical_notes = last.description;
    }
    if (detail) {
      out.reports = reports.map(reportOut);
      const events = await StatusEvent.find({ incident_id: inc.id }).sort({ id: 1 });
      out.timeline = events.map((e) => ({
        status: e.status,
        note: e.note,
        actor: e.actor,
        at: iso(e.created_at),
      }));
    }
  }

  return out;
}

async function citizenTicketOut(inc) {
  const StatusEvent = require('../models/StatusEvent');
  const events = await StatusEvent.find({ incident_id: inc.id }).sort({ id: 1 });

  return {
    id: inc.id,
    ticket_code: inc.ticket_code,
    ticketCode: inc.ticket_code,
    title: inc.title || null,
    landmark: inc.landmark || null,
    category: inc.category,
    is_sos: inc.is_sos,
    department_name: rules.DEPARTMENTS[inc.department] || inc.department,
    status: inc.status,
    merged_into: inc.merged_into,
    report_count: inc.report_count,
    address: inc.address,
    created_at: iso(inc.created_at),
    resolved_at: iso(inc.resolved_at),
    resolution_photo_url: uploadUrl(inc.resolution_photo_path),
    waiting_for_confirmation: inc.status === 'resolved',
    timeline: events.map((e) => ({
      status: e.status,
      note: hideNumbers(e.note),
      at: iso(e.created_at),
    })),
  };
}

function resultOut(res, now = new Date()) {
  const inc = res.incident;
  return {
    decision: res.decision,
    detail: res.detail,
    ticket_code: inc.ticket_code,
    ticketCode: inc.ticket_code,
    incident_id: inc.id,
    report_id: res.report.id,
    status: inc.status,
    report_count: inc.report_count,
    priority: rules.priorityScore(inc, now),
  };
}

function alertOut(a, lat = null, lon = null) {
  const now = new Date();
  const out = {
    id: a.id,
    level: a.level,
    hazard: a.hazard,
    title: a.title,
    message: a.message,
    message_te: a.message_te,
    area_name: a.area_name,
    center_lat: a.center_lat,
    center_lon: a.center_lon,
    radius_km: a.radius_km,
    source: a.source,
    created_by: a.created_by,
    created_at: iso(a.created_at),
    expires_at: iso(a.expires_at),
    active: alertsMod.isLive(a, now),
  };
  if (lat !== null && lat !== undefined && lon !== null && lon !== undefined) {
    const shelters = alertsMod.nearestShelters(lat, lon);
    for (const s of shelters) {
      s.direction = alertsMod.bearingLabel(lat, lon, s.lat, s.lon);
    }
    out.nearest_shelters = shelters;
  }
  return out;
}

function citizenOut(c) {
  return {
    id: c.id,
    phone: c.phone,
    name: c.name,
    village: c.village,
    lat: c.lat,
    lon: c.lon,
    household_size: c.household_size,
    needs: c.needs,
    medical_notes: c.medical_notes,
    family_contacts: c.family_contacts,
    consent: c.consent,
    created_at: iso(c.created_at),
    updated_at: iso(c.updated_at),
  };
}

module.exports = {
  iso,
  maskPhone,
  hideNumbers,
  uploadUrl,
  reportOut,
  incidentOut,
  citizenTicketOut,
  resultOut,
  alertOut,
  citizenOut,
};
