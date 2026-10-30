// "חצים" - three darts at a board. A marker sweeps across, then up and down: tap to stop each one. The phone sends where
// the dart landed (the board's centre is fixed, so a throw is judged by its distance from it).
const FfaAction = require('./ffa');

const N = 3;
// distance from the centre (0..1 across the board) -> points
const RINGS = [[0.09, 12], [0.25, 8], [0.5, 5], [0.8, 2]];

class DartsGame extends FfaAction {
  static id = 'darts';
  static kind = 'darts';
  static order = 36;
  static title = 'חצים';
  static emoji = '🎯';
  static reward = ['סיבוב', 'סיבובים'];
  static blurb = 'כל אחד לעצמו. תשובה נכונה פותחת שלושה חצים: סמן עובר על הלוח קודם לרוחב ואחר כך לגובה, ועוצרים אותו בדיוק על האמצע. בול נותן הכי הרבה נקודות!';

  makeRound(g) {
    return { pub: { n: N, speed: 1 + Math.min(0.5, g.streak * 0.06), rings: RINGS.map((r) => r[0]) }, secret: null, ms: 24000 };
  }

  grade(g, data) {
    const darts = (Array.isArray(data.darts) ? data.darts : []).slice(0, N).filter((d) => Array.isArray(d) && Number.isFinite(d[0]) && Number.isFinite(d[1]));
    let pts = 0;
    let good = 0;
    let bulls = 0;
    for (const [x, y] of darts) {
      const d = Math.hypot(Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y)));
      const r = RINGS.find((k) => d <= k[0]);
      if (!r) continue;
      pts += r[1];
      if (r[1] >= 5) good++;
      if (r[1] === 12) bulls++;
    }
    const full = bulls === N;
    return { pts: pts + (full ? 10 : 0), hits: good, total: N, full, title: full ? 'שלושה בולים!' : `${good} מתוך ${N} חצים טובים`, sub: bulls ? `🎯 ${bulls} בול` : 'עוד קצת לכוון' };
  }
}

module.exports = DartsGame;
