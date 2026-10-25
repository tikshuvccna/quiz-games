// Question media shared by the phone, the big screen and the editor:
// picture reveals (blur / tiles), question videos (YouTube or an uploaded file) and real jigsaw pieces.
window.QMedia = (function () {
  const { esc } = U;

  // ---------- seeded random (the same puzzle on the big screen and every phone) ----------
  function rng(seed) {
    let a = seed >>> 0 || 1;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- picture with an optional reveal ----------
  // blur: starts blurred and zoomed and clears; tiles: covered by tiles that flip away one by one
  function picture(src, { reveal, revealSec = 20, cls = 'q-img', done = false, cover = '' } = {}) {
    if (!src) return '';
    const sec = Math.max(3, Number(revealSec) || 20);
    if (reveal === 'tiles' && !done) {
      const cols = 6;
      const rows = 4;
      const r = rng(Math.floor(Math.random() * 1e9));
      const n = cols * rows;
      // rank[tile] = when it flips away (a random order, not row by row)
      const rank = Array.from({ length: n }, (_, i) => i).sort(() => r() - 0.5);
      const tiles = rank.map((k, i) => `<i style="--d:${((k / n) * sec * 0.88).toFixed(2)}s;--h:${(i * 37) % 360}"></i>`).join('');
      return `<div class="${cls} rv-tiles" style="--rt:${sec}s"><div class="rv-frame"><img src="${esc(src)}" alt="">${cover}<div class="rv-grid" style="--c:${cols};--r:${rows}">${tiles}</div></div></div>`;
    }
    // the frame is sized to the picture's real proportions (mount), so tall or wide pictures are never cut
    return `<div class="${cls} ${reveal === 'blur' && !done ? 'reveal' : ''}" style="--rt:${sec}s"><div class="rv-frame"><img src="${esc(src)}" alt="">${cover}</div></div>`;
  }

  // after a picture is in the page: size its frame to the picture's real proportions inside the free space
  function mount(root) {
    (root || document).querySelectorAll('.rv-frame:not([data-fit])').forEach((f) => {
      f.dataset.fit = 1;
      U.fitImage(f, f.querySelector('img'));
    });
  }

  // the zone that counts as right on a pin question: a circle (radius in % of the width) or a rectangle
  function pinZone(pin, cls) {
    if (pin.shape === 'rect') return `<i class="${cls} rect" style="left:${pin.x - pin.w / 2}%;top:${pin.y - pin.h / 2}%;width:${pin.w}%;height:${pin.h}%"></i>`;
    return `<i class="${cls}" style="left:${pin.x}%;top:${pin.y}%;--r:${pin.r}"></i>`;
  }

  // ---------- video ----------
  // v: { id, start, end } (YouTube) or { url, start, end } (uploaded file)
  function video(v, { autoplay = true, muted = false, cls = 'q-video' } = {}) {
    if (!v) return '';
    if (v.id) {
      const q = new URLSearchParams({ autoplay: autoplay ? 1 : 0, mute: muted ? 1 : 0, rel: 0, modestbranding: 1, playsinline: 1, start: v.start || 0 });
      if (v.end) q.set('end', v.end);
      return `<div class="${cls}"><iframe src="https://www.youtube-nocookie.com/embed/${esc(v.id)}?${q}" title="סרטון" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
    }
    const frag = v.start || v.end ? `#t=${v.start || 0}${v.end ? ',' + v.end : ''}` : '';
    return `<div class="${cls}"><video src="${esc(v.url)}${frag}" ${autoplay ? 'autoplay' : ''} ${muted ? 'muted' : ''} controls playsinline preload="metadata"></video></div>`;
  }

  // ---------- jigsaw ----------
  // Knob direction of every inner edge: h[r][c] = edge under cell (r,c), v[r][c] = edge right of cell (r,c).
  // +1 = the knob sticks out downward / rightward.
  function cuts(rows, cols, seed) {
    const r = rng(seed);
    const h = Array.from({ length: rows - 1 }, () => Array.from({ length: cols }, () => (r() < 0.5 ? 1 : -1)));
    const v = Array.from({ length: rows }, () => Array.from({ length: cols - 1 }, () => (r() < 0.5 ? 1 : -1)));
    return { h, v };
  }

  // the outline of piece (row, col) in a cell of w×h, drawn around (0,0)…(w,h); knobs reach outside the cell
  function piecePath(row, col, rows, cols, cut, w, h) {
    const S = Math.min(w, h);
    const f = (n) => n.toFixed(2);
    // one side from (x0,y0) to (x1,y1); bump = +1 knob out, -1 hole in, 0 flat
    const side = (x0, y0, x1, y1, bump) => {
      if (!bump) return ` L${f(x1)} ${f(y1)}`;
      const L = Math.hypot(x1 - x0, y1 - y0);
      const dx = (x1 - x0) / L;
      const dy = (y1 - y0) / L;
      const nx = dy * bump; // outward normal of a clockwise outline
      const ny = -dx * bump;
      const P = (t, k) => {
        const a = L / 2 + (t - 0.5) * S;
        return `${f(x0 + dx * a + nx * k * S)} ${f(y0 + dy * a + ny * k * S)}`;
      };
      return ` L${P(0.34, 0)} C${P(0.4, 0)} ${P(0.43, 0.05)} ${P(0.39, 0.12)} C${P(0.33, 0.22)} ${P(0.41, 0.31)} ${P(0.5, 0.31)} C${P(0.59, 0.31)} ${P(0.67, 0.22)} ${P(0.61, 0.12)} C${P(0.57, 0.05)} ${P(0.6, 0)} ${P(0.66, 0)} L${f(x1)} ${f(y1)}`;
    };
    const top = row ? -cut.h[row - 1][col] : 0;
    const bottom = row < rows - 1 ? cut.h[row][col] : 0;
    const left = col ? -cut.v[row][col - 1] : 0;
    const right = col < cols - 1 ? cut.v[row][col] : 0;
    return `M0 0${side(0, 0, w, 0, top)}${side(w, 0, w, h, right)}${side(w, h, 0, h, bottom)}${side(0, h, 0, 0, left)} Z`;
  }

  let uid = 0;
  // one piece as an <svg>: the picture clipped to the piece outline, with a soft bevel
  // size: { w, h } of one cell in px; the svg is bigger by a margin m on every side (room for knobs)
  function pieceSvg(k, pz, src, size) {
    const { rows, cols } = pz;
    const row = Math.floor(k / cols);
    const col = k % cols;
    const { w, h } = size;
    const m = Math.min(w, h) * 0.34;
    const id = 'pz' + ++uid;
    const d = piecePath(row, col, rows, cols, pz.cut, w, h);
    return `<svg class="pz-svg" width="${w + 2 * m}" height="${h + 2 * m}" viewBox="${-m} ${-m} ${w + 2 * m} ${h + 2 * m}" aria-hidden="true">
      <defs><clipPath id="${id}"><path d="${d}"/></clipPath></defs>
      <g clip-path="url(#${id})"><image href="${esc(src)}" x="${-col * w}" y="${-row * h}" width="${cols * w}" height="${rows * h}" preserveAspectRatio="none"/></g>
      <path d="${d}" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="2.2" transform="translate(-.7 -.7)"/>
      <path d="${d}" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="1.6" transform="translate(.8 .9)"/>
    </svg>`;
  }

  // the full picture with the puzzle cuts drawn on it (big screen)
  function puzzleOutline(pz, src, W, H) {
    const { rows, cols } = pz;
    const cut = pz.cut || cuts(rows, cols, pz.seed);
    const w = W / cols;
    const h = H / rows;
    let paths = '';
    for (let k = 0; k < rows * cols; k++) {
      const r = Math.floor(k / cols);
      const c = k % cols;
      paths += `<path d="${piecePath(r, c, rows, cols, cut, w, h)}" transform="translate(${c * w} ${r * h})"/>`;
    }
    return `<svg class="pz-outline" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><image href="${esc(src)}" width="${W}" height="${H}" preserveAspectRatio="none"/><g fill="none" stroke="#fff" stroke-width="2.5" stroke-opacity=".9">${paths}</g><g fill="none" stroke="#000" stroke-width="1" stroke-opacity=".35" transform="translate(1.2 1.4)">${paths}</g></svg>`;
  }

  // load an image to learn its proportions
  function size(src) {
    return new Promise((res) => {
      const im = new Image();
      im.onload = () => res({ w: im.naturalWidth || 4, h: im.naturalHeight || 3 });
      im.onerror = () => res({ w: 4, h: 3 });
      im.src = src;
    });
  }

  // ---------- the jigsaw on the phone ----------
  // box: the element to fill; onDone(order) where order[cell] = piece placed there
  // Drag a piece onto a cell (or tap a piece, then tap a cell). A piece dropped on a full cell swaps.
  async function jigsaw(box, q, { onChange, locked } = {}) {
    const pz = { ...q.puzzle };
    pz.cut = cuts(pz.rows, pz.cols, pz.seed);
    const n = pz.rows * pz.cols;
    box.innerHTML = `<div class="pz"><div class="pz-board" id="pzBoard"></div><div class="pz-tray-wrap"><div class="pz-tray" id="pzTray"></div></div></div>`;
    const board = box.querySelector('#pzBoard');
    const tray = box.querySelector('#pzTray');
    const ratio = await size(q.image);
    // board size: fit the free space (phones: wide; keep the picture proportions)
    const free = box.getBoundingClientRect();
    const maxW = Math.min(free.width - 8, 520);
    const maxH = Math.max(150, Math.min(free.height * 0.6, 420));
    const s = Math.min(maxW / ratio.w, maxH / ratio.h);
    const W = Math.round(ratio.w * s);
    const H = Math.round(ratio.h * s);
    const cell = { w: W / pz.cols, h: H / pz.rows };
    const m = Math.min(cell.w, cell.h) * 0.34;
    board.style.width = W + 'px';
    board.style.height = H + 'px';
    board.innerHTML = Array.from({ length: n }, (_, k) => `<i class="pz-cell" data-cell="${k}" style="left:${(k % pz.cols) * cell.w}px;top:${Math.floor(k / pz.cols) * cell.h}px;width:${cell.w}px;height:${cell.h}px"></i>`).join('');
    // a faint ghost of the picture helps young players (like the box lid)
    board.insertAdjacentHTML('afterbegin', `<div class="pz-ghost" style="background-image:url('${esc(q.image).replace(/'/g, '%27')}')"></div>`);
    const at = new Array(n).fill(-1); // at[cell] = piece
    const where = new Array(n).fill(-1); // where[piece] = cell (-1 = tray)
    const r = rng(pz.seed ^ 0x5bd1e995);
    const order = Array.from({ length: n }, (_, i) => i).sort(() => r() - 0.5);
    const els = [];
    for (const k of order) {
      const el = document.createElement('div');
      el.className = 'pz-piece';
      el.dataset.k = k;
      el.style.setProperty('--m', m + 'px');
      el.innerHTML = pieceSvg(k, pz, q.image, cell);
      els[k] = el;
      tray.appendChild(el);
    }
    let sel = -1;
    const changed = () => {
      board.classList.toggle('full', at.every((x) => x >= 0));
      if (onChange) onChange(at.every((x) => x >= 0) ? at.slice() : null);
    };
    const place = (k, c) => {
      const el = els[k];
      const from = where[k];
      const other = c >= 0 ? at[c] : -1;
      if (from >= 0) at[from] = -1;
      if (other >= 0 && other !== k) {
        // swap: the piece already there goes where this one came from
        if (from >= 0) put(other, from);
        else unput(other);
      }
      if (c >= 0) put(k, c);
      else unput(k);
      U.sfx('tick');
      if (navigator.vibrate) navigator.vibrate(8);
      changed();
      function put(p, cc) {
        at[cc] = p;
        where[p] = cc;
        const e = els[p];
        if (e.parentElement !== board) board.appendChild(e);
        e.classList.add('on-board');
        e.style.left = (cc % pz.cols) * cell.w - m + 'px';
        e.style.top = Math.floor(cc / pz.cols) * cell.h - m + 'px';
        U.bump(e, 'pz-snap');
      }
      function unput(p) {
        if (where[p] >= 0 && at[where[p]] === p) at[where[p]] = -1;
        where[p] = -1;
        const e = els[p];
        e.classList.remove('on-board');
        e.style.left = e.style.top = '';
        tray.prepend(e);
      }
      void el;
    };
    const select = (k) => {
      sel = k;
      els.forEach((e, i) => e.classList.toggle('sel', i === k));
      board.classList.toggle('picking', k >= 0);
    };
    const cellAt = (x, y) => {
      const b = board.getBoundingClientRect();
      if (x < b.left - cell.w * 0.3 || x > b.right + cell.w * 0.3 || y < b.top - cell.h * 0.3 || y > b.bottom + cell.h * 0.3) return -1;
      const c = Math.max(0, Math.min(pz.cols - 1, Math.floor((x - b.left) / cell.w)));
      const rr = Math.max(0, Math.min(pz.rows - 1, Math.floor((y - b.top) / cell.h)));
      return rr * pz.cols + c;
    };
    // pointer drag with a floating copy; a short tap selects instead
    let drag = null;
    box.addEventListener('pointerdown', (e) => {
      if (locked && locked()) return;
      const el = e.target.closest('.pz-piece');
      if (!el) {
        const cEl = e.target.closest('.pz-cell');
        if (cEl && sel >= 0) { place(sel, Number(cEl.dataset.cell)); select(-1); }
        return;
      }
      e.preventDefault();
      const k = Number(el.dataset.k);
      const rc = el.getBoundingClientRect();
      drag = { k, el, x0: e.clientX, y0: e.clientY, dx: e.clientX - rc.left, dy: e.clientY - rc.top, moved: false, ghost: null };
      try { box.setPointerCapture(e.pointerId); } catch {}
    });
    box.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 8) return;
      if (!drag.moved) {
        drag.moved = true;
        const g = drag.el.cloneNode(true);
        g.className = 'pz-piece pz-drag';
        document.body.appendChild(g);
        drag.ghost = g;
        drag.el.classList.add('lifted');
        select(-1);
      }
      drag.ghost.style.left = e.clientX - drag.dx + 'px';
      drag.ghost.style.top = e.clientY - drag.dy + 'px';
      const c = cellAt(e.clientX - drag.dx + m + cell.w / 2, e.clientY - drag.dy + m + cell.h / 2);
      board.querySelectorAll('.pz-cell').forEach((x, i) => x.classList.toggle('hover', i === c));
    });
    const end = (e) => {
      if (!drag) return;
      const d = drag;
      drag = null;
      board.querySelectorAll('.pz-cell.hover').forEach((x) => x.classList.remove('hover'));
      if (d.ghost) d.ghost.remove();
      d.el.classList.remove('lifted');
      if (!d.moved) return select(sel === d.k ? -1 : d.k);
      const c = cellAt(e.clientX - d.dx + m + cell.w / 2, e.clientY - d.dy + m + cell.h / 2);
      if (c >= 0) place(d.k, c);
      else if (where[d.k] >= 0) place(d.k, -1);
    };
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);
    changed();
    return { order: () => at.slice() };
  }

  return { picture, mount, pinZone, video, cuts, piecePath, pieceSvg, puzzleOutline, jigsaw, size, rng };
})();
