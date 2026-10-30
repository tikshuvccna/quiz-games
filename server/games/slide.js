// "פאזל הזזה" - the classic 3x3 sliding number puzzle, a few moves from solved. The phone sends the moves it made;
// the server replays them on its own copy of the board, so a solved board cannot be claimed without really solving it.
const FfaAction = require('./ffa');

const SOLVED = [1, 2, 3, 4, 5, 6, 7, 8, 0];
const NEIGH = (i) => {
  const r = Math.floor(i / 3);
  const c = i % 3;
  return [r > 0 && i - 3, r < 2 && i + 3, c > 0 && i - 1, c < 2 && i + 1].filter((x) => x !== false);
};

class SlideGame extends FfaAction {
  static id = 'slide';
  static kind = 'slide';
  static order = 31;
  static title = 'פאזל הזזה';
  static emoji = '🔢';
  static reward = ['פאזל', 'פאזלים'];
  static blurb = 'כל אחד לעצמו. תשובה נכונה פותחת פאזל הזזה של 3×3: מזיזים את המספרים לריבוע הריק עד שהם מסודרים מ־1 עד 8. הפתרון נבדק בשרת, וככל שמהר ובפחות מהלכים יותר נקודות.';

  makeRound(g) {
    const t = SOLVED.slice();
    let blank = 8;
    let prev = -1;
    const steps = 9 + Math.min(6, g.streak);
    for (let k = 0; k < steps; k++) {
      const opts = NEIGH(blank).filter((x) => x !== prev);
      const n = opts[Math.floor(Math.random() * opts.length)];
      [t[blank], t[n]] = [t[n], t[blank]];
      prev = blank;
      blank = n;
    }
    return { pub: { tiles: t }, secret: t, ms: 18000 };
  }

  grade(g, data, start) {
    const t = start.slice();
    let blank = t.indexOf(0);
    const moves = Array.isArray(data.moves) ? data.moves.slice(0, 100) : [];
    let used = 0;
    for (const m of moves) {
      if (!Number.isInteger(m) || m < 0 || m > 8 || !NEIGH(blank).includes(m)) break; // an illegal move stops the replay
      [t[blank], t[m]] = [t[m], t[blank]];
      blank = m;
      used++;
    }
    const inPlace = t.filter((v, i) => v !== 0 && v === SOLVED[i]).length;
    const solved = t.every((v, i) => v === SOLVED[i]);
    const pts = solved ? 14 + Math.max(0, 16 - used) : inPlace;
    return { pts, hits: inPlace, total: 8, full: solved && used <= 22, title: solved ? 'פתרתם את הפאזל!' : `${inPlace} מתוך 8 במקום`, sub: solved ? `ב־${used} מהלכים` : 'כמעט…' };
  }
}

module.exports = SlideGame;
