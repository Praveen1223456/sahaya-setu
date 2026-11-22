/* Server speech-to-text, used when the browser can't recognise speech itself.
   Provider keys stay on the server. Audio is processed in memory and never written to disk. */
const env = require('../../config/env');

const ALLOWED = [
  'audio/webm',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/x-m4a',
];

const EXT = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/x-m4a': 'm4a',
};

const baseType = (mime) => String(mime || '').split(';')[0].trim().toLowerCase();

const providers = {
  none: {
    name: 'none',
    available: () => false,
    async transcribe() {
      const err = new Error('Server speech-to-text is not set up. Use the browser microphone or type your complaint.');
      err.status = 501;
      throw err;
    },
  },
  'openai-compatible': {
    name: 'openai-compatible',
    available: () => Boolean(env.STT_BASE_URL),
    async transcribe(buffer, mime, language) {
      const type = baseType(mime);
      const form = new FormData();
      form.append('file', new Blob([buffer], { type }), `audio.${EXT[type] || 'webm'}`);
      form.append('model', env.STT_MODEL || 'whisper-1');
      form.append('language', language.slice(0, 2));
      form.append('response_format', 'json');
      let res;
      try {
        res = await fetch(`${env.STT_BASE_URL.replace(/\/$/, '')}/v1/audio/transcriptions`, {
          method: 'POST',
          body: form,
          signal: AbortSignal.timeout(60000),
          headers: env.STT_API_KEY ? { Authorization: `Bearer ${env.STT_API_KEY}` } : {},
        });
      } catch {
        const err = new Error('Could not reach the speech-to-text service. Try again or type your complaint.');
        err.status = 502;
        throw err;
      }
      if (!res.ok) {
        const err = new Error(`The speech-to-text service failed (${res.status}). Try again or type your complaint.`);
        err.status = 502;
        throw err;
      }
      const data = await res.json().catch(() => ({}));
      return { text: String(data.text || '').trim(), provider: 'openai-compatible' };
    },
  },
};

const provider = () => providers[env.STT_PROVIDER] || providers.none;
const isAllowed = (mime) => ALLOWED.includes(baseType(mime));

module.exports = { provider, isAllowed, ALLOWED };
