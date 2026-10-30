// "פוצצו בלונים" - numbered balloons float on the phone: pop them in order, 1, 2, 3… (8 seconds).
const FfaAction = require('./ffa');

class BalloonGame extends FfaAction {
  static id = 'balloon';
  static kind = 'balloon';
  static order = 27;
  static title = 'פוצצו בלונים';
  static emoji = '🎈';
  static reward = ['סיבוב', 'סיבובים'];
  static blurb = 'כל אחד לעצמו. תשובה נכונה פותחת סיבוב של 8 שניות: בלונים ממוספרים מרחפים על המסך, ומפוצצים אותם לפי הסדר, מ־1 ועד הסוף. בלון לא נכון פשוט לא נספר.';

  makeRound(g) {
    const n = 8 + Math.min(4, Math.floor(g.streak / 2));
    return { pub: { n, seed: 1 + Math.floor(Math.random() * 1e6) }, secret: n, ms: 8500 };
  }

  grade(g, data, n) {
    const order = Array.isArray(data.order) ? data.order.slice(0, 40) : [];
    let k = 0;
    // pops in the right order count: a wrong balloon is skipped, the next number is still waited for
    for (const x of order) if (x === k + 1 && k < n) k++;
    const full = k === n;
    return { pts: k * 3 + (full ? 8 : 0), hits: k, total: n, full, title: full ? `כל ${n} הבלונים!` : `${k} מתוך ${n} בלונים`, sub: 'לפי הסדר' };
  }
}

module.exports = BalloonGame;
