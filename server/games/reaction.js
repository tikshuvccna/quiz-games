// "תגובה מהירה" - five trials: wait for the screen to turn green, then tap as fast as you can. The delays are chosen here;
// a tap too early (or faster than a person can react) scores nothing.
const FfaAction = require('./ffa');

const TRIALS = 5;

class ReactionGame extends FfaAction {
  static id = 'reaction';
  static kind = 'reaction';
  static order = 30;
  static title = 'תגובה מהירה';
  static emoji = '⚡';
  static reward = ['סיבוב', 'סיבובים'];
  static blurb = 'כל אחד לעצמו. תשובה נכונה פותחת חמש בדיקות תגובה: מחכים שהמסך יהפוך לירוק ומקישים הכי מהר שאפשר. מי שמקיש מוקדם מדי, לא מקבל נקודות!';

  makeRound() {
    const delays = Array.from({ length: TRIALS }, () => 900 + Math.floor(Math.random() * 2200));
    return { pub: { delays }, secret: delays, ms: delays.reduce((s, d) => s + d + 1700, 1000) };
  }

  grade(g, data) {
    const times = Array.isArray(data.times) ? data.times.slice(0, TRIALS) : [];
    let pts = 0;
    let fast = 0;
    let good = 0;
    times.forEach((t) => {
      if (!Number.isFinite(t) || t < 110) return; // early, or faster than a person can react
      if (t <= 300) { pts += 6; fast++; good++; } else if (t <= 450) { pts += 4; good++; } else if (t <= 800) pts += 2;
    });
    const valid = times.filter((t) => Number.isFinite(t));
    const avg = valid.length ? Math.round(valid.reduce((s, t) => s + t, 0) / valid.length) : 0;
    const full = fast === TRIALS;
    return { pts: pts + (full ? 6 : 0), hits: good, total: TRIALS, full, title: full ? 'ברק! כולן מהירות' : `${good} תגובות מהירות`, sub: avg ? `זמן ממוצע ${avg} אלפיות השנייה` : 'לא הספקתם' };
  }
}

module.exports = ReactionGame;
