// "חפרפרות" - whack-a-mole. A correct answer opens an 8-second round: moles pop out of 9 holes, tap them (not the bombs).
const FfaAction = require('./ffa');

const ROUND_MS = 8000;
const SLACK_BEFORE = 80; // a tap may land this early or this late (phone and network delay)
const SLACK_AFTER = 160;

class MoleGame extends FfaAction {
  static id = 'mole';
  static kind = 'mole';
  static order = 18;
  static title = 'חפרפרות';
  static emoji = '🔨';
  static reward = ['סיבוב', 'סיבובים'];
  static blurb = 'כל אחד לעצמו. תשובה נכונה פותחת סיבוב של 8 שניות: חפרפרות מציצות מתשע חורים, מקישים עליהן מהר, אבל לא על הפצצות! ככל שתפגעו ביותר חפרפרות, יש יותר נקודות.';

  makeRound(g) {
    const count = 12 + Math.min(6, g.streak);
    const events = [];
    const busyUntil = new Array(9).fill(0);
    let t = 500;
    for (let i = 0; i < count; i++) {
      // a free hole at this moment
      let h = Math.floor(Math.random() * 9);
      for (let k = 0; k < 9 && busyUntil[h] > t; k++) h = (h + 1) % 9;
      const d = 700 + Math.floor(Math.random() * 500);
      const bomb = i > 2 && Math.random() < 0.2;
      events.push({ h, t: Math.round(t), d, b: bomb });
      busyUntil[h] = t + d + 150;
      t += 330 + Math.random() * 270;
      if (t > ROUND_MS - 1200) break;
    }
    return { pub: { events }, secret: events, ms: ROUND_MS };
  }

  grade(g, data, events) {
    const taps = (Array.isArray(data.taps) ? data.taps : [])
      .slice(0, 60)
      .filter((x) => Array.isArray(x) && Number.isInteger(x[0]) && x[0] >= 0 && x[0] < 9 && Number.isFinite(x[1]))
      .map((x) => ({ h: x[0], t: x[1] }));
    const used = new Set();
    let hits = 0;
    let bombs = 0;
    for (const e of events) {
      const i = taps.findIndex((tp, k) => !used.has(k) && tp.h === e.h && tp.t >= e.t - SLACK_BEFORE && tp.t <= e.t + e.d + SLACK_AFTER);
      if (i < 0) continue;
      used.add(i);
      if (e.b) bombs++;
      else hits++;
    }
    const total = events.filter((e) => !e.b).length;
    const full = hits === total && bombs === 0;
    const pts = Math.max(0, hits * 3 - bombs * 4) + (full ? 6 : 0);
    return { pts, hits, total, full, title: full ? 'כל החפרפרות!' : `${hits} מתוך ${total} חפרפרות`, sub: bombs ? `💣 פגעתם ב־${bombs} פצצות` : 'בלי פצצות, כל הכבוד' };
  }
}

module.exports = MoleGame;
