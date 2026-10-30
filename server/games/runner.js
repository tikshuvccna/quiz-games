// "ריצת מכשולים" - a 10-second auto-runner on the phone: tap to jump over the obstacles. Reported by the phone (trusted, capped).
const FfaAction = require('./ffa');

const MAX = 15;

class RunnerGame extends FfaAction {
  static id = 'runner';
  static kind = 'runner';
  static order = 29;
  static title = 'ריצת מכשולים';
  static emoji = '🏃';
  static reward = ['ריצה', 'ריצות'];
  static blurb = 'כל אחד לעצמו. תשובה נכונה פותחת ריצה של 10 שניות: הדמות רצה לבד, ומקישים כדי לקפוץ מעל המכשולים. כל מכשול שעוברים הוא נקודות, והתנגשות מסיימת את הריצה.';

  makeRound(g) {
    return { pub: { speed: 1 + Math.min(0.5, g.streak * 0.06) }, secret: null, ms: 10000 };
  }

  grade(g, data) {
    const jumps = Math.max(0, Math.min(MAX, Math.floor(Number(data.jumps) || 0)));
    const crashed = data.crashed === true;
    return { pts: jumps * 3 + (!crashed ? 8 : 0), hits: jumps, total: Math.max(jumps, 8), full: jumps >= 10 && !crashed, title: `${jumps} מכשולים`, sub: crashed ? '💥 התנגשות' : 'ריצה נקייה עד הסוף!' };
  }
}

module.exports = RunnerGame;
