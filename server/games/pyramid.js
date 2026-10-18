// "הפירמידה האבודה" (like Kahoot's The Lost Pyramid) - teams climb a pyramid. Everyone sees the question on
// the big screen, discusses with the team, votes on the phone and says how sure they are:
// right + sure = more steps, wrong + sure = steps lost. First team to the top wins. Host paces the game.
const ClassicGame = require('./classic');

const HEIGHT = 15;
const VOTE_SECONDS = 120; // long on purpose: teams should talk it over

class PyramidGame extends ClassicGame {
  static id = 'pyramid';
  static title = 'הפירמידה האבודה';
  static emoji = '🔺';
  static mode = 'teams';
  static classic = false; // only questions with a right answer
  static teamAvg = false;
  static teamCounts = [2, 3, 4, 5, 6];
  static defaultTeams = 4;
  static blurb = 'קבוצות מטפסות על פירמידה. כולם רואים את השאלה במסך, מתייעצים עם הקבוצה, מצביעים בטלפון ובוחרים כמה הם בטוחים: יותר ביטחון = יותר מדרגות, אבל טעות בביטחון מורידה. הקבוצה הראשונה לפסגה מנצחת!';
  static defaults = { duration: 600, count: 0, order: 'original', advance: 'manual', bonus: 'off', style: 'pyramid', timer: 'question' };
  static options = [
    { key: 'count', label: 'מספר שאלות', choices: [[0, 'כל השאלות'], [5, '5'], [10, '10'], [15, '15'], [20, '20']] },
    { key: 'order', label: 'סדר השאלות', choices: [['original', 'לפי החידון'], ['shuffle', 'מעורבב']] },
    { key: 'advance', label: 'מעבר בין שלבים', choices: [['manual', 'ידני (לחיצה)'], ['auto', 'אוטומטי']] },
  ];

  start() {
    this.teams = this.room.teams();
    this.pos = this.teams.map(() => 0);
    this.raw = this.teams.map(() => 0); // unclamped steps, to break ties at the top
    this.gain = this.teams.map(() => 0);
    this.winner = -1;
    super.start();
    this.bonusQs = [];
  }

  get style() {
    return 'pyramid';
  }

  questionTime() {
    return VOTE_SECONDS;
  }

  // "Totally!" unlocks halfway through the game (or once a team is halfway up)
  confOptions() {
    const opts = [
      { v: 1, label: 'אולי', emoji: '🤔', desc: 'נכון: מדרגה · טעות: בלי הפסד' },
      { v: 2, label: 'כן!', emoji: '👍', desc: 'נכון: 2 מדרגות · טעות: יורדים 1' },
    ];
    if (this.i >= Math.floor(this.list.length / 2) || Math.max(...this.pos) >= HEIGHT / 2) opts.push({ v: 3, label: 'בטוח לגמרי!', emoji: '💯', desc: 'נכון: 3 מדרגות · טעות: יורדים 2' });
    return opts;
  }

  // a player's step value; the team climbs by the average of its members
  scoreFor(p, q, a, ok) {
    if (!a) return 0;
    const c = a.data.conf || 1;
    return ok ? c : -(c - 1);
  }

  afterReveal(rv) {
    const sum = this.teams.map(() => 0);
    const size = this.teams.map(() => 0);
    for (const p of this.players()) {
      if (!p.g || p.team < 0 || !this.teams[p.team]) continue;
      size[p.team]++;
      sum[p.team] += p.g.res && p.g.res.answered ? p.g.res.pts : 0;
    }
    this.gain = this.teams.map((_, t) => (size[t] ? Math.round((sum[t] / size[t]) * 1.5) : 0));
    this.raw = this.raw.map((v, t) => Math.max(0, v + this.gain[t]));
    this.pos = this.raw.map((v) => Math.min(HEIGHT, v));
    const top = this.pos.map((v, t) => (v >= HEIGHT ? t : -1)).filter((t) => t >= 0);
    // several teams reach the top together: the one that climbed furthest wins (a true tie is shared)
    if (top.length) {
      const best = Math.max(...top.map((t) => this.raw[t]));
      const firsts = top.filter((t) => this.raw[t] === best);
      this.winner = firsts.length === 1 ? firsts[0] : -2;
    }
    rv.gain = this.gain;
    rv.pos = this.pos;
  }

  funLines() {
    const out = [];
    const best = Math.max(...this.gain);
    const t = this.gain.indexOf(best);
    if (best > 0) out.push(`🔺 ${this.teams[t].name} עלו ${best} מדרגות!`);
    const fell = this.gain.map((g, i) => (g < 0 ? i : -1)).filter((i) => i >= 0);
    if (fell.length) out.push(`😬 ${fell.map((i) => this.teams[i].name).join(', ')} החליקו למטה`);
    if (this.winner >= 0) out.push(`🏆 ${this.teams[this.winner].name} הגיעו לפסגה!`);
    else if (this.winner === -2) out.push('🤝 כמה קבוצות הגיעו לפסגה יחד: תיקו!');
    else if (this.i === Math.floor(this.list.length / 2) - 1) out.push('💯 מהשאלה הבאה אפשר לבחור "בטוח לגמרי!"');
    return out.slice(0, 3);
  }

  isLast() {
    return this.winner !== -1 || this.i >= this.list.length - 1;
  }

  // the pyramid is always shown after a reveal, even after the last question
  board() {
    if (this.stage !== 'reveal') return;
    this.stage = 'board';
    this.pushEveryone();
    if (!this.manual) this.schedule(() => this.next(), 6500);
  }

  next() {
    if (this.stage === 'board' && this.isLast()) return this.room.end();
    super.next();
  }

  publicState() {
    const out = super.publicState();
    out.kind = 'pyramid';
    out.pyramid = { height: HEIGHT, pos: this.pos, gain: this.gain, teams: this.teams, winner: this.winner, sizes: this.teams.map((_, t) => this.players().filter((p) => p.team === t).length) };
    return out;
  }

  results() {
    const order = this.teams.map((_, t) => t).sort((a, b) => this.raw[b] - this.raw[a]);
    const best = this.raw[order[0]];
    const winner = this.raw.filter((v) => v === best).length > 1 ? -1 : order[0];
    const players = this.rank().map((p) => ({ name: p.name, team: p.team, score: p.g.score, correct: p.g.correct, wrong: p.g.wrong, best: p.g.bestStreak }));
    return { kind: 'pyramid', teams: this.teams, pos: this.pos, height: HEIGHT, winner, players, total: this.main.length };
  }
}

module.exports = PyramidGame;
