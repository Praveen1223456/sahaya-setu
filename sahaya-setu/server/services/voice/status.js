/* "What is the status of my complaint?" in Telugu, Hindi or English.
   Only complaints this citizen reported (matched by their signed-in phone number) are ever looked at. */
const Incident = require('../../models/Incident');
const Report = require('../../models/Report');
const { ACTIVE_STATUSES } = require('../../config/rules');
const { CATEGORY, STATUS, ANSWERS, short, fill } = require('./i18n');

const DIGITS = {
  '౦': 0, '౧': 1, '౨': 2, '౩': 3, '౪': 4, '౫': 5, '౬': 6, '౭': 7, '౮': 8, '౯': 9,
  '०': 0, '१': 1, '२': 2, '३': 3, '४': 4, '५': 5, '६': 6, '७': 7, '८': 8, '९': 9,
};
const asciiDigits = (s) => (s || '').replace(/[౦-౯०-९]/g, (d) => DIGITS[d]);
const PENDING = [
  'pending', 'open', 'not fixed', 'unresolved',
  'పెండింగ్', 'పూర్తి కాని', 'పరిష్కారం కాని',
  'लंबित', 'पेंडिंग', 'बाकी'
];

function describe(inc, lang) {
  const l = short(lang);
  const a = ANSWERS[l];
  const ticketCode = inc.ticket_code || inc.ticketCode || `SS-${String(inc.id || inc.number).padStart(4, '0')}`;
  const cat = CATEGORY[l][inc.category] || inc.category;
  const status = STATUS[l][inc.status] || inc.status;
  let text = fill(a.one, { code: ticketCode, cat, status });
  const workerName = inc.assigned_employee_name || inc.assignee?.name;
  if (workerName && ['assigned', 'accepted', 'in_progress'].includes(inc.status)) {
    text += fill(a.worker, { name: workerName });
  }
  return text;
}

const listItem = (inc, lang) => {
  const ticketCode = inc.ticket_code || inc.ticketCode || `SS-${String(inc.id || inc.number).padStart(4, '0')}`;
  return {
    id: inc.id || inc.number,
    ticketCode,
    ticket_code: ticketCode,
    category: inc.category,
    categoryName: CATEGORY[short(lang)][inc.category] || inc.category,
    status: inc.status,
    statusText: STATUS[short(lang)][inc.status] || inc.status,
    createdAt: inc.created_at || inc.createdAt,
    worker: inc.assigned_employee_name || inc.assignee?.name || null,
  };
};

async function statusQuery({ phone, text = '', language = 'en-IN', ticket = null }) {
  const l = short(language);
  const a = ANSWERS[l];

  // Distinct incident IDs from reports submitted by this phone
  const rawNumbers1 = await Report.distinct('incident_id', { phone });
  const rawNumbers2 = await Report.distinct('incident', { phone });
  const numbers = [...new Set([...rawNumbers1, rawNumbers2])].filter((n) => n !== null && n !== undefined);

  // Also query Incident directly where citizen_phone matches
  const mine = await Incident.find({
    $or: [
      { id: { $in: numbers } },
      { number: { $in: numbers } },
      { citizen_phone: phone },
    ],
  }).sort({ created_at: -1, createdAt: -1 });

  const result = (answer, extra = {}) => ({
    answer,
    language,
    complaints: [],
    needsSelection: false,
    ...extra,
  });

  if (!mine.length) return result(a.none);

  const query = asciiDigits(`${ticket || ''} ${text}`);
  const m = /SS[\s-]*0*(\d+)/i.exec(query) || /(?:^|\D)(\d{1,5})(?:\D|$)/.exec(query);
  if (m) {
    const targetNum = Number(m[1]);
    const inc = mine.find((i) => (i.id === targetNum || i.number === targetNum));
    if (!inc) {
      return result(fill(a.notFound, { code: `SS-${String(m[1]).padStart(4, '0')}` }), {
        complaints: mine.slice(0, 10).map((i) => listItem(i, language)),
      });
    }
    return result(describe(inc, language), {
      complaints: [listItem(inc, language)],
      selected: inc.id || inc.number,
    });
  }

  const lower = query.toLowerCase();
  const wantsPending = PENDING.some((w) => lower.includes(w));
  const pool = wantsPending
    ? mine.filter((i) => [...ACTIVE_STATUSES, 'resolved'].includes(i.status))
    : mine;

  if (!pool.length) return result(a.pendingNone);
  if (pool.length === 1) {
    return result(describe(pool[0], language), {
      complaints: [listItem(pool[0], language)],
      selected: pool[0].id || pool[0].number,
    });
  }

  const answer = wantsPending
    ? fill(a.pendingMany, {
        n: pool.length,
        list: pool
          .slice(0, 5)
          .map((i) => i.ticket_code || i.ticketCode || `SS-${String(i.id || i.number).padStart(4, '0')}`)
          .join(', '),
      })
    : fill(a.many, { n: pool.length });

  return result(answer, {
    complaints: pool.slice(0, 10).map((i) => listItem(i, language)),
    needsSelection: true,
  });
}

module.exports = { statusQuery };
