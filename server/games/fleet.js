// "קרב ספינות" - 2 teams. Each team has a hidden fleet on an 8 x 8 sea. A correct answer is one shot at the enemy sea,
// picked on the phone; the whole team shares what was found. A hit earns another shot. Points for hits and for sinking
// ships; a destroyed fleet gives a big bonus and a fresh fleet sails in.
const QuizGame = require('./base');
const { winnerOf } = require('../util');

const N = 8;
const SHIPS = [4, 3, 3, 2, 2];
const AIM_MS = 12000;
const SHOW_MS = 1900;
const MAX_CHAIN = 2;
const PTS = { hit: 10, sink: 20, fleet: 50 };

function placeFleet() {
  for (let attempt = 0; attempt < 200; attempt++) {
    const occ = new Int8Array(N * N).fill(-1);
    const ships = [];
    let ok = true;
    for (const size of SHIPS) {
      let placed = false;
      for (let t = 0; t < 100 && !placed; t++) {
        const hor = Math.random() < 0.5;
        const x = Math.floor(Math.random() * (hor ? N - size + 1 : N));
        const y = Math.floor(Math.random() * (hor ? N : N - size + 1));
        const cells = Array.from({ length: size }, (_, k) => (y + (hor ? 0 : k)) * N + x + (hor ? k : 0));
        // ships never touch, not even at the corners
        const clear = cells.every((c) => {
          const cx = c % N;
          const cy = Math.floor(c / N);
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx >= 0 && ny >= 0 && nx < N && ny < N && occ[ny * N + nx] >= 0) return false;
          }
          return true;
        });
        if (!clear) continue;
        for (const c of cells) occ[c] = ships.length;
        ships.push({ cells, hor, size, hits: 0, sunk: false });
        placed = true;
      }
      if (!placed) { ok = false; break; }
    }
    if (ok) return { occ, ships, shots: new Int8Array(N * N) };
  }
  throw new Error('fleet placement failed');
}

class FleetGame extends QuizGame {
  static id = 'fleet';
  static order = 20;
  static title = 'קרב ספינות';
  static emoji = '🚢';
  static mode = 'teams';
  static teamCounts = [2];
  static reward = ['ירייה', 'יריות'];
  static blurb = 'שתי קבוצות, שני ציים מוסתרים. תשובה נכונה = ירייה: בוחרים משבצת בים של היריבים. פגעתם? מקבלים ירייה נוספת! מטביעים ספינות ומשמידים צי שלם בשביל בונוס ענק.';
  static tickMs = 1000;
  static defaults = { duration: 300 };
  static options = [];

  start() {
    this.teams = this.room.teams();
    // seas[t] = the sea (and fleet) of team t, shot at by the other team
    this.seas = this.teams.map(() => placeFleet());
    this.points = this.teams.map(() => 0);
    this.fleets = this.teams.map(() => 0); // fleets destroyed by team t
    this.ev = [];
    this.eid = 1;
    for (const p of this.players()) this.initPlayer(p, { pts: 0, hits: 0, shots: 0, sunk: 0, chain: 0, aimV: 0, fired: null, timer: null });
  }

  stop() {
    super.stop();
    for (const p of this.players()) if (p.g) clearTimeout(p.g.timer);
  }

  enemy(p) {
    return this.seas[1 - p.team];
  }

  score(p) {
    return p.g ? p.g.pts : 0;
  }

  onAnswer(p, correct, rewarded) {
    return rewarded ? { note: '🎯 טענו את התותח!' } : {};
  }

  afterFeedback(p) {
    const g = p.g;
    if (!g.last || !g.last.correct) return this.nextQuestion(p);
    this.aim(p);
  }

  aim(p) {
    const g = p.g;
    g.phase = 'aim';
    g.fired = null;
    g.timer = this.later(() => {
      const sea = this.enemy(p);
      const free = [...sea.shots.keys()].filter((c) => !sea.shots[c]);
      if (free.length) this.fire(p, free[Math.floor(Math.random() * free.length)]);
    }, AIM_MS);
  }

  action(p, type, data) {
    if (type === 'fire' && p.g.phase === 'aim') this.fire(p, data.cell);
  }

  fire(p, cell) {
    const g = p.g;
    if (this.over || g.phase !== 'aim' || !Number.isInteger(cell) || cell < 0 || cell >= N * N) return;
    const t = p.team;
    const sea = this.enemy(p);
    if (sea.shots[cell] || sea.done) {
      // a teammate got there first: show the fresh sea and let the player pick again
      g.aimV++;
      return this.room.pushPlayer(p);
    }
    clearTimeout(g.timer);
    g.shots++;
    const si = sea.occ[cell];
    let res = 'miss';
    let gain = 0;
    let ship = null;
    if (si >= 0) {
      const s = sea.ships[si];
      s.hits++;
      sea.shots[cell] = 2;
      g.hits++;
      gain += PTS.hit;
      res = 'hit';
      if (s.hits === s.size) {
        s.sunk = true;
        for (const c of s.cells) sea.shots[c] = 3;
        gain += PTS.sink;
        g.sunk++;
        res = 'sunk';
        ship = { cells: s.cells, hor: s.hor, size: s.size };
        this.addFeed(`🚢 ${p.name} הטביע/ה ספינה של ${this.teams[1 - t].name}!`, t);
      }
    } else sea.shots[cell] = 1;
    let fleet = false;
    if (sea.ships.every((s) => s.sunk)) {
      fleet = true;
      sea.done = true;
      gain += PTS.fleet;
      this.fleets[t]++;
      this.addFeed(`💥 ${this.teams[t].name} השמידו צי שלם! +${PTS.fleet}`, t);
    }
    g.pts += gain;
    this.points[t] += gain;
    g.fired = { cell, res, gain, fleet, ship };
    g.phase = 'fired';
    this.ev.push({ id: this.eid++, team: t, target: 1 - t, name: p.name, cell, res, gain, fleet, ship });
    if (this.ev.length > 14) this.ev.shift();
    this.room.pushPlayer(p);
    this.room.scheduleHostPush();
    this.later(() => {
      // a destroyed fleet is replaced after everyone saw it go down
      if (fleet && this.seas[1 - t] === sea) {
        this.seas[1 - t] = placeFleet();
        this.ev.push({ id: this.eid++, kind: 'newfleet', target: 1 - t });
        this.room.scheduleHostPush();
        // whoever is aiming at that sea gets the new one
        for (const o of this.players()) {
          if (o !== p && o.g && o.g.phase === 'aim' && o.team === t) {
            o.g.aimV++;
            this.room.pushPlayer(o);
          }
        }
      }
      if (g.phase !== 'fired') return;
      if (res !== 'miss' && g.chain < MAX_CHAIN) {
        g.chain++;
        this.aim(p);
      } else {
        g.chain = 0;
        this.turnDone(p);
      }
      this.room.pushPlayer(p);
    }, SHOW_MS);
  }

  seaView(sea) {
    return { shots: Array.prototype.join.call(sea.shots, ''), sunk: sea.ships.filter((s) => s.sunk).map((s) => ({ cells: s.cells, hor: s.hor, size: s.size })), left: sea.ships.filter((s) => !s.sunk).map((s) => s.size) };
  }

  publicState() {
    return { kind: 'fleet', n: N, seas: this.seas.map((s) => this.seaView(s)), points: this.points, fleets: this.fleets, teams: this.teams, ev: this.ev, feed: this.feed };
  }

  personal(p) {
    const g = p.g;
    const out = { ...this.baseView(p), pts: g.pts, points: this.points, chain: g.chain, aimV: g.aimV };
    if (g.phase === 'aim' || g.phase === 'fired') {
      const v = this.seaView(this.enemy(p));
      out.sea = [...v.shots].map(Number);
      out.sunk = v.sunk;
      out.left = v.left;
      out.n = N;
      out.enemy = this.teams[1 - p.team];
    }
    if (g.phase === 'fired') out.fired = g.fired;
    return out;
  }

  results() {
    const players = this.players()
      .filter((p) => p.g)
      .map((p) => ({ name: p.name, team: p.team, pts: p.g.pts, hits: p.g.hits, sunk: p.g.sunk, shots: p.g.shots, correct: p.g.correct }))
      .sort((x, y) => y.pts - x.pts || y.hits - x.hits);
    return { kind: 'fleet', points: this.points, fleets: this.fleets, winner: winnerOf(this.points), teams: this.teams, players };
  }
}

module.exports = FleetGame;
