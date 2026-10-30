// "קשתות" - targets slide across the phone; tap to shoot as one passes. The server knows where each target is at
// every moment (it chose the lanes and the timing), so a tap is judged by where and when it landed.
const FfaAction = require('./ffa');

const N = 6;
const CROSS_MS = 1500;
const RADIUS = 0.11; // how close the tap must be

class ArcheryGame extends FfaAction {
  static id = 'archery';
  static kind = 'archery';
  static order = 32;
  static title = 'קשתות';
  static emoji = '🎯';
  static reward = ['סיבוב', 'סיבובים'];
  static blurb = 'כל אחד לעצמו. תשובה נכונה פותחת סיבוב קשתות: מטרות חולפות על המסך, ומקישים עליהן בדיוק כשהן עוברות. ככל שמדויקים יותר, יש יותר נקודות.';

  makeRound() {
    const targets = [];
    let t = 700;
    for (let i = 0; i < N; i++) {
      targets.push({ t: Math.round(t), y: +(0.2 + Math.random() * 0.55).toFixed(2), dir: i % 2 ? 1 : -1, ms: CROSS_MS - Math.floor(Math.random() * 400) });
      t += 900 + Math.random() * 500;
    }
    return { pub: { targets }, secret: targets, ms: Math.round(t + CROSS_MS + 400) };
  }

  grade(g, data, targets) {
    const taps = (Array.isArray(data.taps) ? data.taps : []).slice(0, 40).filter((x) => Array.isArray(x) && x.length >= 3 && x.slice(0, 3).every(Number.isFinite));
    const used = new Set();
    let hits = 0;
    let bull = 0;
    for (const tg of targets) {
      let best = -1;
      let bd = Infinity;
      taps.forEach((tp, i) => {
        if (used.has(i)) return;
        const k = (tp[2] - tg.t) / tg.ms; // how far across the target is at the time of the tap
        if (k < 0 || k > 1) return;
        const x = tg.dir > 0 ? k : 1 - k;
        const d = Math.hypot((tp[0] - x) * 0.55, tp[1] - tg.y); // the screen is narrower than it is tall: x counts less
        if (d < bd) { bd = d; best = i; }
      });
      if (best >= 0 && bd <= RADIUS) {
        used.add(best);
        hits++;
        if (bd <= RADIUS * 0.4) bull++;
      }
    }
    const full = hits === N;
    return { pts: hits * 4 + bull * 2 + (full ? 6 : 0), hits, total: N, full, title: full ? 'כל המטרות!' : `${hits} מתוך ${N} מטרות`, sub: bull ? `🎯 ${bull} בול` : 'ממשיכים לכוון' };
  }
}

module.exports = ArcheryGame;
