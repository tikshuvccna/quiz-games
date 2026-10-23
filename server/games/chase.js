// Shared engine for the co-op chase games (robot, sub, lava, zombie). The class moves toward a goal while a chaser
// closes in. A correct answer gives the player an action (each game's own phone mini-game) worth some distance.
// At 25/50/75% of the way the whole class stops for a checkpoint mini-game played together (mash / code / pop):
// the better the class does, the further ahead it jumps and the further the chaser falls back.
// Not a game by itself (no static id), so the registry skips it.
const QuizGame = require('./base');

// a real class gains about 0.9 m/s per player; the chaser takes back CHASER_K of that
const GOAL_K = { easy: 0.4, normal: 0.5, hard: 0.62 };
const CHASER_K = { easy: 0.2, normal: 0.3, hard: 0.4 };
const DASH_GAP = 0.12; // a chaser left this far behind (share of the goal) dashes to catch up
const MINI_KINDS = ['mash', 'code', 'pop'];
const MINI_PLAY = { mash: 7000, code: 12000, pop: 8000 };
const MINI_INTRO = 3500;
const MINI_GRACE = 1500; // late packets from slow phones still count
const MINI_RESULT = 4000;
const CODE_LEN = 4;
const CODE_COLORS = 6;
const POP_N = 8;
const MASH_MAX = 110; // about 15 taps a second is the human limit
const MASH_GOOD = 45; // taps that count as a full score

class ChaseGame extends QuizGame {
  static mode = 'coop';
  static tickMs = 1000;
  static defaults = { duration: 300, difficulty: 'normal', minis: 'on' };
  static options = [
    { key: 'difficulty', label: 'קושי', choices: [['easy', 'קל'], ['normal', 'רגיל'], ['hard', 'קשה']] },
    { key: 'minis', label: 'מיני-משחק בנקודות הציון', choices: [['on', 'כן'], ['off', 'לא']] },
  ];
  // [the action phase, its result phase]
  static phases = ['act', 'acted'];
  static fallbackMs = 9000;
  // feed lines at 25/50/75%, and what a catch is called
  static milestones = ['רבע מהדרך!', 'חצי הדרך!', 'כמעט שם!'];
  static caughtText = (back) => `תפסו אותנו! ${back} מטר אחורה`;
  static wonText = '🎉 הגענו!';
  static startText = 'יוצאים לדרך!';

  start() {
    const n = Math.max(1, this.room.players.size);
    const d = this.room.settings.difficulty;
    this.goal = Math.round(n * this.room.settings.duration * (GOAL_K[d] || 0.5));
    this.speed = n * (CHASER_K[d] || 0.3);
    this.run = Math.round(this.goal * 0.06);
    this.chaser = 0;
    this.catches = 0;
    this.passed = 0;
    this.ev = [];
    this.eid = 1;
    this.mini = null;
    this.miniN = 0;
    this.minisWon = 0;
    this.pendingMini = false;
    this.graceUntil = Date.now() + 8000; // the chaser warms up during the first seconds
    this.setup();
    for (const p of this.players()) this.initPlayer(p, { dist: 0, perfect: 0, res: null, timer: null, saved: null, ...this.playerExtra(p) });
    this.addFeed(this.constructor.startText);
  }

  // ---- hooks for the games ----
  setup() {}
  playerExtra() {
    return {};
  }
  // the per-turn data the phone needs for the action (stored on g.act)
  makeAction() {
    return {};
  }
  // grade the action: data is what the phone sent, or null when it timed out. Returns { gain, perfect, ...extra }
  grade() {
    return { gain: 4 };
  }
  // a multiplier on gains (the sub's diving mode)
  boostFactor() {
    return 1;
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
    const M = this.constructor.milestones;
    while (this.passed < M.length && this.run >= (this.goal * (this.passed + 1)) / (M.length + 1)) {
      this.addFeed(M[this.passed]);
      this.passed++;
      this.pendingMini = this.room.settings.minis !== 'off';
    }
  }

  tick() {
    if (this.over) return;
    if (this.pendingMini && !this.mini) {
      this.pendingMini = false;
      // no checkpoint game in the last half minute: there's no time to come back to the questions
      if (this.room.left() > 30) return this.startMini();
    }
    if (this.mini || Date.now() < this.graceUntil) return;
    // rubber band: the further behind, the faster it closes in, so the chaser is always a threat
    const far = this.run - this.chaser - this.goal * DASH_GAP;
    this.chaser += this.speed + (far > 0 ? far * 0.12 : 0);
    if (this.chaser >= this.run) {
      // caught: everyone is knocked back and the chaser needs a moment to recover
      const back = Math.round(this.goal * 0.05);
      this.run = Math.max(0, this.run - back);
      this.chaser = Math.max(0, this.run - Math.round(this.goal * 0.08));
      this.catches++;
      this.graceUntil = Date.now() + 3000;
      this.event({ kind: 'caught', back });
      this.addFeed(this.constructor.caughtText(back));
    }
  }

  onAnswer(p, correct, rewarded) {
    if (!correct) {
      this.chaser += Math.max(2, this.speed * 2);
      this.event({ kind: 'rage', name: p.name });
      return { note: this.constructor.rageNote || '⚠️ הם מתקרבים!' };
    }
    return rewarded ? { note: this.constructor.readyNote || '🏃 מתכוננים!' } : {};
  }

  score(p) {
    return p.g ? p.g.dist : 0;
  }

  afterFeedback(p) {
    const g = p.g;
    if (!g.last || !g.last.correct) return this.nextQuestion(p);
    // a checkpoint game is on: the action waits for it
    if (this.mini) return this.park(p, this.constructor.phases[0]);
    g.phase = this.constructor.phases[0];
    g.act = this.makeAction(p);
    const turn = g.turn;
    g.timer = this.later(() => {
      if (g.phase === this.constructor.phases[0] && g.turn === turn) this.resolve(p, null);
    }, this.constructor.fallbackMs);
  }

  action(p, type, data) {
    const g = p.g;
    if (type === 'mini') return this.miniAction(p, data);
    if (type === this.constructor.actionType && g.phase === this.constructor.phases[0]) this.resolve(p, data);
  }

  resolve(p, data) {
    const g = p.g;
    if (this.over || g.phase !== this.constructor.phases[0]) return;
    clearTimeout(g.timer);
    const r = this.grade(p, data);
    const f = this.boostFactor();
    const gain = Math.max(0, Math.round(r.gain * f));
    this.advance(gain);
    g.dist += gain;
    if (r.perfect) g.perfect++;
    g.res = { ...r, gain, boosted: f > 1 };
    g.phase = this.constructor.phases[1];
    this.event({ kind: 'boost', name: p.name, gain, perfect: !!r.perfect });
    this.room.pushPlayer(p);
    this.room.scheduleHostPush();
    if (this.run >= this.goal) {
      this.addFeed(this.constructor.wonText);
      return this.room.end();
    }
    const turn = g.turn;
    this.later(() => {
      if (g.phase !== this.constructor.phases[1] || g.turn !== turn) return;
      this.turnDone(p);
      this.room.pushPlayer(p);
    }, 1300);
  }

  // ---- checkpoint mini-games ----
  startMini() {
    const kind = MINI_KINDS[this.miniN++ % MINI_KINDS.length];
    const now = Date.now();
    this.mini = { id: this.miniN, kind, stage: 'intro', at: now, until: now + MINI_INTRO, scores: new Map(), result: null };
    if (kind === 'code') this.mini.code = Array.from({ length: CODE_LEN }, () => Math.floor(Math.random() * CODE_COLORS));
    if (kind === 'pop') this.mini.pops = Array.from({ length: POP_N }, () => [Math.round(10 + Math.random() * 80), Math.round(12 + Math.random() * 70)]);
    for (const p of this.players()) if (p.g) this.park(p);
    this.event({ kind: 'mini', mini: kind });
    this.addFeed('⭐ עצירה! מיני-משחק לכל הכיתה');
    this.later(() => this.miniStage('play', MINI_PLAY[kind]), MINI_INTRO);
    this.room.pushAll();
  }

  // a player stops whatever they were doing for the checkpoint game; resume() puts them back
  park(p, as) {
    const g = p.g;
    if (g.phase === 'mini') return;
    clearTimeout(g.timer);
    g.saved = as || g.phase;
    g.phase = 'mini';
  }

  miniStage(stage, ms) {
    const m = this.mini;
    if (!m) return;
    m.stage = stage;
    m.at = Date.now();
    m.until = m.at + ms;
    if (stage === 'play') this.later(() => this.miniEnd(), ms + MINI_GRACE);
    this.room.pushAll();
  }

  miniAction(p, data) {
    const m = this.mini;
    if (!m || m.stage !== 'play' || p.g.phase !== 'mini' || m.scores.has(p.id) || !data) return;
    let s = 0;
    if (m.kind === 'mash') s = Math.min(1, Math.max(0, Math.floor(Number(data.taps) || 0)) / MASH_GOOD) * (Number(data.taps) <= MASH_MAX ? 1 : 0);
    else if (m.kind === 'code') {
      const seq = Array.isArray(data.seq) ? data.seq.slice(0, CODE_LEN) : [];
      const right = seq.filter((c, i) => c === m.code[i]).length;
      // the whole code right is worth the most; a fast answer gets a little extra
      const fast = Math.max(0, 1 - (Date.now() - m.at) / MINI_PLAY.code);
      s = right === CODE_LEN ? 0.75 + 0.25 * fast : (right / CODE_LEN) * 0.4;
    } else if (m.kind === 'pop') {
      const hits = Array.isArray(data.hits) ? new Set(data.hits.filter((h) => Number.isInteger(h) && h >= 0 && h < POP_N)) : new Set();
      s = hits.size / POP_N;
    }
    m.scores.set(p.id, s);
    p.g.miniScore = s;
    this.room.pushPlayer(p);
    this.room.scheduleHostPush();
    // everyone is done: no need to wait for the clock
    const live = this.players().filter((q) => q.g && q.connected);
    if (live.every((q) => m.scores.has(q.id))) this.miniEnd();
  }

  miniEnd() {
    const m = this.mini;
    if (!m || m.stage !== 'play') return;
    const ps = this.players().filter((p) => p.g);
    const total = ps.reduce((a, p) => a + (m.scores.get(p.id) || 0), 0);
    const r = ps.length ? total / ps.length : 0;
    const jump = Math.round(this.goal * 0.06 * r);
    const push = Math.round(this.goal * 0.07 * r);
    const stars = r >= 0.75 ? 3 : r >= 0.45 ? 2 : r >= 0.15 ? 1 : 0;
    if (stars >= 2) this.minisWon++;
    for (const p of ps) {
      const bonus = Math.round(6 * (m.scores.get(p.id) || 0));
      p.g.dist += bonus;
      p.g.miniBonus = bonus;
    }
    this.chaser = Math.max(0, this.chaser - push);
    this.advance(jump);
    const best = ps.filter((p) => m.scores.has(p.id)).sort((a, b) => m.scores.get(b.id) - m.scores.get(a.id))[0];
    m.result = { pct: Math.round(r * 100), stars, jump, push, best: best && m.scores.get(best.id) > 0 ? best.name : '' };
    this.event({ kind: 'miniEnd', stars, jump });
    this.addFeed(stars ? `${'⭐'.repeat(stars)} הכיתה קפצה ${jump} מטר קדימה!` : '😅 הפעם זה לא הצליח');
    this.miniStage('result', MINI_RESULT);
    this.later(() => this.resumeAll(), MINI_RESULT);
    if (this.run >= this.goal) {
      this.addFeed(this.constructor.wonText);
      this.room.end();
    }
  }

  resumeAll() {
    this.mini = null;
    this.graceUntil = Date.now() + 2500;
    const [act, acted] = this.constructor.phases;
    for (const p of this.players()) {
      const g = p.g;
      if (!g || g.phase !== 'mini') continue;
      const was = g.saved;
      g.saved = null;
      g.miniScore = undefined;
      if (was === 'question') {
        g.phase = 'question';
        g.askedAt = Date.now();
      } else if (was === 'feedback') {
        // finish what the feedback timer would have done
        if (g.last.correct && g.last.rewarded) {
          g.turns = this.constructor.stacks ? 1 : this.amount;
          g.turn++;
          this.afterFeedback(p);
        } else this.nextQuestion(p);
      } else if (was === act) {
        g.turn++; // a fresh view of the same action
        this.afterFeedback(p);
      } else if (was === acted) this.turnDone(p);
      else this.nextQuestion(p);
    }
    this.room.pushAll();
  }

  miniView(p) {
    const m = this.mini;
    const v = { id: m.id, kind: m.kind, stage: m.stage, ms: Math.max(0, m.until - Date.now()), done: m.scores.has(p.id), score: p.g.miniScore };
    if (m.kind === 'code') v.colors = CODE_COLORS;
    if (m.kind === 'pop') v.pops = m.pops;
    if (m.stage === 'result') v.result = { ...m.result, bonus: p.g.miniBonus || 0 };
    return v;
  }

  // ---- views ----
  top() {
    return this.players()
      .filter((p) => p.g)
      .map((p) => ({ name: p.name, dist: p.g.dist }))
      .sort((a, b) => b.dist - a.dist);
  }

  boardExtra() {
    return {};
  }

  publicState() {
    const m = this.mini;
    const mini = m ? { id: m.id, kind: m.kind, stage: m.stage, ms: Math.max(0, m.until - Date.now()), done: m.scores.size, of: this.players().filter((p) => p.g).length, result: m.result } : null;
    if (m && m.kind === 'code' && m.stage !== 'intro') mini.code = m.code;
    const top = this.top();
    return { kind: this.constructor.id, run: Math.round(this.run), chaser: Math.round(this.chaser), goal: this.goal, catches: this.catches, ev: this.ev, feed: this.feed, top: top.slice(0, 5), runners: top.slice(0, 14).map((t) => t.name), mini, ...this.boardExtra() };
  }

  personal(p) {
    const g = p.g;
    const out = { ...this.baseView(p), dist: g.dist, pct: Math.round((this.run / this.goal) * 100), gap: Math.max(0, Math.round(this.run - this.chaser)) };
    if (g.phase === this.constructor.phases[0]) out.act = g.act;
    if (g.phase === this.constructor.phases[1]) out.res = g.res;
    if (g.phase === 'mini' && this.mini) out.mini = this.miniView(p);
    return out;
  }

  results() {
    const stats = new Map(this.players().map((p) => [p.name, p.g]));
    return {
      kind: this.constructor.id,
      victory: this.run >= this.goal,
      pct: Math.round((this.run / this.goal) * 100),
      catches: this.catches,
      minis: this.minisWon,
      players: this.top().map((t) => ({ ...t, perfect: stats.get(t.name).perfect, correct: stats.get(t.name).correct })),
    };
  }
}

module.exports = ChaseGame;
