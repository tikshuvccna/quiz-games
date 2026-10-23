// "ציור במספרים" - co-op, chill. Every correct answer is a paintbrush: the phone shows a small patch of a big
// paint-by-numbers picture; paint each square in the color of its number. Together the class reveals the picture on
// the big screen, then a new one starts. Pictures are generated (seeded), and the grid grows with the class size.
const QuizGame = require('./base');

const PAINT_MS = 25000;
const PATCH = 10;

// seeded random
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// each scene: { name, pal, draw(u, v, r) -> palette index } where u, v are 0..1 (v down)
const SCENES = [
  {
    name: 'שקיעה בים',
    pal: ['#ff6fae', '#ff9a6b', '#ffd27a', '#fff6c2', '#2369c9', '#63b0f2', '#1e1145', '#f2c27a'],
    make(r) {
      const sx = 0.3 + r() * 0.4;
      const bx = r() < 0.5 ? 0.18 : 0.78;
      return (u, v) => {
        const hz = 0.6;
        if (v < hz) {
          const d = Math.hypot((u - sx) * 1.67, v - hz + 0.02);
          if (d < 0.2) return 3;
          // a sailboat: dark hull on the horizon, a cream sail above it
          if (v > hz - 0.07 && Math.abs(u - bx) < 0.09 - (v - (hz - 0.07)) * 0.7) return 6;
          if (v > hz - 0.34 && v <= hz - 0.07 && u <= bx + 0.01 && u > bx - 0.01 - (v - (hz - 0.34)) * 0.38) return 3;
          return v < 0.2 + Math.sin(u * 7) * 0.02 ? 0 : v < 0.42 + Math.sin(u * 5 + 1) * 0.02 ? 1 : 2;
        }
        if (v > 0.86 + Math.sin(u * 9) * 0.03) return 7;
        const w = 0.13 * (1 - (v - hz) * 2.2);
        if (Math.abs(u - sx) < w && Math.floor(v * 40) % 2 === 0) return 5;
        return Math.sin(u * 30 + v * 60) > 0.92 ? 5 : 4;
      };
    },
  },
  {
    name: 'הרים ואגם',
    pal: ['#8fd6ff', '#c9ecff', '#7a6fa8', '#ffffff', '#2f9a5a', '#62c47e', '#3a8fd8', '#ffd23f'],
    make(r) {
      const peaks = Array.from({ length: 3 }, (_, i) => ({ x: 0.15 + i * 0.35 + (r() - 0.5) * 0.15, h: 0.18 + r() * 0.18, w: 0.32 + r() * 0.12 }));
      const sun = { x: 0.1 + r() * 0.8, y: 0.12 + r() * 0.08 };
      return (u, v) => {
        let top = 1;
        for (const p of peaks) top = Math.min(top, p.h + (Math.abs(u - p.x) / p.w) * 0.5);
        const hills = 0.6 + Math.sin(u * 8 + 1) * 0.04;
        if (v > 0.78 + Math.sin(u * 5) * 0.02) return Math.sin(u * 40 + v * 20) > 0.85 ? 1 : 6; // lake
        if (v > hills) return Math.sin(u * 22) + Math.cos(v * 30) > 1 ? 5 : 4;
        if (v > top) return v < top + 0.06 ? 3 : 2;
        if (Math.hypot((u - sun.x) * 1.67, v - sun.y) < 0.08) return 7;
        return v < 0.25 ? 0 : 1;
      };
    },
  },
  {
    name: 'עיר בלילה',
    pal: ['#17164a', '#2e2a7a', '#fff3b0', '#ffffff', '#3b3f73', '#535aa3', '#ffd23f', '#1e1145'],
    make(r) {
      const cols = [];
      let x = 0;
      while (x < 1) {
        const w = 0.06 + r() * 0.08;
        cols.push({ x0: x, x1: x + w, top: 0.3 + r() * 0.35, tone: r() < 0.5 ? 4 : 5, seed: Math.floor(r() * 1000) });
        x += w;
      }
      const moon = { x: 0.1 + r() * 0.8, y: 0.16 };
      const stars = new Set(Array.from({ length: 40 }, () => `${Math.floor(r() * 60)}:${Math.floor(r() * 20)}`));
      return (u, v) => {
        if (v > 0.92) return 7;
        const b = cols.find((c) => u >= c.x0 && u < c.x1);
        if (b && v > b.top) {
          const wx = Math.floor(((u - b.x0) / (b.x1 - b.x0)) * 4);
          const wy = Math.floor((v - b.top) * 30);
          if (u - b.x0 > 0.008 && b.x1 - u > 0.008 && wy % 2 === 1 && (wx * 7 + wy * 13 + b.seed) % 5 < 3) return 6;
          return b.tone;
        }
        if (Math.hypot((u - moon.x) * 1.67, v - moon.y) < 0.09) return 2;
        if (stars.has(`${Math.floor(u * 60)}:${Math.floor(v * 40)}`)) return 3;
        return v < 0.4 ? 0 : 1;
      };
    },
  },
  {
    name: 'כדור פורח',
    pal: ['#6cc8ff', '#b6e8ff', '#ffffff', '#ff4d6d', '#ffd23f', '#a8693a', '#5cc45a', '#3f9b4a'],
    make(r) {
      const bx = 0.3 + r() * 0.4;
      const clouds = Array.from({ length: 3 }, () => ({ x: r(), y: 0.1 + r() * 0.35, w: 0.08 + r() * 0.06 }));
      return (u, v) => {
        const hill = 0.8 + Math.sin(u * 6 + bx * 9) * 0.05;
        if (v > hill) return v > hill + 0.08 ? 7 : 6;
        const dx = (u - bx) * 1.67;
        const dy = v - 0.36;
        if (Math.hypot(dx, dy * (dy > 0 ? 1.25 : 1)) < 0.22) return Math.floor((dx / 0.22 + 1) * 3.5) % 2 ? 3 : 4;
        if (v > 0.6 && v < 0.7 && Math.abs(u - bx) < 0.035) return 5; // basket
        if (v > 0.53 && v < 0.6 && (Math.abs(u - bx - 0.045) < 0.006 || Math.abs(u - bx + 0.045) < 0.006)) return 5;
        for (const c of clouds) if (Math.hypot((u - c.x) * 1.2, (v - c.y) * 3) < c.w) return 2;
        return v < 0.35 ? 0 : 1;
      };
    },
  },
  {
    name: 'שונית האלמוגים',
    pal: ['#2a9be0', '#1b6fb8', '#11508a', '#f2d28a', '#ff8a3d', '#ff4fa3', '#2ee59d', '#ffffff'],
    make(r) {
      const fish = Array.from({ length: 4 }, () => ({ x: 0.1 + r() * 0.8, y: 0.15 + r() * 0.45, s: 0.05 + r() * 0.04, d: r() < 0.5 ? 1 : -1 }));
      const weeds = Array.from({ length: 6 }, () => ({ x: r(), h: 0.15 + r() * 0.25 }));
      const corals = Array.from({ length: 3 }, () => ({ x: 0.1 + r() * 0.8, w: 0.06 + r() * 0.05 }));
      return (u, v) => {
        const sand = 0.84 + Math.sin(u * 7) * 0.03;
        for (const c of corals) if (Math.hypot((u - c.x) * 1.2, (v - sand) * 1.4) < c.w && v < sand + 0.02) return 5;
        if (v > sand) return 3;
        for (const w of weeds) if (Math.abs(u - w.x - Math.sin(v * 30) * 0.012) < 0.012 && v > sand - w.h) return 6;
        for (const f of fish) {
          const dx = (u - f.x) * 1.67 * f.d;
          const dy = v - f.y;
          if (Math.hypot(dx, dy * 1.8) < f.s) return Math.abs(dx - f.s * 0.4) < f.s * 0.12 ? 7 : 4;
          if (dx < -f.s * 0.8 && dx > -f.s * 1.5 && Math.abs(dy) < (-dx - f.s * 0.8) * 0.8) return 4; // tail
        }
        if (Math.sin(u * 50) * Math.cos(v * 70) > 0.97) return 7; // bubbles
        return v < 0.3 ? 0 : v < 0.6 ? 1 : 2;
      };
    },
  },
];

class PaintGame extends QuizGame {
  static id = 'paint';
  static order = 17;
  static title = 'ציור במספרים';
  static emoji = '🎨';
  static mode = 'coop';
  static reward = ['מכחול', 'מכחולים'];
  static blurb = 'משחק רגוע לכל הכיתה. כל תשובה נכונה = מכחול: על הטלפון מופיעה פינה קטנה מתוך ציור ענק, וצובעים כל משבצת בצבע של המספר שלה. ביחד חושפים ציור שלם על המסך, ואז מתחיל ציור חדש.';
  static tickMs = 1000;
  static defaults = { duration: 300 };
  static options = [];

  start() {
    const n = Math.max(1, this.room.players.size);
    // about 100 s of painting per picture for an average class
    const cells = Math.max(240, Math.min(1500, n * 58));
    this.W = Math.round(Math.sqrt((cells * 5) / 3));
    this.H = Math.round(this.W * 0.6);
    this.sceneOrder = [...SCENES.keys()].sort(() => Math.random() - 0.5);
    this.count = 0;
    this.gallery = [];
    this.newPicture();
    for (const p of this.players()) this.initPlayer(p, { cells: 0, patches: 0, perfect: 0, patch: null, paint: null, timer: null });
    this.addFeed(`🎨 ציור ראשון: ${this.scene.name}`);
  }

  stop() {
    super.stop();
    for (const p of this.players()) if (p.g) clearTimeout(p.g.timer);
  }

  newPicture() {
    const scene = SCENES[this.sceneOrder[this.count % this.sceneOrder.length]];
    const draw = scene.make(rng(Date.now() + this.count * 7919));
    this.scene = scene;
    this.pid = (this.pid || 0) + 1;
    this.px = [];
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) this.px.push(draw((x + 0.5) / this.W, (y + 0.5) / this.H));
    this.painted = new Uint8Array(this.W * this.H);
    this.reserved = new Map(); // cell -> player id
    this.remaining = this.W * this.H;
  }

  onAnswer(p, correct, rewarded) {
    return rewarded ? { note: '🖌️ קבלו מכחול!' } : {};
  }

  score(p) {
    return p.g ? p.g.cells : 0;
  }

  // a connected patch of free cells around a random free cell
  takePatch(p) {
    const free = [];
    for (let i = 0; i < this.px.length; i++) if (!this.painted[i] && !this.reserved.has(i)) free.push(i);
    if (!free.length) return [];
    const start = free[Math.floor(Math.random() * free.length)];
    const patch = [start];
    const seen = new Set(patch);
    for (let k = 0; k < patch.length && patch.length < PATCH; k++) {
      const c = patch[k];
      const x = c % this.W;
      const nb = [];
      if (x > 0) nb.push(c - 1);
      if (x < this.W - 1) nb.push(c + 1);
      if (c >= this.W) nb.push(c - this.W);
      if (c + this.W < this.px.length) nb.push(c + this.W);
      for (const q of nb.sort(() => Math.random() - 0.5)) {
        if (patch.length >= PATCH) break;
        if (seen.has(q) || this.painted[q] || this.reserved.has(q)) continue;
        seen.add(q);
        patch.push(q);
      }
    }
    for (const c of patch) this.reserved.set(c, p.id);
    return patch;
  }

  afterFeedback(p) {
    const g = p.g;
    if (!g.last || !g.last.correct) return this.nextQuestion(p);
    const cells = this.takePatch(p);
    if (!cells.length) return this.nextQuestion(p);
    // the window the phone shows: the patch plus some painted context, at least 7 x 7
    let x0 = Math.min(...cells.map((c) => c % this.W));
    let x1 = Math.max(...cells.map((c) => c % this.W));
    let y0 = Math.min(...cells.map((c) => Math.floor(c / this.W)));
    let y1 = Math.max(...cells.map((c) => Math.floor(c / this.W)));
    const grow = (a, b, min, max) => {
      while (b - a + 1 < min) {
        if (a > 0) a--;
        if (b - a + 1 < min && b < max - 1) b++;
        if (a === 0 && b === max - 1) break;
      }
      return [a, b];
    };
    [x0, x1] = grow(x0 - 1 < 0 ? 0 : x0 - 1, x1 + 1 >= this.W ? this.W - 1 : x1 + 1, 7, this.W);
    [y0, y1] = grow(y0 - 1 < 0 ? 0 : y0 - 1, y1 + 1 >= this.H ? this.H - 1 : y1 + 1, 7, this.H);
    g.patch = { pid: this.pid, cells, x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    g.phase = 'paint';
    g.timer = this.later(() => this.finish(p, []), PAINT_MS + 1500);
  }

  action(p, type, data) {
    if (type === 'paint' && p.g.phase === 'paint') this.finish(p, Array.isArray(data.cells) ? data.cells : []);
  }

  // cells: [[cell, color], …] - only cells of this player's patch painted in the right color count
  finish(p, list) {
    const g = p.g;
    if (this.over || g.phase !== 'paint') return;
    clearTimeout(g.timer);
    const patch = g.patch;
    const mine = new Set(patch.cells);
    let good = 0;
    if (patch.pid === this.pid) {
      for (const item of list.slice(0, PATCH * 2)) {
        if (!Array.isArray(item)) continue;
        const [c, color] = item;
        if (!Number.isInteger(c) || !mine.has(c) || this.painted[c] || color !== this.px[c]) continue;
        this.painted[c] = 1;
        this.remaining--;
        good++;
      }
      for (const c of patch.cells) if (this.reserved.get(c) === p.id) this.reserved.delete(c);
    }
    const perfect = good === patch.cells.length;
    g.cells += good;
    g.patches++;
    if (perfect) g.perfect++;
    g.paint = { good, of: patch.cells.length, perfect };
    g.phase = 'painted';
    this.lastPainter = { name: p.name, at: patch.cells[0], good };
    this.room.pushPlayer(p);
    this.room.scheduleHostPush();
    if (this.remaining <= 0) this.complete();
    this.later(() => {
      if (g.phase !== 'painted') return;
      this.turnDone(p);
      this.room.pushPlayer(p);
    }, 1300);
  }

  complete() {
    this.count++;
    this.gallery.push({ id: this.pid, name: this.scene.name, w: this.W, h: this.H, pal: this.scene.pal, px: this.px.join('') });
    if (this.gallery.length > 4) this.gallery.shift();
    this.addFeed(`🖼️ הציור "${this.scene.name}" הושלם!`);
    this.newPicture();
    this.addFeed(`🎨 ציור חדש: ${this.scene.name}`);
  }

  top() {
    return this.players()
      .filter((p) => p.g)
      .map((p) => ({ name: p.name, cells: p.g.cells }))
      .sort((a, b) => b.cells - a.cells);
  }

  publicState() {
    const rs = {};
    for (const [c, pid] of this.reserved) {
      const p = this.room.players.get(pid);
      const n = p ? p.name : '';
      (rs[n] = rs[n] || []).push(c);
    }
    return {
      kind: 'paint',
      pic: { id: this.pid, name: this.scene.name, w: this.W, h: this.H, pal: this.scene.pal, px: this.px.join(''), done: Array.prototype.join.call(this.painted, '') },
      rs,
      count: this.count,
      pct: Math.round((1 - this.remaining / this.px.length) * 100),
      gallery: this.gallery,
      last: this.lastPainter || null,
      top: this.top().slice(0, 5),
      feed: this.feed,
    };
  }

  personal(p) {
    const g = p.g;
    const out = { ...this.baseView(p), cells: g.cells, pct: Math.round((1 - this.remaining / this.px.length) * 100), picName: this.scene.name };
    if (g.phase === 'paint') {
      const { x0, y0, w, h, cells } = g.patch;
      const win = [];
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
        const c = y * this.W + x;
        win.push(this.painted[c] ? 1 : 0);
      }
      out.patch = { x0, y0, w, h, W: this.W, cells, pal: this.scene.pal, px: cells.map((c) => this.px[c]), win, winPx: win.map((_, i) => this.px[(y0 + Math.floor(i / w)) * this.W + x0 + (i % w)]) };
    }
    if (g.phase === 'painted') out.paint = g.paint;
    return out;
  }

  results() {
    const stats = new Map(this.players().map((p) => [p.name, p.g]));
    return {
      kind: 'paint',
      count: this.count,
      pct: Math.round((1 - this.remaining / this.px.length) * 100),
      gallery: this.gallery,
      current: { name: this.scene.name, w: this.W, h: this.H, pal: this.scene.pal, px: this.px.join(''), done: Array.prototype.join.call(this.painted, '') },
      players: this.top().map((t) => ({ ...t, perfect: stats.get(t.name).perfect, correct: stats.get(t.name).correct })),
    };
  }
}

module.exports = PaintGame;
