// "זיכרון ריבועים" - some squares light up for a moment; then tap the ones you remember.
const FfaAction = require('./ffa');

class MemGridGame extends FfaAction {
  static id = 'memgrid';
  static kind = 'memgrid';
  static order = 33;
  static title = 'זיכרון ריבועים';
  static emoji = '🧠';
  static reward = ['סיבוב', 'סיבובים'];
  static blurb = 'כל אחד לעצמו. תשובה נכונה פותחת סיבוב זיכרון: כמה ריבועים נדלקים לרגע, ואז מקישים מהזיכרון על אלה שהיו מוארים. טעות מורידה נקודות!';

  makeRound(g) {
    const size = g.streak >= 4 ? 4 : 3;
    const k = 3 + Math.min(3, Math.floor(g.streak / 2));
    const cells = [];
    while (cells.length < k) {
      const c = Math.floor(Math.random() * size * size);
      if (!cells.includes(c)) cells.push(c);
    }
    return { pub: { size, cells, showMs: 1800 + k * 300 }, secret: { cells, size }, ms: 1800 + k * 300 + 9000 };
  }

  grade(g, data, sec) {
    const picks = [...new Set((Array.isArray(data.picks) ? data.picks : []).filter((x) => Number.isInteger(x) && x >= 0 && x < sec.size * sec.size))].slice(0, 16);
    const right = picks.filter((c) => sec.cells.includes(c)).length;
    const wrong = picks.length - right;
    const full = right === sec.cells.length && wrong === 0;
    return { pts: Math.max(0, right * 4 - wrong * 3) + (full ? 8 : 0), hits: right, total: sec.cells.length, full, title: full ? 'זיכרון מושלם!' : `${right} מתוך ${sec.cells.length} נכון`, sub: wrong ? `${wrong} ריבועים שגויים` : 'בלי טעויות' };
  }
}

module.exports = MemGridGame;
