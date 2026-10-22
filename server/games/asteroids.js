// "מגני כדור הארץ" - co-op. Everyone defends one planet. Correct answers become laser shots
// that players aim at falling asteroids on their own phone.
const QuizGame = require('./base');

const DIFF = { easy: 0.7, normal: 1, hard: 1.4 };
const WAVE_SECONDS = 30;

class AsteroidsGame extends QuizGame {
  static id = 'asteroids';
  static order = 13;
  static title = 'מגני כדור הארץ';
  static emoji = '☄️';
  static mode = 'coop';
  static reward = ['ירייה', 'יריות'];
  static stacks = true;
  static blurb = 'כולם ביחד נגד הסלעים. כל תשובה נכונה היא ירייה בלייזר: פוצצו אסטרואידים לפני שהם פוגעים בכוכב.';
  static tickMs = 250;
  static defaults = { duration: 300, difficulty: 'normal' };
  static options = [{ key: 'difficulty', label: 'קושי', choices: [['easy', 'קל'], ['normal', 'רגיל'], ['hard', 'קשה']] }];

  start() {
    this.maxHp = 100;
    this.hp = 100;
    this.ast = [];
    this.nid = 1;
    this.ev = [];
    this.eid = 1;
    this.kills = 0;
    this.wave = 1;
    this.acc = 0;
    this.t0 = Date.now();
    this.travel = 16;
    for (const p of this.players()) this.initPlayer(p, { shots: 0, supers: 0, kills: 0 });
    this.addFeed('🚀 הגל הראשון מתחיל!');
  }

  get diff() {
    return DIFF[this.room.settings.difficulty] || 1;
  }

  event(e) {
    this.ev.push({ id: this.eid++, ...e });
    if (this.ev.length > 20) this.ev.shift();
  }

  spawn(boss = false) {
    const r = Math.random();
    const hp = boss ? 8 : r < 0.7 ? 1 : r < 0.92 || this.wave < 2 ? 2 : 3;
    const slow = boss ? 2.4 : [0, 1, 1.25, 1.5][hp];
    this.ast.push({ id: this.nid++, x: Math.round(6 + Math.random() * 88), y: 0, hp, max: hp, slow, v: 1 / (this.travel * slow), boss });
  }

  tick() {
    if (this.over) return;
    const dt = this.constructor.tickMs / 1000;
    const wave = 1 + Math.floor((Date.now() - this.t0) / 1000 / WAVE_SECONDS);
    if (wave > this.wave) {
      this.wave = wave;
      this.hp = Math.min(this.maxHp, this.hp + 10);
      this.addFeed(`🌊 גל ${wave}! המגן התחזק`);
      if (wave % 3 === 0) {
        this.spawn(true);
        this.addFeed('👹 אסטרואיד ענק מתקרב!');
      }
    }
    this.travel = Math.max(7, 16 - this.wave * 0.7) / (this.diff > 1 ? 1.15 : 1);
    const n = Math.min(this.room.players.size, 40);
    this.acc += (0.12 + n * 0.045) * this.diff * (1 + 0.1 * (this.wave - 1)) * dt;
    while (this.acc >= 1) {
      this.acc -= 1;
      this.spawn();
    }
    for (const a of this.ast) {
      a.v = 1 / (this.travel * a.slow);
      a.y += a.v * dt;
    }
    const remaining = [];
    for (const a of this.ast) {
      if (a.y < 1) {
        remaining.push(a);
        continue;
      }
      const dmg = a.boss ? 30 : a.max * 5;
      this.hp = Math.max(0, this.hp - dmg);
      this.event({ k: 'planet', x: a.x, y: 1, size: a.max });
      this.addFeed(`💥 פגיעה במגן! -${dmg}`);
    }
    this.ast = remaining;
    if (this.hp <= 0) this.room.end();
  }

  onAnswer(p, correct, rewarded) {
    if (!rewarded) return {};
    const g = p.g;
    g.shots += this.amount;
    const sup = g.streak % 5 === 0;
    if (sup) g.supers++;
    return { note: `🔫 +${this.amount} ${this.amount > 1 ? 'יריות' : 'ירייה'}${sup ? ' · ⚡ סופר-לייזר!' : ''}` };
  }

  score(p) {
    return p.g ? p.g.kills : 0;
  }

  afterFeedback(p) {
    const g = p.g;
    if (g.last && g.last.correct && (g.shots > 0 || g.supers > 0)) g.phase = 'shoot';
    else this.nextQuestion(p);
  }

  damage(a, p) {
    a.hp--;
    const dead = a.hp <= 0;
    this.event({ k: dead ? 'boom' : 'hit', x: a.x, y: a.y, by: p.name, size: a.max });
    if (dead) {
      this.ast = this.ast.filter((o) => o !== a);
      p.g.kills++;
      this.kills++;
      if (a.boss) this.addFeed(`🏆 ${p.name} החריב/ה את האסטרואיד הענק!`);
    }
  }

  action(p, type, data) {
    const g = p.g;
    if (g.phase !== 'shoot') return;
    if (type === 'skip') {
      this.nextQuestion(p); // banked shots are kept
    } else if (type === 'shoot') {
      if (data.nova) {
        if (g.supers <= 0) return;
        g.supers--;
        this.event({ k: 'nova', by: p.name });
        for (const a of [...this.ast]) this.damage(a, p);
      } else {
        const a = this.ast.find((o) => o.id === data.id);
        if (!a || g.shots <= 0) return;
        g.shots--;
        this.damage(a, p);
      }
      if (g.shots <= 0 && g.supers <= 0) this.nextQuestion(p);
    } else return;
    this.room.pushPlayer(p);
  }

  topShooters() {
    return this.players()
      .filter((p) => p.g)
      .map((p) => ({ name: p.name, kills: p.g.kills }))
      .sort((a, b) => b.kills - a.kills);
  }

  publicState() {
    return {
      kind: 'asteroids',
      hp: this.hp,
      maxHp: this.maxHp,
      wave: this.wave,
      kills: this.kills,
      ast: this.ast.map((a) => ({ id: a.id, x: a.x, y: Math.round(a.y * 1000) / 1000, hp: a.hp, max: a.max, v: Math.round(a.v * 10000) / 10000, boss: a.boss })),
      ev: this.ev,
      feed: this.feed,
      top: this.topShooters().slice(0, 5),
    };
  }

  personal(p) {
    const g = p.g;
    return { ...this.baseView(p), shots: g.shots, supers: g.supers, kills: g.kills, hp: this.hp, maxHp: this.maxHp };
  }

  results() {
    const shooters = this.players().filter((p) => p.g).map((p) => ({ name: p.name, kills: p.g.kills, correct: p.g.correct, wrong: p.g.wrong }));
    shooters.sort((a, b) => b.kills - a.kills);
    return { kind: 'asteroids', victory: this.hp > 0, hp: this.hp, wave: this.wave, kills: this.kills, players: shooters };
  }
}

module.exports = AsteroidsGame;
