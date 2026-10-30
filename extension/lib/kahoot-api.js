// Talks to Kahoot's own site (the same JSON its pages use) and builds the export zip our program imports.
// Works in the extension page (global KahootApi) and in Node (module.exports), so it can be tested without a browser.
//
// The zip: manifest.json { app: 'kahoot-export', version: 1, quizzes: [...] } · quizzes/<uuid>.json (Kahoot's JSON, untouched) ·
// images/<picture id>.<ext>. The conversion to our format happens inside the program (server/importers/kahoot.js), so a change
// in Kahoot's format is fixed there and this extension does not need to be reinstalled.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KahootApi = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const API = 'https://create.kahoot.it/rest/kahoots/';
  const MEDIA = 'https://media.kahoot.it/';
  const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp', 'image/svg+xml': '.svg' };
  const MAX_QUIZZES = 100;
  const MAX_IMAGE = 12 * 1024 * 1024;

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const get = (o) => (o && o.fetch) || globalThis.fetch.bind(globalThis);

  class KahootError extends Error {
    constructor(message, code) {
      super(message);
      this.code = code;
    }
  }

  async function json(url, opts) {
    let r;
    try {
      r = await get(opts)(url, { credentials: 'include' });
    } catch (e) {
      throw new KahootError('אין חיבור לאינטרנט או ש־Kahoot חסם את הבקשה', 'network');
    }
    if (r.status === 401 || r.status === 403) throw new KahootError('החידון פרטי או שדורש התחברות. התחברו ל־Kahoot בדפדפן ונסו שוב', 'private');
    if (r.status === 404) throw new KahootError('החידון לא נמצא', 'missing');
    if (r.status === 429) throw new KahootError('Kahoot מגביל בקשות. חכו דקה ונסו שוב', 'rate');
    if (!r.ok) throw new KahootError(`Kahoot החזיר שגיאה ${r.status}`, 'http');
    return r.json();
  }

  // search Kahoot's public quizzes. cursor = how many results to skip (Kahoot shows at most 10000)
  async function search(query, opts = {}) {
    const limit = opts.limit || 20;
    const cursor = opts.cursor || 0;
    const q = new URLSearchParams({ query: String(query || '').trim(), limit, cursor, orderBy: opts.orderBy || 'relevance', searchCluster: 1 });
    if (opts.language) q.set('language', opts.language);
    const d = await json(API + '?' + q, opts);
    const raw = Array.isArray(d.entities) ? d.entities : [];
    const items = raw
      .map((e) => e && e.card)
      .filter((c) => c && c.type === 'quiz' && UUID.test(c.uuid || ''))
      .map((c) => ({ uuid: c.uuid, title: String(c.title || '').trim(), author: c.creator_username || '', questions: c.number_of_questions || 0, cover: c.cover || '', description: String(c.description || '').slice(0, 200) }));
    const total = Math.min(d.totalHits || 0, 10000);
    return { items, total, next: cursor + raw.length, more: raw.length > 0 && cursor + raw.length < total };
  }

  async function getQuiz(uuid, opts) {
    if (!UUID.test(uuid || '')) throw new KahootError('מזהה חידון לא תקין', 'bad');
    const k = await json(API + uuid, opts);
    if (!k || !Array.isArray(k.questions)) throw new KahootError('הקובץ ש־Kahoot החזיר אינו חידון', 'bad');
    return k;
  }

  const idOfUrl = (u) => String(u || '').split(/[?#]/)[0].split('/').filter(Boolean).pop() || '';

  // every picture id a quiz uses: question pictures, answer pictures, GIFs and slide backgrounds
  function imageIds(k) {
    const ids = new Set();
    for (const q of k.questions || []) {
      const main = (q.imageMetadata && q.imageMetadata.id) || idOfUrl(q.image);
      if (main) ids.add(main);
      for (const m of q.media || []) if (m && m.id && /^(background_image|giphy_gif|giphy_sticker|image)$/.test(m.type)) ids.add(m.id);
      for (const c of q.choices || []) if (c && c.image && c.image.id) ids.add(c.image.id);
    }
    return [...ids];
  }

  function sniff(b) {
    if (b[0] === 0x89 && b[1] === 0x50) return '.png';
    if (b[0] === 0xff && b[1] === 0xd8) return '.jpg';
    if (b[0] === 0x47 && b[1] === 0x49) return '.gif';
    if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57) return '.webp';
    return '';
  }

  async function getImage(id, opts) {
    let last;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await get(opts)(MEDIA + id);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const bytes = new Uint8Array(await r.arrayBuffer());
        if (!bytes.length || bytes.length > MAX_IMAGE) throw new Error('size');
        const ext = EXT[String(r.headers.get('content-type') || '').split(';')[0].trim()] || sniff(bytes);
        if (!ext) throw new Error('type');
        return { id, bytes, ext };
      } catch (e) {
        last = e;
        await wait(300 * (attempt + 1));
      }
    }
    throw last;
  }

  // download the quizzes and their pictures and pack them. onProgress({ phase: 'quiz' | 'image' | 'pack', done, total, title })
  async function buildExport(uuids, opts = {}) {
    const JSZip = opts.JSZip;
    if (!JSZip) throw new Error('JSZip is missing');
    const list = [...new Set(uuids)].slice(0, MAX_QUIZZES);
    const progress = opts.onProgress || (() => {});
    const zip = new JSZip();
    const quizzes = [];
    const failed = [];
    const ids = new Set();
    for (const [i, uuid] of list.entries()) {
      progress({ phase: 'quiz', done: i, total: list.length, title: uuid });
      try {
        const k = await getQuiz(uuid, opts);
        zip.file(`quizzes/${uuid}.json`, JSON.stringify(k));
        quizzes.push({ uuid, title: String(k.title || ''), file: `quizzes/${uuid}.json`, questions: k.questions.length });
        imageIds(k).forEach((id) => ids.add(id));
        progress({ phase: 'quiz', done: i + 1, total: list.length, title: String(k.title || uuid) });
      } catch (e) {
        failed.push({ uuid, error: e.message, code: e.code });
        // the site says stop: no point in asking for more
        if (e.code === 'rate' || e.code === 'network') break;
      }
      if (i < list.length - 1) await wait(opts.pause === undefined ? 150 : opts.pause);
    }
    // pictures, a few at a time
    const queue = [...ids];
    const missing = [];
    let done = 0;
    const worker = async () => {
      while (queue.length) {
        const id = queue.shift();
        try {
          const img = await getImage(id, opts);
          zip.file(`images/${id}${img.ext}`, img.bytes);
        } catch {
          missing.push(id);
        }
        progress({ phase: 'image', done: ++done, total: ids.size });
      }
    };
    await Promise.all(Array.from({ length: Math.min(opts.concurrency || 4, ids.size) }, worker));
    progress({ phase: 'pack', done: 0, total: 1 });
    zip.file('manifest.json', JSON.stringify({ app: 'kahoot-export', version: 1, created: new Date().toISOString(), quizzes }));
    const data = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    return { data, quizzes: quizzes.length, images: ids.size - missing.length, missingImages: missing.length, failed, titles: quizzes.map((q) => q.title) };
  }

  return { search, getQuiz, imageIds, getImage, buildExport, KahootError, UUID, MAX_QUIZZES };
});
