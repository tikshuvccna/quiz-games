// "בורחים מהרובוט" - co-op. The class runs down a factory corridor with a robot on its heels. A correct answer is a
// hold-to-boost sprint: hold the button and let go just before the engine overheats. Reach the exit door in time!
// If the robot catches the class it zaps everyone back a little; wrong answers give the robot a burst of speed.
const QuizGame = require('./base');

// a real class gains about 0.9 m/s per player; the robot takes back ROBOT_K of that
const GOAL_K = { easy: 0.4, normal: 0.5, hard: 0.62 };
const ROBOT_K = { easy: 0.2, normal: 0.3, hard: 0.4 };
const DASH_GAP = 0.12; // a robot left this far behind (share of the goal) dashes to catch up
const BOOST_FALLBACK_MS = 9000;
const MILESTONES = [
  { at: 0.25, text: '🚪 עברנו את שער המחסן!' },
  { at: 0.5, text: '⚙️ חצי הדרך! המפעל רועד…' },
  { at: 0.75, text: '💡 רואים את האור ביציאה!' },
];

class RobotGame extends QuizGame {
  static id = 'robot';
  static order = 16;
  static title = 'בורחים מהרובוט';
  static emoji = '🤖';
  static mode = 'coop';
  static reward = ['ספרינט', 'ספרינטים'];
  static blurb = 'כל הכיתה בורחת ביחד מרובוט ענק! תשובה נכונה = ספרינט: לוחצים ומחזיקים, ומשחררים רגע לפני שהמנוע מתחמם מדי. אם הרובוט משיג אתכם הוא מחזיר את כולם אחורה. מגיעים ליציאה בזמן?';
  static tickMs = 1000;
  static defaults = { duration: 300, difficulty: 'normal' };
  static options = [{ key: 'difficulty', label: 'קושי', choices: [['easy', 'קל'], ['normal', 'רגיל'], ['hard', 'קשה']] }];

  start() {
    const n = Math.max(1, this.room.players.size);
    const d = this.room.settings.difficulty;
    this.goal = Math.round(n * this.room.settings.duration * (GOAL_K[d] || 0.5));
    this.speed = n * (ROBOT_K[d] || 0.3);
    this.run = Math.round(this.goal * 0.06);
    this.robot = 0;
    this.zaps = 0;
    this.passed = 0;
    this.ev = [];
    this.eid = 1;
    this.graceUntil = Date.now() + 8000; // the robot powers up during the first seconds
    for (const p of this.players()) this.initPlayer(p, { dist: 0, perfect: 0, sprint: null, timer: null });
    this.addFeed('🤖 הרובוט התעורר! רוצו!');
  }

  stop() {
    super.stop();
    for (const p of this.players()) if (p.g) clearTimeout(p.g.timer);
  }

  event(e) {
    this.ev.push({ id: this.eid++, ...e });
    if (this.ev.length > 14) this.ev.shift();
  }

  advance(d) {
    this.run = Math.max(0, Math.min(this.goal, this.run + d));
    while (this.passed < MILESTONES.length && this.run >= this.goal * MILESTONES[this.passed].at) {
      this.addFeed(MILESTONES[this.passed].text);
      this.passed++;
    }
  }

  tick() {
    if (this.over || Date.now() < this.graceUntil) return;
    // rubber band: the further behind, the faster it closes in, so the robot is always a threat
    const far = this.run - this.robot - this.goal * DASH_GAP;
    this.robot += this.speed + (far > 0 ? far * 0.12 : 0);
    if (this.robot >= this.run) {
      // caught: everyone is zapped back and the robot needs a moment to recharge
      const back = Math.round(this.goal * 0.05);
      this.run = Math.max(0, this.run - back);
      this.robot = Math.max(0, this.run - Math.round(this.goal * 0.08));
      this.zaps++;
      this.graceUntil = Date.now() + 3000;
      this.event({ kind: 'zap', back });
      this.addFeed(`⚡ הרובוט תפס אותנו! ${back} מטר אחורה`);
    }
  }

  onAnswer(p, correct, rewarded) {
    if (!correct) {
      this.robot += Math.max(2, this.speed * 2);
      this.event({ kind: 'rage', name: p.name });
      return { note: '🤖 הרובוט מאיץ!' };
    }
    return rewarded ? { note: '🏃 הכינו את הספרינט!' } : {};
  }

  score(p) {
    return p.g ? p.g.dist : 0;
  }

  afterFeedback(p) {
    const g = p.g;
    if (!g.last || !g.last.correct) return this.nextQuestion(p);
    g.phase = 'sprint';
    g.timer = this.later(() => this.sprint(p, 0.3), BOOST_FALLBACK_MS);
  }

  action(p, type, data) {
    if (type === 'sprint' && p.g.phase === 'sprint') this.sprint(p, data.heat);
  }

  // heat 0..1 = how long the button was held; over 1 = the engine overheated
  sprint(p, rawHeat) {
    const g = p.g;
    if (this.over || g.phase !== 'sprint') return;
    clearTimeout(g.timer);
    const heat = Math.max(0, Math.min(1.2, Number(rawHeat) || 0));
    const burnt = heat > 1;
    const perfect = !burnt && heat >= 0.85;
    const gain = burnt ? 4 : Math.round(4 + 16 * heat + (perfect ? 6 : 0));
    this.advance(gain);
    g.dist += gain;
    if (perfect) g.perfect++;
    g.sprint = { gain, perfect, burnt };
    g.phase = 'sprinted';
    this.event({ kind: 'boost', name: p.name, gain, perfect });
    this.room.pushPlayer(p);
    this.room.scheduleHostPush();
    if (this.run >= this.goal) {
      this.addFeed('🎉 יצאנו! ברחנו מהרובוט!');
      return this.room.end();
    }
    this.later(() => {
      if (g.phase !== 'sprinted') return;
      this.turnDone(p);
      this.room.pushPlayer(p);
    }, 1300);
  }

  top() {
    return this.players()
      .filter((p) => p.g)
      .map((p) => ({ name: p.name, dist: p.g.dist }))
      .sort((a, b) => b.dist - a.dist);
  }

  publicState() {
    return { kind: 'robot', run: Math.round(this.run), robot: Math.round(this.robot), goal: this.goal, zaps: this.zaps, ev: this.ev, feed: this.feed, top: this.top().slice(0, 5), runners: this.top().slice(0, 14).map((t) => t.name) };
  }

  personal(p) {
    const g = p.g;
    const out = { ...this.baseView(p), dist: g.dist, pct: Math.round((this.run / this.goal) * 100), gap: Math.max(0, Math.round(this.run - this.robot)) };
    if (g.phase === 'sprinted') out.sprint = g.sprint;
    return out;
  }

  results() {
    const stats = new Map(this.players().map((p) => [p.name, p.g]));
    return {
      kind: 'robot',
      victory: this.run >= this.goal,
      pct: Math.round((this.run / this.goal) * 100),
      zaps: this.zaps,
      players: this.top().map((t) => ({ ...t, perfect: stats.get(t.name).perfect, correct: stats.get(t.name).correct })),
    };
  }
}

module.exports = RobotGame;
