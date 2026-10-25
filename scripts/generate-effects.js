// יוצר אפקטים קוליים וקטע מוזיקת רקע ללא קבצים חיצוניים, ללא תלויות.
// הפלט: קבצי WAV מונו, 8000 הרץ, 16 ביט - פורמט שמתאים לטלפוניה.
// שימוש:  node scripts/generate-effects.js [תיקיית_יעד]
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 8000;
const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2] || join(here, '..', 'audio', 'effects');
mkdirSync(outDir, { recursive: true });

// מחולל רעש דטרמיניסטי כדי שהתוצאה תהיה זהה בכל הרצה
let seed = 1234567;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;

function buffer(seconds, fn) {
  const n = Math.floor(seconds * RATE);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / RATE, i);
  return out;
}

const env = (t, attack, decay) => Math.min(1, t / attack) * Math.exp(-t / decay);

const effects = {
  // חריקת דלת: גל שמתחתיים בתדר יורד עם רעש
  door_creak: () => buffer(1.8, t => {
    const f = 260 - 120 * (t / 1.8) + 15 * Math.sin(2 * Math.PI * 7 * t);
    return 0.35 * Math.sin(2 * Math.PI * f * t) * Math.min(1, t / 0.1) * (1 - t / 1.8) + 0.05 * rnd();
  }),
  // צליל פעמון לתשובה נכונה
  chime: () => buffer(1.4, t => 0.4 * env(t, 0.005, 0.45) * (Math.sin(2 * Math.PI * 880 * t) + 0.5 * Math.sin(2 * Math.PI * 1320 * t))),
  // זמזם לתשובה שגויה
  error_buzz: () => buffer(0.7, t => 0.3 * Math.sign(Math.sin(2 * Math.PI * 170 * t)) * (t < 0.6 ? 1 : 0) * Math.min(1, t / 0.01)),
  // תקתוק שעון
  tick: () => buffer(0.25, t => 0.5 * env(t, 0.001, 0.02) * rnd()),
  // פעימות לב בחדר המסתורי
  heartbeat: () => buffer(1.6, t => {
    const beat = (c) => 0.5 * env(t - c, 0.01, 0.06) * Math.sin(2 * Math.PI * 55 * (t - c)) * (t >= c ? 1 : 0);
    return beat(0.1) + beat(0.45);
  }),
  // רוח בחלון
  wind: () => {
    let lp = 0;
    return buffer(3.0, t => {
      lp = lp * 0.97 + rnd() * 0.03;
      return 0.9 * lp * Math.sin(Math.PI * t / 3.0);
    });
  },
  // פתיחת דלת נסתרת: מתכת מתכווצת
  hatch_open: () => buffer(1.2, t => {
    const f = 90 + 500 * (t / 1.2) ** 2;
    return 0.3 * Math.sin(2 * Math.PI * f * t) * (1 - t / 1.2) + 0.04 * rnd() * (t < 0.2 ? 1 : 0);
  }),
  // פנפרה קצרה לסיום
  fanfare: () => {
    const notes = [523, 659, 784, 1047];
    return buffer(2.4, t => {
      const i = Math.min(notes.length - 1, Math.floor(t / 0.5));
      const tt = t - i * 0.5;
      return 0.3 * env(tt, 0.01, 0.35) * Math.sin(2 * Math.PI * notes[i] * tt);
    });
  },
  // פעמון כבד סופי
  final_bell: () => buffer(4.0, t => 0.35 * env(t, 0.01, 1.4) * (Math.sin(2 * Math.PI * 196 * t) + 0.6 * Math.sin(2 * Math.PI * 392 * t) + 0.3 * Math.sin(2 * Math.PI * 587 * t))),
  // קטע רקע מסתורי: אקורד מיתר נמוך עם הרחבה איטית, מיועד ללולאה
  ambient_drone: () => buffer(12, t => {
    const chord = [110, 138.6, 164.8];
    let s = 0;
    for (const f of chord) s += Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * f * 2 * t);
    const swell = 0.6 + 0.4 * Math.sin(2 * Math.PI * t / 12);
    return 0.08 * swell * s / chord.length;
  }),
};

function toWav(samples) {
  const dataBytes = samples.length * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);          // PCM
  buf.writeUInt16LE(1, 22);          // מונו
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32000), 44 + i * 2);
  }
  return buf;
}

for (const [name, gen] of Object.entries(effects)) {
  const file = join(outDir, `${name}.wav`);
  writeFileSync(file, toWav(gen()));
  console.log('נוצר:', file);
}
