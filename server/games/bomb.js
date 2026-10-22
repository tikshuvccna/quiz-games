// "הפצצה המתקתקת" - free for all hot potato. Bombs with hidden fuses sit on random players. Holding one,
// a correct answer lets you throw it at someone else; when a fuse runs out, the holder loses points.
const QuizGame = require('./base');
const { shuffle } = require('../shuffle');

const PASS_MS = 7000;
const FUSE_MIN = 16000;
const FUSE_MAX = 30000;
const BOOM_LOSS = 30;

class BombGame extends QuizGame {
  static id = 'bomb';
  static order = 12;
  static title = 'הפצצה המתקתקת';
  static emoji = '💣';
  static mode = 'ffa';
  static noReward = true;
  static blurb = 'כל אחד לעצמו. פצצות עם פתיל סודי מסתובבות בכיתה. תשובה נכונה = נקודות, ואם הפצצה אצלכם, תשובה נכונה מאפשרת לזרוק אותה למישהו אחר. כשהפתיל נגמר, מי שמחזיק מפסיד נקודות!';
  static tickMs = 500;
  static defaults = { duration: 240 };
  static options = [];

  start() {
    this.bombs = [];
    this.bid = 1;
    this.ev = [];
    this.eid = 1;
    for (const p of this.players()) this.initPlayer(p, { pts: 0, booms: 0, passes: 0, pass: null, timer: null });
    const count = Math.max(1, Math.round(this.room.players.size / 5));
    const holders = shuffle(this.players()).slice(0, count);
    holders.forEach((p) => this.spawn(p));
  }

  event(e) {
    this.ev.push({ id: this.eid++, ...e });
    if (this.ev.length > 20) this.ev.shift();
  }

  spawn(p) {
    const fuse = FUSE_MIN + Math.random() * (FUSE_MAX - FUSE_MIN);
    const b = { id: this.bid++, holder: p.id, from: null, born: Date.now(), end: Date.now() + fuse, passes: 0 };
    this.bombs.push(b);
    this.event({ k: 'spawn', bomb: b.id, to: p.name });
    this.room.pushPlayer(p);
    return b;
  }

  held(p) {
    return this.bombs.filter((b) => b.holder === p.id);
  }

  // candidates to throw at: everyone else who is still connected (fall back to anyone else)
  targets(p, bomb) {
    let list = this.players().filter((o) => o.g && o.id !== p.id && o.connected);
    if (!list.length) list = this.players().filter((o) => o.g && o.id !== p.id);
    // no instant ping-pong back to whoever threw it, if there is any other choice
    if (bomb && bomb.from && list.length > 1) list = list.filter((o) => o.id !== bomb.from);
    return list;
  }

  tick() {
    if (this.over) return;
    const now = Date.now();
    for (const b of [...this.bombs]) {
      if (now >= b.end) this.explode(b);
    }
    // a bomb stuck on a disconnected phone gets passed on automatically
    for (const b of this.bombs) {
      const h = this.room.players.get(b.holder);
      if (h && !h.connected && now - (b.at || b.born) > 3000) {
        const t = this.targets(h, b);
        if (t.length) this.moveBomb(b, h, t[Math.floor(Math.random() * t.length)], true);
      }
    }
  }

  explode(b) {
    this.bombs = this.bombs.filter((x) => x !== b);
    const p = this.room.players.get(b.holder);
    if (p && p.g) {
      const loss = Math.min(p.g.pts, BOOM_LOSS);
      p.g.pts -= loss;
      p.g.booms++;
      this.event({ k: 'boom', bomb: b.id, to: p.name, loss });
      this.addFeed(`💥 בום! הפצצה התפוצצה אצל ${p.name}`);
      p.g.alert = { text: `💥 בום! -${loss} נקודות`, until: Date.now() + 3000 };
      if (p.g.phase === 'pass' && !this.held(p).length) {
        clearTimeout(p.g.timer);
        this.nextQuestion(p);
      }
      this.room.pushPlayer(p);
    }
    // a fresh bomb lands on someone else
    const others = this.players().filter((o) => o.g && o !== p && o.connected);
    const pool = others.length ? others : this.players().filter((o) => o.g);
    if (pool.length) this.spawn(pool[Math.floor(Math.random() * pool.length)]);
    this.room.scheduleHostPush();
  }

  moveBomb(b, from, to, auto) {
    b.holder = to.id;
    b.from = from.id;
    b.passes++;
    b.at = Date.now();
    this.event({ k: 'pass', bomb: b.id, from: from.name, to: to.name, auto: !!auto });
    to.g.alert = { text: `💣 ${from.name} זרק/ה עליכם פצצה!`, until: Date.now() + 3000 };
    this.room.pushPlayer(to);
    this.room.scheduleHostPush();
  }

  score(p) {
    return p.g ? p.g.pts : 0;
  }

  onAnswer(p, correct) {
    const g = p.g;
    if (!correct) return this.held(p).length ? { note: '💣 הפצצה עדיין אצלכם!' } : {};
    if (this.held(p).length) return { note: '💣 זרקו את הפצצה!' };
    const add = 10 + 2 * Math.min(g.streak, 5);
    g.pts += add;
    return { note: `⭐ +${add} נקודות` };
  }

  afterFeedback(p) {
    const g = p.g;
    const mine = this.held(p);
    if (!g.last || !g.last.correct || !mine.length || !this.targets(p, mine[0]).length) return this.nextQuestion(p);
    g.phase = 'pass';
    g.timer = this.later(() => {
      const b = this.held(p)[0];
      const t = b && this.targets(p, b);
      if (t && t.length) this.pass(p, t[Math.floor(Math.random() * t.length)].id);
      else if (p.g.phase === 'pass') { this.nextQuestion(p); this.room.pushPlayer(p); }
    }, PASS_MS + 1500);
  }

  action(p, type, data) {
    if (type === 'pass' && p.g.phase === 'pass' && typeof data.to === 'string') this.pass(p, data.to);
  }

  pass(p, toId) {
    const g = p.g;
    if (this.over || g.phase !== 'pass') return;
    const b = this.held(p)[0];
    if (!b) {
      this.nextQuestion(p);
      return this.room.pushPlayer(p);
    }
    const to = this.targets(p, b).find((o) => o.id === toId);
    if (!to) return;
    clearTimeout(g.timer);
    this.moveBomb(b, p, to, false);
    g.passes++;
    g.pts += 5;
    g.pass = { to: to.name };
    g.phase = 'passed';
    this.room.pushPlayer(p);
    this.later(() => {
      if (g.phase !== 'passed') return;
      this.nextQuestion(p);
      this.room.pushPlayer(p);
    }, 900);
  }

  ranking() {
    return this.players()
      .filter((p) => p.g)
      .map((p) => ({ name: p.name, pts: p.g.pts, booms: p.g.booms, holding: this.held(p).length }))
      .sort((a, b) => b.pts - a.pts);
  }

  publicState() {
    const now = Date.now();
    const r = this.ranking();
    // the circle shows the top 16, plus anyone holding a bomb right now
    const shown = r.slice(0, 16);
    for (const x of r.slice(16)) if (x.holding) shown.push(x);
    return {
      kind: 'bomb',
      players: shown,
      total: r.length,
      // the fuse is secret on phones; the big screen only sees how hot each bomb is
      bombs: this.bombs.map((b) => {
        const h = this.room.players.get(b.holder);
        return { id: b.id, holder: h ? h.name : '', heat: Math.min(1, (now - b.born) / (b.end - b.born)), passes: b.passes };
      }),
      ev: this.ev,
      feed: this.feed,
    };
  }

  personal(p) {
    const g = p.g;
    const out = { ...this.baseView(p), pts: g.pts, holding: this.held(p).length };
    out.rank = 1 + this.players().filter((o) => o.g && o.g.pts > g.pts).length;
    if (g.alert && g.alert.until > Date.now()) out.alert = g.alert.text;
    if (g.phase === 'pass') {
      const b = this.held(p)[0];
      out.targets = (b ? this.targets(p, b) : []).map((o) => ({ id: o.id, name: o.name, pts: o.g.pts }));
    }
    if (g.phase === 'passed') out.pass = g.pass;
    return out;
  }

  results() {
    const stats = new Map(this.players().map((p) => [p.name, p.g]));
    return { kind: 'bomb', players: this.ranking().map((r) => ({ ...r, passes: stats.get(r.name).passes, correct: stats.get(r.name).correct })) };
  }
}

module.exports = BombGame;
