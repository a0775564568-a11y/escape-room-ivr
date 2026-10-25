// נקודת הקצה ש-ימות המשיח קוראת לה (type=api). אין בה טוקן של ימות המשיח.
// ימות המשיח שולחת פרמטרים: ApiPhone, ApiCallId, ApiTime, ו-in (ההקשה האחרונה).
import { step, newState } from '../lib/engine.js';
import { readAction, hangupAction } from '../lib/yemot.js';
import { loadState, saveState } from '../lib/store.js';


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

  // הגנה אופציונלית: סוד משותף בין ימות המשיח לשרת (לא טוקן של ימות המשיח).
  // מגדירים IVR_SECRET ב-Vercel ומוסיפים ?k=... בכתובת ה-api_link.
  if (process.env.IVR_SECRET && p.k !== process.env.IVR_SECRET) {
    return send(res, 403, 'noop=forbidden');
  }

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

    return send(res, 200, readAction({ key: result.key, text: result.text, min: 1, max: 4 }));
  } catch (err) {
    // שגיאה בשמירה או ברשת: לא מנתקים את המתקשר, מבקשים הקשה מחדש.
    console.error('ivr error', err && err.message);
    return send(res, 200, readAction({ key: null, text: MESSAGES.error, min: 1, max: 4 }));
  }
}
