// "תפוס את הפירות" - a 10-second round: slide the basket and catch the falling fruit, avoid the rotten ones.
// The phone plays it and reports the count (trusted, capped).
const FfaAction = require('./ffa');

const MAX = 22;

class CatchGame extends FfaAction {
  static id = 'catch';
  static kind = 'catch';
  static order = 34;
  static title = 'תפוס את הפירות';
  static emoji = '🧺';
  static reward = ['סיבוב', 'סיבובים'];
  static blurb = 'כל אחד לעצמו. תשובה נכונה פותחת סיבוב של 10 שניות: מזיזים סל ותופסים פירות שנופלים, ומתחמקים מהרקובים. כל פרי הוא נקודות!';

  makeRound(g) {
    return { pub: { speed: 1 + Math.min(0.5, g.streak * 0.06) }, secret: null, ms: 10000 };
  }

  grade(g, data) {
    const caught = Math.max(0, Math.min(MAX, Math.floor(Number(data.caught) || 0)));
    const rotten = Math.max(0, Math.min(10, Math.floor(Number(data.rotten) || 0)));
    return { pts: Math.max(0, caught * 2 - rotten * 3), hits: caught, total: Math.max(caught, 12), full: caught >= 15 && rotten === 0, title: `${caught} פירות`, sub: rotten ? `🤢 ${rotten} רקובים` : 'בלי רקובים!' };
  }
}

module.exports = CatchGame;
