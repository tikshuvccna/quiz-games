// "שטויות על המסך": random fun events that splash over the big screen while a game runs (a room setting, off by default).
// Everything here is decoration: it never takes clicks and removes itself.
window.Silly = (function () {
  let timer = null;
  let lastStage = null;
  const EMOJI = ['🐸', '🦆', '🍕', '🐙', '🦄', '🍌', '👻', '🐔', '🍩', '🤡', '🐢', '🧦', '🦖', '🍉'];
  const WORDS = ['בלאגן!', 'וואו!', 'אופס…', 'חחחח', 'מה קרה?!', 'פלופ!', 'בום!', 'שטויות!', 'איזה כיף!'];
  const COLORS = ['#ff4fa3', '#ffd23f', '#2ee59d', '#22c7e8', '#8b5cf6', '#ff8a3d'];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const rnd = (a, b) => a + Math.random() * (b - a);

  const layer = () => {
    let l = document.getElementById('sillyLayer');
    if (!l) {
      l = document.createElement('div');
      l.id = 'sillyLayer';
      document.body.appendChild(l);
    }
    return l;
  };
  const add = (html, cls, ms, style = '') => {
    const el = document.createElement('div');
    el.className = 'sil ' + cls;
    el.style.cssText = style;
    el.innerHTML = html;
    layer().appendChild(el);
    setTimeout(() => el.remove(), ms);
    return el;
  };

  const events = {
    // an emoji hops across the bottom of the screen
    hop() {
      add(pick(EMOJI), 'sil-hop', 4200, `bottom:${rnd(2, 14)}%;font-size:${rnd(60, 110)}px`);
    },
    // a rain of emoji
    rain() {
      const e = pick(EMOJI);
      for (let i = 0; i < 16; i++) add(e, 'sil-rain', 4800, `left:${rnd(2, 96)}%;font-size:${rnd(30, 64)}px;animation-delay:${rnd(0, 1.6).toFixed(2)}s`);
    },
    // a word pops in the middle
    word() {
      add(pick(WORDS), 'sil-word', 1900, `color:${pick(COLORS)};rotate:${rnd(-12, 12).toFixed(0)}deg`);
    },
    // paint splats that smear and fade
    splat() {
      const c = pick(COLORS);
      for (let i = 0; i < 4; i++) {
        const s = rnd(120, 340);
        add('', 'sil-splat', 3700, `left:${rnd(5, 85)}%;top:${rnd(5, 80)}%;width:${s}px;height:${s * rnd(0.7, 1.1)}px;background:radial-gradient(circle at 35% 30%, #fff8, ${c} 45%, ${c}cc);animation-delay:${i * 0.15}s`);
      }
    },
    // eyes peek in from the edge of the screen
    eyes() {
      const left = Math.random() < 0.5;
      add('<i></i><i></i>', 'sil-eyes ' + (left ? 'l' : 'r'), 3500, `${left ? 'left' : 'right'}:-10px;top:${rnd(15, 70)}%`);
    },
    // the whole screen wobbles or spins once
    wobble() {
      const a = document.getElementById('app');
      if (!a) return;
      const c = pick(['sil-wob', 'sil-spin']);
      a.classList.add(c);
      setTimeout(() => a.classList.remove(c), 1700);
    },
    // a rocket flies by
    fly() {
      add('🚀', 'sil-fly', 3200, `top:${rnd(10, 70)}%;font-size:${rnd(60, 100)}px`);
    },
  };

  const fire = () => {
    // students who chose "calm" (no animations) in the accessibility panel get none of this
    if (document.hidden || document.documentElement.classList.contains('a11y-calm')) return;
    events[pick(Object.keys(events))]();
  };

  const loop = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { fire(); loop(); }, rnd(14000, 32000));
  };

  return {
    // called on every host render
    update(st) {
      const on = st.setup && st.setup.silly && st.phase === 'playing';
      if (!on) {
        clearTimeout(timer);
        timer = null;
        lastStage = null;
        return;
      }
      if (!timer) loop();
      // the classic quiz: a splash whenever the screen moves on from a question to the answer
      const stage = st.board && st.board.kind === 'classic' ? st.board.stage : null;
      if (stage && stage !== lastStage && lastStage === 'question' && Math.random() < 0.7) setTimeout(fire, 600);
      lastStage = stage;
    },
    fire,
    events,
  };
})();
