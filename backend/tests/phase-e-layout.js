/**
 * Fase E — Validación de layout de PDFs (texto):
 *  1) detecta solapamientos de texto (mismas coordenadas)
 *  2) detecta texto fuera de los márgenes APA (72pt a cada lado, carta)
 * Uso: node tests/phase-e-layout.js [archivo.pdf ...]
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '_phase_e_out');
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 72; // APA 2.54cm = 72pt

// Anchos de Helvetica (AFM) para ASCII imprimible; fallback para no-ASCII.
const AFM_DIR = path.join(__dirname, '..', 'node_modules', 'pdfkit', 'js', 'data');
function loadAfm(file) {
  const widths = {};
  try {
    const src = fs.readFileSync(path.join(AFM_DIR, file), 'utf8');
    const re = /C (\d+) ; WX (\d+) ;/g;
    let m;
    while ((m = re.exec(src))) {
      const code = parseInt(m[1], 10);
      if (code >= 32 && code <= 126) widths[code] = parseInt(m[2], 10) / 1000;
    }
  } catch (_) {}
  return widths;
}
const W_REG = loadAfm('Helvetica.afm');
const W_BOLD = loadAfm('Helvetica-Bold.afm');

function textWidth(text, fontSize, bold) {
  const table = bold ? W_BOLD : W_REG;
  let em = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    em += table[code] != null ? table[code] : 0.556;
  }
  return em * fontSize;
}

function extractRuns(pdfPath) {
  const buf = fs.readFileSync(pdfPath);
  const s = buf.toString('latin1');
  const runs = [];
  let page = 0;

  // Mapeo F# -> nombre de fuente (Helvetica / Helvetica-Bold ...)
  const fontMap = {};
  const bfRe = /\/BaseFont\s*\/([A-Za-z0-9+\-]+)(?:[\s\S]{0,400}?\/Name\s*\/(F\d+))|\/Name\s*\/(F\d+)(?:[\s\S]{0,400}?\/BaseFont\s*\/([A-Za-z0-9+\-]+))/g;
  let bf;
  while ((bf = bfRe.exec(s))) {
    const name = bf[1] || bf[4];
    const fref = bf[2] || bf[3];
    if (name && fref) fontMap[fref] = name;
  }

  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(s))) {
    const start = m.index + m[0].length;
    const end = s.indexOf('endstream', start);
    if (end < 0) continue;
    let content;
    try {
      content = zlib.inflateSync(buf.slice(start, end)).toString('latin1');
    } catch (_) {
      content = buf.slice(start, end).toString('latin1');
    }
    if (!/\bTm\b/.test(content)) continue;
    const streamPage = page++;

    const flipRe = /q\s+1 0 0 -1 0 ([\d.]+)\s+cm/g;
    const flips = [];
    let fm;
    while ((fm = flipRe.exec(content))) flips.push(parseFloat(fm[1]));
    const pageFlip = flips.length ? flips[0] : PAGE_H;

    const btRe = /BT([\s\S]*?)ET/g;
    let b;
    while ((b = btRe.exec(content))) {
      const block = b[1];
      const tm = block.match(/1 0 0 1 ([-\d.]+) ([-\d.]+)/);
      if (!tm) continue;
      const x = parseFloat(tm[1]);
      const yRaw = parseFloat(tm[2]);
      const fontMatch = block.match(/\/(F\d+)\s+([\d.]+)\s+Tf/);
      const fref = fontMatch ? fontMatch[1] : 'F1';
      const fontSize = fontMatch ? parseFloat(fontMatch[2]) : 10;
      const baseFont = fontMap[fref] || 'Helvetica';
      const bold = /Bold|Black|Heavy/i.test(baseFont);

      let text = '';
      const hexRe = /<([0-9A-Fa-f]+)>/g;
      let h;
      while ((h = hexRe.exec(block))) {
        const hex = h[1];
        for (let i = 0; i + 1 < hex.length; i += 2) {
          text += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
        }
      }
      if (!text.trim()) {
        const litRe = /\(((?:[^()\\]|\\.)*)\)/g;
        let l;
        while ((l = litRe.exec(block))) {
          text += l[1].replace(/\\([()\\])/g, '$1');
        }
      }
      if (!text.trim()) continue;
      const y = pageFlip - yRaw;
      runs.push({ x, y, text, fontSize, bold, page: streamPage });
    }
  }
  return runs;
}

function maybeUtf8(t) {
  // dompdf escribe UTF-8 en el stream; si se leyó como latin1 aparecen
  // secuencias 'Ã'/'â€' o controles C1 (0x80-0x9F) → re-decodificar.
  if (!/[À-ÿ-]|Ã|Â|â€/.test(t)) return t;
  const fixed = Buffer.from(t, 'latin1').toString('utf8');
  return fixed.includes('�') || fixed === t ? t : fixed;
}

function dompdfBlocks(pdfPath) {
  // Fallback para PDFs de dompdf (posición con Td, fuentes incrustadas):
  // devuelve posiciones absolutas de cada bloque de texto (y top-down).
  const buf = fs.readFileSync(pdfPath);
  const s = buf.toString('latin1');
  const blocks = [];
  let page = 0;
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(s))) {
    const st = m.index + m[0].length;
    const en = s.indexOf('endstream', st);
    if (en < 0) continue;
    let d;
    try { d = zlib.inflateSync(buf.slice(st, en)).toString('latin1'); } catch (_) { d = buf.slice(st, en).toString('latin1'); }
    if (!/\bBT\b/.test(d)) continue;
    const streamPage = page++;
    const btRe = /BT([\s\S]*?)ET/g;
    let b;
    while ((b = btRe.exec(d))) {
      const blk = b[1];
      const tm = blk.match(/1 0 0 1 ([-\d.]+) ([-\d.]+)/);
      const td = blk.match(/([-\d.]+) ([-\d.]+) Td/);
      if (!tm && !td) continue;
      // dompdf escribe coordenadas bottom-up (origen abajo-izquierda)
      let x = tm ? +tm[1] : 0;
      let y = tm ? +tm[2] : 0;
      if (td) { x += +td[1]; y += +td[2]; }
      y = PAGE_H - y;
      const fm = blk.match(/\/F\d+\s+([\d.]+)\s+Tf/);
      const fontSize = fm ? parseFloat(fm[1]) : 9;
      const bold = /\/F\d+\s/.test(blk) && /Bold/.test(blk);
      let text = '';
      const hexRe = /\[?<([0-9A-Fa-f]+)>/g;
      let h;
      while ((h = hexRe.exec(blk))) {
        const hex = h[1];
        for (let i = 0; i + 1 < hex.length; i += 2) text += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
      }
      if (!text.trim()) {
        const litRe = /\[?\(((?:[^()\\]|\\.)*)\)/g;
        let l;
        while ((l = litRe.exec(blk))) text += l[1].replace(/\\([()\\])/g, '$1');
      }
      if (!text.trim()) continue;
      blocks.push({ x, y, text: maybeUtf8(text), fontSize, bold, page: streamPage });
    }
  }
  return blocks;
}

function analyze(pdfPath) {
  // PDFs de Chrome/Skia (puppeteer): fuentes CID sin ToUnicode y matrices de
  // transformación compuestas; sus márgenes se garantizan por CSS/puppeteer.
  if (fs.readFileSync(pdfPath, 'latin1').includes('Skia/PDF')) {
    return { runs: 0, overlaps: [], outOfMargins: [], mode: 'chrome(skia)-omitido' };
  }
  let runs = extractRuns(pdfPath);
  let mode = 'texto';
  if (runs.length < 5) {
    runs = dompdfBlocks(pdfPath);
    mode = 'posiciones(dompdf)';
  }
  const overlaps = [];
  const outOfMargins = [];

  for (const r of runs) {
    const w = textWidth(r.text, r.fontSize, r.bold);
    // Tolerancia de 6pt a la derecha: la anchura se estima con las tablas AFM
    // y los fragmentos centrados pueden sobreestimarse unos pocos puntos.
    if (r.x < MARGIN - 1.5 || r.x + w > PAGE_W - MARGIN + 6) {
      outOfMargins.push({ ...r, w: Math.round(w) });
    }
  }

  // En modo fallback (dompdf/Chrome) solo se valida margen: las coordenadas Y
  // no son comparables entre sí (transformaciones de página), por eso no se
  // calculan solapamientos.
  if (mode === 'texto') {
    for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      const a = runs[i];
      const b = runs[j];
      const aw = textWidth(a.text, a.fontSize, a.bold);
      const bw = textWidth(b.text, b.fontSize, b.bold);
      const yOverlap = Math.min(a.y + a.fontSize, b.y + b.fontSize) - Math.max(a.y, b.y);
      const xOverlap = Math.min(a.x + aw, b.x + bw) - Math.max(a.x, b.x);
      if (yOverlap > Math.min(a.fontSize, b.fontSize) * 0.4 && xOverlap > 3) {
        overlaps.push({
          a: `${a.text.trim().slice(0, 30)}@(${Math.round(a.x)},${Math.round(a.y)})`,
          b: `${b.text.trim().slice(0, 30)}@(${Math.round(b.x)},${Math.round(b.y)})`,
          xOverlap: Math.round(xOverlap)
        });
      }
      }
    }
  }
  return { runs: runs.length, overlaps, outOfMargins, mode };
}

module.exports = { extractRuns, dompdfBlocks, textWidth, analyze, MARGIN, PAGE_W, PAGE_H };

if (require.main === module) {
  const files = process.argv.slice(2).length
    ? process.argv.slice(2)
    : fs.readdirSync(OUT).filter(f => f.endsWith('.pdf'));

  let totalOverlaps = 0;
  let totalMargins = 0;
  for (const f of files) {
    const p = path.isAbsolute(f) ? f : path.join(OUT, f);
    const r = analyze(p);
    const flag = r.overlaps.length || r.outOfMargins.length ? 'PROBLEMAS' : 'OK';
    console.log(`[${flag}] ${path.basename(p)} | modo=${r.mode} runs=${r.runs} overlaps=${r.overlaps.length} fuera_margen=${r.outOfMargins.length}`);
    r.overlaps.slice(0, 4).forEach(o => console.log(`    solapa: "${o.a}" x "${o.b}" (Δx=${o.xOverlap}pt)`));
    r.outOfMargins.slice(0, 4).forEach(o => console.log(`    margen: "${o.text.trim().slice(0, 40)}" x=${Math.round(o.x)} w=${o.w}`));
    totalOverlaps += r.overlaps.length;
    totalMargins += r.outOfMargins.length;
  }
  console.log(`\n=== LAYOUT: ${files.length} PDFs | solapamientos=${totalOverlaps} | fuera_margen=${totalMargins}`);
}
