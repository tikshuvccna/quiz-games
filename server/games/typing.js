// "מקלידים מהר" - words appear one after another; type each as fast as you can. The server checks every word.
const FfaAction = require('./ffa');

const WORDS = ['שמש', 'ספר', 'חבר', 'כיתה', 'מחשב', 'גלידה', 'אופניים', 'חלון', 'שוקולד', 'כדורגל', 'מורה', 'תפוח', 'ענן', 'ילד', 'פרפר', 'מכונית', 'שולחן', 'מטרייה', 'גיטרה', 'דינוזאור', 'מקלדת', 'עיפרון', 'טלפון', 'ספינה', 'הרפתקה', 'חברות', 'כוכב', 'צבעים', 'אוצר', 'חייזר'];
const N = 6;

class TypingGame extends FfaAction {
  static id = 'typing';
  static kind = 'typing';
  static order = 35;
  static title = 'מקלידים מהר';
  static emoji = '⌨️';
  static reward = ['סיבוב', 'סיבובים'];
  static blurb = 'כל אחד לעצמו. תשובה נכונה פותחת סיבוב הקלדה: שש מילים מופיעות אחת אחרי השנייה, ומקלידים כל אחת בדיוק. הקלדה נכונה ומהירה נותנת נקודות!';

  makeRound() {
    const pool = WORDS.slice().sort(() => Math.random() - 0.5).slice(0, N);
    return { pub: { words: pool }, secret: pool, ms: 22000 };
  }

  grade(g, data, words) {
    const typed = (Array.isArray(data.typed) ? data.typed : []).slice(0, N).map((x) => String(x == null ? '' : x).trim().slice(0, 30));
    let ok = 0;
    typed.forEach((t, i) => { if (t === words[i]) ok++; });
    const full = ok === N;
    return { pts: ok * 4 + (full ? 8 : 0), hits: ok, total: N, full, title: full ? 'הקלדה מושלמת!' : `${ok} מתוך ${N} מילים`, sub: 'אצבעות זריזות' };
  }
}

module.exports = TypingGame;
