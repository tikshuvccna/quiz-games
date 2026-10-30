// "ספינת חלל" - classic Asteroids-style shooter. A correct answer opens a 12-second flight: steer your own ship with the
// phone's joystick, hold fire, and blow up the asteroids. The phone plays it and reports the result (trusted, capped here).
const FfaAction = require('./ffa');

const ROUND_MS = 12000;
const MAX_KILLS = 30;

class ShipGame extends FfaAction {
  static id = 'ship';
  static kind = 'ship';
  static order = 22;
  static title = 'ספינת חלל';
  static emoji = '🛸';
  static reward = ['טיסה', 'טיסות'];
  static blurb = 'כל אחד לעצמו. תשובה נכונה פותחת טיסה של 12 שניות בספינה משלכם: ג׳ויסטיק בטלפון, כפתור ירי, והמטרה היא לפוצץ כמה שיותר אסטרואידים ולהישאר בחיים.';

  makeRound(g) {
    return { pub: { lives: 3, speed: 1 + Math.min(0.5, g.streak * 0.08) }, secret: null, ms: ROUND_MS };
  }

  grade(g, data) {
    const kills = Math.max(0, Math.min(MAX_KILLS, Math.floor(Number(data.kills) || 0)));
    const lives = Math.max(0, Math.min(3, Math.floor(Number(data.lives) || 0)));
    const pts = kills * 2 + lives * 2;
    return { pts, hits: kills, total: Math.max(kills, 10), full: kills >= 14 && lives === 3, title: `${kills} אסטרואידים`, sub: lives === 0 ? '💥 הספינה התפוצצה' : `🛡️ נשארו ${lives} חיים` };
  }
}

module.exports = ShipGame;
