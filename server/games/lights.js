// "כבו את האור" - lights out on a 3x3 grid: tapping a square flips it and its neighbours; switch every light off.
// The phone sends its taps and the server replays them on its own copy, so a solved board cannot be faked.
const FfaAction = require('./ffa');

const flip = (b, i) => {
  const r = Math.floor(i / 3);
  const c = i % 3;
  b[i] = !b[i];
  if (r > 0) b[i - 3] = !b[i - 3];
  if (r < 2) b[i + 3] = !b[i + 3];
  if (c > 0) b[i - 1] = !b[i - 1];
  if (c < 2) b[i + 1] = !b[i + 1];
};

class LightsGame extends FfaAction {
  static id = 'lights';
  static kind = 'lights';
  static order = 37;
  static title = 'כבו את האור';
  static emoji = '💡';
  static reward = ['חידה', 'חידות'];
  static blurb = 'כל אחד לעצמו. תשובה נכונה פותחת חידת אורות: לוח של 3×3, והקשה על ריבוע הופכת אותו ואת השכנים שלו. צריך לכבות את כל האורות, והפתרון נבדק בשרת.';

  makeRound(g) {
    // start from all off and press a few distinct squares, so the puzzle always has a solution
    const board = new Array(9).fill(false);
    const presses = [];
    const k = 3 + Math.min(3, Math.floor(g.streak / 2));
    while (presses.length < k) {
      const i = Math.floor(Math.random() * 9);
      if (!presses.includes(i)) { presses.push(i); flip(board, i); }
    }
    if (!board.some(Boolean)) flip(board, 4);
    return { pub: { cells: board.slice() }, secret: board, ms: 22000 };
  }

  grade(g, data, start) {
    const b = start.slice();
    const taps = Array.isArray(data.taps) ? data.taps.slice(0, 60) : [];
    let used = 0;
    for (const t of taps) {
      if (!Number.isInteger(t) || t < 0 || t > 8) break;
      flip(b, t);
      used++;
    }
    const was = start.filter(Boolean).length;
    const now = b.filter(Boolean).length;
    const solved = now === 0;
    const pts = solved ? 14 + Math.max(0, 12 - used) : Math.max(0, was - now);
    return { pts, hits: Math.max(0, was - now), total: was, full: solved && used <= 6, title: solved ? 'כל האורות כבו!' : `${Math.max(0, was - now)} אורות כבו`, sub: solved ? `ב־${used} הקשות` : 'כמעט…' };
  }
}

module.exports = LightsGame;
