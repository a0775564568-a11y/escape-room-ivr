// מנוע המשחק: מקבל מצב נוכחי + קלט מהמתקשר, ומחזיר את ההודעה הבאה והמצב החדש.
// המנוע טהור (ללא רשת ו-I/O) ולכן ניתן לבדוק אותו ישירות.
import { ROOMS, ITEMS, MESSAGES, roomById } from './game.js';

export function newState() {
  return {
    started: false,   // האם התחיל משחק
    mode: 'main',     // main | map | puzzle | end
    done: [],         // מספרי חדרים שהושלמו
    items: [],        // פריטים שנאספו
    room: null,       // חדר פעיל
    pi: 0,            // אינדקס החידה הפעילה בחדר
    wrong: 0,         // טעויות בחידה הנוכחית
    hints: 0,         // רמזים שניתנו בחידה הנוכחית
  };
}

export function hasRequirements(state, room) {
  const allOk = room.req.every(i => state.items.includes(i));
  const anyOk = !room.reqAny || room.reqAny.some(i => state.items.includes(i));
  return allOk && anyOk;
}

export function accessibleRooms(state) {
  return ROOMS.filter(r => !state.done.includes(r.id) && hasRequirements(state, r));
}

// מחזיר טקסט של המפה והחדרים הזמינים
function mapText(state) {
  const list = accessibleRooms(state);
  if (list.length === 0) return MESSAGES.noRooms;
  const names = list.map(r => `${r.id} ${r.name}`).join(', ');
  return MESSAGES.mapHeader + 'חדרים זמינים: ' + names + '.' + MESSAGES.mapFooter;
}

function puzzleText(room, idx) {
  const p = room.puzzles[idx];
  // בחידה הראשונה בחדר מקריאים גם את תיאור החדר
  return idx === 0 ? room.intro + ' ' + p.text : p.text;
}

// מחזיר אובייקט פעולה: { state, text, key } כאשר key הוא מזהה קובץ שמע (או null לטקסט דינמי)
function out(state, text, key = null) {
  return { state, text: clean(text), key };
}

// מסיר תווים שעלולים לשבור את פורמט התגובה של ימות המשיח
export function clean(s) {
  return String(s).replace(/[=&\r\n]/g, ' ').replace(/\s+/g, ' ').trim();
}

function enterRoom(state, roomId) {
  const room = roomById(roomId);
  const next = { ...state, mode: 'puzzle', room: roomId, pi: 0, wrong: 0, hints: 0 };
  const p = room.puzzles[0];
  return out(next, puzzleText(room, 0), p.id);
}

function nextPuzzleOrClose(state, room, rewards) {
  const newItems = [...state.items, ...rewards.filter(r => r !== 'finale')];
  const last = state.pi + 1 >= room.puzzles.length;
  if (!last) {
    const idx = state.pi + 1;
    const ns = { ...state, items: newItems, pi: idx, wrong: 0, hints: 0 };
    return out(ns, puzzleText(room, idx), room.puzzles[idx].id);
  }
  // סיום החדר
  const done = [...state.done, room.id];
  const ns = { ...state, items: newItems, done, mode: 'map', room: null, pi: 0, wrong: 0, hints: 0 };
  if (room.id === 12 || rewards.includes('finale')) {
    return out({ ...ns, mode: 'end' }, MESSAGES.gameWon);
  }
  return out(ns, MESSAGES.roomDone + ' ' + mapText(ns));
}

// הפונקציה הראשית: מטפלת בקלט אחד
export function step(state, rawInput) {
  const input = String(rawInput ?? '').trim();

  if (state.mode === 'main') {
    if (input === '' ) return out(state, MESSAGES.welcome, 'welcome');
    if (input === '1') {
      const base = state.started ? state : { ...newState(), started: true };
      return out({ ...base, mode: 'map' }, mapText(base));
    }
    if (input === '2') {
      const ns = { ...newState(), started: true, mode: 'map' };
      return out(ns, MESSAGES.instructions + ' ' + mapText(ns), 'instructions');
    }
    if (input === '3') return out(state, MESSAGES.instructions + ' ' + MESSAGES.mainMenu, 'instructions');
    return out(state, MESSAGES.invalid + ' ' + MESSAGES.mainMenu);
  }

  if (state.mode === 'map') {
    if (input === '') return out(state, mapText(state));
    if (input === '*') return out({ ...state, mode: 'main' }, MESSAGES.mainMenu);
    const n = Number(input);
    if (!Number.isInteger(n) || !roomById(n)) return out(state, MESSAGES.invalid + ' ' + mapText(state));
    if (state.done.includes(n) || !hasRequirements(state, roomById(n))) {
      return out(state, MESSAGES.badChoice + ' ' + mapText(state));
    }
    return enterRoom(state, n);
  }

  if (state.mode === 'puzzle') {
    const room = roomById(state.room);
    const p = room.puzzles[state.pi];
    if (input === '*') return out({ ...state, mode: 'map', room: null }, mapText({ ...state, mode: 'map' }));
    if (input === '99') {
      if (state.hints >= 1) return out({ ...state, hints: state.hints }, MESSAGES.hintPrefix + p.hint);
      return out({ ...state, hints: state.hints + 1 }, MESSAGES.hintPrefix + p.hint);
    }
    if (input === '') return out(state, puzzleText(room, state.pi), p.id);
    if (input === p.answer) {
      return nextPuzzleOrClose(state, room, p.reward);
    }
    const wrong = state.wrong + 1;
    const ns = { ...state, wrong };
    if (wrong >= 3) {
      // אחרי שלוש טעויות הרמז ניתן אוטומטית
      return out({ ...ns, wrong: 0, hints: state.hints + 1 }, MESSAGES.wrongHint + p.hint);
    }
    return out(ns, MESSAGES.wrong);
  }

  if (state.mode === 'end') {
    if (input === '1') return out({ ...newState(), started: true, mode: 'map' }, mapText({ ...newState(), started: true }));
    if (input === '2') return out({ ...state, mode: 'main' }, MESSAGES.mainMenu);
    return out(state, MESSAGES.ended);
  }

  // מצב לא מוכר: מחזירים לתפריט הראשי
  return out({ ...newState(), started: state.started }, MESSAGES.mainMenu);
}

export { ITEMS };
