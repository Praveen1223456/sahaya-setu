/* Small in-memory rate limiter (per key, sliding window). */
const buckets = new Map();

function limiter({
  name,
  windowMs,
  max,
  key = (req) => req.ip,
  message = 'Too many requests. Please wait and try again.',
}) {
  return (req, res, next) => {
    const id = `${name}:${key(req)}`;
    const now = Date.now();
    const hits = (buckets.get(id) || []).filter((t) => now - t < windowMs);
    if (hits.length >= max) {
      return res.status(429).json({ detail: message, error: message });
    }
    hits.push(now);
    buckets.set(id, hits);
    return next();
  };
}

const reset = () => buckets.clear();

module.exports = { limiter, reset };
