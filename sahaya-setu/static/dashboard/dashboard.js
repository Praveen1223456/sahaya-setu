/* Control room and department dashboard. */
(() => {
  'use strict';
  const { people, api, postJSON, esc, STATUS, CATEGORY, CHANNEL, ist, ago, due, toast, token, setToken, clearToken, statusGroup } = SS;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const DEPARTMENTS = { electricity: 'Electricity', health: 'Health (108 / PHC)', transport: 'Transport (RTC buses)', rescue: 'Rescue (SDRF / Fire)', roads: 'Roads & drainage' };
  const COLORS = { received: '#1b4f9c', review: '#5e4fa2', working: '#e8780c', resolved: '#1f7a4a' };
  const ACTIONS = {
    review: [['received', 'Accept as new'], ['rejected', 'Reject', true]],
    received: [['assigned', 'Assign to team'], ['in_progress', 'Team on the way'], ['resolved', 'Mark fixed'], ['rejected', 'Reject', true]],
    assigned: [['in_progress', 'Team on the way'], ['resolved', 'Mark fixed']],
    in_progress: [['resolved', 'Mark fixed']],
    escalated: [['assigned', 'Assign again'], ['in_progress', 'Team on the way'], ['resolved', 'Mark fixed']],
    resolved: [['closed', 'Close without reply'], ['escalated', 'Reopen']],
  };

  const S = {
    me: null, items: [], selected: null, status: '', quick: null, dept: '', search: '',
    knownSOS: null, audio: null, map: null, layer: null, shelterLayer: null, alertLayer: null,
    alertMap: null, alertCircle: null, alertCenter: [16.5787, 82.0061], fitted: false, timer: null, view: 'tickets',
  };
  const isControl = () => S.me?.role === 'control';

  // ------------------------------------------------------------ login
  function showLogin(message) {
    $('#login').hidden = false;
    $('#login-error').hidden = !message;
    $('#login-error').textContent = message || '';
    $('#login-form').token.focus();
  }
  async function signIn(tok) {
    setToken(tok);
    try { S.me = await api('/auth/me'); } catch (e) { clearToken(); showLogin(e.status === 401 ? 'That token is not valid.' : e.message); return; }
    $('#login').hidden = true;
    start();
  }
  function signOut() { clearToken(); location.reload(); }

  // ------------------------------------------------------------ start
  function start() {
    $('#desk').textContent = S.me.name;
    $$('[data-control]').forEach((el) => { el.hidden = !isControl(); });
    const sel = $('#f-dept');
    if (isControl()) sel.innerHTML += Object.entries(DEPARTMENTS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
    else sel.hidden = true;
    initMap();
    poll();
    S.timer = setInterval(poll, 5000);
    loadShelters();
    loadAlerts();
  }

  // ------------------------------------------------------------ map
  function initMap() {
    S.map = L.map('map', { zoomControl: true }).setView([16.6, 82.0], 9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(S.map);
    S.alertLayer = L.layerGroup().addTo(S.map);
    S.shelterLayer = L.layerGroup().addTo(S.map);
    S.layer = L.layerGroup().addTo(S.map);
  }
  async function loadShelters() {
    try {
      const list = await api('/shelters/all');
      S.shelterLayer.clearLayers();
      list.forEach((s) => L.marker([s.lat, s.lon], { icon: L.divIcon({ className: '', html: '<div class="shelter-pin"></div>', iconSize: [14, 14] }) })
        .bindTooltip(`${esc(s.name)} (capacity ${s.capacity})`).addTo(S.shelterLayer));
    } catch { /* optional */ }
  }
  function renderMarkers(items) {
    S.layer.clearLayers();
    const pts = [];
    for (const i of items) {
      if (i.lat == null) continue;
      pts.push([i.lat, i.lon]);
      const label = `${i.ticket_code} ${i.is_sos ? 'SOS ' : ''}${CATEGORY[i.category] || i.category}`;
      let m;
      if (i.is_sos) {
        const ack = !['received', 'review'].includes(i.status);
        m = L.marker([i.lat, i.lon], { zIndexOffset: 1000, icon: L.divIcon({ className: '', html: `<div class="sos-pin ${ack ? 'ack' : ''}"></div>`, iconSize: [26, 26] }) });
      } else {
        m = L.circleMarker([i.lat, i.lon], { radius: 6 + Math.min(10, Math.sqrt(i.report_count) * 3), weight: i.id === S.selected ? 4 : 2,
          color: '#fff', fillColor: COLORS[statusGroup(i.status)], fillOpacity: 0.95 });
      }
      m.bindTooltip(esc(label)).on('click', () => select(i.id)).addTo(S.layer);
    }
    if (!S.fitted && pts.length) { S.map.fitBounds(pts, { padding: [40, 40], maxZoom: 14 }); S.fitted = true; }
  }

  // ------------------------------------------------------------ queue
  async function poll() {
    try {
      const q = S.dept ? `?department=${encodeURIComponent(S.dept)}` : '';
      const data = await api('/incidents' + q);
      S.items = data.items;
      renderCounters();
      const shown = filtered();
      renderQueue(shown);
      renderMarkers(shown);
      checkSOS();
      if (S.selected && S.view === 'tickets') renderDetail(S.selected, false);
    } catch (e) {
      if (e.status === 401) signOut();
    }
  }
  function filtered() {
    const statuses = S.status ? S.status.split(',') : null;
    const q = S.search.trim().toLowerCase();
    return S.items.filter((i) => {
      if (S.quick === 'sos' && !i.is_sos) return false;
      if (S.quick === 'late' && !i.overdue) return false;
      if (S.quick === 'review' && !i.needs_review) return false;
      if (statuses && !statuses.includes(i.status)) return false;
      if (q && ![i.ticket_code, i.address, CATEGORY[i.category], i.sos_phone, i.department_name].join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
  }
  function renderCounters() {
    const open = S.items.filter((i) => i.status !== 'resolved');
    const sos = open.filter((i) => i.is_sos);
    const waitingSOS = sos.filter((i) => ['received', 'review'].includes(i.status));
    const review = open.filter((i) => i.needs_review);
    const late = open.filter((i) => i.overdue);
    const c = (key, n, label, hot) => `<button type="button" class="counter ${key} ${hot ? 'hot' : ''}" data-quick="${key}" aria-pressed="${S.quick === key}"><b>${n}</b><span>${label}</span></button>`;
    $('#counters').innerHTML = c('open', open.length, 'open', false) + c('sos', sos.length, 'SOS', waitingSOS.length > 0)
      + c('review', review.length, 'to check', false) + c('late', late.length, 'late', late.length > 0);
    const banner = $('#sos-banner');
    banner.hidden = !waitingSOS.length;
    if (waitingSOS.length) {
      const total = waitingSOS.reduce((n, i) => n + (i.people_count || 1), 0);
      banner.innerHTML = `<span>${waitingSOS.length} SOS waiting for a team, ${people(total)}</span><button type="button" class="btn small" id="banner-show">Show the first one</button>`;
      $('#banner-show').onclick = () => { setView('tickets'); select(waitingSOS[0].id, true); };
    }
  }
  function renderQueue(items) {
    const ol = $('#queue');
    if (!items.length) { ol.innerHTML = `<li class="empty">Nothing here. New reports appear within 5 seconds.</li>`; return; }
    ol.innerHTML = items.map((i) => {
      const d = due(i.sla_due_at);
      return `<li class="strip g-${statusGroup(i.status)} ${i.is_sos ? 'sos' : ''}" data-id="${i.id}" aria-selected="${i.id === S.selected}" tabindex="0">
        <span><span class="code">${esc(i.ticket_code)}</span> <span class="what">${i.is_sos ? 'SOS: ' : ''}${esc(CATEGORY[i.category] || i.category)}</span></span>
        <span class="prio"><b>${Math.round(i.priority)}</b>priority</span>
        <span class="where">${esc(i.address || 'Location unknown')}</span>
        <span class="meta"><span class="pill st-${esc(i.status)}">${esc(STATUS[i.status] || i.status)}</span>
          ${i.report_count > 1 ? `<span>${i.report_count} reports</span>` : ''}${i.people_count ? `<span>${people(i.people_count)}</span>` : ''}
          ${i.vulnerable ? '<span>vulnerable</span>' : ''}${isControl() ? `<span>${esc(i.department_name)}</span>` : ''}
          <span class="${d.late ? 'late' : ''}">${esc(d.text)}</span></span></li>`;
    }).join('');
  }

  // ------------------------------------------------------------ SOS alarm
  function checkSOS() {
    const waiting = S.items.filter((i) => i.is_sos && ['received', 'review'].includes(i.status));
    const ids = new Set(waiting.map((i) => i.id));
    if (S.knownSOS) {
      const fresh = waiting.filter((i) => !S.knownSOS.has(i.id));
      if (fresh.length) {
        alarm();
        const i = fresh[0];
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`SOS ${i.ticket_code}: ${CATEGORY[i.category] || i.category}`, { body: `${i.people_count || 1} people. ${i.address || ''}`, tag: 'sos-' + i.id });
        }
        toast(`New SOS ${i.ticket_code}: ${CATEGORY[i.category] || i.category}`);
      }
    }
    S.knownSOS = ids;
  }
  function alarm() {
    if (!S.audio) return;
    const ctx = S.audio, t0 = ctx.currentTime;
    for (let k = 0; k < 3; k++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.type = 'square'; g.gain.value = 0.18;
      o.connect(g); g.connect(ctx.destination);
      o.start(t0 + k * 0.35); o.stop(t0 + k * 0.35 + 0.2);
    }
  }
  function toggleSound() {
    const btn = $('#sound');
    if (S.audio) { S.audio.close(); S.audio = null; btn.textContent = 'Turn on SOS alarm'; btn.classList.remove('on'); return; }
    S.audio = new (window.AudioContext || window.webkitAudioContext)();
    btn.textContent = 'SOS alarm on'; btn.classList.add('on');
    alarm();
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  }

  // ------------------------------------------------------------ detail
  async function select(id, pan = true) {
    S.selected = id;
    $$('.strip').forEach((s) => s.setAttribute('aria-selected', +s.dataset.id === id));
    await renderDetail(id, pan);
    renderMarkers(filtered());
  }
  async function renderDetail(id, pan) {
    const panel = $('#detail');
    let d;
    try { d = await api('/incidents/' + id); } catch (e) { panel.hidden = false; panel.innerHTML = `<p class="warn">${esc(e.message)}</p>`; return; }
    if (S.selected !== id) return;
    const focused = document.activeElement;
    if (panel.contains(focused) && (focused.tagName === 'TEXTAREA' || focused.tagName === 'INPUT')) return; // don't wipe what they type
    panel.hidden = false;
    if (pan && d.lat != null) S.map.setView([d.lat, d.lon], Math.max(S.map.getZoom(), 15));
    const dl = due(d.sla_due_at);
    const actions = (ACTIONS[d.status] || []).filter(([, , controlOnly]) => !controlOnly || isControl());
    const mapLink = d.lat != null ? `https://www.openstreetmap.org/?mlat=${d.lat}&mlon=${d.lon}#map=18/${d.lat}/${d.lon}` : '';
    panel.innerHTML = `
      <div class="d-head"><h2>${esc(d.ticket_code)}</h2><button class="d-close" id="d-close" type="button" aria-label="Close">×</button></div>
      <div class="d-tags">${d.is_sos ? '<span class="pill sos-tag">SOS</span>' : ''}
        <span class="pill st-${esc(d.status)}">${esc(STATUS[d.status] || d.status)}</span>
        <b>${esc(CATEGORY[d.category] || d.category)}</b><span>${esc(d.department_name)}</span></div>
      ${d.photo_url ? `<a class="d-photo" href="${esc(d.photo_url)}" target="_blank" rel="noopener"><img src="${esc(d.photo_url)}" alt="Citizen photo with location stamp"></a>` : ''}
      <dl class="facts-list">
        <dt>Where</dt><dd>${esc(d.address || 'Unknown')}${mapLink ? ` <a href="${mapLink}" target="_blank" rel="noopener">Open map</a>` : ''}
          ${d.gps_accuracy_m != null ? `<br><small>GPS within ${Math.round(d.gps_accuracy_m)} m</small>` : ''}</dd>
        <dt>Reports</dt><dd>${d.report_count} ${d.report_count === 1 ? 'person' : 'people'} reported this${d.people_count ? `, ${people(d.people_count)} affected` : ''}${d.vulnerable ? ', vulnerable people involved' : ''}</dd>
        <dt>Priority</dt><dd>${Math.round(d.priority)} (severity ${d.severity}/5${d.escalation_level ? `, escalated ${d.escalation_level}×` : ''})</dd>
        <dt>Deadline</dt><dd class="${dl.late ? 'late-text' : ''}">${esc(dl.text || 'None')}</dd>
        <dt>Reported</dt><dd>${esc(ist(d.created_at))} (${esc(ago(d.created_at))})</dd>
      </dl>
      ${d.is_sos ? `<div class="box sosinfo"><h3>Person in danger</h3>
        ${d.sos_phone ? `<p><a class="btn small danger" href="tel:${esc(d.sos_phone)}">Call ${esc(d.sos_phone)}</a></p>` : '<p>No phone number.</p>'}
        <p>${people(d.people_count)}${d.battery_pct != null ? `, phone battery ${d.battery_pct}%` : ''}${d.medical_notes ? `<br>Health: ${esc(d.medical_notes)}` : ''}</p></div>` : ''}
      ${d.needs_review ? `<div class="box review"><h3>Check this report</h3><p>${esc(d.review_reason || '')}</p>
        <div class="btns">${d.possible_duplicate_of && isControl() ? `<button class="btn small" data-merge="${d.possible_duplicate_of}" type="button">Same as SS-${String(d.possible_duplicate_of).padStart(4, '0')}: merge</button>
        <button class="btn small ghost" data-peek="${d.possible_duplicate_of}" type="button">Open SS-${String(d.possible_duplicate_of).padStart(4, '0')}</button>` : ''}</div></div>` : ''}
      ${actions.length ? `<div class="box actions"><h3>Update</h3>
        <label class="field">Note for the timeline (optional)<textarea id="d-note" maxlength="500" placeholder="e.g. Lineman team from Amalapuram section sent"></textarea></label>
        <div class="btns">${actions.map(([s, label]) => `<button class="btn small ${s === 'rejected' ? 'ghost' : s === 'resolved' ? 'ok' : ''}" type="button" data-status="${s}">${esc(label)}</button>`).join('')}
        ${actions.some(([s]) => s === 'resolved') ? '<button class="btn small ghost" type="button" data-status="resolved" data-nophoto="1">Fixed, no photo</button>' : ''}</div>
        ${actions.some(([s]) => s === 'resolved') ? '<p class="hint">"Mark fixed" asks for a photo of the finished work. The citizen gets an SMS asking them to confirm.</p>' : ''}</div>` : ''}
      ${d.resolution_photo_url ? `<h3>Photo of the finished work</h3><a class="d-photo" href="${esc(d.resolution_photo_url)}" target="_blank" rel="noopener"><img src="${esc(d.resolution_photo_url)}" alt="Proof of fix"></a>` : ''}
      <h3>Reports (${d.reports.length})</h3>
      <ul class="reports">${d.reports.map((r) => `<li>
        <span><b>${esc(CHANNEL[r.channel] || r.channel)}</b> ${r.phone ? `<a href="tel:${esc(r.phone)}">${esc(r.phone)}</a>` : 'no phone'}${r.relayed_by ? ` via ${esc(r.relayed_by)}` : ''}</span>
        ${r.photo_url ? `<a href="${esc(r.photo_url)}" target="_blank" rel="noopener"><img src="${esc(r.photo_url)}" alt=""></a>` : '<span></span>'}
        <span>${esc(ist(r.received_at))} ${r.integrity === 'verified' ? '<span class="badge good">photo verified</span>' : r.integrity === 'failed' ? '<span class="badge bad">photo changed</span>' : ''}
          ${r.is_mocked ? '<span class="badge bad">fake GPS</span>' : ''}${r.location_source === 'text' ? '<span class="badge">place from text</span>' : ''}</span>
        ${r.description ? `<span class="why">“${esc(r.description)}”</span>` : ''}
        <span class="why">${esc(r.dedup_detail || '')}</span></li>`).join('')}</ul>
      <h3>Timeline</h3>
      <ol class="timeline">${d.timeline.slice().reverse().map((e) => `<li><b>${esc(STATUS[e.status] || e.status)}</b> ${esc(e.note || '')}<time>${esc(ist(e.at))}, ${esc(e.actor)}</time></li>`).join('')}</ol>`;
    $('#d-close').onclick = () => { S.selected = null; panel.hidden = true; renderMarkers(filtered()); $$('.strip').forEach((s) => s.setAttribute('aria-selected', 'false')); };
    $$('[data-status]', panel).forEach((b) => b.onclick = () => {
      if (b.dataset.status === 'resolved' && !b.dataset.nophoto) { S.pendingResolve = d.id; $('#proof-input').value = ''; $('#proof-input').click(); return; }
      if (b.dataset.status === 'rejected' && !confirm(`Reject ${d.ticket_code}? The citizen is told it was closed after verification.`)) return;
      changeStatus(d.id, b.dataset.status);
    });
    $$('[data-merge]', panel).forEach((b) => b.onclick = async () => {
      try { const t = await api(`/incidents/${d.id}/merge-into/${b.dataset.merge}`, { method: 'POST' }); toast(`Merged into ${t.ticket_code}`); select(t.id); poll(); } catch (e) { toast(e.message); }
    });
    $$('[data-peek]', panel).forEach((b) => b.onclick = () => select(+b.dataset.peek));
  }
  async function changeStatus(id, status, proof) {
    const fd = new FormData();
    fd.append('status', status);
    const note = $('#d-note')?.value.trim();
    if (note) fd.append('note', note);
    if (proof) fd.append('proof', proof, 'proof.jpg');
    try {
      const d = await api(`/incidents/${id}/status`, { method: 'POST', body: fd });
      toast(`${d.ticket_code}: ${STATUS[d.status]}. Reporters were sent an SMS.`);
      if ($('#d-note')) $('#d-note').value = '';
      await poll();
      renderDetail(id, false);
    } catch (e) { toast(e.message); }
  }

  // ------------------------------------------------------------ warnings
  async function loadAlerts() {
    let list = [];
    try { list = await api('/alerts'); } catch { return; }
    S.alertLayer.clearLayers();
    const colors = { red: '#d42a20', orange: '#e8780c', yellow: '#f2c230' };
    list.filter((a) => a.active && a.center_lat != null).forEach((a) => {
      L.circle([a.center_lat, a.center_lon], { radius: a.radius_km * 1000, color: colors[a.level], weight: 2, fillOpacity: 0.06 })
        .bindTooltip(esc(a.title)).addTo(S.alertLayer);
    });
    $('#alert-list').innerHTML = list.length ? list.map((a) => `<li class="lv-${esc(a.level)}-b ${a.active ? '' : 'ended'}">
      <span><span class="pill lv-${esc(a.level)}">${esc(a.level)}</span> <b>${esc(a.title)}</b></span>
      <span class="hint">${esc(a.area_name || 'Whole state')}${a.radius_km ? `, ${a.radius_km} km` : ''}. ${a.source === 'cap' ? 'Imported CAP alert' : `By ${esc(a.created_by || '')}`}.
        ${a.active ? `Ends ${esc(ist(a.expires_at) || 'when stopped')}` : 'Ended'}</span>
      <div class="btns"><button type="button" class="btn small ghost" data-vuln="${a.id}">Who needs help to evacuate</button>
        ${a.active && isControl() ? `<button type="button" class="btn small ghost" data-end="${a.id}">End warning</button>` : ''}</div></li>`).join('')
      : '<li>No warnings yet.</li>';
    $$('[data-end]').forEach((b) => b.onclick = async () => { await api(`/alerts/${b.dataset.end}/end`, { method: 'POST' }); loadAlerts(); });
    $$('[data-vuln]').forEach((b) => b.onclick = () => showVulnerable(b.dataset.vuln));
    if (S.alertMap) drawAlertCircles(list);
  }
  async function showVulnerable(alertId) {
    const box = $('#vulnerable');
    try {
      const v = await api('/citizens/vulnerable?alert_id=' + alertId);
      const needs = Object.entries(v.by_need).map(([k, n]) => `${n} ${k}`).join(', ') || 'none';
      box.innerHTML = `<div class="panel"><h2>${v.count} registered households need help</h2>
        <p class="hint">${v.people_in_households} people in these households. Needs: ${esc(needs)}.</p>
        ${v.people.length ? `<table class="table"><thead><tr><th>Name</th><th>Village</th><th>Needs</th><th>People</th><th>Phone</th></tr></thead><tbody>
        ${v.people.map((c) => `<tr><td>${esc(c.name || '')}</td><td>${esc(c.village || '')}</td><td>${esc(c.needs.join(', '))}</td><td>${c.household_size}</td>
          <td><a href="tel:${esc(c.phone)}">${esc(c.phone)}</a></td></tr>`).join('')}</tbody></table>` : ''}</div>`;
    } catch (e) { box.innerHTML = `<p class="warn">${esc(e.message)}</p>`; }
  }
  function initAlertMap() {
    if (S.alertMap) { S.alertMap.invalidateSize(); return; }
    S.alertMap = L.map('alert-map').setView(S.alertCenter, 9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(S.alertMap);
    S.alertMap._existing = L.layerGroup().addTo(S.alertMap);
    S.alertMap.on('click', (e) => { S.alertCenter = [e.latlng.lat, e.latlng.lng]; drawDraft(); });
    $('#alert-form').radius_km.oninput = drawDraft;
    drawDraft();
    loadAlerts();
  }
  function drawDraft() {
    if (!S.alertMap) return;
    const r = (+$('#alert-form').radius_km.value || 1) * 1000;
    if (S.alertCircle) S.alertCircle.remove();
    S.alertCircle = L.circle(S.alertCenter, { radius: r, color: '#1b4f9c', dashArray: '6 6', weight: 2 }).addTo(S.alertMap);
    $('#alert-form').centre.value = S.alertCenter.map((x) => x.toFixed(4)).join(', ');
  }
  function drawAlertCircles(list) {
    const g = S.alertMap._existing; g.clearLayers();
    const colors = { red: '#d42a20', orange: '#e8780c', yellow: '#f2c230' };
    list.filter((a) => a.active && a.center_lat != null).forEach((a) => L.circle([a.center_lat, a.center_lon], { radius: a.radius_km * 1000, color: colors[a.level], weight: 2, fillOpacity: 0.08 }).addTo(g));
  }
  async function sendAlert(e) {
    e.preventDefault();
    const f = e.target;
    const body = {
      level: f.level.value, hazard: f.hazard.value.trim(), title: f.elements.title.value.trim(), message: f.message.value.trim(),
      message_te: f.message_te.value.trim() || null, area_name: f.area_name.value.trim() || null,
      center_lat: S.alertCenter[0], center_lon: S.alertCenter[1], radius_km: +f.radius_km.value, expires_in_hours: +f.expires_in_hours.value || 48,
    };
    try { await postJSON('/alerts', body); toast('Warning sent. Citizens in the area see it when their app is online.'); f.elements.title.value = ''; f.message.value = ''; f.message_te.value = ''; loadAlerts(); }
    catch (err) { toast(err.message); }
  }
  async function importCap(e) {
    e.preventDefault();
    const xml = e.target.xml.value.trim();
    if (!xml) return toast('Paste a CAP message or choose a file first.');
    try { const r = await postJSON('/alerts/import-cap', { xml }); toast(r.created ? `Imported: ${r.title}` : `Updated: ${r.title}`); e.target.xml.value = ''; loadAlerts(); }
    catch (err) { toast(err.message); }
  }

  // ------------------------------------------------------------ situation report and SMS log
  async function runSitrep() {
    const btn = $('#sitrep-run');
    btn.disabled = true; btn.textContent = 'Writing…';
    try {
      const r = await api('/sitrep', {}, 40000);
      const f = r.facts;
      const fact = (n, label, hot) => `<div class="fact ${hot ? 'hot' : ''}"><b>${n}</b>${label}</div>`;
      $('#sitrep-facts').innerHTML = fact(f.open_tickets, 'open tickets') + fact(f.open_sos, 'open SOS', f.open_sos > 0)
        + fact(f.needs_review, 'to check') + fact(f.overdue, 'past deadline', f.overdue > 0) + fact(f.duplicates_merged, 'duplicates merged')
        + fact(f.vulnerable_people_in_alert_areas, 'vulnerable households in warning areas');
      $('#sitrep-text').textContent = r.text;
      $('#sitrep-by').textContent = r.written_by === 'claude' ? `Written by Claude from live data at ${f.time_ist}. Check the numbers before sending.` : `Built from live tickets at ${f.time_ist}.`;
      $('#sitrep-copy').disabled = false;
      const a = $('#sitrep-download');
      a.href = URL.createObjectURL(new Blob([r.text], { type: 'text/plain' }));
      a.hidden = false;
    } catch (e) { toast(e.message); } finally { btn.disabled = false; btn.textContent = 'Write report now'; }
  }
  async function loadSms() {
    try {
      const rows = await api('/outbox?limit=200');
      $('#sms-rows').innerHTML = rows.map((m) => `<tr><td>${esc(ist(m.at))}</td><td>${esc(m.to)}</td><td>${m.incident_id ? 'SS-' + String(m.incident_id).padStart(4, '0') : ''}</td><td>${esc(m.body)}</td></tr>`).join('')
        || '<tr><td colspan="4">No SMS sent yet.</td></tr>';
    } catch (e) { toast(e.message); }
  }

  // ------------------------------------------------------------ views and wiring
  function setView(v) {
    S.view = v;
    $$('.views button').forEach((b) => b.setAttribute('aria-current', b.dataset.view === v));
    $$('.view').forEach((s) => { s.hidden = s.id !== 'view-' + v; });
    if (v === 'tickets') setTimeout(() => S.map.invalidateSize(), 50);
    if (v === 'alerts') setTimeout(initAlertMap, 50);
    if (v === 'sms') loadSms();
  }
  function bind() {
    $('#login-form').onsubmit = (e) => { e.preventDefault(); signIn(e.target.token.value.trim()); };
    $$('[data-token]').forEach((b) => b.onclick = () => signIn(b.dataset.token));
    $('#logout').onclick = signOut;
    $('#sound').onclick = toggleSound;
    $$('.views button').forEach((b) => b.onclick = () => setView(b.dataset.view));
    $('#counters').onclick = (e) => {
      const b = e.target.closest('[data-quick]'); if (!b) return;
      S.quick = b.dataset.quick === 'open' || S.quick === b.dataset.quick ? null : b.dataset.quick;
      setView('tickets'); renderCounters(); const f = filtered(); renderQueue(f); renderMarkers(f);
    };
    $('#f-status').onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      S.status = b.dataset.status;
      $$('#f-status button').forEach((x) => x.setAttribute('aria-pressed', x === b));
      const f = filtered(); renderQueue(f); renderMarkers(f);
    };
    $('#f-dept').onchange = (e) => { S.dept = e.target.value; S.fitted = false; poll(); };
    $('#f-search').oninput = (e) => { S.search = e.target.value; const f = filtered(); renderQueue(f); renderMarkers(f); };
    $('#queue').onclick = (e) => { const li = e.target.closest('.strip'); if (li) select(+li.dataset.id); };
    $('#queue').onkeydown = (e) => { const li = e.target.closest('.strip'); if (li && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(+li.dataset.id); } };
    $('#proof-input').onchange = (e) => { const file = e.target.files[0]; if (file && S.pendingResolve) changeStatus(S.pendingResolve, 'resolved', file); };
    $('#alert-form').onsubmit = sendAlert;
    $('#cap-form').onsubmit = importCap;
    $('#cap-file').onchange = async (e) => { const file = e.target.files[0]; if (file) $('#cap-form').xml.value = await file.text(); };
    $('#sitrep-run').onclick = runSitrep;
    $('#sitrep-copy').onclick = async () => { await navigator.clipboard.writeText($('#sitrep-text').textContent); toast('Copied'); };
  }

  bind();
  if (token()) signIn(token()); else showLogin();
})();
