// בדיקות: פתירות מלאה של המשחק, חסימת חדרים נעולים, שמירה/טעינה, ופורמט התגובה לימות המשיח.
import assert from 'node:assert/strict';
import { ROOMS, allNarrationKeys } from '../lib/game.js';
import { step, newState, accessibleRooms } from '../lib/engine.js';
import { buildPrompt, readAction, resolveAudioBase } from '../lib/yemot.js';

const norm = s => s.replace(/[=&.]/g, ' ').replace(/\s+/g, ' ').trim();
const txt = r => norm(r.parts.map(p => p.text).join(' '));
const roundTrip = s => JSON.parse(JSON.stringify(s));

// 1. פתירות מלאה
let state = { ...newState(), started: true, mode: 'main' };
state = step(state, '2').state;
assert.equal(state.mode, 'map');
const solved = [];
let guard = 0;
while (state.mode !== 'end') {
  if (++guard > 200) throw new Error('המשחק לא מסתיים');
  state = roundTrip(state);
  const open = accessibleRooms(state);
  assert.ok(open.length > 0, `אין חדרים זמינים. פתורים: ${state.done.join(',')}`);
  const room = open[0];
  const enter = step(state, String(room.id));
  assert.equal(enter.state.mode, 'puzzle', `חדר ${room.id} לא נפתח`);
  state = enter.state;
  for (const p of room.puzzles) {
    const w = step(state, '0');
    state = w.state.mode === 'puzzle' ? w.state : state;
    const h = step(state, '99');
    assert.ok(txt(h).includes(norm(p.hint)), `רמז לא נכון ל-${p.id}`);
    state = h.state;
    const ok = step(state, p.answer);
    assert.ok(txt(ok).includes(norm(p.ok).slice(0, 12)), `אין טקסט הצלחה ל-${p.id}`);
    state = ok.state;
  }
  solved.push(room.id);
  assert.ok(state.done.includes(room.id));
}
assert.equal(new Set(solved).size, ROOMS.length);
console.log(`OK - ${ROOMS.length} חדרים, ${ROOMS.reduce((n, r) => n + r.puzzles.length, 0)} חידות, סדר: ${solved.join(' > ')}`);

// 2. חדר נעול נחסם
const locked = step({ ...newState(), started: true, mode: 'map' }, '9');
assert.ok(txt(locked).includes('אינו זמין') || txt(locked).includes('אינו'), 'חדר נעול נפתח');
console.log('OK - חדר נעול נחסם');

// 3. כל קטע שמע מוגדר ויש לו טקסט
for (const k of allNarrationKeys()) {
  assert.ok(k.key && k.text && k.text.length > 5, `חסר טקסט: ${k.key}`);
}
console.log(`OK - ${allNarrationKeys().length} קטעי קריינה מוגדרים עם טקסט`);

// 4. פורמט השמעה: מצב רגיל = t- בלבד; מצב מתקדם = f- עם נתיב השלוחה
const parts = [{ key: 'r1_intro', text: 'שלום' }, { key: 'r1_p1', text: 'שאלה' }];
assert.equal(buildPrompt(parts), 't-שלום.t-שאלה');
const adv = buildPrompt(parts, { advanced: true, base: '/3', available: new Set(['r1_p1']) });
assert.equal(adv, 't-שלום.f-/3/audio/r1_p1');
assert.equal(buildPrompt(parts, { advanced: true, base: '', available: new Set(['r1_intro', 'r1_p1']) }), 'f-/audio/r1_intro.f-/audio/r1_p1');
assert.equal(resolveAudioBase('3'), '/3');
assert.equal(resolveAudioBase('/3/'), '/3');
assert.equal(resolveAudioBase(''), '');
assert.equal(readAction(parts), 'read=t-שלום.t-שאלה=in,,1,4,Digits,no');
console.log('OK - פורמט ההשמעה תקין בשני המצבים');
