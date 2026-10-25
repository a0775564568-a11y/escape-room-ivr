// בניית תגובות לימות המשיח (טקסט פשוט, שורה אחת).
// תגובה לשרת = פעולה אחת: read - השמעה ואז קבלת הקשה. ימות המשיח שולחת את ההקשה
// לשרת בפרמטר בשם "in".
//
// שני מצבי השמעה, לפי הגדרה בשלוחה (api_add_0=advanced_audio=yes):
//   רגיל (ברירת מחדל): הקראה ממוחשבת של ימות המשיח, t-<טקסט>.
//   מתקדם: השמעת קבצי WAV מתיקיית audio שבתוך השלוחה, f-/<שלוחה>/audio/<שם>.
//          קובץ שחסר בתיקייה מוקרא בהקראה רגילה, כדי שהמשחק לא ייתקע.
//
// מספר קטעים בתגובה מחוברים בנקודה, לפי פורמט הרצפים של ימות המשיח.

export function resolveAudioBase(apiExtension) {
  // ApiExtension מגיע כמו "/3" או "3". מחזירים "/3" (ללא לוכסן בסוף)
  const raw = String(apiExtension || '').trim();
  if (!raw || raw === '/') return '';
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  return withSlash.replace(/\/+$/, '');
}

// parts: מערך של { key, text }
// options: { advanced: boolean, base: string, available: Set<string> | null }
export function buildPrompt(parts, { advanced = false, base = '', available = null } = {}) {
  return parts.map(part => {
    const useFile = advanced && part.key && available && available.has(part.key);
    if (useFile) return `f-${base}/audio/${part.key}`;
    return `t-${part.text}`;
  }).join('.');
}

export function readAction(parts, options = {}, { min = 1, max = 4 } = {}) {
  return `read=${buildPrompt(parts, options)}=in,,${min},${max},Digits,no`;
}
