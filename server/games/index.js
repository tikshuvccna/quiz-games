// Game registry: every server/games/<id>.js that exports a game class (with a static id) is a game.
// Adding a game = drop server/games/<id>.js + public/js/games/<id>.js (+ optional public/css/games/<id>.css).
// Order in the lobby: static `order` (lower first), then the title.
const fs = require('fs');
const path = require('path');

const SKIP = new Set(['base.js', 'chase.js', 'index.js']);
const GAMES = {};
const list = [];
for (const f of fs.readdirSync(__dirname).sort()) {
  if (!f.endsWith('.js') || SKIP.has(f)) continue;
  try {
    const G = require(path.join(__dirname, f));
    if (G && G.id && !GAMES[G.id]) {
      GAMES[G.id] = G;
      list.push(G);
    }
  } catch (e) {
    console.error(`[games] ${f} failed to load:`, e.message);
  }
}
list.sort((a, b) => (a.order ?? 500) - (b.order ?? 500) || String(a.title).localeCompare(String(b.title), 'he'));
const ordered = {};
for (const G of list) ordered[G.id] = G;

module.exports = ordered;
