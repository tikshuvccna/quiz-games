// "זורקים שטויות" - free for all sabotage. A correct answer earns a prank to throw at someone else:
// their screen flips, spins, smears with oil... for a while. A streak of 3 earns a shield that blocks one prank.
const QuizGame = require('./base');

const PRANK_MS = 14000;
const PICK_MS = 9000;
const STEAL = 15;

// the pranks a player can pick from. `steal` is instant, the rest are effects the target's phone shows for a while.
const PRANKS = {
  flip: { emoji: '🙃', name: 'מראה' },
  spin: { emoji: '🌀', name: 'סחרור' },
  scramble: { emoji: '🔤', name: 'אותיות מבולבלות' },
  colors: { emoji: '🎨', name: 'צבעים הפוכים' },
  oil: { emoji: '🛢️', name: 'שמן על המסך' },
  swap: { emoji: '🔃', name: 'הכול הפוך' },
  shake: { emoji: '💥', name: 'רעידת אדמה' },
  steal: { emoji: '💸', name: 'גניבת נקודות' },
};

class PrankGame extends QuizGame {
  static id = 'prank';
  static order = 13;
  static title = 'זורקים שטויות';
  static emoji = '🤪';
  static mode = 'ffa';
  static noReward = true;
  static blurb = 'כל אחד לעצמו. תשובה נכונה = נקודות ושטות לזרוק על מישהו: המסך שלו מתהפך, מסתובב, מתמרח בשמן או שהאותיות מתבלבלות. רצף של 3 נותן מגן שחוסם שטות אחת. מי שיענה הכי טוב, ינצח!';
  static tickMs = 500;
  static defaults = { duration: 240 };
  static options = [];

  start() {
    this.ev = [];
    this.eid = 1;
    for (const p of this.players()) this.initPlayer(p, { pts: 0, thrown: 0, hit: 0, shield: false, fx: [], got: null, sent: null, timer: null });
  }

  event(e) {
    this.ev.push({ id: this.eid++, ...e });
    if (this.ev.length > 20) this.ev.shift();
  }

  active(p) {
    const now = Date.now();
    return p.g.fx.filter((f) => f.until > now);
  }

  targets(p) {
    let list = this.players().filter((o) => o.g && o.id !== p.id && o.connected);
    if (!list.length) list = this.players().filter((o) => o.g && o.id !== p.id);
    return list;
  }

  score(p) {
    return p.g ? p.g.pts : 0;
  }

  onAnswer(p, correct) {
    const g = p.g;
    if (!correct) return {};
    const add = 10 + 2 * Math.min(g.streak, 5);
    g.pts += add;
    let note = `⭐ +${add} נקודות`;
    if (g.streak > 0 && g.streak % 3 === 0 && !g.shield) {
      g.shield = true;
      note += ' · 🛡️ מגן!';
    }
    return { note };
  }

  // a correct answer: pick a prank and a target (a streak of 3 or more earns two throws)
  afterFeedback(p) {
    const g = p.g;
    if (!g.last || !g.last.correct || !this.targets(p).length) return this.nextQuestion(p);
    g.turns = g.streak >= 3 ? 2 : 1;
    this.openPick(p);
  }

  openPick(p) {
    const g = p.g;
    g.phase = 'prank';
    clearTimeout(g.timer);
    g.timer = this.later(() => {
      if (p.g.phase !== 'prank') return;
      const t = this.targets(p);
      if (t.length) this.throwPrank(p, null, t[Math.floor(Math.random() * t.length)].id, true);
      else { this.turnDone(p); this.room.pushPlayer(p); }
    }, PICK_MS + 1500);
  }

  action(p, type, data) {
    if (type === 'prank' && p.g.phase === 'prank' && typeof data.to === 'string' && typeof data.k === 'string') {
      this.throwPrank(p, data.k, data.to, false);
    }
  }

  throwPrank(p, kind, toId, auto) {
    const g = p.g;
    if (this.over || g.phase !== 'prank') return;
    if (kind !== null && !Object.prototype.hasOwnProperty.call(PRANKS, kind)) return;
    const to = this.targets(p).find((o) => o.id === toId);
    if (!to) return;
    if (kind === null) kind = Object.keys(PRANKS)[Math.floor(Math.random() * Object.keys(PRANKS).length)];
    clearTimeout(g.timer);
    const pr = PRANKS[kind];
    const tg = to.g;
    const now = Date.now();
    let blocked = false;
    if (tg.shield) {
      tg.shield = false;
      blocked = true;
      tg.got = { from: p.name, k: kind, blocked: true, at: now };
    } else if (kind === 'steal') {
      const loss = Math.min(tg.pts, STEAL);
      tg.pts -= loss;
      g.pts += loss;
      tg.hit++;
      tg.got = { from: p.name, k: kind, loss, at: now };
    } else {
      tg.fx = this.active(to).filter((f) => f.k !== kind);
      tg.fx.push({ k: kind, until: now + PRANK_MS, from: p.name });
      tg.hit++;
      tg.got = { from: p.name, k: kind, at: now };
    }
    g.thrown++;
    g.pts += blocked ? 2 : 5;
    g.sent = { to: to.name, k: kind, blocked, auto: !!auto };
    this.event({ k: 'prank', from: p.name, to: to.name, prank: kind, blocked });
    this.addFeed(blocked ? `🛡️ ${to.name} חסם/ה את ${pr.emoji} של ${p.name}` : `${pr.emoji} ${p.name} זרק/ה ${pr.name} על ${to.name}`);
    g.phase = 'sent';
    this.room.pushPlayer(p);
    this.room.pushPlayer(to);
    this.room.scheduleHostPush();
    this.later(() => {
      if (g.phase !== 'sent') return;
      this.turnDone(p);
      this.room.pushPlayer(p);
    }, 1100);
  }

  ranking() {
    return this.players()
      .filter((p) => p.g)
      .map((p) => ({ name: p.name, pts: p.g.pts, thrown: p.g.thrown, hit: p.g.hit, shield: p.g.shield, fx: this.active(p).map((f) => f.k), correct: p.g.correct }))
      .sort((a, b) => b.pts - a.pts);
  }

  publicState() {
    const r = this.ranking();
    return { kind: 'prank', players: r.slice(0, 16), total: r.length, ev: this.ev, feed: this.feed, pranks: PRANKS };
  }

  personal(p) {
    const g = p.g;
    const now = Date.now();
    const out = { ...this.baseView(p), pts: g.pts, shield: g.shield, rank: 1 + this.players().filter((o) => o.g && o.g.pts > g.pts).length };
    out.fx = this.active(p).map((f) => ({ k: f.k, left: f.until - now }));
    if (g.got && now - g.got.at < 3500) out.got = g.got;
    if (g.phase === 'prank') {
      out.pranks = PRANKS;
      out.targets = this.targets(p).map((o) => ({ id: o.id, name: o.name, pts: o.g.pts, shield: o.g.shield }));
      out.pickMs = PICK_MS;
    }
    if (g.phase === 'sent') out.sent = g.sent;
    return out;
  }

  results() {
    return { kind: 'prank', players: this.ranking() };
  }
}

module.exports = PrankGame;
