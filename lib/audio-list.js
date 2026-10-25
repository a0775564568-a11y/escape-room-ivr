// בודק אילו קובצי שמע קיימים בתיקיית audio שבתוך השלוחה, באמצעות ה-API של ימות המשיח
// (פקודת GetIVR2Dir). משתמשים בטוקן המתקדם שהוגדר בשלוחה (ym_token).
// התוצאה נשמרת במטמון זמני כדי לא לשאול את ימות המשיח בכל הקשה.
import { createHash } from 'node:crypto';

const CACHE_MS = 5 * 60 * 1000;
const cache = globalThis.__blackwoodAudioCache || (globalThis.__blackwoodAudioCache = new Map());

function cacheKey(token, base) {
  return createHash('sha256').update(`${token}|${base}`).digest('hex');
}

// מחזיר Set של שמות קבצים (בלי .wav). במקרה של כשל מחזיר Set ריק, כך שהמשחק יקריא בטקסט.
export async function listAudioFiles(token, base) {
  const key = cacheKey(token, base);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.names;

  const names = new Set();
  try {
    const res = await fetch('https://www.call2all.co.il/ym/api/GetIVR2Dir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, path: `${base}/audio` }),
      signal: AbortSignal.timeout(4000),
    });
    const data = await res.json();
    if (data.responseStatus === 'OK') {
      const files = data.files || [];
      for (const f of files) {
        const name = typeof f === 'string' ? f : f.name;
        if (name) names.add(String(name).replace(/\.wav$/i, ''));
      }
    } else {
      console.error('GetIVR2Dir status', data.responseStatus, data.messageCode ?? '');
    }
  } catch (err) {
    console.error('GetIVR2Dir failed', err && err.message);
  }
  cache.set(key, { at: Date.now(), names });
  return names;
}
