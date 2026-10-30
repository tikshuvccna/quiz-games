// "מגיני הטירה" - co-op tower defense. Monsters walk the path to the castle in waves. Every reward lets a player build a
// tower on a free spot or upgrade one (archer, cannon or mage). The server runs the whole battle; survive every wave to win.
const QuizGame = require('./base');

const PATH = [[-6, 20], [40, 20], [40, 62], [100, 62], [100, 26], [140, 26], [140, 74]];
const SLOTS = [[22, 33], [54, 38], [58, 74], [80, 46], [120, 44], [118, 76], [122, 12], [152, 50]];
const TYPES = {
  archer: { name: 'קשת', dmg: 6, cd: 0.7, range: 26, splash: 0, slow: 0 },
  cannon: { name: 'תותח', dmg: 16, cd: 1.8, range: 22, splash: 9, slow: 0 },
  mage: { name: 'קוסם', dmg: 8, cd: 1.1, range: 24, splash: 0, slow: 0.45 },
};
const MAX_LVL = 3;
const WAVES = 8;
const WAVE_GAP = 22; // seconds between waves
const DIFF = { easy: 0.75, normal: 1, hard: 1.35 };
const DT = 0.25;

// cumulative length of the path, to place an enemy by how far along it is
const SEG = [];
let TOTAL_LEN = 0;
for (let i = 1; i < PATH.length; i++) {
  const l = Math.hypot(PATH[i][0] - PATH[i - 1][0], PATH[i][1] - PATH[i - 1][1]);
  SEG.push(l);
  TOTAL_LEN += l;
}
function at(d) {
  let rest = Math.max(0, Math.min(TOTAL_LEN, d));
  for (let i = 0; i < SEG.length; i++) {
    if (rest <= SEG[i]) {
      const k = SEG[i] ? rest / SEG[i] : 0;
      return [PATH[i][0] + (PATH[i + 1][0] - PATH[i][0]) * k, PATH[i][1] + (PATH[i + 1][1] - PATH[i][1]) * k];
    }
    rest -= SEG[i];
  }
  return PATH[PATH.length - 1];
}

class TowerGame extends QuizGame {
  static id = 'td';
  static order = 25;
  static title = 'מגיני הטירה';
  static emoji = '🏰';
  static mode = 'coop';
  static reward = ['מגדל', 'מגדלים'];
  static blurb = 'כולם ביחד מגינים על הטירה מפני גלי מפלצות. כל תשובה נכונה היא הזדמנות לבנות מגדל (קשת, תותח או קוסם) או לשדרג מגדל קיים. שורדים את כל הגלים?';
  static tickMs = 250;
  static defaults = { duration: 480, difficulty: 'normal' };
  static options = [{ key: 'difficulty', label: 'קושי', choices: [['easy', 'קל'], ['normal', 'רגיל'], ['hard', 'קשה']] }];

  start() {
    // a bigger class earns towers faster, so the monsters grow with it
    this.k = (DIFF[this.room.settings.difficulty] || 1) * (0.8 + 0.03 * Math.min(30, Math.max(1, this.room.players.size)));
    this.hp = 20;
    this.wave = 0;
    this.clock = 8; // seconds until the first wave
    this.queue = []; // enemies waiting to enter, { at, hp, speed, boss }
    this.enemies = [];
    this.towers = new Array(SLOTS.length).fill(null);
    this.eid = 1;
    this.shots = [];
    this.sid = 1;
    this.done = false;
    this.killed = 0;
    for (const p of this.players()) this.initPlayer(p, { built: 0, upgraded: 0, timer: null });
    this.addFeed('🏰 הגל הראשון מגיע… בנו מגדלים!');
  }

  score(p) {
    return p.g ? p.g.built + p.g.upgraded : 0;
  }

  onAnswer(p, correct, rewarded) {
    return rewarded ? { note: '🏰 בנו מגדל!' } : {};
  }

  // ---------- the player builds ----------
  afterFeedback(p) {
    const g = p.g;
    if (this.done || this.towers.every((t) => t && t.lvl >= MAX_LVL)) return this.nextQuestion(p); // nothing left to build
    g.phase = 'build';
    clearTimeout(g.timer);
    g.timer = this.later(() => {
      if (p.g.phase === 'build') { this.nextQuestion(p); this.room.pushPlayer(p); }
    }, 16000);
  }

  action(p, type, data) {
    const g = p.g;
    if (g.phase !== 'build') return;
    if (type === 'skip') { clearTimeout(g.timer); this.turnDone(p); return this.room.pushPlayer(p); }
    if (type !== 'build') return;
    const slot = data.slot;
    const kind = data.type;
    if (!Number.isInteger(slot) || slot < 0 || slot >= SLOTS.length || !TYPES[kind]) return;
    const t = this.towers[slot];
    if (!t) {
      this.towers[slot] = { type: kind, lvl: 1, cd: 0 };
      g.built++;
      this.addFeed(`🏗️ ${p.name} בנה/תה ${TYPES[kind].name}`);
    } else if (t.lvl < MAX_LVL) {
      t.lvl++; // upgrading keeps the tower's own type
      g.upgraded++;
      this.addFeed(`⬆️ ${p.name} שדרג/ה ${TYPES[t.type].name} (רמה ${t.lvl})`);
    } else return; // already at the top
    clearTimeout(g.timer);
    this.turnDone(p);
    this.room.pushPlayer(p);
    this.room.scheduleHostPush();
  }

  // ---------- the battle ----------
  spawnWave() {
    this.wave++;
    const n = 4 + this.wave * 2;
    const hp = Math.round((22 + this.wave * 12) * this.k);
    for (let i = 0; i < n; i++) this.queue.push({ at: i * 1.1, hp, speed: 7 + this.wave * 0.5 + Math.random() * 1.5, boss: false });
    if (this.wave % 4 === 0) this.queue.push({ at: n * 1.1 + 1, hp: hp * 6, speed: 5, boss: true });
    this.addFeed(`⚔️ גל ${this.wave} מתקרב!`);
  }

  tick() {
    if (this.over || this.done) return;
    this.clock -= DT;
    if (this.clock <= 0 && this.wave < WAVES) {
      this.spawnWave();
      this.clock = WAVE_GAP;
    }
    // enemies enter the path
    for (const q of this.queue) q.at -= DT;
    for (const q of this.queue.filter((x) => x.at <= 0)) this.enemies.push({ id: this.eid++, d: 0, hp: q.hp, max: q.hp, speed: q.speed, boss: q.boss, slow: 0 });
    this.queue = this.queue.filter((x) => x.at > 0);
    // they walk; the ones that arrive hurt the castle
    for (const e of this.enemies) {
      e.slow = Math.max(0, e.slow - DT);
      e.d += e.speed * (e.slow > 0 ? 0.55 : 1) * DT;
      if (e.d >= TOTAL_LEN) {
        e.leaked = true;
        this.hp -= e.boss ? 5 : 1;
        this.addFeed(`💥 ${e.boss ? 'מפלצת ענקית' : 'מפלצת'} הגיעה לטירה!`);
      }
    }
    this.enemies = this.enemies.filter((e) => !e.leaked);
    // the towers shoot
    for (let i = 0; i < this.towers.length; i++) {
      const t = this.towers[i];
      if (!t) continue;
      const def = TYPES[t.type];
      t.cd -= DT;
      if (t.cd > 0) continue;
      const [sx, sy] = SLOTS[i];
      // the enemy furthest along the path inside the range
      let tgt = null;
      for (const e of this.enemies) {
        const [ex, ey] = at(e.d);
        if (Math.hypot(ex - sx, ey - sy) <= def.range + t.lvl * 2 && (!tgt || e.d > tgt.d)) tgt = e;
      }
      if (!tgt) continue;
      t.cd = def.cd * (1 - (t.lvl - 1) * 0.12);
      const dmg = def.dmg * (1 + (t.lvl - 1) * 0.55);
      const [tx, ty] = at(tgt.d);
      const hits = def.splash ? this.enemies.filter((e) => { const [x, y] = at(e.d); return Math.hypot(x - tx, y - ty) <= def.splash; }) : [tgt];
      for (const e of hits) {
        e.hp -= dmg;
        if (def.slow) e.slow = 1.6;
      }
      this.shots.push({ id: this.sid++, from: i, x: +tx.toFixed(1), y: +ty.toFixed(1), type: t.type, born: Date.now() });
    }
    const dead = this.enemies.filter((e) => e.hp <= 0);
    this.killed += dead.length;
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    const cutoff = Date.now() - 900;
    this.shots = this.shots.filter((s) => s.born > cutoff);
    this.room.scheduleHostPush();
    // the end
    if (this.hp <= 0) return this.finish(false);
    if (this.wave >= WAVES && !this.queue.length && !this.enemies.length) this.finish(true);
  }

  finish(win) {
    this.done = true;
    this.win = win;
    this.addFeed(win ? '🎉 הטירה ניצלה! כל הגלים הובסו' : '💔 הטירה נפלה…');
    this.room.scheduleHostPush();
    this.later(() => this.room.end(), 2800);
  }

  // ---------- views ----------
  publicState() {
    return {
      kind: 'td',
      path: PATH,
      slots: SLOTS,
      types: Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [k, { name: v.name, range: v.range }])),
      towers: this.towers.map((t) => (t ? { type: t.type, lvl: t.lvl } : null)),
      enemies: this.enemies.map((e) => { const [x, y] = at(e.d); return { id: e.id, x: +x.toFixed(1), y: +y.toFixed(1), hp: Math.max(0, e.hp / e.max), boss: e.boss, slow: e.slow > 0 }; }),
      shots: this.shots.map((s) => ({ id: s.id, from: s.from, x: s.x, y: s.y, type: s.type })),
      hp: Math.max(0, this.hp),
      wave: this.wave,
      waves: WAVES,
      next: this.wave < WAVES ? Math.max(0, Math.ceil(this.clock)) : 0,
      killed: this.killed,
      feed: this.feed,
      win: this.done ? this.win : null,
    };
  }

  personal(p) {
    const g = p.g;
    const out = { ...this.baseView(p), hp: Math.max(0, this.hp), wave: this.wave };
    if (g.phase === 'build') {
      out.slots = SLOTS;
      out.path = PATH;
      out.towers = this.towers.map((t) => (t ? { type: t.type, lvl: t.lvl } : null));
      out.max = MAX_LVL;
      out.types = Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [k, v.name]));
    }
    return out;
  }

  results() {
    return {
      kind: 'td',
      win: !!this.win,
      wave: this.wave,
      waves: WAVES,
      hp: Math.max(0, this.hp),
      killed: this.killed,
      players: this.players().filter((p) => p.g).map((p) => ({ name: p.name, built: p.g.built, upgraded: p.g.upgraded, correct: p.g.correct, wrong: p.g.wrong })).sort((a, b) => b.built + b.upgraded - (a.built + a.upgraded)),
    };
  }
}

module.exports = TowerGame;
