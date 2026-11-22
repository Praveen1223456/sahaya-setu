import React, { useState, useEffect, useRef } from 'react';

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
  back: ['వెనక్కి', 'Back'],
  retake: ['మళ్ళీ తీయండి', 'Retake'],
  finding_gps: ['స్థానం కనుగొంటోంది…', 'Finding location…'],
  what_problem: ['ఏ సమస్య?', 'What is the problem?'],
  people_affected: ['ఎంతమంది ఇబ్బందిలో ఉన్నారు?', 'How many people are affected?'],
  danger_now: ['ఇప్పుడే ప్రమాదం ఉందా? (కరెంటు తీగ, కూలుతున్న గోడ)', 'Dangerous right now? (live wire, falling wall)'],
  note: ['ఇంకా ఏమైనా (ఐచ్ఛికం)', 'Anything else (optional)'],
  send: ['పంపండి', 'Send'],
  sending: ['పంపుతోంది…', 'Sending…'],
  sent_title: ['మీ ఫిర్యాదు అందింది', 'Your report was received'],
  merged_title: ['ఈ సమస్యను ఇప్పటికే తెలిపిన వారు ఉన్నారు', 'People have reported this problem'],
  send_sms: ['SMS ద్వారా పంపండి', 'Send by SMS'],
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
  cancel: ['రద్దు చేయండి', 'Cancel'],
  sos_sent: ['SOS పంపబడింది', 'SOS sent'],
  call112: ['112 కి కాల్', 'Call 112'],
  im_safe: ['నేను ఇప్పుడు సురక్షితంగా ఉన్నాను', 'I am safe now'],
  speak_title: ['మాట్లాడి చెప్పండి', 'Speak your problem'],
  speak_help: ['ఏం జరిగిందో, మీ గ్రామం పేరు చెప్పండి.', 'Say what happened and the name of your village.'],
  start_listen: ['మాట్లాడటం మొదలుపెట్టండి', 'Start speaking'],
  stop_listen: ['ఆపండి', 'Stop'],
  profile_title: ['నా వివరాలు', 'My details'],
  profile_help: ['తుఫానుకు ముందే ఇవి నింపండి. ఎవరిని ముందుగా తరలించాలో అధికారులకు తెలుస్తుంది.', 'Fill this in before a cyclone, so officials know who to evacuate first.'],
  phone: ['ఫోన్ నంబర్', 'Phone number'],
  name: ['పేరు', 'Name'],
  village: ['గ్రామం', 'Village'],
  size: ['కుటుంబ సభ్యుల సంఖ్య', 'Household size'],
  needs: ['ప్రత్యేక సహాయం కావాల్సిన వారు', 'Special needs in the household'],
  elderly: ['వృద్ధులు (60+)', 'Elderly (60+)'],
  pregnant: ['గర్భిణీలు', 'Pregnant'],
  disabled: ['వికలాంగులు', 'Disabled'],
  infant: ['చిన్న పిల్లలు (0-2)', 'Infant / baby'],
  dialysis: ['డయాలసిస్ / ఆక్సిజన్', 'Dialysis or oxygen needed'],
  bedridden: ['మంచం పట్టిన వారు', 'Bedridden'],
  medical_notes: ['ఆరోగ్య వివరాలు', 'Medical details'],
  family: ['కుటుంబ సభ్యుల ఫోన్ నంబర్లు', 'Family phone numbers'],
  consent: ['ఈ వివరాలను విపత్తు అధికారులతో పంచుకోవడానికి అంగీకరిస్తున్నాను.', 'I agree to share these details with disaster officials.'],
  save: ['భద్రపరచండి', 'Save'],
  saved: ['భద్రపరిచాం', 'Saved'],
};

const CAT_LABELS = {
  ELEC: ['కరెంటు స్తంభం / తీగలు', 'Power pole / wire'],
  TREE: ['చెట్టు కూలింది', 'Fallen tree'],
  ROAD: ['రోడ్డు పాడైంది', 'Road damage'],
  FLOOD: ['వరద నీరు', 'Flood / water'],
  HOUSE: ['ఇల్లు / గోడ కూలింది', 'House damage'],
  HEALTH: ['వైద్య సహాయం', 'Medical help'],
  TRANSPORT: ['బస్సు / రవాణా', 'Transport needed'],
  OTHER: ['ఇతర', 'Other'],
};

export default function CitizenApp() {
  const [lang, setLang] = useState('te'); // 'te' or 'en'
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [screen, setScreen] = useState('home'); // home | report | review | result | sos | speak | tickets | relay | profile
  const [config, setConfig] = useState(null);
  const [alertsList, setAlertsList] = useState([]);
  const [pos, setPos] = useState(null);
  const [address, setAddress] = useState('');

  // Report state
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [photoBlob, setPhotoBlob] = useState(null);
  const [category, setCategory] = useState('ELEC');
  const [peopleCount, setPeopleCount] = useState(0);
  const [danger, setDanger] = useState(false);
  const [note, setNote] = useState('');
  const [lastResult, setLastResult] = useState(null);
  const [isSending, setIsSending] = useState(false);

  // SOS state
  const [sosType, setSosType] = useState('TRAPPED');
  const [sosPeople, setSosPeople] = useState(1);
  const [sosActive, setSosActive] = useState(false);
  const [sosHoldProgress, setSosHoldProgress] = useState(0);
  const holdIntervalRef = useRef(null);

  // Speak state
  const [speakText, setSpeakText] = useState('');
  const [isListening, setIsListening] = useState(false);

  // Profile state
  const [profile, setProfile] = useState({
    phone: '',
    name: '',
    village: '',
    household_size: 1,
    needs: [],
    medical_notes: '',
    family_contacts: '',
    consent: true,
  });

  // Tickets
  const [myTickets, setMyTickets] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ss.myTickets') || '[]');
    } catch {
      return [];
    }
  });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const t = (k) => {
    const idx = lang === 'en' ? 1 : 0;
    return STR[k] ? STR[k][idx] || STR[k][0] : k;
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    fetch('/app/config')
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => {});

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const coords = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy };
          setPos(coords);
          fetch(`/alerts/active?lat=${coords.lat}&lon=${coords.lon}`)
            .then((r) => r.json())
            .then(setAlertsList)
            .catch(() => {});
          fetch(`/geo/reverse?lat=${coords.lat}&lon=${coords.lon}`)
            .then((r) => r.json())
            .then((d) => setAddress(d.address || ''))
            .catch(() => {});
        },
        () => {
          fetch('/alerts/active')
            .then((r) => r.json())
            .then(setAlertsList)
            .catch(() => {});
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      stopCamera();
    };
  }, []);

  // Camera handling
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (e) {
      console.warn('Camera error:', e);
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  function capturePhoto() {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current || document.createElement('canvas');
    c.width = v.videoWidth || 640;
    c.height = v.videoHeight || 480;
    const ctx = c.getContext('2d');
    ctx.drawImage(v, 0, 0, c.width, c.height);

    // Draw GPS & Time Stamp
    const stampText = `${new Date().toLocaleTimeString()} ${pos ? `${pos.lat.toFixed(5)},${pos.lon.toFixed(5)}` : ''} ${address || ''}`.trim();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, c.height - 36, c.width, 36);
    ctx.fillStyle = '#fff';
    ctx.font = '16px Hind Guntur, sans-serif';
    ctx.fillText(stampText, 12, c.height - 12);

    const dataUrl = c.toDataURL('image/jpeg', 0.85);
    setCapturedPhoto(dataUrl);

    c.toBlob(
      (blob) => {
        setPhotoBlob(blob);
      },
      'image/jpeg',
      0.85
    );

    stopCamera();
    setScreen('review');
  }

  async function sendReport() {
    setIsSending(true);
    const meta = {
      category,
      people_count: peopleCount,
      severity: danger ? 4 : 3,
      description: note,
      lat: pos?.lat || null,
      lon: pos?.lon || null,
      gps_accuracy_m: pos?.acc || null,
      address,
      phone: profile.phone || null,
      captured_at: new Date().toISOString(),
    };

    try {
      const fd = new FormData();
      fd.append('meta', JSON.stringify(meta));
      if (photoBlob) {
        fd.append('photo', photoBlob, 'photo.jpg');
      }

      const res = await fetch('/reports', { method: 'POST', body: fd }).then((r) => r.json());
      setLastResult(res);

      if (res.ticket_code) {
        const updated = [res.ticket_code, ...myTickets.filter((x) => x !== res.ticket_code)];
        setMyTickets(updated);
        localStorage.setItem('ss.myTickets', JSON.stringify(updated));
      }
      setScreen('result');
    } catch (err) {
      alert('Report saved to phone.');
    } finally {
      setIsSending(false);
    }
  }

  // SOS Hold Trigger
  function startHold() {
    setSosHoldProgress(0);
    const start = Date.now();
    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / 3000) * 100, 100);
      setSosHoldProgress(pct);
      if (pct >= 100) {
        clearInterval(holdIntervalRef.current);
        triggerSos();
      }
    }, 50);
  }

  function stopHold() {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setSosHoldProgress(0);
  }

  async function triggerSos() {
    setSosActive(true);
    const body = {
      sos_type: sosType,
      people_count: sosPeople,
      phone: profile.phone || null,
      medical_notes: profile.medical_notes || null,
      lat: pos?.lat || null,
      lon: pos?.lon || null,
      gps_accuracy_m: pos?.acc || null,
    };
    try {
      const res = await fetch('/sos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json());

      if (res.ticket_code) {
        const updated = [res.ticket_code, ...myTickets];
        setMyTickets(updated);
        localStorage.setItem('ss.myTickets', JSON.stringify(updated));
      }
    } catch {
      // SOS stored
    }
  }

  async function sendVoiceReport() {
    if (!speakText.trim()) return;
    try {
      const res = await fetch('/voice/transcript', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          phone: profile.phone || null,
          text: speakText,
          lat: pos?.lat || null,
          lon: pos?.lon || null,
          gps_accuracy_m: pos?.acc || null,
        }),
      }).then((r) => r.json());
      setLastResult(res);
      setScreen('result');
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div style={{ fontFamily: 'Hind Guntur, sans-serif' }}>
      <link rel="stylesheet" href="/citizen/citizen.css" />

      {/* Header Bar */}
      <header className="bar">
        <a className="brand" href="#/home" onClick={() => setScreen('home')}>
          <img src="/shared/icon.svg" alt="" width="32" height="32" />
          <span className="bi">
            <span>సహాయ సేతు</span>
            <span>Sahaya Setu</span>
          </span>
        </a>
        <div className="bar-right">
          <button className={`net ${isOnline ? 'on' : 'off'}`} type="button">
            {isOnline ? t('online') : t('offline')}
          </button>
          <button
            className="lang"
            type="button"
            onClick={() => setLang(lang === 'te' ? 'en' : 'te')}
          >
            {lang === 'te' ? 'English' : 'తెలుగు'}
          </button>
        </div>
      </header>

      <main id="app" style={{ maxWidth: 560, margin: '0 auto', padding: '1rem' }}>
        {/* SCREEN: HOME */}
        {screen === 'home' && (
          <section id="s-home" className="screen">
            {/* Alerts Ticker */}
            {alertsList.length > 0 && (
              <div id="alerts" style={{ marginBottom: '1rem' }}>
                {alertsList.map((a) => (
                  <div
                    key={a.id}
                    className="alert-banner"
                    style={{
                      background: a.level === 'red' ? '#fdecea' : '#fff4e5',
                      borderLeft: `6px solid ${a.level === 'red' ? '#e81123' : '#e8780c'}`,
                      padding: '.8rem',
                      borderRadius: 6,
                      marginBottom: '.6rem',
                    }}
                  >
                    <b>{a.level.toUpperCase()} ALERT: {a.title}</b>
                    <p>{lang === 'te' && a.message_te ? a.message_te : a.message}</p>
                    {a.nearest_shelters && a.nearest_shelters[0] && (
                      <small style={{ display: 'block', marginTop: '.3rem', color: '#1b4f9c' }}>
                        Nearest cyclone shelter: {a.nearest_shelters[0].name} ({a.nearest_shelters[0].distance_km} km {a.nearest_shelters[0].direction})
                      </small>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Big SOS Button */}
            <div className="sos-wrap">
              <button
                className="sos-big"
                type="button"
                onClick={() => setScreen('sos')}
              >
                <span className="sos-word">SOS</span>
                <span>{t('sos_open_hint')}</span>
              </button>
            </div>

            {/* Main Action Tiles */}
            <nav className="tiles">
              <a
                className="tile main"
                href="#report"
                onClick={(e) => {
                  e.preventDefault();
                  setScreen('report');
                  startCamera();
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
                <span>
                  <span>{t('report')}</span>
                  <small>{t('report_sub')}</small>
                </span>
              </a>

              <a
                className="tile"
                href="#speak"
                onClick={(e) => {
                  e.preventDefault();
                  setScreen('speak');
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M6 11a6 6 0 0 0 12 0M12 17v4" />
                </svg>
                <span>{t('speak')}</span>
              </a>

              <a
                className="tile"
                href="#tickets"
                onClick={(e) => {
                  e.preventDefault();
                  setScreen('tickets');
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 3h9l3 3v15H6z" />
                  <path d="M9 10h6M9 14h6M9 18h4" />
                </svg>
                <span>{t('tickets')} ({myTickets.length})</span>
              </a>

              <a
                className="tile"
                href="#relay"
                onClick={(e) => {
                  e.preventDefault();
                  setScreen('relay');
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <path d="M14 14h3v3h-3zM18 18h3v3h-3z" />
                </svg>
                <span>{t('relay')}</span>
              </a>

              <a
                className="tile"
                href="#profile"
                onClick={(e) => {
                  e.preventDefault();
                  setScreen('profile');
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="9" cy="8" r="3" />
                  <circle cx="17" cy="9" r="2.5" />
                  <path d="M3 20c0-4 3-6 6-6s6 2 6 6M14 20c0-3 1.5-5 3-5s4 2 4 5" />
                </svg>
                <span>{t('profile')}</span>
              </a>
            </nav>

            <p className="foot">{t('emergency_note')}</p>
          </section>
        )}

        {/* SCREEN: REPORT (CAMERA) */}
        {screen === 'report' && (
          <section id="s-report" className="screen dark">
            <div className="cam" style={{ position: 'relative', width: '100%', minHeight: 360, background: '#000', borderRadius: 8, overflow: 'hidden' }}>
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 10,
                  left: 10,
                  background: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  padding: '4px 10px',
                  borderRadius: 20,
                  fontSize: 12,
                }}
              >
                {pos ? `GPS ±${Math.round(pos.acc || 10)}m` : t('finding_gps')}
              </div>
            </div>

            <div className="cam-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
              <button
                className="btn ghost"
                onClick={() => {
                  stopCamera();
                  setScreen('home');
                }}
              >
                {t('back')}
              </button>
              <button
                className="shutter"
                type="button"
                onClick={capturePhoto}
                style={{ width: 68, height: 68, borderRadius: '50%', background: '#fff', border: '5px solid #1b4f9c', cursor: 'pointer' }}
              />
              <span style={{ width: 60 }} />
            </div>

            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <small style={{ color: 'var(--ink-soft)' }}>Or choose photo from device:</small>
              <input
                type="file"
                accept="image/*"
                style={{ display: 'block', margin: '0.4rem auto' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setPhotoBlob(f);
                    const reader = new FileReader();
                    reader.onload = (re) => {
                      setCapturedPhoto(re.target.result);
                      stopCamera();
                      setScreen('review');
                    };
                    reader.readAsDataURL(f);
                  }
                }}
              />
            </div>
          </section>
        )}

        {/* SCREEN: REVIEW */}
        {screen === 'review' && (
          <section id="s-review" className="screen">
            {capturedPhoto && (
              <figure className="shot" style={{ margin: 0, marginBottom: '1rem' }}>
                <img src={capturedPhoto} alt="Captured" style={{ width: '100%', borderRadius: 8 }} />
              </figure>
            )}

            <h2>{t('what_problem')}</h2>
            <div className="cats" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.4rem', marginBottom: '1rem' }}>
              {Object.entries(CAT_LABELS).map(([k, [tel, eng]]) => (
                <button
                  key={k}
                  type="button"
                  className={`btn small ${category === k ? '' : 'ghost'}`}
                  onClick={() => setCategory(k)}
                >
                  {lang === 'te' ? tel : eng}
                </button>
              ))}
            </div>

            <h2>{t('people_affected')}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '.6rem 0' }}>
              <button
                className="btn small ghost"
                onClick={() => setPeopleCount(Math.max(0, peopleCount - 1))}
              >
                -
              </button>
              <b>{peopleCount}</b>
              <button
                className="btn small ghost"
                onClick={() => setPeopleCount(peopleCount + 1)}
              >
                +
              </button>
            </div>

            <label className="check" style={{ display: 'flex', alignItems: 'center', gap: '.5rem', margin: '.8rem 0' }}>
              <input
                type="checkbox"
                checked={danger}
                onChange={(e) => setDanger(e.target.checked)}
              />
              <span>{t('danger_now')}</span>
            </label>

            <label className="field">
              <span>{t('note')}</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Village / landmark details..."
              />
            </label>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button
                className="btn ghost"
                onClick={() => {
                  setScreen('report');
                  startCamera();
                }}
              >
                {t('retake')}
              </button>
              <button
                className="btn"
                disabled={isSending}
                onClick={sendReport}
                style={{ flex: 1 }}
              >
                {isSending ? t('sending') : t('send')}
              </button>
            </div>
          </section>
        )}

        {/* SCREEN: RESULT */}
        {screen === 'result' && (
          <section id="s-result" className="screen">
            <div className="result" style={{ background: 'var(--paper)', padding: '1.5rem', borderRadius: 8, textAlign: 'center' }}>
              <h2>{t('sent_title')}</h2>
              <div style={{ fontSize: 'var(--s3)', fontWeight: 700, color: 'var(--tarp)', margin: '.6rem 0' }}>
                {lastResult?.ticket_code || 'SS-0001'}
              </div>
              <p>Updates will come by SMS to your phone number.</p>

              {config?.sms_number && (
                <a
                  className="btn"
                  style={{ display: 'inline-block', margin: '.6rem 0' }}
                  href={`sms:${config.sms_number}?body=SS|${category}|SEV3|PPL${peopleCount}|ID${lastResult?.ticket_code}`}
                >
                  {t('send_sms')}
                </a>
              )}

              <div style={{ marginTop: '1rem' }}>
                <button className="btn ghost" onClick={() => setScreen('home')}>
                  {t('home')}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* SCREEN: SOS */}
        {screen === 'sos' && (
          <section id="s-sos" className="screen">
            <h1>{t('sos_title')}</h1>

            {!sosActive ? (
              <>
                <h2>{t('sos_what')}</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.4rem', marginBottom: '1rem' }}>
                  {['TRAPPED', 'MEDICAL', 'FLOODING', 'FIRE', 'OTHER'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={`btn small ${sosType === st ? '' : 'ghost'}`}
                      onClick={() => setSosType(st)}
                    >
                      {t(st === 'OTHER' ? 'OTHER_SOS' : st)}
                    </button>
                  ))}
                </div>

                <h2>{t('how_many')}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '.6rem 0' }}>
                  <button className="btn small ghost" onClick={() => setSosPeople(Math.max(1, sosPeople - 1))}>-</button>
                  <b>{sosPeople}</b>
                  <button className="btn small ghost" onClick={() => setSosPeople(sosPeople + 1)}>+</button>
                </div>

                <div style={{ margin: '2rem 0', textAlign: 'center' }}>
                  <button
                    className="sos-big"
                    style={{
                      background: `linear-gradient(to top, #8a0c16 ${sosHoldProgress}%, #e81123 ${sosHoldProgress}%)`,
                      transform: sosHoldProgress > 0 ? 'scale(0.96)' : 'none',
                    }}
                    onMouseDown={startHold}
                    onMouseUp={stopHold}
                    onTouchStart={startHold}
                    onTouchEnd={stopHold}
                  >
                    <span className="sos-word">SOS</span>
                    <span>{t('hold_send')}</span>
                  </button>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <button className="btn ghost" onClick={() => setScreen('home')}>{t('cancel')}</button>
                </div>
              </>
            ) : (
              <div style={{ background: '#fdecea', borderLeft: '6px solid var(--signal)', padding: '1.2rem', borderRadius: 8 }}>
                <h2>{t('sos_sent')}</h2>
                <p>Stay safe. Your location is being transmitted to the rescue team.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem', marginTop: '1rem' }}>
                  <a className="btn" style={{ background: '#e81123' }} href="tel:112">{t('call112')}</a>
                  <button className="btn ghost" onClick={() => setSosActive(false)}>{t('im_safe')}</button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* SCREEN: SPEAK */}
        {screen === 'speak' && (
          <section id="s-speak" className="screen">
            <h1>{t('speak_title')}</h1>
            <p>{t('speak_help')}</p>

            <textarea
              rows={4}
              value={speakText}
              onChange={(e) => setSpeakText(e.target.value)}
              placeholder="Type or speak in Telugu or English..."
              style={{ width: '100%', marginBottom: '1rem' }}
            />

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                className="btn ghost"
                onClick={() => {
                  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
                    alert('Speech recognition not supported in this browser. Please type.');
                    return;
                  }
                  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
                  const rec = new Speech();
                  rec.lang = lang === 'te' ? 'te-IN' : 'en-IN';
                  rec.onstart = () => setIsListening(true);
                  rec.onresult = (e) => {
                    const str = e.results[0][0].transcript;
                    setSpeakText((prev) => (prev ? `${prev} ${str}` : str));
                  };
                  rec.onend = () => setIsListening(false);
                  rec.start();
                }}
              >
                {isListening ? t('stop_listen') : t('start_listen')}
              </button>
              <button className="btn" onClick={sendVoiceReport} style={{ flex: 1 }}>{t('send')}</button>
            </div>
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <button className="btn ghost small" onClick={() => setScreen('home')}>{t('back')}</button>
            </div>
          </section>
        )}

        {/* SCREEN: TICKETS */}
        {screen === 'tickets' && (
          <section id="s-tickets" className="screen">
            <h1>{t('tickets')}</h1>
            {myTickets.length === 0 ? (
              <p>No reports tracked yet.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {myTickets.map((code) => (
                  <li key={code} style={{ background: 'var(--paper)', padding: '1rem', borderRadius: 8, marginBottom: '.6rem', border: '1px solid var(--line)' }}>
                    <b>Ticket: {code}</b>
                    <div style={{ marginTop: '.4rem' }}>
                      <a className="btn small ghost" href={`/track/${code}`} target="_blank" rel="noopener noreferrer">
                        View live status &rarr;
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <button className="btn ghost small" onClick={() => setScreen('home')}>{t('back')}</button>
            </div>
          </section>
        )}

        {/* SCREEN: RELAY */}
        {screen === 'relay' && (
          <section id="s-relay" className="screen">
            <h1>{t('relay')}</h1>
            <p>If you have no mobile network, this app encodes your report into a QR code so a neighbour with network can relay it.</p>
            <div style={{ background: 'var(--paper)', padding: '1rem', borderRadius: 8, textAlign: 'center' }}>
              <div id="qrcode" style={{ margin: '1rem auto' }}></div>
              <p>Show this code to a neighbour whose phone has signal.</p>
            </div>
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <button className="btn ghost small" onClick={() => setScreen('home')}>{t('back')}</button>
            </div>
          </section>
        )}

        {/* SCREEN: PROFILE */}
        {screen === 'profile' && (
          <section id="s-profile" className="screen">
            <h1>{t('profile_title')}</h1>
            <p>{t('profile_help')}</p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const contacts = profile.family_contacts.split(',').map((s) => s.trim()).filter(Boolean);
                  await fetch('/citizens/register', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                      phone: profile.phone,
                      name: profile.name,
                      village: profile.village,
                      household_size: profile.household_size,
                      needs: profile.needs,
                      medical_notes: profile.medical_notes,
                      family_contacts: contacts,
                      consent: profile.consent,
                      lat: pos?.lat || null,
                      lon: pos?.lon || null,
                    }),
                  });
                  alert('Profile saved!');
                  setScreen('home');
                } catch (err) {
                  alert(err.message);
                }
              }}
            >
              <label className="field">
                {t('phone')}
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  required
                />
              </label>

              <label className="field">
                {t('name')}
                <input
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                />
              </label>

              <label className="field">
                {t('village')}
                <input
                  value={profile.village}
                  onChange={(e) => setProfile({ ...profile, village: e.target.value })}
                  placeholder="e.g. Amalapuram"
                />
              </label>

              <label className="field">
                {t('size')}
                <input
                  type="number"
                  min="1"
                  value={profile.household_size}
                  onChange={(e) => setProfile({ ...profile, household_size: parseInt(e.target.value, 10) || 1 })}
                />
              </label>

              <div style={{ margin: '1rem 0' }}>
                <b>{t('needs')}</b>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.4rem', marginTop: '.4rem' }}>
                  {['elderly', 'pregnant', 'disabled', 'infant', 'dialysis', 'bedridden'].map((nd) => (
                    <label key={nd} style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                      <input
                        type="checkbox"
                        checked={profile.needs.includes(nd)}
                        onChange={(e) => {
                          const updated = e.target.checked
                            ? [...profile.needs, nd]
                            : profile.needs.filter((x) => x !== nd);
                          setProfile({ ...profile, needs: updated });
                        }}
                      />
                      <span>{t(nd)}</span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="field">
                {t('medical_notes')}
                <input
                  value={profile.medical_notes}
                  onChange={(e) => setProfile({ ...profile, medical_notes: e.target.value })}
                  placeholder="e.g. oxygen support required"
                />
              </label>

              <label className="field">
                {t('family')}
                <input
                  value={profile.family_contacts}
                  onChange={(e) => setProfile({ ...profile, family_contacts: e.target.value })}
                  placeholder="Comma separated numbers"
                />
              </label>

              <label className="check" style={{ display: 'flex', alignItems: 'center', gap: '.5rem', margin: '1rem 0' }}>
                <input
                  type="checkbox"
                  checked={profile.consent}
                  onChange={(e) => setProfile({ ...profile, consent: e.target.checked })}
                  required
                />
                <span>{t('consent')}</span>
              </label>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="button" className="btn ghost" onClick={() => setScreen('home')}>{t('back')}</button>
                <button type="submit" className="btn" style={{ flex: 1 }}>{t('save')}</button>
              </div>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
