const path = require('path');
const fs = require('fs');
require('dotenv').config();

const BASE_DIR = path.resolve(__dirname, '..', '..');

function envFloat(name, def) {
  const v = process.env[name];
  return v !== undefined && v !== '' ? parseFloat(v) : def;
}

function envInt(name, def) {
  const v = process.env[name];
  return v !== undefined && v !== '' ? parseInt(v, 10) : def;
}

module.exports = {
  BASE_DIR,
  PORT: envInt('PORT', 8000),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sahaya_setu',
  UPLOAD_DIR: path.resolve(process.env.UPLOAD_DIR || path.join(BASE_DIR, 'uploads')),
  PLACES_CSV: path.resolve(process.env.PLACES_CSV || path.join(BASE_DIR, 'data', 'places_sample.csv')),
  SHELTERS_CSV: path.resolve(process.env.SHELTERS_CSV || path.join(BASE_DIR, 'data', 'shelters_sample.csv')),

  // Photo integrity
  APP_SIGNING_SECRET: process.env.APP_SIGNING_SECRET || 'change-me-hackathon-secret',
  REQUIRE_SIGNATURE: process.env.REQUIRE_SIGNATURE === '1',

  // Duplicate detection
  DUP_RADIUS_M: envFloat('DUP_RADIUS_M', 100),
  DUP_RADIUS_TEXT_ONLY_M: envFloat('DUP_RADIUS_TEXT_ONLY_M', 50),
  DUP_RADIUS_MAX_M: envFloat('DUP_RADIUS_MAX_M', 300),
  PHASH_MAX_DISTANCE: envInt('PHASH_MAX_DISTANCE', 8),
  CLIP_MIN_SIMILARITY: envFloat('CLIP_MIN_SIMILARITY', 0.85),
  FORWARDED_PHOTO_MIN_KM: envFloat('FORWARDED_PHOTO_MIN_KM', 1.0),
  ENABLE_CLIP: process.env.ENABLE_CLIP === '1',

  // SOS
  SOS_AREA_RADIUS_M: envFloat('SOS_AREA_RADIUS_M', 50),
  SOS_AREA_WINDOW_HOURS: envFloat('SOS_AREA_WINDOW_HOURS', 6),

  // GPS quality
  LOW_CONFIDENCE_ACCURACY_M: envFloat('LOW_CONFIDENCE_ACCURACY_M', 100),
  TEXT_PLACE_ACCURACY_M: 3000,

  // Outgoing SMS
  SMS_SENDER: process.env.SMS_SENDER || 'console',
  SMS_GATEWAY_URL: process.env.SMS_GATEWAY_URL || '',

  // Address lookup
  GEOCODER: process.env.GEOCODER || 'offline',
  NOMINATIM_URL: process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org/reverse',

  // Staff logins
  STAFF_TOKENS_JSON: process.env.STAFF_TOKENS_JSON || '',

  // Citizen app
  SMS_INBOUND_NUMBER: process.env.SMS_INBOUND_NUMBER || '',
  STATIC_DIR: path.join(BASE_DIR, 'static'),

  // AI (optional)
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
  ANTHROPIC_VERSION: process.env.ANTHROPIC_VERSION || '2023-06-01',
  ANTHROPIC_URL: process.env.ANTHROPIC_URL || 'https://api.anthropic.com/v1/messages',

  // Background jobs
  ESCALATION_INTERVAL_S: envInt('ESCALATION_INTERVAL_S', 300),

  // JWT & Security
  JWT_SECRET: process.env.JWT_SECRET || 'sahaya-setu-secure-jwt-secret-key-2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // Cloudinary Storage (optional, fallback to local uploads)
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',

  // Voice & Citizen Auth
  OTP_TTL_MIN: envInt('OTP_TTL_MIN', 10),
  CITIZEN_TOKEN_DAYS: envInt('CITIZEN_TOKEN_DAYS', 30),
  DEV_SHOW_OTP: process.env.DEV_SHOW_OTP === '1',
  STT_PROVIDER: process.env.STT_PROVIDER || 'none',
  STT_BASE_URL: process.env.STT_BASE_URL || '',
  STT_API_KEY: process.env.STT_API_KEY || '',
  STT_MODEL: process.env.STT_MODEL || 'whisper-1',
  VOICE_MAX_AUDIO_MB: envInt('VOICE_MAX_AUDIO_MB', 10),
  CATEGORY_DEPARTMENTS_JSON: process.env.CATEGORY_DEPARTMENTS_JSON || '',
};
