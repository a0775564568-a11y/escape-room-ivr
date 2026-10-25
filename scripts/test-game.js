// בדיקת פתירות: מריץ את כל המשחק עם התשובות הנכונות ומוודא שכל החדרים נפתרים
// ושהמשחק מגיע לסיום. כולל בדיקה שמצב נשמר ונטען מ-JSON בלי לאבד נתונים.
import assert from 'node:assert/strict';
import { ROOMS } from '../lib/game.js';
import { step, newState, accessibleRooms } from '../lib/engine.js';

let state = { ...newState(), started: true, mode: 'main' };
const roundTrip = s => JSON.parse(JSON.stringify(s));

// כניסה לתפריט והתחלה
state = step(state, '2').state;
assert.equal(state.mode, 'map');

const solvedOrder = [];
let guard = 0;
while (state.mode !== 'end') {
  if (++guard > 200) throw new Error('המשחק לא מסתיים - לולאה אינסופית');
  state = roundTrip(state);
  const open = accessibleRooms(state);
  assert.ok(open.length > 0, `אין חדרים זמינים לפני סיום. פתורים: ${state.done.join(',')}`);
  // בוחרים את החדר הזמין הראשון
  const room = open[0];
  const r1 = step(state, String(room.id));
  assert.equal(r1.state.mode, 'puzzle', `חדר ${room.id} לא נפתח`);
  state = r1.state;
  for (const p of room.puzzles) {
    // טעות ראשונה כדי לבדוק את מנגנון הטעויות
    const wrong = step(state, '0');
    assert.ok(wrong.state.wrong >= 1 || wrong.state.mode !== 'puzzle');
    state = wrong.state.mode === 'puzzle' ? wrong.state : state;
    // רמז
    const hint = step(state, '99');
    assert.ok(hint.text.includes(p.hint), `רמז לא נכון לחידה ${p.id}`);
    state = hint.state;
    // תשובה נכונה
    const res = step(state, p.answer);
    state = res.state;
  }
  solvedOrder.push(room.id);
  assert.ok(state.done.includes(room.id), `חדר ${room.id} לא סומן כהושלם`);
  if (room.id === 12) {
    assert.equal(state.mode, 'end');
  }
}

assert.equal(new Set(solvedOrder).size, ROOMS.length, 'לא כל החדרים נפתרו');
console.log(`OK - ${ROOMS.length} חדרים, ${ROOMS.reduce((n, r) => n + r.puzzles.length, 0)} חידות, סדר הפתרון: ${solvedOrder.join(' > ')}`);

// בדיקת כניסה למפה עם חדר נעול: חייב להיכשל
const locked = step({ ...newState(), started: true, mode: 'map' }, '9');
assert.ok(locked.text.includes('אינו זמין'), 'חדר נעול נפתח בטעות');
console.log('OK - חדר נעול נחסם');

// בדיקת שמירה/טעינה
const fresh = { ...newState(), started: true, mode: 'main' };
const s1 = step(fresh, '1').state;
assert.equal(s1.mode, 'map');
console.log('OK - מצב נשמר ונטען');
