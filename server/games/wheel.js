// "גלגל המזל" - everyone for themselves (or teams). A correct answer earns a spin of the wheel: points, double,
// a jackpot, or a twist - steal from the player above you, swap places with them, or lose half.
// The server picks the segment; the phone only animates the wheel landing on it.
const QuizGame = require('./base');

// 12 equal segments, clockwise from the top
const SEGS = [
  { k: 'pts', v: 100 },
  { k: 'pts', v: 200 },
  { k: 'double' },
  { k: 'pts', v: 300 },
  { k: 'steal', v: 200 },
  { k: 'pts', v: 100 },
  { k: 'half' },
  { k: 'pts', v: 500 },
  { k: 'swap' },
  { k: 'pts', v: 200 },
  { k: 'pts', v: 1000 },
  { k: 'pts', v: 300 },
];
const SPIN_MS = 10000;
const SHOW_MS = 5200; // the phone animates the wheel, then shows the result

class WheelGame extends QuizGame {
  static id = 'wheel';
  static order = 18;
  static title = 'גלגל המזל';
  static emoji = '🎡';
  static mode = 'ffa';
  static reward = ['סיבוב', 'סיבובים'];
  static blurb = 'תשובה נכונה = סיבוב בגלגל המזל! נקודות, כפול, ג׳קפוט של 1000… או הפתעה: גונבים מהשחקן שמעליכם, מתחלפים איתו במקום, או מפסידים חצי. אף יתרון לא בטוח עד הסוף!';
  static tickMs = 1000;
  static defaults = { duration: 300 };
  static options = [];

  start() {
    this.ev = [];
    this.eid = 1;
    for (const p of this.players()) this.initPlayer(p, { pts: 0, spins: 0, jackpots: 0, spin: null, timer: null });
  }

  stop() {
    super.stop();
    for (const p of this.players()) if (p.g) clearTimeout(p.g.timer);
  }

  score(p) {
    return p.g ? p.g.pts : 0;
  }

  onAnswer(p, correct, rewarded) {
    return rewarded ? { note: '🎡 סובבו את הגלגל!' } : {};
  }

  afterFeedback(p) {
    const g = p.g;
    if (!g.last || !g.last.correct) return this.nextQuestion(p);
    g.phase = 'spin';
    g.timer = this.later(() => this.spin(p), SPIN_MS);
  }

  action(p, type) {
    if (type === 'spin' && p.g.phase === 'spin') this.spin(p);
  }

  // the player just above p (a rival team's best when playing in teams); null when p leads
  above(p) {
    const others = this.players().filter((o) => o !== p && o.g && (p.team < 0 || o.team !== p.team));
    const higher = others.filter((o) => o.g.pts > p.g.pts).sort((a, b) => a.g.pts - b.g.pts);
    if (higher.length) return higher[0];
    return null;
  }

  spin(p) {
    const g = p.g;
    if (this.over || g.phase !== 'spin') return;
    clearTimeout(g.timer);
    const seg = Math.floor(Math.random() * SEGS.length);
    const s = SEGS[seg];
    const before = g.pts;
    let text = '';
    let target = null;
    if (s.k === 'pts') {
      g.pts += s.v;
      text = s.v === 1000 ? '💰 ג׳קפוט! +1000' : `+${s.v}`;
      if (s.v === 1000) {
        g.jackpots++;
        this.addFeed(`💰 ${p.name} זכה/תה בג׳קפוט!`, p.team);
      }
    } else if (s.k === 'double') {
      const gain = Math.min(1000, Math.max(100, g.pts));
      g.pts += gain;
      text = `✖️2 · +${gain}`;
    } else if (s.k === 'half') {
      g.pts = Math.floor(g.pts / 20) * 10;
      text = g.pts < before ? `💸 חצי מהנקודות הלך` : '💸 חצי… מאפס 😅';
    } else {
      const o = this.above(p);
      if (!o) {
        // already on top: a consolation prize
        g.pts += 300;
        text = 'אתם בראש! +300';
      } else if (s.k === 'steal') {
        const take = Math.min(o.g.pts, Math.max(s.v, Math.round(o.g.pts * 0.2 / 10) * 10));
        o.g.pts -= take;
        g.pts += take;
        target = o.name;
        text = `🦹 גנבתם ${take} מ${o.name}`;
        this.addFeed(`🦹 ${p.name} גנב/ה ${take} נקודות מ${o.name}!`, p.team);
        this.room.pushPlayer(o);
      } else {
        const t = o.g.pts;
        o.g.pts = g.pts;
        g.pts = t;
        target = o.name;
        text = `🔄 התחלפתם עם ${o.name}`;
        this.addFeed(`🔄 ${p.name} התחלף/ה במקום עם ${o.name}!`, p.team);
        this.room.pushPlayer(o);
      }
    }
    g.spins++;
    g.spin = { seg, kind: s.k, delta: g.pts - before, text, target };
    g.phase = 'spun';
    this.ev.push({ id: this.eid++, name: p.name, team: p.team, seg, kind: s.k, delta: g.pts - before, target });
    if (this.ev.length > 12) this.ev.shift();
    this.room.pushPlayer(p);
    this.room.scheduleHostPush();
    this.later(() => {
      if (g.phase !== 'spun') return;
      this.turnDone(p);
      this.room.pushPlayer(p);
    }, SHOW_MS);
  }

  ranking() {
    return this.players()
      .filter((p) => p.g)
      .map((p) => ({ name: p.name, pts: p.g.pts, team: p.team }))
      .sort((a, b) => b.pts - a.pts);
  }

  publicState() {
    const r = this.ranking();
    return { kind: 'wheel', ranking: r.slice(0, 10), total: r.length, ev: this.ev, feed: this.feed, teams: this.room.teams() };
  }

  personal(p) {
    const g = p.g;
    const out = { ...this.baseView(p), pts: g.pts };
    out.rank = 1 + this.players().filter((o) => o.g && o.g.pts > g.pts).length;
    if (g.phase === 'spun') out.spin = g.spin;
    return out;
  }

  results() {
    const stats = new Map(this.players().map((p) => [p.name, p.g]));
    return {
      kind: 'wheel',
      players: this.ranking().map((r) => ({ ...r, spins: stats.get(r.name).spins, jackpots: stats.get(r.name).jackpots, correct: stats.get(r.name).correct })),
    };
  }
}

WheelGame.SEGS = SEGS;
module.exports = WheelGame;
