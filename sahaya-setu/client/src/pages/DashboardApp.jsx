import React, { useEffect, useState, useRef } from 'react';
import ComplaintImage from '../components/ComplaintImage';

const STATUS_NAMES = {
  received: 'New',
  review: 'Needs check',
  assigned: 'Assigned',
  in_progress: 'Team on the way',
  resolved: 'Fixed, awaiting citizen',
  closed: 'Closed',
  escalated: 'Escalated',
  rejected: 'Rejected',
  merged: 'Merged',
};

const CATEGORIES = {
  ELEC: 'Power pole or wires',
  TREE: 'Fallen tree',
  ROAD: 'Road damage',
  FLOOD: 'Flooding',
  HOUSE: 'House damage',
  HEALTH: 'Medical help',
  TRANSPORT: 'Evacuation',
  OTHER: 'Other',
  TRAPPED: 'Trapped',
  MEDICAL: 'Medical emergency',
  FLOODING: 'Water in home',
  FIRE: 'Fire',
};

const COLOR = {
  sos: '#e81123',
  received: '#1b4f9c',
  review: '#5e4fa2',
  working: '#e8780c',
  resolved: '#1f7a4a',
};

function statusGroup(s) {
  if (['assigned', 'in_progress'].includes(s)) return 'working';
  if (['resolved', 'closed'].includes(s)) return 'resolved';
  if (s === 'review') return 'review';
  return 'received';
}

function due(iso) {
  if (!iso) return { text: '', late: false };
  const ms = new Date(iso) - Date.now();
  const m = Math.round(Math.abs(ms) / 60000);
  const span = m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
  return ms >= 0 ? { text: `Due in ${span}`, late: false } : { text: `Late by ${span}`, late: true };
}

export default function DashboardApp() {
  const [token, setToken] = useState(() => localStorage.getItem('ss.staffToken') || 'control-demo');
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('tickets');
  const [loginError, setLoginError] = useState('');
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [alertsList, setAlertsList] = useState([]);
  const [outbox, setOutbox] = useState([]);
  const [sitrepData, setSitrepData] = useState(null);
  const [vulnerableModal, setVulnerableModal] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [showMergeModal, setShowMergeModal] = useState(false);

  // Filters
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  // Warning Form
  const [alertForm, setAlertForm] = useState({
    level: 'orange',
    hazard: 'Cyclone',
    title: '',
    message: '',
    message_te: '',
    area_name: '',
    radius_km: 20,
    expires_in_hours: 48,
    center_lat: 16.5787,
    center_lon: 82.0061,
  });
  const [capXml, setCapXml] = useState('');

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layerGroup = useRef(null);
  const alertCircleRef = useRef(null);
  const audioContextRef = useRef(null);
  const proofInputRef = useRef(null);

  async function api(path, opts = {}) {
    const headers = { ...(opts.headers || {}), 'X-Staff-Token': token || '' };
    const res = await fetch(path, { ...opts, headers });
    const isJson = res.headers.get('content-type')?.includes('json');
    const body = isJson ? await res.json() : await res.text();
    if (!res.ok) {
      const err = new Error(body?.detail || res.statusText || 'Request failed');
      err.status = res.status;
      throw err;
    }
    return body;
  }

  async function checkLogin(tok = token) {
    try {
      const u = await fetch('/auth/me', { headers: { 'X-Staff-Token': tok } }).then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      });
      setUser(u);
      setLoginError('');
      localStorage.setItem('ss.staffToken', tok);
      loadAll(tok);
    } catch {
      setUser(null);
      setLoginError('That token is not valid.');
    }
  }

  async function loadIncidents(tok = token) {
    try {
      const data = await fetch('/incidents', { headers: { 'X-Staff-Token': tok } }).then((r) => r.json());
      setIncidents(data.items || []);
    } catch (e) {
      console.warn(e);
    }
  }

  async function loadAlerts(tok = token) {
    try {
      const data = await fetch('/alerts', { headers: { 'X-Staff-Token': tok } }).then((r) => r.json());
      setAlertsList(data || []);
    } catch (e) {
      console.warn(e);
    }
  }

  async function loadOutbox(tok = token) {
    try {
      const data = await fetch('/outbox', { headers: { 'X-Staff-Token': tok } }).then((r) => r.json());
      setOutbox(data || []);
    } catch (e) {
      console.warn(e);
    }
  }

  async function loadSitrep(tok = token) {
    try {
      const data = await fetch('/sitrep', { headers: { 'X-Staff-Token': tok } }).then((r) => r.json());
      setSitrepData(data);
    } catch (e) {
      console.warn(e);
    }
  }

  function loadAll(tok = token) {
    loadIncidents(tok);
    loadAlerts(tok);
    loadOutbox(tok);
    loadSitrep(tok);
  }

  useEffect(() => {
    checkLogin(token);
    const interval = setInterval(() => {
      if (user) loadAll();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Map initialization
  useEffect(() => {
    if (!mapRef.current || !window.L) return;

    if (!mapInstance.current) {
      const map = window.L.map(mapRef.current).setView([16.5787, 82.0061], 10);
      const offlineTileUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="%23f8fafc" stroke="%23e2e8f0" stroke-width="1"/><circle cx="128" cy="128" r="4" fill="%23cbd5e1"/></svg>`;
      const tl = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors',
        errorTileUrl: offlineTileUrl,
      });
      tl.on('tileerror', () => {});
      tl.addTo(map);

      layerGroup.current = window.L.layerGroup().addTo(map);
      mapInstance.current = map;

      // Map click handler for alert center
      map.on('click', (e) => {
        setAlertForm((prev) => ({
          ...prev,
          center_lat: parseFloat(e.latlng.lat.toFixed(5)),
          center_lon: parseFloat(e.latlng.lng.toFixed(5)),
        }));
      });
    }

    if (layerGroup.current) {
      layerGroup.current.clearLayers();

      // Render shelters
      fetch('/shelters/all', { headers: { 'X-Staff-Token': token } })
        .then((r) => r.json())
        .then((shelters) => {
          shelters.forEach((s) => {
            const icon = window.L.divIcon({
              className: 'shelter-icon',
              html: `<span style="display:inline-block;width:12px;height:12px;background:#333;border:2px solid #fff;border-radius:2px;"></span>`,
              iconSize: [14, 14],
            });
            window.L.marker([s.lat, s.lon], { icon })
              .bindTooltip(`Shelter: ${s.name} (${s.capacity} people)`)
              .addTo(layerGroup.current);
          });
        })
        .catch(() => {});

      // Render incidents
      incidents
        .filter((i) => i.lat != null && i.lon != null)
        .forEach((i) => {
          const color = i.is_sos ? COLOR.sos : COLOR[statusGroup(i.status)] || '#1b4f9c';
          const marker = window.L.circleMarker([i.lat, i.lon], {
            radius: i.is_sos ? 10 : 7,
            color: '#fff',
            weight: 2,
            fillColor: color,
            fillOpacity: 0.9,
          })
            .bindTooltip(`${i.ticket_code} ${i.is_sos ? 'SOS' : ''}: ${CATEGORIES[i.category] || i.category}`)
            .addTo(layerGroup.current);

          marker.on('click', () => openIncident(i.id));
        });

      // Render alert circles
      alertsList
        .filter((a) => a.active && a.center_lat != null)
        .forEach((a) => {
          const cColor = a.level === 'red' ? '#e81123' : a.level === 'orange' ? '#e8780c' : '#ffd026';
          window.L.circle([a.center_lat, a.center_lon], {
            radius: (a.radius_km || 20) * 1000,
            color: cColor,
            fillColor: cColor,
            fillOpacity: 0.15,
            weight: 2,
          })
            .bindTooltip(`Alert: ${a.title}`)
            .addTo(layerGroup.current);
        });
    }
  }, [incidents, alertsList, currentView]);

  // Audio SOS Alarm
  useEffect(() => {
    if (!soundEnabled) return;
    const hasSos = incidents.some((i) => i.is_sos && ['received', 'review'].includes(i.status));
    if (hasSos) {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        const ctx = audioContextRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } catch (e) {
        // audio context blocked
      }
    }
  }, [incidents, soundEnabled]);

  async function openIncident(id) {
    try {
      const data = await api(`/incidents/${id}`);
      setSelectedIncident(data);
    } catch (e) {
      alert(e.message);
    }
  }

  async function updateStatus(status, proofFile = null) {
    if (!selectedIncident) return;
    try {
      const fd = new FormData();
      fd.append('status', status);
      if (proofFile) fd.append('proof', proofFile);
      const updated = await api(`/incidents/${selectedIncident.id}/status`, {
        method: 'POST',
        body: fd,
      });
      setSelectedIncident(updated);
      loadIncidents();
    } catch (e) {
      alert(e.message);
    }
  }

  async function mergeTickets() {
    if (!selectedIncident || !mergeTargetId) return;
    try {
      const targetId = parseInt(mergeTargetId.replace(/\D/g, ''), 10);
      const updated = await api(`/incidents/${selectedIncident.id}/merge-into/${targetId}`, {
        method: 'POST',
      });
      setSelectedIncident(updated);
      setShowMergeModal(false);
      setMergeTargetId('');
      loadIncidents();
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleSendAlert(e) {
    e.preventDefault();
    try {
      await api('/alerts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(alertForm),
      });
      alert('Alert created!');
      loadAlerts();
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleImportCap(e) {
    e.preventDefault();
    try {
      await api('/alerts/import-cap', {
        method: 'POST',
        headers: { 'content-type': 'application/xml' },
        body: capXml,
      });
      alert('CAP alert imported successfully!');
      setCapXml('');
      loadAlerts();
    } catch (e) {
      alert(e.message);
    }
  }

  async function endAlert(id) {
    try {
      await api(`/alerts/${id}/end`, { method: 'POST' });
      loadAlerts();
    } catch (e) {
      alert(e.message);
    }
  }

  async function showVulnerablePeople(alertId) {
    try {
      const data = await api(`/citizens/vulnerable?alert_id=${alertId}`);
      setVulnerableModal(data);
    } catch (e) {
      alert(e.message);
    }
  }

  const sosCount = incidents.filter((i) => i.is_sos && ['received', 'review'].includes(i.status)).length;
  const newCount = incidents.filter((i) => ['received', 'escalated'].includes(i.status) && !i.is_sos).length;
  const checkCount = incidents.filter((i) => i.status === 'review' && !i.is_sos).length;
  const workingCount = incidents.filter((i) => ['assigned', 'in_progress'].includes(i.status)).length;
  const fixedCount = incidents.filter((i) => i.status === 'resolved').length;

  const filteredIncidents = incidents.filter((i) => {
    if (deptFilter && i.department !== deptFilter) return false;
    if (statusFilter) {
      const allowed = statusFilter.split(',');
      if (!allowed.includes(i.status)) return false;
    }
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      const match =
        i.ticket_code.toLowerCase().includes(q) ||
        (i.address || '').toLowerCase().includes(q) ||
        (i.category || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div style={{ fontFamily: 'inherit' }}>
      <link rel="stylesheet" href="/dashboard/dashboard.css" />

      {/* Login Screen */}
      {!user && (
        <div className="login">
          <form
            className="login-card"
            onSubmit={(e) => {
              e.preventDefault();
              checkLogin(token);
            }}
          >
            <img src="/shared/icon.svg" alt="" width="48" height="48" />
            <h1>Sahaya Setu control room</h1>
            <p>Sign in with the staff token for your desk.</p>
            <label className="field">
              Staff token
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
                required
              />
            </label>
            {loginError && <p className="login-error">{loginError}</p>}
            <button className="btn" type="submit">
              Sign in
            </button>
            <div className="demo">
              <p>Demo desks</p>
              <div className="demo-buttons">
                {['control-demo', 'elec-demo', 'health-demo', 'rescue-demo', 'roads-demo', 'transport-demo'].map(
                  (tok) => (
                    <button
                      key={tok}
                      type="button"
                      className="btn small ghost"
                      onClick={() => {
                        setToken(tok);
                        checkLogin(tok);
                      }}
                    >
                      {tok}
                    </button>
                  )
                )}
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Top Header */}
      <header className="top">
        <div className="top-brand">
          <img src="/shared/icon.svg" alt="" width="28" height="28" />
          <span>Sahaya Setu</span>
          <small id="desk">{user?.name}</small>
        </div>
        <nav className="views" aria-label="Views">
          <button
            type="button"
            aria-current={currentView === 'tickets'}
            onClick={() => setCurrentView('tickets')}
          >
            Tickets
          </button>
          <button
            type="button"
            aria-current={currentView === 'alerts'}
            onClick={() => setCurrentView('alerts')}
          >
            Warnings
          </button>
          {user?.isControl && (
            <button
              type="button"
              aria-current={currentView === 'sitrep'}
              onClick={() => setCurrentView('sitrep')}
            >
              Situation report
            </button>
          )}
          {user?.isControl && (
            <button
              type="button"
              aria-current={currentView === 'sms'}
              onClick={() => setCurrentView('sms')}
            >
              SMS log
            </button>
          )}
        </nav>
        <div className="counters">
          {sosCount > 0 && <span className="pill st-sos">{sosCount} SOS</span>}
          {newCount > 0 && <span className="pill st-received">{newCount} New</span>}
          {checkCount > 0 && <span className="pill st-review">{checkCount} Check</span>}
          {workingCount > 0 && <span className="pill st-assigned">{workingCount} Working</span>}
          {fixedCount > 0 && <span className="pill st-resolved">{fixedCount} Fixed</span>}
        </div>
        <div className="top-tools">
          <button
            type="button"
            className="btn small ghost"
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? 'Alarm Sound: ON' : 'Turn on SOS alarm'}
          </button>
          <button
            type="button"
            className="btn small ghost"
            onClick={() => {
              setUser(null);
              setToken('');
              localStorage.removeItem('ss.staffToken');
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* SOS Banner */}
      {sosCount > 0 && (
        <div className="sos-banner">
          <b>CRITICAL EMERGENCY:</b> {sosCount} active SOS reported! Priority action required immediately.
        </div>
      )}

      <main>
        {/* VIEW: TICKETS */}
        {currentView === 'tickets' && (
          <section className="view view-tickets" style={{ display: 'grid' }}>
            <aside className="rail">
              <div className="filters">
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  aria-label="Department"
                >
                  <option value="">All departments</option>
                  <option value="electricity">Electricity</option>
                  <option value="health">Health</option>
                  <option value="transport">Transport</option>
                  <option value="rescue">Rescue</option>
                  <option value="roads">Roads</option>
                </select>
                <div className="seg" role="group">
                  <button
                    type="button"
                    aria-pressed={statusFilter === ''}
                    onClick={() => setStatusFilter('')}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    aria-pressed={statusFilter === 'review'}
                    onClick={() => setStatusFilter('review')}
                  >
                    Check
                  </button>
                  <button
                    type="button"
                    aria-pressed={statusFilter === 'received,escalated'}
                    onClick={() => setStatusFilter('received,escalated')}
                  >
                    New
                  </button>
                  <button
                    type="button"
                    aria-pressed={statusFilter === 'assigned,in_progress'}
                    onClick={() => setStatusFilter('assigned,in_progress')}
                  >
                    Working
                  </button>
                  <button
                    type="button"
                    aria-pressed={statusFilter === 'resolved'}
                    onClick={() => setStatusFilter('resolved')}
                  >
                    Fixed
                  </button>
                </div>
                <input
                  type="search"
                  placeholder="Search ticket, place, phone"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
              </div>

              <ol className="queue">
                {filteredIncidents.map((i) => {
                  const dl = due(i.sla_due_at);
                  return (
                    <li
                      key={i.id}
                      className={`q-item ${i.is_sos ? 'sos' : ''} ${selectedIncident?.id === i.id ? 'active' : ''}`}
                      onClick={() => openIncident(i.id)}
                    >
                      <div className="q-head">
                        <b>{i.ticket_code} {i.is_sos ? 'SOS' : ''}</b>
                        <span className={`pill st-${i.status}`}>{STATUS_NAMES[i.status] || i.status}</span>
                      </div>
                      <div className="q-sub">{CATEGORIES[i.category] || i.category} &bull; {i.department_name}</div>
                      <div className="q-addr">{i.address || 'Location unknown'}</div>
                      <div className="q-meta">
                        <span className={dl.late ? 'late' : ''}>{dl.text}</span>
                        <span>{i.report_count} reports</span>
                        <span>Priority {i.priority}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </aside>

            <div className="map-wrap">
              <div id="map" ref={mapRef} className="map" role="region" aria-label="Map of tickets"></div>
              <div className="legend">
                <span><i className="dot sos"></i>SOS</span>
                <span><i className="dot received"></i>New</span>
                <span><i className="dot review"></i>Check</span>
                <span><i className="dot working"></i>Working</span>
                <span><i className="dot resolved"></i>Fixed</span>
                <span><i className="sq"></i>Shelter</span>
              </div>
            </div>

            {/* DETAIL DRAWER */}
            {selectedIncident && (
              <aside className="detail">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2>{selectedIncident.ticket_code} {selectedIncident.is_sos ? 'SOS' : ''}</h2>
                  <button className="btn small ghost" onClick={() => setSelectedIncident(null)}>✕</button>
                </div>

                <div style={{ margin: '.4rem 0' }}>
                  <span className={`pill st-${selectedIncident.status}`}>{STATUS_NAMES[selectedIncident.status] || selectedIncident.status}</span>{' '}
                  <b>{CATEGORIES[selectedIncident.category] || selectedIncident.category}</b> ({selectedIncident.department_name})
                </div>

                <p>{selectedIncident.address || 'Location unknown'}</p>

                {selectedIncident.photo_url && (
                  <ComplaintImage src={selectedIncident.photo_url} alt="Incident" folder="reports" style={{ width: '100%', borderRadius: 4, margin: '.4rem 0' }} />
                )}

                {selectedIncident.resolution_photo_url && (
                  <div>
                    <small><b>Proof of resolution:</b></small>
                    <ComplaintImage src={selectedIncident.resolution_photo_url} alt="Proof" folder="resolutions" style={{ width: '100%', borderRadius: 4, margin: '.4rem 0' }} />
                  </div>
                )}

                {/* Status Transitions */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem', margin: '.6rem 0' }}>
                  {selectedIncident.status === 'received' && (
                    <button className="btn small" onClick={() => updateStatus('assigned')}>Assign</button>
                  )}
                  {selectedIncident.status === 'review' && (
                    <>
                      <button className="btn small" onClick={() => updateStatus('received')}>Accept</button>
                      <button className="btn small ghost" onClick={() => updateStatus('rejected')}>Reject</button>
                    </>
                  )}
                  {['assigned', 'received', 'escalated'].includes(selectedIncident.status) && (
                    <button className="btn small" onClick={() => updateStatus('in_progress')}>On the way</button>
                  )}
                  {['assigned', 'in_progress', 'escalated'].includes(selectedIncident.status) && (
                    <>
                      <button className="btn small" style={{ background: 'var(--leaf)' }} onClick={() => proofInputRef.current?.click()}>
                        Mark Fixed (with photo)
                      </button>
                      <input
                        type="file"
                        ref={proofInputRef}
                        accept="image/*"
                        hidden
                        onChange={(e) => {
                          if (e.target.files?.[0]) updateStatus('resolved', e.target.files[0]);
                        }}
                      />
                    </>
                  )}
                  {user?.isControl && selectedIncident.status !== 'merged' && (
                    <button className="btn small ghost" onClick={() => setShowMergeModal(true)}>Merge into ticket...</button>
                  )}
                </div>

                {/* Merge Modal */}
                {showMergeModal && (
                  <div style={{ background: '#f5f5f5', padding: '.8rem', borderRadius: 6, margin: '.6rem 0', border: '1px solid var(--line)' }}>
                    <b>Merge into target ticket</b>
                    <input
                      placeholder="e.g. SS-0001 or 1"
                      value={mergeTargetId}
                      onChange={(e) => setMergeTargetId(e.target.value)}
                      style={{ margin: '.4rem 0', width: '100%' }}
                    />
                    <div style={{ display: 'flex', gap: '.4rem' }}>
                      <button className="btn small" onClick={mergeTickets}>Confirm Merge</button>
                      <button className="btn small ghost" onClick={() => setShowMergeModal(false)}>Cancel</button>
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <h3>Timeline</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 'var(--s-1)' }}>
                  {(selectedIncident.timeline || []).map((t, idx) => (
                    <li key={idx} style={{ padding: '.3rem 0', borderBottom: '1px solid var(--line)' }}>
                      <b>{t.status}</b> by {t.actor}: {t.note} <small style={{ color: 'var(--ink-soft)' }}>({new Date(t.at).toLocaleTimeString()})</small>
                    </li>
                  ))}
                </ul>

                {/* Reports History */}
                <h3 style={{ marginTop: '.8rem' }}>Reports ({selectedIncident.report_count})</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 'var(--s-1)' }}>
                  {(selectedIncident.reports || []).map((r) => (
                    <li key={r.id} style={{ padding: '.3rem 0', borderBottom: '1px solid var(--line)' }}>
                      Channel: <b>{r.channel}</b> | Phone: <b>{r.phone || 'none'}</b>
                      {r.description && <div>Note: {r.description}</div>}
                    </li>
                  ))}
                </ul>
              </aside>
            )}
          </section>
        )}

        {/* VIEW: WARNINGS */}
        {currentView === 'alerts' && (
          <section className="view view-alerts" style={{ display: 'grid', padding: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <form className="panel" onSubmit={handleSendAlert}>
                  <h2>Send a warning</h2>
                  <p className="hint">People inside the circle see it in the citizen app with their nearest shelter.</p>
                  <div className="two">
                    <label className="field">
                      Level
                      <select
                        value={alertForm.level}
                        onChange={(e) => setAlertForm({ ...alertForm, level: e.target.value })}
                      >
                        <option value="red">Red</option>
                        <option value="orange">Orange</option>
                        <option value="yellow">Yellow</option>
                      </select>
                    </label>
                    <label className="field">
                      Hazard
                      <input
                        value={alertForm.hazard}
                        onChange={(e) => setAlertForm({ ...alertForm, hazard: e.target.value })}
                        required
                      />
                    </label>
                  </div>
                  <label className="field">
                    Headline
                    <input
                      value={alertForm.title}
                      onChange={(e) => setAlertForm({ ...alertForm, title: e.target.value })}
                      required
                    />
                  </label>
                  <label className="field">
                    Message
                    <textarea
                      value={alertForm.message}
                      onChange={(e) => setAlertForm({ ...alertForm, message: e.target.value })}
                      required
                    />
                  </label>
                  <label className="field">
                    Message in Telugu
                    <textarea
                      value={alertForm.message_te}
                      onChange={(e) => setAlertForm({ ...alertForm, message_te: e.target.value })}
                      lang="te"
                    />
                  </label>
                  <div className="two">
                    <label className="field">
                      Area name
                      <input
                        value={alertForm.area_name}
                        onChange={(e) => setAlertForm({ ...alertForm, area_name: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      Radius (km)
                      <input
                        type="number"
                        value={alertForm.radius_km}
                        onChange={(e) => setAlertForm({ ...alertForm, radius_km: parseFloat(e.target.value) })}
                        required
                      />
                    </label>
                  </div>
                  <button className="btn" type="submit">Send warning</button>
                </form>

                <form className="panel" onSubmit={handleImportCap} style={{ marginTop: '1rem' }}>
                  <h2>Import an official CAP 1.2 alert</h2>
                  <textarea
                    rows={4}
                    placeholder="Paste CAP XML..."
                    value={capXml}
                    onChange={(e) => setCapXml(e.target.value)}
                  />
                  <button className="btn" type="submit" style={{ marginTop: '.4rem' }}>Import CAP Alert</button>
                </form>
              </div>

              <div>
                <h2>Active warnings</h2>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '.8rem' }}>
                  {alertsList.map((a) => (
                    <li key={a.id} className="panel" style={{ borderLeft: `6px solid ${a.level === 'red' ? '#e81123' : '#e8780c'}` }}>
                      <b>{a.level.toUpperCase()} ALERT: {a.title}</b>
                      <p>{a.message}</p>
                      {a.message_te && <p lang="te">{a.message_te}</p>}
                      <div style={{ display: 'flex', gap: '.6rem', marginTop: '.6rem' }}>
                        <button className="btn small" onClick={() => showVulnerablePeople(a.id)}>
                          Who needs help to evacuate
                        </button>
                        {a.active && (
                          <button className="btn small ghost" onClick={() => endAlert(a.id)}>End warning</button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* VIEW: SITREP */}
        {currentView === 'sitrep' && (
          <section className="view view-sitrep" style={{ display: 'block', padding: '1.5rem', maxWidth: 900, margin: '0 auto' }}>
            <h1>Situation Report (SitRep)</h1>
            {sitrepData ? (
              <div className="panel">
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 'var(--s0)', lineHeight: 1.6 }}>
                  {sitrepData.text}
                </pre>
                <small style={{ color: 'var(--ink-soft)' }}>Generated by: {sitrepData.written_by}</small>
              </div>
            ) : (
              <p>Loading situation report...</p>
            )}
          </section>
        )}

        {/* VIEW: SMS LOG */}
        {currentView === 'sms' && (
          <section className="view view-sms" style={{ display: 'block', padding: '1.5rem', maxWidth: 1000, margin: '0 auto' }}>
            <h1>SMS Outbox Log</h1>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', background: 'var(--paper)' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)', padding: '.6rem' }}>
                  <th>To</th>
                  <th>Message Body</th>
                  <th>Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {outbox.map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--line)', padding: '.4rem' }}>
                    <td><b>{m.to}</b></td>
                    <td style={{ fontSize: 'var(--s-1)' }}>{m.body}</td>
                    <td style={{ fontSize: 'var(--s-1)', color: 'var(--ink-soft)' }}>{new Date(m.at).toLocaleTimeString()}</td>
                    <td>{m.delivered ? 'Delivered' : 'Simulated'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>

      {/* Vulnerable Citizens Modal */}
      {vulnerableModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: '1.5rem', maxWidth: 600, width: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
            <h2>Evacuation List: {vulnerableModal.count} households ({vulnerableModal.people_in_households} people)</h2>
            <div style={{ margin: '.8rem 0' }}>
              <b>By Need:</b> {Object.entries(vulnerableModal.by_need || {}).map(([k, v]) => `${k}: ${v}`).join(', ')}
            </div>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {vulnerableModal.people.map((p) => (
                <li key={p.id} style={{ padding: '.4rem 0', borderBottom: '1px solid var(--line)' }}>
                  <b>{p.name || 'Citizen'}</b> ({p.village || 'Unknown village'}) &bull; Phone: <a href={`tel:${p.phone}`}>{p.phone}</a> &bull; Size: {p.household_size}
                  <div>Needs: {(p.needs || []).join(', ')}</div>
                </li>
              ))}
            </ul>
            <button className="btn small" style={{ marginTop: '1rem' }} onClick={() => setVulnerableModal(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
