// The teacher's second screen for a lesson: notes, the next step, the class's reactions, and the buttons.
// Opened from the lesson's big screen ("📱 מסך מציג") with ?pin=…&t=<the room's host token>.
(function () {
  const q = new URLSearchParams(location.search);
  const pin = q.get('pin') || '';
  const token = q.get('t') || '';
  const box = document.getElementById('pr');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ICON = { slide: '🖼️', pdf: '📄', poll: '📊', cloud: '☁️', open: '✍️', brain: '💡', qna: '❓', drop: '📌', rate: '⭐', rank: '🏅', tap: '👆', quiz: '🔷', tf: '⚖️' };
  const socket = io();
  let st = null;
  let joined = false;

  const msg = (t) => { box.innerHTML = `<div class="pr-msg">${esc(t)}</div>`; };
  const cmd = (c, arg) => { socket.emit('presenter:cmd', { cmd: c, arg }); if (navigator.vibrate) navigator.vibrate(15); };

  socket.on('connect', () => {
    if (!pin || !token) return msg('הקישור חסר. פתחו אותו מהמסך הגדול של השיעור (📱 מסך מציג).');
    socket.emit('presenter:join', { pin, hostToken: token }, (r) => {
      if (!r || !r.ok) return msg('לא הצלחנו להתחבר. ייתכן שהחדר נסגר: פתחו את הקישור מחדש מהמסך הגדול.');
      joined = true;
      st = r.state;
      draw();
    });
  });
  socket.on('disconnect', () => { joined = false; msg('החיבור אבד, מתחברים מחדש…'); });
  socket.on('presenter:state', (s) => { st = s; if (joined) draw(); });

  // keep the phone awake while presenting
  try { navigator.wakeLock && navigator.wakeLock.request('screen').catch(() => {}); } catch {}

  function draw() {
    if (!st) return;
    if (st.phase === 'lobby' || st.phase === 'countdown') return msg('השיעור עוד לא התחיל. ממתינים להתחלה…');
    if (st.phase === 'ended') return msg('השיעור נגמר 👏');
    if (!st.lesson) return msg('מסך המציג עובד במשחק "שיעור" בלבד.');
    const notes = st.notes ? `<div class="pr-notes">${esc(st.notes).replace(/\n/g, '<br>')}</div>` : '<div class="pr-notes none">אין הערות לשלב הזה</div>';
    const r = st.reacts;
    const bad = r ? r.unsure + r.ask : 0;
    const warn = r && r.n >= 2 && bad / r.n >= 0.3;
    const meter = r
      ? `<div class="pr-meter ${warn ? 'warn' : ''}"><span>👍 ${r.got}</span><span>🤔 ${r.unsure}</span><span>🙋 ${r.ask}</span>${warn ? '<b>⚠️ חלק מהכיתה לא איתך</b>' : ''}</div>`
      : st.answered || st.students ? `<div class="pr-meter"><span>✔ ${st.answered} מתוך ${st.students} ענו</span></div>` : '';
    const nx = st.next
      ? `<div class="pr-next"><small>הבא בתור</small><b>${ICON[st.next.type] || '🎯'} ${esc(st.next.label)}</b>${st.next.notes ? `<p>${esc(st.next.notes).slice(0, 220)}</p>` : ''}</div>`
      : '<div class="pr-next"><small>הבא בתור</small><b>זה השלב האחרון</b></div>';
    const keep = document.getElementById('prJump');
    const jumpOpen = keep && document.activeElement === keep;
    if (jumpOpen) return; // do not redraw under a finger that is choosing from the list
    box.innerHTML = `
      <header class="pr-top"><span>שלב ${st.i + 1} מתוך ${st.total}</span><span>👥 ${st.students}</span></header>
      <div class="pr-bar"><i style="width:${Math.round(((st.i + 1) / Math.max(1, st.total)) * 100)}%"></i></div>
      <section class="pr-cur"><small>${ICON[st.type] || '🎯'} עכשיו על המסך</small><h1>${esc(st.label)}</h1>${notes}</section>
      ${meter}
      ${nx}
      <select id="prJump" aria-label="קפיצה לשלב">${st.outline.map((t, i) => `<option value="${i}" ${i === st.i ? 'selected' : ''}>${i + 1}. ${esc(t)}</option>`).join('')}</select>
      <footer class="pr-btns"><button id="prPrev" ${st.i <= 0 ? 'disabled' : ''}>◀ קודם</button><button id="prNext" class="go">${st.last ? 'סיום' : 'הבא ▶'}</button></footer>`;
    document.getElementById('prPrev').onclick = () => cmd('prev');
    document.getElementById('prNext').onclick = () => cmd('next');
    document.getElementById('prJump').onchange = (e) => { cmd('goto', Number(e.target.value)); e.target.blur(); };
  }

  addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); cmd('next'); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); cmd('prev'); }
  });
})();
