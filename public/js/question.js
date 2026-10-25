// Renders one question on the phone for every question type and calls onAnswer(data) once.
//   quiz / tf : { choice } or { choices: [] } for multi-select
//   type      : { text }
//   slider    : { value }
//   order     : { order: [displayed indexes in the chosen order] }
//   pin       : { x, y } in percent of the picture
//   puzzle    : { order: [piece in each cell] }
window.QView = (function () {
  const { esc } = U;
  const POINTS_LABEL = { 0: 'ללא ניקוד', 2: 'ניקוד כפול ×2', 3: 'ניקוד משולש ×3', 4: 'ניקוד מרובע ×4' };

  // the picture (with its reveal) and the question video; the classic quiz plays videos on the big screen only
  const media = (q, noVideo) =>
    (q.video && !noVideo ? QMedia.video(q.video, { autoplay: true, muted: true }) : '') +
    (q.image && q.type !== 'pin' && q.type !== 'puzzle' ? QMedia.picture(q.image, { reveal: q.reveal, revealSec: q.revealSec }) : '');

  function render(box, q, opts) {
    draw(box, q, opts);
    QMedia.mount(box);
    if (q.points >= 2 && !opts.noSplash) U.multSplash(box.closest('.screen') || box, q.points, false);
  }

  function draw(box, q, { meta = '', onAnswer, noVideo = false }) {
    let sent = false;
    const send = (data) => {
      if (sent) return false;
      sent = true;
      box.classList.add('sent');
      U.sfx('pop');
      if (navigator.vibrate) navigator.vibrate(10);
      onAnswer(data);
      return true;
    };
    const pts = POINTS_LABEL[q.points] ? `<span class="pts-chip p${q.points}">${POINTS_LABEL[q.points]}</span>` : '';
    const head = `<div class="q-meta">${meta}${pts}</div><div class="q-card ${q.image ? 'has-img' : ''}">${esc(q.text)}</div>${media(q, noVideo)}`;

    if (q.type === 'quiz' || q.type === 'tf' || q.type === 'poll') {
      const n = q.options.length;
      box.innerHTML = `${head}
        ${q.multi ? '<div class="q-hint">אפשר לבחור יותר מתשובה אחת</div>' : ''}
        <div class="answers n${n} ${q.type === 'tf' ? 'tf' : ''}">${q.options.map((o, i) => `<button class="ans" data-i="${i}" style="--i:${i}">${Art.shape(q.type === 'tf' ? i * 3 : i)}<span>${esc(o)}</span></button>`).join('')}</div>
        ${q.multi ? '<button class="btn big q-send" id="qSend" disabled>שלחו ✓</button>' : ''}`;
      const grid = box.querySelector('.answers');
      grid.onclick = (e) => {
        const b = e.target.closest('.ans');
        if (!b || sent) return;
        if (q.multi) {
          b.classList.toggle('picked');
          grid.classList.toggle('some', !!grid.querySelector('.picked'));
          box.querySelector('#qSend').disabled = !grid.querySelector('.picked');
          U.sfx('tick');
          return;
        }
        grid.classList.add('locked');
        b.classList.add('picked');
        send({ choice: Number(b.dataset.i) });
      };
      if (q.multi) {
        box.querySelector('#qSend').onclick = () => {
          const picks = [...grid.querySelectorAll('.picked')].map((b) => Number(b.dataset.i));
          if (!picks.length) return;
          grid.classList.add('locked');
          send({ choices: picks });
        };
      }
      return;
    }

    if (q.type === 'type') {
      box.innerHTML = `${head}
        <form class="q-type" id="qf" autocomplete="off">
          <input class="input big-in" id="qt" maxlength="40" placeholder="הקלידו את התשובה" enterkeyhint="send">
          <button class="btn big" type="submit">שלחו ✓</button>
        </form>`;
      const inp = box.querySelector('#qt');
      setTimeout(() => inp.focus(), 250);
      box.querySelector('#qf').onsubmit = (e) => {
        e.preventDefault();
        const t = inp.value.trim();
        if (!t) return U.shake(inp);
        inp.disabled = true;
        send({ text: t });
      };
      return;
    }

    if (q.type === 'slider') {
      const { min, max, step } = q.slider;
      const start = Math.round((min + max) / 2 / step) * step;
      const fmt = (v) => (Number.isInteger(step) ? String(Math.round(v)) : Number(v).toFixed(String(step).split('.')[1]?.length || 1));
      box.innerHTML = `${head}
        <div class="q-slider">
          <div class="qs-val" id="qsv">${fmt(start)}</div>
          <input type="range" id="qs" min="${min}" max="${max}" step="${step}" value="${start}">
          <div class="qs-ends"><span>${fmt(min)}</span><span>${fmt(max)}</span></div>
          <button class="btn big" id="qsSend">שלחו ✓</button>
        </div>`;
      const r = box.querySelector('#qs');
      r.oninput = () => (box.querySelector('#qsv').textContent = fmt(r.value));
      box.querySelector('#qsSend').onclick = () => { r.disabled = true; send({ value: Number(r.value) }); };
      return;
    }

    if (q.type === 'order') {
      let order = q.items.map((_, i) => i);
      let pick = -1;
      const draw = () => {
        box.querySelector('#qo').innerHTML = order.map((d, pos) => `<button class="qo-item ${pick === pos ? 'pick' : ''}" data-pos="${pos}" style="--i:${d}"><span class="qo-n">${pos + 1}</span><span class="qo-t">${esc(q.items[d])}</span><span class="qo-mv"><i data-mv="-1">▲</i><i data-mv="1">▼</i></span></button>`).join('');
      };
      box.innerHTML = `${head}<div class="q-hint">סדרו בסדר הנכון: לחצו על שני פריטים כדי להחליף ביניהם</div><div class="q-order" id="qo"></div><button class="btn big" id="qoSend">שלחו ✓</button>`;
      draw();
      box.querySelector('#qo').onclick = (e) => {
        if (sent) return;
        const it = e.target.closest('.qo-item');
        if (!it) return;
        const pos = Number(it.dataset.pos);
        const mv = e.target.closest('[data-mv]');
        if (mv) {
          const to = pos + Number(mv.dataset.mv);
          if (to >= 0 && to < order.length) [order[pos], order[to]] = [order[to], order[pos]];
          pick = -1;
        } else if (pick < 0) pick = pos;
        else {
          [order[pick], order[pos]] = [order[pos], order[pick]];
          pick = -1;
        }
        U.sfx('tick');
        draw();
      };
      box.querySelector('#qoSend').onclick = () => send({ order });
      return;
    }

    if (q.type === 'pin') {
      box.innerHTML = `<div class="q-meta">${meta}${pts}</div><div class="q-card">${esc(q.text)}</div>
        <div class="q-hint">לחצו על המקום הנכון בתמונה</div>
        <div class="q-pin" id="qp"><div class="pin-frame" id="pf"><img src="${esc(q.image)}" alt=""><i class="pin-mark hidden" id="pm"></i></div></div>
        <button class="btn big" id="qpSend" disabled>שלחו ✓</button>`;
      const frame = box.querySelector('#pf');
      const mark = box.querySelector('#pm');
      U.fitImage(frame, frame.querySelector('img'));
      let at = null;
      frame.onclick = (e) => {
        if (sent) return;
        const r = frame.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 100;
        const y = ((e.clientY - r.top) / r.height) * 100;
        if (x < 0 || y < 0 || x > 100 || y > 100) return;
        at = { x, y };
        mark.classList.remove('hidden');
        mark.style.left = x + '%';
        mark.style.top = y + '%';
        U.bump(mark, 'pin-drop'); // not 'drop': the gems game owns that class
        box.querySelector('#qpSend').disabled = false;
      };
      box.querySelector('#qpSend').onclick = () => at && send(at);
      return;
    }

    if (q.type === 'puzzle') {
      box.innerHTML = `<div class="q-meta">${meta}${pts}</div><div class="q-card">${esc(q.text)}</div>
        <div class="q-hint">גררו כל חלק למקום שלו (או לחצו על חלק ואז על משבצת)</div>
        <div class="q-puzzle" id="qz"></div>
        <button class="btn big" id="qzSend" disabled>שלחו ✓</button>`;
      const btn = box.querySelector('#qzSend');
      let order = null;
      QMedia.jigsaw(box.querySelector('#qz'), q, {
        locked: () => sent,
        onChange: (o) => { order = o; btn.disabled = !o; },
      });
      btn.onclick = () => order && send({ order });
      return;
    }

    box.innerHTML = `${head}<div class="q-hint">סוג שאלה לא נתמך</div>`;
  }

  return { render };
})();
