// "כובשי הממלכה" - team vs team. Correct answers earn flags; a flag captures, attacks or fortifies a tile.
const QuizGame = require('./base');
const { shuffle } = require('../shuffle');
const { winnerOf } = require('../util');
const MAX_LEVEL = 3;

class TerritoryGame extends QuizGame {
  static id = 'territory';
  static order = 3;
  static title = 'כובשי הממלכה';
  static emoji = '🏰';
  static mode = 'teams';
  static blurb = 'קבוצות נלחמות על המפה. כל תשובה נכונה היא דגל: כבשו שטח, חזקו אריחים או תקפו את האויב.';
  static teamCounts = [2, 3, 4];
  static reward = ['דגל', 'דגלים'];
  static stacks = true;
  static tickMs = 1000;
  static defaults = { duration: 300 };
  static options = [];

  start() {
    this.teams = this.room.teams();
    const T = this.teams.length;
    const n = Math.max(this.room.players.size, 2) + (T - 2) * 3;
    const total = Math.min(150, Math.max(40, n * 5));
    this.rows = Math.max(5, Math.round(Math.sqrt(total / 1.5)));
    this.cols = Math.max(8, Math.round(total / this.rows));
    const size = this.rows * this.cols;
    this.cells = new Array(size).fill(-1);
    this.lvl = new Array(size).fill(0);

    // start bases: left, right, top, bottom edges
    const mid = Math.floor(this.rows / 2);
    const cm = Math.floor(this.cols / 2);
    const C = this.cols;
    const R = this.rows;
    const starts = [
      [mid * C, (mid - 1) * C, (mid + 1) * C],
      [mid * C + C - 1, (mid - 1) * C + C - 1, (mid + 1) * C + C - 1],
      [cm - 1, cm, cm + 1],
      [(R - 1) * C + cm - 1, (R - 1) * C + cm, (R - 1) * C + cm + 1],
    ].slice(0, T);
    starts.forEach((tiles, team) => tiles.forEach((t) => { this.cells[t] = team; this.lvl[t] = 2; }));

    const free = [];
    for (let i = 0; i < size; i++) {
      const c = i % C;
      const r = Math.floor(i / C);
      if (this.cells[i] === -1 && c > 1 && c < C - 2 && (T < 3 || (r > 1 && r < R - 2))) free.push(i);
    }
    this.castles = shuffle(free).slice(0, Math.max(3, Math.round(size / 14)));
    this.castleSet = new Set(this.castles);
    this.recount();

    for (const p of this.players()) this.initPlayer(p, { flags: 0, placed: 0, captured: 0 });
  }

  recount() {
    const tiles = this.teams.map(() => 0);
    const castles = this.teams.map(() => 0);
    this.cells.forEach((t, i) => {
      if (t < 0) return;
      tiles[t]++;
      if (this.castleSet.has(i)) castles[t]++;
    });
    this.tiles = tiles;
    this.castleCount = castles;
    this.scores = tiles.map((t, i) => t + castles[i] * 2);
  }

  onAnswer(p, correct, rewarded) {
    const g = p.g;
    if (!rewarded) return {};
    const bonus = g.streak % 3 === 0;
    const gained = this.amount + (bonus ? 1 : 0);
    g.flags += gained;
    return { note: `🚩 +${gained} ${gained > 1 ? 'דגלים' : 'דגל'}${bonus ? ' · בונוס רצף! 🔥' : ''}` };
  }

  score(p) {
    return p.g ? p.g.captured : 0;
  }

  afterFeedback(p) {
    if (p.g.flags > 0 && this.hasMove(p.team)) p.g.phase = 'place';
    else this.nextQuestion(p); // banked flags are kept for later
  }

  hasMove(team) {
    for (let i = 0; i < this.cells.length; i++) if (this.tileAction(team, i)) return true;
    return false;
  }

  neighbors(t) {
    const r = Math.floor(t / this.cols);
    const c = t % this.cols;
    const out = [];
    if (r > 0) out.push(t - this.cols);
    if (r < this.rows - 1) out.push(t + this.cols);
    if (c > 0) out.push(t - 1);
    if (c < this.cols - 1) out.push(t + 1);
    return out;
  }

  // 'f' fortify own tile, 'a' attack enemy tile, 'c' capture neutral tile, null = not allowed
  tileAction(team, t) {
    if (!Number.isInteger(t) || t < 0 || t >= this.cells.length) return null;
    const owner = this.cells[t];
    if (owner === team) return this.lvl[t] < MAX_LEVEL ? 'f' : null;
    if (this.tiles[team] > 0 && !this.neighbors(t).some((n) => this.cells[n] === team)) return null;
    return owner < 0 ? 'c' : 'a';
  }

  action(p, type, data) {
    const g = p.g;
    if (g.phase !== 'place') return;
    if (type === 'skip') {
      // nothing useful left to do (or the player prefers to bank the flags): back to questions
      this.nextQuestion(p);
      return this.room.pushPlayer(p);
    }
    if (type !== 'place') return;
    const t = data.tile;
    const kind = this.tileAction(p.team, t);
    if (!kind) return;
    const isCastle = this.castleSet.has(t);
    let captured = false;
    if (kind === 'f') {
      this.lvl[t]++;
    } else if (kind === 'a' && --this.lvl[t] > 0) {
      // enemy tile damaged, not yet captured
    } else {
      captured = true;
      this.cells[t] = p.team;
      this.lvl[t] = 1;
      g.captured++;
      if (isCastle) {
        g.flags++; // castles give a bonus flag
        this.addFeed(`🏰 ${p.name} כבש/ה טירה!`, p.team);
      }
    }
    g.flags--;
    g.placed++;
    this.recount();
    if (g.flags <= 0 || !this.hasMove(p.team)) this.nextQuestion(p);
    this.room.pushPlayer(p);
    this.room.scheduleHostPush();
    // everyone else who is choosing a tile gets fresh valid moves
    for (const o of this.players()) if (o !== p && o.g && o.g.phase === 'place') this.room.pushPlayer(o);
  }

  publicState() {
    return {
      kind: 'territory',
      cols: this.cols,
      rows: this.rows,
      cells: this.cells,
      lvl: this.lvl,
      castles: this.castles,
      scores: this.scores,
      tiles: this.tiles,
      castleCount: this.castleCount,
      teams: this.teams,
      feed: this.feed,
    };
  }

  personal(p) {
    const g = p.g;
    const out = { ...this.baseView(p), flags: g.flags };
    if (g.phase === 'place') {
      out.valid = [];
      for (let i = 0; i < this.cells.length; i++) {
        const k = this.tileAction(p.team, i);
        if (k) out.valid.push([i, k]);
      }
    }
    return out;
  }

  results() {
    const players = this.players()
      .filter((p) => p.g)
      .map((p) => ({ name: p.name, team: p.team, correct: p.g.correct, wrong: p.g.wrong, placed: p.g.placed, captured: p.g.captured }))
      .sort((x, y) => y.captured - x.captured || y.placed - x.placed);
    return { kind: 'territory', scores: this.scores, winner: winnerOf(this.scores), teams: this.teams, players, board: this.publicState() };
  }
}

module.exports = TerritoryGame;
