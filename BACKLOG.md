# Ideas Backlog

Status: **IDEAS ONLY – not scheduled.** The committed plan is in [ROADMAP.md](ROADMAP.md). Items here are grouped by category and ranked by importance. Move an item into ROADMAP.md when it is approved.

**Priority tiers**
- **P1** – high value, build soon (after or alongside the ROADMAP items)
- **P2** – good value, build when P1 is done
- **P3** – nice to have / long term

The owner liked the **escape-room style** and the **surprise / swap-places events**, so they are marked ⭐ and ranked P1.

---

## 1. Game modes and game design

| Pri | Idea | Notes |
|---|---|---|
| P1 ⭐ | **Escape-room quiz** | The class (or teams) solves a chain of questions and puzzles to unlock doors, with a timer, hints, clue objects and a story theme. Reuse the owner's existing escape-room builder projects (`D:\בונה חדרי בריחה - גרסת אתר`, `D:\בונה חדרי בריחה - מתקדם`). Multiple rooms/themes; cooperative by default. |
| P1 | **Boss battle** | Whole class fights one monster; each correct answer damages it. Cooperative, so weaker students are not embarrassed. |
| P1 | **Power-ups and double points** | Usable in any game (shield, double points, skip, 50/50, steal). |
| P1 | **Comeback mechanics** | Catch-up bonus for last places so a lead is never final. |
| P1 ⭐ | **Mystery / surprise events** | Random events that can fire between questions in any game, with a fun animation on the big screen: double-points round, **steal points** from a rival, **swap places** (two players, or the leader and last place, trade positions/scores), shuffle teams, mystery box, "everyone gets +100", freeze a player for one question, reverse the leaderboard. Teacher settings: on/off, frequency, which events are allowed. Also works as a catch-up mechanic. |
| P2 | **Wager questions** | Bet points before seeing the question (Jeopardy-style). The pyramid game's confidence style already exists. |
| P2 | **Team relay** | Team members answer in turn. |
| P2 | **Ghost mode** | Race your own previous score (Kahoot has it). Good for repeat practice and shy students. |
| P2 | **In-game economy layer** | Earn money for correct answers, spend it on upgrades, across all games (Gimkit style). |
| P2 | **Seasonal events** | Holiday skins and backgrounds, including Jewish holidays. |
| P3 | **Hidden roles / social deduction** | Trust-No-One style bluffing; for older students. |
| P3 | **Story / campaign mode** | Multi-lesson adventure with progress carried over. |
| P3 | **Daily challenge** | One question or quiz a day with a streak counter (online mode). |
| P3 | **Class vs class tournaments** | Across a school, with a school leaderboard. |

Game-mode inspiration for the "50 games" list (from competitors): Blooket – Tower Defense, Gold Quest, Café, Racing; Gimkit – Don't Look Down, Tag, Capture the Flag, Fishtopia, One Way Out, Trust No One, Kit Collab; Kahoot – classic, team, ghost, challenge.

## 2. Question types

| Pri | Idea |
|---|---|
| P1 | **Ordering / sequence** (put events or steps in order) |
| P1 | **Matching pairs** (words to meanings or images) |
| P1 | **Hotspot** (tap the right spot on an image or map) |
| P1 | **Fill in the blank** (word bank or typed) |
| P2 | **Label the diagram** (drag labels onto a picture) |
| P2 | **Slider / number estimate** (closest answer scores more) |
| P2 | **Audio questions** (listen and answer; languages, music) |
| P2 | **Open-ended** with live teacher grading, or grouped into a word cloud |
| P3 | **Math input** with formula display |

(The puzzle-piece and slow-reveal types are already in ROADMAP.md section 4.)

## 3. Homework, adaptive learning and retention

| Pri | Idea | Notes |
|---|---|---|
| P1 | **Homework / self-paced mode** | Student gets a link and plays on their own time (Wayground, Kahoot "challenge"). Fits the online mode. Biggest gap vs competitors. |
| P1 | **Review-my-mistakes round** | Short retry cycle at the end of a game. Low-stakes retrieval improves retention. |
| P2 | **Spaced repetition** | Wrong questions return in later games or in homework. |
| P2 | **Adaptive difficulty** | Next question depends on recent answers; easy/medium/hard variants per question. |
| P2 | **Per-student weak-topic map** | Across many sessions, with an auto-generated review quiz. |
| P3 | **Exit ticket** | 3 questions at the end of a lesson feeding the report. |

## 4. AI and content creation

| Pri | Idea | Notes |
|---|---|---|
| P1 | **AI question generation** | Topic, pasted text or PDF in, draft quiz out. Pairs with free-form import (ROADMAP 8). Can use the Claude API. |
| P1 | **Built-in starter packs** | Hebrew subject/grade packs aligned to the Israeli curriculum; start a game in seconds. |
| P2 | **Student-made quizzes** | Students write questions, teacher approves. |
| P2 | **Question bank + tags** | Reuse questions across quizzes; tags for subject, grade, difficulty. |
| P2 | **Quality checks** | Warn on ambiguous questions, duplicate answers, always-longest-is-correct, text too long for a phone. |
| P2 | **Quiz version history** | Undo bad edits. |
| P3 | **Image-to-quiz (OCR)** | Photograph a textbook page, get questions. |
| P3 | **Auto-translate quizzes** | With teacher review. |
| P3 | **Variant generator** | One question to several versions with different numbers (math). |
| P3 | **Import from other platforms** | Quizizz, Blooket, Quizlet, Google Forms. |

## 5. Motivation, progress and reports

| Pri | Idea | Notes |
|---|---|---|
| P1 | **Badges and streaks** | 5-in-a-row, fastest correct, most improved: rewards effort, not only the top scorer. |
| P1 | **Careful leaderboards** | Teacher toggle: top 5 only, teams only, personal best, or hidden. Competition optional. |
| P2 | **Live teacher heat map** | Which questions the class is struggling with, during the game. |
| P2 | **Pause-and-explain + answer explanations** | Explanation text shown after each answer. |
| P2 | **Richer reports** | Per-question difficulty, most common wrong answers, per-student progress over time; export to Excel/PDF. |
| P2 | **Class goals** | "Class averages 80% = everyone unlocks a bonus game." |
| P3 | **Avatars and unlockable cosmetics** | Earned across sessions. |
| P3 | **Certificates / term summary** | Per student. |
| P3 | **Parent view** | Read-only progress link. |

## 6. Other classroom modes

| Pri | Idea |
|---|---|
| P2 | **Live poll and word cloud** for warm-ups (no score) |
| P3 | **Teacher community**: rate, comment and fork shared quizzes (extends ROADMAP 5) |

## 7. Platform, reliability and safety

| Pri | Idea | Notes |
|---|---|---|
| P1 | **Reconnect / rejoin** | A player who refreshes or loses Wi-Fi keeps their score. Check whether it already exists. |
| P1 | **Automated tests for every new game** | Extend `scripts/smoke-test.js` (currently 15 games) to all 50, using bots; run before each release. |
| P1 | **Safety tools** | Hebrew profanity filter for names and open answers (teacher override), kick player, lock room after start. |
| P2 | **Installable app (PWA)** | Add the player page to the home screen; auto-reconnect. |
| P2 | **Load test** | 100+ bots on one LAN to find the real limit. |
| P2 | **Backup and restore** | One-click, plus auto-backup before updates. |
| P2 | **Crash recovery** | A game in progress survives a server restart. |
| P2 | **Admin settings screen** | IP choice, port, quiz folder, music volume, instead of editing config files. |
| P2 | **LAN stays fully offline** | No CDN dependencies in LAN mode. |
| P3 | **Privacy** | No student emails stored; report retention period (important online). |
| P3 | **Offline download** for the online version | Teacher downloads a quiz and runs it with no internet. |
| P3 | **Google Classroom integration** | Import classes and quizzes. |
| P3 | **Usage analytics for the owner** | Which games and question types are used most. |
| P3 | **Class rosters** | Persistent student names across sessions. |

## 8. Accessibility, language and display

| Pri | Idea |
|---|---|
| P1 | **Colorblind-safe answer buttons** (distinct shapes + palette) |
| P1 | **Projector-friendly mode**: high contrast, big fonts, loud countdown |
| P2 | **Adjustable text size and dyslexia-friendly font** |
| P2 | **Extra time** per student |
| P2 | **Sound-off mode** with visual cues |
| P2 | **Hebrew polish**: niqqud support, mixed Hebrew/English in RTL |
| P2 | **Multi-language UI**: Arabic, Russian, English |
| P3 | **Screen-reader support and keyboard-only host control** |

---

## Teaching-practice principles (from the research)

- Define what success is before building (participation, scores, retention) and measure it in reports.
- Each game mechanic should serve a learning goal.
- Prefer frequent, low-stakes practice over one big test.
- Use intrinsic rewards (unlocks, harder levels) over prizes.
- Make competition optional; collaboration by default.
- Make knowledge last beyond the game (retry, spaced repetition).

## Suggested "version 1" cut

The ROADMAP.md items (games, question media, folders and sharing, template and free-form import, online/LAN mode) plus these P1 items: escape-room quiz, surprise events (swap places, steal points), reconnect/rejoin, ordering/matching/hotspot/fill-in questions, power-ups, badges and careful leaderboards, homework mode, AI question generation, safety tools, and tests for all games.

## Sources (competitor and research context; mostly vendor blogs, treat as ideas only)

- [The 8 best Kahoot! alternatives in 2026](https://www.jotform.com/blog/kahoot-alternatives/)
- [9 Best Quizizz Alternatives in 2026](https://qzzr.com/?p=6223)
- [Games like Gimkit (AhaSlides)](https://ahaslides.com/vi/blog/games-like-gimkit/)
- [Gimkit review](https://tooldirectory.ai/tools/gimkit)
- [Gamification in the classroom (Scavify)](https://www.scavify.com/blog/gamification-in-the-classroom-that-boosts-real-engagement)
- [10 best practices for implementing gamification (ATD)](https://www.td.org/insights/10-best-practices-for-implementing-gamification)
- [Using gamification in teaching (Pearson)](https://pearson.com/languages/community/blogs/gamification-in-teaching-4-24.html)
