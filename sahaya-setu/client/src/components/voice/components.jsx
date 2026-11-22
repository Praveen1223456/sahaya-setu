import React, { useEffect, useRef, useState } from 'react';
import InteractiveMap from '../InteractiveMap';
import { LANGS, CAT } from './strings';
import { useRecognizer, useAudioRecorder, auth, authed, fmtTime, request } from './hooks';

const MicIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" />
  </svg>
);

export function LanguageSelector({ value, onChange, disabled }) {
  return (
    <div className="lang-pick" role="radiogroup" aria-label="Language">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          role="radio"
          aria-checked={value === l.code}
          data-lang={l.code}
          className="lang-opt"
          disabled={disabled}
          onClick={() => onChange(l.code)}
        >
          <b>{l.name}</b>
          <small>{l.en}</small>
        </button>
      ))}
    </div>
  );
}

/** Visible instruction (always) plus the same sentence spoken aloud (unless muted or recording). */
export function VoiceAssistant({ vt, VBi, speaker, message, quiet }) {
  useEffect(() => {
    if (message && !quiet) speaker.speak(vt(message));
  }, [message, vt]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="assistant" aria-live="polite" id="assistant">
      <p className="assistant-msg">{message ? <VBi k={message} /> : null}</p>
      <button
        type="button"
        className="btn small ghost"
        id="tts-toggle"
        onClick={speaker.toggle}
        aria-pressed={speaker.muted}
      >
        {vt(speaker.muted ? 'unmute' : 'mute')}
      </button>
      {!speaker.muted && !speaker.hasVoice && (
        <small className="hint-text" id="no-voice">
          {vt('no_voice')}
        </small>
      )}
    </div>
  );
}

/** Browser recognition when available; otherwise recording + server speech-to-text fallback. */
export function VoiceRecorder({ lang, vt, VBi, caps, onText, onLive, onStart, onFinished, disabled }) {
  const rec = useRecognizer();
  const audio = useAudioRecorder();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState(null);
  const prev = useRef('idle');

  useEffect(() => {
    onLive?.(rec.interim);
  }, [rec.interim]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (rec.finalText) onText(rec.finalText, 'browser');
  }, [rec.finalText]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (prev.current === 'listening' && rec.state === 'idle' && rec.finalText) {
      onFinished?.();
    }
    prev.current = rec.state;
  }, [rec.state]); // eslint-disable-line react-hooks/exhaustive-deps

  const listening = rec.state !== 'idle';
  const startBrowser = () => {
    onStart?.();
    rec.start(lang);
  };
  const startServer = () => {
    onStart?.();
    setServerError(null);
    audio.start();
  };

  async function stopServer() {
    const blob = await audio.stop();
    if (!blob?.size) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('audio', blob, 'speech.webm');
      fd.append('language', lang);
      fd.append('consent', 'true');
      const r = await authed('/voice/transcribe', { method: 'POST', form: fd, timeout: 70000 });
      onText(r.text, 'server');
      onFinished?.();
    } catch (e) {
      setServerError(e.message);
    }
    setBusy(false);
  }

  const showServer =
    caps?.serverTranscription && (!rec.supported || ['network', 'lang', 'failed'].includes(rec.error));

  return (
    <div className="recorder">
      {rec.supported ? (
        <>
          <button
            type="button"
            className={`mic ${listening ? 'on' : ''}`}
            id="mic"
            aria-pressed={listening}
            disabled={disabled || rec.state === 'requesting' || audio.state === 'recording'}
            onClick={listening ? rec.stop : startBrowser}
          >
            <MicIcon />
            <span>{listening ? vt('stop') : vt('tap_mic')}</span>
          </button>
          {rec.state === 'requesting' && <p className="hint-text">{vt('asking_permission')}</p>}
          {rec.state === 'listening' && (
            <p className="live" id="listening">
              <span className="rec-dot" />
              {vt('listening')} <b>{fmtTime(rec.seconds)}</b>
            </p>
          )}
        </>
      ) : (
        <p className="warn" id="speech-unsupported">
          <VBi k="err_unsupported" /> {vt('type_instead')}
        </p>
      )}
      {rec.error && (
        <p className="warn" id="speech-error" role="alert">
          <VBi k={`err_${rec.error}`} />
        </p>
      )}
      {showServer && (
        <div className="server-stt" id="server-stt">
          <label className="check">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />{' '}
            <VBi k="consent_audio" />
          </label>
          {audio.state === 'recording' ? (
            <button className="btn danger" type="button" id="server-stop" onClick={stopServer}>
              {vt('stop')} {fmtTime(audio.seconds)}
            </button>
          ) : (
            <button
              className="btn"
              type="button"
              id="server-record"
              disabled={!consent || busy}
              onClick={startServer}
            >
              {vt('server_record')}
            </button>
          )}
          {audio.state === 'recording' && (
            <p className="live">
              <span className="rec-dot" />
              {vt('recording')}
            </p>
          )}
          {busy && <p>{vt('transcribing')}</p>}
          {(serverError || audio.error) && <p className="warn">{serverError || vt(`err_${audio.error}`)}</p>}
        </div>
      )}
    </div>
  );
}

export function TranscriptionEditor({ vt, VBi, value, interim, onChange, onRetry, onClear }) {
  return (
    <div className="transcript">
      <label className="field" htmlFor="transcript">
        <VBi k="heard" />
      </label>
      <small className="hint-text">{vt('edit_hint')}</small>
      <textarea
        id="transcript"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={2000}
        rows={4}
      />
      {interim && <p className="interim" id="interim">{interim}…</p>}
      <div className="row" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
        <button type="button" className="btn ghost" id="retry" onClick={onRetry}>
          {vt('retry')}
        </button>
        <button type="button" className="btn ghost" id="clear" onClick={onClear} disabled={!value}>
          {vt('clear')}
        </button>
      </div>
    </div>
  );
}

export function ComplaintAnalysisCard({ vt, short, analysis, form, setForm, departments = {} }) {
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const deptName = analysis.departmentName || departments[analysis.department] || analysis.department || '';
  const priority =
    form.category === analysis.category && form.severity === analysis.severity
      ? analysis.priority
      : form.severity;

  return (
    <div className="analysis" id="analysis">
      <div className="analysis-head">
        <span className={`sev sev-${form.severity}`}>{vt(form.severity)}</span>
        <small>
          {vt('suggested_by', {
            s:
              analysis.source === 'claude'
                ? 'AI (Claude)'
                : analysis.source === 'rules'
                ? 'keyword rules'
                : '—',
          })}
        </small>
      </div>
      {analysis.safetyWarning && (
        <p className="safety-warn" role="alert" id="safety">
          <b>{vt('safety')}:</b> {analysis.safetyWarning}
        </p>
      )}
      {(analysis.needsManualCategory || !form.category) && (
        <p className="warn" id="choose-category">
          {vt('choose_category')}
        </p>
      )}
      <label className="field">
        {vt('category')}
        <select id="category" value={form.category} onChange={set('category')}>
          <option value="">—</option>
          {Object.keys(CAT).map((c) => (
            <option key={c} value={c}>
              {CAT[c][short]}
              {short !== 'en' ? ` (${CAT[c].en})` : ''}
            </option>
          ))}
        </select>
      </label>
      <dl className="facts">
        <dt>{vt('department')}</dt>
        <dd id="department">{form.category ? deptName : '—'}</dd>
        <dt>{vt('priority')}</dt>
        <dd id="priority">{vt(priority)}</dd>
      </dl>
      <label className="field">
        {vt('severity')}
        <select id="severity" value={form.severity} onChange={set('severity')}>
          {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => (
            <option key={s} value={s}>
              {vt(s)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        {vt('title_f')}
        <input id="title" value={form.title} onChange={set('title')} maxLength={120} />
      </label>
      <label className="field">
        {vt('description_f')}
        <textarea
          id="description"
          value={form.description}
          onChange={set('description')}
          maxLength={2000}
          rows={3}
        />
      </label>
    </div>
  );
}

export function LocationPicker({ vt, value, onChange, spokenLocation }) {
  const [state, setState] = useState('idle');

  async function reverseAddress(lat, lon) {
    try {
      const res = await fetch(`/geo/reverse?lat=${lat}&lon=${lon}`);
      if (res.ok) {
        const d = await res.json();
        return d.address || '';
      }
    } catch {}
    return '';
  }

  function locate() {
    if (!('geolocation' in navigator)) {
      setState('failed');
      return;
    }
    setState('finding');
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const lat = p.coords.latitude;
        const lon = p.coords.longitude;
        const acc = Math.round(p.coords.accuracy);
        const addr = await reverseAddress(lat, lon);
        setState('ok');
        onChange({
          ...value,
          lat,
          lon,
          acc,
          address: addr || value.address,
          adjusted: false,
        });
      },
      (e) => setState(e.code === 1 ? 'denied' : 'failed'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }

  useEffect(() => {
    if (value.lat == null) {
      locate();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMapClick = async (newLat, newLon) => {
    const addr = await reverseAddress(newLat, newLon);
    onChange({
      ...value,
      lat: newLat,
      lon: newLon,
      acc: 30,
      address: addr || value.address,
      adjusted: true,
    });
  };

  const centerLat = value.lat != null ? value.lat : 16.5787;
  const centerLon = value.lon != null ? value.lon : 82.0061;

  return (
    <div className="locpick" id="location">
      <h3 style={{ margin: '0 0 0.5rem 0' }}>{vt('location')}</h3>
      {spokenLocation && (
        <p className="spoken-note" id="spoken-location">
          {vt('you_mentioned', { p: spokenLocation })}
        </p>
      )}
      {state === 'finding' && <p className="hint-text">{vt('getting_location')}</p>}
      {(state === 'denied' || state === 'failed') && (
        <p className="warn" id="gps-denied">
          {vt('gps_denied')}
        </p>
      )}

      <div style={{ height: '240px', borderRadius: '8px', overflow: 'hidden' }}>
        <InteractiveMap
          center={[centerLat, centerLon]}
          zoom={15}
          height="240px"
          selectable={true}
          selectedLocation={value.lat != null ? [value.lat, value.lon] : null}
          onLocationSelect={handleMapClick}
        />
      </div>

      <p className="hint-text">{vt('move_pin')}</p>
      {value.address && (
        <p id="address" style={{ margin: '0.25rem 0', fontSize: '0.95rem' }}>
          <b>{value.address}</b>
          {value.adjusted ? ` · ${vt('pin_moved')}` : ''}
        </p>
      )}
      <button type="button" className="btn small ghost" id="relocate" onClick={locate}>
        {vt('get_location')}
      </button>
      <label className="field">
        {vt('landmark')}
        <input
          id="landmark"
          value={value.landmark || ''}
          maxLength={200}
          onChange={(e) => onChange({ ...value, landmark: e.target.value })}
          placeholder="Near temple / school / bus stop"
        />
      </label>
    </div>
  );
}

export function CitizenSignIn({ vt, VBi, onDone }) {
  const [phone, setPhone] = useState('9876543210');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('phone');
  const [error, setError] = useState('');
  const [devCode, setDevCode] = useState(null);
  const [busy, setBusy] = useState(false);

  async function send(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await request('/auth/citizen/request-otp', { method: 'POST', json: { phone } });
      setStep('code');
      setDevCode(r.devCode || null);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  async function verify(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await request('/auth/citizen/verify-otp', { method: 'POST', json: { phone, code } });
      auth.set({ token: r.token, phone: r.phone });
      onDone();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <form className="signin" id="signin" onSubmit={step === 'phone' ? send : verify}>
      <h2 style={{ margin: '0 0 0.5rem 0' }}>
        <VBi k="sign_in" />
      </h2>
      <p className="hint-text">{vt('signin_why')}</p>
      <label className="field">
        {vt('phone')}
        <input
          id="signin-phone"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={step === 'code'}
          required
        />
      </label>
      {step === 'code' && (
        <label className="field">
          {vt('enter_code')}
          <input
            id="signin-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
          />
        </label>
      )}
      {devCode && <p className="hint-text">Demo mode code: {devCode}</p>}
      {error && (
        <p className="warn" role="alert">
          {error}
        </p>
      )}
      <button className="btn" type="submit" id="signin-submit" disabled={busy}>
        {vt(step === 'phone' ? 'send_code' : 'verify')}
      </button>
    </form>
  );
}
