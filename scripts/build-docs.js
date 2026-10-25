// מייצר את VOICE_GUIDE.md ו-AUDIO_FILES.md ישירות מתוך lib/game.js.
// הטקסטים בקבצים זהים למה שהמשחק משמיע, ותמיד מעודכנים.
// שימוש: node scripts/build-docs.js
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOMS, allNarrationKeys } from '../lib/game.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const EFFECTS = [
  'door_creak', 'chime', 'error_buzz', 'tick', 'heartbeat',
  'wind', 'hatch_open', 'fanfare', 'final_bell', 'ambient_drone',
];

const VOICE_HEAD = `# קריינות מלאה - הסוד של אחוזת בלקווד

## הנחיות סגנון לקריין
- **קול:** גבר בוגר, ברור ומדויק, עם נימה רגועה ומעט מסתורית. לא דרמטי מדי, לא מתנשא.
- **טון:** שקט ומכובד. המתקשר הוא החוקר, והקריין מדבר אליו בעניין ובכבוד.
- **קצב:** איטי ומדיטטיבי. הפסקה קצרה אחרי נקודה. הפסקה ארוכה יותר אחרי משפט שמסמן רמז.
- **רגש:** בתיאורי החדרים - מתח עדין, בלי להפחיד. בהוראות ("הקישו", "סולמית") - בהירות מלאה, בלי רגש מוגזם. בסיום - חום וסיפוק.
- **הגייה:** מספרים להקריא במלואם ("שתים עשרה", "אלף שמונה מאות חמישים ושבע"). אותיות לועזיות - לא קיימות בטקסטים.
- **הקלטה:** קובץ WAV, 8,000 הרץ, מונו, 16 ביט. רמת שקט נמוכה, בלי רעשי רקע ובלי נשימות חזקות.
- **נאמנות לטקסט:** להקריא בדיוק את המילים שכתובות. כל שינוי משנה את החידה או את הסיפור.
- **שם הקובץ:** ההקלטה נשמרת בשם המדויק שבכותרת, למשל \`r1_intro.wav\`, והיא מועלית לתיקייה \`audio\` שבתוך השלוחה.

---

`;

let voice = VOICE_HEAD;
let lastSection = '';
for (const item of allNarrationKeys()) {
  if (item.section !== lastSection) {
    voice += `## ${item.section}\n\n`;
    lastSection = item.section;
  }
  voice += `### \`${item.key}.wav\`\n\n${item.text}\n\n`;
  // רמזים מושמעים רק בלחיצה על 99 ולכן נכתבים לקריינות בנפרד
  const room = ROOMS.find(r => item.key.startsWith(`r${r.id}_p`));
  if (room && /^r\d+_p\d+$/.test(item.key)) {
    const puzzle = room.puzzles.find(p => p.id === item.key);
    if (puzzle) voice += `*רמז (מושמע בלחיצה על 99, ואוטומטית אחרי שלוש טעויות):* ${puzzle.hint}\n\n`;
  }
}
writeFileSync(join(root, 'VOICE_GUIDE.md'), voice, 'utf8');

let audio = `# רשימת קובצי השמע

## איפה להעלות
צרו בתוך השלוחה שבה הוגדר המודול תיקייה בשם \`audio\`, והעלו לתוכה את כל הקבצים מהרשימה.
לדוגמה: אם השלוחה היא \`/3\`, הקבצים נכנסים ל-\`/3/audio/\`.

הקבצים מושמעים רק במצב **קריינות מתקדמת**, שמופעל בהגדרת השלוחה \`advanced_audio=yes\`.
במצב רגיל, ימות המשיח מקריאה את הטקסטים בעצמה, ואין צורך בהעלאת קבצים.
קובץ שחסר בתיקייה מוקרא אוטומטית בהקראה רגילה, כך שהמשחק לא ייתקע.

## קובצי הקריינות

| שם הקובץ (\`.wav\`) | חלק במשחק |
|---|---|
${allNarrationKeys().map(i => `| \`${i.key}.wav\` | ${i.section} |`).join('\n')}

## אפקטים קוליים
נוצרים בעזרת \`node scripts/generate-effects.js\` ונשמרים גם הם בתיקייה \`audio\`.
**הערה:** בגרסה זו האפקטים אינם מחוברים אוטומטית לזרימת השיחה, כי ימות המשיח מנגנת בכל תגובה קריינה אחת. ניתן לשלבם בשלוחה נפרדת.

| שם הקובץ | אפקט |
|---|---|
${EFFECTS.map(e => `| \`${e}.wav\` | ${e} |`).join('\n')}

## בדיקה לאחר העלאה
- השמיעו כל קובץ בטלפון אחד לפחות.
- שמות הקבצים רגישים לאותיות גדולות וקטנות.
`;
writeFileSync(join(root, 'AUDIO_FILES.md'), audio, 'utf8');
console.log('נוצרו VOICE_GUIDE.md ו-AUDIO_FILES.md');
