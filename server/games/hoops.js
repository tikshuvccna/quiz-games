// "סל" - basketball. A correct answer earns three shots: stop the moving aim over the hoop, then stop the power meter in the green zone.
const FfaAction = require('./ffa');

const SHOTS = 3;
// how close the aim (0..1 across the court) and the power (0..1) must be: swish, basket, rim
const BANDS = [[0.07, 12, 'swish'], [0.13, 8, 'basket'], [0.22, 3, 'rim']];

class HoopsGame extends FfaAction {
  static id = 'hoops';
  static kind = 'hoops';
  static order = 19;
  static title = 'סל';
  static emoji = '🏀';
  static reward = ['זריקות', 'זריקות'];
  static blurb = 'כל אחד לעצמו. תשובה נכונה היא שלוש זריקות לסל: עוצרים את הכיוון המטלטל מול הטבעת, ואז עוצרים את מד הכוח באזור הירוק. קליעה נקייה נותנת הכי הרבה נקודות!';

  makeRound() {
    const shots = Array.from({ length: SHOTS }, () => ({ x: +(0.18 + Math.random() * 0.64).toFixed(2), p: +(0.5 + Math.random() * 0.38).toFixed(2) }));
    return { pub: { shots, bands: BANDS.map((b) => b[0]) }, secret: shots, ms: 14000 };
  }

  grade(g, data, shots) {
    const got = Array.isArray(data.shots) ? data.shots : [];
    let pts = 0;
    let made = 0;
    let swishes = 0;
    shots.forEach((s, i) => {
      const a = got[i];
      if (!Array.isArray(a) || !Number.isFinite(a[0]) || !Number.isFinite(a[1])) return;
      const d = Math.max(Math.abs(a[0] - s.x), Math.abs(a[1] - s.p));
      const band = BANDS.find((b) => d <= b[0]);
      if (!band) return;
      pts += band[1];
      if (band[2] !== 'rim') made++;
      if (band[2] === 'swish') swishes++;
    });
    const full = swishes === SHOTS;
    if (full) pts += 10;
    return { pts, hits: made, total: SHOTS, full, title: full ? 'שלוש קליעות נקיות!' : `${made} מתוך ${SHOTS} סלים`, sub: swishes ? `🌟 ${swishes} קליעות נקיות` : 'המשיכו להתאמן' };
  }
}

module.exports = HoopsGame;
