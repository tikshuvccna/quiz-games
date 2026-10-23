// "זיכרון זוגות" - teams. One shared board of face-down cards on the big screen. A correct answer lets you flip two
// cards from your phone; a pair goes to your team (and you may flip again). Everybody watches the big screen, so
// remembering what others flipped is the whole game. A cleared board deals a new one.
const QuizGame = require('./base');
const { winnerOf } = require('../util');

const DECK = 18; // art the client can draw (see public/js/games/pairs.js FACES)
const PAIRS = 12;
const FLIP_MS = 12000;
const SHOW_MS = 1700;
const MAX_CHAIN = 3;

class PairsGame extends QuizGame {
  static id = 'pairs';
  static order = 19;
  static title = 'זיכרון זוגות';
  static emoji = '🃏';
  static mode = 'teams';
  static teamCounts = [2, 3, 4];
  static reward = ['הפיכה', 'הפיכות'];
  static blurb = 'לוח קלפים הפוכים אחד לכל הקבוצות. תשובה נכונה = הופכים שני קלפים מהטלפון. מצאתם זוג? הוא של הקבוצה שלכם, ומקבלים הפיכה נוספת! כל הכיתה רואה את הלוח, אז תזכרו מה האחרים הפכו.';
  static tickMs = 1000;
  static defaults = { duration: 300 };
  static options = [];

  start() {
    this.teams = this.room.teams();
    this.pairs = this.teams.map(() => 0);
    this.boards = 0;
    this.ev = [];
    this.eid = 1;
    this.deal();
    for (const p of this.players()) this.initPlayer(p, { found: 0, flips: [], chain: 0, res: null, timer: null });
  }

  stop() {
    super.stop();
    for (const p of this.players()) if (p.g) clearTimeout(p.g.timer);
  }

  deal() {
    const faces = [...Array(DECK).keys()].sort(() => Math.random() - 0.5).slice(0, PAIRS);
    this.cards = [...faces, ...faces].sort(() => Math.random() - 0.5).map((k) => ({ k, s: 'hidden', by: null, team: -1 }));
    this.board = (this.board || 0) + 1;
  }

  event(e) {
    this.ev.push({ id: this.eid++, ...e });
    if (this.ev.length > 14) this.ev.shift();
  }

  score(p) {
    return p.g ? p.g.found : 0;
  }

  onAnswer(p, correct, rewarded) {
    return rewarded ? { note: '🃏 הפכו שני קלפים!' } : {};
  }

  afterFeedback(p) {
    const g = p.g;
    if (!g.last || !g.last.correct) return this.nextQuestion(p);
    this.beginFlip(p);
  }

  beginFlip(p) {
    const g = p.g;
    g.flips = [];
    g.res = null;
    g.phase = 'flip';
    g.timer = this.later(() => this.autoFlip(p), FLIP_MS);
  }

  // time is up: flip random cards for the player so the turn doesn't hang
  autoFlip(p) {
    const g = p.g;
    if (g.phase !== 'flip') return;
    while (g.phase === 'flip') {
      const free = this.cards.map((c, i) => [c, i]).filter(([c]) => c.s === 'hidden').map(([, i]) => i);
      if (!free.length) return this.resolve(p);
      this.flip(p, free[Math.floor(Math.random() * free.length)]);
    }
  }

  action(p, type, data) {
    if (type === 'flip' && p.g.phase === 'flip') this.flip(p, data.card);
  }

  flip(p, i) {
    const g = p.g;
    if (this.over || g.phase !== 'flip' || !Number.isInteger(i) || !this.cards[i] || this.cards[i].s !== 'hidden') return;
    const c = this.cards[i];
    c.s = 'peek';
    c.by = p.id;
    g.flips.push(i);
    this.event({ kind: 'peek', card: i, name: p.name, team: p.team });
    if (g.flips.length >= 2 || !this.cards.some((x) => x.s === 'hidden')) return this.resolve(p);
    this.room.pushPlayer(p);
    this.room.scheduleHostPush();
  }

  resolve(p) {
    const g = p.g;
    clearTimeout(g.timer);
    const [a, b] = g.flips;
    const match = b !== undefined && this.cards[a].k === this.cards[b].k;
    if (match) {
      for (const i of [a, b]) Object.assign(this.cards[i], { s: 'gone', team: p.team, by: null });
      this.pairs[p.team]++;
      g.found++;
      this.event({ kind: 'match', cards: [a, b], name: p.name, team: p.team });
      if (g.chain + 1 >= 2) this.addFeed(`🔥 ${p.name} מצא/ה ${g.chain + 1} זוגות ברצף!`, p.team);
    } else {
      this.event({ kind: 'miss', cards: g.flips.slice(), name: p.name, team: p.team });
    }
    g.res = { match, cards: g.flips.slice(), faces: g.flips.map((i) => this.cards[i].k) };
    g.phase = 'flipped';
    this.room.pushPlayer(p);
    this.room.scheduleHostPush();
    this.later(() => {
      if (!match) for (const i of g.flips) if (this.cards[i].s === 'peek' && this.cards[i].by === p.id) Object.assign(this.cards[i], { s: 'hidden', by: null });
      if (this.cards.every((c) => c.s === 'gone')) {
        this.boards++;
        this.addFeed('🃏 הלוח נוקה! מחלקים קלפים חדשים');
        this.deal();
        this.event({ kind: 'deal' });
      }
      this.room.scheduleHostPush();
      if (g.phase !== 'flipped') return;
      // a pair earns another flip (a few in a row at most)
      if (match && g.chain + 1 < MAX_CHAIN && this.cards.some((c) => c.s === 'hidden')) {
        g.chain++;
        this.beginFlip(p);
      } else {
        g.chain = 0;
        this.turnDone(p);
      }
      this.room.pushPlayer(p);
    }, SHOW_MS);
  }

  // what everyone may see: faces only of flipped or taken cards
  view() {
    return this.cards.map((c) => {
      const o = { s: c.s, team: c.team };
      if (c.s !== 'hidden') o.k = c.k;
      if (c.s === 'peek') {
        const who = this.room.players.get(c.by);
        o.by = who ? who.name : '';
        o.bt = who ? who.team : -1;
      }
      return o;
    });
  }

  publicState() {
    return { kind: 'pairs', board: this.board, cards: this.view(), pairs: this.pairs, teams: this.teams, ev: this.ev, feed: this.feed, boards: this.boards };
  }

  personal(p) {
    const g = p.g;
    const out = { ...this.baseView(p), found: g.found, pairs: this.pairs };
    if (g.phase === 'flip' || g.phase === 'flipped') {
      out.cards = this.view();
      out.mine = g.flips;
      out.board = this.board;
      out.chain = g.chain;
    }
    if (g.phase === 'flipped') out.res = g.res;
    return out;
  }

  results() {
    const players = this.players()
      .filter((p) => p.g)
      .map((p) => ({ name: p.name, team: p.team, found: p.g.found, correct: p.g.correct }))
      .sort((x, y) => y.found - x.found || y.correct - x.correct);
    return { kind: 'pairs', pairs: this.pairs, winner: winnerOf(this.pairs), teams: this.teams, boards: this.boards, players };
  }
}

module.exports = PairsGame;
