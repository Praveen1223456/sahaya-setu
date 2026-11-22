/* "Report an Issue Using Voice": language -> speak -> edit -> check -> review + location -> submit.
   The AI only suggests; the citizen confirms, and the complaint goes into the normal complaint pipeline. */
import React, { useEffect, useMemo, useState } from 'react';
import { makeVT } from './strings';
import { useSpeaker, auth, authed, store, request } from './hooks';
import {
  LanguageSelector,
  VoiceAssistant,
  VoiceRecorder,
  TranscriptionEditor,
  ComplaintAnalysisCard,
  LocationPicker,
  CitizenSignIn,
} from './components';
import './voice.css';

export default function VoiceComplaintForm({ onTicketCreated, onBack }) {
  const [lang, setLang] = useState(store.get('voiceLang', null));
  const { vt, VBi, short } = useMemo(() => makeVT(lang || 'en-IN'), [lang]);
  const speaker = useSpeaker(lang || 'en-IN');
  const [signedIn, setSignedIn] = useState(Boolean(auth.get()));
  const [caps, setCaps] = useState(null);
  const [recorderKey, setRecorderKey] = useState(0);
  const [listening, setListening] = useState(false);
  const [text, setText] = useState('');
  const [heard, setHeard] = useState('');
  const [interim, setInterim] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', category: '', severity: 'MEDIUM' });
  const [loc, setLoc] = useState({ lat: null, lon: null, acc: null, address: '', adjusted: false, landmark: '' });
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const [message, setMessage] = useState('choose_lang');

  useEffect(() => {
    request('/voice/capabilities', { timeout: 6000 })
      .then(setCaps)
      .catch(() => {});
  }, []);

  const pickLang = (l) => {
    setLang(l);
    store.set('voiceLang', l);
    setMessage('describe');
  };

  const restart = () => {
    setText('');
    setHeard('');
    setInterim('');
    setAnalysis(null);
    setError(null);
    setRecorderKey((k) => k + 1);
    setMessage('describe');
  };

  async function check() {
    setBusy(true);
    setError(null);
    try {
      const a = await authed('/voice/analyze', {
        method: 'POST',
        json: { text, language: lang },
        timeout: 30000,
      });
      setAnalysis(a);
      setForm({
        title: a.title,
        description: a.description,
        category: a.needsManualCategory ? '' : a.category,
        severity: a.severity,
      });
      setMessage('confirm');
    } catch (e) {
      if (e.status === 401) {
        auth.clear();
        setSignedIn(false);
      }
      setError(vt('err_analyze'));
      setAnalysis({ source: 'none', needsManualCategory: true, priority: null, safetyWarning: null });
      setForm({ title: '', description: text, category: '', severity: 'MEDIUM' });
    }
    setBusy(false);
  }

  async function submit() {
    if (!form.category || form.title.trim().length < 3 || form.description.trim().length < 3) {
      setError(vt('choose_category'));
      return;
    }
    if (loc.lat == null && !loc.landmark.trim()) {
      setError(vt('need_location'));
      return;
    }
    setBusy(true);
    setError(null);
    const clientReportId = `VOICE-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const meta = {
      clientReportId,
      language: lang,
      transcription: (heard || text).slice(0, 2000),
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      severity: form.severity,
      aiClassification:
        analysis?.source && analysis.source !== 'none'
          ? {
              source: analysis.source,
              category: analysis.category,
              severity: analysis.severity,
              priority: analysis.priority,
              confidence: analysis.confidence,
              title: analysis.title,
            }
          : null,
      lat: loc.lat != null ? +loc.lat.toFixed(6) : null,
      lon: loc.lon != null ? +loc.lon.toFixed(6) : null,
      gpsAccuracyM: loc.acc,
      address: loc.address || null,
      landmark: loc.landmark.trim() || null,
      locationAdjusted: loc.adjusted,
      spokenLocation: analysis?.locationMentioned || null,
    };
    const fd = new FormData();
    fd.append('meta', JSON.stringify(meta));
    if (photo) fd.append('photo', photo, 'photo.jpg');
    try {
      const r = await authed('/complaints/voice', { method: 'POST', form: fd, timeout: 60000 });
      setDone(r);
      setMessage('submitted');
      if (onTicketCreated) onTicketCreated(r);
    } catch (e) {
      if (e.status === 401) {
        auth.clear();
        setSignedIn(false);
      }
      setError(vt('err_submit', { e: e.message }));
    }
    setBusy(false);
  }

  let body;
  if (!lang) {
    body = null;
  } else if (!signedIn) {
    body = <CitizenSignIn vt={vt} VBi={VBi} onDone={() => setSignedIn(true)} />;
  } else if (done) {
    body = (
      <div className="result" id="voice-done">
        <h2>
          <VBi k="submitted" />
        </h2>
        <p className="ticket-code">{done.ticketCode}</p>
        {done.duplicateWarning && (
          <p className="warn" id="duplicate">
            {done.duplicateWarning}
          </p>
        )}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setDone(null);
              restart();
            }}
          >
            {vt('new_complaint')}
          </button>
          {onBack && (
            <button type="button" className="btn ok" onClick={onBack}>
              {vt('view_ticket')}
            </button>
          )}
        </div>
      </div>
    );
  } else {
    body = (
      <>
        <VoiceAssistant vt={vt} VBi={VBi} speaker={speaker} message={message} quiet={listening} />
        <VoiceRecorder
          key={recorderKey}
          lang={lang}
          vt={vt}
          VBi={VBi}
          caps={caps}
          disabled={busy}
          onStart={() => {
            speaker.silence();
            setListening(true);
            setAnalysis(null);
            setError(null);
          }}
          onText={(t) => {
            setText(t);
            setHeard(t);
          }}
          onLive={setInterim}
          onFinished={() => {
            setListening(false);
            setMessage('recognized');
          }}
        />
        <TranscriptionEditor
          vt={vt}
          VBi={VBi}
          value={text}
          interim={interim}
          onChange={(v) => {
            setText(v);
            setAnalysis(null);
          }}
          onRetry={restart}
          onClear={restart}
        />
        {!analysis && (
          <button
            type="button"
            className="btn big"
            id="analyze"
            disabled={busy || text.trim().length < 3}
            onClick={check}
          >
            {vt(busy ? 'analyzing' : 'analyze')}
          </button>
        )}
        {error && (
          <p className="warn" role="alert" id="voice-error">
            {error}
          </p>
        )}
        {analysis && (
          <>
            <ComplaintAnalysisCard
              vt={vt}
              short={short}
              analysis={analysis}
              form={form}
              setForm={setForm}
            />
            <LocationPicker
              vt={vt}
              value={loc}
              onChange={setLoc}
              spokenLocation={analysis.locationMentioned}
            />
            <label className="field" style={{ margin: '1rem 0' }}>
              {vt('photo_optional')}
              <input
                type="file"
                id="voice-photo"
                accept="image/*"
                capture="environment"
                onChange={(e) => setPhoto(e.target.files[0] || null)}
              />
            </label>
            <button
              type="button"
              className="btn ok big"
              id="voice-submit"
              disabled={busy}
              onClick={submit}
            >
              {vt(busy ? 'submitting' : 'submit')}
            </button>
          </>
        )}
      </>
    );
  }

  const a = auth.get();
  return (
    <section id="s-voice" className="voice">
      <h1>
        <VBi k="title_report" />
      </h1>
      <LanguageSelector value={lang} onChange={pickLang} disabled={listening} />
      {!lang && (
        <p className="assistant-msg">
          <VBi k="choose_lang" />
        </p>
      )}
      {body}
      {signedIn && a && (
        <p className="hint-text signed" style={{ marginTop: '1rem' }}>
          {vt('signed_in_as', { p: a.phone })} ·{' '}
          <button
            type="button"
            className="linkish"
            onClick={() => {
              auth.clear();
              setSignedIn(false);
            }}
          >
            {vt('sign_out')}
          </button>
        </p>
      )}
    </section>
  );
}
