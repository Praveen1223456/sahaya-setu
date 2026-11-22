/* Microphone, speech recognition, recording and speech synthesis.
   Nothing records in the background: every session starts from a button press and stops on Stop,
   on leaving the screen, or after a time limit. */
import { useCallback, useEffect, useRef, useState } from 'react';

const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
const ERRORS = {
  'not-allowed': 'denied',
  'service-not-allowed': 'denied',
  'no-speech': 'nospeech',
  'audio-capture': 'nomic',
  network: 'network',
  'language-not-supported': 'lang',
};

export const store = {
  get: (k, d = null) => {
    try {
      const v = localStorage.getItem(`ss.${k}`);
      return v === null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(`ss.${k}`, JSON.stringify(v));
    } catch {
      /* storage full */
    }
  },
  del: (k) => {
    try {
      localStorage.removeItem(`ss.${k}`);
    } catch {
      /* ignore */
    }
  },
};

export const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export async function request(path, { method = 'GET', json, form, headers = {}, timeout = 15000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  const h = { ...headers };
  if (json !== undefined) h['content-type'] = 'application/json';
  try {
    const res = await fetch(path, {
      method,
      headers: h,
      body: json !== undefined ? JSON.stringify(json) : form,
      signal: ctrl.signal,
    });
    const body = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
    if (!res.ok) {
      const err = new Error((body && (body.detail || body.error)) || res.statusText);
      err.status = res.status;
      throw err;
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function askMicrophone() {
  if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('nomic'), { code: 'nomic' });
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return stream;
  } catch (e) {
    throw Object.assign(new Error(e.name), {
      code: e.name === 'NotFoundError' || e.name === 'NotReadableError' ? 'nomic' : 'denied',
    });
  }
}

/** Browser speech recognition (Web Speech API). Works in Chrome and Edge (needs internet); not in Firefox. */
export function useRecognizer() {
  const [state, setState] = useState('idle'); // idle | requesting | listening
  const [interim, setInterim] = useState('');
  const [finalText, setFinalText] = useState('');
  const [error, setError] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const rec = useRef(null);
  const busy = useRef(false);
  const timer = useRef(null);
  const heard = useRef(false);

  useEffect(() => () => {
    try {
      rec.current?.abort();
    } catch {
      /* ignore */
    }
    clearInterval(timer.current);
  }, []);

  const start = useCallback(async (lang) => {
    if (!SR) {
      setError('unsupported');
      return;
    }
    if (busy.current) return;
    busy.current = true;
    setError(null);
    setInterim('');
    setFinalText('');
    setState('requesting');
    try {
      (await askMicrophone()).getTracks().forEach((t) => t.stop());
    } catch (e) {
      busy.current = false;
      setState('idle');
      setError(e.code);
      return;
    }
    const r = new SR();
    r.lang = lang;
    r.interimResults = true;
    r.continuous = true;
    r.maxAlternatives = 1;
    heard.current = false;
    let finals = '';
    r.onresult = (e) => {
      let partial = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finals += `${res[0].transcript} `;
        else partial += res[0].transcript;
      }
      heard.current = true;
      setFinalText(finals.trim());
      setInterim(partial);
    };
    r.onerror = (e) => {
      if (e.error !== 'aborted') setError(ERRORS[e.error] || 'failed');
    };
    r.onend = () => {
      clearInterval(timer.current);
      busy.current = false;
      rec.current = null;
      setState('idle');
      setInterim('');
      if (!heard.current) setError((err) => err || 'nospeech');
    };
    rec.current = r;
    const t0 = Date.now();
    setSeconds(0);
    timer.current = setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      setSeconds(s);
      if (s >= 90) r.stop(); // auto-stop after 90 seconds
    }, 250);
    try {
      r.start();
      setState('listening');
    } catch {
      clearInterval(timer.current);
      busy.current = false;
      setState('idle');
      setError('failed');
    }
  }, []);

  const stop = useCallback(() => {
    try {
      rec.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const abort = useCallback(() => {
    try {
      rec.current?.abort();
    } catch {
      /* ignore */
    }
  }, []);

  return { supported: Boolean(SR), state, interim, finalText, error, setError, seconds, start, stop, abort };
}

/** Records audio for the server speech-to-text fallback. Max 60 seconds. */
export function useAudioRecorder() {
  const [state, setState] = useState('idle'); // idle | recording
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState(null);
  const rec = useRef(null);
  const stream = useRef(null);
  const timer = useRef(null);
  const done = useRef(null);
  const cleanup = () => {
    clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };

  useEffect(() => () => {
    try {
      rec.current?.state === 'recording' && rec.current.stop();
    } catch {
      /* ignore */
    }
    cleanup();
  }, []);

  const supported = typeof window !== 'undefined' && 'MediaRecorder' in window;

  const start = useCallback(async () => {
    if (!supported) {
      setError('unsupported');
      return;
    }
    if (rec.current?.state === 'recording') return;
    setError(null);
    try {
      stream.current = await askMicrophone();
    } catch (e) {
      setError(e.code);
      return;
    }
    const type = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find((t) =>
      MediaRecorder.isTypeSupported?.(t)
    ) || '';
    const r = new MediaRecorder(stream.current, type ? { mimeType: type } : undefined);
    const chunks = [];
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = () => {
      cleanup();
      setState('idle');
      done.current?.(new Blob(chunks, { type: r.mimeType || 'audio/webm' }));
    };
    rec.current = r;
    r.start();
    const t0 = Date.now();
    setSeconds(0);
    setState('recording');
    timer.current = setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      setSeconds(s);
      if (s >= 60) r.stop();
    }, 250);
  }, [supported]);

  const stop = useCallback(() => new Promise((resolve) => {
    if (rec.current?.state !== 'recording') {
      resolve(null);
      return;
    }
    done.current = resolve;
    rec.current.stop();
  }), []);

  return { supported, state, seconds, error, setError, start, stop };
}

/** Spoken guidance with the browser's SpeechSynthesis in the chosen language. */
export function useSpeaker(lang) {
  const [muted, setMuted] = useState(store.get('voiceMuted', false));
  const [voices, setVoices] = useState([]);
  const ok = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    if (!ok) return undefined;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener?.('voiceschanged', load);
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', load);
      window.speechSynthesis.cancel();
    };
  }, [ok]);

  const voice =
    voices.find((v) => v.lang.replace('_', '-') === lang) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2)));

  const speak = useCallback(
    (text) => {
      if (!ok || muted || !voice || !text) return false;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = voice.lang;
      u.voice = voice;
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
      return true;
    },
    [ok, muted, voice]
  );

  const silence = useCallback(() => {
    if (ok) window.speechSynthesis.cancel();
  }, [ok]);

  const toggle = () => {
    const m = !muted;
    setMuted(m);
    store.set('voiceMuted', m);
    if (m) silence();
  };

  return { speak, silence, muted, toggle, hasVoice: Boolean(voice) };
}

// ---------------------------------------------------------------- Citizen sign-in token
export const auth = {
  get: () => {
    const direct = store.get('citizenAuth', null);
    if (direct && direct.token) return direct;
    // Check if the main Sahaya Setu user session is already logged in
    try {
      const mainToken = localStorage.getItem('token');
      const mainUser = localStorage.getItem('user');
      if (mainToken) {
        const u = mainUser ? JSON.parse(mainUser) : null;
        return { token: mainToken, phone: u?.phone || 'Citizen' };
      }
    } catch {}
    return null;
  },
  set: (v) => store.set('citizenAuth', v),
  clear: () => {
    store.del('citizenAuth');
  },
};

export const authed = (path, opts = {}) => {
  const a = auth.get();
  return request(path, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: `Bearer ${a?.token || ''}` },
  });
};
