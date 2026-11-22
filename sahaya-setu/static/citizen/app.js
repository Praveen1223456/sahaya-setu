/* Sahaya Setu citizen app. Works offline: everything is saved on the phone first and sent when possible. */
(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------------------------------------------------------------- words (Telugu, English)
  const STR = {
    sos_open_hint: ['అత్యవసరమా? ఇక్కడ నొక్కండి', 'Emergency? Tap here'],
    report: ['సమస్య తెలపండి', 'Report a problem'],
    report_sub: ['ఫోటో తీసి పంపండి', 'Take a photo and send'],
    speak: ['మాట్లాడి చెప్పండి', 'Speak your problem'],
    tickets: ['నా ఫిర్యాదులు', 'My reports'],
    relay: ['సిగ్నల్ లేదా? పక్కవారికి ఇవ్వండి', 'No signal? Pass it to a neighbour'],
    profile: ['నా కుటుంబం, ఆరోగ్య వివరాలు', 'My family and health details'],
    emergency_note: ['ప్రాణాపాయం ఉంటే 112 కి కూడా కాల్ చేయండి.', 'If a life is in danger, also call 112.'],
    online: ['నెట్‌వర్క్ ఉంది', 'Online'],
    offline: ['నెట్‌వర్క్ లేదు', 'No network'],
    waiting_n: ['{n} పంపాల్సి ఉంది', '{n} waiting'],
    back: ['వెనక్కి', 'Back'],
    retake: ['మళ్ళీ తీయండి', 'Retake'],
    finding_gps: ['స్థానం కనుగొంటోంది…', 'Finding location…'],
    gps_acc: ['స్థానం ±{n} మీ.', 'Location ±{n} m'],
    gps_off: ['స్థానం అందుబాటులో లేదు', 'Location unavailable'],
    camera_denied: ['ఫోటో తీయడానికి కెమెరా అనుమతి ఇవ్వండి.', 'Allow camera access to take a live photo.'],
    what_problem: ['ఏ సమస్య?', 'What is the problem?'],
    people_affected: ['ఎంతమంది ఇబ్బందిలో ఉన్నారు?', 'How many people are affected?'],
    danger_now: ['ఇప్పుడే ప్రమాదం ఉందా? (కరెంటు తీగ, కూలుతున్న గోడ)', 'Dangerous right now? (live wire, falling wall)'],
    note: ['ఇంకా ఏమైనా (ఐచ్ఛికం)', 'Anything else (optional)'],
    send: ['పంపండి', 'Send'],
    sending: ['పంపుతోంది…', 'Sending…'],
    ai_suggest: ['AI సూచన: {c}', 'AI suggestion: {c}'],
    sent_title: ['మీ ఫిర్యాదు అందింది', 'Your report was received'],
    merged_title: ['ఈ సమస్యను ఇప్పటికే {n} మంది తెలిపారు', '{n} people have reported this problem'],
    merged_body: ['మీ ఫిర్యాదు అదే టికెట్‌కు జోడించబడింది.', 'Your report was added to the same ticket.'],
    review_body: ['మీ ఫిర్యాదు అధికారుల పరిశీలనలో ఉంది.', 'Officials are checking your report.'],
    updates_sms: ['మీకు SMS ద్వారా సమాచారం వస్తుంది.', 'You will get updates by SMS.'],
    queued_title: ['ఫోన్‌లో భద్రపరిచాం', 'Saved on your phone'],
    queued_body: ['నెట్‌వర్క్ రాగానే అదే పంపబడుతుంది. ఇప్పుడే పంపాలంటే SMS వాడండి.', 'It will send itself when the network returns. Use SMS to send it now.'],
    send_sms: ['SMS ద్వారా పంపండి', 'Send by SMS'],
    no_sms_number: ['SMS నంబర్ ఇంకా సెట్ చేయలేదు. QR కోడ్ ద్వారా పక్కవారికి ఇవ్వండి.', 'The SMS number is not set up yet. Pass it to a neighbour with the QR code.'],
    show_qr: ['QR కోడ్ చూపించండి', 'Show QR code'],
    home: ['ముఖ్య పేజీ', 'Home'],
    sos_title: ['అత్యవసర సహాయం', 'Emergency help'],
    sos_what: ['ఏం జరిగింది?', 'What is happening?'],
    TRAPPED: ['చిక్కుకుపోయాం', 'Trapped'],
    MEDICAL: ['వైద్య సహాయం', 'Medical'],
    FLOODING: ['ఇంట్లోకి నీరు', 'Water entering home'],
    FIRE: ['మంటలు', 'Fire'],
    OTHER_SOS: ['ఇతర', 'Other'],
    how_many: ['ఎంతమంది?', 'How many people?'],
    hold_send: ['3 సెకన్లు నొక్కి పట్టుకోండి', 'Press and hold 3 seconds'],
    sending_in: ['{n} సెకన్లలో SOS పంపబడుతుంది', 'Sending SOS in {n} seconds'],
    cancel: ['రద్దు చేయండి', 'Cancel'],
    sos_sent: ['SOS పంపబడింది', 'SOS sent'],
    sos_saved: ['SOS ఫోన్‌లో ఉంది, ఇంకా పంపలేదు', 'SOS saved, not sent yet'],
    sos_saved_help: ['క్రింద SMS బటన్ నొక్కండి లేదా పక్కవారికి QR చూపించండి.', 'Tap Send by SMS below, or show the QR code to a neighbour.'],
    waiting_control: ['కంట్రోల్ రూమ్ స్పందన కోసం వేచి ఉంది', 'Waiting for the control room'],
    help_coming: ['సహాయం వస్తోంది', 'Help is on the way'],
    last_update: ['చివరి అప్‌డేట్ {t}', 'Last update {t}'],
    alert_family: ['కుటుంబానికి తెలపండి', 'Alert my family'],
    flash: ['స్క్రీన్ వెలుగు', 'Flash screen'],
    siren: ['సైరన్', 'Siren'],
    call112: ['112 కి కాల్', 'Call 112'],
    im_safe: ['నేను ఇప్పుడు సురక్షితంగా ఉన్నాను', 'I am safe now'],
    sos_wait_tips: ['ఎత్తైన, సురక్షిత చోట ఉండండి. బ్యాటరీ ఆదా చేయండి. ప్రతి 3 నిమిషాలకు మీ స్థానం మళ్ళీ పంపుతాం.', 'Stay somewhere high and safe. Save your battery. Your location is sent again every 3 minutes.'],
    family_sms: ['నేను ప్రమాదంలో ఉన్నాను. SOS పంపాను. నా స్థానం:', 'I am in danger and have sent an SOS. My location:'],
    speak_title: ['మాట్లాడి చెప్పండి', 'Speak your problem'],
    speak_help: ['ఏం జరిగిందో, మీ గ్రామం పేరు చెప్పండి.', 'Say what happened and the name of your village.'],
    start_listen: ['మాట్లాడటం మొదలుపెట్టండి', 'Start speaking'],
    stop_listen: ['ఆపండి', 'Stop'],
    type_instead: ['ఇక్కడ టైప్ కూడా చేయవచ్చు', 'You can also type here'],
    speech_unsupported: ['ఈ ఫోన్‌లో మాటను గుర్తించలేం. దయచేసి టైప్ చేయండి.', "This phone can't recognise speech. Please type instead."],
    empty_text: ['ముందుగా మీ సమస్య రాయండి లేదా చెప్పండి.', 'Say or type your problem first.'],
    tickets_empty: ['ఇంకా ఫిర్యాదులు లేవు.', 'No reports yet.'],
    pending_n: ['{n} ఫిర్యాదులు ఫోన్‌లో ఉన్నాయి, ఇంకా పంపలేదు.', '{n} reports are saved on this phone and not sent yet.'],
    is_fixed: ['సమస్య పరిష్కారమైందా?', 'Is the problem fixed?'],
    yes_fixed: ['అవును, పరిష్కారమైంది', 'Yes, fixed'],
    not_fixed: ['లేదు, ఇంకా లేదు', 'No, not fixed'],
    thanks: ['ధన్యవాదాలు', 'Thank you'],
    reported: ['తెలిపిన వారు: {n}', 'Reported by {n} people'],
    proof: ['పని పూర్తయిన ఫోటో', 'Photo of the finished work'],
    relay_title: ['సిగ్నల్ లేకుండా పంపడం', 'Sending without signal'],
    relay_help: ['మీ ఫోన్‌లో సిగ్నల్ లేకపోతే, నెట్‌వర్క్ ఉన్న పక్కవారు ఈ యాప్‌తో మీ QR కోడ్‌ను స్కాన్ చేసి పంపగలరు.', 'If your phone has no signal, a neighbour whose phone has network can scan your QR code with this app and send it for you.'],
    my_codes: ['నా QR కోడ్', 'My QR code'],
    scan_neighbour: ['పక్కవారిది స్కాన్', "Scan a neighbour's"],
    nothing_pending: ['పంపాల్సినవి ఏమీ లేవు.', 'Nothing waiting to send.'],
    qr_n: ['{i} / {n}', '{i} of {n}'],
    next: ['తరువాత', 'Next'],
    prev: ['ముందు', 'Previous'],
    scanning: ['పక్కవారి ఫోన్‌లోని QR కోడ్ వైపు కెమెరా చూపించండి.', "Point the camera at the QR code on your neighbour's phone."],
    got_relay: ['పక్కవారి ఫిర్యాదు అందింది. నెట్‌వర్క్ వచ్చాక పంపుతాం.', "Got your neighbour's report. It will be sent when there is network."],
    already_relay: ['ఈ కోడ్ ఇప్పటికే అందింది.', 'This code was already received.'],
    profile_title: ['నా వివరాలు', 'My details'],
    profile_help: ['తుఫానుకు ముందే ఇవి నింపండి. ఎవరిని ముందుగా తరలించాలో అధికారులకు తెలుస్తుంది.', 'Fill this in before a cyclone, so officials know who to evacuate first.'],
    phone: ['ఫోన్ నంబర్', 'Phone number'],
    name: ['పేరు', 'Name'],
    village: ['గ్రామం', 'Village'],
    household: ['ఇంట్లో ఎంతమంది', 'People at home'],
    needs: ['ఇంట్లో ఎవరైనా ఉన్నారా?', 'Does anyone at home…'],
    elderly: ['వృద్ధులు', 'Elderly'],
    pregnant: ['గర్భిణి', 'Pregnant'],
    disabled: ['వికలాంగులు', 'Disabled'],
    infant: ['పసిపిల్లలు', 'Infant'],
    dialysis: ['డయాలసిస్', 'On dialysis'],
    bedridden: ['మంచానికే పరిమితం', 'Bedridden'],
    oxygen: ['ఆక్సిజన్ అవసరం', 'Needs oxygen'],
    medical: ['ఆరోగ్య వివరాలు (బ్లడ్ గ్రూప్ మొదలైనవి)', 'Health details (blood group etc.)'],
    contacts: ['కుటుంబ సభ్యుల ఫోన్ నంబర్లు (కామాతో)', 'Family phone numbers (separate with commas)'],
    consent: ['ఈ వివరాలను విపత్తు అధికారులతో పంచుకోవడానికి అంగీకరిస్తున్నాను', 'I agree to share these details with disaster officials'],
    save: ['సేవ్ చేయండి', 'Save'],
    saved: ['సేవ్ అయింది', 'Saved'],
    need_phone: ['SMS అప్‌డేట్ల కోసం ముందుగా మీ ఫోన్ నంబర్ ఇవ్వండి.', 'Add your phone number first so you can get SMS updates.'],
    alert_more: ['వివరాలు, షెల్టర్లు', 'Details and shelters'],
    shelter: ['దగ్గరి తుఫాను షెల్టర్లు', 'Nearest cyclone shelters'],
    km_dir: ['{d} కి.మీ., {dir}', '{d} km {dir}'],
    directions: ['దారి', 'Directions'],
    lv_red: ['రెడ్ అలర్ట్', 'Red alert'],
    lv_orange: ['ఆరెంజ్ అలర్ట్', 'Orange alert'],
    lv_yellow: ['ఎల్లో అలర్ట్', 'Yellow alert'],
    st_received: ['అందింది', 'Received'],
    st_review: ['పరిశీలనలో ఉంది', 'Being checked'],
    st_assigned: ['శాఖకు అప్పగించారు', 'Assigned to department'],
    st_in_progress: ['బృందం దారిలో ఉంది', 'Team on the way'],
    st_resolved: ['పరిష్కరించామన్నారు', 'Marked as fixed'],
    st_closed: ['మూసివేశారు', 'Closed'],
    st_escalated: ['ఉన్నతాధికారికి పంపారు', 'Sent to senior officer'],
    st_rejected: ['తిరస్కరించారు', 'Rejected'],
    st_merged: ['ఇతర టికెట్‌తో కలిపారు', 'Combined with another ticket'],
    ELEC: ['కరెంటు స్తంభం / తీగలు', 'Power pole or wires'],
    TREE: ['చెట్టు కూలింది', 'Fallen tree'],
    ROAD: ['రోడ్డు దెబ్బతింది', 'Road damaged'],
    FLOOD: ['వరద నీరు', 'Flooding'],
    HOUSE: ['ఇల్లు దెబ్బతింది', 'House damaged'],
    HEALTH: ['వైద్య సహాయం', 'Medical help'],
    TRANSPORT: ['తరలింపు కావాలి', 'Need evacuation'],
    OTHER: ['ఇతర', 'Something else'],
    error_send: ['పంపలేకపోయాం: {e}', 'Could not send: {e}'],
  };
  const ICONS = {
    ELEC: '<path d="M12 3v18M6 7h12M8 7l-3 6M16 7l3 6M9 21h6"/>',
    TREE: '<path d="M12 21v-7"/><path d="M12 3c-4 0-7 3-7 6.5S8 15 12 15s7-2 7-5.5S16 3 12 3z"/>',
    ROAD: '<path d="M8 21 10 3M16 21 14 3M12 6v2M12 11v2M12 16v2"/>',
    FLOOD: '<path d="M8 10V5h8v5M3 14c3-2 6 2 9 0s6-2 9 0M3 19c3-2 6 2 9 0s6-2 9 0"/>',
    HOUSE: '<path d="M4 11l8-7 8 7M6 10v10h12V10M12 20l-2-4 2-3"/>',
    HEALTH: '<path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z"/>',
    TRANSPORT: '<rect x="5" y="4" width="14" height="13" rx="2"/><path d="M5 12h14"/><circle cx="8.5" cy="19" r="1.5"/><circle cx="15.5" cy="19" r="1.5"/>',
    OTHER: '<circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/>',
  };
  const CATEGORY_ORDER = ['ELEC', 'TREE', 'FLOOD', 'HOUSE', 'ROAD', 'HEALTH', 'TRANSPORT', 'OTHER'];
  const DEFAULT_SEV = { ELEC: 3, TREE: 2, ROAD: 2, FLOOD: 4, HOUSE: 3, HEALTH: 4, TRANSPORT: 3, OTHER: 1 };
  const SOS_TYPES = ['TRAPPED', 'MEDICAL', 'FLOODING', 'FIRE', 'OTHER'];
  const NEEDS = ['elderly', 'pregnant', 'disabled', 'infant', 'dialysis', 'bedridden', 'oxygen'];

  const store = {
    get: (k, d = null) => { try { const v = localStorage.getItem('ss.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem('ss.' + k, JSON.stringify(v)); } catch { /* storage full */ } },
    del: (k) => { try { localStorage.removeItem('ss.' + k); } catch { /* ignore */ } },
  };

  const state = {
    lang: store.get('lang', 'te'),
    online: navigator.onLine,
    config: store.get('config', { signing_secret: '', sms_number: '', ai_photo_check: false }),
    places: store.get('places', []),
    pos: store.get('lastPos', null),
    watchId: null, stream: null, shot: null, category: null, aiTried: false,
    relayIndex: 0, scanTimer: null, sosPing: null, flashTimer: null, siren: null, rec: null,
  };

  // ---------------------------------------------------------------- language
  function t(key, vars = {}, lang = state.lang) {
    const pair = STR[key] || [key, key];
    let s = pair[lang === 'te' ? 0 : 1];
    for (const [k, v] of Object.entries(vars)) s = s.replace('{' + k + '}', v);
    return s;
  }
  function bi(key, vars) {
    const other = state.lang === 'te' ? 'en' : 'te';
    return `<span class="bi"><span>${esc(t(key, vars))}</span><span lang="${other}">${esc(t(key, vars, other))}</span></span>`;
  }
  function applyI18n(root = document) {
    $$('[data-k]', root).forEach((el) => { el.innerHTML = bi(el.dataset.k); });
    document.documentElement.lang = state.lang;
    $('#lang').textContent = state.lang === 'te' ? 'English' : 'తెలుగు';
  }

  // ---------------------------------------------------------------- small helpers
  function toast(msg, ms = 3500) {
    const el = document.createElement('div');
    el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = msg;
    document.body.appendChild(el); setTimeout(() => el.remove(), ms);
  }
  function uid() {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    return [...bytes].map((b) => abc[b % abc.length]).join('');
  }
  function digits(p) { const d = String(p || '').replace(/\D/g, ''); return d.length > 10 && d.startsWith('91') ? d.slice(-10) : d; }
  function haversine(a, b, c, d) {
    const R = 6371000, r = Math.PI / 180, dp = (c - a) * r, dl = (d - b) * r;
    const x = Math.sin(dp / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dl / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  const istFmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const istTime = (d = new Date()) => istFmt.format(d) + ' IST';
  function istHHMM(d = new Date()) {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
    return p.find((x) => x.type === 'hour').value + p.find((x) => x.type === 'minute').value;
  }
  function shortTime(iso) { return iso ? istFmt.format(new Date(iso)) : ''; }

  async function api(path, opts = {}, timeoutMs = 12000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(path, { ...opts, signal: ctrl.signal });
      const body = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
      if (!res.ok) {
        const err = new Error(typeof body === 'object' ? (body.detail?.[0]?.msg || body.detail || res.statusText) : res.statusText);
        err.status = res.status; throw err;
      }
      return body;
    } finally { clearTimeout(timer); }
  }
  const postJSON = (path, data, timeoutMs) => api(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }, timeoutMs);

  // ---------------------------------------------------------------- IndexedDB (queue of unsent items, relays, my tickets)
  const idb = (() => {
    let dbp;
    function open() {
      dbp = dbp || new Promise((resolve, reject) => {
        const req = indexedDB.open('sahaya-setu', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          db.createObjectStore('queue', { keyPath: 'id' });
          db.createObjectStore('relay', { keyPath: 'code' });
          db.createObjectStore('tickets', { keyPath: 'code' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return dbp;
    }
    async function tx(storeName, mode, fn) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const result = fn(t.objectStore(storeName));
        t.oncomplete = () => resolve(result && 'result' in result ? result.result : result);
        t.onerror = () => reject(t.error);
      });
    }
    return {
      put: (s, v) => tx(s, 'readwrite', (os) => os.put(v)),
      get: (s, k) => tx(s, 'readonly', (os) => os.get(k)),
      del: (s, k) => tx(s, 'readwrite', (os) => os.delete(k)),
      all: (s) => tx(s, 'readonly', (os) => os.getAll()),
    };
  })();

  // ---------------------------------------------------------------- network status and sync
  async function checkOnline() {
    if (!navigator.onLine) return setOnline(false);
    try { await api('/health', { cache: 'no-store' }, 4000); return setOnline(true); } catch { return setOnline(false); }
  }
  function setOnline(v) { state.online = v; renderNet(); return v; }
  async function renderNet() {
    const q = (await idb.all('queue')).length + (await idb.all('relay')).length;
    const el = $('#net');
    el.classList.toggle('off', !state.online);
    el.textContent = (state.online ? t('online') : t('offline')) + (q ? ' · ' + t('waiting_n', { n: q }) : '');
  }

  async function uploadReport(meta, photo) {
    const fd = new FormData();
    fd.append('meta', JSON.stringify(meta));
    if (photo) fd.append('photo', photo, 'photo.jpg');
    return api('/reports', { method: 'POST', body: fd }, 30000);
  }
  async function sendItem(item) {
    if (item.kind === 'report') return uploadReport(item.meta, item.photo);
    if (item.kind === 'sos') return postJSON('/sos', item.meta);
    if (item.kind === 'voice') return postJSON('/voice/transcript', item.meta);
    if (item.kind === 'register') return postJSON('/citizens/register', item.meta);
    throw new Error('unknown item');
  }
  async function saveTicket(res, item) {
    if (!res?.ticket_code) return;
    await idb.put('tickets', {
      code: res.ticket_code, id: res.incident_id, kind: item.kind,
      category: item.meta?.category || item.meta?.sos_type || '', created: item.created || Date.now(), decision: res.decision,
    });
  }

  // Items being sent right now: never send the same report twice at the same moment.
  const inflight = new Set();
  async function sendOnce(item, fn) {
    if (inflight.has(item.id)) return null;
    inflight.add(item.id);
    try { return await fn(); } finally { inflight.delete(item.id); }
  }

  let syncing = false;
  async function syncAll() {
    if (syncing) return;
    syncing = true;
    try {
      if (!(await checkOnline())) return;
      for (const item of await idb.all('queue')) {
        if (inflight.has(item.id)) continue;
        try {
          const res = await sendOnce(item, () => sendItem(item));
          if (!res) continue;
          await idb.del('queue', item.id);
          await saveTicket(res, item);
          if (item.kind === 'sos') adoptSentSOS(item, res);
          if (item.kind === 'report' && res?.ticket_code) toast(`${res.ticket_code}: ${t('sent_title')}`);
        } catch (e) {
          if (e.status && e.status >= 400 && e.status < 500 && ![408, 429].includes(e.status)) await idb.del('queue', item.id);
          else break; // network problem: try again later
        }
      }
      const relays = await idb.all('relay');
      if (relays.length) {
        const res = await postJSON('/mesh/relay', { relayed_by: digits(profile().phone) || null, messages: relays.map((r) => r.code) });
        for (const r of relays) await idb.del('relay', r.code);
        toast(`${res.processed} → ${t('online')}`);
      }
    } catch { /* stay quiet, next attempt soon */ } finally {
      syncing = false;
      renderNet();
    }
  }

  // ---------------------------------------------------------------- config, places, location
  async function loadConfig() {
    try { state.config = await api('/app/config', {}, 6000); store.set('config', state.config); } catch { /* use cached */ }
    if (!state.places.length || Math.random() < 0.1) {
      try { state.places = await api('/geo/places', {}, 8000); store.set('places', state.places); } catch { /* cached */ }
    }
  }
  function nearestPlaceText(lat, lon) {
    let best = null;
    for (const p of state.places) {
      const d = haversine(lat, lon, p.lat, p.lon);
      if (!best || d < best.d) best = { p, d };
    }
    if (!best) return '';
    return (best.d < 1500 ? 'At ' : `${(best.d / 1000).toFixed(1)} km from `) + `${best.p.name}, ${best.p.district} district`;
  }
  function savePos(p) {
    state.pos = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, at: Date.now() };
    store.set('lastPos', state.pos);
    return state.pos;
  }
  function watchLocation(onFix) {
    stopWatch();
    if (!('geolocation' in navigator)) return;
    state.watchId = navigator.geolocation.watchPosition(
      (p) => { const prev = state.pos; savePos(p); if (onFix) onFix(state.pos, prev); },
      () => { if (onFix) onFix(null); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
  }
  function stopWatch() { if (state.watchId !== null) navigator.geolocation.clearWatch(state.watchId); state.watchId = null; }
  function freshPos(maxAgeMs = 120000) { return state.pos && Date.now() - state.pos.at < maxAgeMs ? state.pos : null; }
  function quickPosition(timeout = 8000) {
    return new Promise((resolve) => {
      if (!('geolocation' in navigator)) return resolve(null);
      navigator.geolocation.getCurrentPosition((p) => resolve(savePos(p)), () => resolve(null),
        { enableHighAccuracy: true, maximumAge: 30000, timeout });
    });
  }
  async function battery() {
    try { const b = await navigator.getBattery(); return Math.round(b.level * 100); } catch { return null; }
  }

  // ---------------------------------------------------------------- coded message (same format as app/sms.py)
  function coded({ sos = false, category, sev = 3, people = 0, pos, battery: bat, id, phone }) {
    const parts = [sos ? 'SOS' : 'SS', category];
    if (!sos) parts.push('SEV' + sev);
    parts.push('PPL' + people);
    if (pos) parts.push(pos.lat.toFixed(6) + ',' + pos.lon.toFixed(6));
    if (pos?.acc != null) parts.push('ACC' + Math.round(pos.acc));
    if (bat != null) parts.push('BAT' + bat);
    parts.push(istHHMM(), 'ID' + id);
    if (phone) parts.push('PH' + phone);
    return parts.join('|');
  }
  function smsHref(body, to = state.config.sms_number) {
    return to ? `sms:${to}?body=${encodeURIComponent(body)}` : '';
  }

  // ---------------------------------------------------------------- photo signing
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  async function sha256Hex(blob) { return hex(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())); }
  async function hmacHex(secret, msg) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return hex(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
  }

  // ---------------------------------------------------------------- profile
  const profile = () => store.get('profile', {});

  // ---------------------------------------------------------------- router
  const LEAVE = { report: () => { stopCamera(); stopWatch(); }, relay: () => stopScan(), speak: () => stopListening() };
  let current = null;
  function route() {
    const [name, arg] = (location.hash.replace(/^#\/?/, '') || 'home').split('/');
    const screen = $('#s-' + name) ? name : 'home';
    if (current && LEAVE[current] && current !== screen) LEAVE[current]();
    if (screen !== 'sos-active') stopFlash();
    $$('.screen').forEach((s) => { s.hidden = s.id !== 's-' + screen; });
    current = screen;
    window.scrollTo(0, 0);
    const enter = { home: renderHome, report: enterCamera, review: enterReview, sos: enterSOS, 'sos-active': renderActiveSOS,
      speak: enterSpeak, tickets: renderTickets, ticket: () => renderTicket(arg), relay: enterRelay, profile: renderProfile };
    if (enter[screen]) enter[screen]();
  }
  const go = (h) => { if (location.hash === '#/' + h) route(); else location.hash = '#/' + h; };

  // ---------------------------------------------------------------- home + alerts
  async function renderHome() {
    const hint = $('#sos-open [data-k]');
    hint.dataset.k = store.get('activeSOS') ? 'sos_sent' : 'sos_open_hint';
    hint.innerHTML = bi(hint.dataset.k);
    renderAlerts(store.get('alerts', []));
    if (state.online) {
      try {
        const p = state.pos;
        const q = p ? `?lat=${p.lat}&lon=${p.lon}` : '';
        const alerts = await api('/alerts/active' + q, {}, 6000);
        store.set('alerts', alerts);
        renderAlerts(alerts);
      } catch { /* keep cached */ }
    }
  }
  function renderAlerts(alerts) {
    $('#alerts').innerHTML = (alerts || []).slice(0, 2).map((a) => {
      const msg = state.lang === 'te' && a.message_te ? a.message_te : a.message;
      const shelters = (a.nearest_shelters || []).map((s) => `
        <div class="shelter"><div><b>${esc(state.lang === 'te' && s.name_te ? s.name_te : s.name)}</b>
          <span>${esc(t('km_dir', { d: s.distance_km, dir: s.direction || '' }))}</span></div>
          <a class="btn small" href="geo:${s.lat},${s.lon}?q=${s.lat},${s.lon}(${encodeURIComponent(s.name)})">${esc(t('directions'))}</a></div>`).join('');
      return `<article class="alert lv-${esc(a.level)}" role="alert">
        <div class="alert-head"><span>${esc(t('lv_' + a.level))}</span><span>${esc(a.hazard || '')}</span></div>
        <div class="alert-body"><h3>${esc(a.title)}</h3><p>${esc(msg)}</p>
        ${shelters ? `<h3>${esc(t('shelter'))}</h3>${shelters}` : ''}</div></article>`;
    }).join('');
  }

  // ---------------------------------------------------------------- camera report
  async function startCamera(video) {
    stopCamera();
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    video.srcObject = state.stream;
    await video.play().catch(() => {});
  }
  function stopCamera() { state.stream?.getTracks().forEach((tr) => tr.stop()); state.stream = null; }

  let addressCache = { key: '', text: '' };
  async function addressFor(pos) {
    const key = pos.lat.toFixed(4) + ',' + pos.lon.toFixed(4);
    if (addressCache.key === key) return addressCache.text;
    let text = '';
    if (state.online) {
      try { text = (await api(`/geo/reverse?lat=${pos.lat}&lon=${pos.lon}`, {}, 3000)).address || ''; } catch { /* offline */ }
    }
    text = text || nearestPlaceText(pos.lat, pos.lon);
    addressCache = { key, text };
    return text;
  }
  function gpsPill(pos) {
    const el = $('#gps-pill');
    if (!pos) { el.className = 'gps bad'; el.textContent = state.watchId === null ? t('gps_off') : t('finding_gps'); return; }
    el.className = 'gps ' + (pos.acc <= 30 ? 'good' : pos.acc <= 100 ? '' : 'bad');
    el.textContent = t('gps_acc', { n: Math.round(pos.acc) });
  }
  function stampLines(pos, address, id) {
    return [
      istTime(),
      pos ? `${pos.lat.toFixed(6)}, ${pos.lon.toFixed(6)}  ±${Math.round(pos.acc)} m` : 'Location not available',
      address || '',
      `Sahaya Setu  ID ${id}`,
    ].filter(Boolean);
  }

  async function enterCamera() {
    state.draftId = uid();
    state.shot = null; state.category = null; state.aiTried = false;
    const video = $('#video'), msg = $('#cam-msg');
    msg.hidden = true;
    gpsPill(freshPos(30000));
    const refreshStamp = async () => {
      const pos = freshPos(30000);
      const address = pos ? await addressFor(pos) : '';
      $('#stamp-preview').textContent = stampLines(pos, address, state.draftId).join('\n');
    };
    watchLocation((pos) => { gpsPill(pos); refreshStamp(); });
    refreshStamp();
    try {
      await startCamera(video);
      $('#shutter').disabled = false;
    } catch {
      msg.textContent = t('camera_denied'); msg.hidden = false; $('#shutter').disabled = true;
    }
  }

  async function capture() {
    const video = $('#video');
    if (!video.videoWidth) return;
    $('#shutter').disabled = true;
    const pos = freshPos(60000);
    const address = pos ? await addressFor(pos) : '';
    const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
    const w = Math.round(video.videoWidth * scale), h = Math.round(video.videoHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const g = canvas.getContext('2d');
    g.drawImage(video, 0, 0, w, h);
    const lines = stampLines(pos, address, state.draftId);
    const fs = Math.max(14, Math.round(w / 44)), pad = Math.round(fs * 0.6), lh = fs * 1.3;
    const bh = Math.round(lines.length * lh + pad * 2);
    g.fillStyle = 'rgba(15,49,102,0.82)'; g.fillRect(0, h - bh, w, bh);
    g.fillStyle = '#f2c230'; g.fillRect(0, h - bh, Math.round(fs * 0.4), bh);
    g.fillStyle = '#ffffff'; g.textBaseline = 'top';
    g.font = `600 ${fs}px "Hind Guntur", sans-serif`;
    lines.forEach((line, i) => g.fillText(line, pad + fs * 0.6, h - bh + pad + i * lh, w - pad * 2 - fs));
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    state.shot = { blob, url: URL.createObjectURL(blob), pos, address, capturedAt: new Date().toISOString() };
    stopCamera();
    go('review');
  }

  function catButton(code) {
    return `<button type="button" class="cat" role="radio" aria-checked="${state.category === code}" data-cat="${code}">
      <svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[code]}</svg>${bi(code)}</button>`;
  }
  function renderCats() { $('#cats').innerHTML = CATEGORY_ORDER.map(catButton).join(''); $('#send-report').disabled = !state.category; }

  async function enterReview() {
    if (!state.shot) return go('report');
    $('#shot').src = state.shot.url;
    $('#ai-hint').hidden = true;
    renderCats();
    if (!state.aiTried && state.config.ai_photo_check && state.online) {
      state.aiTried = true;
      try {
        const fd = new FormData(); fd.append('photo', state.shot.blob, 'photo.jpg');
        const r = await api('/ai/classify-photo', { method: 'POST', body: fd }, 15000);
        const s = r.suggestion;
        if (s && !state.category) {
          state.category = s.category;
          renderCats();
          if (s.people_visible) setStepper('people', s.people_visible);
          const summary = state.lang === 'te' ? (s.summary_te || s.summary_en) : s.summary_en;
          $('#ai-hint').textContent = t('ai_suggest', { c: t(s.category) }) + (summary ? ' — ' + summary : '');
          $('#ai-hint').hidden = false;
        }
      } catch { /* AI is optional */ }
    }
  }

  async function sendReport() {
    const shot = state.shot;
    if (!shot || !state.category) return;
    const btn = $('#send-report');
    btn.disabled = true; btn.innerHTML = bi('sending');
    const p = profile();
    const phone = digits(p.phone);
    const sev = Math.min(5, (state.config.categories?.[state.category]?.severity || DEFAULT_SEV[state.category]) + ($('#danger').checked ? 1 : 0));
    const people = getStepper('people');
    const pos = shot.pos;
    const meta = {
      client_report_id: state.draftId, channel: 'app', phone: phone || null,
      lat: pos ? +pos.lat.toFixed(6) : null, lon: pos ? +pos.lon.toFixed(6) : null, gps_accuracy_m: pos ? Math.round(pos.acc) : null,
      captured_at: shot.capturedAt, address: shot.address || null, category: state.category, severity: sev,
      people_count: people, description: $('#note').value.trim() || null, is_mocked: false,
    };
    try {
      if (crypto.subtle && state.config.signing_secret && pos) {
        const sha = await sha256Hex(shot.blob);
        meta.signature = await hmacHex(state.config.signing_secret, `${sha}|${meta.lat.toFixed(6)}|${meta.lon.toFixed(6)}|${meta.captured_at}`);
      }
    } catch { /* not a secure context: send unsigned */ }
    const item = { id: state.draftId, kind: 'report', meta, photo: shot.blob, created: Date.now(),
      coded: coded({ category: state.category, sev, people, pos, id: state.draftId, phone }) };
    await idb.put('queue', item);
    let res = null;
    if (await checkOnline()) {
      try { res = await sendOnce(item, () => uploadReport(meta, shot.blob)); if (res) { await idb.del('queue', item.id); await saveTicket(res, item); } } catch (e) {
        if (e.status && e.status < 500) { await idb.del('queue', item.id); toast(t('error_send', { e: e.message })); btn.disabled = false; btn.innerHTML = bi('send'); return; }
      }
    }
    $('#note').value = ''; $('#danger').checked = false; setStepper('people', 0);
    state.shot = null;
    showResult(res, item);
    renderNet();
  }

  function showResult(res, item) {
    const box = $('#result');
    if (res) {
      const title = res.decision === 'merge' ? bi('merged_title', { n: res.report_count }) : bi('sent_title');
      const body = res.decision === 'merge' ? bi('merged_body') : res.status === 'review' ? bi('review_body') : '';
      box.className = 'result';
      box.innerHTML = `<h1>${title}</h1><p class="ticket-code">${esc(res.ticket_code)}</p>${body ? `<p>${body}</p>` : ''}
        <p>${profile().phone ? bi('updates_sms') : bi('need_phone')}</p>
        <a class="btn" href="#/ticket/${esc(res.ticket_code)}">${bi('tickets')}</a>
        <a class="btn ghost" href="#/home">${bi('home')}</a>`;
    } else {
      const href = smsHref(item.coded);
      box.className = 'result queued';
      box.innerHTML = `<h1>${bi('queued_title')}</h1><p>${bi('queued_body')}</p>
        ${href ? `<a class="btn" href="${esc(href)}">${bi('send_sms')}</a>` : `<p class="warn">${bi('no_sms_number')}</p>`}
        <a class="btn ghost" href="#/relay">${bi('show_qr')}</a>
        <a class="btn ghost" href="#/home">${bi('home')}</a>`;
    }
    go('result');
  }

  // ---------------------------------------------------------------- steppers
  function initSteppers() {
    $$('[data-stepper]').forEach((el) => {
      el.innerHTML = `<button type="button" aria-label="minus">−</button><output>${el.dataset.value}</output><button type="button" aria-label="plus">+</button>`;
      const [minus, , plus] = el.children;
      minus.onclick = () => setStepper(el.dataset.stepper, getStepper(el.dataset.stepper) - 1);
      plus.onclick = () => setStepper(el.dataset.stepper, getStepper(el.dataset.stepper) + 1);
    });
  }
  function getStepper(name) { return +$(`[data-stepper="${name}"]`).dataset.value; }
  function setStepper(name, v) {
    const el = $(`[data-stepper="${name}"]`);
    v = Math.max(+el.dataset.min, Math.min(+el.dataset.max, v));
    el.dataset.value = v; el.querySelector('output').textContent = v;
  }

  // ---------------------------------------------------------------- SOS
  let sosType = 'TRAPPED';
  function enterSOS() {
    if (store.get('activeSOS')) return go('sos-active');
    $('#sos-types').innerHTML = SOS_TYPES.map((k) => `<button type="button" class="chip" role="radio" aria-checked="${k === sosType}" data-sos="${k}">${bi(k === 'OTHER' ? 'OTHER_SOS' : k)}</button>`).join('');
    watchLocation();
    quickPosition();
  }

  function initHold() {
    const btn = $('#hold');
    let start = 0, raf = 0;
    const tick = () => {
      const p = Math.min(100, ((performance.now() - start) / 3000) * 100);
      btn.style.setProperty('--p', p.toFixed(1));
      if (p >= 100) { stop(false); startCountdown(); } else raf = requestAnimationFrame(tick);
    };
    const begin = (e) => { e.preventDefault(); start = performance.now(); raf = requestAnimationFrame(tick); };
    const stop = (reset = true) => { cancelAnimationFrame(raf); if (reset) btn.style.setProperty('--p', 0); };
    btn.addEventListener('pointerdown', begin);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, () => stop()));
    btn.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) begin(e); });
    btn.addEventListener('keyup', () => stop());
  }

  let countTimer = null;
  function startCountdown() {
    const box = $('#countdown');
    let n = 5;
    const show = () => { $('#count-n').textContent = n; $('#count-text').innerHTML = bi('sending_in', { n }); };
    box.hidden = false; show();
    $('#hold').style.setProperty('--p', 0);
    countTimer = setInterval(() => {
      n -= 1;
      if (n <= 0) { clearInterval(countTimer); box.hidden = true; sendSOS(); } else show();
    }, 1000);
  }
  function cancelCountdown() { clearInterval(countTimer); $('#countdown').hidden = true; }

  async function sendSOS() {
    const p = profile();
    const pos = freshPos(120000) || (await quickPosition(5000));
    const bat = await battery();
    const id = uid();
    const people = getStepper('sos-people');
    const meta = {
      client_report_id: id, phone: digits(p.phone) || null, lat: pos ? +pos.lat.toFixed(6) : null, lon: pos ? +pos.lon.toFixed(6) : null,
      gps_accuracy_m: pos ? Math.round(pos.acc) : null, captured_at: new Date().toISOString(), sos_type: sosType,
      people_count: people, battery_pct: bat, medical_notes: p.medical_notes || null, is_mocked: false,
    };
    const item = { id, kind: 'sos', meta, created: Date.now(),
      coded: coded({ sos: true, category: sosType, people, pos, battery: bat, id, phone: digits(p.phone) }) };
    await idb.put('queue', item);
    store.set('activeSOS', { id, sent: false, code: null, incidentId: null, ack: false, started: Date.now(), coded: item.coded, lastUpdate: null });
    go('sos-active');
    if (await checkOnline()) {
      try {
        const res = await sendOnce(item, () => postJSON('/sos', meta, 10000));
        if (res) { await idb.del('queue', id); await saveTicket(res, item); adoptSentSOS(item, res); }
      } catch { /* stays queued */ }
    }
    renderActiveSOS(); renderNet();
  }
  function adoptSentSOS(item, res) {
    const a = store.get('activeSOS');
    if (!a || a.id !== item.id) return;
    Object.assign(a, { sent: true, code: res.ticket_code, incidentId: res.incident_id, lastUpdate: Date.now() });
    store.set('activeSOS', a);
    if (current === 'sos-active') renderActiveSOS();
  }

  function renderActiveSOS() {
    const a = store.get('activeSOS');
    if (!a) return go('home');
    const box = $('#sos-status');
    box.classList.toggle('ack', !!a.ack);
    box.innerHTML = a.sent
      ? `<h1>${bi(a.ack ? 'help_coming' : 'sos_sent')}</h1><p class="ticket-code">${esc(a.code)}</p>
         <p>${a.ack ? '' : bi('waiting_control')}</p>${a.lastUpdate ? `<small>${esc(t('last_update', { t: shortTime(new Date(a.lastUpdate).toISOString()) }))}</small>` : ''}`
      : `<h1>${bi('sos_saved')}</h1><p>${bi('sos_saved_help')}</p>`;
    const smsLink = $('#sos-sms');
    const href = smsHref(a.coded);
    smsLink.hidden = !href; if (href) smsLink.href = href;
    const contacts = (profile().contacts || []).map(digits).filter(Boolean);
    const pos = state.pos;
    const famBody = `${t('family_sms')} ${pos ? `https://maps.google.com/?q=${pos.lat.toFixed(6)},${pos.lon.toFixed(6)}` : ''} ${a.code || ''}`.trim();
    const fam = $('#sos-family');
    fam.hidden = !contacts.length;
    if (contacts.length) fam.href = `sms:${contacts.join(',')}?body=${encodeURIComponent(famBody)}`;
    startSOSPings();
  }

  function startSOSPings() {
    if (state.sosPing) return;
    const ping = async () => {
      const a = store.get('activeSOS');
      if (!a) return stopSOSPings();
      if (!a.sent) { syncAll(); return; }
      const pos = (await quickPosition(8000)) || state.pos;
      try {
        const r = await postJSON('/sos/update', { client_report_id: a.id, lat: pos ? +pos.lat.toFixed(6) : null, lon: pos ? +pos.lon.toFixed(6) : null,
          gps_accuracy_m: pos ? Math.round(pos.acc) : null, battery_pct: await battery() }, 10000);
        Object.assign(a, { ack: r.acknowledged, lastUpdate: Date.now() });
        store.set('activeSOS', a);
        if (current === 'sos-active') renderActiveSOS();
      } catch { /* try again next round */ }
    };
    ping();
    state.sosPing = setInterval(ping, 180000);
  }
  function stopSOSPings() { clearInterval(state.sosPing); state.sosPing = null; }

  function toggleFlash() {
    if (state.flashTimer) return stopFlash();
    const el = $('#flash'); el.hidden = false;
    let red = false;
    state.flashTimer = setInterval(() => { red = !red; el.classList.toggle('red', red); }, 500);
    el.onclick = stopFlash;
  }
  function stopFlash() { clearInterval(state.flashTimer); state.flashTimer = null; const el = $('#flash'); if (el) el.hidden = true; }
  function toggleSiren() {
    if (state.siren) { state.siren.ctx.close(); state.siren = null; return; }
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator(), gain = ctx.createGain(), lfo = ctx.createOscillator(), lfoGain = ctx.createGain();
    osc.type = 'square'; osc.frequency.value = 900; lfo.frequency.value = 1.2; lfoGain.gain.value = 350; gain.gain.value = 0.25;
    lfo.connect(lfoGain); lfoGain.connect(osc.frequency); osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); lfo.start();
    state.siren = { ctx };
  }
  function endSOS() {
    stopSOSPings(); stopFlash(); if (state.siren) toggleSiren();
    store.del('activeSOS');
    toast(t('thanks'));
    go('home');
  }

  // ---------------------------------------------------------------- speak
  function enterSpeak() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    $('#speech-unsupported').hidden = !!SR;
    $('#mic').hidden = !SR;
    $('#mic').innerHTML = bi('start_listen');
    quickPosition(6000);
  }
  function toggleListening() {
    if (state.rec) return stopListening();
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = state.lang === 'te' ? 'te-IN' : 'en-IN';
    rec.interimResults = true; rec.continuous = true;
    const area = $('#speech-text');
    const base = area.value ? area.value + ' ' : '';
    rec.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      area.value = base + text;
    };
    rec.onend = () => { state.rec = null; $('#mic').innerHTML = bi('start_listen'); };
    rec.onerror = () => rec.onend();
    rec.start();
    state.rec = rec;
    $('#mic').innerHTML = bi('stop_listen');
  }
  function stopListening() { try { state.rec?.stop(); } catch { /* ignore */ } state.rec = null; }

  async function sendSpeech() {
    const text = $('#speech-text').value.trim();
    if (!text) return toast(t('empty_text'));
    stopListening();
    const pos = freshPos(300000);
    const id = uid();
    const item = { id, kind: 'voice', created: Date.now(), coded: null, meta: {
      phone: digits(profile().phone) || null, text, language: state.lang,
      lat: pos ? +pos.lat.toFixed(6) : null, lon: pos ? +pos.lon.toFixed(6) : null, gps_accuracy_m: pos ? Math.round(pos.acc) : null } };
    await idb.put('queue', item);
    let res = null;
    if (await checkOnline()) {
      try { res = await sendOnce(item, () => postJSON('/voice/transcript', item.meta)); if (res) { await idb.del('queue', id); await saveTicket(res, item); } } catch { /* queued */ }
    }
    $('#speech-text').value = '';
    if (res) showResult(res, item);
    else {
      item.coded = text; // free text works by SMS too (the server reads Telugu and English)
      showResult(null, item);
    }
    renderNet();
  }

  // ---------------------------------------------------------------- tickets
  async function renderTickets() {
    const pending = await idb.all('queue');
    $('#pending-list').innerHTML = pending.length ? `<p class="pending">${bi('pending_n', { n: pending.length })}</p>` : '';
    const list = (await idb.all('tickets')).sort((a, b) => b.created - a.created);
    const ul = $('#ticket-list');
    if (!list.length) { ul.innerHTML = `<li>${bi('tickets_empty')}</li>`; return; }
    ul.innerHTML = list.map((tk) => `<li><a href="#/ticket/${esc(tk.code)}"><b>${esc(tk.code)}</b>
      <span class="pill st-${esc(tk.status || 'received')}">${esc(t('st_' + (tk.status || 'received')))}</span>
      <span>${esc(STR[tk.category] ? t(tk.category) : tk.category)}</span>
      <span>${esc(shortTime(new Date(tk.created).toISOString()))}</span></a></li>`).join('');
    if (state.online || (await checkOnline())) {
      for (const tk of list.slice(0, 15)) {
        try { const d = await api('/track/' + tk.code, {}, 6000); tk.status = d.status; await idb.put('tickets', tk); } catch { /* skip */ }
      }
      if (current === 'tickets') {
        ul.querySelectorAll('a').forEach((a, i) => {
          const s = list[i].status || 'received';
          const pill = a.querySelector('.pill'); pill.className = 'pill st-' + s; pill.textContent = t('st_' + s);
        });
      }
    }
  }
  async function renderTicket(code) {
    const box = $('#ticket-detail');
    box.innerHTML = `<h1>${esc(code)}</h1>`;
    try {
      const d = await api('/track/' + encodeURIComponent(code), {}, 8000);
      const local = await idb.get('tickets', d.ticket_code);
      if (local) { local.status = d.status; await idb.put('tickets', local); }
      box.innerHTML = `<h1>${esc(d.ticket_code)}</h1>
        <p><span class="pill st-${esc(d.status)}">${esc(t('st_' + d.status))}</span> ${esc(d.department_name)}</p>
        ${d.address ? `<p>${esc(d.address)}</p>` : ''}<p>${esc(t('reported', { n: d.report_count }))}</p>
        ${d.waiting_for_confirmation ? `<div class="confirm"><h2>${bi('is_fixed')}</h2>
          <div class="row"><button class="btn ok" data-fixed="1" type="button">${bi('yes_fixed')}</button>
          <button class="btn danger" data-fixed="0" type="button">${bi('not_fixed')}</button></div></div>` : ''}
        ${d.resolution_photo_url ? `<h2>${bi('proof')}</h2><img src="${esc(d.resolution_photo_url)}" alt="">` : ''}
        <ol class="timeline">${d.timeline.slice().reverse().map((e) => `<li><b>${esc(t('st_' + e.status))}</b>
          <time>${esc(shortTime(e.at))}</time>${esc(e.note || '')}</li>`).join('')}</ol>`;
      $$('[data-fixed]', box).forEach((b) => b.onclick = async () => {
        try {
          await postJSON(`/incidents/${d.id}/confirm`, { fixed: b.dataset.fixed === '1', phone: digits(profile().phone) || null });
          toast(t('thanks')); renderTicket(code);
        } catch (e) { toast(t('error_send', { e: e.message })); }
      });
    } catch (e) {
      box.innerHTML += `<p class="warn">${bi('offline')}</p>`;
    }
  }

  // ---------------------------------------------------------------- relay by QR (phone without signal → phone with signal)
  async function enterRelay() { showMyCodes(); }
  async function showMyCodes() {
    stopScan();
    $('#relay-show').className = 'btn'; $('#relay-scan').className = 'btn ghost';
    const codes = (await idb.all('queue')).filter((i) => i.coded && /^(SS|SOS)\|/.test(i.coded)).map((i) => i.coded);
    const body = $('#relay-body');
    if (!codes.length) { body.innerHTML = `<p>${bi('nothing_pending')}</p>`; return; }
    state.relayIndex = Math.min(state.relayIndex, codes.length - 1);
    const qr = qrcode(0, 'M'); qr.addData(codes[state.relayIndex]); qr.make();
    body.innerHTML = `<div class="qr-box">${qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true })}
      ${codes.length > 1 ? `<div class="qr-nav"><button class="btn small ghost" id="qr-prev" type="button">${esc(t('prev'))}</button>
      <span>${esc(t('qr_n', { i: state.relayIndex + 1, n: codes.length }))}</span>
      <button class="btn small ghost" id="qr-next" type="button">${esc(t('next'))}</button></div>` : ''}</div>`;
    if (codes.length > 1) {
      $('#qr-prev').onclick = () => { state.relayIndex = (state.relayIndex - 1 + codes.length) % codes.length; showMyCodes(); };
      $('#qr-next').onclick = () => { state.relayIndex = (state.relayIndex + 1) % codes.length; showMyCodes(); };
    }
  }
  async function startScan() {
    $('#relay-show').className = 'btn ghost'; $('#relay-scan').className = 'btn';
    const body = $('#relay-body');
    body.innerHTML = `<div class="scan"><p>${bi('scanning')}</p><video id="scan-video" playsinline muted></video></div>`;
    const video = $('#scan-video');
    try { await startCamera(video); } catch { body.innerHTML = `<p class="warn">${bi('camera_denied')}</p>`; return; }
    const canvas = document.createElement('canvas');
    const g = canvas.getContext('2d', { willReadFrequently: true });
    state.scanTimer = setInterval(async () => {
      if (!video.videoWidth) return;
      const scale = Math.min(1, 640 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
      g.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = g.getImageData(0, 0, canvas.width, canvas.height);
      const found = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
      if (found && /^(SS|SOS)\|/.test(found.data)) {
        if (await idb.get('relay', found.data)) { toast(t('already_relay')); return; }
        await idb.put('relay', { code: found.data, at: Date.now() });
        if (navigator.vibrate) navigator.vibrate(200);
        toast(t('got_relay'));
        renderNet();
        syncAll();
      }
    }, 400);
  }
  function stopScan() { clearInterval(state.scanTimer); state.scanTimer = null; stopCamera(); }

  // ---------------------------------------------------------------- profile
  function renderProfile() {
    const p = profile();
    const f = $('#profile-form');
    $('#needs').innerHTML = NEEDS.map((n) => `<label class="check"><input type="checkbox" name="need" value="${n}" ${p.needs?.includes(n) ? 'checked' : ''}> ${bi(n)}</label>`).join('');
    f.phone.value = p.phone || ''; f.name.value = p.name || ''; f.village.value = p.village || '';
    f.household_size.value = p.household_size || 1; f.medical_notes.value = p.medical_notes || '';
    f.contacts.value = (p.contacts || []).join(', '); f.consent.checked = !!p.consent;
  }
  async function saveProfile(e) {
    e.preventDefault();
    const f = e.target;
    const p = {
      phone: digits(f.phone.value), name: f.name.value.trim(), village: f.village.value.trim(),
      household_size: Math.max(1, +f.household_size.value || 1), medical_notes: f.medical_notes.value.trim(),
      contacts: f.contacts.value.split(/[,\s]+/).map(digits).filter((x) => x.length >= 10).slice(0, 5),
      needs: $$('input[name="need"]:checked', f).map((x) => x.value), consent: f.consent.checked,
    };
    store.set('profile', p);
    if (p.consent && p.phone.length >= 10) {
      const pos = state.pos;
      await idb.put('queue', { id: 'register', kind: 'register', created: Date.now(), coded: null, meta: {
        phone: p.phone, name: p.name || null, village: p.village || null, household_size: p.household_size,
        needs: p.needs, medical_notes: p.medical_notes || null, family_contacts: p.contacts, consent: true,
        lat: pos ? +pos.lat.toFixed(5) : null, lon: pos ? +pos.lon.toFixed(5) : null } });
      syncAll();
    }
    toast(t('saved'));
    go('home');
  }

  // ---------------------------------------------------------------- wiring
  function bind() {
    $('#lang').onclick = () => { state.lang = state.lang === 'te' ? 'en' : 'te'; store.set('lang', state.lang); applyI18n(); route(); renderNet(); };
    $('#net').onclick = () => syncAll();
    $('#sos-open').onclick = () => go(store.get('activeSOS') ? 'sos-active' : 'sos');
    $('#shutter').onclick = capture;
    $('#cats').onclick = (e) => { const b = e.target.closest('[data-cat]'); if (b) { state.category = b.dataset.cat; renderCats(); } };
    $('#send-report').onclick = sendReport;
    $('#sos-types').onclick = (e) => { const b = e.target.closest('[data-sos]'); if (b) { sosType = b.dataset.sos; $$('.chip').forEach((c) => c.setAttribute('aria-checked', c === b)); } };
    $('#count-cancel').onclick = cancelCountdown;
    $('#sos-flash').onclick = toggleFlash;
    $('#sos-siren').onclick = toggleSiren;
    $('#sos-qr').onclick = () => go('relay');
    $('#sos-safe').onclick = endSOS;
    $('#mic').onclick = toggleListening;
    $('#send-speech').onclick = sendSpeech;
    $('#relay-show').onclick = showMyCodes;
    $('#relay-scan').onclick = startScan;
    $('#profile-form').onsubmit = saveProfile;
    window.addEventListener('hashchange', route);
    window.addEventListener('online', () => syncAll());
    window.addEventListener('offline', () => setOnline(false));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) syncAll(); });
  }

  async function init() {
    applyI18n();
    initSteppers();
    initHold();
    bind();
    route();
    renderNet();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
    await checkOnline();
    if (state.online) { await loadConfig(); renderHome(); }
    syncAll();
    setInterval(syncAll, 30000);
    if (store.get('activeSOS')) startSOSPings();
    try {
      const perm = await navigator.permissions?.query({ name: 'geolocation' });
      if (perm?.state === 'granted') { await quickPosition(8000); if (current === 'home') renderHome(); }
    } catch { /* permissions API missing */ }
  }

  init();
})();
