const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { XMLParser } = require('fast-xml-parser');
const env = require('../config/env');
const geo = require('./geo');
const Alert = require('../models/Alert');
const Citizen = require('../models/Citizen');
const { getNextSequence } = require('../models/Counter');

const CAP_LEVEL = {
  extreme: 'red',
  severe: 'orange',
  moderate: 'yellow',
  minor: 'yellow',
};

class CapError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CapError';
    this.status = 400;
  }
}

function parseCap(xmlText) {
  if (!xmlText || typeof xmlText !== 'string' || xmlText.trim().length === 0) {
    throw new CapError('Empty XML');
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
  });

  let parsed;
  try {
    parsed = parser.parse(xmlText);
  } catch (err) {
    throw new CapError(`Not valid XML: ${err.message}`);
  }

  const root = parsed.alert;
  if (!root) {
    throw new CapError('Not a CAP <alert> message');
  }

  let infos = root.info;
  if (!infos) {
    throw new CapError('CAP message has no <info> block');
  }
  if (!Array.isArray(infos)) {
    infos = [infos];
  }

  const english =
    infos.find((i) => String(i.language || 'en').toLowerCase().startsWith('en')) || infos[0];
  const telugu = infos.find((i) => String(i.language || '').toLowerCase().startsWith('te'));

  function formatMessage(info) {
    if (!info) return '';
    const parts = [info.description, info.instruction].filter(Boolean);
    return parts.join('\n\n') || info.headline || info.event || '';
  }

  const area = english.area || (infos[0] && infos[0].area);
  let lat = null;
  let lon = null;
  let radius = null;

  if (area) {
    if (area.circle) {
      const [pt, rad] = String(area.circle).trim().split(/\s+/);
      const [latStr, lonStr] = pt.split(',');
      lat = parseFloat(latStr);
      lon = parseFloat(lonStr);
      radius = parseFloat(rad);
    } else if (area.polygon) {
      const pts = String(area.polygon)
        .trim()
        .split(/\s+/)
        .map((p) => p.split(',').map(Number));
      if (pts.length > 0) {
        lat = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
        lon = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
        radius =
          Math.max(...pts.map((p) => geo.haversineM(lat, lon, p[0], p[1]))) / 1000;
        radius = Math.round(radius * 10) / 10;
      }
    }
  }

  const sev = String(english.severity || '').toLowerCase();
  const level = CAP_LEVEL[sev] || 'orange';

  let expiresAt = null;
  if (english.expires) {
    const d = new Date(english.expires);
    if (!isNaN(d.getTime())) expiresAt = d;
  }

  return {
    cap_identifier: root.identifier ? String(root.identifier).trim() : null,
    level,
    hazard: english.event || 'Alert',
    title: english.headline || english.event || 'Alert',
    message: formatMessage(english),
    message_te: telugu ? formatMessage(telugu) : null,
    area_name: area && area.areaDesc ? String(area.areaDesc).trim() : null,
    center_lat: lat,
    center_lon: lon,
    radius_km: radius,
    expires_at: expiresAt,
  };
}

async function importCap(xmlText, createdBy) {
  const data = parseCap(xmlText);
  let existing = null;
  if (data.cap_identifier) {
    existing = await Alert.findOne({ cap_identifier: data.cap_identifier });
  }

  if (existing) {
    Object.assign(existing, data);
    await existing.save();
    return { alert: existing, created: false };
  }

  const id = await getNextSequence('alerts');
  const alert = new Alert({
    id,
    source: 'cap',
    created_by: createdBy,
    ...data,
  });
  await alert.save();
  return { alert, created: true };
}

function isLive(alert, now = new Date()) {
  const n = new Date(now);
  return Boolean(alert.active && (!alert.expires_at || new Date(alert.expires_at) > n));
}

function covers(alert, lat, lon) {
  if (alert.center_lat === null || alert.center_lat === undefined || alert.radius_km === null || alert.radius_km === undefined) {
    return true; // whole state
  }
  if (lat === null || lat === undefined || lon === null || lon === undefined) {
    return true; // unknown location: show it
  }
  return geo.haversineM(lat, lon, alert.center_lat, alert.center_lon) <= alert.radius_km * 1000;
}

async function activeAlerts(lat = null, lon = null) {
  const now = new Date();
  const order = { red: 0, orange: 1, yellow: 2 };
  const rows = await Alert.find({ active: true }).sort({ id: -1 });
  const live = rows.filter((a) => isLive(a, now) && covers(a, lat, lon));
  live.sort((a, b) => {
    const oA = order[a.level] !== undefined ? order[a.level] : 3;
    const oB = order[b.level] !== undefined ? order[b.level] : 3;
    if (oA !== oB) return oA - oB;
    return b.id - a.id;
  });
  return live;
}

let cachedShelters = null;

function getShelters() {
  if (cachedShelters) return cachedShelters;
  if (!fs.existsSync(env.SHELTERS_CSV)) {
    cachedShelters = [];
    return cachedShelters;
  }
  const content = fs.readFileSync(env.SHELTERS_CSV, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  cachedShelters = records.map((r) => ({
    name: r.name,
    district: r.district,
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    capacity: parseInt(r.capacity, 10),
  }));
  return cachedShelters;
}

function nearestShelters(lat, lon, limit = 3) {
  const shelters = getShelters();
  const ranked = [...shelters].sort(
    (a, b) => geo.haversineM(lat, lon, a.lat, a.lon) - geo.haversineM(lat, lon, b.lat, b.lon)
  );
  return ranked.slice(0, limit).map((s) => ({
    ...s,
    distance_km: Math.round((geo.haversineM(lat, lon, s.lat, s.lon) / 1000) * 10) / 10,
  }));
}

function allShelters() {
  return [...getShelters()];
}

async function vulnerableInArea(lat = null, lon = null, radiusKm = null) {
  const people = await Citizen.find({ consent: true, 'needs.0': { $exists: true } });
  if (lat === null || lon === null || radiusKm === null) {
    return people;
  }
  return people.filter(
    (c) =>
      c.lat !== null &&
      c.lat !== undefined &&
      geo.haversineM(lat, lon, c.lat, c.lon) <= radiusKm * 1000
  );
}

function bearingLabel(lat1, lon1, lat2, lon2) {
  const angle = ((Math.atan2(lon2 - lon1, lat2 - lat1) * (180 / Math.PI)) + 360) % 360;
  const names = [
    'north',
    'north-east',
    'east',
    'south-east',
    'south',
    'south-west',
    'west',
    'north-west',
  ];
  return names[Math.floor((angle + 22.5) / 45) % 8];
}

module.exports = {
  CapError,
  parseCap,
  importCap,
  isLive,
  covers,
  activeAlerts,
  getShelters,
  nearestShelters,
  allShelters,
  vulnerableInArea,
  bearingLabel,
};
