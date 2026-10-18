// Start a room with bots and print the host credentials so a browser can take over as host:
//   node scripts/demo.js <game> [bots] [seconds-before-start]  (default 2.5)
// In the browser console: sessionStorage.setItem('host', JSON.stringify({pin, hostToken})) then reload /host.html.
// Once a browser takes over, this script's socket loses host control, so press Start in the browser
// (pass a large seconds-before-start, e.g. 9999, when you plan to take over).
const { io } = require('socket.io-client');
const { spawn } = require('child_process');
const path = require('path');
const game = process.argv[2] || 'territory';
const count = process.argv[3] || '6';

const host = io('http://localhost:3000');
host.emit('host:create', { game }, (r) => {
  host.emit('host:game', game);
  console.log(JSON.stringify({ pin: r.pin, hostToken: r.hostToken }));
  spawn(process.execPath, [path.join(__dirname, 'bots.js'), r.pin, count], { stdio: 'ignore' });
  setTimeout(() => host.emit('host:start'), Number(process.argv[4] || 2.5) * 1000);
});
