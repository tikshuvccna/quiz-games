// "פנדלים" - team vs team. A correct answer earns a penalty kick: pick a spot in the goal and beat the keeper.
const QuizGame = require('./base');

const { winnerOf } = require('../util');
const KICK_MS = 6000;
// zones: 0 1 2 = top row (left, center, right), 3 4 5 = bottom row
const KEEPER_COL_WEIGHTS = [0.3, 0.4, 0.3]; // keepers like to stay central, so corners pay off
const POST_CHANCE = 0.15; // top corners are risky: sometimes the ball hits the post

function pickCol() {
  let r = Math.random();
  for (let i = 0; i < 3; i++) if ((r -= KEEPER_COL_WEIGHTS[i]) < 0) return i;
  return 1;
}

class PenaltyGame extends QuizGame {
  static id = 'penalty';
  static order = 5;
  static title = 'פנדלים';
  static emoji = '⚽';
  static mode = 'teams';
  static teamCounts = [2, 3, 4];
  static reward = ['בעיטה', 'בעיטות'];
  static blurb = 'קבוצות בדו־קרב פנדלים. תשובה נכונה = בעיטה: בחרו פינה בשער ונסו להפתיע את השוער. רצף של 3 = בעיטת עוצמה שקשה יותר לעצור.';
  static tickMs = 1000;
  static defaults = { duration: 240 };
  static options = [];

  start() {
    this.teams = this.room.teams();
    this.goals = this.teams.map(() => 0);
    this.shots = this.teams.map(() => 0);
    this.size = this.teams.map(() => 0);
    this.ev = [];
    this.eid = 1;
    for (const p of this.players()) if (p.team >= 0) this.size[p.team]++;
    for (const p of this.players()) this.initPlayer(p, { kicks: 0, scored: 0, power: false, kick: null, timer: null });
  }

  score(p) {
    return p.g ? p.g.scored : 0;
  }

  onAnswer(p, correct, rewarded) {
    if (!rewarded) return {};
    return { note: p.g.streak >= 3 ? '⚡ בעיטת עוצמה!' : '⚽ פנדל!' };
  }

  afterFeedback(p) {
    const g = p.g;
    if (!g.last || !g.last.correct) return this.nextQuestion(p);
    g.power = g.streak >= 3;
    g.phase = 'kick';
    g.timer = this.later(() => this.kick(p, Math.floor(Math.random() * 6)), KICK_MS + 1500);
  }

  action(p, type, data) {
    if (type === 'kick' && p.g.phase === 'kick') this.kick(p, data.zone);
  }

  kick(p, zone) {
    const g = p.g;
    if (this.over || g.phase !== 'kick' || !Number.isInteger(zone) || zone < 0 || zone > 5) return;
    clearTimeout(g.timer);
    const col = zone % 3;
    const row = Math.floor(zone / 3);
    const keeperCol = pickCol();
    // a power shot is struck so hard the keeper can only cover half the post (one row)
    const keeperRow = g.power ? Math.floor(Math.random() * 2) : -1;
    const saved = keeperCol === col && (keeperRow < 0 || keeperRow === row);
    const post = !saved && row === 0 && col !== 1 && Math.random() < POST_CHANCE;
    const goal = !saved && !post;
    this.shots[p.team]++;
    g.kicks++;
    if (goal) {
      this.goals[p.team]++;
      g.scored++;
      if (g.power) this.addFeed(`⚡ ${p.name} כבש/ה בבעיטת עוצמה!`, p.team);
    }
    g.kick = { zone, keeperCol, keeperRow, goal, saved, post, power: g.power };
    g.phase = 'kicked';
    this.ev.push({ id: this.eid++, team: p.team, name: p.name, zone, keeperCol, keeperRow, goal, saved, post });
    if (this.ev.length > 12) this.ev.shift();
    this.room.pushPlayer(p);
    this.room.scheduleHostPush();
    this.later(() => {
      if (g.phase !== 'kicked') return;
      this.turnDone(p);
      this.room.pushPlayer(p);
    }, 1700);
  }

  publicState() {
    return { kind: 'penalty', goals: this.goals, shots: this.shots, size: this.size, teams: this.teams, ev: this.ev, feed: this.feed };
  }

  personal(p) {
    const g = p.g;
    const out = { ...this.baseView(p), kicks: g.kicks, scored: g.scored, goals: this.goals };
    if (g.phase === 'kick') out.power = g.power;
    if (g.phase === 'kicked') out.kick = g.kick;
    return out;
  }

  results() {
    const players = this.players()
      .filter((p) => p.g)
      .map((p) => ({ name: p.name, team: p.team, scored: p.g.scored, kicks: p.g.kicks, correct: p.g.correct }))
      .sort((x, y) => y.scored - x.scored || x.kicks - y.kicks);
    return { kind: 'penalty', goals: this.goals, shots: this.shots, winner: winnerOf(this.goals), teams: this.teams, players };
  }
}

module.exports = PenaltyGame;
