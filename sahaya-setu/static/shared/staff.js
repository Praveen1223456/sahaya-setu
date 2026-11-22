/* Helpers shared by the control-room dashboard and the field team app. */
window.SS = (() => {
  'use strict';
  const KEY = 'ss.staffToken';
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const token = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const setToken = (t) => { try { localStorage.setItem(KEY, t); } catch { /* private mode */ } };
  const clearToken = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } };

  async function api(path, opts = {}, timeoutMs = 15000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const headers = { ...(opts.headers || {}), 'X-Staff-Token': token() || '' };
    try {
      const res = await fetch(path, { ...opts, headers, signal: ctrl.signal });
      const body = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
      if (!res.ok) {
        const detail = typeof body === 'object' ? body.detail : body;
        const err = new Error(Array.isArray(detail) ? detail.map((d) => d.msg).join('; ') : (detail || res.statusText));
        err.status = res.status;
        throw err;
      }
      return body;
    } finally { clearTimeout(timer); }
  }
  const postJSON = (path, data) => api(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });

  const STATUS = {
    received: 'New', review: 'Needs check', assigned: 'Assigned', in_progress: 'Team on the way',
    resolved: 'Fixed, awaiting citizen', closed: 'Closed', escalated: 'Escalated', rejected: 'Rejected', merged: 'Merged',
  };
  const CATEGORY = {
    ELEC: 'Power pole or wires', TREE: 'Fallen tree', ROAD: 'Road damage', FLOOD: 'Flooding', HOUSE: 'House damage',
    HEALTH: 'Medical help', TRANSPORT: 'Evacuation', OTHER: 'Other',
    TRAPPED: 'Trapped', MEDICAL: 'Medical emergency', FLOODING: 'Water in home', FIRE: 'Fire',
  };
  const CHANNEL = { app: 'App', sms: 'SMS', mesh: 'Relayed', voice: 'Voice' };

  const fmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const ist = (iso) => (iso ? fmt.format(new Date(iso)) : '');
  function span(ms) {
    const m = Math.round(Math.abs(ms) / 60000);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    return h < 48 ? `${h} h ${m % 60} min` : `${Math.round(h / 24)} days`;
  }
  const ago = (iso) => (iso ? `${span(Date.now() - new Date(iso))} ago` : '');
  function due(iso) {
    if (!iso) return { text: '', late: false };
    const ms = new Date(iso) - Date.now();
    return ms >= 0 ? { text: `Due in ${span(ms)}`, late: false } : { text: `Late by ${span(ms)}`, late: true };
  }
  function toast(msg, ms = 3500) {
    const el = document.createElement('div');
    el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = msg;
    document.body.appendChild(el); setTimeout(() => el.remove(), ms);
  }
  const statusGroup = (s) => (['assigned', 'in_progress'].includes(s) ? 'working' : ['resolved', 'closed'].includes(s) ? 'resolved' : s === 'review' ? 'review' : 'received');

  const people = (n) => `${n} ${n === 1 ? 'person' : 'people'}`;

  return { people, esc, token, setToken, clearToken, api, postJSON, STATUS, CATEGORY, CHANNEL, ist, ago, due, toast, statusGroup };
})();
