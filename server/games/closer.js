// "סוגרי שטחים" - free for all, Qix / Paper.io style. Correct answers give steps; walk out of your
// land, draw a loop and return home to claim everything inside. Step on another trail to cut them.
const QuizGame = require('./base');

const PALETTE = ['#e63946', '#1d7fe0', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#fd79a8', '#7d7bff', '#00b8d4', '#b71c1c', '#8bc34a', '#ff8a65', '#5d4037', '#26a69a', '#c0ca33'];
const DIRS = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
const MAX_STEPS = 30;

class CloserGame extends QuizGame {
  static id = 'closer';
  static order = 9;
  static title = 'סוגרי שטחים';
  static emoji = '🟩';
  static mode = 'ffa';
  static reward = ['צעדים', 'מנות צעדים'];
  static stacks = true;
  static blurb = 'כל אחד לעצמו. תשובה נכונה נותנת צעדים: צאו מהשטח שלכם, צרו לולאה וחזרו הביתה כדי לכבוש את כל מה שבפנים. אבל מי שדורך על הזנב שלכם חותך אתכם!';
  static tickMs = 1000;
  static defaults = { duration: 300 };
  static options = [];

  start() {
    this.list = this.players();
    const n = this.list.length;
    this.cols = Math.min(40, 20 + 2 * Math.ceil(n / 3));
    this.rows = Math.round(this.cols * 0.6);
    const size = this.cols * this.rows;
    this.owner = new Array(size).fill(-1);
    this.trail = new Array(size).fill(-1);
    this.ev = [];
    this.eid = 1;
    this.list.forEach((p, i) => {
      p.ci = i;
      this.initPlayer(p, { steps: 0, pos: 0, home: 0, trailTiles: [], captured: 0, cuts: 0, alert: null });
      this.spawn(p, 3);
    });
  }

  // a late joiner gets a color and a fresh block of land like everyone else
  lateInit(p) {
    p.ci = this.list.length;
    this.list.push(p);
    this.initPlayer(p, { steps: 0, pos: 0, home: 0, trailTiles: [], captured: 0, cuts: 0, alert: null });
    this.spawn(p, 3);
    return true;
  }

  // give a player a fresh block of land at a random free spot
  spawn(p, s) {
    const { cols, rows } = this;
    let best = null;
    for (let tries = 0; tries < 300; tries++) {
      const x = 1 + Math.floor(Math.random() * (cols - s - 1));
      const y = 1 + Math.floor(Math.random() * (rows - s - 1));
      let free = true;
      for (let dy = -1; dy <= s && free; dy++) for (let dx = -1; dx <= s && free; dx++) {
        const t = (y + dy) * cols + x + dx;
        if (x + dx < 0 || y + dy < 0 || x + dx >= cols || y + dy >= rows) continue;
        if (this.owner[t] !== -1) free = false;
      }
      if (free) { best = [x, y]; break; }
    }
    if (!best) best = [1 + Math.floor(Math.random() * (cols - 2)), 1 + Math.floor(Math.random() * (rows - 2))];
    const [x, y] = best;
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) this.owner[(y + dy) * cols + x + dx] = p.ci;
    p.g.home = (y + Math.floor(s / 2)) * cols + x + Math.floor(s / 2);
    p.g.pos = p.g.home;
  }

  tilesOf(ci) {
    let n = 0;
    for (const o of this.owner) if (o === ci) n++;
    return n;
  }

  // wipe a player's open trail and send them home
  cut(p, text) {
    const g = p.g;
    for (const t of g.trailTiles) if (this.trail[t] === p.ci) this.trail[t] = -1;
    g.trailTiles = [];
    if (this.owner[g.home] !== p.ci) {
      const t = this.owner.indexOf(p.ci);
      if (t >= 0) g.home = t;
    }
    g.pos = g.home;
    if (text) g.alert = { text, until: Date.now() + 4000 };
  }

  checkAlive() {
    const counts = new Array(this.list.length).fill(0);
    for (const o of this.owner) if (o >= 0) counts[o]++;
    this.list.forEach((p) => {
      if (counts[p.ci] === 0) {
        this.cut(p);
        this.spawn(p, 2);
        p.g.alert = { text: 'השטח שלכם נכבש! קיבלתם נקודת התחלה חדשה', until: Date.now() + 4000 };
        if (p.g.phase === 'move') this.nextQuestion(p);
        this.room.pushPlayer(p);
      }
    });
    return counts;
  }

  score(p) {
    let n = 0;
    if (p.g) for (const o of this.owner) if (o === p.ci) n++;
    return n;
  }

  onAnswer(p, correct, rewarded) {
    if (!rewarded) return {};
    const g = p.g;
    const add = (8 + 2 * Math.min(g.streak, 5)) * this.amount;
    g.steps = Math.min(MAX_STEPS, g.steps + add);
    return { note: `👣 +${add} צעדים` };
  }

  afterFeedback(p) {
    const g = p.g;
    if (g.last && g.last.correct && g.steps > 0) g.phase = 'move';
    else this.nextQuestion(p);
  }

  action(p, type, data) {
    const g = p.g;
    if (g.phase !== 'move') return;
    if (type === 'done') {
      // back to the questions; an unfinished loop is given up (its trail is wiped)
      if (g.trailTiles.length) {
        this.cut(p, 'ויתרתם על הלולאה וחזרתם הביתה');
        this.room.scheduleHostPush();
      }
      this.nextQuestion(p);
      this.room.pushPlayer(p);
    } else if (type === 'move' && typeof data.dir === 'string' && Object.prototype.hasOwnProperty.call(DIRS, data.dir) && g.steps > 0) {
      this.move(p, DIRS[data.dir]);
    }
  }

  move(p, [dx, dy]) {
    const g = p.g;
    const { cols, rows } = this;
    const x = (g.pos % cols) + dx;
    const y = Math.floor(g.pos / cols) + dy;
    if (x < 0 || y < 0 || x >= cols || y >= rows) return;
    const t = y * cols + x;
    if (this.trail[t] === p.ci) return; // can't cross your own trail
    g.steps--;
    const hit = this.trail[t];
    if (hit >= 0) {
      const victim = this.list[hit];
      this.cut(victim, `${p.name} חתך/ה אתכם!`);
      victim.g.steps = Math.max(0, victim.g.steps - 5);
      if (victim.g.phase === 'move') this.nextQuestion(victim);
      this.room.pushPlayer(victim);
      g.cuts++;
      this.event({ k: 'cut', i: victim.ci, by: p.ci, t });
      g.steps = Math.min(MAX_STEPS, g.steps + 3);
      this.addFeed(`✂️ ${p.name} חתך/ה את ${victim.name}!`);
    }
    g.pos = t;
    if (this.owner[t] === p.ci) {
      if (g.trailTiles.length) this.close(p);
    } else {
      this.trail[t] = p.ci;
      g.trailTiles.push(t);
    }
    if (g.phase === 'move' && g.steps <= 0) {
      if (g.trailTiles.length) this.cut(p, 'נגמרו הצעדים! חזרתם הביתה בלי לסגור לולאה');
      this.nextQuestion(p);
    } else if (g.phase === 'move' && g.trailTiles.length && !this.canMove(p)) {
      // boxed in by your own trail: give up the loop instead of getting stuck
      this.cut(p, 'נתקעתם בתוך הזנב שלכם! חזרתם הביתה');
    }
    this.room.pushPlayer(p);
    this.room.scheduleHostPush();
  }

  canMove(p) {
    const { cols, rows } = this;
    const x0 = p.g.pos % cols;
    const y0 = Math.floor(p.g.pos / cols);
    return Object.values(DIRS).some(([dx, dy]) => {
      const x = x0 + dx;
      const y = y0 + dy;
      return x >= 0 && y >= 0 && x < cols && y < rows && this.trail[y * cols + x] !== p.ci;
    });
  }

  event(e) {
    this.ev.push({ id: this.eid++, ...e });
    if (this.ev.length > 12) this.ev.shift();
  }

  // trail reached home: claim the trail and every tile it encloses
  close(p) {
    const g = p.g;
    const { cols, rows, owner, trail } = this;
    const ci = p.ci;
    const before = this.tilesOf(ci);
    for (const t of g.trailTiles) {
      owner[t] = ci;
      trail[t] = -1;
    }
    g.trailTiles = [];
    const size = cols * rows;
    const seen = new Uint8Array(size);
    const stack = [];
    const push = (t) => {
      if (!seen[t] && owner[t] !== ci) {
        seen[t] = 1;
        stack.push(t);
      }
    };
    for (let x = 0; x < cols; x++) { push(x); push((rows - 1) * cols + x); }
    for (let y = 0; y < rows; y++) { push(y * cols); push(y * cols + cols - 1); }
    while (stack.length) {
      const t = stack.pop();
      const tx = t % cols;
      const ty = Math.floor(t / cols);
      if (tx > 0) push(t - 1);
      if (tx < cols - 1) push(t + 1);
      if (ty > 0) push(t - cols);
      if (ty < rows - 1) push(t + cols);
    }
    for (let t = 0; t < size; t++) {
      if (owner[t] === ci || seen[t]) continue;
      if (trail[t] >= 0 && trail[t] !== ci) {
        const victim = this.list[trail[t]];
        this.cut(victim, `${p.name} סגר/ה עליכם!`);
        if (victim.g.phase === 'move') this.nextQuestion(victim);
        this.room.pushPlayer(victim);
      }
      owner[t] = ci;
    }
    const gained = this.tilesOf(ci) - before;
    g.captured += gained;
    if (gained > 0) this.event({ k: 'cap', i: ci, n: gained, t: g.pos });
    g.pos = Math.min(g.pos, size - 1);
    if (gained >= 12) this.addFeed(`🟩 ${p.name} כבש/ה ${gained} משבצות!`);
    this.checkAlive();
  }

  publicState() {
    const counts = new Array(this.list.length).fill(0);
    for (const o of this.owner) if (o >= 0) counts[o]++;
    const total = this.cols * this.rows;
    const players = this.list
      .map((p) => ({ i: p.ci, name: p.name, color: PALETTE[p.ci % PALETTE.length], tiles: counts[p.ci], pct: Math.round((counts[p.ci] / total) * 100), pos: p.g.pos }))
      .sort((a, b) => b.tiles - a.tiles);
    return { kind: 'closer', cols: this.cols, rows: this.rows, owner: this.owner, trail: this.trail, players, ev: this.ev, feed: this.feed };
  }

  personal(p) {
    const g = p.g;
    return {
      ...this.baseView(p),
      ci: p.ci,
      color: PALETTE[p.ci % PALETTE.length],
      steps: g.steps,
      pos: g.pos,
      open: g.trailTiles.length > 0,
      alert: g.alert && g.alert.until > Date.now() ? g.alert.text : null,
    };
  }

  results() {
    const pub = this.publicState();
    const stats = new Map(this.list.map((p) => [p.name, p.g]));
    return {
      kind: 'closer',
      players: pub.players.map((r) => ({ ...r, captured: stats.get(r.name).captured, cuts: stats.get(r.name).cuts, correct: stats.get(r.name).correct })),
      board: pub,
    };
  }
}

module.exports = CloserGame;
