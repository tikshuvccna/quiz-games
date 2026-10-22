// "מירוץ הקארטים" - free for all. Correct answers boost your kart; then dodge into the open lane for a bonus.
const QuizGame = require('./base');

const LAP = 100;
const DODGE_MS = 3000;

class RaceGame extends QuizGame {
  static id = 'race';
  static order = 8;
  static title = 'מירוץ הקארטים';
  static emoji = '🏎️';
  static mode = 'ffa';
  static reward = ['עקיפה', 'עקיפות'];
  static blurb = 'כל אחד לעצמו. תשובה נכונה מאיצה את הקארט, ואז צריך לבחור את הנתיב הפנוי בלי להתנגש. מי שמסיים הכי הרבה הקפות מנצח.';
  static tickMs = 1000;
  static defaults = { duration: 300 };
  static options = [];

  start() {
    for (const p of this.players()) this.initPlayer(p, { dist: 0, safe: 0, dodge: null, timer: null });
  }

  stop() {
    super.stop();
    for (const p of this.players()) if (p.g) clearTimeout(p.g.timer);
  }

  addDist(p, d) {
    const g = p.g;
    const before = Math.floor(g.dist / LAP);
    g.dist = Math.max(0, g.dist + d);
    const after = Math.floor(g.dist / LAP);
    if (after > before) this.addFeed(`🏁 ${p.name} סיים/ה הקפה ${after}!`);
  }

  score(p) {
    return p.g ? Math.round(p.g.dist) : 0;
  }

  onAnswer(p, correct) {
    const g = p.g;
    if (!correct) {
      const loss = Math.min(g.dist, 3);
      this.addDist(p, -loss);
      return { note: loss ? '💥 סטייה! -3' : '' };
    }
    const boost = 6 + Math.min(g.streak, 5);
    this.addDist(p, boost);
    return { note: `🏎️ +${boost} מרחק` };
  }

  afterFeedback(p) {
    const g = p.g;
    if (!g.last || !g.last.correct) return this.nextQuestion(p);
    g.safe = Math.floor(Math.random() * 3);
    g.phase = 'dodge';
    g.timer = this.later(() => this.finishDodge(p, -1), DODGE_MS + 1500);
  }

  action(p, type, data) {
    if (type === 'dodge' && p.g.phase === 'dodge') this.finishDodge(p, data.lane);
  }

  finishDodge(p, lane) {
    const g = p.g;
    if (this.over || g.phase !== 'dodge') return;
    clearTimeout(g.timer);
    const ok = lane === g.safe;
    const bonus = ok ? 5 : -2;
    this.addDist(p, bonus);
    g.dodge = { ok, bonus };
    g.phase = 'raced';
    this.room.pushPlayer(p);
    this.room.scheduleHostPush();
    this.later(() => {
      if (g.phase !== 'raced') return;
      this.turnDone(p);
      this.room.pushPlayer(p);
    }, 900);
  }

  ranking() {
    return this.players()
      .filter((p) => p.g)
      .map((p) => ({ name: p.name, dist: Math.round(p.g.dist), lap: Math.floor(p.g.dist / LAP), pos: p.g.dist % LAP, streak: p.g.streak }))
      .sort((a, b) => b.dist - a.dist);
  }

  publicState() {
    const r = this.ranking();
    return { kind: 'race', ranking: r.slice(0, 10), total: r.length, lapLen: LAP, feed: this.feed };
  }

  personal(p) {
    const g = p.g;
    const out = { ...this.baseView(p), dist: Math.round(g.dist), lap: Math.floor(g.dist / LAP) + 1 };
    out.rank = 1 + this.players().filter((o) => o.g && o.g.dist > g.dist).length;
    if (g.phase === 'dodge') out.dodge = { safe: g.safe, ms: DODGE_MS };
    if (g.phase === 'raced') out.raced = g.dodge;
    return out;
  }

  results() {
    const stats = new Map(this.players().map((p) => [p.name, p.g]));
    return {
      kind: 'race',
      players: this.ranking().map((r) => ({ ...r, correct: stats.get(r.name).correct, wrong: stats.get(r.name).wrong, best: stats.get(r.name).bestStreak })),
    };
  }
}

module.exports = RaceGame;
