// "מגדל השמיים" - free for all. A correct answer earns a swinging block; stop it in the middle to stack floors.
const QuizGame = require('./base');

const DROP_FALLBACK_MS = 8000;

class TowerGame extends QuizGame {
  static id = 'tower';
  static order = 10;
  static title = 'מגדל השמיים';
  static emoji = '🏗️';
  static mode = 'ffa';
  static reward = ['בלוק', 'בלוקים'];
  static blurb = 'כל אחד לעצמו. תשובה נכונה נותנת בלוק מתנדנד, ועוצרים אותו בדיוק באמצע כדי לבנות קומה (או שתיים). תשובה שגויה מפילה קומה. מי שבונה את המגדל הגבוה ביותר מנצח.';
  static tickMs = 1000;
  static defaults = { duration: 300 };
  static options = [];

  start() {
    for (const p of this.players()) this.initPlayer(p, { floors: 0, perfects: 0, drop: null, timer: null });
  }

  stop() {
    super.stop();
    for (const p of this.players()) if (p.g) clearTimeout(p.g.timer);
  }

  score(p) {
    return p.g ? p.g.floors : 0;
  }

  onAnswer(p, correct, rewarded) {
    const g = p.g;
    if (rewarded) return { note: '🏗️ תכוונו את הבלוק!' };
    if (correct) return {};
    if (g.floors > 0) {
      g.floors--;
      return { note: '💥 קומה קרסה!' };
    }
    return {};
  }

  afterFeedback(p) {
    const g = p.g;
    if (!g.last || !g.last.correct) return this.nextQuestion(p);
    g.phase = 'drop';
    g.timer = this.later(() => this.finishDrop(p, 0), DROP_FALLBACK_MS);
  }

  action(p, type, data) {
    if (type === 'drop' && p.g.phase === 'drop') this.finishDrop(p, data.acc);
  }

  finishDrop(p, rawAcc) {
    const g = p.g;
    if (this.over || g.phase !== 'drop') return;
    clearTimeout(g.timer);
    const acc = Math.max(0, Math.min(1, Number(rawAcc) || 0));
    const perfect = acc >= 0.88;
    const gain = perfect ? 2 : acc >= 0.5 ? 1 : 0;
    g.floors += gain;
    if (perfect) g.perfects++;
    g.drop = { gain, perfect };
    g.phase = 'dropped';
    if (g.floors > 0 && g.floors % 10 === 0 && gain) this.addFeed(`🏗️ ${p.name} הגיע/ה ל־${g.floors} קומות!`);
    this.room.pushPlayer(p);
    this.room.scheduleHostPush();
    this.later(() => {
      if (g.phase !== 'dropped') return;
      this.turnDone(p);
      this.room.pushPlayer(p);
    }, 1000);
  }

  ranking() {
    return this.players()
      .filter((p) => p.g)
      .map((p) => ({ name: p.name, floors: p.g.floors }))
      .sort((a, b) => b.floors - a.floors);
  }

  publicState() {
    const r = this.ranking();
    return { kind: 'tower', ranking: r.slice(0, 12), total: r.length, feed: this.feed };
  }

  personal(p) {
    const g = p.g;
    const out = { ...this.baseView(p), floors: g.floors };
    out.rank = 1 + this.players().filter((o) => o.g && o.g.floors > g.floors).length;
    if (g.phase === 'drop') out.speed = 0.45 + Math.min(g.floors, 30) * 0.025;
    if (g.phase === 'dropped') out.drop = g.drop;
    return out;
  }

  results() {
    const stats = new Map(this.players().map((p) => [p.name, p.g]));
    return {
      kind: 'tower',
      players: this.ranking().map((r) => ({ ...r, perfects: stats.get(r.name).perfects, correct: stats.get(r.name).correct, wrong: stats.get(r.name).wrong })),
    };
  }
}

module.exports = TowerGame;
