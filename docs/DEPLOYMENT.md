# Running BrainBlast online

The program runs in two modes. **LAN** (the default) is what `start.bat` does: the teacher's computer is the server, phones join over the school Wi-Fi, no internet needed. **Online** puts the same server on the internet so students can join from anywhere with a code.

Status: the online mode is tested with `node scripts/online-test.js` (sign-in, cookies, closed teacher pages, students joining). It has **not** been tried on a real hosting service yet.

## What changes online

| | LAN | Online |
|---|---|---|
| Who is the teacher | whoever sits at the server computer (`localhost`) | whoever signs in at `/login.html` with the teachers' password |
| Teacher pages (`host.html`, `editor.html`, `progress.html`, `print.html`) | open on `localhost` only | redirect to the sign-in |
| Students | join with the code, QR or link | the same, using the public address |
| Browsing the server's folders from the editor | yes | closed (use `DATA_DIR`) |
| Where files live | the folders in the project | `DATA_DIR` (put a disk or volume there) |

The teacher chooses how students join. If `PUBLIC_URL` is set, the host screen's join box offers "🌐 אונליין" next to the network addresses, so a LAN teacher can also hand out the public address.

## Settings (environment variables)

| Variable | Meaning |
|---|---|
| `MODE` | `lan` (default) or `online` |
| `TEACHER_PASSWORD` | Required in online mode, at least 8 characters. One shared password for all teachers. |
| `PUBLIC_URL` | The address students open, e.g. `https://quiz.example.com`. Used in the join link and the QR code. |
| `PORT` | Default 3000 (most hosts set it for you) |
| `HOST` | Bind address, default `0.0.0.0` |
| `TRUST_PROXY` | Set to `true` when a reverse proxy (nginx, Caddy, the host's load balancer) is in front. Needed for the right client address and secure cookies. |
| `SESSION_SECRET` | A long random string. Keeps teachers signed in across restarts; if it is missing, a restart signs everybody out. |
| `DATA_DIR` | One folder for quizzes, reports, backgrounds and videos (`quizzes/`, `reports/`, `backgrounds/`, `videos/` inside it). Put persistent storage here. |
| `QUIZ_DIR`, `REPORTS_DIR`, `BACKGROUNDS_DIR`, `VIDEOS_DIR` | Override single folders |

## Build and start

There is no build step.

```
npm install --omit=dev
MODE=online TEACHER_PASSWORD='a long password' PUBLIC_URL=https://quiz.example.com \
  TRUST_PROXY=true SESSION_SECRET=$(openssl rand -hex 32) DATA_DIR=/data node server/index.js
```

## Hosting options

**A small server (VPS) with Caddy** is the simplest and gives HTTPS automatically. Install Node 20 or newer, copy the project, run the command above (a process manager such as `pm2` or a systemd service keeps it alive), and put Caddy in front:

```
quiz.example.com {
    reverse_proxy localhost:3000
}
```

Caddy passes WebSockets through without extra settings. With nginx, add the `Upgrade` and `Connection` headers for `/socket.io/`.

**A platform that runs Node apps** (Render, Railway, Fly.io…): the start command is `node server/index.js`, set the variables above in its dashboard, and attach a persistent disk or volume mounted at the `DATA_DIR` path. Without a disk, quizzes and reports disappear on every redeploy.

## Things to know

- **One process only.** Rooms live in memory, so run a single instance. A restart ends the games that are running (quizzes and reports on disk are safe). Choose a plan that does not sleep, or a game will vanish while the class is playing.
- **HTTPS matters.** Passwords and the sign-in cookie travel over the connection, so use HTTPS. The cookie is only marked `Secure` when HTTPS is detected (`TRUST_PROXY=true`).
- **Passwords.** There is one shared teachers' password, not an account per teacher: everyone who signs in sees the same library and classes. Per-teacher accounts and libraries are still to do. Wrong passwords are limited to 5 tries a minute per address.
- **Student privacy.** Class rosters and progress reports hold student names. Online they sit on that server's disk: use a host you trust, and keep the teachers' password to yourselves.
- **Upload sizes.** Quizzes with videos and PDFs can be large (up to 400 MB per import). Check the host's request size limit (nginx: `client_max_body_size`).
- **The Kahoot extension's "send" button** does not work online yet (it carries no sign-in). Use "save as file" and then "⬆ ייבוא קובץ" in the editor.
