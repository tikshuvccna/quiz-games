// Hand-drawn SVG art shared by the host and player pages. Sticker style: bold outline, flat gradients, highlights.
// Colorizable parts use CSS custom properties (fill: var(--k)) so one drawing serves every team / player.
(function () {
  const O = '#1e1145'; // outline
  const SW = 'stroke="' + O + '" stroke-linejoin="round" stroke-linecap="round"';

  // one hidden <svg> holding every shared gradient (ids are global, so define them once)
  const DEFS = `
  <svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
    <linearGradient id="g-stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3ead9"/><stop offset="1" stop-color="#b8a68b"/></linearGradient>
    <linearGradient id="g-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2a8"/><stop offset=".5" stop-color="#ffcf33"/><stop offset="1" stop-color="#e09a00"/></linearGradient>
    <linearGradient id="g-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c98a4b"/><stop offset="1" stop-color="#8a5226"/></linearGradient>
    <linearGradient id="g-iron" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9e2ee"/><stop offset="1" stop-color="#7d8aa3"/></linearGradient>
    <linearGradient id="g-gem" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bff6ff"/><stop offset=".5" stop-color="#3ec6ff"/><stop offset="1" stop-color="#1f62e0"/></linearGradient>
    <linearGradient id="g-ruby" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffc2d6"/><stop offset=".5" stop-color="#ff3d7f"/><stop offset="1" stop-color="#a5104a"/></linearGradient>
    <linearGradient id="g-emerald" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c8ffd9"/><stop offset=".5" stop-color="#2ee59d"/><stop offset="1" stop-color="#0b8a57"/></linearGradient>
    <linearGradient id="g-purple" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e7d4ff"/><stop offset=".5" stop-color="#a66bff"/><stop offset="1" stop-color="#5b23c9"/></linearGradient>
    <linearGradient id="g-rock" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c9b8a6"/><stop offset="1" stop-color="#6b5646"/></linearGradient>
    <radialGradient id="g-bomb" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#6b6f8f"/><stop offset=".6" stop-color="#2a2c45"/><stop offset="1" stop-color="#11121f"/></radialGradient>
    <linearGradient id="g-dbody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6b57"/><stop offset="1" stop-color="#b3122e"/></linearGradient>
    <linearGradient id="g-dbelly" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#f0a02c"/></linearGradient>
    <linearGradient id="g-dwing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8f1d3f"/><stop offset="1" stop-color="#4a0b25"/></linearGradient>
    <linearGradient id="g-horn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffbe8"/><stop offset="1" stop-color="#d6bd85"/></linearGradient>
    <radialGradient id="g-fire" cx=".5" cy=".15" r=".9"><stop offset="0" stop-color="#fffbd1"/><stop offset=".3" stop-color="#ffd23f"/><stop offset=".65" stop-color="#ff7a1a"/><stop offset="1" stop-color="#e0201f" stop-opacity="0"/></radialGradient>
    <linearGradient id="g-red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8a7a"/><stop offset="1" stop-color="#e0303d"/></linearGradient>
    <linearGradient id="g-blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc2ff"/><stop offset="1" stop-color="#1f6fe0"/></linearGradient>
    <linearGradient id="g-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8f6ff"/><stop offset="1" stop-color="#6fb7e8"/></linearGradient>
    <radialGradient id="g-moonshade" cx=".3" cy=".3" r=".9"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#5a5040" stop-opacity=".4"/></radialGradient>
    <radialGradient id="g-planet" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#8fe3ff"/><stop offset=".55" stop-color="#2f7fe0"/><stop offset="1" stop-color="#123a8f"/></radialGradient>
  </defs></svg>`;
  const inject = () => {
    if (document.getElementById('art-defs')) return;
    const d = document.createElement('div');
    d.id = 'art-defs';
    d.innerHTML = DEFS;
    document.body.prepend(d);
  };
  if (document.body) inject();
  else document.addEventListener('DOMContentLoaded', inject);

  const svg = (vb, body, cls = '') => `<svg class="art ${cls}" viewBox="${vb}" aria-hidden="true">${body}</svg>`;
  const shadow = (cx, cy, rx, ry = rx * 0.18) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#000" opacity=".22"/>`;

  const Art = {
    O,
    defs: inject,

    // ---------- answer shapes (white, on colored buttons) ----------
    shape(i) {
      const s = [
        '<path d="M12 2 L22 20 H2 Z"/>',
        '<path d="M12 1 L23 12 L12 23 L1 12 Z"/>',
        '<circle cx="12" cy="12" r="10"/>',
        '<rect x="2.5" y="2.5" width="19" height="19" rx="2"/>',
        '<path d="M12 1.5 L14.8 8.6 L22.5 9 L16.6 13.9 L18.5 21.5 L12 17.3 L5.5 21.5 L7.4 13.9 L1.5 9 L9.2 8.6 Z"/>',
        '<path d="M6.5 2.5 H17.5 L23 12 L17.5 21.5 H6.5 L1 12 Z"/>',
      ][i % 6];
      return `<svg class="shape" viewBox="0 0 24 24" aria-hidden="true"><g fill="#fff" stroke="rgba(0,0,0,.18)" stroke-width="1.5">${s}</g></svg>`;
    },

    check() {
      return svg('0 0 100 100', `<circle cx="50" cy="50" r="44" fill="#fff" opacity=".18"/><circle cx="50" cy="50" r="36" fill="#fff"/><path d="M32 51 L45 64 L69 38" fill="none" stroke="#18b86b" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`, 'icon-check');
    },
    cross() {
      return svg('0 0 100 100', `<circle cx="50" cy="50" r="44" fill="#fff" opacity=".18"/><circle cx="50" cy="50" r="36" fill="#fff"/><path d="M36 36 L64 64 M64 36 L36 64" stroke="#e5304d" stroke-width="10" stroke-linecap="round"/>`, 'icon-cross');
    },
    flame() {
      return svg('0 0 40 48', `<path d="M20 2 C26 12 36 18 34 32 C32 42 26 46 20 46 C12 46 5 40 6 30 C7 22 12 20 13 12 C17 16 17 20 18 22 C20 14 20 8 20 2Z" fill="#ff7a1a" ${SW} stroke-width="2.5"/><path d="M20 22 C24 28 28 31 27 37 C26 42 23 44 20 44 C16 44 13 41 13.5 37 C14 32 18 30 20 22Z" fill="#ffd23f"/>`, 'icon-flame');
    },
    star(fill = 'url(#g-gold)') {
      return svg('0 0 40 40', `<path d="M20 3 L25 14.5 L37.5 15.5 L28 24 L31 36.5 L20 30 L9 36.5 L12 24 L2.5 15.5 L15 14.5 Z" fill="${fill}" ${SW} stroke-width="2.5"/><path d="M15 16 L20 7 L22 13Z" fill="#fff" opacity=".6"/>`, 'icon-star');
    },
    trophy() {
      return svg('0 0 64 64', `${shadow(32, 60, 18)}
        <g ${SW} stroke-width="3">
          <path d="M14 12 H6 C6 26 12 30 20 30" fill="none" stroke-width="5"/><path d="M50 12 H58 C58 26 52 30 44 30" fill="none" stroke-width="5"/>
          <path d="M14 8 H50 V22 C50 34 42 40 32 40 C22 40 14 34 14 22Z" fill="url(#g-gold)"/>
          <rect x="27" y="40" width="10" height="8" fill="#e09a00"/>
          <rect x="18" y="48" width="28" height="9" rx="3" fill="#8a5226"/>
        </g><path d="M20 12 H25 V24 C25 28 23 30 21 30 C20 26 20 20 20 12Z" fill="#fff" opacity=".5"/>`, 'icon-trophy');
    },
    sound(on) {
      return svg('0 0 24 24', `<path d="M4 9 H8 L13 5 V19 L8 15 H4 Z" fill="currentColor"/>${on ? '<path d="M16 9 C17.5 10.5 17.5 13.5 16 15 M18.5 6.5 C21.5 9.5 21.5 14.5 18.5 17.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' : '<path d="M16 9 L21 14 M21 9 L16 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'}`, 'icon-sound');
    },

    // ---------- territory ----------
    castle(roof = '#8b5cf6') {
      return svg('0 0 100 100', `${shadow(50, 93, 38, 6)}
        <g ${SW} stroke-width="4">
          <path d="M28 90 V46 h6 v-8 h7 v8 h6 v-8 h6 v8 h6 v-8 h7 v8 h6 V90 Z" fill="url(#g-stone)"/>
          <path d="M42 90 V76 a8 8 0 0 1 16 0 V90 Z" fill="#6b3a17"/>
          <rect x="12" y="42" width="22" height="48" rx="2" fill="url(#g-stone)"/>
          <rect x="66" y="42" width="22" height="48" rx="2" fill="url(#g-stone)"/>
          <path d="M8 44 L23 16 L38 44 Z" style="fill:${roof}"/>
          <path d="M62 44 L77 16 L92 44 Z" style="fill:${roof}"/>
          <path d="M50 38 V12" fill="none"/>
          <path d="M50 12 L68 17 L50 23 Z" style="fill:${roof}" stroke-width="3"/>
        </g>
        <rect x="19" y="56" width="8" height="12" rx="4" fill="${O}"/><rect x="73" y="56" width="8" height="12" rx="4" fill="${O}"/>
        <path d="M12 44 L23 22 L26 28 L17 44Z" fill="#fff" opacity=".35"/><path d="M66 44 L77 22 L80 28 L71 44Z" fill="#fff" opacity=".35"/>
        <rect x="15" y="46" width="4" height="40" fill="#fff" opacity=".35"/><rect x="69" y="46" width="4" height="40" fill="#fff" opacity=".35"/>`, 'castle');
    },
    flag(color = '#ff5a5f') {
      return svg('0 0 48 56', `${shadow(14, 52, 10, 3)}
        <g ${SW} stroke-width="3"><path d="M13 52 V5" fill="none" stroke-width="4"/><path d="M14 6 C24 2 30 12 42 7 V27 C30 32 24 22 14 26 Z" style="fill:${color}"/></g>
        <path d="M16 9 C23 6 28 13 36 11 V15 C28 17 23 10 16 13Z" fill="#fff" opacity=".4"/><circle cx="13" cy="5" r="3.5" fill="url(#g-gold)" stroke="${O}" stroke-width="2"/>`, 'flag');
    },
    sword() {
      return svg('0 0 48 48', `<g ${SW} stroke-width="3"><path d="M38 4 L44 4 L44 10 L20 34 L14 28 Z" fill="url(#g-iron)"/><path d="M10 24 L24 38 L20 42 L6 28 Z" fill="url(#g-gold)"/><path d="M14 34 L6 42 C4 44 6 46 8 44 L16 36" fill="#8a5226"/></g><path d="M40 7 L22 25 L20 23 Z" fill="#fff" opacity=".7"/>`, 'sword');
    },
    shield(color = '#2f8bff') {
      return svg('0 0 48 48', `<g ${SW} stroke-width="3"><path d="M24 4 L41 10 V24 C41 34 33 41 24 45 C15 41 7 34 7 24 V10 Z" style="fill:${color}"/><path d="M24 10 L35 14 V24 C35 31 30 36 24 39Z" fill="#fff" opacity=".3" stroke="none"/></g><path d="M24 15 L26.5 21 L33 21.5 L28 25.5 L29.5 32 L24 28.5 L18.5 32 L20 25.5 L15 21.5 L21.5 21 Z" fill="url(#g-gold)" stroke="${O}" stroke-width="1.5"/>`, 'shield');
    },

    // team mascots: 0 = tiger, 1 = shark
    mascot(team) {
      if (team === 4)
        // owl
        return svg('0 0 100 100', `
          <g ${SW} stroke-width="4">
            <path d="M20 22 L28 6 L40 18Z M80 22 L72 6 L60 18Z" fill="#7c4dd8"/>
            <path d="M50 14 C78 14 90 34 88 58 C86 82 70 92 50 92 C30 92 14 82 12 58 C10 34 22 14 50 14Z" fill="#9b5cf6"/>
            <path d="M30 64 C30 54 40 52 50 58 C60 52 70 54 70 64 C70 80 60 88 50 88 C40 88 30 80 30 64Z" fill="#e4d4ff"/>
          </g>
          <circle cx="35" cy="42" r="13" fill="#fff" stroke="${O}" stroke-width="3"/><circle cx="65" cy="42" r="13" fill="#fff" stroke="${O}" stroke-width="3"/>
          <circle cx="36" cy="43" r="7" fill="${O}"/><circle cx="64" cy="43" r="7" fill="${O}"/><circle cx="38" cy="40" r="2.4" fill="#fff"/><circle cx="66" cy="40" r="2.4" fill="#fff"/>
          <path d="M44 52 L56 52 L50 62Z" fill="#ffb020" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>
          <path d="M38 70 l4 4 l4 -4 M54 70 l4 4 l4 -4 M46 78 l4 4 l4 -4" fill="none" stroke="#b79cf0" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M26 26 C34 20 44 18 52 19" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".4"/>`, 'mascot');
      if (team === 5)
        // dolphin
        return svg('0 0 100 100', `
          <g ${SW} stroke-width="4">
            <path d="M46 12 C54 4 66 6 70 14 C62 14 56 18 54 22Z" fill="#14b8c4"/>
            <path d="M50 18 C78 18 92 36 90 58 C88 80 70 92 50 92 C30 92 12 80 10 58 C8 36 22 18 50 18Z" fill="#14b8c4"/>
            <path d="M24 60 C30 52 70 52 76 60 C74 78 62 88 50 88 C38 88 26 78 24 60Z" fill="#dcfbff"/>
            <path d="M40 66 C46 72 54 72 60 66" fill="none" stroke-width="4"/>
          </g>
          <ellipse cx="36" cy="44" rx="7" ry="8" fill="#fff" stroke="${O}" stroke-width="2.5"/><ellipse cx="64" cy="44" rx="7" ry="8" fill="#fff" stroke="${O}" stroke-width="2.5"/>
          <circle cx="37" cy="45" r="4.2" fill="${O}"/><circle cx="63" cy="45" r="4.2" fill="${O}"/><circle cx="38.5" cy="43" r="1.6" fill="#fff"/><circle cx="64.5" cy="43" r="1.6" fill="#fff"/>
          <circle cx="24" cy="56" r="4.5" fill="#ff9aae" opacity=".7"/><circle cx="76" cy="56" r="4.5" fill="#ff9aae" opacity=".7"/>
          <path d="M30 28 C38 22 48 20 56 21" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".45"/>`, 'mascot');
      if (team === 2)
        // eagle
        return svg('0 0 100 100', `
          <g ${SW} stroke-width="4">
            <path d="M14 40 C4 52 6 70 18 78 C18 66 22 58 28 52Z M86 40 C96 52 94 70 82 78 C82 66 78 58 72 52Z" fill="#c9821a"/>
            <path d="M50 10 C76 10 90 30 88 54 C86 78 70 92 50 92 C30 92 14 78 12 54 C10 30 24 10 50 10Z" fill="#f5a524"/>
            <path d="M24 30 C34 18 66 18 76 30 C72 40 60 42 50 40 C40 42 28 40 24 30Z" fill="#fff8ec"/>
          </g>
          <ellipse cx="37" cy="44" rx="7" ry="8" fill="#fff" stroke="${O}" stroke-width="2.5"/><ellipse cx="63" cy="44" rx="7" ry="8" fill="#fff" stroke="${O}" stroke-width="2.5"/>
          <circle cx="38" cy="45" r="4.2" fill="${O}"/><circle cx="62" cy="45" r="4.2" fill="${O}"/><circle cx="39.5" cy="43" r="1.5" fill="#fff"/><circle cx="63.5" cy="43" r="1.5" fill="#fff"/>
          <path d="M26 36 L44 40 M74 36 L56 40" stroke="${O}" stroke-width="4" stroke-linecap="round"/>
          <path d="M42 54 C42 50 58 50 58 54 L54 70 C52 74 48 74 46 70Z" fill="#ffd23f" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
          <path d="M46 70 C48 64 52 64 54 70" fill="none" stroke="${O}" stroke-width="2.5"/>
          <path d="M30 18 C38 14 50 13 58 15" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".5"/>`, 'mascot');
      if (team === 3)
        // frog
        return svg('0 0 100 100', `
          <g ${SW} stroke-width="4">
            <circle cx="30" cy="26" r="15" fill="#22b55e"/><circle cx="70" cy="26" r="15" fill="#22b55e"/>
            <path d="M50 26 C80 26 94 44 92 62 C90 82 72 92 50 92 C28 92 10 82 8 62 C6 44 20 26 50 26Z" fill="#22b55e"/>
          </g>
          <circle cx="30" cy="26" r="9" fill="#fff" stroke="${O}" stroke-width="2.5"/><circle cx="70" cy="26" r="9" fill="#fff" stroke="${O}" stroke-width="2.5"/>
          <circle cx="31" cy="27" r="5" fill="${O}"/><circle cx="69" cy="27" r="5" fill="${O}"/><circle cx="32.5" cy="25" r="1.7" fill="#fff"/><circle cx="70.5" cy="25" r="1.7" fill="#fff"/>
          <path d="M18 54 C30 72 70 72 82 54" fill="none" stroke="${O}" stroke-width="4" stroke-linecap="round"/>
          <path d="M30 62 C40 70 60 70 70 62 C66 74 58 78 50 78 C42 78 34 74 30 62Z" fill="#ff5a7a" stroke="${O}" stroke-width="2.5"/>
          <circle cx="20" cy="48" r="5" fill="#ff9aae" opacity=".7"/><circle cx="80" cy="48" r="5" fill="#ff9aae" opacity=".7"/>
          <path d="M24 38 C32 32 44 30 52 30" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".45"/>
          <path d="M44 46 L46 50 M56 46 L54 50" stroke="${O}" stroke-width="2.5" stroke-linecap="round"/>`, 'mascot');
      if (team === 0)
        return svg('0 0 100 100', `
          <g ${SW} stroke-width="4">
            <path d="M18 30 L22 8 L40 20Z" fill="#ff9a3c"/><path d="M82 30 L78 8 L60 20Z" fill="#ff9a3c"/>
            <path d="M50 14 C78 14 92 34 90 56 C88 80 70 92 50 92 C30 92 12 80 10 56 C8 34 22 14 50 14Z" fill="#ff9a3c"/>
          </g>
          <path d="M24 16 L27 22 L33 19Z" fill="#ffd6e0"/><path d="M76 16 L73 22 L67 19Z" fill="#ffd6e0"/>
          <path d="M50 14 L46 30 L50 34 L54 30Z M14 46 L28 50 L14 54Z M86 46 L72 50 L86 54Z M20 66 L32 64 L22 72Z M80 66 L68 64 L78 72Z M36 18 L38 30 L42 20Z M64 18 L62 30 L58 20Z" fill="${O}"/>
          <path d="M28 62 C28 50 40 52 50 58 C60 52 72 50 72 62 C72 78 62 86 50 86 C38 86 28 78 28 62Z" fill="#fff4e3"/>
          <ellipse cx="36" cy="46" rx="7" ry="8" fill="#fff"/><ellipse cx="64" cy="46" rx="7" ry="8" fill="#fff"/>
          <ellipse cx="37" cy="47" rx="4" ry="6" fill="${O}"/><ellipse cx="63" cy="47" rx="4" ry="6" fill="${O}"/>
          <circle cx="38.5" cy="44.5" r="1.6" fill="#fff"/><circle cx="64.5" cy="44.5" r="1.6" fill="#fff"/>
          <path d="M28 36 L42 40 M72 36 L58 40" stroke="${O}" stroke-width="4" stroke-linecap="round"/>
          <path d="M44 60 H56 L50 66Z" fill="#ff5a7a" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>
          <path d="M50 66 V70 M42 72 C46 76 50 72 50 70 C50 72 54 76 58 72" fill="none" stroke="${O}" stroke-width="3" stroke-linecap="round"/>
          <path d="M44 74 L46 80 L48 74Z M56 74 L54 80 L52 74Z" fill="#fff" stroke="${O}" stroke-width="1.5"/>`, 'mascot');
      return svg('0 0 100 100', `
        <g ${SW} stroke-width="4">
          <path d="M50 4 L62 24 L40 24Z" fill="#3b8eff"/>
          <path d="M50 18 C78 18 92 36 90 58 C88 80 70 92 50 92 C30 92 12 80 10 58 C8 36 22 18 50 18Z" fill="#3b8eff"/>
        </g>
        <path d="M22 62 C30 56 70 56 78 62 C76 80 64 88 50 88 C36 88 24 80 22 62Z" fill="#eaf4ff"/>
        <path d="M26 64 C34 72 66 72 74 64 L70 78 C62 84 38 84 30 78 Z" fill="${O}"/>
        <path d="M30 66 L34 72 L38 67 L42 73 L46 68 L50 74 L54 68 L58 73 L62 67 L66 72 L70 66" fill="#fff" stroke="${O}" stroke-width="1.5" stroke-linejoin="round"/>
        <ellipse cx="34" cy="44" rx="8" ry="8" fill="#fff"/><ellipse cx="66" cy="44" rx="8" ry="8" fill="#fff"/>
        <circle cx="35" cy="45" r="5" fill="${O}"/><circle cx="65" cy="45" r="5" fill="${O}"/>
        <circle cx="36.5" cy="43" r="1.7" fill="#fff"/><circle cx="66.5" cy="43" r="1.7" fill="#fff"/>
        <path d="M24 34 L42 40 M76 34 L58 40" stroke="${O}" stroke-width="4" stroke-linecap="round"/>
        <path d="M14 50 L20 47 M14 56 L20 53 M86 50 L80 47 M86 56 L80 53" stroke="#1d5fc0" stroke-width="3" stroke-linecap="round"/>
        <path d="M32 24 C40 20 50 20 56 22" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".45"/>`, 'mascot');
    },

    // ---------- tug of war: a little puller holding the rope (faces right; mirror for the other team) ----------
    puller(color, team) {
      const ear = team === 0
        ? `<path d="M22 14 L24 4 L32 10Z M46 14 L44 4 L36 10Z" style="fill:${color}" ${SW} stroke-width="3"/>`
        : `<path d="M34 2 L41 12 L29 12Z" style="fill:${color}" ${SW} stroke-width="3"/>`;
      return svg('0 0 70 92', `${shadow(34, 88, 24, 4)}
        ${ear}
        <g ${SW} stroke-width="3.5">
          <path d="M22 70 L14 86 H26 L30 74" style="fill:${color}"/>
          <path d="M44 70 L40 86 H52 L50 72" style="fill:${color}"/>
          <path d="M34 8 C52 8 60 22 58 42 C57 62 50 76 34 76 C18 76 10 62 10 42 C8 22 16 8 34 8Z" style="fill:${color}"/>
          <path d="M42 46 C52 44 62 44 70 46" fill="none" stroke-width="7" style="stroke:${color}"/>
        </g>
        <path d="M44 46 C52 45 60 45 68 46" fill="none" stroke="#000" stroke-opacity=".15" stroke-width="3" stroke-linecap="round"/>
        <path d="M34 36 C46 36 50 48 48 60 C46 70 40 72 34 72 C26 72 20 68 20 58 C20 46 24 36 34 36Z" fill="#fff" opacity=".85"/>
        <path d="M14 30 C14 18 22 12 30 12" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".45"/>
        <path d="M12 22 C24 18 44 18 58 22 L58 28 C44 24 24 24 12 28Z" fill="#fff" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>
        <ellipse cx="30" cy="34" rx="5" ry="6" fill="#fff" stroke="${O}" stroke-width="2"/><ellipse cx="45" cy="34" rx="5" ry="6" fill="#fff" stroke="${O}" stroke-width="2"/>
        <circle cx="32" cy="35" r="3" fill="${O}"/><circle cx="47" cy="35" r="3" fill="${O}"/>
        <path d="M24 28 L35 31 M51 28 L41 31" stroke="${O}" stroke-width="3" stroke-linecap="round"/>
        <path d="M34 46 C38 44 44 44 46 47" fill="none" stroke="${O}" stroke-width="3" stroke-linecap="round"/>
        <circle cx="64" cy="46" r="6" style="fill:${color}" stroke="${O}" stroke-width="3"/>`, 'puller');
    },

    // ---------- gems ----------
    item(k) {
      const items = {
        coin: `${shadow(24, 45, 13, 2.5)}<circle cx="24" cy="22" r="18" fill="url(#g-gold)" stroke="${O}" stroke-width="3"/><circle cx="24" cy="22" r="12.5" fill="none" stroke="#e09a00" stroke-width="2.5"/><path d="M24 12 L27 19 L34 19.5 L28.5 24 L30.5 31 L24 27 L17.5 31 L19.5 24 L14 19.5 L21 19 Z" fill="#fff6c4" stroke="#c98a00" stroke-width="1.5" stroke-linejoin="round"/><path d="M11 16 C13 10 18 7 22 6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>`,
        gem: `${shadow(24, 45, 14, 2.5)}<path d="M12 6 H36 L45 17 L24 42 L3 17 Z" fill="url(#g-gem)" stroke="${O}" stroke-width="3" stroke-linejoin="round"/><path d="M3 17 H45 M12 6 L18 17 L24 42 L30 17 L36 6 M18 17 L24 6 L30 17" fill="none" stroke="#1d4fb8" stroke-width="1.8" stroke-linejoin="round" opacity=".7"/><path d="M13 9 L17 15 L8 16Z" fill="#fff" opacity=".85"/>`,
        crown: `${shadow(24, 45, 16, 2.5)}<path d="M5 36 L3 12 L14 22 L24 6 L34 22 L45 12 L43 36 Z" fill="url(#g-gold)" stroke="${O}" stroke-width="3" stroke-linejoin="round"/><rect x="5" y="34" width="38" height="7" rx="2" fill="#e09a00" stroke="${O}" stroke-width="3"/><circle cx="24" cy="26" r="4.5" fill="url(#g-ruby)" stroke="${O}" stroke-width="2"/><circle cx="13" cy="29" r="3" fill="url(#g-gem)" stroke="${O}" stroke-width="1.6"/><circle cx="35" cy="29" r="3" fill="url(#g-emerald)" stroke="${O}" stroke-width="1.6"/><circle cx="3" cy="12" r="3" fill="#fff6c4" stroke="${O}" stroke-width="2"/><circle cx="24" cy="6" r="3" fill="#fff6c4" stroke="${O}" stroke-width="2"/><circle cx="45" cy="12" r="3" fill="#fff6c4" stroke="${O}" stroke-width="2"/><path d="M9 30 L8 18 L12 22Z" fill="#fff" opacity=".6"/>`,
        rock: `${shadow(24, 45, 16, 2.5)}<path d="M6 30 L10 14 L22 6 L36 9 L44 22 L40 38 L24 43 L10 40 Z" fill="url(#g-rock)" stroke="${O}" stroke-width="3" stroke-linejoin="round"/><path d="M12 15 L22 9 L26 12 L15 19Z" fill="#fff" opacity=".4"/><path d="M15 25 L21 28 M33 25 L27 28" stroke="${O}" stroke-width="3" stroke-linecap="round"/><circle cx="19" cy="31" r="2.6" fill="${O}"/><circle cx="29" cy="31" r="2.6" fill="${O}"/><path d="M19 38 C22 35 27 35 30 38" fill="none" stroke="${O}" stroke-width="2.5" stroke-linecap="round"/>`,
        bomb: `${shadow(22, 45, 15, 2.5)}<circle cx="21" cy="27" r="16" fill="url(#g-bomb)" stroke="${O}" stroke-width="3"/><rect x="26" y="7" width="10" height="8" rx="2" transform="rotate(35 31 11)" fill="#6b6f8f" stroke="${O}" stroke-width="2.5"/><path d="M35 8 C38 4 41 4 43 6" fill="none" stroke="#8a5226" stroke-width="3" stroke-linecap="round"/><g class="spark"><circle cx="44" cy="5" r="4" fill="#ffd23f"/><path d="M44 -1 V11 M38 5 H50 M40 1 L48 9 M48 1 L40 9" stroke="#ff7a1a" stroke-width="1.6" stroke-linecap="round"/></g><path d="M11 22 C12 17 16 14 20 13" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".5"/><path d="M14 30 L19 34 M24 30 L19 34" stroke="#ff4d6d" stroke-width="2.5" stroke-linecap="round"/>`,
      };
      return svg('0 -4 48 52', items[k] || items.coin, 'item item-' + k);
    },
    // treasure chests per wealth tier 0..4
    chest(tier = 0) {
      const t = [
        { body: 'url(#g-wood)', band: '#5a3415', lock: '#c9a36a', loot: '' },
        { body: 'url(#g-wood)', band: 'url(#g-iron)', lock: 'url(#g-iron)', loot: 'coin' },
        { body: 'url(#g-iron)', band: 'url(#g-gold)', lock: 'url(#g-gold)', loot: 'gem' },
        { body: 'url(#g-purple)', band: 'url(#g-gold)', lock: 'url(#g-gold)', loot: 'gold' },
        { body: 'url(#g-ruby)', band: 'url(#g-gold)', lock: 'url(#g-gem)', loot: 'royal' },
      ][Math.max(0, Math.min(4, tier))];
      let loot = '';
      if (t.loot) {
        const c = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="7" ry="4" fill="url(#g-gold)" stroke="${O}" stroke-width="2"/>`;
        loot = c(22, 30) + c(34, 27) + c(46, 30) + c(28, 25);
        if (t.loot !== 'coin') loot += `<path d="M36 14 H46 L50 20 L41 30 L32 20Z" fill="url(#g-gem)" stroke="${O}" stroke-width="2.2" stroke-linejoin="round"/>`;
        if (t.loot === 'gold' || t.loot === 'royal') loot += `<path d="M14 26 L16 14 L21 20 L26 12 L30 20 L35 15 L35 26Z" fill="url(#g-gold)" stroke="${O}" stroke-width="2.2" stroke-linejoin="round"/>`;
        if (t.loot === 'royal') loot += `<path d="M44 10 L50 4 L56 10 L50 24Z" fill="url(#g-ruby)" stroke="${O}" stroke-width="2" stroke-linejoin="round"/><path d="M10 12 L11 8 L12 12 L16 13 L12 14 L11 18 L10 14 L6 13Z" fill="#fff"/>`;
      }
      return svg('0 0 68 64', `${shadow(34, 60, 28, 4)}${loot}
        <g ${SW} stroke-width="3">
          <path d="M8 30 C8 18 18 14 34 14 C50 14 60 18 60 30 Z" style="fill:${t.body}" ${t.loot ? 'transform="rotate(-14 8 30) translate(-2 -6)"' : ''}/>
          <rect x="6" y="30" width="56" height="26" rx="4" style="fill:${t.body}"/>
          <rect x="6" y="30" width="56" height="7" style="fill:${t.band}"/>
          <rect x="14" y="30" width="7" height="26" style="fill:${t.band}"/><rect x="47" y="30" width="7" height="26" style="fill:${t.band}"/>
          <rect x="28" y="34" width="12" height="13" rx="3" style="fill:${t.lock}"/>
        </g>
        <rect x="10" y="40" width="3" height="12" rx="1.5" fill="#fff" opacity=".35"/>`, 'chest');
    },

    // ---------- race ----------
    kart(color = '#ff5a5f') {
      return svg('0 0 120 70', `${shadow(60, 64, 50, 4)}<g transform="translate(120 0) scale(-1 1)">
        <g ${SW} stroke-width="3.5">
          <path d="M14 46 C12 36 20 30 30 30 L56 30 L64 20 L86 20 C96 20 104 28 108 38 L110 46 C110 50 106 52 100 52 H20 C16 52 14 50 14 46Z" style="fill:${color}"/>
          <path d="M100 26 L114 22 L116 34 L104 36Z" fill="#2a2c45"/>
          <circle cx="52" cy="18" r="13" fill="#fff"/>
          <path d="M42 14 C44 8 50 5 56 6 C62 7 66 12 65 18 H48 C45 18 42 17 42 14Z" style="fill:${color}"/>
          <path d="M54 12 H66 V19 H54Z" fill="url(#g-glass)" stroke-width="2.5"/>
        </g>
        <path d="M22 36 H58 L54 40 H20Z" fill="#fff" opacity=".45"/>
        <path d="M70 26 H90" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".55"/>
        <text x="80" y="45" font-family="Heebo, sans-serif" font-weight="900" font-size="13" fill="#fff" stroke="${O}" stroke-width="3" paint-order="stroke" text-anchor="middle" class="kart-num"></text>
        <g class="wheel"><circle cx="32" cy="52" r="11" fill="#22233a" stroke="${O}" stroke-width="3.5"/><circle cx="32" cy="52" r="4.5" fill="#c9d4e6"/><path d="M32 43 V47 M32 57 V61 M23 52 H27 M37 52 H41" stroke="#555a7a" stroke-width="2"/></g>
        <g class="wheel"><circle cx="94" cy="52" r="11" fill="#22233a" stroke="${O}" stroke-width="3.5"/><circle cx="94" cy="52" r="4.5" fill="#c9d4e6"/><path d="M94 43 V47 M94 57 V61 M85 52 H89 M99 52 H103" stroke="#555a7a" stroke-width="2"/></g></g>`, 'kart');
    },
    // top-down kart for the dodge lanes (driving upwards)
    kartTop(color = '#ff5a5f') {
      return svg('0 0 60 90', `<ellipse cx="30" cy="50" rx="26" ry="38" fill="#000" opacity=".25"/>
        <g ${SW} stroke-width="3">
          <rect x="2" y="14" width="12" height="20" rx="4" fill="#22233a"/><rect x="46" y="14" width="12" height="20" rx="4" fill="#22233a"/>
          <rect x="0" y="58" width="14" height="24" rx="4" fill="#22233a"/><rect x="46" y="58" width="14" height="24" rx="4" fill="#22233a"/>
          <path d="M18 6 C18 2 42 2 42 6 L48 70 C48 84 12 84 12 70 Z" style="fill:${color}"/>
          <rect x="14" y="2" width="32" height="7" rx="3" fill="#2a2c45"/>
          <circle cx="30" cy="50" r="11" fill="#fff"/><path d="M21 48 C21 42 39 42 39 48 V52 H21Z" style="fill:${color}"/>
        </g><path d="M22 14 L26 40 H22 Z" fill="#fff" opacity=".45"/>`, 'kart-top');
    },
    cone() {
      return svg('0 0 60 60', `${shadow(30, 54, 22, 4)}<g ${SW} stroke-width="3"><rect x="8" y="46" width="44" height="8" rx="3" fill="#ff7a1a"/><path d="M22 46 L28 6 H32 L38 46Z" fill="#ff7a1a"/></g><path d="M25 22 H35 L36.5 30 H23.5Z M22.5 36 H37.5 L38.5 42 H21.5Z" fill="#fff"/>`, 'cone');
    },
    barrier() {
      return svg('0 0 90 60', `${shadow(45, 54, 38, 4)}<g ${SW} stroke-width="3"><rect x="12" y="34" width="6" height="20" fill="#8a8fa8"/><rect x="72" y="34" width="6" height="20" fill="#8a8fa8"/><rect x="4" y="12" width="82" height="24" rx="4" fill="#fff"/></g><path d="M10 13 L22 13 L10 35Z M30 13 H42 L28 35 H16Z M50 13 H62 L48 35 H36Z M70 13 H82 L68 35 H56Z M84 22 V35 H76Z" fill="#ff4d4d"/><rect x="4" y="12" width="82" height="24" rx="4" fill="none" stroke="${O}" stroke-width="3"/><circle cx="15" cy="8" r="4" fill="#ffd23f" stroke="${O}" stroke-width="2"/><circle cx="75" cy="8" r="4" fill="#ffd23f" stroke="${O}" stroke-width="2"/>`, 'barrier');
    },
    checker() {
      return svg('0 0 20 40', `<defs><pattern id="chk" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="#fff"/><rect x="5" y="5" width="5" height="5" fill="#fff"/><rect x="5" width="5" height="5" fill="#1e1145"/><rect y="5" width="5" height="5" fill="#1e1145"/></pattern></defs><rect width="20" height="40" fill="url(#chk)"/>`, 'checker');
    },

    // ---------- asteroids ----------
    rock(seed = 1, boss = false) {
      // irregular polygon from a seed so each rock keeps its own silhouette
      let s = seed * 9301 + 49297;
      const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
      const n = 10;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = 40 + rnd() * 9;
        pts.push(`${(50 + Math.cos(a) * r).toFixed(1)},${(50 + Math.sin(a) * r).toFixed(1)}`);
      }
      const craters = [0, 1, 2].map(() => `<circle cx="${(30 + rnd() * 40).toFixed(1)}" cy="${(30 + rnd() * 40).toFixed(1)}" r="${(5 + rnd() * 7).toFixed(1)}" fill="#000" opacity=".22"/>`).join('');
      return svg('0 0 100 100', `<polygon points="${pts.join(' ')}" fill="${boss ? 'url(#g-ruby)' : 'url(#g-rock)'}" stroke="${O}" stroke-width="5" stroke-linejoin="round"/>
        ${craters}<path d="M26 30 C32 20 42 16 50 16" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".45"/>
        ${boss ? `<path d="M30 46 L44 52 M70 46 L56 52" stroke="${O}" stroke-width="5" stroke-linecap="round"/><circle cx="40" cy="58" r="5" fill="#fff35c" stroke="${O}" stroke-width="2.5"/><circle cx="60" cy="58" r="5" fill="#fff35c" stroke="${O}" stroke-width="2.5"/><path d="M38 74 C46 68 54 68 62 74" fill="none" stroke="${O}" stroke-width="4" stroke-linecap="round"/>` : ''}`, 'rock-art');
    },
    planet() {
      return svg('0 0 200 200', `<circle cx="100" cy="100" r="96" fill="url(#g-planet)" stroke="${O}" stroke-width="5"/>
        <path d="M40 60 C55 45 80 50 78 70 C76 86 56 84 52 100 C48 112 30 104 28 88 C27 76 30 68 40 60Z M120 40 C140 36 160 50 156 66 C152 78 134 72 128 84 C122 96 104 88 108 72 C110 60 108 44 120 40Z M100 130 C120 120 150 126 150 146 C150 164 126 172 112 162 C100 154 86 140 100 130Z" fill="#3ddc84" stroke="#178a4a" stroke-width="3"/>
        <path d="M30 60 C40 36 64 20 90 16" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" opacity=".35"/>`, 'planet');
    },
    ship() {
      return svg('0 0 60 70', `<g ${SW} stroke-width="3"><path d="M30 4 C40 14 44 30 42 48 H18 C16 30 20 14 30 4Z" fill="#f2f5ff"/><path d="M18 34 L6 52 L18 50Z M42 34 L54 52 L42 50Z" fill="#ff5a5f"/><circle cx="30" cy="26" r="7" fill="url(#g-glass)"/><path d="M22 48 L26 60 L30 52 L34 60 L38 48Z" fill="#ffd23f"/></g>`, 'ship');
    },

    // ---------- dragon ----------
    dragon() {
      const wing = `<g class="wing"><path d="M150 150 C120 96 70 56 16 62 C34 80 38 100 30 122 C52 112 66 118 74 138 C86 126 104 128 112 150 C122 142 138 144 146 162 Z" fill="url(#g-dwing)" stroke="${O}" stroke-width="5" stroke-linejoin="round"/>
        <path d="M150 150 C118 100 72 66 16 62 M108 112 L30 122 M120 128 L74 138 M134 146 L112 150" fill="none" stroke="#c43a5a" stroke-width="4" stroke-linecap="round"/></g>`;
      return svg('0 0 400 340', `
        <ellipse cx="200" cy="322" rx="150" ry="14" fill="#000" opacity=".35"/>
        <g class="wing-l">${wing}</g>
        <g transform="translate(400 0) scale(-1 1)"><g class="wing-r">${wing}</g></g>
        <g class="tail"><path d="M248 280 C310 300 360 270 352 226 C348 206 362 196 376 202" fill="none" stroke="${O}" stroke-width="30" stroke-linecap="round"/>
          <path d="M248 280 C310 300 360 270 352 226 C348 206 362 196 376 202" fill="none" stroke="#d72a3a" stroke-width="20" stroke-linecap="round"/>
          <path d="M370 182 L394 198 L374 216 L378 200Z" fill="#ffd23f" stroke="${O}" stroke-width="4" stroke-linejoin="round"/></g>
        <g class="body">
          <path d="M200 118 C258 118 284 180 278 240 C273 292 238 308 200 308 C162 308 127 292 122 240 C116 180 142 118 200 118Z" fill="url(#g-dbody)" stroke="${O}" stroke-width="5"/>
          <path d="M200 162 C232 162 246 210 242 256 C238 288 220 298 200 298 C180 298 162 288 158 256 C154 210 168 162 200 162Z" fill="url(#g-dbelly)" stroke="${O}" stroke-width="4"/>
          <path d="M168 196 C188 204 212 204 232 196 M162 222 C186 232 214 232 238 222 M160 250 C186 260 214 260 240 250 M166 276 C188 284 212 284 234 276" fill="none" stroke="#c97a14" stroke-width="3.5" stroke-linecap="round"/>
          <path d="M140 170 C134 190 132 210 134 230" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".3"/>
          <g stroke="${O}" stroke-width="4.5" stroke-linejoin="round">
            <path d="M140 222 C122 236 118 256 128 266 C136 270 146 262 152 250Z" fill="#e23a40"/>
            <path d="M260 222 C278 236 282 256 272 266 C264 270 254 262 248 250Z" fill="#e23a40"/>
            <path d="M138 296 C126 296 120 306 124 314 H176 C178 302 168 292 156 290Z" fill="#e23a40"/>
            <path d="M262 296 C274 296 280 306 276 314 H224 C222 302 232 292 244 290Z" fill="#e23a40"/>
          </g>
          <path d="M128 314 L132 304 L138 314 M142 314 L146 304 L152 314 M248 314 L252 304 L258 314 M262 314 L266 304 L272 314" fill="#fff" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>
        </g>
        <g class="head">
          <path d="M163 58 C146 34 144 16 154 0 C166 18 176 32 184 50Z" fill="url(#g-horn)" stroke="${O}" stroke-width="4.5" stroke-linejoin="round"/>
          <path d="M237 58 C254 34 256 16 246 0 C234 18 224 32 216 50Z" fill="url(#g-horn)" stroke="${O}" stroke-width="4.5" stroke-linejoin="round"/>
          <path d="M146 92 L120 78 L138 104Z M254 92 L280 78 L262 104Z" fill="#ffd23f" stroke="${O}" stroke-width="4" stroke-linejoin="round"/>
          <path d="M148 98 C142 58 168 38 200 38 C232 38 258 58 252 98 C249 128 228 146 200 146 C172 146 151 128 148 98Z" fill="url(#g-dbody)" stroke="${O}" stroke-width="5"/>
          <path d="M192 40 L200 26 L208 40Z" fill="#ffd23f" stroke="${O}" stroke-width="4" stroke-linejoin="round"/>
          <path d="M162 116 C162 100 180 96 200 96 C220 96 238 100 238 116 C238 134 222 146 200 146 C178 146 162 134 162 116Z" fill="#ff8f7a" stroke="${O}" stroke-width="4"/>
          <ellipse cx="188" cy="110" rx="5" ry="3.5" fill="${O}"/><ellipse cx="212" cy="110" rx="5" ry="3.5" fill="${O}"/>
          <path class="mouth" d="M174 128 C188 136 212 136 226 128" fill="none" stroke="${O}" stroke-width="4.5" stroke-linecap="round"/>
          <path d="M180 130 L184 142 L189 133Z M220 130 L216 142 L211 133Z" fill="#fff" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>
          <g class="eyes">
            <path d="M162 80 C166 68 182 66 190 76 C186 88 168 90 162 80Z" fill="#fff35c" stroke="${O}" stroke-width="4" stroke-linejoin="round"/>
            <path d="M238 80 C234 68 218 66 210 76 C214 88 232 90 238 80Z" fill="#fff35c" stroke="${O}" stroke-width="4" stroke-linejoin="round"/>
            <ellipse class="pupil" cx="178" cy="78" rx="3.2" ry="7" fill="${O}"/><ellipse class="pupil" cx="222" cy="78" rx="3.2" ry="7" fill="${O}"/>
          </g>
          <path class="brow" d="M156 66 L192 72 M244 66 L208 72" stroke="${O}" stroke-width="7" stroke-linecap="round"/>
          <path d="M160 70 C164 56 176 48 190 46" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".35"/>
        </g>`, 'dragon-art');
    },
    knight(color = '#2f8bff') {
      return svg('0 0 60 80', `${shadow(30, 76, 20, 3)}
        <g ${SW} stroke-width="3">
          <rect x="18" y="56" width="9" height="18" rx="3" fill="#5a6280"/><rect x="33" y="56" width="9" height="18" rx="3" fill="#5a6280"/>
          <path d="M14 40 C14 30 46 30 46 40 V60 H14Z" style="fill:${color}"/>
          <circle cx="30" cy="24" r="15" fill="url(#g-iron)"/>
          <rect x="20" y="20" width="20" height="6" rx="3" fill="${O}"/>
          <path d="M30 9 C34 2 42 2 44 6 C38 6 34 8 32 10Z" fill="#ff4d6d"/>
          <path d="M48 20 V58" stroke-width="4"/><path d="M48 14 L52 22 H44Z" fill="url(#g-iron)"/>
          <path d="M4 40 L20 36 V56 C20 62 12 66 8 66 C4 62 4 56 4 50Z" style="fill:${color}"/>
        </g><path d="M8 42 L16 40 V52 C16 56 12 58 10 58Z" fill="#fff" opacity=".35"/><circle cx="25" cy="18" r="3" fill="#fff" opacity=".7"/>`, 'knight');
    },

    // ---------- penalty ----------
    ball() {
      return svg('0 0 60 60', `${shadow(30, 57, 18, 3)}
        <circle cx="30" cy="28" r="25" fill="#fff" stroke="${O}" stroke-width="3.5"/>
        <path d="M30 18 L39.5 25 L36 36 H24 L20.5 25Z" fill="${O}"/>
        <path d="M30 3.5 L30 18 M39.5 25 L53 20 M36 36 L44 48 M24 36 L16 48 M20.5 25 L7 20" stroke="${O}" stroke-width="2.5"/>
        <path d="M24 4.5 L30 3.5 L36 4.5 L33 9 H27Z M51 14 L54.5 21 L53 27 L48 24 L49 17Z M9 14 L5.5 21 L7 27 L12 24 L11 17Z M40 47 L45 44 L47 49 L42 52Z M20 47 L15 44 L13 49 L18 52Z" fill="${O}"/>
        <path d="M12 18 C15 11 21 7 27 6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".9"/>`, 'ball');
    },
    goalie(color = '#2ee59d') {
      return svg('0 0 140 120', `${shadow(70, 116, 34, 4)}
        <g ${SW} stroke-width="4">
          <path d="M58 86 L54 112 H66 L70 92 L74 112 H86 L82 86Z" fill="#2a2c45"/>
          <path d="M46 52 C46 40 94 40 94 52 L90 90 H50Z" style="fill:${color}"/>
          <path d="M48 50 C34 40 22 26 16 12" fill="none" stroke-width="13" style="stroke:${color}"/>
          <path d="M92 50 C106 40 118 26 124 12" fill="none" stroke-width="13" style="stroke:${color}"/>
          <circle cx="15" cy="10" r="10" fill="#ffd23f"/><circle cx="125" cy="10" r="10" fill="#ffd23f"/>
          <circle cx="70" cy="28" r="16" fill="#ffcf9e"/>
          <path d="M54 26 C54 12 86 12 86 26 C80 20 62 20 54 26Z" fill="#5a3415"/>
        </g>
        <path d="M48 50 C34 40 22 26 16 12" fill="none" stroke="#000" stroke-opacity=".12" stroke-width="5" stroke-linecap="round"/>
        <rect x="62" y="58" width="16" height="16" rx="4" fill="#fff" opacity=".85"/><text x="70" y="71" text-anchor="middle" font-family="Heebo,sans-serif" font-weight="900" font-size="13" fill="${O}">1</text>
        <circle cx="64" cy="29" r="2.6" fill="${O}"/><circle cx="76" cy="29" r="2.6" fill="${O}"/>
        <path d="M64 37 C67 39 73 39 76 37" fill="none" stroke="${O}" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M52 52 C56 46 62 44 68 44" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".4"/>`, 'goalie');
    },
    // the shooter, seen from behind (team colored shirt)
    kicker(color = '#f2434f') {
      return svg('0 0 70 100', `${shadow(35, 96, 22, 4)}
        <g ${SW} stroke-width="3.5">
          <path d="M24 66 L20 92 H30 L34 72 L38 92 H48 L46 66Z" fill="#fff"/>
          <rect x="20" y="88" width="12" height="7" rx="3" fill="#2a2c45"/><rect x="38" y="88" width="12" height="7" rx="3" fill="#2a2c45"/>
          <path d="M16 36 C16 26 54 26 54 36 L50 68 H20Z" style="fill:${color}"/>
          <path d="M18 36 L8 58 M52 36 L62 58" fill="none" stroke-width="9" style="stroke:${color}"/>
          <circle cx="35" cy="18" r="13" fill="#5a3415"/>
        </g>
        <text x="35" y="58" text-anchor="middle" font-family="Heebo,sans-serif" font-weight="900" font-size="18" fill="#fff" stroke="${O}" stroke-width="3" paint-order="stroke">10</text>
        <path d="M22 34 C26 30 32 29 36 29" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".45"/>`, 'kicker');
    },

    // ---------- snowball ----------
    snowman(scarf = '#f2434f', down = false) {
      if (down)
        return svg('0 0 80 60', `${shadow(40, 56, 34, 4)}<g ${SW} stroke-width="3"><ellipse cx="22" cy="44" rx="18" ry="11" fill="#fff"/><ellipse cx="50" cy="47" rx="14" ry="8" fill="#eef6ff"/><circle cx="68" cy="44" r="9" fill="#fff"/><path d="M60 34 L62 26 L74 28 L72 36Z" fill="#2a2c45"/></g><path d="M8 40 C14 36 24 36 30 40" fill="none" stroke="#cfe3ff" stroke-width="4" stroke-linecap="round"/><path d="M66 45 L58 50" stroke="#ff7a1a" stroke-width="4" stroke-linecap="round"/><path d="M64 41 l3 3 m0 -3 l-3 3 M70 41 l3 3 m0 -3 l-3 3" stroke="${O}" stroke-width="2"/>`, 'snowman down');
      return svg('0 0 60 96', `${shadow(30, 92, 22, 4)}
        <g ${SW} stroke-width="3">
          <circle cx="30" cy="70" r="21" fill="#fff"/>
          <circle cx="30" cy="40" r="15" fill="#fff"/>
          <circle cx="30" cy="18" r="11" fill="#fff"/>
          <path d="M18 9 H42 L40 12 H20Z" fill="#2a2c45"/><rect x="22" y="-4" width="16" height="14" rx="2" fill="#2a2c45"/>
          <path d="M18 29 C24 33 36 33 42 29 L42 34 C36 38 24 38 18 34Z" style="fill:${scarf}"/>
          <path d="M38 33 L42 46 L36 47 L33 35Z" style="fill:${scarf}"/>
        </g>
        <rect x="22" y="4" width="16" height="3" style="fill:${scarf}"/>
        <path d="M30 20 L44 23 L30 24Z" fill="#ff7a1a" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>
        <circle cx="26" cy="15" r="2" fill="${O}"/><circle cx="34" cy="15" r="2" fill="${O}"/>
        <circle cx="30" cy="42" r="2" fill="${O}"/><circle cx="30" cy="50" r="2" fill="${O}"/><circle cx="30" cy="64" r="2.2" fill="${O}"/><circle cx="30" cy="74" r="2.2" fill="${O}"/>
        <path d="M14 58 C16 52 20 50 24 49 M18 32 C20 28 23 27 26 27" fill="none" stroke="#cfe3ff" stroke-width="4" stroke-linecap="round"/>
        <path d="M15 40 L2 30 M45 40 L58 30" stroke="#8a5226" stroke-width="3" stroke-linecap="round"/>`, 'snowman');
    },
    snowball() {
      return svg('0 0 40 40', `<circle cx="20" cy="20" r="16" fill="#fff" stroke="${O}" stroke-width="3"/><path d="M10 16 C12 10 17 7 22 7" fill="none" stroke="#cfe3ff" stroke-width="4" stroke-linecap="round"/><circle cx="25" cy="25" r="3" fill="#dbe9ff"/>`, 'snowball');
    },

    // ---------- fishing ----------
    fish(k = 'small') {
      if (k === 'boot')
        return svg('0 0 80 60', `<g ${SW} stroke-width="3"><path d="M24 4 H46 V34 L70 40 C76 42 76 54 70 54 H22 C18 54 18 50 20 46Z" fill="#8a5a2b"/><rect x="22" y="4" width="26" height="8" rx="2" fill="#6b4220"/><path d="M20 50 H74" stroke-width="3"/></g><path d="M28 14 V40" stroke="#c98a4b" stroke-width="3" stroke-linecap="round"/><path d="M60 44 C64 44 68 46 68 48" fill="none" stroke="#c98a4b" stroke-width="2.5" stroke-linecap="round"/><circle cx="54" cy="30" r="3" fill="#7dd3fc" stroke="${O}" stroke-width="1.5"/>`, 'fish fish-boot');
      if (k === 'octo')
        return svg('0 0 80 80', `<g ${SW} stroke-width="3">
          ${[14, 26, 40, 54, 66].map((x, i) => `<path d="M${x} 46 C${x - 6 + i * 2} 60 ${x + 8 - i * 3} 66 ${x - 2} 76" fill="none" stroke="${O}" stroke-width="10" stroke-linecap="round"/><path d="M${x} 46 C${x - 6 + i * 2} 60 ${x + 8 - i * 3} 66 ${x - 2} 76" fill="none" stroke="#b05cff" stroke-width="5.5" stroke-linecap="round"/>`).join('')}
          <path d="M40 4 C62 4 72 20 70 36 C68 50 56 54 40 54 C24 54 12 50 10 36 C8 20 18 4 40 4Z" fill="url(#g-purple)"/></g>
          <circle cx="30" cy="30" r="7" fill="#fff" stroke="${O}" stroke-width="2.5"/><circle cx="50" cy="30" r="7" fill="#fff" stroke="${O}" stroke-width="2.5"/><circle cx="31" cy="31" r="3.5" fill="${O}"/><circle cx="51" cy="31" r="3.5" fill="${O}"/>
          <path d="M34 42 C38 45 42 45 46 42" fill="none" stroke="${O}" stroke-width="2.5" stroke-linecap="round"/><path d="M20 16 C24 10 30 8 36 8" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".5"/>
          <path d="M60 8 l2 -6 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2Z" fill="#fff"/>`, 'fish fish-octo');
      const C = { small: ['#9fd8ff', '#3b8eff'], medium: ['#a6ffcf', '#18b86b'], big: ['#ffc79a', '#ff6a2a'], gold: ['#fff2a8', '#ffb300'] }[k] || ['#9fd8ff', '#3b8eff'];
      const id = 'gf-' + k;
      return svg('0 0 90 54', `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C[0]}"/><stop offset="1" stop-color="${C[1]}"/></linearGradient></defs>
        <g ${SW} stroke-width="3">
          <path d="M66 27 L88 8 C86 20 86 34 88 46Z" fill="url(#${id})"/>
          <path d="M34 8 C40 0 52 2 56 10Z" fill="url(#${id})"/>
          <path d="M4 27 C10 8 30 4 46 6 C60 8 70 18 70 27 C70 36 60 46 46 48 C30 50 10 46 4 27Z" fill="url(#${id})"/>
          <path d="M38 40 C42 46 48 48 52 46 L46 38Z" fill="url(#${id})"/>
        </g>
        <path d="M28 12 C30 22 30 32 28 42" fill="none" stroke="${O}" stroke-width="2" opacity=".35"/>
        <path d="M14 18 C20 12 30 10 38 10" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".6"/>
        <circle cx="17" cy="23" r="5.5" fill="#fff" stroke="${O}" stroke-width="2"/><circle cx="16" cy="23" r="2.8" fill="${O}"/>
        <path d="M5 31 C8 33 11 33 13 31" fill="none" stroke="${O}" stroke-width="2.2" stroke-linecap="round"/>
        ${k === 'gold' ? '<path d="M50 14 l2 -5 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2Z M60 34 l1.5 -3.5 l1.5 3.5 l3.5 1.5 l-3.5 1.5 l-1.5 3.5 l-1.5 -3.5 l-3.5 -1.5Z" fill="#fff"/>' : ''}
        ${k === 'big' ? `<path d="M40 16 C44 22 44 32 40 38 M50 16 C54 22 54 32 50 38" fill="none" stroke="${O}" stroke-width="2" opacity=".3"/>` : ''}`, 'fish fish-' + k);
    },
    bobber() {
      return svg('0 0 30 44', `<path d="M15 0 V10" stroke="${O}" stroke-width="2"/><g ${SW} stroke-width="2.5"><path d="M15 8 C24 8 26 18 26 22 H4 C4 18 6 8 15 8Z" fill="#ff4d6d"/><path d="M4 22 H26 C26 32 22 40 15 40 C8 40 4 32 4 22Z" fill="#fff"/></g><path d="M8 16 C9 13 11 11 14 11" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".6"/>`, 'bobber');
    },

    // ---------- rocket ----------
    rocket() {
      return svg('0 0 100 190', `
        <g class="flame"><path d="M32 140 C30 160 40 176 50 190 C60 176 70 160 68 140Z" fill="url(#g-fire)"/><path d="M40 140 C40 154 46 164 50 172 C54 164 60 154 60 140Z" fill="#fffbd1"/></g>
        <g ${SW} stroke-width="4">
          <path d="M26 104 L6 136 L8 150 L30 132Z" fill="#ff4d6d"/><path d="M74 104 L94 136 L92 150 L70 132Z" fill="#ff4d6d"/>
          <path d="M50 4 C76 26 82 70 76 132 H24 C18 70 24 26 50 4Z" fill="#f4f6ff"/>
          <path d="M50 4 C62 14 69 26 73 40 H27 C31 26 38 14 50 4Z" fill="#ff4d6d"/>
          <rect x="32" y="130" width="36" height="12" rx="4" fill="#8a8fa8"/>
          <circle cx="50" cy="70" r="15" fill="url(#g-glass)"/>
          <path d="M50 132 V108" stroke-width="5"/>
        </g>
        <circle cx="50" cy="70" r="9" fill="none" stroke="#fff" stroke-width="3" opacity=".6"/>
        <path d="M34 50 C33 70 34 94 36 120" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".7"/>
        <path d="M70 60 C71 80 70 100 68 124" fill="none" stroke="#c9cfe6" stroke-width="5" stroke-linecap="round"/>
        <text x="50" y="104" text-anchor="middle" font-family="Heebo,sans-serif" font-weight="900" font-size="12" fill="#3b8eff">ישראל</text>`, 'rocket-art');
    },
    moon() {
      return svg('0 0 200 200', `<circle cx="100" cy="100" r="94" fill="#efeadb" stroke="${O}" stroke-width="5"/>
        <circle cx="100" cy="100" r="94" fill="url(#g-moonshade)"/>
        <circle cx="70" cy="64" r="20" fill="#d6cfb8" stroke="#b9b096" stroke-width="3"/><circle cx="132" cy="120" r="28" fill="#d6cfb8" stroke="#b9b096" stroke-width="3"/>
        <circle cx="60" cy="134" r="12" fill="#d6cfb8" stroke="#b9b096" stroke-width="3"/><circle cx="140" cy="56" r="9" fill="#d6cfb8" stroke="#b9b096" stroke-width="2.5"/>
        <path d="M34 70 C44 40 70 22 98 18" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" opacity=".6"/>`, 'moon');
    },

    // ---------- lobby game covers ----------
    cover(id) {
      const scenes = {
        territory: `<rect width="160" height="100" fill="#3aa0d8"/><path d="M0 70 C40 60 120 60 160 70 V100 H0Z" fill="#2c7fa8"/>
          <g transform="translate(18 34)">${[0, 1, 2, 3, 4].map((c) => [0, 1].map((r) => `<rect x="${c * 25}" y="${r * 24}" width="22" height="20" rx="4" fill="${c < 2 ? '#ff6b6b' : c > 2 ? '#4aa3ff' : '#8fd36a'}" stroke="${O}" stroke-width="2.5"/>`).join('')).join('')}</g>
          <g transform="translate(55 6) scale(.5)">${Art.castle('#ffd23f').replace(/<\/?svg[^>]*>/g, '')}</g>
          <g transform="translate(14 14) scale(.55)">${Art.flag('#ff5a5f').replace(/<\/?svg[^>]*>/g, '')}</g><g transform="translate(118 14) scale(.55)">${Art.flag('#2f8bff').replace(/<\/?svg[^>]*>/g, '')}</g>`,
        tug: `<rect width="160" height="100" fill="#8fd6ff"/><circle cx="130" cy="20" r="12" fill="#ffe66b"/><path d="M0 62 C40 50 110 54 160 60 V100 H0Z" fill="#5cc45a"/><ellipse cx="80" cy="82" rx="18" ry="7" fill="#6b3a17" stroke="${O}" stroke-width="2.5"/>
          <path d="M8 60 H152" stroke="${O}" stroke-width="8" stroke-linecap="round"/><path d="M8 60 H152" stroke="#d9a35f" stroke-width="4.5" stroke-dasharray="5 4"/><rect x="76" y="54" width="8" height="18" rx="2" fill="#ff4d6d" stroke="${O}" stroke-width="2"/>
          <g transform="translate(14 34) scale(.42)">${Art.puller('#ff6b5a', 0).replace(/<\/?svg[^>]*>/g, '')}</g><g transform="translate(146 34) scale(-.42 .42)">${Art.puller('#3b8eff', 1).replace(/<\/?svg[^>]*>/g, '')}</g>`,
        gems: `<rect width="160" height="100" fill="#3a1d63"/><path d="M0 100 L0 70 L20 60 L34 72 L52 58 L70 74 L90 62 L110 72 L130 58 L160 68 V100Z" fill="#26114a"/>
          <g transform="translate(46 30) scale(1)">${Art.chest(4).replace(/<\/?svg[^>]*>/g, '')}</g>
          <g transform="translate(10 8) scale(.7)">${Art.item('gem').replace(/<\/?svg[^>]*>/g, '')}</g><g transform="translate(120 12) scale(.62)">${Art.item('coin').replace(/<\/?svg[^>]*>/g, '')}</g><g transform="translate(124 54) scale(.5)">${Art.item('crown').replace(/<\/?svg[^>]*>/g, '')}</g><g transform="translate(14 56) scale(.5)">${Art.item('bomb').replace(/<\/?svg[^>]*>/g, '')}</g>`,
        race: `<rect width="160" height="100" fill="#8fd6ff"/><path d="M0 44 C30 36 60 40 90 34 C120 28 140 34 160 32 V100 H0Z" fill="#5cc45a"/><rect y="56" width="160" height="34" fill="#3d3f55"/><path d="M0 73 H160" stroke="#fff" stroke-width="3" stroke-dasharray="12 10"/><rect x="138" y="56" width="10" height="34" fill="#fff"/><path d="M138 56 h5 v5 h-5z M143 61 h5 v5 h-5z M138 66 h5 v5 h-5z M143 71 h5 v5 h-5z M138 76 h5 v5 h-5z M143 81 h5 v5 h-5z M138 86 h5 v4 h-5z" fill="${O}"/>
          <g transform="translate(30 38) scale(.62)">${Art.kart('#ff5a5f').replace(/<\/?svg[^>]*>/g, '')}</g><path d="M8 66 H26 M14 74 H28 M10 82 H24" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>`,
        closer: `<rect width="160" height="100" fill="#1f1647"/>${Array.from({ length: 8 * 5 }, (_, i) => { const x = i % 8, y = Math.floor(i / 8); const own = (x < 3 && y < 3) ? '#ff6b6b' : (x > 4 && y > 1) ? '#2ee59d' : null; return `<rect x="${12 + x * 17.5}" y="${8 + y * 17.5}" width="15" height="15" rx="3" fill="${own || '#33296a'}"/>`; }).join('')}
          <path d="M65 26 H98 V62 H82" fill="none" stroke="#ff6b6b" stroke-width="5" stroke-dasharray="6 4" stroke-linecap="round"/><circle cx="82" cy="62" r="8" fill="#ff6b6b" stroke="#fff" stroke-width="3"/>`,
        tower: `<rect width="160" height="100" fill="#ff9a6b"/><rect width="160" height="60" fill="#6a4bd8" opacity=".55"/><circle cx="30" cy="28" r="12" fill="#ffe66b"/><path d="M0 86 V70 h10 v-8 h12 v12 h10 v-16 h14 v20 h20 v-10 h12 v14 h30 v-20 h14 v10 h12 v-6 h16 v30Z" fill="#3a2275" opacity=".7"/>
          ${[0, 1, 2, 3, 4].map((i) => `<rect x="${64 + (i % 2) * 3}" y="${78 - i * 14}" width="32" height="13" rx="2" fill="hsl(${200 + i * 30} 80% 60%)" stroke="${O}" stroke-width="2.5"/>`).join('')}
          <rect x="0" y="86" width="160" height="14" fill="#3a2813"/><path d="M118 4 V20 M118 20 H128 V24 H108 V20Z" stroke="${O}" stroke-width="2.5" fill="#ffcf33"/><rect x="106" y="24" width="30" height="13" rx="2" fill="#ff5a7a" stroke="${O}" stroke-width="2.5"/>`,
        asteroids: `<rect width="160" height="100" fill="#0b0b2e"/>${[[12, 14], [40, 30], [70, 10], [100, 26], [140, 12], [150, 40], [20, 50]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4" fill="#fff"/>`).join('')}
          <circle cx="80" cy="150" r="80" fill="url(#g-planet)" stroke="${O}" stroke-width="3"/><path d="M10 84 C40 60 120 60 150 84" fill="none" stroke="#7de3ff" stroke-width="3" opacity=".7"/>
          <g transform="translate(96 14) scale(.36)">${Art.rock(3).replace(/<\/?svg[^>]*>/g, '')}</g><g transform="translate(30 20) scale(.24)">${Art.rock(7).replace(/<\/?svg[^>]*>/g, '')}</g><path d="M80 74 L112 32" stroke="#ff4fd8" stroke-width="3" stroke-linecap="round"/>`,
        dragon: `<rect width="160" height="100" fill="#2a0f2e"/><path d="M0 100 V80 L30 60 L50 72 L80 50 L110 70 L130 58 L160 74 V100Z" fill="#4a1630"/><ellipse cx="80" cy="96" rx="80" ry="14" fill="#ff7a1a" opacity=".35"/>
          <g transform="translate(36 6) scale(.22)">${Art.dragon().replace(/<\/?svg[^>]*>/g, '')}</g>`,
        classic: `<rect width="160" height="100" fill="#46178f"/><circle cx="20" cy="18" r="30" fill="#5b2bb0"/><circle cx="150" cy="90" r="34" fill="#3a1080"/>
          <rect x="22" y="8" width="116" height="24" rx="6" fill="#fff" stroke="${O}" stroke-width="2.5"/><rect x="34" y="17" width="70" height="6" rx="3" fill="#c9c2f0"/><circle cx="124" cy="20" r="8" fill="#ffd23f" stroke="${O}" stroke-width="2"/><text x="124" y="23.5" font-family="Heebo,sans-serif" font-weight="900" font-size="9" text-anchor="middle" fill="${O}">20</text>
          ${[['#e9334f', 12, 40, 0], ['#1f73e0', 84, 40, 1], ['#e6a400', 12, 68, 2], ['#23a14a', 84, 68, 3]].map(([c, x, y, i]) => `<rect x="${x}" y="${y}" width="64" height="24" rx="5" fill="${c}" stroke="${O}" stroke-width="2.5"/><g transform="translate(${x + 6} ${y + 5}) scale(.58)">${Art.shape(i).replace(/<\/?svg[^>]*>/g, '')}</g>`).join('')}`,
        pyramid: `<rect width="160" height="100" fill="#ffc98a"/><circle cx="30" cy="22" r="12" fill="#fff3b0"/><path d="M0 84 C40 74 120 76 160 84 V100 H0Z" fill="#d99a4e"/>
          ${Array.from({ length: 7 }, (_, k) => `<rect x="${30 + k * 7}" y="${80 - k * 9}" width="${100 - k * 14}" height="9" fill="${k === 6 ? '#ffcf33' : k % 2 ? '#e2b26a' : '#ecc584'}" stroke="#a87230" stroke-width="1.2"/>`).join('')}
          <g transform="translate(36 54) scale(.16)">${Art.mascot(0).replace(/<\/?svg[^>]*>/g, '')}</g><g transform="translate(70 36) scale(.16)">${Art.mascot(1).replace(/<\/?svg[^>]*>/g, '')}</g><g transform="translate(104 54) scale(.16)">${Art.mascot(2).replace(/<\/?svg[^>]*>/g, '')}</g>`,
        penalty: `<rect width="160" height="100" fill="#3fae4f"/>${[0, 1, 2, 3, 4].map((i) => `<rect x="${i * 36}" y="0" width="18" height="100" fill="#4cbf5c"/>`).join('')}
          <path d="M30 14 H130 V62 H30Z" fill="#fff" fill-opacity=".18"/><path d="M30 62 V14 H130 V62" fill="none" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>
          <path d="M38 20 H122 M38 30 H122 M38 40 H122 M38 50 H122 M46 14 V62 M62 14 V62 M78 14 V62 M94 14 V62 M110 14 V62" stroke="#fff" stroke-width="1.2" opacity=".55"/>
          <g transform="translate(58 20) scale(.32)">${Art.goalie('#ffd23f').replace(/<\/?svg[^>]*>/g, '')}</g>
          <path d="M0 76 H160" stroke="#fff" stroke-width="3" opacity=".7"/><g transform="translate(96 66) scale(.42)">${Art.ball().replace(/<\/?svg[^>]*>/g, '')}</g>
          <path d="M104 72 C110 58 116 46 120 30" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="4 4" opacity=".8"/>`,
        snowball: `<rect width="160" height="100" fill="#9fd4ff"/><path d="M0 64 C30 54 60 60 80 58 C110 54 140 56 160 62 V100 H0Z" fill="#f4f9ff"/><path d="M0 78 C40 70 120 72 160 78 V100 H0Z" fill="#dcecff"/>
          <g transform="translate(14 30) scale(.5)">${Art.snowman('#f2434f').replace(/<\/?svg[^>]*>/g, '')}</g><g transform="translate(118 30) scale(.5)">${Art.snowman('#2f80ff').replace(/<\/?svg[^>]*>/g, '')}</g>
          <path d="M44 50 C64 18 92 18 112 44" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="5 5"/><g transform="translate(70 14) scale(.45)">${Art.snowball().replace(/<\/?svg[^>]*>/g, '')}</g>
          ${[[30, 12], [60, 30], [100, 10], [140, 26], [80, 40], [20, 48]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="#fff"/>`).join('')}`,
        fishing: `<rect width="160" height="100" fill="#ffcf8a"/><circle cx="128" cy="24" r="13" fill="#fff3b0"/><rect y="46" width="160" height="54" fill="#2a8fd8"/><path d="M0 52 Q20 48 40 52 T80 52 T120 52 T160 52" fill="none" stroke="#9fe0ff" stroke-width="2.5"/><path d="M0 70 Q20 66 40 70 T80 70 T120 70 T160 70" fill="none" stroke="#7cc8f5" stroke-width="2" opacity=".7"/>
          <rect x="0" y="40" width="44" height="8" fill="#8a5226" stroke="${O}" stroke-width="2"/><rect x="8" y="48" width="5" height="24" fill="#6b4220"/><rect x="32" y="48" width="5" height="24" fill="#6b4220"/>
          <path d="M30 40 L74 6" stroke="#5a3415" stroke-width="3" stroke-linecap="round"/><path d="M74 6 C80 20 86 36 90 52" fill="none" stroke="#fff" stroke-width="1.2"/>
          <g transform="translate(84 46) scale(.4)">${Art.bobber().replace(/<\/?svg[^>]*>/g, '')}</g>
          <g transform="translate(100 18) rotate(-25) scale(.55)">${Art.fish('gold').replace(/<\/?svg[^>]*>/g, '')}</g><path d="M104 46 C108 42 114 42 118 46" fill="none" stroke="#fff" stroke-width="2"/>`,
        bomb: `<rect width="160" height="100" fill="#2b1350"/>${Array.from({ length: 7 }, (_, i) => { const a = (i / 7) * Math.PI * 2; return `<circle cx="${80 + Math.cos(a) * 58}" cy="${52 + Math.sin(a) * 34}" r="9" fill="${['#ff5a5f', '#ffc83d', '#2ee59d', '#22c7e8', '#8b5cf6', '#ff4fa3', '#ff8a3d'][i]}" stroke="#fff" stroke-width="2.5"/>`; }).join('')}
          <g transform="translate(56 22) scale(1.05)">${Art.item('bomb').replace(/<\/?svg[^>]*>/g, '')}</g>
          <path d="M26 30 C40 18 54 18 62 26" fill="none" stroke="#ffd23f" stroke-width="2.5" stroke-dasharray="4 4"/>`,
        rocket: `<defs><linearGradient id="cv-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0b2e"/><stop offset=".7" stop-color="#3a2a8f"/><stop offset="1" stop-color="#7a5cff"/></linearGradient></defs><rect width="160" height="100" fill="url(#cv-sky)"/>
          ${[[14, 12], [36, 40], [58, 8], [120, 50], [146, 14], [100, 30], [24, 66]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4" fill="#fff"/>`).join('')}
          <g transform="translate(108 6) scale(.22)">${Art.moon().replace(/<\/?svg[^>]*>/g, '')}</g>
          <g transform="translate(62 22) rotate(18) scale(.36)">${Art.rocket().replace(/<\/?svg[^>]*>/g, '')}</g>
          <path d="M0 92 C40 80 120 80 160 92 V100 H0Z" fill="#fff" opacity=".85"/>`,
      };
      return `<svg class="art cover" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${scenes[id] || ''}</svg>`;
    },
  };

  window.Art = Art;
})();
