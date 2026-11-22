const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const sms = require('../services/sms');
const CitizenOtp = require('../models/CitizenOtp');

const MAX_ATTEMPTS = 5;
const hash = (phone, code) =>
  crypto.createHmac('sha256', env.JWT_SECRET).update(`${phone}:${code}`).digest('hex');

async function requestOtp(rawPhone) {
  const phone = sms.normalizePhone(rawPhone);
  if (!phone || phone.length < 10) {
    const err = new Error('Enter a valid 10-digit mobile number');
    err.status = 400;
    throw err;
  }
  const code = String(crypto.randomInt(100000, 1000000));
  await CitizenOtp.findOneAndUpdate(
    { phone },
    {
      phone,
      codeHash: hash(phone, code),
      attempts: 0,
      expiresAt: new Date(Date.now() + env.OTP_TTL_MIN * 60e3),
    },
    { upsert: true }
  );
  await sms.send(
    phone,
    `Sahaya Setu sign-in code: ${code}. Valid ${env.OTP_TTL_MIN} minutes. Do not share it. / మీ కోడ్: ${code}`
  );
  return { phone, code };
}

async function verifyOtp(rawPhone, code) {
  const phone = sms.normalizePhone(rawPhone);
  const doc = phone ? await CitizenOtp.findOne({ phone }) : null;
  if (!doc || doc.expiresAt < new Date()) {
    const err = new Error('The code has expired. Ask for a new one.');
    err.status = 400;
    throw err;
  }
  if (doc.attempts >= MAX_ATTEMPTS) {
    const err = new Error('Too many wrong codes. Ask for a new one.');
    err.status = 429;
    throw err;
  }
  const given = Buffer.from(hash(phone, String(code || '').trim()));
  const stored = Buffer.from(doc.codeHash || '');
  if (given.length !== stored.length || !crypto.timingSafeEqual(given, stored)) {
    await CitizenOtp.updateOne({ _id: doc._id }, { $inc: { attempts: 1 } });
    const err = new Error('That code is not correct.');
    err.status = 400;
    throw err;
  }
  await CitizenOtp.deleteOne({ _id: doc._id });
  const token = jwt.sign({ sub: phone, phone, role: 'citizen' }, env.JWT_SECRET, {
    expiresIn: `${env.CITIZEN_TOKEN_DAYS}d`,
  });
  return { token, phone };
}

function citizenFromRequest(req) {
  const authHeader = req.get('authorization') || req.headers['authorization'] || '';
  const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!bearer) return null;
  try {
    const p = jwt.verify(bearer, env.JWT_SECRET);
    const phone = p.phone || p.sub || (p.user && p.user.phone) || null;
    return {
      phone,
      role: p.role || 'citizen',
      user: p,
    };
  } catch {
    return null;
  }
}

const optionalCitizen = (req, _res, next) => {
  req.citizen = citizenFromRequest(req);
  next();
};

const requireCitizen = (req, res, next) => {
  req.citizen = citizenFromRequest(req);
  if (!req.citizen) {
    return res.status(401).json({ detail: 'Sign in with your phone number first' });
  }
  next();
};

module.exports = {
  requestOtp,
  verifyOtp,
  citizenFromRequest,
  optionalCitizen,
  requireCitizen,
};
