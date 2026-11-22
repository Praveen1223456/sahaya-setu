/* "Check My Complaint Status": ask by voice or text; answers only about the signed-in citizen's own complaints. */
import React, { useMemo, useState } from 'react';
import { makeVT } from './strings';
import { useSpeaker, auth, authed, store } from './hooks';
import { LanguageSelector, VoiceAssistant, VoiceRecorder, CitizenSignIn } from './components';
import './voice.css';

export default function VoiceStatusChecker({ onSelectTicket }) {
  const [lang, setLang] = useState(store.get('voiceLang', 'te-IN'));
  const { vt, VBi } = useMemo(() => makeVT(lang), [lang]);
  const speaker = useSpeaker(lang);
  const [signedIn, setSignedIn] = useState(Boolean(auth.get()));
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function ask(ticket = null) {
    setBusy(true);
    setError(null);
    try {
      const r = await authed('/voice/status-query', {
        method: 'POST',
        json: { text, ticket, language: lang },
        timeout: 15000,
      });
      setResult(r);
      speaker.speak(r.answer);
    } catch (e) {
      if (e.status === 401) {
        auth.clear();
        setSignedIn(false);
      }
      setError(e.message);
    }
    setBusy(false);
  }

  return (
    <section id="s-status" className="voice">
      <h1>
        <VBi k="title_status" />
      </h1>
      <LanguageSelector
        value={lang}
        onChange={(l) => {
          setLang(l);
          store.set('voiceLang', l);
        }}
        disabled={listening}
      />
      {!signedIn ? (
        <CitizenSignIn vt={vt} VBi={VBi} onDone={() => setSignedIn(true)} />
      ) : (
        <>
          <VoiceAssistant vt={vt} VBi={VBi} speaker={speaker} message={null} quiet={listening} />
          <p className="assistant-msg">{vt('ask_status')}</p>
          <VoiceRecorder
            lang={lang}
            vt={vt}
            VBi={VBi}
            caps={null}
            onStart={() => {
              speaker.silence();
              setListening(true);
            }}
            onText={(t) => {
              setText(t);
              // auto-query once speech recognition finishes
            }}
            onFinished={() => {
              setListening(false);
            }}
          />
          <div className="ask-row">
            <input
              id="status-question"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && ask()}
              maxLength={500}
              placeholder={vt('ask_status')}
            />
            <button
              type="button"
              className="btn"
              id="status-ask"
              disabled={busy || !text.trim()}
              onClick={() => ask()}
            >
              {vt('ask')}
            </button>
          </div>
          {error && (
            <p className="warn" role="alert">
              {error}
            </p>
          )}
          {result && (
            <div className="status-answer" id="status-answer" aria-live="polite">
              <p className="answer">{result.answer}</p>
              {result.needsSelection && <h3 style={{ margin: '0.75rem 0 0.5rem' }}>{vt('pick_one')}</h3>}
              <ul className="status-list">
                {(result.complaints || []).map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="status-item"
                      data-ticket={c.ticketCode || c.ticket_code}
                      onClick={() => {
                        if (onSelectTicket) onSelectTicket(c);
                        else ask(c.ticketCode || c.ticket_code);
                      }}
                    >
                      <b>{c.ticketCode || c.ticket_code}</b>
                      <span>{c.categoryName || c.category}</span>
                      <span className={`pill st-${c.status}`}>{c.statusText || c.status}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
