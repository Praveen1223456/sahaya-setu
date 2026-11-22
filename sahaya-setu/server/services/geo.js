const fs = require('fs');
const { parse } = require('csv-parse/sync');
const env = require('../config/env');

const EARTH_RADIUS_M = 6371000;

function haversineM(lat1, lon1, lat2, lon2) {
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

function boundingBox(lat, lon, radiusM) {
  const dlat = (radiusM / EARTH_RADIUS_M) * (180 / Math.PI);
  const cosLat = Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
  const dlon = (radiusM / (EARTH_RADIUS_M * cosLat)) * (180 / Math.PI);
  return [lat - dlat, lat + dlat, lon - dlon, lon + dlon];
}

let cachedPlaces = null;

function getPlaces() {
  if (cachedPlaces) return cachedPlaces;
  if (!fs.existsSync(env.PLACES_CSV)) {
    console.warn(`Places file ${env.PLACES_CSV} not found; offline addresses disabled`);
    cachedPlaces = [];
    return cachedPlaces;
  }
  const content = fs.readFileSync(env.PLACES_CSV, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  cachedPlaces = records.map((r) => ({
    name: r.name,
    name_te: r.name_te || '',
    district: r.district,
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
  }));
  return cachedPlaces;
}

function nearestPlace(lat, lon) {
  const places = getPlaces();
  let best = null;
  for (const p of places) {
    const d = haversineM(lat, lon, p.lat, p.lon);
    if (best === null || d < best.dist) {
      best = { place: p, dist: d };
    }
  }
  return best;
}

function offlineAddress(lat, lon) {
  const found = nearestPlace(lat, lon);
  if (!found) return null;
  const { place, dist } = found;
  const where = dist < 1500 ? 'At' : `${(dist / 1000).toFixed(1)} km from`;
  return `${where} ${place.name}, ${place.district} district`;
}

function findPlaceInText(text) {
  if (!text) return null;
  const lowered = text.toLowerCase();
  const places = getPlaces();
  for (const p of places) {
    const names = [p.name.toLowerCase(), ...(p.name_te ? p.name_te.split(';') : [])]
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (names.some((n) => lowered.includes(n))) {
      return p;
    }
  }
  return null;
}

async function reverseGeocode(lat, lon) {
  if (env.GEOCODER === 'nominatim') {
    try {
      const url = new URL(env.NOMINATIM_URL);
      url.searchParams.set('lat', lat);
      url.searchParams.set('lon', lon);
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('accept-language', 'en');
      const res = await fetch(url.toString(), {
        headers: { 'User-Agent': 'sahaya-setu-prototype/0.1' },
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          return data.display_name.slice(0, 300);
        }
      }
    } catch (err) {
      // fallback
    }
  }
  return offlineAddress(lat, lon);
}

module.exports = {
  haversineM,
  boundingBox,
  getPlaces,
  nearestPlace,
  offlineAddress,
  findPlaceInText,
  reverseGeocode,
};
