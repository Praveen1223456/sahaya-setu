const env = require('../config/env');

const DEMO_TOKENS = {
  'control-demo': { name: 'District control room', department: '*', role: 'control' },
  'elec-demo': { name: 'Electricity section', department: 'electricity', role: 'department' },
  'health-demo': { name: 'Health / 108', department: 'health', role: 'department' },
  'transport-demo': { name: 'RTC depot', department: 'transport', role: 'department' },
  'rescue-demo': { name: 'SDRF / Fire', department: 'rescue', role: 'department' },
  'roads-demo': { name: 'Roads & drainage', department: 'roads', role: 'department' },
};

class Staff {
  constructor(token, name, department, role) {
    this.token = token;
    this.name = name;
    this.department = department;
    this.role = role;
  }

  get isControl() {
    return this.role === 'control';
  }

  canAccess(incident) {
    return this.isControl || this.department === '*' || this.department === incident.department;
  }
}

function getTokens() {
  if (env.STAFF_TOKENS_JSON) {
    try {
      return JSON.parse(env.STAFF_TOKENS_JSON);
    } catch {
      return DEMO_TOKENS;
    }
  }
  return DEMO_TOKENS;
}

function extractToken(req) {
  const headerToken = req.headers['x-staff-token'];
  if (headerToken) return headerToken.trim();
  const auth = req.headers.authorization;
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return null;
}

function currentStaff(req, res, next) {
  const token = extractToken(req);
  const tokens = getTokens();
  const info = tokens[token || ''];
  if (!info) {
    return res.status(401).json({ detail: 'Sign in with a valid staff token' });
  }
  req.staff = new Staff(
    token,
    info.name,
    info.department || '*',
    info.role || 'department'
  );
  next();
}

function controlStaff(req, res, next) {
  currentStaff(req, res, () => {
    if (!req.staff.isControl) {
      return res.status(403).json({ detail: 'Only the control room can do this' });
    }
    next();
  });
}

function checkAccess(staff, incident) {
  if (!staff.canAccess(incident)) {
    const err = new Error(`${incident.ticket_code} belongs to another department`);
    err.status = 403;
    throw err;
  }
}

module.exports = {
  DEMO_TOKENS,
  Staff,
  currentStaff,
  controlStaff,
  checkAccess,
};
