# Games research and specs (ROADMAP item 1)

Written 2026-10-30 **from memory** of the products named here, not from fresh web research: check a product's current features before copying anything. "Ages" are my estimate of who enjoys it. The platform's own rule for every game: a student answers a quiz question, a correct answer earns a **reward** (a turn, a resource, driving time…), and the reward is spent in a short mini-game on the phone while the big screen shows the shared state. Answers are graded only on the server.

## Where the ideas come from

| Source | What it is known for | Used here |
|---|---|---|
| Kahoot | Classic live quiz, team modes, Robot Run, Submarine Squad, Treasure Trove, Color Kingdoms, Lost Pyramid, Marble Race, Chill Art | Most of the first 25 games |
| Blooket | Game modes on top of question sets (Tower Defense, Gold Quest, Crypto Hack, Cafe, Racing, Monster Brawl…); very popular with ages 8 to 14 | Tower defense, burger cafe, racing, treasure |
| Gimkit | Earn money for right answers and spend it on upgrades; "Fishtopia", "Trust No One" (impostor), "Tag", "Capture the Flag" | Impostor, wheel, resource ideas |
| Quizizz / Wayground | Self-paced homework mode, memes, power-ups, leaderboard | Study game, power-ups, surprises |
| Quizlet Live | Teams of 3 who must cooperate: each phone holds one answer | Team puzzle, shared-device teams (not built) |
| Socrative Space Race | Teams race rockets for right answers | Rocket to the moon |
| Wordwall | Many classroom templates from one list (match up, quiz, anagram, maze chase, whack-a-mole, balloon pop, flying fruit…) | Mole, balloons, fruit catch |
| Baamboozle | Teacher-run team game with power-ups on the board | Surprises |
| Mentimeter / Slido | Live polls, word clouds, Q&A | Live question types |
| Among Us | Hidden traitor, meetings and votes | Impostor |
| Classic arcade and mobile hits | Snake, Flappy Bird, Asteroids, Paper.io, Angry Birds, Dino Run, Fruit Ninja, Piano Tiles, Mario Kart, Battleship, Memory, Minesweeper, Wheel of Fortune, Tower defense | Most mini-games |

## The 50 games: what each is and where it comes from

Status: all 50 are built. `id` is the file name in `server/games/`. Ages are rough.

| # | Game | id | Inspired by | Ages | Players |
|---|---|---|---|---|---|
| 1 | Classic quiz (+ survival, double final, surprises, team talk) | classic | Kahoot | 6-adult | all, or 2-4 teams |
| 2 | Lost Pyramid | pyramid | Kahoot | 8-adult | 2-6 teams |
| 3 | Color Kingdoms (attack or surround) | territory | Kahoot, Go | 8-adult | 2-4 teams |
| 4 | Tug of war | tug | classic | 6-12 | 2 teams |
| 5 | Penalty kicks | penalty | football | 6-adult | 2-4 teams |
| 6 | Snowball fight | snowball | Angry Birds | 6-14 | 2 teams |
| 7 | Treasure chase | gems | Kahoot Treasure Trove | 6-12 | all |
| 8 | Kart dodge | race | arcade racers | 6-14 | all |
| 9 | Land grab | closer | Paper.io | 8-adult | all |
| 10 | Tower stack | tower | Kahoot Tallest Tower | 6-adult | all |
| 11 | Fishing | fishing | Fishtopia-style | 6-14 | all |
| 12 | Ticking bomb | bomb | hot potato | 8-adult | all |
| 13 | Defend the Earth | asteroids | Space Invaders | 8-adult | co-op |
| 14 | Dragon battle | dragon | boss fights | 8-14 | co-op |
| 15 | Rocket to the moon | rocket | Socrative Space Race, Simon | 6-12 | co-op |
| 16 | Robot Run | robot | Kahoot Robot Run | 8-14 | co-op |
| 17 | Paint by numbers | paint | Kahoot Chill Art | 6-adult | co-op |
| 18 | Wheel of fortune | wheel | the TV show | 6-adult | all |
| 19 | Memory pairs | pairs | Memory | 5-adult | 2-4 teams |
| 20 | Battleship | fleet | the board game | 8-adult | 2 teams |
| 21 | Submarine rescue | sub | Kahoot Submarine Squad | 8-14 | co-op |
| 22 | Floor is lava | lava | the playground game | 6-12 | co-op |
| 23 | Zombie run | zombie | Zombies Run, Temple Run | 8-14 | co-op |
| 24 | Practice and learning | study | Quizlet, Quizizz homework | 6-adult | self-paced |
| 25 | Lesson | lesson | Nearpod, Pear Deck | 6-adult | teacher-led |
| 26 | Prank sabotage | prank | Gimkit, party games | 8-adult | all |
| 27 | Impostor | impostor | Among Us, Gimkit Trust No One | 9-adult | co-op + traitor |
| 28 | Rhythm | rhythm | Piano Tiles, Guitar Hero | 8-adult | all |
| 29 | Kart from behind | kart | Mario Kart, Out Run | 8-adult | all |
| 30 | Whack-a-mole | mole | Wordwall | 5-12 | all |
| 31 | Basketball | hoops | arcade hoops | 6-adult | all |
| 32 | Snake | snake | Nokia Snake | 6-adult | all |
| 33 | Burger cafe | burger | Blooket Cafe, Papa's | 6-14 | all |
| 34 | Asteroids ship | ship | Asteroids | 8-adult | all |
| 35 | Marble race | marble | Kahoot Marble Race | 6-14 | all |
| 36 | Team puzzle | tpuzzle | Quizlet Live, jigsaws | 6-adult | 2-6 teams |
| 37 | Castle tower defense | td | Blooket Tower Defense | 8-adult | co-op |
| 38 | Colour confusion | stroop | the Stroop test | 8-adult | all |
| 39 | Balloon pop | balloon | Wordwall balloon pop | 5-10 | all |
| 40 | Fruit catch | catch | Wordwall flying fruit | 5-12 | all |
| 41 | Flappy bird | flappy | Flappy Bird | 8-adult | all |
| 42 | Obstacle runner | runner | Chrome dino | 6-adult | all |
| 43 | Reaction | reaction | reaction-time tests | 6-adult | all |
| 44 | Sliding puzzle | slide | the 15 puzzle | 8-adult | all |
| 45 | Archery | archery | shooting galleries | 6-adult | all |
| 46 | Memory squares | memgrid | Simon, Lumosity | 6-adult | all |
| 47 | Typing | typing | typing tutors | 8-adult | all |
| 48 | Darts | darts | pub darts | 8-adult | all |
| 49 | Lights out | lights | Lights Out | 9-adult | all |
| 50 | Math rush | mathrush | Prodigy, Math Blaster | 6-12 | all |

## How each maps to quiz questions

Every game uses the same engine (`server/games/base.js`): a question comes to the phone, the server grades it, and the game's `onAnswer` / `afterFeedback` decide what the answer is worth. Games where one correct answer earns one round use `server/games/ffa.js`; the settings "correct answers per reward" and "rewards per reward" (1, 2, 3 or 5) apply to all of them. The detailed rules, scoring and limits of each game are in `PROJECT_SUMMARY.md` section 3.1 (one table row per game).

## Candidates not built yet

| Idea | From | Note |
|---|---|---|
| Cosmic Quest (steer a ship through space, collect stars) | Kahoot | Would reuse the kart or ship engine |
| Tallest Tower with team floors | Kahoot | `tower` exists for individuals and teams |
| Unplugged / shared-device teams (one phone per team) | Kahoot, Quizlet Live | Needs a "team phone" join mode |
| Capture the flag | Gimkit | Needs a shared map |
| Escape room puzzle chain | Blooket, escape rooms | A natural fit for the author's other project |
| Boss rush with power-ups shop | Blooket Monster Brawl | Between-question shop |
| Trivia crack wheel (categories) | Trivia Crack | Needs question categories |
| Hangman / word guess | classic | Needs a word per question |
| Pictionary (draw on the phone, the class guesses) | party games | Needs a drawing canvas and word list |
| Spelling bee | school | Needs text-to-speech and a word list |
