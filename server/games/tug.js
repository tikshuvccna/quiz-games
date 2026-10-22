// "מלחמת חבל" - team vs team. A correct answer earns a 3-second power-tap; taps add to the pull.
const QuizGame = require('./base');

const TEAMS = require('../teams').slice(0, 2);
const PULL_MS = 3000;

class TugGame extends QuizGame {
  static id = 'tug';
  static order = 4;
  static title = 'מלחמת חבל';
  static emoji = '💪';
  static mode = 'teams';
  static reward = ['משיכה', 'משיכות'];
  static blurb = 'שתי קבוצות מושכות חבל. תשובה נכונה = משיכה, וככל שתלחצו מהר יותר על הכפתור המשיכה חזקה יותר. מי שגורר את הדגל אל הצד שלו מנצח!';
  static tickMs = 1000;
  static defaults = { duration: 240 };
  static options = [];

  start() {
    this.pos = 0; // -100 = team 0 wins, +100 = team 1 wins
    this.size = [0, 0];
    this.power = [0, 0];
    this.ev = [];
    this.eid = 1;
    for (const p of this.players()) this.size[p.team]++;
    for (const p of this.players()) this.initPlayer(p, { pulls: 0, total: 0, pulledPower: 0, timer: null });
  }

  stop() {
    super.stop();
    for (const p of this.players()) if (p.g) clearTimeout(p.g.timer);
  }

  onAnswer(p, correct, rewarded) {
    return rewarded ? { note: '💪 תתכוננו למשוך!' } : {};
  }

  score(p) {
    return p.g ? Math.round(p.g.total) : 0;
  }

  afterFeedback(p) {
    const g = p.g;
    if (!g.last || !g.last.correct) return this.nextQuestion(p);
    g.phase = 'pull';
    g.pullMs = PULL_MS;
    g.timer = this.later(() => this.finishPull(p, 0), PULL_MS + 3000);
  }

  action(p, type, data) {
    if (type === 'pull' && p.g.phase === 'pull') this.finishPull(p, data.taps);
  }

  finishPull(p, rawTaps) {
    const g = p.g;
    if (this.over || g.phase !== 'pull') return;
    clearTimeout(g.timer);
    const taps = Math.max(0, Math.min(30, Math.floor(Number(rawTaps) || 0)));
    const raw = (4 + taps * 0.5) * (g.streak >= 3 ? 1.5 : 1);
    this.pos += (p.team === 0 ? -1 : 1) * (raw * 1.2) / Math.max(1, this.size[p.team]);
    this.pos = Math.max(-100, Math.min(100, this.pos));
    this.power[p.team] += raw;
    g.pulls++;
    g.total += raw;
    g.pulledPower = Math.round(raw);
    g.phase = 'pulled';
    this.ev.push({ id: this.eid++, team: p.team, power: Math.round(raw), name: p.name });
    if (this.ev.length > 12) this.ev.shift();
    if (raw >= 15) this.addFeed(`💪 ${p.name} משך/ה בכוח ${Math.round(raw)}!`, p.team);
    this.room.pushPlayer(p);
    this.room.scheduleHostPush();
    if (Math.abs(this.pos) >= 100) return this.room.end();
    this.later(() => {
      if (g.phase !== 'pulled') return;
      this.turnDone(p);
      this.room.pushPlayer(p);
    }, 900);
  }

  publicState() {
    const pulling = [0, 0];
    for (const p of this.players()) if (p.g && p.g.phase === 'pull' && p.team >= 0) pulling[p.team]++;
    return { kind: 'tug', pos: Math.round(this.pos * 10) / 10, teams: TEAMS, size: this.size, power: this.power.map(Math.round), pulling, ev: this.ev, feed: this.feed };
  }

  personal(p) {
    const g = p.g;
    return { ...this.baseView(p), pulls: g.pulls, pullMs: g.pullMs, pulled: g.pulledPower, pos: this.pos };
  }

  results() {
    const winner = this.pos === 0 ? -1 : this.pos < 0 ? 0 : 1;
    const players = this.players()
      .filter((p) => p.g)
      .map((p) => ({ name: p.name, team: p.team, pulls: p.g.pulls, total: Math.round(p.g.total), correct: p.g.correct, wrong: p.g.wrong }))
      .sort((a, b) => b.total - a.total);
    return { kind: 'tug', winner, pos: this.pos, teams: TEAMS, power: this.power.map(Math.round), players };
  }
}

module.exports = TugGame;
