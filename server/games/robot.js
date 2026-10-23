// "בורחים מהרובוט" - co-op. The class runs down a factory corridor with a robot on its heels. A correct answer is a
// hold-to-boost sprint: hold the button and let go just before the engine overheats. Reach the exit door in time!
// If the robot catches the class it zaps everyone back a little; wrong answers give the robot a burst of speed.
// The chase itself (goal, rubber band, checkpoint mini-games) lives in chase.js.
const ChaseGame = require('./chase');

class RobotGame extends ChaseGame {
  static id = 'robot';
  static order = 16;
  static title = 'בורחים מהרובוט';
  static emoji = '🤖';
  static reward = ['ספרינט', 'ספרינטים'];
  static blurb = 'כל הכיתה בורחת ביחד מרובוט ענק! תשובה נכונה = ספרינט: לוחצים ומחזיקים, ומשחררים רגע לפני שהמנוע מתחמם מדי. בכל רבע דרך עוצרים למיני-משחק משותף. מגיעים ליציאה בזמן?';
  static phases = ['sprint', 'sprinted'];
  static actionType = 'sprint';
  static milestones = ['🚪 עברנו את שער המחסן!', '⚙️ חצי הדרך! המפעל רועד…', '💡 רואים את האור ביציאה!'];
  static caughtText = (back) => `⚡ הרובוט תפס אותנו! ${back} מטר אחורה`;
  static wonText = '🎉 יצאנו! ברחנו מהרובוט!';
  static startText = '🤖 הרובוט התעורר! רוצו!';
  static rageNote = '🤖 הרובוט מאיץ!';
  static readyNote = '🏃 הכינו את הספרינט!';

  // heat 0..1 = how long the button was held; over 1 = the engine overheated. No packet = a lazy jog.
  grade(p, data) {
    const heat = data ? Math.max(0, Math.min(1.2, Number(data.heat) || 0)) : 0.3;
    const burnt = heat > 1;
    const perfect = !burnt && heat >= 0.85;
    return { gain: burnt ? 4 : Math.round(4 + 16 * heat + (perfect ? 6 : 0)), perfect, burnt };
  }
}

module.exports = RobotGame;
