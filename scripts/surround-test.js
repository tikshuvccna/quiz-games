// Color Kingdoms in "surround" mode, no server needed: the rules on a tiny hand-made board.
const T = require('../server/games/territory');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

const mk = (cols, rows, grid) => {
  const room = { settings: { capture: 'surround' }, players: new Map(), teams: () => [{}, {}] };
  const g = new T(room);
  g.surround = true;
  g.cols = cols;
  g.rows = rows;
  g.cells = grid.flat();
  g.lvl = g.cells.map((c) => (c < 0 ? 0 : 1));
  g.castles = [];
  g.castleSet = new Set();
  g.teams = [{}, {}];
  g.feed = [];
  g.recount();
  return g;
};
const P = (team) => ({ team, name: 'x', g: { captured: 0, flags: 0 } });

// team 1's lone tile at the right edge, team 0 holds the rest of its neighbours except one
let g = mk(3, 3, [[-1, 0, -1], [0, 1, -1], [-1, 0, -1]]);
ok(g.tileAction(0, 4) === null, 'an enemy tile cannot be attacked directly');
ok(g.tileAction(0, 0) === 'c', 'a free tile next to your land can be taken');
const p = P(0);
g.cells[5] = 0; // team 0 takes the last free neighbour
g.sweep(p, 5);
ok(g.cells[4] === 0, 'a tile with no free neighbours left is encircled and captured');
ok(p.g.captured === 1, 'the capture is counted');

// a free tile still next to the group means no capture
g = mk(3, 3, [[-1, 0, -1], [0, 1, -1], [-1, -1, -1]]);
g.cells[3] = 0;
g.sweep(P(0), 3);
ok(g.cells[4] === 1, 'a group that still has a free neighbour survives');

// a two-tile group is captured together
g = mk(4, 3, [[-1, 0, 0, -1], [0, 1, 1, 0], [-1, 0, 0, -1]]);
const r = P(0);
g.sweep(r, 9);
ok(g.cells[5] === 0 && g.cells[6] === 0 && r.g.captured === 2, 'a fully encircled two-tile group is captured together');

// direct-attack mode is unchanged
g = mk(3, 3, [[-1, 0, -1], [0, 1, -1], [-1, 0, -1]]);
g.surround = false;
ok(g.tileAction(0, 4) === 'a', 'attack mode still allows a direct attack');

console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
