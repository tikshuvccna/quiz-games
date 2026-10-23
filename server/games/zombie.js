// "בורחים מהזומבים" - co-op. A crowd of silly zombies shuffles after the class all the way to the safe house. A
// correct answer is a parkour dash on the phone: obstacles come one after another, swipe the right way for each
// (up = jump the fence, down = slide under the pipe, left / right = dodge the car). Reach the safe house in time!
const ChaseGame = require('./chase');

const DIRS = ['up', 'down', 'left', 'right'];
const OBSTACLES = 5;

class ZombieGame extends ChaseGame {
  static id = 'zombie';
  static order = 23;
  static title = 'בורחים מהזומבים';
  static emoji = '🧟';
  static reward = ['ריצה', 'ריצות'];
  static blurb = 'להקת זומבים מצחיקים רודפת אחרי הכיתה! תשובה נכונה = ריצת פארקור: מחליקים בטלפון לכיוון הנכון כדי לקפוץ, להתכופף ולהתחמק ממכשולים. מגיעים לבית המבטחים לפני שהזומבים משיגים?';
  static phases = ['dash', 'dashed'];
  static actionType = 'dash';
  static fallbackMs = 12000;
  static milestones = ['🏪 עברנו את המכולת!', '🌉 חצי הדרך! עברנו את הגשר', '🏠 רואים את בית המבטחים!'];
  static caughtText = (back) => `🧟 הזומבים השיגו אותנו! ${back} מטר אחורה`;
  static wonText = '🎉 הגענו לבית המבטחים!';
  static startText = '🧟 הזומבים התעוררו! רוצו!';
  static rageNote = '🧟 הזומבים מתקרבים!';
  static readyNote = '🏃 מוכנים לפארקור!';

  // never the same move three times in a row
  makeAction() {
    const obs = [];
    while (obs.length < OBSTACLES) {
      const d = DIRS[Math.floor(Math.random() * DIRS.length)];
      if (obs.length >= 2 && obs[obs.length - 1] === d && obs[obs.length - 2] === d) continue;
      obs.push(d);
    }
    return { obs };
  }

  grade(p, data) {
    if (!data) return { gain: 3, ok: 0 };
    const moves = Array.isArray(data.moves) ? data.moves.slice(0, OBSTACLES) : [];
    const obs = p.g.act.obs;
    const ok = moves.filter((m, i) => m === obs[i]).length;
    const perfect = ok === OBSTACLES;
    return { gain: Math.max(2, 3 + 4 * ok + (perfect ? 6 : 0)), perfect, ok };
  }
}

module.exports = ZombieGame;
