// "דייגים" - free for all. A correct answer puts a fish on the hook; hold to reel and keep it inside the
// green zone until the catch meter is full. Rarer fish fight harder and are worth more.
const QuizGame = require('./base');

const FISH = [
  { k: 'boot', v: 1, w: 7, speed: 0.35 },
  { k: 'small', v: 3, w: 38, speed: 0.55 },
  { k: 'medium', v: 6, w: 28, speed: 0.8 },
  { k: 'big', v: 12, w: 16, speed: 1.1 },
  { k: 'gold', v: 25, w: 8, speed: 1.45 },
  { k: 'octo', v: 40, w: 3, speed: 1.8 },
];
const VALUE = Object.fromEntries(FISH.map((f) => [f.k, f.v]));
const REEL_FALLBACK_MS = 16000;

function rollFish(streak) {
  // a hot streak makes rare fish more likely
  const boost = 1 + Math.min(streak, 6) * 0.2;
  const table = FISH.map((f) => ({ ...f, w: f.v >= 12 ? f.w * boost : f.w }));
  let r = Math.random() * table.reduce((s, f) => s + f.w, 0);
  for (const f of table) if ((r -= f.w) < 0) return f;
  return FISH[1];
}

class FishingGame extends QuizGame {
  static id = 'fishing';
  static title = 'דייגים';
  static emoji = '🎣';
  static mode = 'ffa';
  static reward = ['חכה', 'חכות'];
  static blurb = 'כל אחד לעצמו. תשובה נכונה = דג על החכה. לוחצים ומחזיקים כדי לגלגל ושומרים על הדג בתוך האזור הירוק. דגי זהב ותמנונים שווים הכי הרבה, אבל הם נלחמים!';
  static tickMs = 1000;
  static defaults = { duration: 300 };
  static options = [];

  start() {
    this.ev = [];
    this.eid = 1;
    for (const p of this.players()) this.initPlayer(p, { total: 0, caught: {}, best: null, fish: null, result: null, timer: null });
  }

  onAnswer(p, correct, rewarded) {
    return rewarded ? { note: '🎣 משהו נתפס בחכה!' } : {};
  }

  score(p) {
    return p.g ? p.g.total : 0;
  }

  afterFeedback(p) {
    const g = p.g;
    if (!g.last || !g.last.correct) return this.nextQuestion(p);
    const f = rollFish(g.streak);
    g.fish = { k: f.k, speed: f.speed, seed: Math.floor(Math.random() * 1e6) };
    g.phase = 'reel';
    g.timer = this.later(() => this.land(p, false), REEL_FALLBACK_MS);
  }

  action(p, type, data) {
    if (type === 'reel' && p.g.phase === 'reel') this.land(p, data.ok === true);
  }

  land(p, ok) {
    const g = p.g;
    if (this.over || g.phase !== 'reel') return;
    clearTimeout(g.timer);
    const k = g.fish.k;
    const v = ok ? VALUE[k] : 0;
    if (ok) {
      g.total += v;
      g.caught[k] = (g.caught[k] || 0) + 1;
      if (!g.best || VALUE[k] > VALUE[g.best]) g.best = k;
      if (v >= 25) this.addFeed(`🎣 ${p.name} תפס/ה ${k === 'octo' ? 'תמנון ענק' : 'דג זהב'}! +${v}`);
      this.ev.push({ id: this.eid++, name: p.name, k, v });
      if (this.ev.length > 12) this.ev.shift();
    }
    g.result = { ok, k, v };
    g.phase = 'landed';
    this.room.pushPlayer(p);
    this.room.scheduleHostPush();
    this.later(() => {
      if (g.phase !== 'landed') return;
      this.turnDone(p);
      this.room.pushPlayer(p);
    }, 1600);
  }

  ranking() {
    return this.players()
      .filter((p) => p.g)
      .map((p) => ({ name: p.name, total: p.g.total, best: p.g.best, count: Object.values(p.g.caught).reduce((s, n) => s + n, 0) }))
      .sort((a, b) => b.total - a.total);
  }

  publicState() {
    const r = this.ranking();
    return { kind: 'fishing', ranking: r.slice(0, 8), total: r.length, ev: this.ev, feed: this.feed };
  }

  personal(p) {
    const g = p.g;
    const out = { ...this.baseView(p), total: g.total };
    out.rank = 1 + this.players().filter((o) => o.g && o.g.total > g.total).length;
    if (g.phase === 'reel') out.fish = g.fish;
    if (g.phase === 'landed') out.result = g.result;
    return out;
  }

  results() {
    const stats = new Map(this.players().map((p) => [p.name, p.g]));
    return { kind: 'fishing', players: this.ranking().map((r) => ({ ...r, correct: stats.get(r.name).correct })) };
  }
}

module.exports = FishingGame;
