// "קארט מאחור" - free for all pseudo-3D kart race. A correct answer earns driving time: the phone shows a road
// seen from behind your kart (steer, dodge, grab boost pads) and reports how far it got. Rank = distance.
// Everyone drives the same endless track (same seed). The phone's distance is capped by the top speed.
const QuizGame = require('./base');

const BASE_SECS = 6;
const V_MAX = 1150; // units per second at full boost: the most a phone may report per second of driving

class KartGame extends QuizGame {
  static id = 'kart';
  static order = 16;
  static title = 'קארט מאחור';
  static emoji = '🏁';
  static mode = 'ffa';
  static reward = ['סיבוב', 'סיבובים'];
  static stacks = true;
  static blurb = 'כל אחד לעצמו. כל תשובה נכונה היא זמן נהיגה: מסלול תלת־ממדי מאחורי הקארט, מתחמקים ממכשולים ותופסים מאיצים. ככל שעונים נכון יותר, נוסעים יותר ורחוק יותר!';
  static tickMs = 1000;
  static defaults = { duration: 240 };
  static options = [];

  start() {
    this.seed = 1 + Math.floor(Math.random() * 1e6);
    for (const p of this.players()) this.initPlayer(p, { dist: 0, drives: 0, top: 0, res: null, secs: 0, timer: null });
  }

  score(p) {
    return p.g ? Math.round(p.g.dist / 10) : 0;
  }

  onAnswer(p, correct, rewarded) {
    return rewarded ? { note: '🏁 לנסוע!' } : {};
  }

  afterFeedback(p) {
    const g = p.g;
    g.secs = BASE_SECS * this.amount + Math.min(6, g.streak);
    g.phase = 'drive';
    clearTimeout(g.timer);
    g.timer = this.later(() => {
      if (p.g.phase === 'drive') this.finishDrive(p, 0, 0);
    }, g.secs * 1000 + 6000);
  }

  action(p, type, data) {
    if (type !== 'drive' || p.g.phase !== 'drive') return;
    const d = Number(data.dist);
    if (!Number.isFinite(d) || d < 0) return;
    const top = Number(data.top);
    this.finishDrive(p, Math.min(d, p.g.secs * V_MAX), Number.isFinite(top) ? Math.min(top, V_MAX) : 0);
  }

  finishDrive(p, dist, top) {
    const g = p.g;
    if (g.phase !== 'drive') return;
    clearTimeout(g.timer);
    g.dist += dist;
    g.drives++;
    g.top = Math.max(g.top, top);
    g.res = { dist: Math.round(dist / 10), total: Math.round(g.dist / 10) };
    g.phase = 'drove';
    this.room.pushPlayer(p);
    this.room.scheduleHostPush();
    this.later(() => {
      if (g.phase !== 'drove') return;
      this.turnDone(p);
      this.room.pushPlayer(p);
    }, 1500);
  }

  ranking() {
    return this.players()
      .filter((p) => p.g)
      .map((p) => ({ name: p.name, dist: Math.round(p.g.dist / 10), drives: p.g.drives, top: Math.round(p.g.top / 10), driving: p.g.phase === 'drive' }))
      .sort((a, b) => b.dist - a.dist);
  }

  publicState() {
    const r = this.ranking();
    return { kind: 'kart', players: r.slice(0, 16), total: r.length, feed: this.feed };
  }

  personal(p) {
    const g = p.g;
    const out = { ...this.baseView(p), dist: Math.round(g.dist / 10), rank: 1 + this.players().filter((o) => o.g && o.g.dist > g.dist).length };
    if (g.phase === 'drive') out.drive = { secs: g.secs, start: g.dist, seed: this.seed, vmax: V_MAX };
    if (g.phase === 'drove') out.res = g.res;
    return out;
  }

  results() {
    return { kind: 'kart', players: this.ranking() };
  }
}

module.exports = KartGame;
