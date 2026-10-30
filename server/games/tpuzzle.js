// "פאזל קבוצתי" - every team builds its own picture from 12 pieces. A correct answer gives a player a piece and a few
// seconds to find where it goes on the picture; a right tap places it for the whole team. The first team to finish wins.
const QuizGame = require('./base');
const { winnerOf } = require('../util');

const COLS = 4;
const ROWS = 3;
const TOTAL = COLS * ROWS;
const PLACE_MS = 7000;

class TeamPuzzleGame extends QuizGame {
  static id = 'tpuzzle';
  static order = 24;
  static title = 'פאזל קבוצתי';
  static emoji = '🧩';
  static mode = 'teams';
  static teamCounts = [2, 3, 4, 5, 6];
  static reward = ['חלק', 'חלקים'];
  static blurb = 'כל קבוצה בונה תמונה משלה מ־12 חלקים. תשובה נכונה נותנת חלק וכמה שניות למצוא את המקום שלו בתמונה. הקבוצה הראשונה שמשלימה את התמונה מנצחת!';
  static tickMs = 1000;
  static defaults = { duration: 360 };
  static options = [];

  start() {
    this.teams = this.room.teams();
    this.placed = this.teams.map(() => new Set());
    this.winner = -1;
    for (const p of this.players()) this.initPlayer(p, { given: 0, put: 0, miss: 0, piece: -1, timer: null, res: null });
  }

  score(p) {
    return p.g ? p.g.put : 0;
  }

  onAnswer(p, correct, rewarded) {
    return rewarded ? { note: '🧩 קיבלתם חלק!' } : {};
  }

  missing(team) {
    const out = [];
    for (let i = 0; i < TOTAL; i++) if (!this.placed[team].has(i)) out.push(i);
    return out;
  }

  afterFeedback(p) {
    const g = p.g;
    const miss = this.missing(p.team);
    if (!miss.length || this.winner >= 0) return this.nextQuestion(p);
    g.piece = miss[Math.floor(Math.random() * miss.length)];
    g.given++;
    g.phase = 'pz';
    g.res = null;
    clearTimeout(g.timer);
    g.timer = this.later(() => {
      if (p.g.phase === 'pz') this.settle(p, false, 'late');
    }, PLACE_MS + 1200);
  }

  action(p, type, data) {
    const g = p.g;
    if (type !== 'place' || g.phase !== 'pz') return;
    const slot = data.slot;
    if (!Number.isInteger(slot) || slot < 0 || slot >= TOTAL) return;
    this.settle(p, slot === g.piece, slot === g.piece ? 'ok' : 'wrong');
  }

  settle(p, ok, why) {
    const g = p.g;
    if (g.phase !== 'pz') return;
    clearTimeout(g.timer);
    let note = '';
    if (ok && !this.placed[p.team].has(g.piece)) {
      this.placed[p.team].add(g.piece);
      g.put++;
      note = 'placed';
      this.addFeed(`🧩 ${p.name} הניח/ה חלק! (${this.placed[p.team].size}/${TOTAL})`, p.team);
      if (this.placed[p.team].size >= TOTAL && this.winner < 0) {
        this.winner = p.team;
        this.addFeed(`🎉 ${this.teams[p.team].name} השלימו את התמונה!`, p.team);
        this.later(() => this.room.end(), 2500);
      }
    } else if (ok) note = 'dup'; // a teammate already placed it
    else {
      g.miss++;
      note = why === 'late' ? 'late' : 'wrong';
    }
    g.res = { note };
    g.phase = 'pzdone';
    this.room.pushPlayer(p);
    this.room.scheduleHostPush();
    for (const o of this.players()) if (o !== p && o.g && o.g.phase === 'pz' && o.team === p.team) this.room.pushPlayer(o);
    this.later(() => {
      if (g.phase !== 'pzdone') return;
      this.turnDone(p);
      this.room.pushPlayer(p);
    }, 1200);
  }

  scores() {
    return this.placed.map((s) => s.size);
  }

  publicState() {
    return { kind: 'tpuzzle', cols: COLS, rows: ROWS, teams: this.teams, placed: this.placed.map((s) => [...s]), counts: this.scores(), feed: this.feed, winner: this.winner };
  }

  personal(p) {
    const g = p.g;
    const out = { ...this.baseView(p), placed: [...this.placed[p.team]], cols: COLS, rows: ROWS };
    if (g.phase === 'pz') {
      out.piece = g.piece;
      out.ms = PLACE_MS;
    }
    if (g.phase === 'pzdone') out.res = g.res;
    return out;
  }

  results() {
    const scores = this.scores();
    const w = this.winner >= 0 ? this.winner : winnerOf(scores);
    const players = this.players()
      .filter((p) => p.g)
      .map((p) => ({ name: p.name, team: p.team, put: p.g.put, given: p.g.given, miss: p.g.miss, correct: p.g.correct, wrong: p.g.wrong }))
      .sort((a, b) => b.put - a.put || b.correct - a.correct);
    return { kind: 'tpuzzle', scores, winner: w, teams: this.teams, players, board: this.publicState() };
  }
}

module.exports = TeamPuzzleGame;
