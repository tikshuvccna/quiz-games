// "טיל לירח" - co-op. Every correct answer is a fuel boost; repeat the light sequence (Simon) to make it a big
// one. The whole class has to fly the rocket to the moon before time runs out. Wrong answers leak fuel.
const QuizGame = require('./base');

const GOAL_K = { easy: 0.7, normal: 0.95, hard: 1.2 };
const MEMORY_FALLBACK_MS = 25000;
const MILESTONES = [
  { at: 0.25, text: '☁️ עברנו את העננים!' },
  { at: 0.5, text: '🌌 יצאנו לחלל!' },
  { at: 0.75, text: '🛰️ חלפנו על פני תחנת החלל!' },
];

class RocketGame extends QuizGame {
  static id = 'rocket';
  static title = 'טיל לירח';
  static emoji = '🚀';
  static mode = 'coop';
  static reward = ['הצתה', 'הצתות'];
  static blurb = 'כולם ביחד מטיסים טיל לירח. כל תשובה נכונה = דלק, ואם חוזרים נכון על רצף האורות מקבלים דחיפה ענקית. תשובה שגויה מדליפה דלק. מגיעים לירח לפני שנגמר הזמן?';
  static tickMs = 1000;
  static defaults = { duration: 300, difficulty: 'normal' };
  static options = [{ key: 'difficulty', label: 'קושי', choices: [['easy', 'קל'], ['normal', 'רגיל'], ['hard', 'קשה']] }];

  start() {
    const n = Math.max(1, this.room.players.size);
    this.goal = Math.round(n * this.room.settings.duration * (GOAL_K[this.room.settings.difficulty] || 1));
    this.alt = 0;
    this.passed = 0;
    this.ev = [];
    this.eid = 1;
    for (const p of this.players()) this.initPlayer(p, { fuel: 0, perfect: 0, seq: null, boost: null, timer: null });
    this.addFeed('🚀 ספירה לאחור… המראה!');
  }

  climb(d) {
    this.alt = Math.max(0, Math.min(this.goal, this.alt + d));
    while (this.passed < MILESTONES.length && this.alt >= this.goal * MILESTONES[this.passed].at) {
      this.addFeed(MILESTONES[this.passed].text);
      this.passed++;
    }
  }

  onAnswer(p, correct, rewarded) {
    if (!correct) {
      this.climb(-3);
      return { note: '💨 דליפת דלק! -3' };
    }
    return rewarded ? { note: '🚀 הכינו את המנוע!' } : {};
  }

  score(p) {
    return p.g ? p.g.fuel : 0;
  }

  afterFeedback(p) {
    const g = p.g;
    if (!g.last || !g.last.correct) return this.nextQuestion(p);
    const len = 3 + Math.min(3, Math.floor(g.streak / 2));
    g.seq = Array.from({ length: len }, () => Math.floor(Math.random() * 4));
    g.phase = 'memory';
    g.timer = this.later(() => this.ignite(p, []), MEMORY_FALLBACK_MS);
  }

  action(p, type, data) {
    if (type === 'memory' && p.g.phase === 'memory') this.ignite(p, Array.isArray(data.seq) ? data.seq : []);
  }

  ignite(p, input) {
    const g = p.g;
    if (this.over || g.phase !== 'memory') return;
    clearTimeout(g.timer);
    const seq = g.seq;
    let right = 0;
    while (right < seq.length && input[right] === seq[right]) right++;
    const perfect = right === seq.length;
    const boost = 6 + Math.round((14 * right) / seq.length) + (perfect ? (seq.length - 3) * 3 : 0);
    this.climb(boost);
    g.fuel += boost;
    if (perfect) g.perfect++;
    g.boost = { boost, right, len: seq.length, perfect };
    g.phase = 'boosted';
    this.ev.push({ id: this.eid++, name: p.name, boost, perfect });
    if (this.ev.length > 12) this.ev.shift();
    this.room.pushPlayer(p);
    this.room.scheduleHostPush();
    if (this.alt >= this.goal) {
      this.addFeed('🌕 נחתנו על הירח!');
      return this.room.end();
    }
    this.later(() => {
      if (g.phase !== 'boosted') return;
      this.turnDone(p);
      this.room.pushPlayer(p);
    }, 1300);
  }

  top() {
    return this.players()
      .filter((p) => p.g)
      .map((p) => ({ name: p.name, fuel: p.g.fuel }))
      .sort((a, b) => b.fuel - a.fuel);
  }

  publicState() {
    return { kind: 'rocket', alt: this.alt, goal: this.goal, ev: this.ev, feed: this.feed, top: this.top().slice(0, 5) };
  }

  personal(p) {
    const g = p.g;
    const out = { ...this.baseView(p), fuel: g.fuel, pct: Math.round((this.alt / this.goal) * 100) };
    if (g.phase === 'memory') out.seq = g.seq;
    if (g.phase === 'boosted') out.boost = g.boost;
    return out;
  }

  results() {
    const stats = new Map(this.players().map((p) => [p.name, p.g]));
    return {
      kind: 'rocket',
      victory: this.alt >= this.goal,
      pct: Math.round((this.alt / this.goal) * 100),
      players: this.top().map((t) => ({ ...t, perfect: stats.get(t.name).perfect, correct: stats.get(t.name).correct })),
    };
  }
}

module.exports = RocketGame;
