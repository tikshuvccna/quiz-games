// Shared media folders next to the app:
//   backgrounds/  pictures (jpg/png/webp/gif) and videos (mp4/webm) → extra lobby/game backgrounds.
//                 A video can have a still picture with the same name (wave.mp4 + wave.jpg) for phones.
//   videos/       video files (mp4/webm) + videos.json: [{ "title": "...", "youtube": "<link or id>" }]
//                 → the video library for the lobby (local files work without internet).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BG_DIR = process.env.BACKGROUNDS_DIR || path.join(ROOT, 'backgrounds');
const VIDEO_DIR = process.env.VIDEOS_DIR || path.join(ROOT, 'videos');
const IMG = /\.(jpe?g|png|webp|gif|avif)$/i;
const VID = /\.(mp4|webm|m4v|mov)$/i;

const ls = (dir) => {
  try {
    return fs.readdirSync(dir).filter((f) => !f.startsWith('.')).sort((a, b) => a.localeCompare(b, 'he'));
  } catch {
    return [];
  }
};
const nice = (f) => f.replace(/\.\w+$/, '').replace(/^\d+[-_.\s]*/, '').replace(/[-_]+/g, ' ').trim() || f;

function backgrounds() {
  const files = ls(BG_DIR);
  const out = [];
  for (const f of files) {
    const url = '/backgrounds/' + encodeURIComponent(f);
    if (VID.test(f)) {
      const base = f.replace(/\.\w+$/, '');
      const still = files.find((x) => IMG.test(x) && x.replace(/\.\w+$/, '') === base);
      out.push({ id: 'file:' + f, name: nice(f), kind: 'video', url, poster: still ? '/backgrounds/' + encodeURIComponent(still) : null });
    } else if (IMG.test(f)) {
      // a picture that is only a video's still is not a scene of its own
      const base = f.replace(/\.\w+$/, '');
      if (files.some((x) => VID.test(x) && x.replace(/\.\w+$/, '') === base)) continue;
      out.push({ id: 'file:' + f, name: nice(f), kind: 'image', url });
    }
  }
  return out;
}

const isBackground = (id) => backgrounds().some((b) => b.id === id);

const youtubeId = (s) => {
  const m = String(s || '').match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/|live\/)([\w-]{11})/);
  return m ? m[1] : /^[\w-]{11}$/.test(String(s || '').trim()) ? String(s).trim() : '';
};

function videos() {
  const out = [];
  let list = [];
  try {
    list = JSON.parse(fs.readFileSync(path.join(VIDEO_DIR, 'videos.json'), 'utf8'));
  } catch {}
  for (const v of Array.isArray(list) ? list : []) {
    const id = youtubeId(v && (v.youtube || v.id || v.url));
    if (id) out.push({ kind: 'youtube', key: id, title: String(v.title || '').slice(0, 80) || 'סרטון', thumb: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` });
  }
  for (const f of ls(VIDEO_DIR)) {
    if (VID.test(f)) out.push({ kind: 'file', key: 'file:' + f, title: nice(f), url: '/videos/' + encodeURIComponent(f) });
  }
  return out;
}

const isVideoFile = (key) => videos().some((v) => v.kind === 'file' && v.key === key);

module.exports = { BG_DIR, VIDEO_DIR, backgrounds, isBackground, videos, isVideoFile, youtubeId };
