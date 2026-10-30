// "צבעים מבלבלים" - a colour word written in a different ink: tap the colour of the INK, not the word. 10 words, 9 seconds.
const FfaAction = require('./ffa');

const COLORS = [['אדום', '#ff4d6d'], ['כחול', '#2f80ff'], ['ירוק', '#2ee59d'], ['צהוב', '#ffd23f']];
const N = 10;

class StroopGame extends FfaAction {
  static id = 'stroop';
  static kind = 'stroop';
  static order = 26;
  static title = 'צבעים מבלבלים';
  static emoji = '🎨';
  static reward = ['סיבוב', 'סיבובים'];
  static blurb = 'כל אחד לעצמו. תשובה נכונה פותחת סיבוב של 9 שניות: מופיעה מילה שמציינת צבע, אבל כתובה בצבע אחר. מקישים על הצבע שבו המילה כתובה, לא על מה שכתוב. מהר ובלי להתבלבל!';

  makeRound() {
    const items = Array.from({ length: N }, () => {
      const w = Math.floor(Math.random() * 4);
      let c = Math.floor(Math.random() * 4);
      if (c === w) c = (c + 1 + Math.floor(Math.random() * 3)) % 4; // the ink never matches the word
      return { w, c };
    });
    return { pub: { items, colors: COLORS }, secret: items, ms: 9000 };
  }

  grade(g, data, items) {
    const ans = Array.isArray(data.answers) ? data.answers.slice(0, N) : [];
    let ok = 0;
    let bad = 0;
    ans.forEach((a, i) => {
      if (!Number.isInteger(a)) return;
      if (a === items[i].c) ok++;
      else bad++;
    });
    const full = ok === N;
    return { pts: Math.max(0, ok * 3 - bad) + (full ? 6 : 0), hits: ok, total: N, full, title: full ? 'בלי טעות אחת!' : `${ok} מתוך ${N} נכון`, sub: bad ? `${bad} טעויות` : 'מהירים וחדים' };
  }
}

module.exports = StroopGame;
