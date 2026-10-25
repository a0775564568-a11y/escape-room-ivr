// שמירת התקדמות ב-Hugging Face Dataset - קובץ נפרד לכל משחק.
//
// מבנה במאגר:
//   games/<gameId>.json      - משחק אחד (נוצר בכל "משחק חדש", ומתעדכן בכל הקשה)
//   players/<hash>.json      - מצביע קטן: מזהה המשחק הנוכחי של אותו מספר טלפון
// מספר הטלפון לא נשמר בשם הקובץ, אלא כ-hash (SHA-256), כדי לא לחשוף אותו במאגר.
//
// משתני סביבה:
//   HF_TOKEN    - טוקן של Hugging Face עם הרשאת כתיבה (Write)
//   HF_DATASET  - שם המאגר, למשל "your-user/blackwood-saves"
// אם אינם מוגדרים, המשחק שומר בזיכרון השרת בלבד (לבדיקות).
import { createHash, randomUUID } from 'node:crypto';

const HF_TOKEN = process.env.HF_TOKEN;
const HF_DATASET = process.env.HF_DATASET;
const HF_BASE = 'https://huggingface.co';

// גיבוי בזיכרון לבדיקות ולמקרה שאין הגדרת HF
const memoryFiles = globalThis.__blackwoodFiles || (globalThis.__blackwoodFiles = new Map());
// מטמון לשיחה הנוכחית: מונע קריאה של נתון ישן מה-CDN של HF מיד אחרי כתיבה
const recent = globalThis.__blackwoodRecent || (globalThis.__blackwoodRecent = new Map());

const useHF = Boolean(HF_TOKEN && HF_DATASET);

const playerPath = phone => `players/${createHash('sha256').update(String(phone)).digest('hex')}.json`;
const gamePath = gameId => `games/${gameId}.json`;

async function getFile(path) {
  if (!useHF) return memoryFiles.get(path) ?? null;
  const res = await fetch(`${HF_BASE}/datasets/${HF_DATASET}/resolve/main/${path}`, {
    headers: { Authorization: `Bearer ${HF_TOKEN}`, 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(4000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`hf read ${res.status}`);
  return res.json();
}

// כתיבה אטומית של כמה קבצים בקומיט אחד. מנסה שוב בהתנגשויות/עומס.
async function commit(files, summary) {
  if (!useHF) {
    for (const [path, obj] of Object.entries(files)) memoryFiles.set(path, JSON.parse(JSON.stringify(obj)));
    return;
  }
  const lines = [JSON.stringify({ key: 'header', value: { summary } })];
  for (const [path, obj] of Object.entries(files)) {
    const content = Buffer.from(JSON.stringify(obj, null, 2), 'utf8').toString('base64');
    lines.push(JSON.stringify({ key: 'file', value: { path, content, encoding: 'base64' } }));
  }
  const body = lines.join('\n');

  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${HF_BASE}/api/datasets/${HF_DATASET}/commit/main`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/x-ndjson' },
      body,
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return;
    lastErr = new Error(`hf commit ${res.status}`);
    if (![409, 429, 500, 502, 503].includes(res.status)) break;
    await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
  }
  throw lastErr;
}

// טוען את המשחק הנוכחי של השחקן (או null אם אין)
export async function loadState(phone) {
  const cached = recent.get(String(phone));
  if (cached) return structuredClone(cached);

  const pointer = await getFile(playerPath(phone));
  if (!pointer?.gameId) return null;
  const game = await getFile(gamePath(pointer.gameId));
  if (!game) return null;
  recent.set(String(phone), game);
  return structuredClone(game);
}

// שומר את המשחק. משחק בלי gameId הוא משחק חדש: נוצר לו קובץ חדש ומצביע מעודכן.
export async function saveState(phone, state) {
  // תפריט לפני תחילת משחק לא יוצר קובץ
  if (!state.started) return;
  const isNew = !state.gameId;
  const gameId = state.gameId || randomUUID();
  const toSave = { ...state, gameId, updated: new Date().toISOString() };

  const files = { [gamePath(gameId)]: toSave };
  if (isNew) files[playerPath(phone)] = { gameId, created: toSave.updated };

  await commit(files, isNew ? `new game ${gameId}` : `update ${gameId}`);
  recent.set(String(phone), toSave);
  // מעדכנים את האובייקט שהתקבל כדי שהקורא ידע את המזהה
  state.gameId = gameId;
}
