// "מרדף היהלומים" - free for all. A correct answer opens a short catch round on the phone:
// tap the treasure, avoid the junk. The server hands out the items and validates what was caught.
const QuizGame = require('./base');

const CATCH_MS = 7000;
const KINDS = [
  { k: 'coin', v: 1, w: 45 },
  { k: 'gem', v: 3, w: 22 },
  { k: 'crown', v: 10, w: 5 },
  { k: 'rock', v: -2, w: 20 },
  { k: 'bomb', v: -5, w: 8 },
];
const VALUE = Object.fromEntries(KINDS.map((k) => [k.k, k.v]));
const TIERS = [0, 30, 80, 160, 300];

function pickKind() {
  let r = Math.random() * KINDS.reduce((s, k) => s + k.w, 0);
  for (const k of KINDS) if ((r -= k.w) < 0) return k.k;
  return 'coin';
}

const tierOf = (gems) => TIERS.reduce((t, min, i) => (gems >= min ? i : t), 0);

class GemsGame extends QuizGame {
  static id = 'gems';
  static title = 'מרדף היהלומים';
  static emoji = '💎';
  static mode = 'ffa';
  static reward = ['סבב איסוף', 'סבבי איסוף'];
  static blurb = 'כל אחד לעצמו. עונים נכון ואז רצים לתפוס יהלומים, מטבעות וכתרים. אבל תיזהרו מהסלעים והפצצות!';
  static tickMs = 1000;
  static defaults = { duration: 300 };
  static options = [];

  start() {
    this.cid = 1;
    for (const p of this.players()) this.initPlayer(p, { gems: 0, catch: null, collected: null, catchTimer: null, caughtTotal: 0 });
  }

  stop() {
    super.stop();
    for (const p of this.players()) if (p.g) clearTimeout(p.g.catchTimer);
  }

  score(p) {
    return p.g ? p.g.gems : 0;
  }

  onAnswer(p, correct, rewarded) {
    if (!rewarded) return {};
    const s = p.g.streak;
    return { note: s >= 5 ? '💎 רצף 5! כל הרווחים ×2' : '💎 מתכוננים לאיסוף!' };
  }

  afterFeedback(p) {
    const g = p.g;
    if (!g.last || !g.last.correct) return this.nextQuestion(p);
    const mult = g.streak >= 5 ? 2 : 1;
    const count = 14 + 2 * Math.min(g.streak, 5);
    const items = [];
    for (let i = 0; i < count; i++) {
      items.push({ id: i, t: Math.round(150 + Math.random() * (CATCH_MS - 2500) * (i / count + Math.random() * 0.25)), x: Math.round(6 + Math.random() * 84), k: pickKind() });
    }
    g.catch = { id: this.cid++, items, ms: CATCH_MS, mult };
    g.phase = 'catch';
    g.catchTimer = this.later(() => this.finishCatch(p, []), CATCH_MS + 3500);
  }

  action(p, type, data) {
    if (type === 'catch' && p.g.phase === 'catch') this.finishCatch(p, Array.isArray(data.ids) ? data.ids : []);
  }

  finishCatch(p, ids) {
    const g = p.g;
    if (this.over || g.phase !== 'catch') return;
    clearTimeout(g.catchTimer);
    const byId = new Map(g.catch.items.map((i) => [i.id, i]));
    const seen = new Set();
    let pos = 0;
    let neg = 0;
    let n = 0;
    for (const id of ids.slice(0, 80)) {
      const it = byId.get(id);
      if (!it || seen.has(id)) continue;
      seen.add(id);
      n++;
      const v = VALUE[it.k];
      if (v > 0) pos += v;
      else neg += v;
    }
    const gain = pos * g.catch.mult + neg;
    g.gems = Math.max(0, g.gems + gain);
    g.collected = { gain, n, mult: g.catch.mult };
    g.catch = null;
    g.phase = 'collected';
    if (gain >= 20) this.addFeed(`💎 ${p.name} אסף/ה +${gain}!`);
    this.room.pushPlayer(p);
    this.room.scheduleHostPush();
    this.later(() => {
      if (g.phase !== 'collected') return;
      this.turnDone(p);
      this.room.pushPlayer(p);
    }, 1500);
  }

  ranking() {
    return this.players()
      .filter((p) => p.g)
      .map((p) => ({ name: p.name, gems: p.g.gems, tier: tierOf(p.g.gems), streak: p.g.streak }))
      .sort((a, b) => b.gems - a.gems);
  }

  publicState() {
    const r = this.ranking();
    return { kind: 'gems', ranking: r.slice(0, 10), total: r.length, feed: this.feed, tiers: TIERS };
  }

  personal(p) {
    const g = p.g;
    const out = { ...this.baseView(p), gems: g.gems, tier: tierOf(g.gems), tiers: TIERS };
    out.rank = 1 + this.players().filter((o) => o.g && o.g.gems > g.gems).length;
    if (g.phase === 'catch') out.catch = g.catch;
    if (g.phase === 'collected') out.collected = g.collected;
    return out;
  }

  results() {
    const r = this.ranking();
    const stats = new Map(this.players().map((p) => [p.name, p.g]));
    return {
      kind: 'gems',
      players: r.map((x) => ({ ...x, correct: stats.get(x.name).correct, wrong: stats.get(x.name).wrong, best: stats.get(x.name).bestStreak })),
      tiers: TIERS,
    };
  }
}

module.exports = GemsGame;
