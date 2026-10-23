// "צוללת ההצלה" - co-op, like Kahoot's Submarine Squad. The class submarine dives to a sunken treasure with a giant
// anglerfish on its tail. A correct answer is a short steering run on the phone: drag the sub up and down past the
// mines and grab pearls. Every metre also charges the sonar; when it's full the sub goes into diving mode for a
// few seconds: every run counts double and the fish falls far behind.
const ChaseGame = require('./chase');

const MINES = 6;
const PEARLS = 4;
const RUN_MS = 6000;
const DIVE_MS = 15000;
const DIVE_NEED = 0.2; // sonar charge needed for a dive, as a share of the goal

class SubGame extends ChaseGame {
  static id = 'sub';
  static order = 21;
  static title = 'צוללת ההצלה';
  static emoji = '🐟';
  static reward = ['צלילה', 'צלילות'];
  static blurb = 'כל הכיתה בצוללת אחת, ודג פנס ענק רודף אחריה! תשובה נכונה = נסיעה קצרה: גוררים את הצוללת למעלה ולמטה, עוקפים מוקשים ואוספים פנינים. כשהסונאר מתמלא הצוללת נכנסת למצב צלילה: הכול שווה כפול!';
  static phases = ['dive', 'dived'];
  static actionType = 'dive';
  static fallbackMs = 12000;
  static milestones = ['🐠 עברנו את שונית האלמוגים!', '🦑 חצי הדרך! המים מחשיכים…', '💎 האוצר מנצנץ במעמקים!'];
  static caughtText = (back) => `🐟 הדג נגס בצוללת! ${back} מטר אחורה`;
  static wonText = '🎉 הגענו לאוצר!';
  static startText = '🐟 דג הפנס התעורר! צוללים!';
  static rageNote = '🐟 הדג מתקרב!';
  static readyNote = '🌊 תפסו את ההגה!';

  setup() {
    this.sonar = 0;
    this.diveUntil = 0;
    this.dives = 0;
  }

  diving() {
    return Date.now() < this.diveUntil;
  }

  boostFactor() {
    return this.diving() ? 2 : 1;
  }

  // mines and pearls spread over the run, never two things at the same moment
  makeAction() {
    const slots = Array.from({ length: MINES + PEARLS }, (_, i) => 600 + (i * (RUN_MS - 1400)) / (MINES + PEARLS - 1));
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    const at = (t) => [Math.round(t), Math.round(10 + Math.random() * 80)];
    return { ms: RUN_MS, mines: slots.slice(0, MINES).sort((a, b) => a - b).map(at), pearls: slots.slice(MINES).sort((a, b) => a - b).map(at) };
  }

  grade(p, data) {
    if (!data) return { gain: 4, hits: 0, pearls: 0 };
    const hits = Math.max(0, Math.min(MINES, Math.floor(Number(data.hits) || 0)));
    const got = Array.isArray(data.pearls) ? new Set(data.pearls.filter((k) => Number.isInteger(k) && k >= 0 && k < PEARLS)).size : 0;
    const perfect = hits === 0 && got >= PEARLS - 1;
    return { gain: Math.max(3, 8 + 3 * got - 3 * hits + (perfect ? 6 : 0)), perfect, hits, pearls: got };
  }

  advance(d) {
    super.advance(d);
    if (d <= 0 || this.diving()) return;
    this.sonar += d;
    if (this.sonar >= this.goal * DIVE_NEED) {
      this.sonar = 0;
      this.dives++;
      this.diveUntil = Date.now() + DIVE_MS;
      this.chaser = Math.max(0, this.chaser - Math.round(this.goal * 0.04));
      this.event({ kind: 'dive' });
      this.addFeed('🌀 מצב צלילה! הכול שווה כפול');
    }
  }

  boardExtra() {
    return { sonar: Math.min(100, Math.round((this.sonar / (this.goal * DIVE_NEED)) * 100)), diving: this.diving() ? Math.ceil((this.diveUntil - Date.now()) / 1000) : 0 };
  }

  personal(p) {
    return { ...super.personal(p), diving: this.diving() };
  }

  results() {
    return { ...super.results(), dives: this.dives };
  }
}

module.exports = SubGame;
