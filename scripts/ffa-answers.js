// What a bot sends for a round of the mole / hoops / snake / burger / ship games (used by bots.js and smoke-test.js).
// breadth-first search for the moves that solve a 3x3 sliding puzzle (the position of the tile to slide, each step)
function solve(start) {
  const goal = '1,2,3,4,5,6,7,8,0';
  const nb = (i) => { const r = Math.floor(i / 3); const c = i % 3; return [r > 0 && i - 3, r < 2 && i + 3, c > 0 && i - 1, c < 2 && i + 1].filter((x) => x !== false); };
  const seen = new Map([[start.join(','), null]]);
  let q = [start.slice()];
  while (q.length) {
    const next = [];
    for (const t of q) {
      const key = t.join(',');
      if (key === goal) {
        const moves = [];
        let k = key;
        while (seen.get(k)) { const { from, m } = seen.get(k); moves.push(m); k = from; }
        return moves.reverse();
      }
      const b = t.indexOf(0);
      for (const m of nb(b)) {
        const n = t.slice();
        [n[b], n[m]] = [n[m], n[b]];
        const nk = n.join(',');
        if (!seen.has(nk)) { seen.set(nk, { from: key, m }); next.push(n); }
      }
    }
    q = next;
  }
  return [];
}

// lights out on 3x3: try every set of presses (each square pressed 0 or 1 times) until all the lights are off
function solveLights(cells) {
  for (let m = 0; m < 512; m++) {
    const b = cells.slice();
    const taps = [];
    for (let i = 0; i < 9; i++) {
      if (!(m & (1 << i))) continue;
      taps.push(i);
      const r = Math.floor(i / 3);
      const c = i % 3;
      b[i] = !b[i];
      if (r > 0) b[i - 3] = !b[i - 3];
      if (r < 2) b[i + 3] = !b[i + 3];
      if (c > 0) b[i - 1] = !b[i - 1];
      if (c < 2) b[i + 1] = !b[i + 1];
    }
    if (!b.some(Boolean)) return taps;
  }
  return [];
}

module.exports = function ffaAnswer(rd, sloppy) {
  const j = (v) => (sloppy ? v + (Math.random() - 0.5) * 0.1 : v);
  switch (rd.kind) {
    case 'mole': return { taps: rd.events.filter((e) => !e.b).map((e) => [e.h, e.t + 120]) };
    case 'hoops': return { shots: rd.shots.map((s) => [j(s.x), j(s.p)]) };
    case 'snake': return { apples: sloppy ? 5 : 9, crashed: false };
    case 'burger': return { seq: sloppy ? rd.recipe.slice(0, -1) : rd.recipe };
    case 'ship': return { kills: sloppy ? 10 : 16, lives: sloppy ? 2 : 3 };
    case 'stroop': return { answers: rd.items.map((it) => (sloppy && Math.random() < 0.3 ? (it.c + 1) % 4 : it.c)) };
    case 'balloon': return { order: Array.from({ length: sloppy ? rd.n - 2 : rd.n }, (_, i) => i + 1) };
    case 'flappy': return { pipes: sloppy ? 4 : 8, crashed: sloppy };
    case 'runner': return { jumps: sloppy ? 5 : 10, crashed: false };
    case 'reaction': return { times: rd.delays.map(() => (sloppy ? 400 : 260)) };
    case 'slide': return { moves: sloppy ? [] : solve(rd.tiles) };
    case 'archery': return { taps: rd.targets.map((tg) => [0.5, tg.y, tg.t + Math.round(tg.ms / 2)]) };
    case 'memgrid': return { picks: sloppy ? rd.cells.slice(1) : rd.cells };
    case 'catch': return { caught: sloppy ? 8 : 14, rotten: 0 };
    case 'typing': return { typed: sloppy ? rd.words.slice(1) : rd.words };
    case 'darts': return { darts: [0, 1, 2].map(() => (sloppy ? [0.3, -0.2] : [0.02, -0.03])) };
    case 'lights': return { taps: sloppy ? [] : solveLights(rd.cells) };
    case 'mathrush': return { answers: rd.items.map((it) => it.opts.indexOf(eval(it.q.replace('×', '*')))) };
    default: return {};
  }
};
