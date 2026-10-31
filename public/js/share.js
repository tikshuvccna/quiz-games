// Screen sharing (WebRTC; the server only passes the handshake along).
//  - The teacher shares their screen with the class: the teacher's page sends a stream to every phone that watches.
//  - The teacher asks a student to share: a screen on a computer, the camera on a phone (a "document camera"). The stream
//    arrives on the teacher's page, which can also show it to the whole class.
// Capturing a screen or a camera needs a secure context (https, or localhost): the teacher's own page on the host computer
// has that; a student's phone on a plain http address does not, so asking a student works online or with SSL_KEY / SSL_CERT.
// Watching needs nothing special.
window.Share = (function () {
  let socket = null;
  let iceCache = null;
  const isHost = document.documentElement.classList.contains('host');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  async function ice() {
    if (iceCache) return iceCache;
    try { iceCache = (await (await fetch('/api/ice')).json()).iceServers || []; } catch { iceCache = []; }
    return iceCache;
  }
  const newPC = async () => new RTCPeerConnection({ iceServers: await ice() });
  const toast = (text, ms = 3500) => {
    const t = document.createElement('div');
    t.className = 'p-toast';
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
  };
  // candidates that arrive before the other side's description is set wait here
  const addCand = async (rec, cand) => {
    if (!cand) return;
    if (rec.pc.remoteDescription) await rec.pc.addIceCandidate(cand).catch(() => {});
    else rec.queue.push(cand);
  };
  const flush = async (rec) => { for (const c of rec.queue.splice(0)) await rec.pc.addIceCandidate(c).catch(() => {}); };
  const supportsScreen = () => !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);

  // =====================================================================================================
  // the teacher's page
  // =====================================================================================================
  const H = { source: null, kind: '', viewers: new Map(), incoming: new Map() };

  function limitBitrate() {
    // the more phones watch, the less each picture may take (a classroom Wi-Fi is shared)
    const kbps = H.viewers.size > 15 ? 450 : H.viewers.size > 8 ? 800 : 1500;
    for (const pc of H.viewers.values()) {
      pc.getSenders().forEach((s) => {
        try {
          const p = s.getParameters();
          if (!p.encodings || !p.encodings.length) p.encodings = [{}];
          p.encodings[0].maxBitrate = kbps * 1000;
          s.setParameters(p).catch(() => {});
        } catch {}
      });
    }
  }

  function closeViewer(pid) {
    const pc = H.viewers.get(pid);
    if (pc) { try { pc.close(); } catch {} H.viewers.delete(pid); }
    if (H.recs) H.recs.delete(pid);
  }

  function stopBroadcast(tellServer = true) {
    if (H.source && H.kind === 'screen') H.source.getTracks().forEach((t) => t.stop()); // our own screen capture ends; a student's stays theirs
    H.source = null;
    H.kind = '';
    for (const pid of [...H.viewers.keys()]) closeViewer(pid);
    if (tellServer) socket.emit('share:stop');
    drawBar();
  }

  function startBroadcast(stream, kind, name) {
    stopBroadcast(false);
    H.source = stream;
    H.kind = kind;
    const v = stream.getVideoTracks()[0];
    if (v) v.addEventListener('ended', () => { if (H.source === stream) stopBroadcast(); });
    socket.emit('share:start', { source: kind === 'screen' ? 'host' : 'student', name: name || '' });
    drawBar();
  }

  async function startScreen() {
    if (!supportsScreen()) return toast('הדפדפן הזה לא יודע לשתף מסך');
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false });
      startBroadcast(s, 'screen');
    } catch { /* the teacher closed the picker */ }
  }

  // a phone is ready to watch: send it the stream
  async function onViewer({ pid }) {
    if (!H.source) return;
    closeViewer(pid);
    const rec = { pc: await newPC(), queue: [] };
    H.viewers.set(pid, rec.pc);
    H.recs = H.recs || new Map();
    H.recs.set(pid, rec);
    H.source.getTracks().forEach((t) => rec.pc.addTrack(t, H.source));
    rec.pc.onicecandidate = (e) => e.candidate && socket.emit('share:signal', { to: pid, data: { role: 'view', cand: e.candidate } });
    rec.pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(rec.pc.connectionState)) closeViewer(pid); };
    const offer = await rec.pc.createOffer();
    await rec.pc.setLocalDescription(offer);
    socket.emit('share:signal', { to: pid, data: { role: 'view', sdp: rec.pc.localDescription } });
    limitBitrate();
    drawBar();
  }

  // ---- a student shares with the teacher ----
  function closeIncoming(pid, tell) {
    const rec = H.incoming.get(pid);
    if (!rec) return;
    if (tell) socket.emit('share:signal', { to: pid, data: { role: 'present', stop: true } });
    try { rec.pc.close(); } catch {}
    H.incoming.delete(pid);
    if (H.source && H.source === rec.stream) stopBroadcast();
    document.getElementById('shStudent')?.remove();
  }

  function showStudent(pid, rec) {
    document.getElementById('shStudent')?.remove();
    const m = document.createElement('div');
    m.id = 'shStudent';
    m.className = 'sh-student';
    m.innerHTML = `<div class="sh-st-top"><b>📡 ${esc(rec.name)} משתף/ת</b><span class="sh-st-btns"><button class="btn sm" id="shAll">📺 הציגו לכל הכיתה</button><button class="btn sm ghost" id="shEnd">✕ סיום</button></span></div><video autoplay playsinline muted></video>`;
    document.body.appendChild(m);
    m.querySelector('video').srcObject = rec.stream;
    m.querySelector('#shEnd').onclick = () => closeIncoming(pid, true);
    m.querySelector('#shAll').onclick = () => {
      startBroadcast(rec.stream, 'student', rec.name);
      m.querySelector('#shAll').textContent = '📺 מוצג לכיתה';
      m.querySelector('#shAll').disabled = true;
    };
  }

  async function onPresentSignal(pid, name, data) {
    if (data.sdp && data.sdp.type === 'offer') {
      closeIncoming(pid, false);
      const rec = { pc: await newPC(), queue: [], stream: null, name };
      H.incoming.set(pid, rec);
      rec.pc.ontrack = (e) => { rec.stream = e.streams[0]; showStudent(pid, rec); };
      rec.pc.onicecandidate = (e) => e.candidate && socket.emit('share:signal', { to: pid, data: { role: 'present', cand: e.candidate } });
      rec.pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(rec.pc.connectionState)) closeIncoming(pid, false); };
      await rec.pc.setRemoteDescription(data.sdp);
      await flush(rec);
      const ans = await rec.pc.createAnswer();
      await rec.pc.setLocalDescription(ans);
      socket.emit('share:signal', { to: pid, data: { role: 'present', sdp: rec.pc.localDescription } });
    } else if (data.cand) {
      const rec = H.incoming.get(pid);
      if (rec) await addCand(rec, data.cand);
    } else if (data.stop) closeIncoming(pid, false);
  }

  function askModal() {
    document.getElementById('shAsk')?.remove();
    const players = (typeof st !== 'undefined' && st && st.players ? st.players : []).filter((p) => p.connected);
    const m = document.createElement('div');
    m.className = 'modal';
    m.id = 'shAsk';
    m.innerHTML = `<div class="modal-card" style="max-width:420px"><div class="modal-head"><h2>🎥 בקשו מתלמיד לשתף</h2><div class="modal-actions"><button class="btn sm ghost" id="shAskX">✕</button></div></div>
      <div class="modal-body"><p class="muted">התלמיד יראה בקשה בטלפון ויבחר אם לשתף מסך (במחשב) או מצלמה (בטלפון). שיתוף דורש חיבור מאובטח (https).</p>
      <div class="sh-list">${players.length ? players.map((p) => `<button class="sh-pick" data-pid="${esc(p.id)}">${esc(p.name)}</button>`).join('') : '<span class="muted">אין תלמידים מחוברים</span>'}</div></div></div>`;
    document.body.appendChild(m);
    m.onclick = (e) => {
      if (e.target === m || e.target.id === 'shAskX') return m.remove();
      const b = e.target.closest('[data-pid]');
      if (b) { socket.emit('share:ask', { pid: b.dataset.pid }); toast(`נשלחה בקשה ל${b.textContent}`); m.remove(); }
    };
  }

  // the little control bar on the teacher's page
  function drawBar() {
    if (!isHost) return;
    let bar = document.getElementById('shareBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'shareBar';
      bar.className = 'share-bar';
      document.body.appendChild(bar);
      bar.onclick = (e) => {
        const a = e.target.closest('[data-sh]');
        if (!a) return;
        if (a.dataset.sh === 'screen') startScreen();
        else if (a.dataset.sh === 'stop') stopBroadcast();
        else if (a.dataset.sh === 'ask') askModal();
      };
    }
    const on = !!H.source;
    bar.innerHTML = on
      ? `<span class="sh-live" title="${H.kind === 'screen' ? 'המסך שלכם משותף עם הכיתה' : 'מוצג לכיתה'}">🔴<small>${H.viewers.size}</small></span><button class="btn sm" data-sh="stop" title="עצירת השיתוף">⏹</button>`
      : `<button class="btn sm ghost" data-sh="screen" title="שיתוף המסך שלכם עם הכיתה (בטלפונים)">📺</button><button class="btn sm ghost" data-sh="ask" title="בקשה מתלמיד לשתף מסך או מצלמה">🎥</button>`;
  }

  // =====================================================================================================
  // a student's phone
  // =====================================================================================================
  const P = { key: '', view: null, queue: [], pc: null, present: null };

  function closeView() {
    if (P.pc) { try { P.pc.close(); } catch {} P.pc = null; }
    document.getElementById('shView')?.remove();
    document.getElementById('shPill')?.remove();
  }

  function openView(s) {
    closeView();
    const el = document.createElement('div');
    el.id = 'shView';
    el.className = 'sh-view';
    el.innerHTML = `<div class="sh-top"><span>📺 ${s.source === 'host' ? 'המורה משתף/ת מסך' : `${esc(s.name || 'תלמיד/ה')} משתף/ת`}</span><span><button id="shFull" title="מסך מלא">⛶</button><button id="shMin" title="הסתרה">✕</button></span></div><video autoplay playsinline muted></video><div class="sh-wait" id="shWait">מתחברים…</div>`;
    document.body.appendChild(el);
    el.querySelector('#shMin').onclick = () => {
      el.classList.add('hidden');
      const pill = document.createElement('button');
      pill.id = 'shPill';
      pill.className = 'sh-pill';
      pill.textContent = '📺 חזרה לשיתוף';
      pill.onclick = () => { el.classList.remove('hidden'); pill.remove(); };
      document.body.appendChild(pill);
    };
    el.querySelector('#shFull').onclick = () => { const v = el.querySelector('video'); (v.requestFullscreen || v.webkitRequestFullscreen || (() => {})).call(v); };
    P.view = el;
    socket.emit('share:watch');
  }

  function syncState(s) {
    const key = s ? s.source + ':' + (s.name || '') : '';
    if (key === P.key) return;
    P.key = key;
    if (!s) return closeView();
    openView(s);
  }

  async function onViewSignal(data) {
    if (data.sdp && data.sdp.type === 'offer') {
      if (P.pc) { try { P.pc.close(); } catch {} }
      const rec = { pc: await newPC(), queue: [] };
      P.pc = rec.pc;
      P.rec = rec;
      rec.pc.ontrack = (e) => {
        const v = P.view && P.view.querySelector('video');
        if (v) { v.srcObject = e.streams[0]; v.play().catch(() => {}); }
        P.view && P.view.querySelector('#shWait')?.remove();
      };
      rec.pc.onicecandidate = (e) => e.candidate && socket.emit('share:signal', { data: { role: 'view', cand: e.candidate } });
      await rec.pc.setRemoteDescription(data.sdp);
      await flush(rec);
      const ans = await rec.pc.createAnswer();
      await rec.pc.setLocalDescription(ans);
      socket.emit('share:signal', { data: { role: 'view', sdp: rec.pc.localDescription } });
    } else if (data.cand && P.rec) await addCand(P.rec, data.cand);
  }

  // ---- the teacher asked this student to share ----
  function endPresent(tell) {
    const r = P.present;
    if (!r) return;
    r.stream.getTracks().forEach((t) => t.stop());
    try { r.pc.close(); } catch {}
    P.present = null;
    document.getElementById('shMine')?.remove();
  }

  async function startPresent(kind, given) {
    const secure = given || (window.isSecureContext && navigator.mediaDevices);
    if (!secure) {
      socket.emit('share:reply', { accept: false, reason: 'insecure' });
      return toast('השיתוף לא זמין בכתובת הזאת (צריך חיבור מאובטח)', 5000);
    }
    let stream = given;
    if (!stream) try {
      stream = kind === 'screen'
        ? await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 12 }, audio: false })
        : await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    } catch {
      return socket.emit('share:reply', { accept: false, reason: 'denied' });
    }
    socket.emit('share:reply', { accept: true });
    endPresent();
    const rec = { pc: await newPC(), queue: [], stream };
    P.present = rec;
    stream.getTracks().forEach((t) => rec.pc.addTrack(t, stream));
    rec.pc.onicecandidate = (e) => e.candidate && socket.emit('share:signal', { data: { role: 'present', cand: e.candidate } });
    const v = stream.getVideoTracks()[0];
    if (v) v.addEventListener('ended', () => { socket.emit('share:signal', { data: { role: 'present', stop: true } }); endPresent(); });
    const offer = await rec.pc.createOffer();
    await rec.pc.setLocalDescription(offer);
    socket.emit('share:signal', { data: { role: 'present', sdp: rec.pc.localDescription } });
    const pill = document.createElement('div');
    pill.id = 'shMine';
    pill.className = 'sh-mine';
    pill.innerHTML = `<span>📡 משתפים עם המורה</span><button class="btn sm">⏹ עצירה</button>`;
    pill.querySelector('button').onclick = () => { socket.emit('share:signal', { data: { role: 'present', stop: true } }); endPresent(); };
    document.body.appendChild(pill);
  }

  function askPrompt() {
    document.getElementById('shPrompt')?.remove();
    const m = document.createElement('div');
    m.id = 'shPrompt';
    m.className = 'sh-prompt';
    const screen = supportsScreen();
    const cam = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    m.innerHTML = `<div class="sh-card"><h2>🎥 המורה מבקש/ת שתשתפו</h2><p>הכיתה והמורה יראו מה שתשתפו.</p>
      ${screen ? '<button class="btn big" data-k="screen">💻 שיתוף מסך</button>' : ''}${cam ? '<button class="btn big" data-k="camera">📷 שיתוף מצלמה</button>' : ''}
      <button class="btn ghost" data-k="no">לא עכשיו</button></div>`;
    document.body.appendChild(m);
    m.onclick = (e) => {
      const b = e.target.closest('[data-k]');
      if (!b) return;
      m.remove();
      if (b.dataset.k === 'no') socket.emit('share:reply', { accept: false, reason: 'no' });
      else startPresent(b.dataset.k);
    };
  }

  // =====================================================================================================
  function init(sock) {
    socket = sock;
    if (isHost) {
      socket.on('share:viewer', (d) => onViewer(d).catch(() => {}));
      socket.on('share:signal', async ({ from, name, data }) => {
        if (!data) return;
        try {
          if (data.role === 'view') {
            const rec = H.recs && H.recs.get(from);
            if (!rec) return;
            if (data.sdp) { await rec.pc.setRemoteDescription(data.sdp); await flush(rec); }
            if (data.cand) await addCand(rec, data.cand);
          } else if (data.role === 'present') await onPresentSignal(from, name, data);
        } catch (e) { console.warn('[share]', e); }
      });
      socket.on('share:reply', (r) => {
        if (r.accept) return toast(`${r.name} משתף/ת…`);
        toast(r.reason === 'insecure' ? `${r.name} לא יכול/ה לשתף בחיבור הזה (צריך https)` : r.reason === 'denied' ? `${r.name} לא אישר/ה את השיתוף בדפדפן` : `${r.name} סירב/ה כרגע`, 5000);
      });
      socket.on('connect', () => { H.source = null; H.kind = ''; H.viewers.clear(); drawBar(); });
      drawBar();
    } else {
      socket.on('share:state', syncState);
      socket.on('you', (y) => { if (y && y.share !== undefined) syncState(y.share); });
      socket.on('connect', () => { P.key = ''; });
      socket.on('share:ask', askPrompt);
      socket.on('share:signal', async ({ data }) => {
        if (!data) return;
        try {
          if (data.role === 'view') await onViewSignal(data);
          else if (data.role === 'present' && P.present) {
            if (data.stop) return endPresent();
            if (data.sdp) { await P.present.pc.setRemoteDescription(data.sdp); await flush(P.present); }
            if (data.cand) await addCand(P.present, data.cand);
          }
        } catch (e) { console.warn('[share]', e); }
      });
    }
  }

  // for the tests: a canvas stream stands in for a screen or a camera
  return { init, startScreen, _broadcast: (stream) => startBroadcast(stream, 'screen'), _present: (stream) => startPresent('screen', stream), stop: () => stopBroadcast(), state: () => ({ sharing: !!H.source, viewers: H.viewers.size }) };
})();
