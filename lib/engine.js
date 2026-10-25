// מנוע המשחק: מקבל מצב נוכחי + קלט מהמתקשר, ומחזיר את המצב החדש ורשימת קטעי השמעה.
// כל קטע (part) הוא { key, text }: key = שם קובץ השמע (אם קיים), text = הטקסט להקראה.
// המנוע טהור (ללא רשת ו-I/O) ולכן ניתן לבדוק אותו ישירות.
import { ROOMS, MESSAGES, FRAGMENTS, roomById } from './game.js';

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

// קטע עם קובץ שמע מוגדר (אם לא מועלה - יוקרא בטקסט)
const P = (key, text) => ({ key, text: clean(text) });
// קטע דינמי (אין לו קובץ מוכן)
const D = text => ({ key: null, text: clean(text) });
// הודעת מערכת קבועה
const M = name => P(name, MESSAGES[name]);

// מסיר תווים שעלולים לשבור את פורמט התגובה של ימות המשיח
export function clean(s) {
  return String(s).replace(/[=&\r\n.]/g, ' ').replace(/\s+/g, ' ').trim();
}

function mapPart(state) {
  const list = accessibleRooms(state);
  if (list.length === 0) return M('noRooms');
  const names = list.map(r => `${r.id} ${r.name}`).join(', ');
  return D(FRAGMENTS.mapHeader + 'חדרים זמינים: ' + names + '.' + FRAGMENTS.mapFooter);
}

function puzzlePart(room, idx) {
  const p = room.puzzles[idx];
  return P(p.id, p.text);
}

function out(state, parts) {
  return { state, parts };
}

function enterRoom(state, roomId) {
  const room = roomById(roomId);
  const next = { ...state, mode: 'puzzle', room: roomId, pi: 0, wrong: 0, hints: 0 };
  return out(next, [P(`r${room.id}_intro`, room.intro), puzzlePart(room, 0)]);
}

function solvePuzzle(state, room, p) {
  const newItems = [...state.items, ...p.reward];
  const okPart = P(`${p.id}_ok`, p.ok);
  const last = state.pi + 1 >= room.puzzles.length;

  if (!last) {
    const idx = state.pi + 1;
    const ns = { ...state, items: newItems, pi: idx, wrong: 0, hints: 0 };
    return out(ns, [okPart, puzzlePart(room, idx)]);
  }

  const done = [...state.done, room.id];
  const base = { ...state, items: newItems, done, room: null, pi: 0, wrong: 0, hints: 0 };

  // החדר האחרון: סיום המשחק
  if (p.reward.includes('finale') || room.id === 12) {
    return out({ ...base, mode: 'end' }, [okPart, M('epilogue'), M('gameMenuAfterWin')]);
  }

  const ns = { ...base, mode: 'map' };
  const parts = [okPart];
  if (room.outro) parts.push(P(`r${room.id}_outro`, room.outro));
  parts.push(M('roomDone'), mapPart(ns));
  return out(ns, parts);
}

// הפונקציה הראשית: מטפלת בקלט אחד
export function step(state, rawInput) {
  const input = String(rawInput ?? '').trim();

  if (state.mode === 'main') {
    if (input === '') {
      // פתיחה: הסיפור נאמר רק כשמתחילים שיחה חדשה לגמרי בלי משחק שנשמר
      const parts = state.started ? [M('welcome')] : [M('prologue'), M('welcome')];
      return out(state, parts);
    }
    if (input === '1') {
      const base = state.started ? state : { ...newState(), started: true };
      return out({ ...base, mode: 'map' }, [mapPart(base)]);
    }
    if (input === '2') {
      const ns = { ...newState(), started: true, mode: 'map' };
      return out(ns, [M('instructions'), mapPart(ns)]);
    }
    if (input === '3') return out(state, [M('instructions'), M('mainMenu')]);
    return out(state, [M('invalid'), M('mainMenu')]);
  }

  if (state.mode === 'map') {
    if (input === '') return out(state, [mapPart(state)]);
    if (input === '*') return out({ ...state, mode: 'main' }, [M('mainMenu')]);
    const n = Number(input);
    if (!Number.isInteger(n) || !roomById(n)) return out(state, [M('invalid'), mapPart(state)]);
    if (state.done.includes(n) || !hasRequirements(state, roomById(n))) {
      return out(state, [M('badChoice'), mapPart(state)]);
    }
    return enterRoom(state, n);
  }

  if (state.mode === 'puzzle') {
    const room = roomById(state.room);
    const p = room.puzzles[state.pi];
    if (input === '*') return out({ ...state, mode: 'map', room: null }, [mapPart({ ...state, mode: 'map' })]);
    if (input === '99') {
      return out({ ...state, hints: state.hints + 1 }, [D(FRAGMENTS.hintPrefix + p.hint)]);
    }
    if (input === '') return out(state, [puzzlePart(room, state.pi)]);
    if (input === p.answer) return solvePuzzle(state, room, p);

    const wrong = state.wrong + 1;
    const ns = { ...state, wrong };
    if (wrong >= 3) {
      // אחרי שלוש טעויות הרמז ניתן אוטומטית
      return out({ ...ns, wrong: 0, hints: state.hints + 1 }, [D(FRAGMENTS.wrongHint + p.hint)]);
    }
    return out(ns, [M('wrong')]);
  }

  if (state.mode === 'end') {
    if (input === '1') {
      const ns = { ...newState(), started: true, mode: 'map' };
      return out(ns, [mapPart(ns)]);
    }
    if (input === '2') return out({ ...state, mode: 'main' }, [M('mainMenu')]);
    return out(state, [M('ended')]);
  }

  // מצב לא מוכר: מחזירים לתפריט הראשי
  return out({ ...newState(), started: state.started }, [M('mainMenu')]);
}
