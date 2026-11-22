/* Voice complaints and the voice status assistant for signed-in citizens.
   POST /auth/citizen/request-otp   {phone}                 -> SMS a 6-digit code
   POST /auth/citizen/verify-otp    {phone, code}           -> {token}
   GET  /citizen/complaints                                 -> this citizen's complaints only
   GET  /voice/capabilities                                 -> languages, server STT, AI on
   POST /voice/transcribe           multipart audio         -> server STT fallback
   POST /voice/analyze              {text, language}        -> suggested title, category, etc.
   POST /complaints/voice           multipart meta + photo  -> normal complaint pipeline
   POST /voice/status-query         {text?, ticket?, lang}  -> spoken-style answer */
const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const env = require('../config/env');
const ai = require('../services/ai');
const rules = require('../config/rules');
const services = require('../services/services');
const formatters = require('../views/formatters');
const sms = require('../services/sms');
const stt = require('../services/voice/stt');
const { analyze } = require('../services/voice/analyze');
const { statusQuery } = require('../services/voice/status');
const { LANGS } = require('../services/voice/i18n');
const { requestOtp, verifyOtp, requireCitizen } = require('../middleware/citizenAuth');
const { limiter } = require('../middleware/rateLimit');
const Incident = require('../models/Incident');
const Report = require('../models/Report');

const router = express.Router();
const byPhone = (req) => req.citizen?.phone || req.ip;

const otpLimit = limiter({
  name: 'otp',
  windowMs: 15 * 60e3,
  max: 5,
  key: (req) => `${req.ip}:${sms.normalizePhone(req.body?.phone) || ''}`,
  message: 'Too many code requests. Wait 15 minutes.',
});
const verifyLimit = limiter({ name: 'verify', windowMs: 15 * 60e3, max: 20 });
const transcribeLimit = limiter({ name: 'stt', windowMs: 10 * 60e3, max: 20, key: byPhone });
const analyzeLimit = limiter({ name: 'analyze', windowMs: 10 * 60e3, max: 60, key: byPhone });
const submitLimit = limiter({ name: 'voice-submit', windowMs: 60 * 60e3, max: 30, key: byPhone });

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: (env.VOICE_MAX_AUDIO_MB || 10) * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (stt.isAllowed(file.mimetype)) {
      cb(null, true);
    } else {
      const err = new Error(`Audio format not supported. Use one of: ${stt.ALLOWED.join(', ')}`);
      err.status = 415;
      cb(err);
    }
  },
});

const uploadPhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
});

function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.errors.map((e) => e.message).join(', ');
    const err = new Error(message || 'Validation error');
    err.status = 422;
    throw err;
  }
  return result.data;
}

// ---------------------------------------------------------------- Citizen Sign-In
router.post('/auth/citizen/request-otp', otpLimit, async (req, res, next) => {
  try {
    const { phone } = parse(z.object({ phone: z.string().min(10).max(20) }), req.body || {});
    const r = await requestOtp(phone);
    res.json({
      sent: true,
      phone: r.phone,
      ...(env.DEV_SHOW_OTP ? { devCode: r.code } : {}),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/auth/citizen/verify-otp', verifyLimit, async (req, res, next) => {
  try {
    const b = parse(
      z.object({
        phone: z.string().min(10).max(20),
        code: z.string().regex(/^\d{6}$/, 'The code has 6 digits'),
      }),
      req.body || {}
    );
    res.json(await verifyOtp(b.phone, b.code));
  } catch (err) {
    next(err);
  }
});

router.get('/citizen/complaints', requireCitizen, async (req, res, next) => {
  try {
    const raw1 = await Report.distinct('incident_id', { phone: req.citizen.phone });
    const raw2 = await Report.distinct('incident', { phone: req.citizen.phone });
    const numbers = [...new Set([...raw1, raw2])].filter((n) => n !== null && n !== undefined);
    const incs = await Incident.find({
      $or: [
        { id: { $in: numbers } },
        { number: { $in: numbers } },
        { citizen_phone: req.citizen.phone },
      ],
    })
      .sort({ created_at: -1, createdAt: -1 })
      .limit(100);

    const tickets = await Promise.all(incs.map(formatters.citizenTicketOut));
    res.json(tickets);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------- Voice Endpoints
router.get('/voice/capabilities', (_req, res) => {
  res.json({
    languages: LANGS,
    serverTranscription: stt.provider().available(),
    provider: stt.provider().name,
    aiAnalysis: ai.enabled(),
    maxAudioMb: env.VOICE_MAX_AUDIO_MB || 10,
  });
});

router.post(
  '/voice/transcribe',
  requireCitizen,
  transcribeLimit,
  audioUpload.single('audio'),
  async (req, res, next) => {
    try {
      if (req.body.consent !== 'true') {
        const err = new Error('Agree to send your recording to the server first');
        err.status = 400;
        throw err;
      }
      const language = parse(z.enum(LANGS), req.body.language);
      if (!req.file?.buffer?.length) {
        const err = new Error('No recording received');
        err.status = 400;
        throw err;
      }
      const p = stt.provider();
      if (!p.available()) {
        const err = new Error(
          'Server speech-to-text is not set up. Use the browser microphone or type your complaint.'
        );
        err.status = 501;
        throw err;
      }
      const out = await p.transcribe(req.file.buffer, req.file.mimetype, language);
      if (!out.text) {
        const err = new Error('No speech was recognised in the recording. Please try again.');
        err.status = 422;
        throw err;
      }
      res.json({ text: out.text, language, provider: out.provider });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/voice/analyze', requireCitizen, analyzeLimit, async (req, res, next) => {
  try {
    const b = parse(
      z.object({
        text: z.string().trim().min(3, 'Say a little more about the problem').max(2000),
        language: z.enum(LANGS),
      }),
      req.body || {}
    );
    res.json(await analyze(b.text, b.language));
  } catch (err) {
    next(err);
  }
});

const Classification = z
  .object({
    source: z.enum(['claude', 'rules']),
    category: z.enum(Object.keys(rules.CATEGORIES)),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    confidence: z.number().min(0).max(1),
    title: z.string().max(120).optional().nullable(),
  })
  .strip();

const VoiceComplaint = z.object({
  clientReportId: z.string().max(64).optional().nullable(),
  language: z.enum(LANGS),
  transcription: z.string().trim().min(3).max(2000),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(3).max(2000),
  category: z.enum(Object.keys(rules.CATEGORIES)),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  aiClassification: Classification.optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lon: z.number().min(-180).max(180).optional().nullable(),
  gpsAccuracyM: z.number().min(0).max(100000).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  landmark: z.string().trim().max(200).optional().nullable(),
  locationAdjusted: z.boolean().default(false),
  spokenLocation: z.string().max(200).optional().nullable(),
  assetId: z.string().max(40).optional().nullable(),
  peopleCount: z.number().int().min(0).max(500).default(0),
});

const SEV_NUMBER = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

router.post(
  '/complaints/voice',
  requireCitizen,
  submitLimit,
  uploadPhoto.single('photo'),
  async (req, res, next) => {
    try {
      let body;
      try {
        body = typeof req.body.meta === 'string' ? JSON.parse(req.body.meta || '{}') : (req.body.meta || req.body || {});
      } catch {
        const err = new Error('meta must be JSON');
        err.status = 422;
        throw err;
      }
      const v = parse(VoiceComplaint, body);
      const meta = {
        client_report_id: v.clientReportId,
        phone: req.citizen.phone,
        lat: v.lat,
        lon: v.lon,
        gps_accuracy_m: v.gpsAccuracyM,
        address: v.address,
        landmark: v.landmark,
        assetId: v.assetId,
        category: v.category,
        severity: SEV_NUMBER[v.severity] || 2,
        people_count: v.peopleCount,
        description: v.description,
        title: v.title,
        inputMethod: 'VOICE',
        input_method: 'VOICE',
        voiceMetadata: {
          language: v.language,
          transcription: v.transcription,
          title: v.title,
          aiClassification: v.aiClassification || undefined,
          spokenLocation: v.spokenLocation || undefined,
          landmark: v.landmark || undefined,
          locationAdjusted: v.locationAdjusted,
        },
      };

      const result = await services.submitReport(meta, req.file?.buffer || null, { channel: 'app' });
      const out = formatters.resultOut(result);
      const ticketCode = out.ticketCode || out.ticket_code;
      const duplicateWarning =
        result.decision === 'merge'
          ? `This problem was already reported. Your complaint was added to ${ticketCode}.`
          : null;

      res.json({
        ...out,
        ticketCode,
        duplicateWarning,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/voice/status-query', requireCitizen, analyzeLimit, async (req, res, next) => {
  try {
    const b = parse(
      z.object({
        text: z.string().max(500).optional().default(''),
        ticket: z.string().max(20).optional().nullable(),
        language: z.enum(LANGS),
      }),
      req.body || {}
    );
    res.json(
      await statusQuery({
        phone: req.citizen.phone,
        text: b.text,
        ticket: b.ticket,
        language: b.language,
      })
    );
  } catch (err) {
    next(err);
  }
});

module.exports = router;
