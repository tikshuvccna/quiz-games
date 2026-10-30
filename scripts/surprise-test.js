// The classic quiz's 🎁 surprises (steal, swap, double), no server needed: node scripts/surprise-test.js
const Classic = require('../server/games/classic');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

function mk(scores, opts = {}) {
  const players = new Map();
  scores.forEach((sc, i) => players.set('p' + i, { id: 'p' + i, name: 'N' + i, connected: true, g: { score: sc, rank: 0 } }));
  const g = Object.create(Classic.prototype);
  g.room = { settings: { surprise: opts.surprise || 'often', style: opts.style || 'speed' }, players };
  g.list = [{ type: 'quiz', points: 1 }, { type: opts.nextType || 'quiz', points: opts.nextPoints === undefined ? 1 : opts.nextPoints }, { type: 'quiz', points: 1 }];
  g.i = 0;
  g.inBonus = false;
  return g;
}
// make the chances and the picks follow a script
const rig = (vals) => { let k = 0; Math.random = () => (k < vals.length ? vals[k++] : 0); };
const real = Math.random;
const total = (g) => [...g.room.players.values()].reduce((s, p) => s + p.g.score, 0);

// off / learning / bonus: nothing happens
for (const [label, g] of [['off', mk([900, 500, 100], { surprise: 'off' })], ['learning style', mk([900, 500, 100], { style: 'learn' })]]) {
  rig([0]);
  ok(g.maybeSurprise() === null, `no surprise when ${label}`);
}
let g = mk([900, 500, 100]);
g.inBonus = true;
rig([0]);
ok(g.maybeSurprise() === null, 'no surprise in the second-chance round');
g = mk([900, 500, 100]);
rig([0.99]);
ok(g.maybeSurprise() === null, 'the chance can miss');

// steal: kinds are [steal, swap, double]; pick 0 = steal
g = mk([1000, 500, 200, 100]);
const before = total(g);
rig([0, 0, 0]);
let s = g.maybeSurprise();
ok(s && s.k === 'steal', 'a steal happens', s);
ok(total(g) === before, 'steal moves points, it does not create or destroy them');
ok(g.room.players.get('p0').g.score === 900, 'the leader lost 100 (10%, at least 100)');
ok(Object.keys(s.for).length === 2 && s.for.p0.includes('גנב'), 'both sides get their own message');
ok(g.room.players.get('p0').g.score < 1000 && [...g.room.players.values()].some((p, i) => i > 0 && p.g.score > [500, 200, 100][i - 1]), 'a lower player gained');

// swap: pick 1 of 3 kinds -> 0.4
g = mk([1000, 600, 300, 100]);
const t2 = total(g);
rig([0, 0.4, 0, 0]);
s = g.maybeSurprise();
ok(s && s.k === 'swap', 'a swap happens', s);
ok(total(g) === t2, 'a swap keeps the total');
const sc = [...g.room.players.values()].map((p) => p.g.score);
ok(sc[0] !== 1000 && sc.includes(1000), 'the leader traded places with someone from the bottom half', sc);

// two players: only a double is possible
g = mk([500, 400]);
rig([0, 0]);
s = g.maybeSurprise();
ok(s && s.k === 'double' && g.dbl === true, 'with two players only the double can happen');

// double needs a scored next question that is worth something
g = mk([500, 400], { nextType: 'poll' });
rig([0, 0]);
ok(g.maybeSurprise() === null, 'no double when the next step is a poll');
g = mk([500, 400], { nextPoints: 0 });
rig([0, 0]);
ok(g.maybeSurprise() === null, 'no double when the next question is worth nothing');
g = mk([500, 400, 300], { style: 'accuracy' });
rig([0, 0.99, 0.99]);
s = g.maybeSurprise();
ok(!s || s.k !== 'double', 'no double in the accuracy style');

// double applies to the next question: its splash and its points
g = mk([500, 400]);
g.dbl = true;
g.cur = { q: { type: 'quiz', points: 1 }, dbl: true };
g.questionTime = () => 20;
ok(g.points({ type: 'quiz', points: 1 }, 0, 0) === 2000 * 1, 'a doubled question is worth twice the points (1000 -> 2000)');
g.cur.dbl = false;
ok(g.points({ type: 'quiz', points: 1 }, 0, 0) === 1000, 'and normal again after it');
ok(g.readyDelay({ points: 1 }) === (g.cur.dbl ? 1 : g.readyDelay({ points: 1 })), 'readyDelay does not crash');

// team talk: the pause before the answers open only exists for team quizzes that turned it on
const tt = (teamtalk, teams) => { const x = Object.create(Classic.prototype); x.room = { settings: { teamtalk }, teamCount: () => teams }; x.cur = null; return x; };
ok(tt('on', 2).readyDelay({ points: 1 }) === 3500 + 8000, 'team talk adds 8 seconds in a team quiz');
ok(tt('on', 0).readyDelay({ points: 1 }) === 3500, 'no team talk when nobody is in a team');
ok(tt('off', 3).readyDelay({ points: 1 }) === 3500, 'no team talk when it is off');
ok(tt('on', 2).readyDelay({ points: 2 }) === 3500 + 2200 + 8000, 'it adds to the x2 splash too');

Math.random = real;
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
