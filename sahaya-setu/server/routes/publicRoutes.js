const express = require('express');
const router = express.Router();

const rules = require('../config/rules');
const formatters = require('../views/formatters');
const Incident = require('../models/Incident');

const HIDDEN = ['merged', 'rejected'];

async function getVisible() {
  const list = await Incident.find({
    is_sos: false,
    status: { $nin: HIDDEN },
  });
  return list;
}

// 1. Map data
router.get('/incidents', async (req, res, next) => {
  try {
    const visible = await getVisible();
    const result = visible.map((i) => ({
      ticket_code: i.ticket_code,
      category: i.category,
      department: rules.DEPARTMENTS[i.department] || i.department,
      status: i.status,
      lat: i.lat !== null && i.lat !== undefined ? Math.round(i.lat * 1000) / 1000 : null,
      lon: i.lon !== null && i.lon !== undefined ? Math.round(i.lon * 1000) / 1000 : null,
      report_count: i.report_count,
      reported_at: formatters.iso(i.created_at),
      fixed_at: formatters.iso(i.resolved_at),
      proof_photo_url: formatters.uploadUrl(i.resolution_photo_path),
    }));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 2. Summary stats
router.get('/summary', async (req, res, next) => {
  try {
    const incidents = await Incident.find({ status: { $ne: 'merged' } });
    const byStatus = {};
    const perDept = {};

    for (const inc of incidents) {
      byStatus[inc.status] = (byStatus[inc.status] || 0) + 1;
      const deptName = rules.DEPARTMENTS[inc.department] || inc.department;
      if (!perDept[deptName]) {
        perDept[deptName] = { open: 0, fixed: 0, fix_hours: [] };
      }
      const d = perDept[deptName];
      if (rules.ACTIVE_STATUSES.includes(inc.status)) {
        d.open++;
      }
      if (inc.resolved_at) {
        d.fixed++;
        const hours = (new Date(inc.resolved_at) - new Date(inc.created_at)) / 3600000;
        d.fix_hours.push(hours);
      }
    }

    const departments = {};
    for (const [name, d] of Object.entries(perDept).sort(([a], [b]) => a.localeCompare(b))) {
      departments[name] = {
        open: d.open,
        fixed: d.fixed,
        avg_fix_hours:
          d.fix_hours.length > 0
            ? Math.round((d.fix_hours.reduce((a, b) => a + b, 0) / d.fix_hours.length) * 10) / 10
            : null,
      };
    }

    const openTickets = rules.ACTIVE_STATUSES.reduce(
      (sum, s) => sum + (byStatus[s] || 0),
      0
    );
    const openSos = incidents.filter(
      (i) => i.is_sos && rules.ACTIVE_STATUSES.includes(i.status)
    ).length;
    const fixedCount = incidents.filter((i) => i.resolved_at).length;
    const reportsReceived = incidents.reduce((sum, i) => sum + (i.report_count || 0), 0);

    res.json({
      generated_at: formatters.iso(new Date()),
      open_tickets: openTickets,
      open_sos: openSos,
      fixed: fixedCount,
      reports_received: reportsReceived,
      by_status: byStatus,
      by_department: departments,
    });
  } catch (err) {
    next(err);
  }
});

// 3. Recently fixed gallery
router.get('/fixes', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '12', 10), 50);
    const visible = await getVisible();
    const fixed = visible
      .filter((i) => i.resolved_at)
      .sort((a, b) => new Date(b.resolved_at) - new Date(a.resolved_at));

    const result = fixed.slice(0, limit).map((i) => {
      const hoursToFix = Math.max(
        0,
        Math.round(((new Date(i.resolved_at) - new Date(i.created_at)) / 3600000) * 10) / 10
      );
      return {
        ticket_code: i.ticket_code,
        category: i.category,
        department: rules.DEPARTMENTS[i.department] || i.department,
        status: i.status,
        address: i.address,
        report_count: i.report_count,
        hours_to_fix: hoursToFix,
        before_photo_url: formatters.uploadUrl(i.best_photo_path),
        proof_photo_url: formatters.uploadUrl(i.resolution_photo_path),
        confirmed_by_citizen: i.status === 'closed',
      };
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
