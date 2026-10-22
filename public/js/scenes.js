// Page backgrounds ("scenes"): the static gradients (CSS), animated scenes drawn here, and the teacher's own
// background pictures / videos from the server's backgrounds folder ("file:<name>").
// Animated layers sit in one fixed #bgLayer behind everything. "Lite" (per device, or reduced motion)
// keeps the colors and drops the motion.
window.Scenes = (function () {
  const BUILTIN = [
    ['classic', 'סגול קלאסי'], ['space', 'חלל'], ['ocean', 'מתחת לים'], ['forest', 'יער'], ['candy', 'ממתקים'], ['sunset', 'שקיעה'],
    ['aurora', 'זוהר צפוני', 1], ['starfield', 'מסע בכוכבים', 1], ['underwater', 'שונית אלמוגים', 1], ['balloons', 'בלונים', 1],
    ['neon', 'ניאון', 1], ['snow', 'שלג', 1], ['fireflies', 'גחליליות', 1], ['party', 'מסיבה', 1],
  ];
  const ANIMATED = new Set(BUILTIN.filter((s) => s[2]).map((s) => s[0]));
  let files = []; // [{ id, name, kind, url, poster }]
  let current = null;
  const isPhone = () => !document.documentElement.classList.contains('host') && !document.body.classList.contains('editor-page');
  const lite = () => {
    try { if (localStorage.getItem('qg-lite') === '1') return true; } catch {}
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  };

  function layer() {
    let el = document.getElementById('bgLayer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'bgLayer';
      el.setAttribute('aria-hidden', 'true');
      document.body.prepend(el);
    }
    return el;
  }
  const r = (a, b) => a + Math.random() * (b - a);
  const many = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join('');

  // the moving parts of each animated scene (few elements, transform/opacity only)
  const DRAW = {
    aurora: () => `<div class="au-sky"></div>${many(4, (i) => `<i class="au-band" style="--i:${i};--h:${[150, 190, 280, 320][i]};--d:${r(16, 26)}s"></i>`)}${many(60, () => `<b class="tw" style="left:${r(0, 100)}%;top:${r(0, 55)}%;--s:${r(1, 2.6)}px;--d:${r(2, 6)}s;--o:${r(0.3, 0.9)}"></b>`)}<div class="au-hills"></div>`,
    starfield: () => `${[0, 1, 2].map((k) => `<div class="sf-layer" style="--d:${[140, 80, 40][k]}s">${many([70, 40, 18][k], () => `<b style="left:${r(0, 100)}%;top:${r(0, 100)}%;--s:${[1, 1.8, 2.8][k]}px"></b>`)}</div>`).join('')}${many(3, (i) => `<i class="sf-shoot" style="--y:${r(5, 50)}%;--delay:${i * 5 + r(0, 4)}s"></i>`)}<div class="sf-planet"></div>`,
    underwater: () => `<div class="uw-rays">${many(6, (i) => `<i style="--x:${10 + i * 16}%;--d:${r(6, 10)}s"></i>`)}</div>${many(26, () => `<b class="uw-bub" style="left:${r(0, 100)}%;--s:${r(6, 22)}px;--d:${r(9, 20)}s;--delay:-${r(0, 20)}s"></b>`)}${many(6, (i) => { const h = [20, 190, 320, 45, 160, 260][i]; return `<i class="uw-fish" style="--y:${r(18, 72)}%;--d:${r(22, 40)}s;--delay:-${r(0, 40)}s;--s:${r(0.6, 1.3)}"><svg viewBox="0 0 84 44"><path d="M4 8 L22 22 L4 36 Z" fill="hsl(${h} 80% 45%)"/><ellipse cx="48" cy="22" rx="30" ry="17" fill="hsl(${h} 90% 58%)"/><path d="M40 6 C48 0 58 2 62 8 Z" fill="hsl(${h} 80% 45%)"/><path d="M34 10 C40 18 40 28 34 36" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="3"/><circle cx="64" cy="18" r="5" fill="#fff"/><circle cx="65.5" cy="18" r="2.6" fill="#1e1145"/></svg></i>`; })}<div class="uw-reef"></div>`,
    balloons: () => many(16, (i) => `<i class="bl" style="left:${r(0, 96)}%;--h:${(i * 47) % 360};--s:${r(0.7, 1.3)};--d:${r(16, 30)}s;--delay:-${r(0, 30)}s;--sw:${r(2, 5)}s"></i>`) + `<div class="bl-clouds"></div>`,
    neon: () => `<div class="nn-sun"></div><div class="nn-mtn"></div><div class="nn-grid"></div>${many(30, () => `<b class="tw" style="left:${r(0, 100)}%;top:${r(0, 40)}%;--s:${r(1, 2.4)}px;--d:${r(2, 5)}s;--o:${r(0.4, 1)}"></b>`)}`,
    snow: () => `${many(70, () => `<b class="sn" style="left:${r(0, 100)}%;--s:${r(3, 9)}px;--d:${r(9, 22)}s;--delay:-${r(0, 22)}s;--dx:${r(-60, 60)}px"></b>`)}<div class="sn-hills"></div>`,
    fireflies: () => `<div class="ff-trees"></div>${many(34, () => `<b class="fly" style="left:${r(0, 100)}%;top:${r(30, 95)}%;--d:${r(6, 14)}s;--delay:-${r(0, 14)}s;--dx:${r(-80, 80)}px;--dy:${r(-80, 40)}px"></b>`)}`,
    party: () => many(44, (i) => `<i class="pt" style="left:${r(0, 100)}%;--c:${['#ffd23f', '#ff4fa3', '#22c7e8', '#2ee59d', '#8b5cf6', '#ff8a3d'][i % 6]};--d:${r(9, 18)}s;--delay:-${r(0, 18)}s;--rot:${r(-720, 720)}deg;--w:${r(8, 16)}px;--hgt:${r(10, 22)}px"></i>`) + `<div class="pt-lights">${many(7, (i) => `<i style="--x:${8 + i * 14}%;--h:${(i * 52) % 360};--d:${r(3, 6)}s"></i>`)}</div>`,
  };

  function apply(scene) {
    scene = scene || 'classic';
    const liteNow = lite();
    const sig = scene + '|' + liteNow;
    if (current === sig) return;
    current = sig;
    const body = document.body;
    const el = layer();
    el.className = '';
    el.innerHTML = '';
    el.style.backgroundImage = '';
    if (scene.startsWith('file:')) {
      const f = files.find((x) => x.id === scene);
      body.dataset.scene = 'custom';
      if (!f) { loadFiles().then(() => { if (current === sig) { current = null; apply(scene); } }); return; }
      el.className = 'bg-file';
      // videos play on the big screen; phones (and lite mode) get the still picture
      if (f.kind === 'video' && !liteNow && !isPhone()) el.innerHTML = `<video src="${U.esc(f.url)}" autoplay muted loop playsinline ${f.poster ? `poster="${U.esc(f.poster)}"` : ''}></video>`;
      else if (f.kind === 'image' || f.poster) el.style.backgroundImage = `url("${(f.kind === 'image' ? f.url : f.poster).replace(/"/g, '%22')}")`;
      else body.dataset.scene = 'classic';
      return;
    }
    body.dataset.scene = scene;
    if (ANIMATED.has(scene)) {
      el.className = 'bg-anim bg-' + scene + (liteNow ? ' lite' : '');
      el.innerHTML = DRAW[scene]();
    }
  }

  async function loadFiles() {
    try {
      files = await (await fetch('/api/backgrounds')).json();
    } catch {
      files = [];
    }
    return files;
  }

  // the picker list (built-in + files); custom files show their own picture as the preview
  function all() {
    return [...BUILTIN.map(([id, name, anim]) => ({ id, name, anim: !!anim })), ...files.map((f) => ({ id: f.id, name: f.name, file: f }))];
  }
  function previewHtml(s) {
    if (s.file) {
      const src = s.file.kind === 'image' ? s.file.url : s.file.poster;
      return src ? `<span class="sp-prev sp-file" style="background-image:url('${U.esc(src).replace(/'/g, '%27')}')">${s.file.kind === 'video' ? '<em>🎬</em>' : ''}</span>` : `<span class="sp-prev sp-file sc-classic"><em>🎬</em></span>`;
    }
    return `<span class="sp-prev sc-${s.id}">${s.anim ? '<em>✨</em>' : ''}</span>`;
  }
  function setLite(on) {
    try { localStorage.setItem('qg-lite', on ? '1' : '0'); } catch {}
    const s = (current || 'classic|').split('|')[0];
    current = null;
    apply(s);
  }

  return { apply, loadFiles, all, previewHtml, lite, setLite, BUILTIN, isFile: (s) => String(s || '').startsWith('file:') };
})();
