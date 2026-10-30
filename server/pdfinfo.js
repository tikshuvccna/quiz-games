// How many pages a PDF has (used by the lesson import to expand "deck.pdf:3-7" and to catch a page that does not exist).
// PDF.js runs here without a canvas: reading the page count needs no drawing.
async function pageCount(buffer) {
  try {
    const lib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await lib.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, isEvalSupported: false, disableFontFace: true, verbosity: 0 }).promise;
    const n = doc.numPages;
    await doc.destroy();
    return n;
  } catch {
    return 0;
  }
}

module.exports = { pageCount };
