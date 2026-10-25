// נקודת הקצה ש-ימות המשיח קוראת לה: https://escape-room-ivr.vercel.app/api/ivr
// הגדרות השלוחה (type=api, api_link) מפורטות ב-README.
// ימות המשיח שולחת פרמטרים: ApiPhone, ApiCallId, ApiExtension, in (ההקשה האחרונה),
// ובנוסף הפרמטרים הקבועים שמוגדרים בשלוחה ב-api_add_X, למשל advanced_audio ו-ym_token.
import { step, newState } from '../lib/engine.js';
import { MESSAGES } from '../lib/game.js';
import { readAction, resolveAudioBase } from '../lib/yemot.js';
import { loadState, saveState } from '../lib/store.js';
import { listAudioFiles } from '../lib/audio-list.js';

function params(req) {
  if (req.method === 'POST') {
    const body = req.body;
    if (body && typeof body === 'object') return { ...req.query, ...body };
    if (typeof body === 'string') return { ...req.query, ...Object.fromEntries(new URLSearchParams(body)) };
  }
  return req.query || {};
}

function send(res, status, text) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(text);
}

export default async function handler(req, res) {
  const p = params(req);

  // ניתוק שיחה: שומרים את ההתקדמות ומסיימים.
  if (p.hangup === 'yes') {
    try {
      const phone = p.ApiPhone || p.ApiCallId;
      if (phone) {
        const current = (await loadState(phone)) || newState();
        await saveState(phone, current);
      }
    } catch (e) {
      console.error('hangup save failed', e.message);
    }
    return send(res, 200, 'noop=hangup');
  }

  const phone = String(p.ApiPhone || p.ApiCallId || 'anonymous').replace(/[^0-9A-Za-z_-]/g, '').slice(0, 64);
  const input = p.in ?? '';

  try {
    const saved = (await loadState(phone)) || newState();
    const result = step(saved, input);
    await saveState(phone, result.state);

    // הגדרות השלוחה: מצב השמעה מתקדם, והטוקן המתקדם (נדרש רק במצב מתקדם)
    const advanced = p.advanced_audio === 'yes';
    const base = resolveAudioBase(p.ApiExtension);
    let available = null;
    if (advanced) {
      available = p.ym_token ? await listAudioFiles(p.ym_token, base || '') : new Set();
    }

    return send(res, 200, readAction(result.parts, { advanced, base, available }));
  } catch (err) {
    // שגיאה בשמירה או ברשת: לא מנתקים את המתקשר, מבקשים הקשה מחדש.
    console.error('ivr error', err && err.message);
    return send(res, 200, readAction([{ key: 'error', text: MESSAGES.error }]));
  }
}
