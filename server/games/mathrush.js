// "חשבון זריז" - eight little sums, three answers each: tap the right one as fast as you can. The server made the sums
// and checks every answer. The numbers grow with the player's streak.
const FfaAction = require('./ffa');

const N = 8;
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

class MathRushGame extends FfaAction {
  static id = 'mathrush';
  static kind = 'mathrush';
  static order = 38;
  static title = 'חשבון זריז';
  static emoji = '➕';
  static reward = ['סיבוב', 'סיבובים'];
  static blurb = 'כל אחד לעצמו. תשובה נכונה פותחת שמונה תרגילי חשבון קטנים: בוחרים מבין שלוש תשובות את הנכונה, מהר ככל האפשר. ככל שעונים נכון יותר, התרגילים גדלים.';

  makeRound(g) {
    const lvl = Math.min(3, Math.floor(g.streak / 3));
    const items = [];
    const answers = [];
    for (let i = 0; i < N; i++) {
      const kind = ['+', '-', '×'][rnd(0, lvl >= 1 ? 2 : 1)];
      let a;
      let b;
      let r;
      if (kind === '+') { a = rnd(3, 12 + lvl * 15); b = rnd(2, 10 + lvl * 15); r = a + b; } else if (kind === '-') { a = rnd(8, 20 + lvl * 20); b = rnd(1, a - 1); r = a - b; } else { a = rnd(2, 6 + lvl * 2); b = rnd(2, 6 + lvl * 2); r = a * b; }
      const wrong = new Set();
      while (wrong.size < 2) {
        const d = rnd(1, 4) * (Math.random() < 0.5 ? -1 : 1);
        if (r + d >= 0 && r + d !== r) wrong.add(r + d);
      }
      const opts = [r, ...wrong].sort(() => Math.random() - 0.5);
      items.push({ q: `${a} ${kind} ${b}`, opts });
      answers.push(opts.indexOf(r));
    }
    return { pub: { items }, secret: answers, ms: 24000 };
  }

  grade(g, data, answers) {
    const ans = Array.isArray(data.answers) ? data.answers.slice(0, N) : [];
    let ok = 0;
    let bad = 0;
    ans.forEach((a, i) => {
      if (!Number.isInteger(a)) return;
      if (a === answers[i]) ok++;
      else bad++;
    });
    const full = ok === N;
    return { pts: Math.max(0, ok * 3 - bad) + (full ? 6 : 0), hits: ok, total: N, full, title: full ? 'שמונה מתוך שמונה!' : `${ok} מתוך ${N} נכון`, sub: bad ? `${bad} טעויות` : 'חשבון בראש' };
  }
}

module.exports = MathRushGame;
