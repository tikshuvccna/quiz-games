// Renders one question on the phone for every question type and calls onAnswer(data) once.
//   quiz / tf : { choice } or { choices: [] } for multi-select
//   type      : { text }
//   slider    : { value }
//   order     : { order: [displayed indexes in the chosen order] }
//   pin / drop: { x, y } in percent of the picture
//   poll      : { choice } or { choices: [] } when it is multi-select
//   cloud / open / brain / qna : { words: [text, ...] } up to q.limit
//   match     : { match: [displayed right item for each left item] }
//   sort      : { sort: [bucket index for each displayed item] }
//   rate      : { value } 1..q.scale.max
//   rank      : { order: [displayed indexes in the chosen order] }
//   puzzle    : { order: [piece in each cell] }
window.QView = (function () {
  const { esc } = U;
  const POINTS_LABEL = { 0: 'ללא ניקוד', 2: 'ניקוד כפול ×2', 3: 'ניקוד משולש ×3', 4: 'ניקוד מרובע ×4' };

  // the picture (with its reveal) and the question video; the classic quiz plays videos on the big screen only
  const media = (q, noVideo) =>
    (q.video && !noVideo ? QMedia.video(q.video, { autoplay: true, muted: true }) : '') +
    (q.image && q.type !== 'pin' && q.type !== 'puzzle' && q.type !== 'drop' ? QMedia.picture(q.image, { reveal: q.reveal, revealSec: q.revealSec }) : '');

  function render(box, q, opts) {
    draw(box, q, opts);
    QMedia.mount(box);
    if (window.A11y) A11y.decorate(box, q); // a 🔊 on the question, and read aloud if the student chose it
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
        <div class="answers n${n} ${q.type === 'tf' ? 'tf' : ''} ${q.optionImages ? 'pics' : ''}">${q.options.map((o, i) => {
          const pic = q.optionImages && q.optionImages[i];
          return `<button class="ans ${pic ? 'has-pic' : ''}" data-i="${i}" style="--i:${i}">${Art.shape(q.type === 'tf' ? i * 3 : i)}${pic ? `<img class="ans-pic" src="${esc(pic)}" alt="">` : ''}${o ? `<span>${esc(o)}</span>` : ''}</button>`;
        }).join('')}</div>
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

    if (q.type === 'order' || q.type === 'rank') {
      let order = q.items.map((_, i) => i);
      let pick = -1;
      const draw = () => {
        box.querySelector('#qo').innerHTML = order.map((d, pos) => `<button class="qo-item ${pick === pos ? 'pick' : ''}" data-pos="${pos}" style="--i:${d}"><span class="qo-n">${pos + 1}</span><span class="qo-t">${esc(q.items[d])}</span><span class="qo-mv"><i data-mv="-1">▲</i><i data-mv="1">▼</i></span></button>`).join('');
      };
      box.innerHTML = `${head}<div class="q-hint">${q.type === 'rank' ? 'סדרו לפי ההעדפה שלכם, הכי חשוב למעלה: לחצו על שני פריטים כדי להחליף ביניהם' : 'סדרו בסדר הנכון: לחצו על שני פריטים כדי להחליף ביניהם'}</div><div class="q-order" id="qo"></div><button class="btn big" id="qoSend">שלחו ✓</button>`;
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

    if (q.type === 'cloud' || q.type === 'open' || q.type === 'brain' || q.type === 'qna') {
      const long = q.type === 'open';
      const max = { cloud: 30, open: 200, brain: 120, qna: 150 }[q.type];
      const hint = { cloud: q.limit > 1 ? `כתבו עד ${q.limit} מילים או ביטויים קצרים` : 'כתבו מילה או ביטוי קצר', open: 'כתבו את התשובה שלכם', brain: q.limit > 1 ? `שלחו עד ${q.limit} רעיונות` : 'שלחו רעיון', qna: q.limit > 1 ? `שלחו עד ${q.limit} שאלות לכיתה` : 'שלחו שאלה לכיתה' }[q.type];
      const place = { cloud: 'מילה…', open: 'התשובה שלכם…', brain: 'רעיון…', qna: 'השאלה שלכם…' }[q.type];
      box.innerHTML = `${head}<div class="q-hint">${hint}</div>
        <form class="q-words" id="qf" autocomplete="off">${Array.from({ length: q.limit }, (_, i) => (long
          ? `<textarea class="input big-in" rows="3" maxlength="${max}" placeholder="${place}"></textarea>`
          : `<input class="input big-in" maxlength="${max}" placeholder="${place}${q.limit > 1 ? ' ' + (i + 1) : ''}" enterkeyhint="${i === q.limit - 1 ? 'send' : 'next'}">`)).join('')}
          <button class="btn big" type="submit">שלחו ✓</button></form>`;
      const fields = [...box.querySelectorAll('.big-in')];
      setTimeout(() => fields[0].focus(), 250);
      box.querySelector('#qf').onsubmit = (e) => {
        e.preventDefault();
        const words = fields.map((f) => f.value.trim()).filter(Boolean);
        if (!words.length) return U.shake(fields[0]);
        fields.forEach((f) => (f.disabled = true));
        send({ words });
      };
      return;
    }

    if (q.type === 'match') {
      const PAL = ['#e9334f', '#1f73e0', '#e6a400', '#23a14a', '#8b5cf6', '#0fa3b8'];
      const n = q.left.length;
      const pair = Array(n).fill(-1); // left item → right item
      let pick = -1;
      const paint = () => {
        box.querySelector('#qm').innerHTML = `<div class="qm-col">${q.left.map((t, i) => `<button class="qm-it ${pick === i ? 'pick' : ''} ${pair[i] >= 0 ? 'paired' : ''}" data-l="${i}" style="--c:${PAL[i]}">${esc(t)}</button>`).join('')}</div>
          <div class="qm-col">${q.right.map((t, j) => { const li = pair.indexOf(j); return `<button class="qm-it ${li >= 0 ? 'paired' : ''}" data-r="${j}" style="--c:${li >= 0 ? PAL[li] : '#6b6597'}">${esc(t)}</button>`; }).join('')}</div>`;
        box.querySelector('#qmSend').disabled = pair.includes(-1);
      };
      box.innerHTML = `${head}<div class="q-hint">לחצו על פריט מימין ואז על הפריט שמתאים לו משמאל</div><div class="q-match" id="qm"></div><button class="btn big" id="qmSend" disabled>שלחו ✓</button>`;
      paint();
      box.querySelector('#qm').onclick = (e) => {
        if (sent) return;
        const l = e.target.closest('[data-l]');
        const r = e.target.closest('[data-r]');
        if (l) {
          const i = Number(l.dataset.l);
          // a connected item lets go of its partner; tapping the selected one again keeps it selected
          if (pair[i] >= 0) pair[i] = -1;
          pick = i;
        } else if (r) {
          const j = Number(r.dataset.r);
          const owner = pair.indexOf(j);
          if (pick >= 0) {
            if (owner >= 0) pair[owner] = -1;
            pair[pick] = j;
            pick = pair.findIndex((v) => v < 0);
          } else if (owner >= 0) { pair[owner] = -1; pick = owner; }
        } else return;
        U.sfx('tick');
        paint();
      };
      box.querySelector('#qmSend').onclick = () => { if (!pair.includes(-1)) send({ match: pair }); };
      return;
    }

    if (q.type === 'sort') {
      const PAL = ['#e9334f', '#1f73e0', '#23a14a'];
      const at = Array(q.items.length).fill(-1);
      const paint = () => {
        box.querySelector('#qs').innerHTML = q.items.map((t, i) => `<div class="qs-row ${at[i] >= 0 ? 'done' : ''}"><span class="t">${esc(t)}</span><span class="qs-b">${q.buckets.map((b, k) => `<button data-i="${i}" data-k="${k}" class="${at[i] === k ? 'on' : ''}" style="--c:${PAL[k]}">${esc(b)}</button>`).join('')}</span></div>`).join('');
        box.querySelector('#qsSend').disabled = at.includes(-1);
      };
      box.innerHTML = `${head}<div class="q-hint">לכל פריט בחרו את הקבוצה שלו</div><div class="q-sort" id="qs"></div><button class="btn big" id="qsSend" disabled>שלחו ✓</button>`;
      paint();
      box.querySelector('#qs').onclick = (e) => {
        const b = e.target.closest('[data-k]');
        if (!b || sent) return;
        at[Number(b.dataset.i)] = Number(b.dataset.k);
        U.sfx('tick');
        paint();
      };
      box.querySelector('#qsSend').onclick = () => { if (!at.includes(-1)) send({ sort: at }); };
      return;
    }

    if (q.type === 'tap') {
      // the running count goes to the server every moment (not once): the race lasts the whole time
      let n = 0;
      let sentN = -1;
      box.innerHTML = `${head}<div class="q-hint">הקישו כמה שיותר מהר!</div><button class="tap-btn" id="tapB" type="button"><b id="tapN">0</b><span>👆</span></button>`;
      const btn = box.querySelector('#tapB');
      const num = box.querySelector('#tapN');
      const flush = () => { if (!box.isConnected) return clearInterval(iv); if (n !== sentN) { sentN = n; onAnswer({ taps: n }); } };
      const iv = setInterval(flush, 300);
      btn.onpointerdown = (e) => {
        e.preventDefault();
        n++;
        num.textContent = n;
        btn.classList.remove('hit');
        void btn.offsetWidth;
        btn.classList.add('hit');
        if (n % 10 === 0 && navigator.vibrate) navigator.vibrate(8);
      };
      return;
    }

    if (q.type === 'rate') {
      const { max, low, high } = q.scale;
      box.innerHTML = `${head}<div class="q-hint">${max === 5 ? 'לחצו על הדירוג שלכם' : `דרגו מ־1 עד ${max}`}</div>
        <div class="q-rate n${max}" dir="ltr">${Array.from({ length: max }, (_, i) => `<button class="rate-b" data-v="${i + 1}" style="--i:${i}">${max === 5 ? '<span class="st">★</span>' : ''}<b>${i + 1}</b></button>`).join('')}</div>
        ${low || high ? `<div class="rate-ends" dir="ltr"><span>${esc(low)}</span><span>${esc(high)}</span></div>` : ''}`;
      const row = box.querySelector('.q-rate');
      row.onclick = (e) => {
        const b = e.target.closest('.rate-b');
        if (!b || sent) return;
        const v = Number(b.dataset.v);
        // fill everything up to the chosen value
        row.querySelectorAll('.rate-b').forEach((x) => x.classList.toggle('on', Number(x.dataset.v) <= v));
        send({ value: v });
      };
      return;
    }

    if (q.type === 'pin' || q.type === 'drop') {
      box.innerHTML = `<div class="q-meta">${meta}${pts}</div><div class="q-card">${esc(q.text)}</div>
        <div class="q-hint">${q.type === 'drop' ? 'הניחו סיכה בכל מקום בתמונה' : 'לחצו על המקום הנכון בתמונה'}</div>
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
