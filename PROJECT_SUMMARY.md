# Quiz Games: project summary, status and roadmap

**BrainBlast · פיצוץ מוחות** (public name since 2026-10-23; the repo is public, the README is the download page). A Hebrew (RTL) live classroom game platform in the spirit of **Kahoot's game modes ("experiences")**. Students join from phones or PCs with a PIN. In each game, answering questions earns a resource or turn, which is spent in a mini-game shown on the big screen. There is also a classic Kahoot-style quiz and quiz-based team modes.

- **Runs on**: the local network (LAN) by default. An online mode (teacher sign-in, `PUBLIC_URL`, `DATA_DIR`) is built and tested locally but not tried on a real host: see `docs/DEPLOYMENT.md`. Accounts per teacher and a database come later (Phase E).
- **Language**: Hebrew UI. The chat with the user is in English.
- **Last updated**: 2026-10-30 (all Kahoot question types supported; Kahoot import and the Chrome extension for it are built). Phases A (questions) and B (classic quiz + quiz modes) are done, plus music, and ROADMAP.md items 4–8 (question media, folders and sharing, import, backgrounds). Phase D (new games) is in progress: batch 1 (5 games) and batch 2 (the co-op chase family: 3 new games plus checkpoint mini-games) shipped 2026-10-23, so there were 23 games; the study game (2026-10-30) makes 24 and the lesson game 25.

---

## 1. How to run

| What | How |
|---|---|
| Start everything | Double-click `start.bat`. It installs on the first run, opens the Windows firewall once, starts the server and opens the host screen. |
| Host (big screen) | `http://localhost:3000/host.html` |
| Players | Scan the QR on the host screen, or open `http://<PC address>:3000` and type the PIN. Phones must be on the same Wi-Fi. |
| Quiz editor | `http://localhost:3000/editor.html`, or the "✏️ עורך השאלות" button in the lobby. It only works on the host computer (by design, so students can't read the answers). |
| Reports | Saved automatically to `reports/` (one JSON per room, updated every round). Download them as CSV from the results screen ("📊 דוח שחקנים"). |
| Music | mp3 files in `music/` (all six were generated with Google Flow Music). Any mp3 dropped there appears in Room settings, and each moment can play a random song from a group (by the M1 to M7 file prefix). 38 more prompts are written in `music/music-prompts.md`; `scripts/make-music.sh` generates them with Flow Music (needs the owner's OK). |

### Tests (start the server first: `node server/index.js`)

| Command | What it checks |
|---|---|
| `node scripts/smoke-test.js [game]` | Bots play a short round of every game (50) and print the state and results. |
| `node scripts/chase-test.js [game]` | The co-op chase games (robot, sub, lava, zombie): bots race to the goal, all three checkpoint mini-games run, phones are parked and resumed, nobody gets stuck; the sub's diving mode; checkpoints switched off; junk packets are clamped. About 7 minutes. |
| `node scripts/feature-test.js` | Name modes and reroll, 3 teams, reward settings, winner text, rematch with the same PIN, the report, an individual game played in teams. 14 checks. |
| `node scripts/classic-test.js` | Classic quiz: every stage, team averages, the second-chance round for the bottom 5. |
| `node scripts/pyramid-test.js` | The Lost Pyramid (4 teams), the accuracy style and the confidence style. |
| `node scripts/extension-test.js` | The Kahoot extension's core, no browser or server needed: the manifest and its files, search, errors (private, missing, no internet, rate limit), missing pictures, the zip it builds going through the real importer. `LIVE=1` also searches the real Kahoot (Hebrew too), exports two public quizzes and imports them. |
| `node scripts/kahoot-import-test.js` | No server needed. The Kahoot converter on made-up quizzes in Kahoot's JSON shape (every type), import from raw JSON and from the extension's zip, the package round trip, pin zones (polygon, ellipse, several zones), the new types and the new spreadsheet columns. |
| `node scripts/matchsort-test.js` | Classic quiz with a match and a sort question: a perfect, a half-right and a wrong answer, partial credit, the class averages. |
| `node scripts/freeform-ai-test.js` | No server needed. Pasted text written by an AI (NotebookLM, ChatGPT…): lettered options with an "Answer:" line, markdown bullets, Hebrew letters, `Q:`/`A:` and `Front:`/`Back:` cards, "(True/False)" statements, a `*` mark. |
| `node scripts/lesson-test.js` | The lesson game with a real PDF: a PDF uploaded and served, PDF.js served offline, slides open at once, reactions live (and changeable, invalid ones ignored), PDF pages as steps, back and jump (and a bad jump ignored), a poll, a question on a PDF page with its citation, the tap race (capped, ranked, late smaller count ignored), a fun slide with a countdown, the end summary per slide and activity. |
| `node scripts/lesson-import-test.js` | No server needed. A lesson sheet with every new column and a zip with a real 4-page PDF: steps in order, a page range expanding to one step per page, the one-line "check", a question on a PDF page with a citation, a missing PDF, a page that does not exist, an unknown layout, the package round trip, a sheet without its zip, and a normal quiz sheet unchanged. |
| `node scripts/study-test.js` | The study game in all three modes: mastery (a question must be answered right twice, a wrong one comes back, 3 wrong in a row shows "stuck" on the teacher's board), flashcards ("again" brings a card back; the back shows the answer and explanation) and the test (no feedback, a summary with every mistake at the end); each closes by itself when everybody is done. |
| `node scripts/classes-test.js` | Class rosters and progress, and the learning style. Start the server with `REPORTS_DIR` pointing at a temporary folder. Class API (clean names, dedupe, edit, delete), the join check returns the class list and marks taken names, two games counted for the class (a game without the class is not), per-student accuracy and trend, a guest outside the list, the class total, removed students stay in the history, and the no-score style gives nobody points. |
| `node scripts/impostor-test.js` | The impostor game: roles, a sabotage, a meeting where the crew votes the real impostor out, the crew wins and the results name the impostor. |
| `node scripts/surround-test.js` | No server needed. The kingdoms game's surround mode on tiny boards: no direct attack, an encircled tile or group changes hands, a group with a free neighbour survives, attack mode unchanged. |
| `node scripts/online-test.js` | No setup: starts its own servers. The online mode: a missing or short password stops the server, teacher pages and the library need the sign-in (localhost does not count), the 5-tries limit, forged cookies, rooms need the cookie while students join freely, LAN mode unchanged. |
| `node scripts/presenter-test.js` | The presenter screen (server running): a wrong token is refused, notes and the next step reach the presenter and not the class, next / back / jump work, a bad jump is ignored, the end is reported. |
| `node scripts/surprise-test.js` | No server needed. The classic quiz surprises with a rigged random source: nothing when off / learning / second chance, a steal and a swap keep the total, a double needs a scored next question and is not used in the accuracy style, a doubled question scores twice. |
| `node scripts/survival-test.js` | The classic quiz's survival and final-double options (server running, takes about a minute): a wrong answer costs the only life, a knocked-out player only watches, the survivors play every question, the knocked-out player does not win, the last question is shown as ×2. |
| `node scripts/privacy-test.js` | The results-privacy option (server running): full shows the leaderboard and counts; anon has no leaderboard, no names in the lines, a class summary at the end and phones without points; none has no answer counts and no lines; the teacher's peek shows who was right and what each answered in every mode. |
| `node scripts/share-test.js` | The server's part of screen sharing (server running): only the teacher can start a share, every phone is told, the teacher learns who watches, signals go only between the teacher and that student, oversized signals are dropped, a late joiner sees a running share, only the asked student gets the request, the share ends when the teacher's page goes away. |
| `node scripts/players-test.js` | The teacher renames (typed and random) and removes players in the middle of a game; rude, taken and empty names are refused. |
| `KICK=1 node scripts/smoke-test.js` | Like the smoke test, and one player is removed from the middle of every one of the games (nothing may break). |
| `node scripts/livetypes-test.js` | Classic quiz with a multi-select poll, word cloud, free text, brainstorm with its vote, drop-a-pin, picture answers and a text slide. It saves one quiz and deletes it. |
| `node scripts/demo.js <game> 8 9999` | A room with 8 bots for visual demos. Put the printed pin and token into the browser's `sessionStorage.host`, reload `/host.html`, and press start. |
| `node scripts/bots.js <pin> [n]` | Adds n bots to an existing room (they answer every question type, including confidence). |

All suites passed on 2026-10-23 (smoke, chase, feature, classic, pyramid; freeform, import and library earlier the same day).

---

## 2. Code map

```
server/
  index.js        express + socket.io; editor REST API (/api/q/*, local only); /media, /music, /qr
  room.js         Room: PIN, lobby, teams (2-6), countdown, timer/tick, rematch, stats + report, host/player state
  games/base.js   QuizGame: the shared per-player question loop, reward charge (need/amount), turns, answer log
  games/*.js      one game per file (see 3.1); classic.js = host-paced quiz; pyramid.js extends classic
  games/chase.js  shared engine of the co-op chase games (goal, rubber-band chaser, checkpoint mini-games); robot/sub/lava/zombie extend it
  qtypes.js       question types: normalize / playable / present (phone payload) / check (server grading)
  quizzes.js      quiz library in the admin-chosen folder (config.json), media, xlsx import/export (exceljs)
  classes.js      class rosters (<library>/.library/classes.json) and class progress worked out from reports/*.json
  filter.js       bad-word filter (list in badwords.json)
  importers/kahoot.js  Kahoot quiz JSON → our quiz
  teams.js        the 6 teams (name + color)
  names.js        random funny Hebrew nicknames
public/
  index.html      phone app      → js/play.js (join, lobby, question/feedback, results)
  host.html       big screen     → js/host.js (lobby, settings, report modal) + js/music.js
  editor.html     quiz editor    → js/editor.js
  js/common.js    helpers U.* (host frame, results, podium, confetti, sound fx, fitImage…)
  progress.html   classes and progress page → js/progress.js (class lists, per-student accuracy and trend, hardest questions, CSV)
  js/question.js  QView: renders every question type on the phone
  js/art.js       hand-drawn SVG art (mascots, game objects, lobby covers)
  js/games/*.js   per-game client: hostPlaying / hostEnded / hud / playerPhase / playerEnded
  js/games/chase.js  window.Chase: shared host header + mini-map, kid figure, checkpoint mini-game overlay and phone screens (loaded first in the bundle)
  css/            style.css (design system) · games.css · games2.css · platform.css · questions.css · classic.css · pyramid.css · editor.css
extension/             Chrome/Edge extension (Manifest V3, install "unpacked"): finds Kahoot quizzes on the open page or by search, saves one zip or sends it to the running program; README.md is the install guide
  lib/kahoot-api.js     search / download / zip builder, also used by the Node test
questions/sample.json   the built-in 20-question sample quiz
quizzes/                default quiz folder (the admin can choose another in the editor)
music/                  background music + music-prompts.md (the Flow Music prompts)
reports/                per-room JSON reports
scripts/                tests, bots, demo
```

### How to add a game (the pattern every game follows)

1. **Server** `server/games/<id>.js` extends `QuizGame` (`base.js`).
   - Statics: `id`, `title`, `emoji`, `mode` (`teams` / `ffa` / `coop`), `blurb`, `tickMs`, `defaults`, `options`, `reward = ['singular', 'plural']`.
   - Optional statics: `stacks` (the reward amount adds to a resource instead of repeating turns), `noReward`, `teamCounts`, `defaultTeams`, `teamPlay: false`, `untimed`.
   - Methods:
     - `start()`: calls `initPlayer(p, extra)` for each player.
     - `onAnswer(p, correct, rewarded)`: returns `{ note }`.
     - `afterFeedback(p)`: puts the player into the action phase.
     - `action(p, type, data)`: validates everything the client sends.
     - When an action finishes, call `this.turnDone(p)`.
     - `score(p)`, `publicState()`, `personal(p)` (spread `this.baseView(p)` into it), `results()`.
     - Use `this.later()` instead of `setTimeout` (cleared when the game stops).
   - Static `order` sets its place in the lobby. There is nothing to register: `server/games/index.js` loads every file in the folder.
2. **Client** `public/js/games/<id>.js` sets `Games[id]` (served inside the `js/games-all.js` bundle, no script tag needed):
   - `hostPlaying(app, st)` uses `U.hostFrame` + `U.hostTick`.
   - `hostEnded` uses `U.hostResults`.
   - `hud(you)`.
   - `playerPhase(app, you, ctx)`: view keys must include `you.qid + ':' + you.turn` (plus any repeat counter, e.g. a bonus chain).
   - `playerEnded` uses `U.playerResult`.
   - Lobby cover: `Art.covers[id] = () => '<svg body, 160×100>'`. Shared gradients go in `Art.addDefs(id, defs)`, never inside a drawing (a drawing in a hidden lobby card breaks its gradient ids). `Art.inner(svg)` nests one drawing in another.
3. **Styles** `public/css/games/<id>.css` (served inside `css/games-all.css`), with a per-game class prefix.
4. **Bots**: teach `scripts/bots.js` and `scripts/smoke-test.js` the new phase, then run the tests and take screenshots on the host (1366×768) and a phone (390×800).

---

## 3. What exists today

### 3.1 Games (50)

| # | Game | Mode | What answering earns / the action on the phone |
|---|---|---|---|
| 1 | 🎯 חידון קלאסי | Individual or 2–4 teams (team score = average) | Kahoot classic: same question for everyone, speed + accuracy points, streaks, leaderboard with fun lines. Scoring styles: classic, accuracy only, confidence (boost or safe). Second-chance round for the bottom 5. |
| 50 | ➗ חשבון זריז (`mathrush`) | Individual | **Round game** (`FfaAction`). Eight small sums (+, -, ×; the numbers grow with the streak), three answers each; the server made them and checks them. |
| 49 | 💡 כבו את האור (`lights`) | Individual | **Round game** (`FfaAction`). Lights out on 3x3: a tap flips a square and its neighbours; the server replays the taps, so a solved board cannot be faked. |
| 48 | 🎯 חצים (`darts`) | Individual | **Round game** (`FfaAction`). Three darts: a marker sweeps across, then up and down; tap to stop each. Scored by the distance from the centre (bull 12). |
| 47 | ⌨️ מקלידים מהר (`typing`) | Individual | **Round game** (`FfaAction`). Six Hebrew words, type each; the server checks every word. |
| 46 | 🧠 זיכרון ריבועים (`memgrid`) | Individual | **Round game** (`FfaAction`). Squares light up for a moment, then tap the ones you remember (3x3, 4x4 after a streak); wrong squares cost points. |
| 45 | 🎯 קשתות (`archery`) | Individual | **Round game** (`FfaAction`). Six targets slide across the phone; tap as one passes. The server knows each target's lane and timing and judges where and when the tap landed. |
| 44 | 🔢 פאזל הזזה (`slide`) | Individual | **Round game** (`FfaAction`). The 3x3 sliding number puzzle, a few moves from solved; the server replays the moves. |
| 43 | ⚡ תגובה מהירה (`reaction`) | Individual | **Round game** (`FfaAction`). Five reaction tests: the delays are chosen by the server; a tap too early or faster than a person can react scores nothing. |
| 42 | 🏃 ריצת מכשולים (`runner`) | Individual | **Round game** (`FfaAction`). A 10-second auto-runner (tap to jump); reported by the phone and capped. |
| 41 | 🐦 ציפור מעופפת (`flappy`) | Individual | **Round game** (`FfaAction`). A 10-second flappy-bird round; reported by the phone and capped. |
| 40 | 🧺 תפוס את הפירות (`catch`) | Individual | **Round game** (`FfaAction`). A 10-second round: slide a basket under falling fruit, rotten ones cost points; reported and capped. |
| 39 | 🎈 פוצצו בלונים (`balloon`) | Individual | **Round game** (`FfaAction`). Numbered balloons float on the phone: pop them in order, 1, 2, 3… The server counts the correct run. |
| 38 | 🎨 צבעים מבלבלים (`stroop`) | Individual | **Round game** (`FfaAction`). A colour word written in another ink: tap the colour of the ink (10 words, 9 seconds). Graded on the server. |
| 37 | 🏰 מגיני הטירה | Co-op (easy / normal / hard) | **Castle tower defense.** Monsters walk a path to the castle in 8 waves (a giant one every 4th wave); the server runs the whole battle (`server/games/td.js`, 4 ticks a second) and the big screen draws it. A reward lets a player build a tower on one of 8 spots (🏹 archer: fast, 💣 cannon: slow, splash, 🔮 mage: slows) or upgrade a tower (3 levels). Survive every wave to win; the castle has 20 lives. Monster strength grows a little with the class size. Balance simulated in-process: a class of 6 building a tower every 8 to 15 seconds wins easy / normal, 25 players win all levels, hard stays tight. |
| 36 | 🧩 פאזל קבוצתי | 2–6 teams | **Team puzzle.** Each team builds its own picture (six drawn scenes) from 12 pieces. A reward gives a player one missing piece of their team's picture and 7 seconds to tap where it goes (the faint picture and the placed pieces are on the phone); a right tap places it for the whole team, a teammate who placed it first gives "already done". The first team to finish wins. Graded on the server. |
| 35 | 🔮 מרוץ גולות | Individual | **Like Kahoot's Marble Race.** Each correct answer earns a marble (2 on a streak of 3). When the time is up all the marbles race on the big screen; the server draws the finishing order with a chance in proportion to the marbles (plus a little for everyone), so the leader is not sure to win. The race plays once, then the podium by the race. |
| 34 | 🛸 ספינת חלל | Individual (free for all) | **Asteroids.** A reward is a 12-second flight in your own ship: drag on the left as a joystick (arrows and space on a computer), hold the fire button, blow up asteroids, 3 lives. The phone plays it and reports kills and lives (trusted, capped on the server). |
| 33 | 🍔 המבורגריה | Individual | **Burger orders.** A reward is an order: the layers are shown for a few seconds, then stack them in the same order (bottom bun first, top bun last); points per correct layer, a bonus for a perfect burger. Graded on the server. |
| 32 | 🐍 נחש | Individual | **Snake.** A reward is 10 seconds of snake on the phone (swipe or the arrows): apples are points, a crash ends the round. Reported by the phone and capped. |
| 31 | 🏀 סל | Individual | **Basketball.** A reward is 3 shots: stop the swinging aim over the hoop, then stop the power meter in the green zone. The hoop and the ideal power are chosen by the server for each shot and graded there (swish, basket, rim). |
| 30 | 🔨 חפרפרות | Individual | **Whack-a-mole.** A reward is an 8-second round: moles pop out of 9 holes at times the server chose, bombs among them; taps with their times are graded on the server. |
| 29 | 🏁 קארט מאחור | Individual (free for all) | **Pseudo-3D kart race.** Each reward is driving time (6 seconds per reward, plus up to 6 for a streak). The phone draws a road seen from behind the kart on a canvas (bends, cones, boost pads; hold the left or right half of the screen, or the arrow keys, to steer; leaving the road slows you). Everyone drives the same endless track (the room's seed). The phone reports the distance and the server caps it by top speed times the seconds. The big screen is a race board by distance. No other karts on the road. |
| 28 | 🥁 קצב | Individual (free for all) | **Rhythm.** A correct answer opens a short song (10 to 16 notes at 92-120 BPM): notes fall down 4 lanes on the phone and the student taps each on the beat (keys D F J K on a computer). The phone sends its taps with times; the server grades each note (perfect ±80 ms = 3, good ±140 = 2, ok ±200 = 1, a clean song +5) and keeps accuracy and best combo. Timing is reported by the phone (trusted, like the tower game). |
| 27 | 🕵️ מי המתחזה? | Co-op with a secret traitor (easy / normal / hard) | Among Us style. Everyone answers questions; the crew's right answers fill a shared task bar. 1 impostor (2 from 9 players) answers too, and each right answer lets them sabotage: drain the bar, or jam a crew member's phone for 7 seconds (the victim gets a hint: the first letter of a name, the impostor's two times out of three). At 1/3 and 2/3 of the bar the class holds a 40-second meeting and votes (or skips); a clear majority ejects a player and the role is revealed. The crew wins by filling the bar or ejecting every impostor; impostors win when they equal the crew or time runs out. Ejected players watch as ghosts. |
| 26 | 🤪 זורקים שטויות | Individual (free for all) | **Sabotage.** A correct answer = points + a prank to throw (pick the prank, then a player or 🎲 random; a streak of 3+ gives two throws; no pick in 9s = random). Pranks hit the target's phone for 14 seconds: 🙃 mirror, 🌀 spin, 🔤 scrambled letters, 🎨 inverted colors, 🛢️ oil blobs (tap to wipe), 🔃 question and answers swapped, 💥 shaking, plus 💸 stealing 15 points. A streak of 3 earns a 🛡️ that blocks one prank. Effects are `data-fx` on `<body>` (`public/css/games/prank.css`). Avoid 🪞 and 🫨: Windows 10 shows empty boxes. |
| 25 | 🎓 שיעור: הצגה ופעילויות | The teacher presents, class on phones | **Teach with a presentation and put activities in the flow.** One sequence of steps: slides (layouts: title, bullets, text + picture, full picture, quote, fun break with a countdown), PDF pages (drawn in the browser by PDF.js, offline) and any activity (check "did you understand?", poll, word cloud, free text, rating, tap race, a real question, a question on top of a PDF page with a citation). Phones show 👍 got it / 🤔 not sure / 🙋 a question during slides; the teacher sees the numbers live (a warning when a third of the class is lost), can go back, jump to any step (outline, key O), and use the keyboard (→ / space next, ← back). Default: no points (involvement); "with points" scores the checks. At the end: which slides lost people and how each activity went. Start it from the editor with ▶ הצגה. |
| 24 | 📚 תרגול ולמידה | Individual, self-paced, no points | Each student studies on their own phone: **practice until mastery** (a question returns until answered right twice; a wrong one returns soon; explanation after each answer), **flashcards** (front, flip, "knew it" / "again", again-cards return) or a **test** (no feedback, then a personal summary of the mistakes with the right answers and explanations). The teacher's board shows everyone's progress bar and who is stuck (3 wrong in a row). It closes itself when everybody is done. Only questions with a right answer; the answers are reported (progress with a class works). |
| 2 | 🔺 הפירמידה האבודה | 2–6 teams (default 4) | Like Kahoot's Lost Pyramid: 2 minutes of team discussion, vote + confidence (Maybe / Yes / Totally!), teams climb a 15-step pyramid. |
| 3 | 🏰 כובשי הממלכה | 2–4 teams | Flags: capture, attack or fortify tiles on a 3D island. Castles give bonuses. (Like Color Kingdoms.) Game option: enemy tiles are taken by direct attack (default) or by **surrounding** them, Go style: a group with no free tile beside it changes hands, a castle inside gives a bonus flag. |
| 4 | 💪 מלחמת חבל | 2 teams | A 3-second tap-as-fast-as-you-can pull. |
| 5 | ⚽ פנדלים | 2–4 teams | Pick a corner of the goal and beat the keeper. A 3-streak gives a power shot. |
| 6 | ☃️ קרב כדורי שלג | 2 teams | Angry-Birds-style slingshot. The physics is computed on the server. |
| 7 | 💎 מרדף היהלומים | Individual or teams | A 7-second catch-the-treasure round. (Like Treasure Trove.) |
| 8 | 🏎️ מירוץ הקארטים | Individual or teams | Speed boost, then dodge into the open lane. |
| 9 | 🟩 סוגרי שטחים | Individual or teams | D-pad steps: draw a loop and close it to claim land (Paper.io-style). You can cut other players' trails. |
| 10 | 🏗️ מגדל השמיים | Individual or teams | A swinging crane block: drop it centered to stack floors. |
| 11 | 🎣 דייגים | Individual or teams | Hold to reel and keep the fish in the green zone. Rarer fish fight harder. |
| 12 | 💣 הפצצה המתקתקת | Individual or teams | Hot potato: hidden-fuse bombs, throw them at someone before they explode. |
| 13 | ☄️ מגני כדור הארץ | Co-op | Laser shots at falling asteroids, with waves and a boss. |
| 14 | 🐉 קרב הדרקון | Co-op | A sword-timing meter against a boss that attacks the class. |
| 15 | 🚀 טיל לירח | Co-op | A Simon memory sequence fuels the class rocket to the moon. |
| 16 | 🤖 בורחים מהרובוט | Co-op (easy / normal / hard) | Like Kahoot's Robot Run. Hold-to-sprint: let go before the engine overheats. A rubber-band robot chases the class and zaps it back when it catches up; wrong answers speed it up. Reach the exit door. Checkpoint mini-games at 25/50/75% (see below). |
| 17 | 🎨 ציור במספרים | Co-op | Like Chill Art. A paintbrush = a patch of about 10 squares of a big paint-by-numbers picture: pick a color, drag over its squares. Pictures are generated (5 seeded scenes), the grid grows with the class, finished pictures go to a gallery. |
| 18 | 🎡 גלגל המזל | Individual or teams | Spin a 12-segment wheel: points, ×2, 1000 jackpot, steal from / swap with the player just above you, or lose half. The server picks the segment; the phone animates it. |
| 19 | 🃏 זיכרון זוגות | 2–4 teams | One shared 6×4 board (same layout on the host and the phones). Flip two cards; a pair goes to your team and earns another flip (up to 3). A cleared board deals a new one. |
| 20 | 🚢 קרב ספינות | 2 teams | Battleship on 8×8 seas with hidden fleets. Aim and fire from the phone; a hit earns another shot (up to 2). Points for hits, sinking ships and destroying a fleet (a new fleet then sails in). |
| 21 | 🐟 צוללת ההצלה | Co-op (easy / normal / hard) | Like Kahoot's Submarine Squad. A 6-second steering run: drag the sub up and down past mines and grab pearls. Every metre charges the sonar; a full sonar = 15 seconds of diving mode (everything ×2, the anglerfish falls behind). |
| 22 | 🌋 הרצפה היא לבה | Co-op (easy / normal / hard) | Climb out of a volcano before the lava. Five rows of stones: tap a cool one on each row before the lava reaches your feet; a hot stone crumbles and ends the climb. Graded on the server. |
| 23 | 🧟 בורחים מהזומבים | Co-op (easy / normal / hard) | Run to the safe house ahead of silly zombies. Five obstacles: swipe up (jump), down (slide) or left / right (dodge); arrow keys on a computer. Graded on the server. |

**Round games (28, 30–34, 38–50)** share `server/games/ffa.js` (`FfaAction`: a reward opens a round, the subclass makes it with `makeRound` and grades the phone's report with `grade`) and `public/js/games/ffa.js` (`FfaBoard.make`: the host ranking, the phone's round and result screens). A new round game is a ~40-line server file plus a client `play(app, you, ctx, done)`; teach `scripts/ffa-answers.js` its bot answer. Rhythm (28) and kart (29) predate it.

**Chase games (16, 21–23)** share `server/games/chase.js`. At 25%, 50% and 75% of the way the whole class stops for a checkpoint mini-game (rotating): ⚡ mash (tap as fast as you can), 🔐 door code (type the code shown only on the big screen), ✨ pop (tap the sparks). The class average sets the bonus (up to 3 stars, a jump forward and the chaser pushed back). Phones are parked during it and resume exactly where they were. Each game themes the three (robot: jam the robot, sub: turbo propeller, lava: cool the lava, zombie: build a barricade). The room option "מיני-משחק בנקודות הציון" turns them off. None start in the last 30 seconds.

### 3.2 Platform

- **Joining**
  - PIN, QR or link, in two steps: the PIN first, then a nickname only if the room asks for typed names.
  - A player who reconnects keeps their seat. A phone that drops in the lobby gets 20 seconds to come back.
- **Name modes**
  - Free typing.
  - Random funny name with 3 rerolls.
  - Random fixed name.
- **Teams**: up to 6 (הנמרים, הכרישים, הנשרים, הצפרדעים, הינשופים, הדולפינים), each with an SVG mascot. Every individual game can also be played in 2–4 teams, with live team totals.
- **Reward settings, for every game**
  - Correct answers per turn: 1, 2, 3 or 5.
  - Turns or resource per reward: 1, 2 or 3.
  - A question's points multiplier (×0 to ×4) also charges turns faster.
- **Lobby**
  - Quiz picker, game cards with filter tabs (all, teams, individual, co-op), and per-game settings.
  - A Room settings tab: name mode, 24 scenes (6 static gradients and 18 animated ones drawn in code, `scenes.js` + `scenes.css` + `scenes2.css`), plus the teacher's own pictures and videos from the `backgrounds` folder, a YouTube video while players wait, winner text, and music.
- **Game flow**: 3-2-1 countdown, live toast feed, results with animated podium and confetti, and custom winner text on the winners' phones and the results screen.
- **Rematch**: "סיבוב נוסף" keeps the same PIN and players, and phones return to the lobby automatically.
- **Stats and report**
  - Every answer is logged: question, chosen answer, correct answer, right or wrong, time.
  - Points and rank are kept per player per round.
  - A report window with expandable answers, CSV export (Excel-safe Hebrew), and a JSON copy in `reports/`.
- **Music**: per moment (lobby, game, between questions, victory), with on/off, volume, fades and a 🎵 mute button. It plays on the big screen only. The classic quiz switches tracks by stage.
- **Robustness**
  - All socket input is validated, and a bad packet can't crash the server.
  - A host page opened twice shows a take-back button.
  - Files are served with `no-cache` revalidation, so updates always show up.

### 3.3 Questions

- **Quiz library**
  - The admin picks any folder (📁 in the editor; saved in `config.json`), and each quiz is `<id>.json` there.
  - Pictures go in `<folder>/media/<id>/`. Deleted quizzes move to `<folder>/.trash`.
- **Editor**
  - Kahoot-style, with autosave.
  - Add, duplicate, reorder and delete questions.
  - Images: drag, paste (Ctrl+V) or click.
  - Warnings for anything that isn't ready.
- **Types**
  - Quiz: 2–6 answers, multi-select.
  - True/false.
  - Typed answer: several spellings; case, spaces, punctuation and vowel marks are ignored.
  - Slider: range, step and tolerance.
  - Order (Kahoot calls it "puzzle"; our own "puzzle" is the jigsaw).
  - Pin on an image: a circle, rectangle, ellipse or polygon zone, and several zones that all count.
  - **Match** (`match`: connect each item to its partner, 2-6 pairs) and **sort** (`sort`: put items in 2-3 groups, up to 8 items). Both are scored in every game; the classic quiz gives partial credit like the jigsaw (half or more right = part of the points).
  - Pictures as answers (quiz and poll): an answer can be a picture, with or without text.
  - Live types, **classic quiz only**, nothing graded: poll (also multi-select), word cloud (`cloud`), free text (`open`, sticky notes), brainstorm (`brain`: ideas, then a 30-second vote for up to 3 ideas, then a ranking), drop-a-pin (`drop`: everyone drops a pin, the big screen shows all of them).
  - Info slide with a title, body text, a picture or a YouTube video.
  - Also live: 5-star / 1–7 / 1–10 **rating** (`rate`, distribution and average), **ranking** of 2-6 items (`rank`, combined ranking), and **Q&A** (`qna`: students send questions, everyone upvotes up to 3, ranked list; same flow as the brainstorm).
  - **Word filter** (`server/filter.js`, list in `server/badwords.json`, room setting 🛡️ on by default): refuses rude nicknames at join and drops rude words from free text, clouds, ideas, questions and typed answers on the big screen (the host sees how many were hidden). Hebrew + English, undoes spacing, symbols, repeated letters, final letters and number swaps; an `allow` list covers innocent words that contain a listed one.
  - The teacher can also hide a word, note or idea from the big screen with a click (client only).
  - **Classes and progress** (`server/classes.js`, `progress.html`): the teacher makes a class (a list of names, up to 60) and picks it under "👥 כיתה" in the room settings. On the join screen students then tap their own name from the list (taken names are greyed; "השם שלי לא ברשימה" lets a guest type one), so a student keeps the same name in every game. Each finished game's report records the class, and the progress page shows, per class: games played, class accuracy, a table of students (games, answers, accuracy bar, accuracy trend per game, last game), the hardest questions (asked 3 times or more) and the latest games, with a CSV download. Students removed from the list, and guests, stay in the history marked as guests. Reports come from the `reports/` folder (`REPORTS_DIR` overrides it), so they are the real class reports: do not clear that folder.
  - **Learning style** (classic quiz, scoring style "למידה: בלי ניקוד ובלי לוח מובילים"): everyone answers, sees the right answer and the explanation, and there are no points, ranks, leaderboard or second-chance round. The end screen is a class summary (% right) instead of a podium; right and wrong answers are still counted for the report.
  - **Surprises** (classic quiz option "🎁 הפתעות בלוח המובילים", off by default; `ClassicGame.maybeSurprise`): at the leaderboard, with a 25% (sometimes) or 50% (often) chance, one of: 🦹 a random player from the bottom half steals 10% (at least 100) from the leader, 🔄 one of the top three swaps scores with someone from the bottom half, or 🎁 the next scored question counts double (shown as a bigger multiplier, scoring ×2; not in the accuracy style). Never in the learning style, the second-chance round or other quiz modes. The big screen shows a banner, the affected phones get a note. `scripts/surprise-test.js` (no server).
  - **Survival and a final double** (classic quiz options "הישרדות" and "השאלה האחרונה"): with lives (3, or 1 = one mistake and out) a wrong or missing answer on a scored question costs a life; a player with none left only watches, those still in the game rank above those who are out, and the game ends early when one player is left. "The last question counts double" shows the ×2 splash and doubles its points. Classic quiz only. `scripts/survival-test.js` (server running).
  - **Team talk** (classic quiz option "דיון בקבוצה לפני התשובה", teams only): a team quiz shows the question for 8 more seconds, with a "💬 דברו בקבוצה" banner on the big screen and phones, before the answers open. **Game search** in the lobby: a box next to the filter tabs filters the 50 game cards by title.
  - **Question themes** (`public/css/themes.css`, generated from a table of 7 themes: candy, ocean, forest, sunset, mono, neon, space; `data-qtheme` on `<html>`): they recolour the answers (phone `.ans`, big screen `.cl-ans`) and the question card. Chosen per room in Room settings (🖌️), with a per-quiz default in the editor header (🖌️ select, saved as `theme`, applied when the quiz is chosen unless the room already picked one).
  - **What the class sees of the results** (classic quiz and lesson option "מה הכיתה רואה בתוצאות", `ClassicGame.privacy`): `full` (names, points, leaderboard: as always), `anon` (class statistics only: how many answered, how many were right, what the answers were, no names, points, ranks or leaderboard; the end screen is a class summary) or `none` (no statistics either: not even the answer counts, only the right answer and the explanation). Phones keep each student's own right / wrong and hide points and rank. The teacher always sees everything: the "👁️ תוצאות (למורה)" button on the big screen opens a private table (who answered what, right or wrong, points; `host:peek`), and the presenter screen has "👁️ תוצאות מלאות" for the lesson, so nothing needs to be projected. **A single step can differ from the room**: the editor has "👁️ מה הכיתה רואה בתוצאות" per question or activity (stored as `privacy`; the Excel/lesson sheet has an optional `Privacy` column with `full`, `anon` or `none`), and the end screen follows the room setting. The server still scores and the report keeps every answer. `scripts/privacy-test.js` (server running).
  - **Screen sharing** (`public/js/share.js`, `css/share.css`; the server only relays the WebRTC handshake: `share:*` events in `server/index.js`, `Room.share`): the strip on the right of the teacher's page has 📺 (share the teacher's screen: every phone shows it full screen, with a ✕ to hide it and a pill to come back) and 🎥 (ask one student to share). A student gets a prompt with "💻 שיתוף מסך" (computers: `getDisplayMedia`) and "📷 שיתוף מצלמה" (phones: the back camera, like a document camera); the stream arrives in a window on the teacher's page, which can show it to the whole class ("📺 הציגו לכל הכיתה") or end it. The teacher's picture is capped at 1.5 / 0.8 / 0.45 Mbit per viewer depending on how many watch (a classroom Wi-Fi is shared). **Where it works:** the teacher sharing needs nothing special (the teacher's page is `localhost`, a secure context) and phones only watch; a student sharing needs a **secure context**, so on a plain `http://192.168…` address it says "not available" to the student and the teacher gets a note: it works online (https) or on the local network when the server runs with `SSL_KEY` and `SSL_CERT` (see `docs/DEPLOYMENT.md`). Phones cannot share their screen (no browser supports it), only the camera. Checked in a browser with canvas streams standing in for screens (teacher to phone, student to teacher, teacher re-sharing a student's stream to a second phone); not tried with a real screen, real phones or a full class. `scripts/share-test.js` (server running) checks the relay rules.
  - **Presenter screen** (`public/presenter.html`, `js/presenter.js`, `Room.presenterState`, `LessonGame.presenterState`): in a lesson, the big screen's bar has 📱 מסך מציג, which shows a QR code and a link (`/presenter.html?pin=…&t=<host token>`) for the teacher's own phone or laptop. It shows the current step with its notes, the next step with its notes, the class's 👍 🤔 🙋 live (a warning when a third is lost), a jump list, and big הבא / קודם buttons (keys too). The socket events are `presenter:join` (needs the host token; online it also needs the teacher sign-in) and `presenter:cmd`. The notes are not in the students' or the big screen's state. The link controls the lesson: do not share it with students.
  - **Lessons** (`server/games/lesson.js` extends the classic quiz; `public/js/slides.js` draws slides and PDF pages): a quiz becomes a lesson when it has slide / pdf steps. Slide fields: `layout`, `bullets`, `body`, `timer`, `notes` (teacher notes: shown only on the presenter screen, never to the class). PDF pages: a `pdf` step per page, or a `pdf: { file, page }` on any question (the page beside the question). Questions can carry a citation (`source`). New types: `pdf`, `tap` (tap race, capped at 14 taps a second). PDFs are stored in the quiz's media folder and travel in packages. PDF.js is served from `node_modules/pdfjs-dist` (`/vendor/pdfjs`), so `npm install` must have run.
  - **Lesson file** (what Claude builds): an Excel sheet, one row per step, plus a zip with `images/` and `pdf/`. New columns: Layout, Bullets, Pdf (`file.pdf`, `file.pdf:3`, `file.pdf:3-7`), Timer, Notes, Source; new Types: `slide`, `pdf`, `check` (a poll with הבנתי / בערך / לא הבנתי), `tap`. A plain quiz sheet is unchanged. The Claude Project instructions now start by asking the teacher what to build (quiz / slides only / slides + checks / slides + light involvement / mixed with fun / study set), then the material, how often an activity comes, pictures, videos and Flow (only in Claude Code, only with permission). `.claude/skills/build-lesson/SKILL.md` is the Claude Code version.
  - **Accessibility** (`public/js/a11y.js`, ♿ button on every phone and on the big screen, kept per device): text size (normal / large / extra large), high contrast, calm (no animations), and read-aloud of the question and answers (🔊 on each question, or automatic; on the big screen it reads each question when it opens). Reading aloud uses the browser's speech and needs a Hebrew voice on the device (the panel says when there is none). Not yet tried on a real phone.
  - **Study guide and flashcards** (`print.html?quiz=<id>`, 🖨️ in the editor): a printable study guide (slides become headings, PDF pages are drawn in, every question with its answer, explanation and citation; answers can be hidden for a student copy), flashcards 8 to a page with the backs lined up for double-sided printing, and `/api/q/quizzes/<id>/cards.csv` (Front, Back, Explanation) for Anki / Quizlet.
  - **Classroom-style tools** on the progress page: a **gradebook** CSV (a row per student, a column per game, accuracy %, average), **roster import** from an Excel / CSV / text file (a header row such as "שם" or "First Name, Last Name" is understood; duplicates get the last initial; long names are shortened to fit a phone button), and a **private note per student**.
  - **Pasted AI output**: the free-text import now also reads `Q:`/`A:` and `Front:`/`Back:` cards, markdown bullets before options and "(True/False)" statements with an answer line.
  - **Join zoom**: the small "join now" box in a game's header, and a 🔍 next to the code in the lobby, open a full-screen view with a huge code, a big QR and the link (in the lobby also the room's video beside them). Esc or a click closes it and the game goes on underneath.
  - **Player photo**: two buttons on the phone, "📷 מצלמה" (opens the camera) and "🖼️ מהגלריה" (the phone's own gallery / files picker). Not yet tried on a real iPhone or Android.
  - **Nonsense on the screen** (`public/js/silly.js`, `css/silly.css`, room setting 🤪 "שטויות על המסך", off by default): while a game runs, a random fun event splashes over the big screen every 14-32 seconds (a hopping animal, emoji rain, a big word, paint splats, peeking eyes, the screen wobbling or spinning, a rocket), and after a classic question closes. Decoration only, never takes clicks; skipped on a screen set to "calm". Do not test it in a browser profile that has the accessibility "calm" setting saved: animations are off there.
  - **Players panel** (👥 in every game's header): rename a player (typed, or 🎲 random), or remove them from the game. The score stays on a rename; removal works in all games.
- **Per question**: time limit (5–240 seconds), points (none, ×1, ×2, ×3, ×4), image reveal (blur that clears).
- **Excel**: import Kahoot's spreadsheet template (or ours), download a blank template, export any quiz. Our extra columns: Type, Points, Image, Video, Reveal, Accept, Slider, Items, Pin, Puzzle, Explanation, AfterImage, AnsImages, Limit, Body, Scale, Privacy (match uses Items as `a=b|c=d`, sort as `Name:item,item|Name:item,item`; the Claude Project instructions in `docs/CLAUDE_PROJECT_INSTRUCTIONS.md` describe them).
- **Kahoot import** (`server/importers/kahoot.js`, called from `server/library.js` `importAny`)
  - The **extension** (`extension/`) makes the input: click its ★ icon → a tab with "📄 on this page" (finds every quiz linked on the open Kahoot page) and "🔎 search" (Kahoot's public search, Hebrew too, paging, up to 100 quizzes at once) → **⬇ save as file** (a zip for ⬆ ייבוא קובץ) or **📤 send** straight to the program's address (Chrome asks once for access). It downloads the quiz JSON and the pictures politely (one quiz at a time, 4 pictures in parallel, retries) and does no conversion: the program does it, so a change in Kahoot's format is fixed on our side only.
  - Input: the JSON of a Kahoot quiz (`create.kahoot.it/rest/kahoots/<uuid>`) plus its pictures. Either a raw `.json`, or a `.zip` with `manifest.json` `{ app: 'kahoot-export' }`, the quiz `.json` files and the pictures as `images/<picture id>.<ext>` (the id is the last part of `media.kahoot.it/<id>`).
  - One quiz becomes a quiz; several go into a new "Kahoot" folder. The original author, URL, language and tags are kept in the quiz's `source` and survive editing.
  - Type map: quiz → quiz (a 2-answer TRUE_FALSE layout → tf); multiple_select_quiz → quiz with several right answers; open_ended → type; jumble → order; slider → slider (tolerance is a share of the range); pin_it → pin; drop_pin → drop; survey / multiple_select_poll → poll; word_cloud → cloud; feedback → open; brainstorming → brain; content → slide. Texts lose their HTML. GRIDREVEAL → tiles reveal. YouTube videos come along; a video uploaded to Kahoot does not.
  - Not imported: the picture crop Kahoot applies on screen, Kahoot's layouts, music and themes.
  - Checked on 40 real public quizzes (789 questions, all 13 Kahoot types seen) and a zip with 41 real pictures.
- **Grading**: all grading happens on the server.

### 3.4 Kahoot experiences: how each maps here

| Kahoot experience | Status here |
|---|---|
| Classic | ✅ חידון קלאסי |
| Accuracy | ✅ classic → scoring style "דיוק בלבד" (+ unlimited time option) |
| Confidence | ✅ classic → scoring style "ביטחון" |
| Team (personal devices) | ✅ classic / pyramid / team games. The 5-second "team talk" pause is still to do. |
| Team (shared devices: one phone per team) | ⏳ planned |
| Color Kingdoms | ✅ כובשי הממלכה |
| Treasure Trove | ✅ מרדף היהלומים |
| The Lost Pyramid | ✅ הפירמידה האבודה |
| Tallest Tower (teams complete floors) | 🟡 מגדל השמיים exists (individual or teams); ⏳ a team-floors version |
| Robot Run (co-op escape, hold-to-boost, mini-games) | ✅ בורחים מהרובוט, with checkpoint mini-games |
| Submarine Squad (co-op, hold to speed up, "diving mode") | ✅ צוללת ההצלה (steer past mines; sonar → diving mode) |
| Chill Art (co-op paint-by-numbers reveals a picture) | ✅ ציור במספרים |
| Cosmic Quest (space navigation, collect stars) | ⏳ Phase D |
| Marble Race (correct = marble, luck race at the end) | ✅ מרוץ גולות |
| Unplugged (no devices; Team Tiles) | ⏳ planned |
| Professional / Lecture | 🟡 classic quiz supports info slides and polls |

---

## 4. Roadmap

Agreed order: A ✅ → B ✅ → **D (now)** → C → E.

### Phase D: new games (in progress)

Built in batches of 5. **Batch 1 (done 2026-10-23)**: Robot Run, Chill Art, Wheel of fortune, Memory pairs, Battleship (games 16–20 above). **Batch 2 (done 2026-10-23)**: the co-op chase family on one shared engine: checkpoint mini-games for Robot Run, then Submarine Squad, Floor is Lava, Zombie Run (games 21–23).

Next agreed step: ROADMAP item 9 (online / LAN mode), then more games from the list below.

**Still to build: from the user's request**
1. ✅ **Classic Asteroids** (game 34, `ship`).
2. ✅ **Team puzzle** (game 36, `tpuzzle`).
3. ✅ **Snake** (game 32; one snake per phone, not a shared arena).
4. ✅ **Castle tower defense** (game 37, `td`).
5. ✅ **Burger restaurant** (game 33; each student on their own, not co-op).
6. ✅ **Basketball** (game 31, `hoops`).
7. ✅ **Whack-a-mole** (game 30, `mole`).

**Also from Kahoot's list**: Marble Race (classic flow + a race finale), Cosmic Quest, Tallest Tower team-floors, Unplugged, shared-device teams.

### Phase C: look and feel
- ✅ (2026-10-30) Quiz themes: 7 question themes (answer colours and question card), per quiz or per room (backgrounds are the separate scenes; no fonts).
- More lobby scenes with animated characters.
- ✅ (2026-10-30) A survival or "lives" mode, and a final double-points question: classic quiz options.

### Smaller open items
- A YouTube clip per question, with start and end times (the editor and classic host screen need it).
- ✅ (2026-10-30) A "team talk" pause before the answers open in team quizzes (classic quiz option).
- ✅ (2026-10-30) Question preview "as the phone sees it" inside the editor: the 📱 תצוגה button in the editor header (`POST /api/q/preview` builds the real phone payload, `QView.render` draws it in a phone frame).
- ✅ (2026-10-30) A per-question analytics view in the report: the report window has a "❓ לפי שאלות" tab (hardest first, % right, average time, the most common wrong answer).

### Phase E: internet version (later)
Cloud hosting, a database (accounts, saved quizzes, history), sharing quizzes, web image search (Openverse needs no key; Pixabay and Unsplash need a free key), and public Kahoot link import (unofficial API; public quizzes only).

### Ideas (not requested yet)
- Quiz library tags and filters, plus favorites.
- Teacher controls: pause, +30 seconds, skip.
- Accessibility: big text, text-to-speech.
- Homework or self-paced mode.
- Nickname filter and approval.
- Late joiners as spectators.
- Printable certificates.
- English and Arabic UI.

---

## Troubleshooting: other devices can't open the site (found 2026-10-20)

Symptom: the host screen works on the host PC, `ping <host IP>` works from other devices, but the page does not load (timeout).

Cause (confirmed on the host PC): Windows **Block** rules named "Node.js JavaScript Runtime" on the **Public** profile (TCP and UDP). They are created when someone clicks Cancel on the "Allow Node.js on this network?" popup, and a Block rule overrides the "Quiz Games 3000" Allow rule. School Wi-Fi is usually classified Public.

Fix (admin PowerShell):
```powershell
Get-NetFirewallRule -DisplayName "Node.js JavaScript Runtime" | Where-Object { $_.Action -eq "Block" } | Remove-NetFirewallRule
```
Also check:
- If ping fails too, the Wi-Fi uses client isolation (AP isolation). Use the PC's Windows Mobile Hotspot (usually `192.168.137.1`) or a router without isolation.
- On a Public profile, ports are closed unless an Allow rule exists. `start.bat` adds one for TCP 3000 only. Other Node apps on the same PC need their own rule (the exam-monitor project needs TCP 4555, UDP 3478 and the TURN relay range).
- Windows lists many virtual adapters (VMware, Hotspot, Tailscale). Use the Wi-Fi IP in the join URL. See ROADMAP.md section 6.
- Always click **Allow** on the Node.js firewall popup.
- If only some devices connect (found 2026-10-22): check that the failing devices are on the **same Wi-Fi network (same name and subnet)** as the host. It was the cause once. The host IP also changes between networks and days, so old links and QR codes stop working.

## 5. Known limitations and things not yet verified

- **Real phones**: the platform was tested with bots, a desktop browser and a phone-sized browser tab. Testing on real phones over Wi-Fi with a full class is still needed.
- **Music**: nobody has listened to the six tracks yet. Check that there are no vocals and that the loudness is even.
- **Games that trust the client**: the timing games (tower, dragon) and gem catching trust what the phone reports (the classroom threat model). Answers themselves are always graded on the server.
- **Extension, not tried in a real Chrome yet**: the logic is tested against a faked and against the real Kahoot site, and the page was driven in a browser with faked `chrome.*` APIs. Not yet checked in an installed Chrome: the on-page scan of a real Kahoot page (cards that are not links are missed), a private or logged-in quiz, the permission prompt for a LAN address, and direct sending to a program on another computer.
- **Kahoot JSON**: it is an unofficial format and can change. The conversion lives in one file (`server/importers/kahoot.js`) so a fix is quick. The slider tolerance (a share of the range) and pin zones measured from the picture's top-left corner were confirmed only on a few quizzes. Kahoot's terms don't allow scraping; keep the extension for a teacher's own use and not on the Chrome Web Store.
- **Progress depends on names**: a student who types a different name (or is not picked from the list) is a different person in the history. Reports only count answers to scored questions. A class's history starts from the first game played with that class chosen; older reports have no class.
- **Live types on big screens**: free text, brainstorm, Q&A and word cloud show what the students type. The word filter and click-to-hide help, but a determined student can still find a spelling the list misses. Add words to `server/badwords.json`.
- **Background tabs**: browsers pause CSS animations in background tabs, so for Playwright screenshots of a phone tab, call `bringToFront()` first.

## 6. Open questions for the user

1. Is the Kahoot spreadsheet template enough for importing for now? Link import needs internet.
2. After listening to the music, are any tracks to be replaced?
