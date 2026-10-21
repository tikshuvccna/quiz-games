# Quiz Games: project summary, status and roadmap

A Hebrew (RTL) live classroom game platform in the spirit of **Kahoot's game modes ("experiences")**. Students join from phones or PCs with a PIN. In each game, answering questions earns a resource or turn, which is spent in a mini-game shown on the big screen. There is also a classic Kahoot-style quiz and quiz-based team modes.

- **Runs on**: the local network (LAN) only. The internet version with a database comes later (Phase E).
- **Language**: Hebrew UI. The chat with the user is in English.
- **Last updated**: 2026-10-16. Phases A (questions) and B (classic quiz + quiz modes) are done, plus music. Phase D (new games) is next.

---

## 1. How to run

| What | How |
|---|---|
| Start everything | Double-click `start.bat`. It installs on the first run, opens the Windows firewall once, starts the server and opens the host screen. |
| Host (big screen) | `http://localhost:3000/host.html` |
| Players | Scan the QR on the host screen, or open `http://<PC address>:3000` and type the PIN. Phones must be on the same Wi-Fi. |
| Quiz editor | `http://localhost:3000/editor.html`, or the "✏️ עורך השאלות" button in the lobby. It only works on the host computer (by design, so students can't read the answers). |
| Reports | Saved automatically to `reports/` (one JSON per room, updated every round). Download them as CSV from the results screen ("📊 דוח שחקנים"). |
| Music | mp3 files in `music/` (all six were generated with Google Flow Music). Any mp3 dropped there appears in Room settings. |

### Tests (start the server first: `node server/index.js`)

| Command | What it checks |
|---|---|
| `node scripts/smoke-test.js [game]` | Bots play a short round of every game (15) and print the state and results. |
| `node scripts/feature-test.js` | Name modes and reroll, 3 teams, reward settings, winner text, rematch with the same PIN, the report, an individual game played in teams. 14 checks. |
| `node scripts/classic-test.js` | Classic quiz: every stage, team averages, the second-chance round for the bottom 5. |
| `node scripts/pyramid-test.js` | The Lost Pyramid (4 teams), the accuracy style and the confidence style. |
| `node scripts/demo.js <game> 8 9999` | A room with 8 bots for visual demos. Put the printed pin and token into the browser's `sessionStorage.host`, reload `/host.html`, and press start. |
| `node scripts/bots.js <pin> [n]` | Adds n bots to an existing room (they answer every question type, including confidence). |

All suites passed on 2026-10-16.

---

## 2. Code map

```
server/
  index.js        express + socket.io; editor REST API (/api/q/*, local only); /media, /music, /qr
  room.js         Room: PIN, lobby, teams (2-6), countdown, timer/tick, rematch, stats + report, host/player state
  games/base.js   QuizGame: the shared per-player question loop, reward charge (need/amount), turns, answer log
  games/*.js      one game per file (see 3.1); classic.js = host-paced quiz; pyramid.js extends classic
  qtypes.js       question types: normalize / playable / present (phone payload) / check (server grading)
  quizzes.js      quiz library in the admin-chosen folder (config.json), media, xlsx import/export (exceljs)
  teams.js        the 6 teams (name + color)
  names.js        random funny Hebrew nicknames
public/
  index.html      phone app      → js/play.js (join, lobby, question/feedback, results)
  host.html       big screen     → js/host.js (lobby, settings, report modal) + js/music.js
  editor.html     quiz editor    → js/editor.js
  js/common.js    helpers U.* (host frame, results, podium, confetti, sound fx, fitImage…)
  js/question.js  QView: renders every question type on the phone
  js/art.js       hand-drawn SVG art (mascots, game objects, lobby covers)
  js/games/*.js   per-game client: hostPlaying / hostEnded / hud / playerPhase / playerEnded
  css/            style.css (design system) · games.css · games2.css · platform.css · questions.css · classic.css · pyramid.css · editor.css
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
2. **Register** it in the `GAMES` list in `server/room.js`.
3. **Client** `public/js/games/<id>.js` sets `Games[id]`:
   - `hostPlaying(app, st)` uses `U.hostFrame` + `U.hostTick`.
   - `hostEnded` uses `U.hostResults`.
   - `hud(you)`.
   - `playerPhase(app, you, ctx)`: view keys must include `you.qid + ':' + you.turn`.
   - `playerEnded` uses `U.playerResult`.
   - Add a lobby cover in `Art.cover()`, and the script tag to both `host.html` and `index.html`.
4. **Bots**: teach `scripts/bots.js` and `scripts/smoke-test.js` the new phase, then run the tests and take screenshots on the host (1366×768) and a phone (390×800).

---

## 3. What exists today

### 3.1 Games (15)

| # | Game | Mode | What answering earns / the action on the phone |
|---|---|---|---|
| 1 | 🎯 חידון קלאסי | Individual or 2–4 teams (team score = average) | Kahoot classic: same question for everyone, speed + accuracy points, streaks, leaderboard with fun lines. Scoring styles: classic, accuracy only, confidence (boost or safe). Second-chance round for the bottom 5. |
| 2 | 🔺 הפירמידה האבודה | 2–6 teams (default 4) | Like Kahoot's Lost Pyramid: 2 minutes of team discussion, vote + confidence (Maybe / Yes / Totally!), teams climb a 15-step pyramid. |
| 3 | 🏰 כובשי הממלכה | 2–4 teams | Flags: capture, attack or fortify tiles on a 3D island. Castles give bonuses. (Like Color Kingdoms.) |
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
  - A Room settings tab: name mode, 6 scenes (classic, space, ocean, forest, candy, sunset), a YouTube video while players wait, winner text, and music.
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
  - Order (puzzle).
  - Pin on an image.
  - Poll and info slide (classic quiz only).
- **Per question**: time limit (5–240 seconds), points (none, ×1, ×2, ×3, ×4), image reveal (blur that clears).
- **Excel**: import Kahoot's spreadsheet template (or ours), download a blank template, export any quiz.
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
| Robot Run (co-op escape, hold-to-boost, mini-games) | ⏳ Phase D |
| Submarine Squad (co-op, hold to speed up, "diving mode") | ⏳ Phase D |
| Chill Art (co-op paint-by-numbers reveals a picture) | ⏳ Phase D |
| Cosmic Quest (space navigation, collect stars) | ⏳ Phase D |
| Marble Race (correct = marble, luck race at the end) | ⏳ Phase D |
| Unplugged (no devices; Team Tiles) | ⏳ planned |
| Professional / Lecture | 🟡 classic quiz supports info slides and polls |

---

## 4. Roadmap

Agreed order: A ✅ → B ✅ → **D (now)** → C → E.

### Phase D: new games (next)

Suggested order: start with the co-op ones, which are the most different from what exists.

**5 co-op "escape / together" games**
1. **Robot Run**: the class escapes a robot; correct answers let you hold-to-boost your character; mini-games in between.
2. **Submarine Squad**: hold to speed the sub away from a fish; when the progress bar fills, a "diving mode" mini-game.
3. **Chill Art**: correct answers = paintbrushes; paint-by-numbers on the phone reveals a masterpiece on the big screen.
4. **The floor is lava / climb**.
5. **Zombie run to the safe house** (or "outrun the tide").

**10 more games from the user's request**
1. **Classic Asteroids**: fly your own ship for a few seconds after a correct answer, with a phone joystick and fire button. Real-time.
2. **Team puzzle**: each team builds a picture; a correct answer gives a player 5 seconds to place pieces; first team to finish wins. 2–6 teams.
3. **Snake arena**: real-time, steer for a few seconds per reward.
4. **Memory pairs**: teams flip two cards on the shared board.
5. **Battleship**: team vs team.
6. **Wheel of fortune**: spin for points, double, steal or lose.
7. **Castle tower defense**: co-op.
8. **Burger restaurant**: co-op, build orders in the right sequence.
9. **Basketball**: aim and timing.
10. **Whack-a-mole**.

**Also from Kahoot's list**: Marble Race (classic flow + a race finale), Cosmic Quest, Tallest Tower team-floors, Unplugged, shared-device teams.

### Phase C: look and feel
- 10 quiz themes (question card, answer colors, background, fonts), chosen per quiz or per session.
- More lobby scenes with animated characters.
- A survival or "lives" mode, and a final double-points question.

### Smaller open items
- A YouTube clip per question, with start and end times (the editor and classic host screen need it).
- A "team talk" pause before answers lock in team quizzes.
- Question preview "as the phone sees it" inside the editor.
- A per-question analytics view in the report (which questions most students missed).

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

## 5. Known limitations and things not yet verified

- **Real phones**: the platform was tested with bots, a desktop browser and a phone-sized browser tab. Testing on real phones over Wi-Fi with a full class is still needed.
- **Music**: nobody has listened to the six tracks yet. Check that there are no vocals and that the loudness is even.
- **Games that trust the client**: the timing games (tower, dragon) and gem catching trust what the phone reports (the classroom threat model). Answers themselves are always graded on the server.
- **Excel import**: only the "quiz" (multiple choice) question type comes from Excel. Other types are made in the editor.
- **Background tabs**: browsers pause CSS animations in background tabs, so for Playwright screenshots of a phone tab, call `bringToFront()` first.

## 6. Open questions for the user

1. Is the Kahoot spreadsheet template enough for importing for now? Link import needs internet.
2. After listening to the music, are any tracks to be replaced?
