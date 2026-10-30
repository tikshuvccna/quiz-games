// "ציפור מעופפת" - a 10-second flappy-bird round on the phone: tap to flap through the gaps. The phone plays it and
// reports the gaps passed (trusted, capped).
const FfaAction = require('./ffa');

const MAX = 12;

class FlappyGame extends FfaAction {
  static id = 'flappy';
  static kind = 'flappy';
  static order = 28;
  static title = 'ציפור מעופפת';
  static emoji = '🐦';
  static reward = ['טיסה', 'טיסות'];
  static blurb = 'כל אחד לעצמו. תשובה נכונה פותחת טיסה של 10 שניות: מקישים כדי שהציפור תרפרף, ועוברים בין הצינורות בלי להתרסק. כל מעבר הוא נקודות!';

  makeRound(g) {
    return { pub: { speed: 1 + Math.min(0.4, g.streak * 0.05) }, secret: null, ms: 10000 };
  }

  grade(g, data) {
    const pipes = Math.max(0, Math.min(MAX, Math.floor(Number(data.pipes) || 0)));
    const crashed = data.crashed === true;
    return { pts: pipes * 4 + (pipes >= 6 && !crashed ? 6 : 0), hits: pipes, total: Math.max(pipes, 6), full: pipes >= 8 && !crashed, title: `${pipes} מעברים`, sub: crashed ? '💥 הציפור התרסקה' : 'טיסה חלקה עד הסוף!' };
  }
}

module.exports = FlappyGame;
