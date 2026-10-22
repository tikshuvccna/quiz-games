// "קרב הדרקון" - co-op. Correct answers become timed sword strikes; wrong answers enrage the dragon.
const QuizGame = require('./base');

const BOSS_HP = { easy: 0.75, normal: 1, hard: 1.3 };
const ATK = { easy: 0.8, normal: 1, hard: 1.25 };
const STRIKE_FALLBACK_MS = 6000;

class DragonGame extends QuizGame {
  static id = 'dragon';
  static order = 14;
  static title = 'קרב הדרקון';
  static emoji = '🐉';
  static mode = 'coop';
  static reward = ['מכה', 'מכות'];
  static blurb = 'כולם ביחד נגד דרקון ענק. תשובה נכונה = מכת חרב, ואם עוצרים את המחוון באמצע מקבלים מכה קריטית. הדרקון תוקף מדי כמה שניות, אז אל תפספסו!';
  static tickMs = 500;
  static defaults = { duration: 300, difficulty: 'normal' };
  static options = [{ key: 'difficulty', label: 'קושי', choices: [['easy', 'קל'], ['normal', 'רגיל'], ['hard', 'קשה']] }];

  start() {
    const n = Math.max(this.room.players.size, 1);
    const d = this.room.settings.difficulty;
    this.maxHp = Math.round(420 * n * (BOSS_HP[d] || 1));
    this.hp = this.maxHp;
    this.crew = 100;
    this.ev = [];
    this.eid = 1;
    this.nextAtk = Date.now() + 10000;
    for (const p of this.players()) this.initPlayer(p, { dmg: 0, hits: 0, crits: 0, timer: null });
    this.addFeed('🐉 הדרקון התעורר!');
  }

  stop() {
    super.stop();
    for (const p of this.players()) if (p.g) clearTimeout(p.g.timer);
  }

  event(e) {
    this.ev.push({ id: this.eid++, ...e });
    if (this.ev.length > 16) this.ev.shift();
  }

  get rage() {
    return this.hp / this.maxHp < 0.33;
  }

  tick() {
    if (this.over) return;
    if (this.crew <= 0) return this.room.end(); // wrong answers can wear the crew down too
    if (Date.now() < this.nextAtk) return;
    const n = Math.min(this.room.players.size, 25);
    const dmg = Math.round((5 + n * 0.7) * (ATK[this.room.settings.difficulty] || 1) * (this.rage ? 1.5 : 1));
    this.crew = Math.max(0, this.crew - dmg);
    this.nextAtk = Date.now() + (this.rage ? 7000 : 12000);
    this.event({ k: 'atk', dmg });
    this.addFeed(`🔥 הדרקון תוקף! -${dmg}`);
    if (this.crew <= 0) this.room.end();
  }

  onAnswer(p, correct, rewarded) {
    if (!correct) {
      this.crew = Math.max(0, this.crew - 3);
      return { note: '🐉 הדרקון כועס! -3 🛡️' };
    }
    this.crew = Math.min(100, this.crew + 1);
    return rewarded ? { note: '⚔️ תתכוננו למכה!' } : {};
  }

  score(p) {
    return p.g ? p.g.dmg : 0;
  }

  afterFeedback(p) {
    const g = p.g;
    if (!g.last || !g.last.correct) return this.nextQuestion(p);
    g.phase = 'strike';
    g.timer = this.later(() => this.strike(p, 0.2), STRIKE_FALLBACK_MS);
  }

  action(p, type, data) {
    if (type === 'strike' && p.g.phase === 'strike') this.strike(p, data.acc);
  }

  strike(p, rawAcc) {
    const g = p.g;
    if (this.over || g.phase !== 'strike') return;
    clearTimeout(g.timer);
    const acc = Math.max(0, Math.min(1, Number(rawAcc) || 0));
    const crit = acc >= 0.9;
    const dmg = Math.round((12 + acc * 28) * (crit ? 1.5 : 1));
    this.hp = Math.max(0, this.hp - dmg);
    g.dmg += dmg;
    g.hits++;
    if (crit) g.crits++;
    if (g.streak % 5 === 0) this.crew = Math.min(100, this.crew + 6);
    g.struck = { dmg, crit };
    g.phase = 'struck';
    this.event({ k: crit ? 'crit' : 'hit', dmg, by: p.name });
    if (crit && dmg >= 40) this.addFeed(`⚡ ${p.name} הנחית/ה מכה קריטית! ${dmg}`);
    this.room.pushPlayer(p);
    this.room.scheduleHostPush();
    if (this.hp <= 0) return this.room.end();
    this.later(() => {
      if (g.phase !== 'struck') return;
      this.turnDone(p);
      this.room.pushPlayer(p);
    }, 900);
  }

  top() {
    return this.players()
      .filter((p) => p.g)
      .map((p) => ({ name: p.name, dmg: p.g.dmg }))
      .sort((a, b) => b.dmg - a.dmg);
  }

  publicState() {
    return { kind: 'dragon', hp: this.hp, maxHp: this.maxHp, crew: this.crew, rage: this.rage, ev: this.ev, feed: this.feed, top: this.top().slice(0, 5) };
  }

  personal(p) {
    const g = p.g;
    const out = { ...this.baseView(p), dmg: g.dmg, crew: this.crew };
    if (g.phase === 'struck') out.struck = g.struck;
    return out;
  }

  results() {
    const stats = new Map(this.players().map((p) => [p.name, p.g]));
    return {
      kind: 'dragon',
      victory: this.hp <= 0,
      hp: this.hp,
      maxHp: this.maxHp,
      players: this.top().map((t) => ({ ...t, hits: stats.get(t.name).hits, crits: stats.get(t.name).crits, correct: stats.get(t.name).correct })),
    };
  }
}

module.exports = DragonGame;
