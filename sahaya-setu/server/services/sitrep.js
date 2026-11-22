const Incident = require('../models/Incident');
const alerts = require('./alerts');
const ai = require('./ai');
const rules = require('../config/rules');

function formatIST(date) {
  const d = date ? new Date(date) : new Date();
  const options = {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };
  const parts = new Intl.DateTimeFormat('en-IN', options).format(d);
  return `${parts} IST`;
}

async function buildFacts() {
  const now = new Date();
  const incidents = await Incident.find({ status: { $ne: 'merged' } });
  const openIncidents = incidents.filter((i) => rules.ACTIVE_STATUSES.includes(i.status));
  const since = new Date(now.getTime() - 24 * 3600000);

  const deptMap = {};
  for (const deptKey of Object.keys(rules.DEPARTMENTS)) {
    const name = rules.DEPARTMENTS[deptKey];
    deptMap[name] = { open: 0, overdue: 0, fixed_24h: 0, fix_hours: [] };
  }

  for (const inc of incidents) {
    const deptName = rules.DEPARTMENTS[inc.department] || inc.department;
    if (!deptMap[deptName]) {
      deptMap[deptName] = { open: 0, overdue: 0, fixed_24h: 0, fix_hours: [] };
    }
    const d = deptMap[deptName];
    if (rules.ACTIVE_STATUSES.includes(inc.status)) {
      d.open++;
      if (rules.isOverdue(inc, now)) {
        d.overdue++;
      }
    }
    if (inc.resolved_at) {
      const hours = (new Date(inc.resolved_at) - new Date(inc.created_at)) / 3600000;
      d.fix_hours.push(hours);
      if (new Date(inc.resolved_at) >= since) {
        d.fixed_24h++;
      }
    }
  }

  const byDepartment = {};
  for (const [name, d] of Object.entries(deptMap).sort(([a], [b]) => a.localeCompare(b))) {
    byDepartment[name] = {
      open: d.open,
      overdue: d.overdue,
      fixed_last_24h: d.fixed_24h,
      avg_fix_hours:
        d.fix_hours.length > 0
          ? Math.round((d.fix_hours.reduce((a, b) => a + b, 0) / d.fix_hours.length) * 10) / 10
          : null,
    };
  }

  const urgent = [...openIncidents]
    .sort((a, b) => rules.priorityScore(b, now) - rules.priorityScore(a, now))
    .slice(0, 5);

  const liveAlerts = await alerts.activeAlerts();
  let vulnerable = 0;
  for (const a of liveAlerts) {
    const peopleInArea = await alerts.vulnerableInArea(a.center_lat, a.center_lon, a.radius_km);
    vulnerable += peopleInArea.length;
  }

  return {
    time_ist: formatIST(now),
    open_tickets: openIncidents.length,
    open_sos: openIncidents.filter((i) => i.is_sos).length,
    sos_people: openIncidents
      .filter((i) => i.is_sos)
      .reduce((sum, i) => sum + (i.people_count || 0), 0),
    needs_review: openIncidents.filter((i) => i.needs_review).length,
    overdue: openIncidents.filter((i) => rules.isOverdue(i, now)).length,
    reports_received: incidents.reduce((sum, i) => sum + (i.report_count || 0), 0),
    duplicates_merged: incidents.reduce((sum, i) => sum + Math.max((i.report_count || 1) - 1, 0), 0),
    by_department: byDepartment,
    most_urgent: urgent.map((i) => ({
      ticket: i.ticket_code,
      what: (i.is_sos ? 'SOS ' : '') + i.category,
      where: i.address,
      people: i.people_count,
      status: i.status,
      overdue: rules.isOverdue(i, now),
    })),
    active_alerts: liveAlerts.map((a) => ({
      level: a.level,
      title: a.title,
      area: a.area_name,
    })),
    vulnerable_people_in_alert_areas: vulnerable,
  };
}

function ruleText(f) {
  const lines = [`Situation report, ${f.time_ist}`, ''];
  lines.push(
    `Open tickets: ${f.open_tickets} (SOS ${f.open_sos} covering ${f.sos_people} people; ` +
      `waiting for review ${f.needs_review}; past deadline ${f.overdue}).`
  );
  lines.push(
    `Reports received: ${f.reports_received}, of which ${f.duplicates_merged} were duplicates merged automatically.`
  );
  if (f.active_alerts && f.active_alerts.length > 0) {
    const names = f.active_alerts
      .map((a) => `${a.level.toUpperCase()} ${a.title}`)
      .join('; ');
    lines.push(
      `Active alerts: ${names}. Registered vulnerable people inside alert areas: ${f.vulnerable_people_in_alert_areas}.`
    );
  }
  lines.push('', 'By department:');
  for (const [name, d] of Object.entries(f.by_department)) {
    const avg = d.avg_fix_hours !== null ? `, average fix ${d.avg_fix_hours} h` : '';
    lines.push(
      `  ${name}: ${d.open} open, ${d.overdue} past deadline, ${d.fixed_last_24h} fixed in 24 h${avg}.`
    );
  }
  if (f.most_urgent && f.most_urgent.length > 0) {
    lines.push('', 'Most urgent now:');
    for (const u of f.most_urgent) {
      const late = u.overdue ? ', PAST DEADLINE' : '';
      lines.push(
        `  ${u.ticket} ${u.what} at ${u.where || 'unknown location'}, ${u.people} people, ${u.status}${late}.`
      );
    }
  }
  return lines.join('\n');
}

async function generate() {
  const facts = await buildFacts();
  let text = null;
  if (ai.enabled()) {
    text = await ai.writeSitrep(facts);
  }
  return {
    facts,
    text: text || ruleText(facts),
    written_by: text ? 'claude' : 'rules',
  };
}

module.exports = {
  buildFacts,
  ruleText,
  generate,
};
