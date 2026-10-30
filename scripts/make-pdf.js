// A tiny generator of valid multi-page PDFs for tests: makePdf(['Page one', 'Page two']) → Buffer.
// Each page is A4 landscape with a big title, so PDF.js has something to draw. No libraries.
function makePdf(titles) {
  const objs = [];
  const add = (body) => objs.push(body) && objs.length; // returns the object number (1-based)
  const n = titles.length;
  // 1 = catalog, 2 = pages, 3 = font, then per page: page, content
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add(`<< /Type /Pages /Kids [${titles.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${n} >>`);
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  titles.forEach((t, i) => {
    const text = String(t).replace(/[()\\]/g, '').replace(/[^\x20-\x7e]/g, '?');
    const stream = `0.1 0.3 0.8 rg 0 0 842 90 re f BT /F1 64 Tf 0.1 0.1 0.3 rg 60 330 Td (${text}) Tj ET BT /F1 24 Tf 1 1 1 rg 60 35 Td (page ${i + 1} of ${n}) Tj ET`;
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`);
    add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

module.exports = { makePdf };
