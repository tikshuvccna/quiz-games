# Roadmap – Planned Features

Status: **PLANNED – do not implement until the owner says so.**

This file collects the requested changes in one place so they can be implemented later, in order, on request.

---

## 1. More games (target: 50 to start)

- Add many more games, including the Kahoot game modes and other well-known ones.
- Research games that proved successful: popularity, ratings/stars, and long-term success, for **all ages** (kids, teens, adults, families).
- Every game must be adapted to fit this platform (same question/answer data model, lobby, scoring, music, backgrounds).
- Start with 50 games; the architecture should make adding more simple (one module/config per game).
- Deliverables:
  - [ ] Research list of ~50+ candidate games with source/popularity notes and age range.
  - [ ] Per-game spec: rules, scoring, min/max players, how it maps to quiz questions.
  - [ ] Game registry so a new game = one folder/file.

## 2. Audio and video assets

- **More music tracks** in general.
- **10 music tracks** created with Google Flow (music).
- **10 videos** created with Google Flow and uploaded to YouTube (store the YouTube links/IDs in a config file, embed in the app).
- Note: asset generation in Google Flow and the YouTube upload are done by the owner. The code side is a manifest (`music/`, plus a JSON list of videos) and the player UI.

## 3. Backgrounds

- Beautiful **static backgrounds** made with Google Flow.
- **Animated/moving backgrounds** made with Google Flow (looping video or animated image; keep files small and provide a static fallback for weak devices).
- Background picker in the host UI and per-quiz default background.

## 4. Quiz question media

Besides an image, a question can include:

- [ ] Uploaded **video**
- [ ] **YouTube link** (embedded, with optional start/end time)
- [ ] **Moving image**: PNG (APNG) or GIF

New question types / features:

- [ ] **Real puzzle-piece question**: the picture is cut into pieces that players arrange (drag and drop, touch-friendly). Configurable grid size (e.g. 2x2, 3x3, 4x4) and scoring by time/accuracy.
- [ ] **Slow image reveal** (Kahoot-style): the image is revealed gradually over time (blur-to-sharp or tile-by-tile). Faster answer = more points. Configurable duration.

## 5. Folders and sharing

- [ ] Create **folders** and place quizzes inside them (nested folders optional).
- [ ] Move, rename and delete folders and quizzes.
- [ ] **Share quizzes** and **share folders** (share link and/or export/import file; permissions: view / copy / edit).

## 6. UI / network fixes

- [ ] Add **spacing between the game PIN/number and the QR code** on the lobby screen.
- [ ] **Host IP selection**: use the **WLAN (Wi-Fi) IP** by default; if there is no WLAN IP, fall back to the **LAN (Ethernet) IP**. Ignore virtual adapters (VPN, Docker, VirtualBox, Hyper-V, loopback). This IP is used in the displayed join URL and QR code.

## 7. Excel / template import

- The uploadable template is based on the **official Kahoot template**, with **extra columns** for:
  - question type
  - every other feature in our app (media, puzzle, slow reveal, per-question settings, etc.)
- The extra columns must **not break compatibility**: the same file must still be accepted by the official Kahoot importer (extra columns placed after Kahoot's columns, ignored by Kahoot).
- [ ] Update the template file and the import parser.
- [ ] Validation with a clear error report (row, column, reason).
- [ ] **Import a .zip** containing the .xlsx plus an `images/` folder: the `Image` column names are matched to the files and attached to the questions automatically (a plain .xlsx without images keeps working). Images made by the Claude Project (diagrams, charts, maps drawn in code) arrive this way; for pin questions the exact `x|y|radius` comes with the file.
- [ ] Define the final extra-column format (column names, `|` separators) and keep it in sync with the Claude Project instructions.

## 8. Free-form import

- [ ] Option to upload **questions and answers in free form** (plain text/Word/Excel/pasted text, no strict template).
- [ ] The system fills in everything else automatically: question type, correct answer detection, time limit, points, distractors if missing, and so on.
- [ ] A preview/edit screen before saving the quiz.

## 9. Online / LAN deployment mode

- [ ] Make the app **ready for online hosting** (config via environment variables, no hardcoded IPs/ports, HTTPS-ready, persistent storage, basic auth/accounts for teachers).
- [ ] Support **both modes**: **Online** and **LAN**, and let the **teacher choose** which one when starting a game.
  - LAN: local IP + QR code, works without internet.
  - Online: public URL + PIN, works from anywhere.
- [ ] Deployment guide (hosting options, environment variables, build/start commands).

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
