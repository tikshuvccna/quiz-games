# Roadmap – Planned Features

Status: **IN PROGRESS** (the owner asked to build everything, 2026-10-22). Checked items are done.

This file collects the requested changes in one place so they can be implemented later, in order, on request.

---

## 1. More games (target: 50 to start: reached 2026-10-30, 50 games)

- Add many more games, including the Kahoot game modes and other well-known ones.
- Research games that proved successful: popularity, ratings/stars, and long-term success, for **all ages** (kids, teens, adults, families).
- Every game must be adapted to fit this platform (same question/answer data model, lobby, scoring, music, backgrounds).
- Start with 50 games; the architecture should make adding more simple (one module/config per game).
- Deliverables:
  - [x] (done 2026-10-30, `docs/GAMES_RESEARCH.md`; written from memory, no web research, ratings and popularity numbers were not looked up) Research list of ~50+ candidate games with source/popularity notes and age range.
  - [x] (done 2026-10-30: one row per game in PROJECT_SUMMARY.md 3.1, plus the list in `docs/GAMES_RESEARCH.md`) Per-game spec: rules, scoring, min/max players, how it maps to quiz questions.
  - [x] (2026-10-30) Batches 3 to 6: sabotage, impostor, rhythm, kart, five and then ten more round games on a shared base (`ffa.js`), marble race, team puzzle, castle tower defense, snake, basketball, burger, ship…: 50 games in total. See PROJECT_SUMMARY.md 3.1.
  - [x] Game registry so a new game = one folder/file (server file + client file + optional CSS, cover via `Art.covers`).
  - [x] Batch 1 (2026-10-23): Robot Run, Chill Art (paint by numbers), Wheel of fortune, Memory pairs, Battleship. 20 games in total. See PROJECT_SUMMARY.md 3.1.
  - [x] Batch 2 (2026-10-23): the co-op chase family on one shared engine (`server/games/chase.js`): checkpoint mini-games for Robot Run, Submarine Squad, Floor is Lava, Zombie Run. 23 games in total.

## 2. Audio and video assets

- **More music tracks** in general.
- **10 music tracks** created with Google Flow (music).
- **10 videos** created with Google Flow and uploaded to YouTube (store the YouTube links/IDs in a config file, embed in the app).
- Note: asset generation in Google Flow and the YouTube upload are done by the owner. The code side is a manifest (`music/`, plus a JSON list of videos) and the player UI.

## 3. Backgrounds

- Beautiful **static backgrounds** made with Google Flow.
- **Animated/moving backgrounds** made with Google Flow (looping video or animated image; keep files small and provide a static fallback for weak devices).
- Background picker in the host UI and per-quiz default background.
- [x] (done 2026-10-30, `public/css/scenes2.css`) 10 more built-in animated scenes drawn in code: cherry blossom, rain, embers, lanterns, clouds, lava lamp, night city, desert, beach, tech grid (24 scenes in total, no Flow needed).
- [ ] **Lots of backgrounds from Google Flow** (requested 2026-10-30): a large batch (target 40+) of still pictures and a smaller set of short looping videos, made with the escape-planner Flow tools (`flowgen.py` for images, `flow_video.py` for videos) and dropped in the `backgrounds` folder, where the picker already shows them. The 40 still-picture prompts are written in `backgrounds/flow-prompts.txt` (run with `flowgen.py --prompts backgrounds/flow-prompts.txt --style raw --aspect 16:9`); the 10 video prompts and a batch script like `scripts/make-music.sh` are still to write, small files (WebP or JPG about 300 KB, videos a few MB), and the owner's explicit OK before it uses the Flow account.

## 4. Quiz question media

Besides an image, a question can include:

- [x] Uploaded **video**
- [x] **YouTube link** (embedded, with optional start/end time)
- [x] **Moving image**: PNG (APNG) or GIF

New question types / features:

- [x] **Real puzzle-piece question**: the picture is cut into pieces that players arrange (drag and drop, touch-friendly). Configurable grid size (e.g. 2x2, 3x3, 4x4) and scoring by time/accuracy.
- [x] **Slow image reveal** (Kahoot-style): the image is revealed gradually over time (blur-to-sharp or tile-by-tile). Faster answer = more points. Configurable duration.

## 5. Folders and sharing

- [x] Create **folders** and place quizzes inside them (nested folders optional).
- [x] Move, rename and delete folders and quizzes.
- [x] **Share quizzes** and **share folders** (share link and/or export/import file; permissions: view / copy / edit). Done: share links (view / copy) with QR, .qgz packages for a quiz or a folder, import from another teacher's link. "Edit" (working together on one quiz) needs teacher accounts: part of the online mode (section 9).

## 6. UI / network fixes

- [x] Add **spacing between the game PIN/number and the QR code** on the lobby screen.
- [x] **Host IP selection**: use the **WLAN (Wi-Fi) IP** by default; if there is no WLAN IP, fall back to the **LAN (Ethernet) IP**. Ignore virtual adapters (VPN, Docker, VirtualBox, Hyper-V, loopback). This IP is used in the displayed join URL and QR code.

## 7. Excel / template import

- The uploadable template is based on the **official Kahoot template**, with **extra columns** for:
  - question type
  - every other feature in our app (media, puzzle, slow reveal, per-question settings, etc.)
- The extra columns must **not break compatibility**: the same file must still be accepted by the official Kahoot importer (extra columns placed after Kahoot's columns, ignored by Kahoot).
- [x] Update the template file and the import parser (done: extra columns Type, Points, Image, Video, Reveal, Accept, Slider, Items, Pin are read; Puzzle needs the puzzle question type first).
- [x] Validation with a clear error report (row, column, reason).
- [x] **Import a .zip** containing the .xlsx plus an `images/` folder: the `Image` column names are matched to the files and attached to the questions automatically (a plain .xlsx without images keeps working). Images made by the Claude Project (diagrams, charts, maps drawn in code) arrive this way; for pin questions the exact `x|y|radius` comes with the file.
- [x] Define the final extra-column format (column names, `|` separators) and keep it in sync with the Claude Project instructions.

## 8. Free-form import

- [x] Option to upload **questions and answers in free form** (plain text/Word/Excel/pasted text, no strict template).
- [x] The system fills in everything else automatically: question type, correct answer detection, time limit, points, distractors if missing, and so on.
- [x] A preview/edit screen before saving the quiz.

## 9. Online / LAN deployment mode

- [x] (done 2026-10-30, `server/auth.js`, `scripts/online-test.js`; not tried on a real host) Make the app **ready for online hosting**: config by environment variables (`MODE`, `PUBLIC_URL`, `HOST`, `TRUST_PROXY`, `DATA_DIR`…), HTTPS-ready behind a proxy, persistent storage through `DATA_DIR`, and a sign-in for teachers (one shared password, a signed cookie, 5 tries a minute). Not done: a separate account and library for each teacher.
- [x] (done 2026-10-30) Support **both modes**: a LAN server stays as it was; an online server asks teachers to sign in; if `PUBLIC_URL` is set the host's join box lets the teacher choose "🌐 אונליין" or a network address.
- [x] (done 2026-10-30, `docs/DEPLOYMENT.md`) Deployment guide (hosting options, environment variables, build/start commands).

## 10. Player names: bad-word filter and teacher control

Requested 2026-10-26, after kids typed rude words as their nicknames.

- [x] (done 2026-10-30: `server/filter.js`, `server/badwords.json`, room setting 🛡️, also applied to typed answers, clouds, free text, ideas and questions) **Bad-word filter for nicknames** (Hebrew + English, including common tricks: spacing, symbols, letter swaps, final letters). A blocked name is refused on the phone with a friendly message ("השם הזה לא מתאים, נסו אחר") before it ever reaches the big screen.
  - A **room setting** "🛡️ סינון מילים לא יפות", **on by default**, which the teacher can turn off.
  - The word list lives in an editable file (`server/badwords.json` or similar), so the teacher can add words.
  - Also applies to the random-name reroll (no change needed) and any other typed text shown on the big screen (open answers / word clouds, when they exist).
- [x] (done 2026-10-30: 👥 players panel in every game, `host:kick` in any phase, `host:rename`) **Teacher control during a game** (today ✕ works only in the lobby):
  - Kick a player mid-game, from a players list on the host screen.
  - Rename a player ("🎲 שם אקראי" or a typed name) without losing their score.

## 10b. Player photo: gallery doesn't open on phones (bug)

Reported 2026-10-26: on iPhone (maybe Android too) "📷 הוספת תמונה" opens only the camera, not the gallery / files.

- Likely cause: the file input has `capture="user"` (public/js/play.js), which tells mobile browsers to go straight to the camera.
- [x] (done 2026-10-30) Fix: two buttons, "📷 מצלמה" (`capture="user"`) and "🖼️ מהגלריה" (no `capture`, plain `accept="image/*"`), or one input without `capture` (the phone then offers camera + gallery itself).
- [x] (done 2026-10-30: a decode fallback through createImageBitmap, and a clear Hebrew message with what to do when the device cannot open HEIC; not tried on a real iPhone) Also accept HEIC photos from iPhone (convert on the phone via canvas, which already happens when the browser can decode it).
- [ ] Test on a real iPhone (Safari) and a real Android (Chrome).

## 11. Bigger join info (zoom)

Requested 2026-10-26.

- [x] (done 2026-10-30: click the small join box, or 🔍 next to the code in the lobby; Esc / click closes) **During a game:** a 🔍 button on the small "join now" box in the host header opens it big (full screen or a large panel): the game code, a large QR code and the link, so latecomers in the back of the class can scan it. Click / Esc closes it and the game continues underneath.
- [x] (done 2026-10-30, with the room's video next to the code and QR) **Lobby (opening screen):** a 🔍 "full-screen join" view: a huge code, a big QR and the link, together with the big picture / YouTube video of the room (the lobby video) on screen. Toggle back to the normal lobby with one click. Good for projectors and big classrooms.

## 12. Learning, no-score and presentation modes

Requested 2026-10-30.

- [x] (done 2026-10-30: classic quiz scoring style "למידה: בלי ניקוד ובלי לוח מובילים") **No-score mode** ("ללא ניקוד"): a classic-quiz scoring style where the class answers, sees the right answer and the explanation, but there are no points and no leaderboard. (A *poll* is different: one opinion question without a right answer; it already exists as a question type.)
- [x] (done 2026-10-30: the second screen `presenter.html`, with the teacher notes, what is next, live reactions and next / back; game "שיעור", slides with layouts, PDF pages, activities in the flow, reactions; see PROJECT_SUMMARY) **Presentation mode / better slides**: slides with a layout (title, bullet points, picture side by side), shown full screen by the teacher between questions; a "presentation" option that plays the quiz as a lesson (slides + questions, no score).
- [x] (done 2026-10-30: game "תרגול ולמידה", `server/games/study.js`) **Learning modes** (like Kahoot's study modes), each student on their own phone at their own pace:
  - 🃏 **Flashcards**: question on the front, answer + explanation on the back; "I knew it" / "Again".
  - 🔁 **Practice until mastery**: wrong answers come back later until each question is answered right twice; progress bar per student, teacher sees who is stuck.
  - 📝 **Test**: no feedback until the end, then a personal summary with the mistakes and explanations.
- [x] (done 2026-10-30: Step 0 asks what to build, including a study set) Claude Project instructions: choose "regular quiz" or a learning set (more questions, an explanation for every question, flashcard-friendly wording).

## 13. Surprises and sabotage

- [x] (done 2026-10-30: `public/js/silly.js`, room setting 🤪, off by default; hopping animals, emoji rain, words, paint splats, peeking eyes, wobble / spin, rocket; every 14-32 s plus after a classic question; skipped for "calm" accessibility; the surprise events are in the next item) **"Nonsense on the screen"** (שטויות על המסך): between questions, random fun events splash over the big screen (things jumping in, smearing, wobbling…), optional in the room settings. Combined with the BACKLOG "surprise events" (swap places, steal points, double points).
  - [x] (done 2026-10-30: classic quiz setting "🎁 הפתעות בלוח המובילים": off / sometimes / often; at the leaderboard a random player steals points from the leader, two players swap scores, or the next question counts double; `scripts/surprise-test.js`) the surprise events themselves.
- [x] (done 2026-10-30: game `prank`, `server/games/prank.js`; 8 pranks incl. oil you wipe with a tap, shield from a streak of 3; the faster-clock prank was left out) **Sabotage game** ("זורקים שטויות"): correct answers earn "pranks" to throw at other players, which make answering harder for them: reversed answers, spinning / scrambled letters, swapped colors, oil smeared over the screen, scrambled question letters, question and answers swapped, the clock ticking faster until they answer right, minus points. More correct answers = more pranks. The thrower chooses the prank and the target (or random); a shield blocks one prank.

## 14. More games

- [x] (done 2026-10-30: game `kart` "קארט מאחור", pseudo-3D canvas road; cones and boost pads, steering by touching the left / right half; correct answers = driving seconds; no opponents on the road, rank by distance) **Kart racing from behind** (like Mario Kart): a real pseudo-3D race on the phone after correct answers, with power-ups; more correct answers = more racing time.
- [x] (done 2026-10-30: game `rhythm` "קצב", `server/games/rhythm.js`; the notes are a generated pattern with the click sound, not the room music) **Rhythm game**: music with notes to tap on the beat; accuracy = points.
- [x] (done 2026-10-30: game `impostor` "מי המתחזה?", `server/games/impostor.js`; co-op bar, sabotage, jam with a name hint, meetings at 1/3 and 2/3, votes, ejection) **Impostor mode** (like Among Us): everyone answers, but one secret impostor sabotages; the class must both answer and find the impostor (votes).
- [x] (done 2026-10-30: game option "כיבוש אריחי האויב: הקפה (כמו בגו)", `scripts/surround-test.js`) **Color Kingdoms (כובשי הממלכה) – surround mode**: an option to capture a castle the way the original game does, by surrounding it, instead of attacking it directly.

## 15. Images with Google Flow + building a quiz inside the project

- [ ] Generate quiz images (question / decorative) with Google Flow, the same way the yt-tikshuv project does. This works only when the quiz is built with **Claude Code on this computer** (not in the claude.ai Project).
- [x] (done 2026-10-30, `.claude/skills/build-lesson`; Flow image/video generation still needs a real Flow tool and the teacher's permission) A quiz builder inside this project (a Claude Code skill): topic / material in → questions + Flow images → saved straight into the quiz library.

---

## Suggested implementation order

1. Items 6 and 7 (small fixes and import template)
2. Item 4 (question media, puzzle, slow reveal)
3. Item 5 (folders and sharing)
4. Item 8 (free-form import)
5. Items 2 and 3 (assets and backgrounds)
6. Item 1 (50 games, done in batches)
7. Item 9 (online/LAN mode)

---

See also [BACKLOG.md](BACKLOG.md) for additional ideas grouped by category and priority (not yet scheduled).

## 16. Ideas from Google Classroom and NotebookLM

Requested 2026-10-30, "after all the things on the list". Split by what works without the internet (we are LAN only) and what has to wait for the online phase. Check the products' current features before building: this list comes from memory.

**Can be built now (no internet, no AI inside the program)**
- [x] (done 2026-10-30: `Source` column, shown after the answer on the big screen and phones, editor fields, instructions) **Sources and citations on questions** (NotebookLM's grounded answers): each question can carry a source (document name, page or section, a short quote). After the answer the big screen and the phone show "📖 מקור: …", so the class sees where the answer comes from. Spreadsheet column `Source`; the Claude Project instructions ask Claude to fill it from the material the teacher attached (quote + location, never invented).
- [x] (done 2026-10-30: print.html) **Study guide printout** (NotebookLM's study guide / briefing): from any quiz, a clean printable page (or PDF through the browser's print) with the questions, right answers, explanations and sources, grouped by topic. No AI needed, it is the quiz itself.
- [x] (done 2026-10-30: printable cards + cards.csv) **Flashcards export**: a quiz as printable cards and as CSV for Anki / Quizlet style import.
- [x] (done 2026-10-30 against typical AI shapes; NotebookLM's own output was not seen) **Paste NotebookLM / any AI output**: the free-text import already turns pasted questions into a quiz; check it against how NotebookLM writes quizzes and flashcards, and fix what it cannot read.
- [x] (done 2026-10-30: a11y.js; real phones not tried) **Read aloud** (NotebookLM's audio overview, the accessibility side): a 🔊 button on questions and answers using the browser's speech synthesis (works offline if the device has a Hebrew voice; to be tested on real phones).
- [x] (done 2026-10-30) **Gradebook export** (Classroom's grades): a CSV with one row per student and one column per game, ready to paste into Sheets, Excel or Classroom's grade import; from the progress page.
- [x] (done 2026-10-30) **Roster import**: a class from a CSV / Excel file or pasted from Classroom's people list (names column), not only typed.
- [x] (done 2026-10-30) **Teacher notes per student** on the progress page (Classroom's private comments), saved with the class.

**Waits for the online phase (accounts, a server on the internet, or an AI service)**
- Assignments with due dates, "turn in", teacher feedback and a stream of announcements (Classroom); homework / self-paced mode for students at home.
- Roster and quiz import straight from Google Classroom / Drive (needs Google sign-in), and a "share to Classroom" button.
- AI inside the program (NotebookLM style): upload a document, then generate a quiz, flashcards, a summary, an FAQ or a mind map with citations; chat with the sources; audio overview. Needs an AI service and an API key. Until then the same result comes from the Claude Project instructions (claude.ai) or a Claude Code skill on this computer (section 15).


## 17. Lots more music, generated automatically with Google Flow Music

Requested 2026-10-30: "we need more music, lots of music, premium music from Flow Music, made automatically the way the escape planner does it".

- [x] (done 2026-10-30: Round 3, 28 prompts, 42 in the file in total, 38 prompts not generated yet, 4 were made earlier) Write **a large set of prompts** in `music/music-prompts.md` (target: 40+ tracks, instrumental only, no vocals), covering every moment and mood: lobby, thinking, victory, between questions (M1 to M4), calm / co-op (M5), action games (M6), plus new groups: lesson and study (quiet focus), the sabotage and chase games, a countdown tension loop, and short stingers. Round 2 (10 prompts) is already written there and was never generated.
- [ ] **Generate them in a batch** (`bash scripts/make-music.sh` is ready, resumable, one prompt at a time; waiting for the owner's explicit OK) with the existing tool `E:\esacpe-planner\escaperoom-design\.claude\skills\google-flow\scripts\flow_music.py` (`--prompt-file music/music-prompts.md --tag <id> --out music --prefix <Mx-y>`), one prompt at a time, sequentially, with the saved Flow profile. **Needs the owner's OK before it runs** (it uses the Google account in `reference-flow-music-account`).
- [ ] Name files with the existing prefixes (M1 lobby, M2 thinking, M3 victory, M4 between, M5 calm / co-op, M6 action) so the music picker already puts them in the right moment.
- [ ] Check each file (no vocals, even loudness, a loop-friendly ending).
- [x] (done 2026-10-30, `public/js/music.js`) **Variety** mode: every moment in the room settings can be "🔀 random from a group" (M1 to M7 by file prefix) or "🔀 all songs"; the next song is drawn when one ends, never the same twice in a row.
- [ ] Keep file sizes reasonable (MP3, about 2 to 3 minutes each) so the repo and the LAN stay light.
