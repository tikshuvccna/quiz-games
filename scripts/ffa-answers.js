// What a bot sends for a round of the mole / hoops / snake / burger / ship games (used by bots.js and smoke-test.js).
module.exports = function ffaAnswer(rd, sloppy) {
  const j = (v) => (sloppy ? v + (Math.random() - 0.5) * 0.1 : v);
  switch (rd.kind) {
    case 'mole': return { taps: rd.events.filter((e) => !e.b).map((e) => [e.h, e.t + 120]) };
    case 'hoops': return { shots: rd.shots.map((s) => [j(s.x), j(s.p)]) };
    case 'snake': return { apples: sloppy ? 5 : 9, crashed: false };
    case 'burger': return { seq: sloppy ? rd.recipe.slice(0, -1) : rd.recipe };
    case 'ship': return { kills: sloppy ? 10 : 16, lives: sloppy ? 2 : 3 };
    default: return {};
  }
};
