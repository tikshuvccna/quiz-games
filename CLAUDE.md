# Quiz Games: notes for Claude

Hebrew (RTL) live classroom game platform in the spirit of Kahoot's game modes. Node + Express + Socket.IO, plain JS and CSS front end (no build step), LAN only.

**Start here: read `PROJECT_SUMMARY.md`.** It has the status, the code map, how to add a game, the test commands and the roadmap (the next step is Phase D: new games). Keep it updated when something ships.

## Working with this user
- They chat in English. Everything shown to players and teachers is in Hebrew.
- Visual quality matters a lot. A "prototype" look was rejected before. Use the design system in `public/css/style.css`, SVG art in `public/js/art.js`, depth and shadows, and juicy animations.
- They approve big plans quickly and then expect delivery. Finish, test, and report honestly what was verified and what wasn't.
- Ask before running anything that uses their accounts. The Google Flow Music tool lives at `E:\esacpe-planner\escaperoom-design\.claude\skills\google-flow\scripts\flow_music.py`. Music prompts are in `music/music-prompts.md`.

## Conventions
- A game is `server/games/<id>.js` (extends `base.js`, or `classic.js` for host-paced quiz modes) plus `public/js/games/<id>.js`, registered in `server/room.js` (`GAMES`) and in the script tags of both `public/host.html` and `public/index.html`.
- Validate every client message on the server. Answers are graded only on the server (`server/qtypes.js`).
- Use `this.later()` instead of `setTimeout` inside games. After an action, call `this.turnDone(p)`, not `nextQuestion`.
- Phone view keys must include `you.qid + ':' + you.turn`, or repeated turns won't redraw.
- Short CSS class names can collide across games: the `.goal` class from tug once broke the penalty banner. Prefix new classes per game (`pk-`, `sb-`, `fs-`, `bm-`, `rk-`, `cl-`, `pyr-`, `ch-` shared chase parts, `sq-` sub, `lav-` lava (`lv-` is taken), `zb-` zombie …). State classes too: a bare `.play` or `.wait` on a game element picks up the phone screen's global rules.

## Testing
- Start the server: `node server/index.js` (port 3000). Then run `node scripts/smoke-test.js`, `feature-test.js`, `classic-test.js`, `pyramid-test.js` and `chase-test.js` (the co-op chase games, about 7 minutes). Newer tests: `livetypes-test.js`, `matchsort-test.js`, `players-test.js` (server running), `classes-test.js` (server running with `REPORTS_DIR` set to a temp folder), `study-test.js` and `lesson-test.js` (server running), `lesson-import-test.js` (no server), `kahoot-import-test.js`, `extension-test.js` (no server; `LIVE=1` also uses the real Kahoot), and `KICK=1 node scripts/smoke-test.js`.
- Run tests against a separate server so your library and reports stay clean: `PORT=3100 QUIZ_DIR=<temp folder> REPORTS_DIR=<temp folder> node server/index.js`, then `QG_URL=http://localhost:3100 node scripts/<test>.js`. Restart that server after changing server code.
- To restart only this server, stop the node process whose command line contains `server/index.js`. **Never kill every node.exe**: that also kills Playwright drivers, such as the music tool's.
- Visual checks use the Playwright MCP. Host at 1366×768, phone tab at 390×800. Call `bringToFront()` on the phone tab before screenshots: background tabs pause CSS animations, so elements look invisible.
- The confirm dialogs on the host ("לסיים את המשחק?") block Playwright scripts. Use `socket.emit('host:end')` through `page.evaluate` instead.
- Bash heredocs containing quotes can break. For multi-line JS or CSS, use the Write or Edit tools, or Python with plain strings.
- `reports/` fills up during bot tests. Clear the test reports when you're done (real class reports must not be mixed with them), or better, run tests with `REPORTS_DIR` pointing at a temp folder. The class progress page is built from `reports/`, so real reports there are valuable.
