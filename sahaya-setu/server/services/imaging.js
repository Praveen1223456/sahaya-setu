const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const env = require('../config/env');

class BadImage extends Error {
  constructor(message = 'File is not a readable image') {
    super(message);
    this.name = 'BadImage';
    this.status = 400;
  }
}

async function validateAndInspect(data) {
  if (!data || !Buffer.isBuffer(data) || data.length === 0) {
    throw new BadImage('Empty image');
  }
  try {
    const meta = await sharp(data).metadata();
    if (!meta || !meta.format) {
      throw new BadImage();
    }
    return meta;
  } catch (err) {
    throw new BadImage();
  }
}

async function saveImage(data, subdir) {
  await validateAndInspect(data);
  const folder = path.join(env.UPLOAD_DIR, subdir);
  fs.mkdirSync(folder, { recursive: true });
  const filename = `${crypto.randomUUID().replace(/-/g, '')}.jpg`;
  const filePath = path.join(folder, filename);

  await sharp(data)
    .rotate()
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toFile(filePath);

  return `${subdir}/${filename}`;
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function phashFromPixels(pixels) {
  const N = 32;
  const rowDct = [];
  for (let r = 0; r < N; r++) {
    rowDct[r] = [];
    for (let k = 0; k < 8; k++) {
      let sum = 0;
      for (let n = 0; n < N; n++) {
        sum += pixels[r * N + n] * Math.cos((Math.PI * k * (2 * n + 1)) / (2 * N));
      }
      rowDct[r][k] = sum;
    }
  }
  const lowFreq = [];
  for (let k1 = 0; k1 < 8; k1++) {
    for (let k2 = 0; k2 < 8; k2++) {
      let sum = 0;
      for (let n = 0; n < N; n++) {
        sum += rowDct[n][k2] * Math.cos((Math.PI * k1 * (2 * n + 1)) / (2 * N));
      }
      lowFreq.push(sum);
    }
  }
  const sorted = [...lowFreq].sort((a, b) => a - b);
  const median = (sorted[31] + sorted[32]) / 2;
  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    let nibble = 0;
    for (let b = 0; b < 4; b++) {
      if (lowFreq[i + b] > median) nibble |= 1 << (3 - b);
    }
    hex += nibble.toString(16);
  }
  return hex;
}

async function phashHex(data) {
  await validateAndInspect(data);
  const raw = await sharp(data)
    .rotate()
    .resize(32, 32, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer();
  return phashFromPixels(raw);
}

function phashDistance(a, b) {
  if (!a || !b) return 64;
  let dist = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    let v = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (v > 0) {
      dist += v & 1;
      v >>= 1;
    }
  }
  return dist + Math.abs(a.length - b.length) * 4;
}

async function sharpness(data) {
  await validateAndInspect(data);
  const W = 256;
  const H = 256;
  const g = await sharp(data)
    .rotate()
    .resize(W, H, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer();

  const lap = [];
  let sum = 0;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const v =
        -4 * g[y * W + x] +
        g[(y - 1) * W + x] +
        g[(y + 1) * W + x] +
        g[y * W + (x - 1)] +
        g[y * W + (x + 1)];
      lap.push(v);
      sum += v;
    }
  }
  const mean = sum / lap.length;
  let varSum = 0;
  for (let i = 0; i < lap.length; i++) {
    const diff = lap[i] - mean;
    varSum += diff * diff;
  }
  return varSum / lap.length;
}

function embedding(data) {
  // CLIP optional feature
  return null;
}

function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB) || 1.0;
  return dot / denom;
}

function signaturePayload(photoSha256, lat, lon, capturedAt) {
  const latStr = typeof lat === 'number' ? lat.toFixed(6) : Number(lat).toFixed(6);
  const lonStr = typeof lon === 'number' ? lon.toFixed(6) : Number(lon).toFixed(6);
  return `${photoSha256}|${latStr}|${lonStr}|${capturedAt}`;
}

function sign(payload, secret = null) {
  const key = secret || env.APP_SIGNING_SECRET;
  return crypto.createHmac('sha256', key).update(payload).digest('hex');
}

function verifySignature(photoSha256, lat, lon, capturedAt, signature) {
  if (!signature) return false;
  const expected = sign(signaturePayload(photoSha256, lat, lon, capturedAt));
  return expected.toLowerCase() === String(signature).trim().toLowerCase();
}

module.exports = {
  BadImage,
  validateAndInspect,
  saveImage,
  sha256Hex,
  phashHex,
  phashDistance,
  sharpness,
  embedding,
  cosine,
  signaturePayload,
  sign,
  verifySignature,
};
