// בניית תגובות לימות המשיח (טקסט פשוט, שורה אחת).
// תגובה לשרת = פעולה אחת. כאן תמיד נשתמש ב-read: השמעה + קבלת הקשה,
// וימות המשיח שולחת את ההקשה חזרה לשרת בפרמטר בשם "in".
//
// AUDIO_MODE:
//   tts  (ברירת מחדל) - הקראה ממוחשבת של ימות המשיח מתוך הטקסט.
//   file - השמעת קבצי WAV שהועלו לשלוחה תחת השם של המזהה (למשל r1_p1.wav).
//          קבצים שחסרים מוחלפים אוטומטית בהקראה, כדי שהמשחק לא ייתקע.

const AUDIO_MODE = (process.env.AUDIO_MODE || 'tts').toLowerCase();

// השורה שתיווצר: read=<השמעה>=in,,<מינימום>,<מקסימום>,Digits,no
// שימו לב: סדר השדות חייב להיבדק מול מסמך ה-read של ימות המשיח לפני פרסום
// (ראו README, סעיף "בדיקת הגדרות בטלפון").
export function readAction({ key, text, min = 1, max = 4 }) {
  const prompt = AUDIO_MODE === 'file' && key ? `f-${key}` : `t-${text}`;
  return `read=${prompt}=in,,${min},${max},Digits,no`;
}

// פעולה לסיום שיחה
export function hangupAction() {
  return 'go_to_folder=hangup';
}
