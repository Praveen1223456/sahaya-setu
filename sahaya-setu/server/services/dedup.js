const env = require('../config/env');
const geo = require('./geo');
const imaging = require('./imaging');
const Incident = require('../models/Incident');
const Report = require('../models/Report');
const { ACTIVE_STATUSES } = require('../config/rules');

class Decision {
  constructor(action, incident_id = null, reason = '', distance_m = null) {
    this.action = action; // new | merge | review | suspicious | sos_area
    this.incident_id = incident_id;
    this.reason = reason;
    this.distance_m = distance_m;
  }
}

async function forwardedPhoto(report) {
  if (!report.phash || report.lat === null || report.lat === undefined) {
    return null;
  }
  const since = new Date(Date.now() - 7 * 86400000);
  const rows = await Report.find({
    phash: { $ne: null },
    received_at: { $gte: since },
    lat: { $ne: null },
  });

  for (const other of rows) {
    if (imaging.phashDistance(report.phash, other.phash) > env.PHASH_MAX_DISTANCE) {
      continue;
    }
    const dist = geo.haversineM(report.lat, report.lon, other.lat, other.lon);
    if (dist >= env.FORWARDED_PHOTO_MIN_KM * 1000) {
      return new Decision(
        'suspicious',
        other.incident_id,
        `Same photo was already reported ${(dist / 1000).toFixed(1)} km away (possibly forwarded)`,
        dist
      );
    }
  }
  return null;
}

async function sosArea(report) {
  if (report.lat === null || report.lat === undefined) {
    return new Decision('new', null, 'SOS without GPS location');
  }
  const since = new Date(Date.now() - env.SOS_AREA_WINDOW_HOURS * 3600000);
  const [lat0, lat1, lon0, lon1] = geo.boundingBox(report.lat, report.lon, env.SOS_AREA_RADIUS_M);

  const rows = await Incident.find({
    is_sos: true,
    created_at: { $gte: since },
    lat: { $gte: lat0, $lte: lat1 },
    lon: { $gte: lon0, $lte: lon1 },
  }).sort({ id: 1 });

  for (const inc of rows) {
    const dist = geo.haversineM(report.lat, report.lon, inc.lat, inc.lon);
    if (dist <= env.SOS_AREA_RADIUS_M) {
      const area = inc.sos_area_id || inc.id;
      return new Decision(
        'sos_area',
        area,
        `Another SOS ${Math.round(dist)} m away; grouped as one area`,
        dist
      );
    }
  }
  return new Decision('new', null, 'New SOS');
}

async function getPhotoFingerprints(incidentId) {
  const reports = await Report.find({ incident_id: incidentId });
  const hashes = reports.map((r) => r.phash).filter(Boolean);
  const embeds = reports.map((r) => r.embedding).filter(Boolean);
  return { hashes, embeds };
}

async function decide(report) {
  const forwarded = await forwardedPhoto(report);
  if (forwarded) return forwarded;

  if (report.is_sos) {
    return await sosArea(report);
  }

  if (report.lat === null || report.lat === undefined) {
    return new Decision('new', null, 'No location, cannot check for duplicates');
  }

  const [lat0, lat1, lon0, lon1] = geo.boundingBox(report.lat, report.lon, env.DUP_RADIUS_MAX_M);

  const candidates = await Incident.find({
    status: { $in: ACTIVE_STATUSES },
    is_sos: false,
    category: report.category,
    lat: { $gte: lat0, $lte: lat1 },
    lon: { $gte: lon0, $lte: lon1 },
  });

  const scored = candidates
    .map((c) => ({
      dist: geo.haversineM(report.lat, report.lon, c.lat, c.lon),
      inc: c,
    }))
    .sort((a, b) => a.dist - b.dist);

  let review = null;
  for (const { dist, inc } of scored) {
    const accuracySum = (report.gps_accuracy_m || 0) + (inc.gps_accuracy_m || 0);
    const radius = Math.min(env.DUP_RADIUS_MAX_M, Math.max(env.DUP_RADIUS_M, accuracySum));
    if (dist > radius) continue;

    const { hashes, embeds } = await getPhotoFingerprints(inc.id);

    if (report.phash && hashes.some((h) => imaging.phashDistance(report.phash, h) <= env.PHASH_MAX_DISTANCE)) {
      return new Decision('merge', inc.id, `Same photo, ${Math.round(dist)} m apart`, dist);
    }

    if (report.embedding && embeds.length > 0) {
      const best = Math.max(...embeds.map((e) => imaging.cosine(report.embedding, e)));
      if (best >= env.CLIP_MIN_SIMILARITY) {
        return new Decision('merge', inc.id, `Same scene (similarity ${best.toFixed(2)}), ${Math.round(dist)} m apart`, dist);
      }
    }

    const noPhotoToCompare = !report.phash || hashes.length === 0;
    if (noPhotoToCompare && dist <= env.DUP_RADIUS_TEXT_ONLY_M) {
      return new Decision('merge', inc.id, `Same problem type ${Math.round(dist)} m away (no photo to compare)`, dist);
    }

    if (!review) {
      review = new Decision(
        'review',
        inc.id,
        `Same problem type ${Math.round(dist)} m away but photos differ; please confirm`,
        dist
      );
    }
  }

  return review || new Decision('new', null, 'No open ticket nearby');
}

module.exports = {
  Decision,
  decide,
};
