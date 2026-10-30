// "נחש" - a correct answer opens a 10-second snake round on the phone: eat apples without hitting the wall or yourself.
// The phone plays it and reports the apples (trusted, like the tower game); the server caps what it believes.
const FfaAction = require('./ffa');

const ROUND_MS = 10000;
const MAX_APPLES = 14; // the most a 10 second round can really give on this grid

class SnakeGame extends FfaAction {
  static id = 'snake';
  static kind = 'snake';
  static order = 20;
  static title = 'נחש';
  static emoji = '🐍';
  static reward = ['סיבוב', 'סיבובים'];
  static blurb = 'כל אחד לעצמו. תשובה נכונה פותחת 10 שניות של משחק נחש: מכוונים את הנחש, אוכלים תפוחים ולא נתקלים בקיר או בעצמכם. כל תפוח הוא נקודות!';

  makeRound(g) {
    return { pub: { cols: 11, rows: 15, step: Math.max(150, 220 - g.streak * 10) }, secret: null, ms: ROUND_MS };
  }

  grade(g, data) {
    const apples = Math.max(0, Math.min(MAX_APPLES, Math.floor(Number(data.apples) || 0)));
    const crashed = data.crashed === true;
    const pts = apples * 3 + (apples >= 8 && !crashed ? 8 : 0);
    return { pts, hits: apples, total: Math.max(apples, 8), full: apples >= 10 && !crashed, title: `${apples} תפוחים`, sub: crashed ? '💥 הנחש התרסק' : 'הנחש שרד עד הסוף!' };
  }
}

module.exports = SnakeGame;
