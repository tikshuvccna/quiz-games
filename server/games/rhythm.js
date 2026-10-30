// "קצב" - free for all rhythm game. A correct answer earns a short song: notes fall down four lanes on the phone
// and you tap each one on the beat. Accuracy is points. (The phone reports its taps; the pattern is made here.)
const QuizGame = require('./base');

const FALL_MS = 1500; // how long a note takes to fall to the hit line
const LEAD_MS = 1800; // quiet start before the first note
const WINDOWS = [[80, 3, 'perfect'], [140, 2, 'good'], [200, 1, 'ok']];
const MAX_TAPS = 48;

class RhythmGame extends QuizGame {
  static id = 'rhythm';
  static order = 17;
  static title = 'קצב';
  static emoji = '🥁';
  static mode = 'ffa';
  static reward = ['שיר', 'שירים'];
  static blurb = 'כל אחד לעצמו. תשובה נכונה פותחת שיר קצר: תווים נופלים בארבעה נתיבים ואתם מקישים על כל אחד בדיוק בקצב. ככל שמדויקים יותר, יש יותר נקודות ורצפי קומבו!';
  static tickMs = 1000;
  static defaults = { duration: 240 };
  static options = [];

  start() {
    for (const p of this.players()) this.initPlayer(p, { pts: 0, songs: 0, hits: 0, notes: 0, bestCombo: 0, song: null, res: null, timer: null });
  }

  score(p) {
    return p.g ? p.g.pts : 0;
  }

  onAnswer(p, correct) {
    const g = p.g;
    if (!correct) return {};
    const add = 5 + Math.min(g.streak, 5);
    g.pts += add;
    return { note: `⭐ +${add}` };
  }

  makeSong(g) {
    const bpm = 92 + Math.floor(Math.random() * 28);
    const beat = 60000 / bpm;
    const count = 10 + Math.min(6, Math.floor(g.streak / 2));
    const notes = [];
    let t = LEAD_MS;
    for (let i = 0; i < count; i++) {
      notes.push({ lane: Math.floor(Math.random() * 4), t: Math.round(t) });
      t += beat * (Math.random() < 0.25 ? 0.5 : 1);
    }
    return { bpm, notes, end: Math.round(t + 500) };
  }

  afterFeedback(p) {
    const g = p.g;
    g.song = this.makeSong(g);
    g.phase = 'beat';
    clearTimeout(g.timer);
    // a phone that never answers does not stall the game
    g.timer = this.later(() => {
      if (p.g.phase === 'beat') this.grade(p, []);
    }, g.song.end + FALL_MS + 4000);
  }

  action(p, type, data) {
    if (type === 'taps' && p.g.phase === 'beat' && Array.isArray(data.taps)) {
      const taps = data.taps
        .slice(0, MAX_TAPS)
        .filter((x) => Array.isArray(x) && Number.isInteger(x[0]) && x[0] >= 0 && x[0] < 4 && Number.isFinite(x[1]))
        .map((x) => ({ lane: x[0], t: x[1] }));
      this.grade(p, taps);
    }
  }

  grade(p, taps) {
    const g = p.g;
    if (g.phase !== 'beat' || !g.song) return;
    clearTimeout(g.timer);
    const used = new Set();
    let pts = 0;
    let hits = 0;
    let combo = 0;
    let best = 0;
    const counts = { perfect: 0, good: 0, ok: 0, miss: 0 };
    for (const n of g.song.notes) {
      let bi = -1;
      let bd = Infinity;
      taps.forEach((tp, i) => {
        if (used.has(i) || tp.lane !== n.lane) return;
        const d = Math.abs(tp.t - n.t);
        if (d < bd) { bd = d; bi = i; }
      });
      const w = bi >= 0 ? WINDOWS.find(([ms]) => bd <= ms) : null;
      if (w) {
        used.add(bi);
        pts += w[1];
        hits++;
        combo++;
        best = Math.max(best, combo);
        counts[w[2]]++;
      } else {
        combo = 0;
        counts.miss++;
      }
    }
    // a clean song gets a bonus
    if (hits === g.song.notes.length) pts += 5;
    g.pts += pts;
    g.songs++;
    g.hits += hits;
    g.notes += g.song.notes.length;
    g.bestCombo = Math.max(g.bestCombo, best);
    g.res = { pts, hits, total: g.song.notes.length, combo: best, ...counts, full: hits === g.song.notes.length };
    if (g.res.full) this.addFeed(`🥁 ${p.name} ניגן/ה שיר מושלם!`, p.team);
    g.phase = 'beated';
    this.room.pushPlayer(p);
    this.room.scheduleHostPush();
    this.later(() => {
      if (g.phase !== 'beated') return;
      this.turnDone(p);
      this.room.pushPlayer(p);
    }, 1800);
  }

  ranking() {
    return this.players()
      .filter((p) => p.g)
      .map((p) => ({ name: p.name, pts: p.g.pts, songs: p.g.songs, acc: p.g.notes ? Math.round((p.g.hits / p.g.notes) * 100) : 0, combo: p.g.bestCombo, playing: p.g.phase === 'beat' }))
      .sort((a, b) => b.pts - a.pts);
  }

  publicState() {
    const r = this.ranking();
    return { kind: 'rhythm', players: r.slice(0, 16), total: r.length, feed: this.feed };
  }

  personal(p) {
    const g = p.g;
    const out = { ...this.baseView(p), pts: g.pts, rank: 1 + this.players().filter((o) => o.g && o.g.pts > g.pts).length };
    if (g.phase === 'beat') out.song = { ...g.song, fall: FALL_MS };
    if (g.phase === 'beated') out.res = g.res;
    return out;
  }

  results() {
    return { kind: 'rhythm', players: this.ranking() };
  }
}

module.exports = RhythmGame;
