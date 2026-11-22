const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');

function generateToken(user) {
  const payload = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department || null,
    phone: user.phone || '',
  };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

// Map demo tokens to virtual or actual users for seamless hackathon & demo access
const DEMO_TOKEN_MAP = {
  'control-demo': {
    _id: '000000000000000000000001',
    name: 'District Control Room',
    email: 'admin@sahayasetu.gov.in',
    role: 'super_admin',
    department: '*',
  },
  'elec-demo': {
    _id: '000000000000000000000002',
    name: 'Electricity Section Officer',
    email: 'elec.admin@sahayasetu.gov.in',
    role: 'department_admin',
    department: 'electricity',
  },
  'health-demo': {
    _id: '000000000000000000000003',
    name: 'Health / 108 Officer',
    email: 'health.admin@sahayasetu.gov.in',
    role: 'department_admin',
    department: 'health',
  },
  'transport-demo': {
    _id: '000000000000000000000004',
    name: 'Transport & Roads Officer',
    email: 'roads.admin@sahayasetu.gov.in',
    role: 'department_admin',
    department: 'transport',
  },
  'rescue-demo': {
    _id: '000000000000000000000005',
    name: 'Emergency & SDRF Command',
    email: 'rescue.admin@sahayasetu.gov.in',
    role: 'department_admin',
    department: 'rescue',
  },
  'roads-demo': {
    _id: '000000000000000000000006',
    name: 'Roads & Infrastructure Officer',
    email: 'roads.dept@sahayasetu.gov.in',
    role: 'department_admin',
    department: 'roads',
  },
};

async function authenticateJWT(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.headers['x-staff-token']) {
    token = req.headers['x-staff-token'].trim();
  } else if (req.headers['x-auth-token']) {
    token = req.headers['x-auth-token'].trim();
  } else if (req.query && req.query.token) {
    token = req.query.token.trim();
  }

  if (!token) {
    return res.status(401).json({ detail: 'Authentication token required' });
  }

  // Check demo tokens first
  if (DEMO_TOKEN_MAP[token]) {
    req.user = DEMO_TOKEN_MAP[token];
    return next();
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    // Find live user in DB if exists
    const user = await User.findById(decoded.id).select('-password');
    if (user) {
      req.user = user;
    } else {
      req.user = decoded;
    }
    next();
  } catch (err) {
    return res.status(401).json({ detail: 'Invalid or expired token' });
  }
}

// Optional authentication (for anonymous or logged-in report submissions)
async function optionalJWT(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.headers['x-staff-token']) {
    token = req.headers['x-staff-token'].trim();
  } else if (req.headers['x-auth-token']) {
    token = req.headers['x-auth-token'].trim();
  }

  if (!token) {
    req.user = null;
    return next();
  }

  if (DEMO_TOKEN_MAP[token]) {
    req.user = DEMO_TOKEN_MAP[token];
    return next();
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    req.user = user || decoded;
  } catch (e) {
    req.user = null;
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ detail: 'Authentication required' });
    }
    if (req.user.role === 'super_admin' || roles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({
      detail: `Access denied. Requires one of roles: [${roles.join(', ')}]`,
    });
  };
}

module.exports = {
  generateToken,
  authenticateJWT,
  optionalJWT,
  requireRole,
  DEMO_TOKEN_MAP,
};
