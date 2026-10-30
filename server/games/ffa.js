// Shared base of the "answer, then play a short round on your phone" free-for-all games (mole, hoops, snake, burger, ship).
// A correct answer earns a round. The subclass makes the round (what the phone shows, and a secret the server keeps),
// and grades what the phone reports. Everything the phone sends is validated by the subclass.
//
//   static kind          the id the client uses to pick the round's screen
//   makeRound(g)         -> { pub, secret, ms }   pub goes to the phone, secret stays here, ms is the round length
//   grade(g, data, rd)   -> { pts, hits, total, title, sub }   data is whatever the phone sent (already an object)
const QuizGame = require('./base');

class FfaAction extends QuizGame {
  static mode = 'ffa';
  static tickMs = 1000;
  static defaults = { duration: 240 };
  static options = [];

  start() {
    for (const p of this.players()) this.initPlayer(p, { pts: 0, rounds: 0, hits: 0, total: 0, best: 0, round: null, secret: null, res: null, timer: null });
  }

  score(p) {
    return p.g ? p.g.pts : 0;
  }

  onAnswer(p, correct) {
    if (!correct) return {};
    const add = 5 + Math.min(p.g.streak, 5);
    p.g.pts += add;
    return { note: `⭐ +${add}` };
  }

  afterFeedback(p) {
    const g = p.g;
    const r = this.makeRound(g);
    g.round = { kind: this.constructor.kind, ms: r.ms, ...r.pub };
    g.secret = r.secret;
    g.phase = 'ffa';
    clearTimeout(g.timer);
    // a phone that never answers does not stall the game
    g.timer = this.later(() => {
      if (p.g.phase === 'ffa') this.finish(p, {});
    }, r.ms + 6000);
  }

  action(p, type, data) {
    if (type === 'play' && p.g.phase === 'ffa') this.finish(p, data);
  }

  finish(p, data) {
    const g = p.g;
    if (g.phase !== 'ffa') return;
    clearTimeout(g.timer);
    let res;
    try {
      res = this.grade(g, data && typeof data === 'object' ? data : {}, g.secret);
    } catch (e) {
      res = { pts: 0, hits: 0, total: 0, title: '😅', sub: '' };
    }
    const pts = Math.max(0, Math.min(500, Math.round(res.pts) || 0));
    g.pts += pts;
    g.rounds++;
    g.hits += res.hits || 0;
    g.total += res.total || 0;
    g.best = Math.max(g.best, pts);
    g.res = { pts, title: res.title || '', sub: res.sub || '', full: !!res.full };
    if (res.full) this.addFeed(`🌟 ${p.name}: ${res.title || 'סיבוב מושלם'}!`, p.team);
    g.phase = 'ffa_done';
    this.room.pushPlayer(p);
    this.room.scheduleHostPush();
    this.later(() => {
      if (g.phase !== 'ffa_done') return;
      this.turnDone(p);
      this.room.pushPlayer(p);
    }, 1800);
  }

  ranking() {
    return this.players()
      .filter((p) => p.g)
      .map((p) => ({ name: p.name, pts: p.g.pts, rounds: p.g.rounds, acc: p.g.total ? Math.round((p.g.hits / p.g.total) * 100) : 0, best: p.g.best, playing: p.g.phase === 'ffa' }))
      .sort((a, b) => b.pts - a.pts);
  }

  publicState() {
    const r = this.ranking();
    return { kind: this.constructor.kind, players: r.slice(0, 16), total: r.length, feed: this.feed };
  }

  personal(p) {
    const g = p.g;
    const out = { ...this.baseView(p), pts: g.pts, rank: 1 + this.players().filter((o) => o.g && o.g.pts > g.pts).length };
    if (g.phase === 'ffa') out.round = g.round;
    if (g.phase === 'ffa_done') out.res = g.res;
    return out;
  }

  results() {
    return { kind: this.constructor.kind, players: this.ranking() };
  }
}

module.exports = FfaAction;
