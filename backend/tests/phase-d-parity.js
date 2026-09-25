'use strict';

/**
 * Fase D — Suite de paridad PDF <-> Excel por rol.
 *
 * Compara, rol por rol, que los datos exportados en PDF y en Excel sean
 * equivalentes: filas de calificaciones (valores numéricos equivalentes,
 * estados idénticos), etiquetas de resumen (valor en formato exacto),
 * totales internos y lint de formato de celdas (ceros a la izquierda,
 * porcentajes absurdos, negativos).
 *
 * Uso:  node tests/phase-d-parity.js
 * Salida: 0 = sin discrepancias, 1 = discrepancias.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const ExcelJS = require('exceljs');
const { extractRuns, dompdfBlocks } = require('./phase-e-layout.js');

const OUT = path.join(__dirname, '_phase_e_out');
const results = [];

function startPair(name) {
  const p = { name, problems: [] };
  results.push(p);
  return p;
}
function bad(p, msg) { p.problems.push(msg); }
function expect(p, cond, msg) { if (!cond) bad(p, msg); }

// ============================== utilidades ==============================

const SLOT_NUM = /^-?\d+(\.\d+)?$/;
const SLOT_PCT = /^(-?\d+(\.\d+)?)%$/;
const SLOT_NULL = /^[-\u2014\u2013]+$/;

function normSpace(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
function tight(s) { return normSpace(s).replace(/\s/g, ''); }

// WinAnsi/CP1252: bytes 0x80-0x9F embebidos por extractores (pdfkit/pdftotext
// latin1) deben mapearse a sus reales U+2014/U+2013/etc. para que SLOT_NULL,
// las regex de desercion/reporte y los slots de calificacion funcionen.
const WINANSI = {
  '\u0080': '\u20AC', '\u0082': '\u201A', '\u0083': '\u0192', '\u0084': '\u201E',
  '\u0085': '\u2026', '\u0086': '\u2020', '\u0087': '\u2021', '\u0088': '\u02C6',
  '\u0089': '\u2030', '\u008A': '\u0160', '\u008B': '\u2039', '\u008C': '\u0152',
  '\u008E': '\u017D', '\u0091': '\u2018', '\u0092': '\u2019', '\u0093': '\u201C',
  '\u0094': '\u201D', '\u0095': '\u2022', '\u0096': '\u2013', '\u0097': '\u2014',
  '\u0098': '\u02DC', '\u0099': '\u2122', '\u009A': '\u0161', '\u009B': '\u203A',
  '\u009C': '\u0153', '\u009E': '\u017E', '\u009F': '\u0178'
};
function fixCp1252(s) {
  return String(s == null ? '' : s).replace(/[-]/g,
    c => WINANSI[c] || c);
}

function cellText(c) {
  try {
    if (c.text != null && c.text !== '') return String(c.text);
  } catch (_) { /* ignore */ }
  const v = c.value;
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map(r => r.text).join('');
    if (v.text != null) return String(v.text);
    if (v.result != null) return String(v.result);
    return '';
  }
  return String(v);
}

async function loadBook(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(OUT, file));
  const sheets = [];
  wb.eachSheet(ws => {
    const rows = [];
    ws.eachRow({ includeEmpty: false }, (row, rn) => {
      let maxCol = 0;
      const byCol = {};
      row.eachCell({ includeEmpty: false }, (c, col) => {
        byCol[col] = cellText(c);
        maxCol = Math.max(maxCol, col);
      });
      const dense = [];
      const parts = [];
      let last = null;
      for (let i = 1; i <= maxCol; i++) {
        const t = normSpace(byCol[i] || '');
        dense[i] = t;
        if (t && t !== last) parts.push(t);
        if (t) last = t;
      }
      rows.push({ rn, cells: dense, text: parts.join(' ') });
    });
    sheets.push({ name: ws.name, rows });
  });
  return sheets;
}

function sheet(xl, name) { return xl.find(s => s.name === name) || null; }
function allRowTexts(xl) {
  const out = [];
  for (const s of xl) for (const r of s.rows) out.push(r.text);
  return out;
}
function findRow(rows, needle) {
  const re = needle instanceof RegExp ? needle
    : new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  for (const r of rows) {
    const t = typeof r === 'string' ? r : r.text;
    if (re.test(t)) return t;
  }
  return null;
}

// ---- PDF ----

function isSkia(file) {
  return fs.readFileSync(path.join(OUT, file), 'latin1').includes('Skia/PDF');
}

function pdftotextRows(file) {
  const tmp = path.join(os.tmpdir(), `parity_${Math.random().toString(36).slice(2)}.pdf`);
  fs.copyFileSync(path.join(OUT, file), tmp);
  let txt;
  try {
    txt = execFileSync('pdftotext', ['-layout', tmp, '-'],
      { encoding: 'latin1', maxBuffer: 1 << 26 });
  } finally {
    try { fs.unlinkSync(tmp); } catch (_) { /* ignore */ }
  }
  return txt.split('\f').join('\n').split(/\r?\n/).map(fixCp1252).map(normSpace).filter(Boolean);
}

function pdfTextRows(file) {
  if (isSkia(file)) return { mode: 'skia', rows: pdftotextRows(file) };
  let runs = extractRuns(path.join(OUT, file));
  let mode = 'pdfkit';
  if (runs.length < 5) {
    runs = dompdfBlocks(path.join(OUT, file));
    mode = 'dompdf';
  }
  runs = runs.filter(r => r && r.text && r.text.trim())
    .map(r => ({ page: r.page, x: r.x, y: r.y, text: fixCp1252(r.text) }));
  runs.sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
  const grouped = [];
  for (const r of runs) {
    const last = grouped[grouped.length - 1];
    if (last && last.page === r.page && Math.abs(last.y - r.y) <= 2.5) {
      last.text += ' ' + r.text.trim();
    } else {
      grouped.push({ page: r.page, y: r.y, text: r.text.trim() });
    }
  }
  // fusionar continuaciones (lineas sin digitos) dentro de la misma pagina
  const merged = [];
  for (const r of grouped) {
    const last = merged[merged.length - 1];
    if (last && last.page === r.page && !/\d/.test(r.text)) last.text += ' ' + r.text;
    else merged.push({ page: r.page, y: r.y, text: r.text });
  }
  return { mode, rows: merged.map(r => normSpace(r.text)) };
}

// ---- tokens / slots ----

function tokens(s) { return normSpace(s).split(' ').filter(Boolean); }

function slotOf(t) {
  if (SLOT_NULL.test(t)) return { n: null };
  if (SLOT_PCT.test(t)) return { n: parseFloat(t.replace('%', '')) };
  if (SLOT_NUM.test(t)) return { n: parseFloat(t) };
  return null;
}

/** Divide tokens en {pre, slots, estado}: slots conservan nulls. */
function parseSlots(toks) {
  const slots = [];
  let firstIdx = -1;
  let lastIdx = -1;
  toks.forEach((t, i) => {
    const s = slotOf(t);
    if (s) {
      slots.push(s.n);
      if (firstIdx < 0) firstIdx = i;
      lastIdx = i;
    }
  });
  const pre = firstIdx >= 0 ? toks.slice(0, firstIdx) : toks.slice();
  const estado = lastIdx >= 0 ? toks.slice(lastIdx + 1).join(' ') : '';
  return { pre, slots, estado };
}

function slotsEq(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]; const y = b[i];
    if (x == null || y == null) {
      if (!(x == null && y == null)) return false;
    } else if (Math.abs(x - y) > 0.005) return false;
  }
  return true;
}
function slotsStr(v) { return '[' + v.map(x => (x == null ? '—' : x)).join(',') + ']'; }

function cellSlot(v) {
  const t = normSpace(v);
  if (t === '' || SLOT_NULL.test(t)) return null;
  if (SLOT_PCT.test(t)) return parseFloat(t);
  if (SLOT_NUM.test(t)) return parseFloat(t);
  return undefined;
}
function num(v) {
  const t = normSpace(v);
  if (SLOT_PCT.test(t)) return parseFloat(t);
  if (SLOT_NUM.test(t)) return parseFloat(t);
  return null;
}
function numEq(a, b, tol) {
  const t = tol == null ? 0.005 : tol;
  if (a == null || b == null) return a === b;
  return Math.abs(a - b) <= t;
}
function avg(list) {
  const v = list.filter(x => x != null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}
function r2(n) { return Math.round(n * 100) / 100; }

// ---- etiquetas: Label: valor ----

const LABEL_RE = /([%A-ZÁÉÍÓÚ][A-Za-zÁÉÍÓÚáéíóúñü()\/.%° ]{1,45}?):\s*/g;

function labelMap(text) {
  const found = [];
  let m;
  LABEL_RE.lastIndex = 0;
  while ((m = LABEL_RE.exec(text))) {
    const label = normSpace(m[1]);
    if (!label) continue;
    found.push({ label, start: m.index, vStart: LABEL_RE.lastIndex });
  }
  const map = {};
  for (let i = 0; i < found.length; i++) {
    const end = i + 1 < found.length ? found[i + 1].start : text.length;
    let val = normSpace(text.slice(found[i].vStart, end));
    val = val.replace(/\s*[|\u2014\u2013]+\s*$/, '').trim();
    if (val) val = val.replace(/[\s|\u2014\u2013-]+$/, '').trim() || val;
    if (!(found[i].label in map)) map[found[i].label] = val;
  }
  return map;
}

function labelMapAll(rowTexts) {
  const map = {};
  for (const t of rowTexts) {
    const lm = labelMap(t);
    for (const k of Object.keys(lm)) if (!(k in map)) map[k] = lm[k];
  }
  return map;
}

/**
 * Mapa de etiquetas del Excel: primero celdas aisladas "Label:" (el valor vive
 * en la celda siguiente no vacia), luego el texto de la fila (primera aparicion).
 */
function xlLabelMap(xl) {
  const map = {};
  for (const s of xl) {
    for (const r of s.rows) {
      for (let c = 1; c < r.cells.length; c++) {
        const v = normSpace(r.cells[c] || '');
        const m = /^([%A-ZÁÉÍÓÚ][A-Za-zÁÉÍÓÚáéíóúñü()\/.%° ]{1,45}):$/.exec(v);
        if (!m) continue;
        let val = '';
        for (let d = c + 1; d < r.cells.length; d++) {
          const t2 = normSpace(r.cells[d] || '');
          if (t2) { val = t2; break; }
        }
        if (val && !(m[1] in map)) map[m[1]] = val;
      }
      const lm = labelMap(r.text);
      for (const k of Object.keys(lm)) {
        if (lm[k] && !(k in map)) map[k] = lm[k];
      }
    }
  }
  return map;
}

/**
 * Fallback cuando los valores no calzan exactos:
 *  - el PDF trae basura textual pegada al valor (wraps de cajas vecinas), o
 *  - el valor Excel completo aparece como secuencia de tokens en el PDF (wrap).
 * Nunca acepta extensiones numericas (7 vs 7.00 / 0 vs 0.00).
 */
function labelsCompatibles(xv, pv, pdfAllText) {
  const tx = tight(xv);
  const tp = tight(pv);
  if (tx && tp.startsWith(tx) && !/^[0-9.%]/.test(tp.slice(tx.length))) return true;
  const xt = tokens(xv);
  const alpha = xt.filter(t => /[A-Za-zÁÉÍÓÚáéíóúñü]/.test(t));
  if (xt.length >= 2 && alpha.length >= 2 && subseq(pdfAllText, xv)) return true;
  return false;
}

/**
 * Valor directo de "lab:" en el PDF por fila. Evita que labelMap absorba la
 * etiqueta dentro de otra ("Prueba ISC Matrícula:", "Foto institucional
 * Carrera:"): busca el texto literal "lab:" y corta en la siguiente etiqueta
 * (primero las de la lista conocida, luego cualquier "Xxx:" posterior).
 * Devuelve null si no hay fila con la etiqueta o el valor queda vacio.
 */
function pdfLabelValue(pdfTexts, lab, knownLabels) {
  const key = lab + ':';
  for (const t of pdfTexts) {
    const i = t.indexOf(key);
    if (i < 0) continue;
    const rest = t.slice(i + key.length);
    let cut = -1;
    for (const l2 of knownLabels) {
      if (l2 === lab) continue;
      const j = rest.indexOf(l2 + ':');
      if (j >= 0 && (cut < 0 || j < cut)) cut = j;
    }
    if (cut < 0) {
      const m = /\s[%A-ZÁÉÍÓÚ][A-Za-zÁÉÍÓÚáéíóúñü()\/.%° ]{1,45}:/.exec(rest);
      if (m) cut = m.index;
    }
    const val = normSpace(cut >= 0 ? rest.slice(0, cut) : rest)
      .replace(/\s*[|\u2014\u2013]+\s*$/, '').trim();
    if (val) return val;
  }
  return null;
}

/** Compara etiquetas exactas entre Excel y PDF (primera aparicion en cada lado). */
function compLabels(p, labels, xl, pdfTexts) {
  const xm = xlLabelMap(xl);
  const pm = labelMapAll(pdfTexts);
  const pdfAll = pdfTexts.join(' ');
  for (const lab of labels) {
    const xv = lab in xm ? xm[lab] : null;
    let pv = lab in pm ? pm[lab] : null;
    if (pv == null || pv === '') {
      const direct = pdfLabelValue(pdfTexts, lab, labels);
      if (direct != null) pv = direct;
    }
    if (xv == null && pv == null) continue;
    if (xv == null) { bad(p, `etiqueta "${lab}:" falta en Excel (PDF="${pv}")`); continue; }
    if (pv == null) { bad(p, `etiqueta "${lab}:" falta en PDF (Excel="${xv}")`); continue; }
    if (xv !== pv && !labelsCompatibles(xv, pv, pdfAll)) {
      bad(p, `etiqueta "${lab}:" PDF="${pv}" Excel="${xv}"`);
    }
  }
}

/** Fila de alumno dentro de un bloque PDF cuyo header cumple matchHeader. */
function pdfBlockRow(rows, matchHeader, needle) {
  const hi = rows.findIndex(matchHeader);
  if (hi < 0) return null;
  for (let i = hi + 1; i < rows.length; i++) {
    if (/\(ISC-\d{3}\)/.test(rows[i])) return null;
    if (needle && rows[i].includes(needle)) return rows[i];
  }
  return null;
}

function estadoIgual(xl, pdf) {
  xl = normSpace(xl); pdf = normSpace(pdf);
  if (xl === pdf) return true;
  if (!xl || !pdf) return false;
  return pdf.startsWith(xl + ' ') || xl.startsWith(pdf + ' ');
}

function subseq(text, name) {
  const nt = tokens(name);
  const tt = tokens(text);
  let i = 0;
  for (const t of tt) {
    if (i < nt.length && t === nt[i]) i++;
  }
  return i === nt.length;
}

// ============================== pares ==============================

async function pairBoleta(xlFile, pdfFile, name) {
  const p = startPair(name);
  const xl = await loadBook(xlFile);
  const pdf = pdfTextRows(pdfFile);

  const cal = sheet(xl, 'Calificaciones');
  expect(p, !!cal, 'falta hoja Calificaciones');
  const dataRows = cal ? cal.rows.filter(r => /^ISC-\d{3}$/.test(r.cells[3] || '')) : [];
  expect(p, dataRows.length > 0, 'sin filas de materias en Excel');

  for (const xr of dataRows) {
    const clave = xr.cells[3];
    const pr = pdf.rows.find(t => new RegExp(`(^| )${clave}( |$)`).test(t));
    if (!pr) { bad(p, `${clave}: sin fila en PDF`); continue; }
    const toks = tokens(pr);
    const ci = toks.indexOf(clave);
    const pre = toks.slice(0, ci).slice(1); // quitar indice
    const mat = normSpace(pre.join(' '));
    if (mat !== normSpace(xr.cells[2])) bad(p, `${clave}: materia PDF="${mat}" Excel="${xr.cells[2]}"`);
    const ps = parseSlots(toks.slice(ci + 1));
    const xs = [4, 5, 6, 7, 8].map(c => cellSlot(xr.cells[c]));
    if (!slotsEq(ps.slots, xs)) bad(p, `${clave}: grados PDF=${slotsStr(ps.slots)} Excel=${slotsStr(xs)}`);
    if (!estadoIgual(xr.cells[9], ps.estado)) bad(p, `${clave}: estado PDF="${ps.estado}" Excel="${xr.cells[9]}"`);
  }

  const texts = allRowTexts(xl);
  compLabels(p, ['Matrícula', 'Carrera', 'Periodo', 'Promedio', 'Promedio General',
    'Aprobadas', 'No Acreditadas'], xl, pdf.rows);

  // fila de resumen por periodo (debe existir en ambos)
  const xr = findRow(texts, 'Aprobadas');
  const pr = findRow(pdf.rows, 'Aprobadas');
  expect(p, !!xr, 'Excel sin fila de resumen (Aprobadas)');
  expect(p, !!pr, 'PDF sin fila de resumen (Aprobadas)');
  if (xr && pr) {
    const xm = labelMap(xr); const pm = labelMap(pr);
    const pdfAll = pdf.rows.join(' ');
    for (const lab of ['Promedio', 'Aprobadas', 'No Acreditadas']) {
      const xv = xm[lab] || null; const pv = pm[lab] || null;
      if (xv === pv) continue;
      if (xv != null && pv != null && labelsCompatibles(xv, pv, pdfAll)) continue;
      bad(p, `resumen "${lab}:" PDF="${pm[lab]}" Excel="${xm[lab]}"`);
    }
  }
}

async function pairPreboleta(xlFile, pdfFile, name) {
  const p = startPair(name);
  const xl = await loadBook(xlFile);
  const pdf = pdfTextRows(pdfFile);

  const cal = sheet(xl, 'Calificaciones');
  expect(p, !!cal, 'falta hoja Calificaciones');
  const dataRows = cal ? cal.rows.filter(r => /^\d+$/.test(r.cells[1] || '') && r.cells[2]) : [];
  expect(p, dataRows.length > 0, 'sin filas de materias en Excel');

  for (const xr of dataRows) {
    const mat = normSpace(xr.cells[2]);
    const pr = pdf.rows.find(t => t.includes(mat.slice(0, Math.min(18, mat.length))));
    if (!pr) { bad(p, `${mat}: sin fila en PDF`); continue; }
    const idx = pr.indexOf(mat);
    const after = tokens(idx >= 0 ? pr.slice(idx + mat.length) : pr);
    const ps = parseSlots(after);
    const xs = [4, 5, 6, 7].map(c => cellSlot(xr.cells[c]));
    if (!slotsEq(ps.slots, xs)) bad(p, `${mat}: grados PDF=${slotsStr(ps.slots)} Excel=${slotsStr(xs)}`);
    if (!estadoIgual(xr.cells[8], ps.estado)) bad(p, `${mat}: estado PDF="${ps.estado}" Excel="${xr.cells[8]}"`);
    if (!subseq(pr, xr.cells[3] || '')) bad(p, `${mat}: docente "${xr.cells[3]}" no aparece en fila PDF`);
  }

  const texts = allRowTexts(xl);
  compLabels(p, ['Matrícula', 'Grupo', 'Turno', 'Periodo', 'Semestre', 'Plan', 'Carrera',
    'Promedio General', 'Total Materias', 'Aprobadas', 'No Acreditadas'], xl, pdf.rows);

  const xr = findRow(texts, 'Aprobadas');
  const pr = findRow(pdf.rows, 'Aprobadas');
  expect(p, !!xr, 'Excel sin fila de resumen (Aprobadas)');
  expect(p, !!pr, 'PDF sin fila de resumen (Aprobadas)');
  if (xr && pr) {
    const xm = labelMap(xr); const pm = labelMap(pr);
    const pdfAll = pdf.rows.join(' ');
    for (const lab of ['Promedio General', 'Aprobadas', 'No Acreditadas']) {
      const xv = xm[lab] || null; const pv = pm[lab] || null;
      if (xv === pv) continue;
      if (xv != null && pv != null && labelsCompatibles(xv, pv, pdfAll)) continue;
      bad(p, `resumen "${lab}:" PDF="${pm[lab]}" Excel="${xm[lab]}"`);
    }
  }
}

async function pairHistorial(xlFile, pdfFile, name) {
  const p = startPair(name);
  const xl = await loadBook(xlFile);
  const pdf = pdfTextRows(pdfFile);

  const his = sheet(xl, 'Historial');
  expect(p, !!his, 'falta hoja Historial');
  // columnas: A # | B Periodo | C Grupo | D Materia | E Clave | F Creditos | G Semestre | H Final | I Estado
  const dataRows = his ? his.rows.filter(r => /^ISC-\d{3}$/.test(r.cells[5] || '')) : [];
  expect(p, dataRows.length > 0, 'sin filas de materias en Excel');

  for (const xr of dataRows) {
    const clave = xr.cells[5];
    const pr = pdf.rows.find(t => new RegExp(`(^| )${clave}( |$)`).test(t));
    if (!pr) { bad(p, `${clave}: sin fila en PDF`); continue; }
    const toks = tokens(pr);
    const ci = toks.indexOf(clave);
    const pre = toks.slice(0, ci).slice(1);
    if (normSpace(pre.join(' ')) !== normSpace(xr.cells[4])) {
      bad(p, `${clave}: materia PDF="${pre.join(' ')}" Excel="${xr.cells[4]}"`);
    }
    const ps = parseSlots(toks.slice(ci + 1));
    const xs = [6, 7, 8].map(c => cellSlot(xr.cells[c]));
    if (!slotsEq(ps.slots, xs)) bad(p, `${clave}: creditos/sem/final PDF=${slotsStr(ps.slots)} Excel=${slotsStr(xs)}`);
    if (!estadoIgual(xr.cells[9], ps.estado)) bad(p, `${clave}: estado PDF="${ps.estado}" Excel="${xr.cells[9]}"`);
  }

  const texts = allRowTexts(xl);
  compLabels(p, ['Matrícula', 'Carrera', 'Promedio', 'Promedio General', 'Total Materias',
    'Créditos Totales', 'Materias Aprobadas', 'Aprobadas', 'No Acreditadas'], xl, pdf.rows);

  const xr = findRow(texts, 'No Acreditadas');
  const pr = findRow(pdf.rows, 'No Acreditadas');
  expect(p, !!xr, 'Excel sin fila de resumen por periodo (No Acreditadas)');
  expect(p, !!pr, 'PDF sin fila de resumen por periodo (No Acreditadas)');
  if (xr && pr) {
    const xm = labelMap(xr); const pm = labelMap(pr);
    const pdfAll = pdf.rows.join(' ');
    for (const lab of ['Promedio', 'Aprobadas', 'No Acreditadas', 'Créditos']) {
      const xv = xm[lab] || null; const pv = pm[lab] || null;
      if (xv === pv) continue;
      if (xv != null && pv != null && labelsCompatibles(xv, pv, pdfAll)) continue;
      bad(p, `resumen periodo "${lab}:" PDF="${pm[lab]}" Excel="${xm[lab]}"`);
    }
  }
}

async function pairReporteGrupo(xlFile, pdfFile, name) {
  const p = startPair(name);
  const xl = await loadBook(xlFile);
  const pdf = pdfTextRows(pdfFile);
  const texts = allRowTexts(xl);

  // --- hoja Resumen: filas por materia vs linea de stats del PDF ---
  const resumen = sheet(xl, 'Resumen');
  expect(p, !!resumen, 'falta hoja Resumen');
  const resRows = resumen ? resumen.rows.filter(r => /^ISC-\d{3}$/.test(r.cells[2] || '')) : [];
  for (const rr of resRows) {
    const clave = rr.cells[2];
    const headIdx = pdf.rows.findIndex(t => t.includes(`(${clave})`));
    if (headIdx < 0) { bad(p, `${clave}: sin bloque en PDF`); continue; }
    let statsRow = null;
    for (let i = headIdx + 1; i < pdf.rows.length; i++) {
      if (pdf.rows[i].includes('Aprobados')) { statsRow = pdf.rows[i]; break; }
      if (/\(ISC-\d{3}\)/.test(pdf.rows[i])) break;
    }
    if (!statsRow) { bad(p, `${clave}: sin stats en PDF`); continue; }
    const sm = labelMap(statsRow);
    const exp = { 'Promedio': rr.cells[4], 'Aprobados': rr.cells[5], 'Reprobados': rr.cells[6], '% Aprobación': rr.cells[7] };
    for (const k of Object.keys(exp)) {
      if (normSpace(sm[k] || '') !== normSpace(exp[k] || '')) {
        bad(p, `${clave} stats "${k}:" PDF="${sm[k]}" Excel="${exp[k]}"`);
      }
    }
    if (num(rr.cells[3]) == null) bad(p, `${clave}: Total Alumnos no numerico`);
  }

  // --- hoja Calificaciones: filas por (matricula, header materia) vs filas PDF ---
  const cal = sheet(xl, 'Calificaciones');
  expect(p, !!cal, 'falta hoja Calificaciones');
  const calRows = [];
  if (cal) {
    let header = null;
    for (const r of cal.rows) {
      if (/\(ISC-\d{3}\)/.test(r.cells[1] || '')) header = normSpace(r.cells[1]);
      else if (/^\d+$/.test(r.cells[1] || '') && r.cells[2] && header) {
        calRows.push({ row: r, header });
      }
    }
  }
  expect(p, calRows.length > 0, 'sin filas de calificaciones en Excel');
  for (const { row: xr, header } of calRows) {
    const clave = (header.match(/ISC-\d{3}/) || [''])[0];
    const pr = pdfBlockRow(pdf.rows, t => t.includes(`(${clave})`), xr.cells[2]);
    if (!pr) { bad(p, `${clave}/${xr.cells[2]}: sin fila en PDF`); continue; }
    const toks = tokens(pr);
    const mi = toks.findIndex(t => MATRICULA_RE.test(t));
    const ps = parseSlots(toks.slice(mi + 1));
    const xs = [4, 5, 6, 7, 8].map(c => cellSlot(xr.cells[c]));
    if (!slotsEq(ps.slots, xs)) bad(p, `${clave}/${xr.cells[2]}: grados PDF=${slotsStr(ps.slots)} Excel=${slotsStr(xs)}`);
    if (!estadoIgual(xr.cells[9], ps.estado)) bad(p, `${clave}/${xr.cells[2]}: estado PDF="${ps.estado}" Excel="${xr.cells[9]}"`);
    if (!subseq(pr, xr.cells[3] || '')) bad(p, `${clave}: alumno "${xr.cells[3]}" no aparece en fila PDF`);
  }

  compLabels(p, ['Total Alumnos'], xl, pdf.rows);
}

const MATRICULA_RE = /^(ISC-\d{4,}|\d{7,})$/;

async function pairGrupoCalificaciones(xlFile, pdfFile, name) {
  const p = startPair(name);
  const xl = await loadBook(xlFile);
  const pdf = pdfTextRows(pdfFile);

  const cal = sheet(xl, 'Calificaciones del Grupo');
  expect(p, !!cal, 'falta hoja "Calificaciones del Grupo"');
  // A # | B Matricula | C Alumno | D Materia | E Clave | F Cred | G P1 | H P2 | I P3 | J Prom | K Final | L Estado
  const dataRows = cal ? cal.rows.filter(r => /^ISC-\d{3}$/.test(r.cells[5] || '')) : [];
  expect(p, dataRows.length > 0, 'sin filas en Excel');

  for (const xr of dataRows) {
    const clave = xr.cells[5];
    const matricula = xr.cells[2];
    const pr = pdfBlockRow(pdf.rows, t => t.includes(`(${clave})`), matricula);
    if (!pr) { bad(p, `${clave}/${matricula}: sin fila en PDF`); continue; }
    const toks = tokens(pr);
    const mi = toks.findIndex(t => t === matricula);
    const ps = parseSlots(toks.slice(mi + 1));
    const xs = [7, 8, 9, 10, 11].map(c => cellSlot(xr.cells[c]));
    if (!slotsEq(ps.slots, xs)) bad(p, `${clave}/${matricula}: grados PDF=${slotsStr(ps.slots)} Excel=${slotsStr(xs)}`);
    if (!estadoIgual(xr.cells[12], ps.estado)) bad(p, `${clave}/${matricula}: estado PDF="${ps.estado}" Excel="${xr.cells[12]}"`);
  }
}

async function pairParcial(xlFile, pdfFile, name) {
  const p = startPair(name);
  const xl = await loadBook(xlFile);
  const pdf = pdfTextRows(pdfFile);
  const texts = allRowTexts(xl);

  const ws = xl[0];
  const header = ws.rows.find(r => r.cells[2] === 'MATRÍCULA');
  expect(p, !!header, 'sin header MATRICULA en Excel');
  // columnas de materias: 4..N-2; ultima col = PROM. PARCIAL (excluida)
  const matCols = [];
  if (header) {
    for (let c = 4; c < header.cells.length - 1; c++) {
      if (header.cells[c]) matCols.push(c);
    }
  }
  const dataRows = ws.rows.filter(r => MATRICULA_RE.test(r.cells[2] || ''));
  expect(p, dataRows.length > 0, 'sin filas de alumnos en Excel');

  for (const xr of dataRows) {
    const matricula = xr.cells[2];
    for (const col of matCols) {
      const matName = normSpace(header.cells[col]);
      const pr = pdfBlockRow(pdf.rows,
        t => /\(ISC-\d{3}\)/.test(t) && t.includes(matName), matricula);
      if (!pr) { bad(p, `${matName}/${matricula}: sin fila en PDF`); continue; }
      const toks = tokens(pr);
      const mi = toks.findIndex(t => t === matricula);
      const ps = parseSlots(toks.slice(mi + 1));
      const xv = cellSlot(xr.cells[col]);
      const pv = ps.slots.length ? ps.slots[0] : undefined;
      if (!numEq(pv === undefined ? null : pv, xv === undefined ? null : xv) || (xv === undefined) !== (pv === undefined && ps.slots.length === 0)) {
        bad(p, `${matName}/${matricula}: calificacion PDF=${pv == null ? '—' : pv} Excel=${xv == null ? '—' : xv}`);
      }
      const estado = ps.estado;
      const expEstado = xv == null ? 'Sin calificar' : (xv >= 6 ? 'Aprobado' : 'No Aprobado');
      if (!estadoIgual(expEstado, estado)) {
        bad(p, `${matName}/${matricula}: estado PDF="${estado}" (esperado "${expEstado}" por nota ${xv})`);
      }
    }
    // PROM. PARCIAL interno == promedio de las celdas de materia
    const vals = matCols.map(c => cellSlot(xr.cells[c]));
    const exp = avg(vals);
    const got = cellSlot(xr.cells[header.cells.length - 1]);
    if (!numEq(r2(exp == null ? null : exp), got)) {
      bad(p, `PROM. PARCIAL ${matricula}: ${got} != promedio ${r2(exp == null ? 0 : exp)}`);
    }
  }

  // estadisticas por materia (Prom/Max/Min/%Apr) — internas
  const statRows = ws.rows.filter(r => r.cells[1] && /Prom:/.test(r.text));
  for (const sr of statRows) {
    const matName = normSpace(sr.cells[1]);
    const col = matCols.find(c => normSpace(header.cells[c]) === matName);
    if (col == null) { bad(p, `stat "${matName}": no encuentra columna`); continue; }
    const vals = dataRows.map(r => cellSlot(r.cells[col])).filter(v => v !== undefined);
    const nonNull = vals.filter(v => v != null);
    const sm = labelMap(sr.text.replace(/^.*?(Prom:)/, '$1'));
    const expProm = avg(nonNull);
    const expMax = nonNull.length ? Math.max(...nonNull) : null;
    const expMin = nonNull.length ? Math.min(...nonNull) : null;
    const expPct = nonNull.length ? `${Math.round((nonNull.filter(v => v >= 6).length / nonNull.length) * 100)}%` : '-';
    if (!numEq(num(sm['Prom']), expProm == null ? null : r2(expProm))) bad(p, `stat ${matName}: Prom PDF/Excel=${sm['Prom']} esperado=${expProm == null ? '-' : r2(expProm)}`);
    if (!numEq(num(sm['Max']), expMax)) bad(p, `stat ${matName}: Max=${sm['Max']} esperado=${expMax}`);
    if (!numEq(num(sm['Min']), expMin)) bad(p, `stat ${matName}: Min=${sm['Min']} esperado=${expMin}`);
    if (normSpace(sm['%Apr'] || '') !== expPct) bad(p, `stat ${matName}: %Apr=${sm['%Apr']} esperado=${expPct}`);
  }

  // resumen del parcial: Total Alumnos / Total Materias
  const xlAl = findRow(texts, 'Alumnos');
  const xlMat = findRow(texts, 'Materia(s)');
  const pdfRes = findRow(pdf.rows, 'Total Alumnos');
  expect(p, !!pdfRes, 'PDF sin Resumen del Parcial');
  if (pdfRes && xlAl && xlMat) {
    const pm = labelMap(pdfRes);
    const alXl = num((labelMap(xlAl)['Alumnos']));
    const matXl = num((labelMap(xlMat)['Materia(s)']));
    if (!numEq(num(pm['Total Alumnos']), alXl)) bad(p, `Total Alumnos PDF=${pm['Total Alumnos']} Excel=${alXl}`);
    if (!numEq(num(pm['Total Materias']), matXl)) bad(p, `Total Materias PDF=${pm['Total Materias']} Excel=${matXl}`);
  } else {
    if (!xlAl) bad(p, 'Excel sin fila Alumnos:');
    if (!xlMat) bad(p, 'Excel sin fila Materia(s):');
  }
}

async function pairConcentrado(xlFile, pdfFile, name) {
  const p = startPair(name);
  const xl = await loadBook(xlFile);
  const pdf = pdfTextRows(pdfFile);
  const texts = allRowTexts(xl);

  const ws = xl[0];
  const header = ws.rows.find(r => r.cells[2] === 'ALUMNO' || r.cells[2] === 'MATRÍCULA');
  expect(p, !!header, 'sin header de materias en Excel');

  // header del PDF: "... Alumno <materias...> Promedio"
  const pdfHeader = findRow(pdf.rows, 'Matrícula');
  expect(p, !!pdfHeader, 'PDF sin header de tabla');
  let matCols = []; // {xlCol, pdfIdx, name}
  if (header && pdfHeader) {
    const ht = tokens(pdfHeader);
    const ai = ht.findIndex(t => /^Alumno$/i.test(t));
    const pi = ht.findIndex(t => /^Promedio$/i.test(t));
    // El header del PDF trunca nombres ("Desarrollo W") y parte en tokens:
    // mapear materia Excel -> posicion de slot contando solo tokens que son
    // la primera palabra de alguna materia del Excel.
    const headToks = ht.slice(ai + 1, pi);
    const mats = [];
    for (let c = 4; c < header.cells.length; c++) {
      const nm = normSpace(header.cells[c]);
      if (!nm || /^PROMEDIO$/i.test(nm)) continue;
      mats.push({ xlCol: c, name: nm });
    }
    const used = new Set();
    let slotPos = 0;
    for (const t of headToks) {
      const m = mats.find(mm => !used.has(mm.xlCol)
        && mm.name.toLowerCase().split(/\s+/)[0] === t.toLowerCase());
      if (m) { m.pdfIdx = slotPos; used.add(m.xlCol); slotPos++; }
    }
    for (const m of mats) {
      if (m.pdfIdx == null) {
        m.pdfIdx = -1;
        bad(p, `materia Excel "${m.name}" sin columna en PDF (${headToks.join(' | ')})`);
      }
      matCols.push(m);
    }
  }

  const dataRows = ws.rows.filter(r => MATRICULA_RE.test(r.cells[2] || ''));
  expect(p, dataRows.length > 0, 'sin filas de alumnos en Excel');
  const promCol = header ? header.cells.length - 1 : 0;

  for (const xr of dataRows) {
    const matricula = xr.cells[2];
    const pr = pdf.rows.find(t => t.includes(matricula));
    if (!pr) { bad(p, `${matricula}: sin fila en PDF`); continue; }
    const toks = tokens(pr);
    const mi = toks.findIndex(t => t === matricula);
    const ps = parseSlots(toks.slice(mi + 1));
    for (const mc of matCols) {
      if (mc.pdfIdx < 0) continue;
      const pv = ps.slots[mc.pdfIdx];
      const xv = cellSlot(xr.cells[mc.xlCol]);
      if (!numEq(pv == null ? null : pv, xv == null ? null : xv)) {
        bad(p, `${matricula}/${mc.name}: PDF=${pv == null ? '—' : pv} Excel=${xv == null ? '—' : xv}`);
      }
    }
    const nMatched = matCols.filter(m => m.pdfIdx >= 0).length;
    const pdfProm = ps.slots[nMatched];
    const xlProm = cellSlot(xr.cells[promCol]);
    if (!numEq(pdfProm == null ? null : pdfProm, xlProm == null ? null : xlProm)) {
      bad(p, `${matricula}: PROMEDIO PDF=${pdfProm} Excel=${xlProm}`);
    }
    if (!subseq(pr, xr.cells[3] || '')) bad(p, `${matricula}: alumno "${xr.cells[3]}" no aparece en fila PDF`);
  }

  // internos: fila "MATERIA" (promedio por columna) y "% APROBACION"
  const avgRow = ws.rows.find(r => /^MATERIA$/i.test(r.cells[1] || ''));
  const pctRow = ws.rows.find(r => /APROBACIÓN/.test(r.cells[1] || ''));
  for (const mc of matCols) {
    const vals = dataRows.map(r => cellSlot(r.cells[mc.xlCol])).filter(v => v !== undefined);
    const nonNull = vals.filter(v => v != null);
    if (avgRow) {
      const got = cellSlot(avgRow.cells[mc.xlCol]);
      const exp = avg(nonNull);
      if (!numEq(got, exp == null ? null : r2(exp))) {
        bad(p, `MATERIA ${mc.name}: promedio=${got} esperado=${exp == null ? '-' : r2(exp)}`);
      }
    }
    if (pctRow) {
      const got = normSpace(pctRow.cells[mc.xlCol] || '');
      const exp = nonNull.length ? `${Math.round((nonNull.filter(v => v >= 6).length / nonNull.length) * 100)}%` : '-';
      if (got !== exp) bad(p, `% APROBACIÓN ${mc.name}: ${got} esperado=${exp}`);
    }
  }
  // fila de totales del pie
  const footer = findRow(texts, 'Total Alumnos');
  if (footer) {
    const fm = labelMap(footer);
    if (!numEq(num(fm['Total Alumnos']), dataRows.length)) {
      bad(p, `Total Alumnos=${fm['Total Alumnos']} esperado=${dataRows.length}`);
    }
    const nMat = matCols.length;
    if (!numEq(num(fm['Total Materias']), nMat)) {
      bad(p, `Total Materias=${fm['Total Materias']} esperado=${nMat}`);
    }
  } else bad(p, 'sin fila Total Alumnos en Excel');
}

async function pairPeriodoCoordinador(xlFile, pdfFile, name) {
  const p = startPair(name);
  const xl = await loadBook(xlFile);
  const pdf = pdfTextRows(pdfFile);

  // derivar agregados desde el PDF: filas de alumnos con matricula
  const SCAN_MAT = /(?:^|\s)(?:ISC-\d{4,}|\d{7,})(?=\s|$)/;
  const alumnoRows = pdf.rows.filter(t => SCAN_MAT.test(t));
  const grades = [];
  for (const t of alumnoRows) {
    const toks = tokens(t);
    const mi = toks.findIndex(x => MATRICULA_RE.test(x));
    const ps = parseSlots(toks.slice(mi + 1));
    // slots = 3 materias + promedio (ultimo)
    for (let i = 0; i < ps.slots.length - 1; i++) grades.push(ps.slots[i]);
  }
  const nonNull = grades.filter(g => g != null);
  const alumnos = new Set(alumnoRows.map(t => (tokens(t).find(x => MATRICULA_RE.test(x)) || ''))).size;
  const apr = nonNull.filter(g => g >= 6).length;
  const rep = nonNull.filter(g => g < 6).length;
  const prom = nonNull.length ? r2(avg(nonNull)) : null;
  const pct = nonNull.length ? Math.round((apr / nonNull.length) * 100) : null;

  const ws = xl[0];
  // filas de grupo: primera columna es el codigo de grupo (4 digitos)
  const dataRows = ws.rows.filter(r => /^\d{4}$/.test(r.cells[1] || ''));
  expect(p, dataRows.length > 0, 'sin filas de grupo en Excel');
  for (const gr of dataRows) {
    const checks = [
      ['Total Alumnos', alumnos], ['Total Materias', nonNull.length],
      ['Aprobados', apr], ['Reprobados', rep]
    ];
    for (const [col, exp] of checks) {
      const ci = { 'Total Alumnos': 3, 'Total Materias': 4, 'Aprobados': 6, 'Reprobados': 7 }[col];
      const got = num(gr.cells[ci]);
      if (!numEq(got, exp)) bad(p, `grupo ${gr.cells[1]} ${col}: Excel=${got} PDF=${exp}`);
    }
    const gp = num(gr.cells[5]);
    if (!numEq(gp, prom)) bad(p, `grupo ${gr.cells[1]} Promedio: Excel=${gp} PDF=${prom}`);
    const gpct = num(gr.cells[8]);
    if (!numEq(gpct, pct)) bad(p, `grupo ${gr.cells[1]} % Aprobación: Excel=${gpct} PDF=${pct}`);
  }

  // TOTAL GENERAL interno == fila de grupo (unico grupo) y sin strings con ceros a la izquierda
  const totalRow = ws.rows.find(r => /TOTAL GENERAL/i.test(r.cells[1] || ''));
  expect(p, !!totalRow, 'sin fila TOTAL GENERAL');
  if (totalRow && dataRows[0]) {
    for (let c = 3; c <= 8; c++) {
      const a = normSpace(totalRow.cells[c] || '');
      const b = normSpace(dataRows[0].cells[c] || '');
      if (a !== b) bad(p, `TOTAL GENERAL col ${c}: "${a}" != fila de grupo "${b}"`);
    }
  }
}

async function pairSeguimiento(xlFile, pdfFile, name) {
  const p = startPair(name);
  const xl = await loadBook(xlFile);
  const pdf = pdfTextRows(pdfFile);

  const ws = sheet(xl, 'Seguimiento');
  expect(p, !!ws, 'falta hoja Seguimiento');
  // A Grupo | B Materia | C Alumnos | D Capturados | E Pendientes | F % Captura | G Promedio | H Aprobados | I % Aprobación
  const dataRows = ws ? ws.rows.filter(r => /^\d+$/.test(r.cells[1] || '') && r.cells[2]) : [];
  expect(p, dataRows.length > 0, 'sin filas de materias en Excel');

  for (const xr of dataRows) {
    const mat = normSpace(xr.cells[2]);
    const prefix = mat.slice(0, Math.min(15, mat.length));
    const pr = pdf.rows.find(t => t.includes(prefix));
    if (!pr) { bad(p, `${mat}: sin fila en PDF`); continue; }
    const idx = pr.indexOf(prefix);
    const ps = parseSlots(tokens(pr.slice(idx + prefix.length)));
    // slots PDF: P1cap, P2cap, P3cap, Promedio, %Aprob
    if (ps.slots.length < 5) { bad(p, `${mat}: fila PDF incompleta ("${pr}")`); continue; }
    const capPdf = ps.slots[0] + ps.slots[1] + ps.slots[2];
    const alumnos = num(xr.cells[3]);
    const capt = num(xr.cells[4]);
    const pend = num(xr.cells[5]);
    const pctCap = num(xr.cells[6]);
    const prom = num(xr.cells[7]);
    const pctApr = num(xr.cells[9]);
    if (!numEq(capt, capPdf)) bad(p, `${mat}: Capturados Excel=${capt} PDF=${capPdf}`);
    if (!numEq(pend, alumnos * 3 - capPdf)) bad(p, `${mat}: Pendientes Excel=${pend} esperado=${alumnos * 3 - capPdf}`);
    const expPct = Math.round((capPdf / (alumnos * 3)) * 100);
    if (!numEq(pctCap, expPct)) bad(p, `${mat}: % Captura Excel=${pctCap}% esperado=${expPct}%`);
    if (!numEq(prom, r2(ps.slots[3]))) bad(p, `${mat}: Promedio Excel=${prom} PDF=${ps.slots[3]}`);
    if (!numEq(pctApr, ps.slots[4])) bad(p, `${mat}: % Aprobación Excel=${pctApr}% PDF=${ps.slots[4]}%`);
  }

  // TOTAL: fila Excel vs fila TOTAL del PDF vs fila de grupo del PDF
  const totalRow = ws ? ws.rows.find(r => /^TOTAL$/i.test(r.cells[1] || '')) : null;
  expect(p, !!totalRow, 'sin fila TOTAL en Excel');
  const pdfTotal = findRow(pdf.rows, 'TOTAL:');
  const pdfGrupo = pdf.rows.find(t => /\b\d+\s+\d+\s+(Matutino|Vespertino|Discontinuo)\b/.test(t));
  expect(p, !!pdfTotal, 'PDF sin fila TOTAL');
  if (totalRow && pdfTotal) {
    const tm = labelMap(pdfTotal);
    // "TOTAL: 2 alumnos | Capturados: ..." -> alumnos vive en el valor de TOTAL
    const mAl = /(\d+)\s*alumnos/i.exec(tm['TOTAL'] || '');
    const checks = [
      ['alumnos', 3, mAl ? num(mAl[1]) : null], ['Capturados', 4, num(tm['Capturados'])],
      ['Pendientes', 5, num(tm['Pendientes'])]
    ];
    for (const [pl, xlCol, exp] of checks) {
      if (!numEq(num(totalRow.cells[xlCol]), exp)) {
        bad(p, `TOTAL ${pl}: Excel=${totalRow.cells[xlCol]} PDF=${exp}`);
      }
    }
    if (!numEq(num(totalRow.cells[6]), num(tm['% General']))) {
      bad(p, `TOTAL % Captura: Excel=${totalRow.cells[6]} PDF=${tm['% General']}`);
    }
  }
  if (totalRow && pdfGrupo) {
    const nums = tokens(pdfGrupo).map(t => num(t)).filter(v => v != null);
    const last4 = nums.slice(-4); // alumnos, capturados, pendientes, %
    const xlVals = [3, 4, 5, 6].map(c => num(totalRow.cells[c]));
    for (let i = 0; i < 4; i++) {
      if (!numEq(xlVals[i], last4[i])) {
        bad(p, `TOTAL vs resumen por grupo: pos ${i} Excel=${xlVals[i]} PDF=${last4[i]}`);
      }
    }
  }

  // interno: Alumnos = alumnos del grupo (no suma por materia);
  // Capturados/Pendientes = suma de materias; % = capturados / (alumnos x materias x 3)
  if (totalRow && dataRows.length) {
    const groups = new Map();
    for (const r of dataRows) {
      const g = r.cells[1];
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(r);
    }
    let expAlumnos = 0;
    let den = 0;
    for (const rs of groups.values()) {
      const al = num(rs[0].cells[3]) || 0;
      expAlumnos += al;
      den += al * rs.length * 3;
    }
    const sums = { 4: 0, 5: 0 };
    for (const r of dataRows) {
      for (const c of [4, 5]) sums[c] += num(r.cells[c]) || 0;
    }
    if (!numEq(num(totalRow.cells[3]), expAlumnos)) {
      bad(p, `TOTAL Alumnos: ${totalRow.cells[3]} != alumnos del grupo ${expAlumnos}`);
    }
    for (const c of [4, 5]) {
      if (!numEq(num(totalRow.cells[c]), sums[c])) {
        bad(p, `TOTAL col ${c}: ${totalRow.cells[c]} != suma de materias ${sums[c]}`);
      }
    }
    const expPct = den ? Math.round((sums[4] / den) * 100) : null;
    if (!numEq(num(totalRow.cells[6]), expPct)) {
      bad(p, `TOTAL % Captura: ${totalRow.cells[6]} != ${expPct}%`);
    }
    // coherencia interna por materia
    for (const xr of dataRows) {
      const al = num(xr.cells[3]) || 0;
      const cap = num(xr.cells[4]) || 0;
      const pen = num(xr.cells[5]) || 0;
      if (cap + pen !== al * 3) bad(p, `fila ${xr.cells[2]}: capt ${cap} + pend ${pen} != ${al * 3}`);
    }
  }
}

// ======================== kardex =======================

async function pairKardex(xlFile, skiaFile, dompdfFile, name) {
  const p = startPair(name);
  const xl = await loadBook(xlFile);
  const skia = pdfTextRows(skiaFile);   // modo skia (pdftotext -layout)
  const dom = pdfTextRows(dompdfFile);  // modo dompdf (coordenadas)

  function parsePdfKardex(rows) {
    const out = [];
    for (const t of rows) {
      if (!/ISC-\d{3}/.test(t)) continue;
      const toks = tokens(t);
      const ci = toks.findIndex(x => /^ISC-\d{3}$/.test(x));
      if (ci < 0) continue; // p.ej. "Matricula: ISC-20240001" (clave ancha, no token de kardex)
      const clave = toks[ci];
      const periodo = toks.slice(0, ci).find(x => /^\d{4}-\d{4}\/\d$/.test(x)) || null;
      const after = toks.slice(ci + 1);
      let first = -1; let last = -1;
      after.forEach((tok, i) => {
        if (slotOf(tok)) { if (first < 0) first = i; last = i; }
      });
      const pre = first >= 0 ? after.slice(0, first) : after.slice();
      const materia = pre.filter(x => !/^\d{4}-\d{4}\/\d$/.test(x)).join(' ');
      const calif = first >= 0 ? after[first] : null;
      const cred = first >= 0 && slotOf(after[first + 1] || '') ? after[first + 1] : null;
      const estado = last >= 0 ? after.slice(last + 1).join(' ') : '';
      out.push({ clave, periodo, materia, calif, cred, estado });
    }
    return out;
  }

  const skiaRows = parsePdfKardex(skia.rows);
  const domRows = parsePdfKardex(dom.rows);
  expect(p, skiaRows.length > 0, 'PDF skia sin filas de kardex');
  expect(p, domRows.length > 0, 'PDF dompdf sin filas de kardex');

  const sheet1 = xl[0];
  const xlRows = sheet1.rows
    .filter(r => /^ISC-\d{3}$/.test(r.cells[3] || ''))
    .map(r => ({
      clave: r.cells[3], periodo: r.cells[2], materia: r.cells[4],
      calif: r.cells[5], cred: r.cells[6], estado: r.cells[7]
    }));
  const xlSheet2 = xl[1] ? xl[1].rows
    .filter(r => /^ISC-\d{3}$/.test(r.cells[3] || ''))
    .map(r => ({
      clave: r.cells[3], periodo: r.cells[2], materia: r.cells[4],
      calif: r.cells[5], cred: r.cells[6], estado: r.cells[7]
    })) : [];

  expect(p, xlRows.length > 0, 'Excel sin filas de kardex');
  if (xlRows.length && xlSheet2.length) {
    expect(p, xlRows.length === xlSheet2.length, 'hojas 1 y 2 del Excel tienen distinto numero de filas');
    for (let i = 0; i < xlRows.length; i++) {
      if (JSON.stringify(xlRows[i]) !== JSON.stringify(xlSheet2[i])) {
        bad(p, `hoja 2 difiere de hoja 1 en fila ${i}: ${JSON.stringify(xlSheet2[i])} != ${JSON.stringify(xlRows[i])}`);
      }
    }
  }

  function compareSide(pdfRows, label) {
    if (!pdfRows.length) return;
    // orden identico
    const xo = xlRows.map(r => r.clave).join(',');
    const po = pdfRows.map(r => r.clave).join(',');
    if (xo !== po) bad(p, `orden de materias Excel=[${xo}] vs ${label}=[${po}]`);
    for (const xr of xlRows) {
      const pr = pdfRows.find(r => r.clave === xr.clave);
      if (!pr) { bad(p, `${label}: falta ${xr.clave}`); continue; }
      // comparacion EXACTA de formato (paridad de cadena)
      if (normSpace(xr.calif) !== normSpace(String(pr.calif == null ? '—' : pr.calif))) {
        bad(p, `${label} ${xr.clave}: calif PDF="${pr.calif}" Excel="${xr.calif}"`);
      }
      if (normSpace(xr.cred) !== normSpace(String(pr.cred == null ? '—' : pr.cred))) {
        bad(p, `${label} ${xr.clave}: creditos PDF="${pr.cred}" Excel="${xr.cred}"`);
      }
      if (normSpace(xr.estado) !== normSpace(pr.estado)) {
        bad(p, `${label} ${xr.clave}: estado PDF="${pr.estado}" Excel="${xr.estado}"`);
      }
      if (normSpace(xr.materia) !== normSpace(pr.materia)) {
        bad(p, `${label} ${xr.clave}: materia PDF="${pr.materia}" Excel="${xr.materia}"`);
      }
      if (xr.periodo && pr.periodo && xr.periodo !== pr.periodo) {
        bad(p, `${label} ${xr.clave}: periodo PDF="${pr.periodo}" Excel="${xr.periodo}"`);
      }
    }
  }
  compareSide(skiaRows, 'pdf(skia)');
  compareSide(domRows, 'pdf(dompdf)');

  // etiquetas de datos del alumno
  compLabels(p, ['Nombre Completo', 'Matrícula', 'CURP', 'Carrera', 'Semestre',
    'Promedio General', 'Créditos cubiertos', 'Estatus'], xl, dom.rows);

  // Promedio General con formato de 2 decimales (ej. 0.00) en ambos lados
  const xlProm = xlLabelMap(xl)['Promedio General'];
  const pdfProm = labelMapAll(dom.rows)['Promedio General'];
  if (xlProm != null && pdfProm != null && !/^\d+\.\d{2}$/.test(xlProm)) {
    bad(p, `Promedio General Excel="${xlProm}" sin formato de 2 decimales`);
  }
}

// ======================== admin-kardex =======================

async function pairAdminKardex(xlFile, pdfFile, name) {
  const p = startPair(name);
  const xl = await loadBook(xlFile);
  const pdf = pdfTextRows(pdfFile);
  const xlTight = tight(allRowTexts(xl).join(' '));
  const pdfTight = tight(pdf.rows.join(' '));

  const xlm = xlLabelMap(xl);
  const fields = ['Nombre Completo', 'Matrícula', 'CURP', 'Carrera', 'Semestre', 'Estatus'];
  for (const f of fields) {
    const v = xlm[f];
    if (v == null) { bad(p, `Excel sin campo "${f}:"`); continue; }
    const probe = tight(`${f}:${v}`);
    if (!pdfTight.includes(probe)) bad(p, `PDF sin "${f}:${v}"`);
  }
  // Promedio con formato 2dp en ambos lados
  const xlProm = xlm['Promedio General'] || xlm['Promedio'];
  const pdfPromM = /Promedio(?:General)?:([0-9.]+)/.exec(pdfTight);
  if (!xlProm) bad(p, 'Excel sin Promedio');
  if (!pdfPromM) bad(p, 'PDF sin Promedio');
  if (xlProm && pdfPromM && xlProm !== pdfPromM[1]) {
    bad(p, `Promedio: PDF="${pdfPromM[1]}" Excel="${xlProm}"`);
  }
  if (xlProm && !/^\d+\.\d{2}$/.test(xlProm)) bad(p, `Promedio Excel="${xlProm}" sin formato 2 decimales`);
  if (xlTight.length < 100 || pdfTight.length < 100) bad(p, 'contenido sospechosamente corto');
}

// ======================== desercion =======================

async function pairDesercion(xlFile, pdfFile, name) {
  const p = startPair(name);
  const xl = await loadBook(xlFile);
  const pdf = pdfTextRows(pdfFile);

  // 1. Resumen ejecutivo: header + valores posicionales
  const res = sheet(xl, 'Resumen Ejecutivo');
  expect(p, !!res, 'falta hoja Resumen Ejecutivo');
  if (res) {
    const hRow = res.rows.find(r => /Alertas Totales/i.test(r.cells[1] || ''));
    const vRow = hRow ? res.rows.find(r => r.rn === hRow.rn + 1) : null;
    const pdfH = findRow(pdf.rows, 'ALERTAS TOTALES');
    const pdfV = pdfH ? pdf.rows[pdf.rows.indexOf(pdfH) + 1] : null;
    expect(p, !!hRow, 'Excel sin header de indicadores');
    expect(p, !!pdfH, 'PDF sin header de indicadores');
    if (hRow && vRow && pdfH && pdfV) {
      const xlLabels = [];
      for (let c = 1; c < hRow.cells.length; c++) if (hRow.cells[c]) xlLabels.push(normSpace(hRow.cells[c]));
      const pdfLabels = tokens(pdfH).join(' ').toUpperCase().split('  ').filter(Boolean);
      // comparar labels como secuencia (upper, sin signos)
      const normL = s => s.toUpperCase().replace(/[^A-ZÁÉÍÓÚÑ ]/g, ' ').replace(/\s+/g, ' ').trim();
      const xlSeq = xlLabels.map(normL).join('|');
      const pdfSeq = normL(tokens(pdfH).join(' ')).split(' ').length
        ? normL(tokens(pdfH).join(' ')) : '';
      // el PDF une labels sin doble espacio; comparar por presencia de cada label
      for (const l of xlLabels) {
        if (!normL(tokens(pdfH).join(' ')).includes(normL(l))) {
          bad(p, `indicador "${l}" no encontrado en header PDF`);
        }
      }
      const xlVals = [];
      for (let c = 1; c < vRow.cells.length; c++) if (vRow.cells[c]) xlVals.push(normSpace(vRow.cells[c]));
      const pdfVals = tokens(pdfV);
      if (xlVals.length !== pdfVals.length) {
        bad(p, `indicadores: ${xlVals.length} valores Excel vs ${pdfVals.length} PDF`);
      } else {
        for (let i = 0; i < xlVals.length; i++) {
          if (num(xlVals[i]) != null || num(pdfVals[i]) != null) {
            if (!numEq(num(xlVals[i]), num(pdfVals[i]))) {
              bad(p, `indicador ${i}: PDF="${pdfVals[i]}" Excel="${xlVals[i]}"`);
            }
          } else if (xlVals[i] !== pdfVals[i]) {
            bad(p, `indicador ${i}: PDF="${pdfVals[i]}" Excel="${xlVals[i]}"`);
          }
        }
      }
    }
  }

  // 2. Distribucion de riesgo
  const distRow = findRow(allRowTexts(xl), 'Medio');
  const distPdf = pdf.rows.find(t => /^Medio /.test(t));
  if (distRow && distPdf) {
    const xv = tokens(distRow).map(t => num(t)).filter(v => v != null);
    const pv = tokens(distPdf).map(t => num(t)).filter(v => v != null);
    if (xv.length !== pv.length || xv.some((v, i) => !numEq(v, pv[i]))) {
      bad(p, `distribucion riesgo: PDF=[${pv}] Excel=[${xv}]`);
    }
    if (!tight(distPdf).includes(tight('Seguimiento preventivo'))) {
      bad(p, 'distribucion: falta descripcion "Seguimiento preventivo" en PDF');
    }
  } else {
    if (!distRow) bad(p, 'Excel sin fila de distribucion (Medio)');
    if (!distPdf) bad(p, 'PDF sin fila de distribucion (Medio)');
  }

  // 3. Comparativa por ciclos (hoja Indicadores vs PDF seccion 4)
  const ind = sheet(xl, 'Indicadores');
  expect(p, !!ind, 'falta hoja Indicadores');
  if (ind) {
    const cicloRows = ind.rows.filter(r => /^\d{4}-\d{4}\/\d$/.test(r.cells[1] || '') || r.cells[1] === '2026-1');
    expect(p, cicloRows.length > 0, 'sin filas de ciclos en Excel');
    for (const cr of cicloRows) {
      const ciclo = cr.cells[1];
      const pr = pdf.rows.find(t => t.startsWith(ciclo + ' ') || t.includes(' ' + ciclo + ' '));
      if (!pr) { bad(p, `ciclo ${ciclo}: sin fila en PDF`); continue; }
      const pv = tokens(pr).map(t => num(t)).filter(v => v != null);
      const xv = [2, 3, 4, 5, 6].map(c => num(cr.cells[c]));
      if (pv.length !== xv.length) {
        bad(p, `ciclo ${ciclo}: PDF num=${pv.length} Excel num=${xv.length}`);
      } else {
        for (let i = 0; i < xv.length; i++) {
          if (!numEq(xv[i], pv[i])) bad(p, `ciclo ${ciclo} col ${i}: PDF=${pv[i]} Excel=${xv[i]}`);
        }
      }
    }
  }

  // 4. Alertas recientes
  const alertSheet = sheet(xl, 'Alertas y Detalle');
  expect(p, !!alertSheet, 'falta hoja Alertas y Detalle');
  if (alertSheet) {
    const aRows = alertSheet.rows.filter(r => /^\d+$/.test(r.cells[1] || '') && r.cells[2] && r.cells[5]);
    expect(p, aRows.length > 0, 'sin alertas en Excel');
    for (const ar of aRows) {
      const n = ar.cells[1];
      const pr = pdf.rows.find(t => new RegExp(`(^| )${n}( |$)`) && tokens(t).includes(n) && t.includes(ar.cells[2]));
      if (!pr) { bad(p, `alerta ${n}: sin fila en PDF`); continue; }
      const pt = tokens(pr);
      if (!pt.includes(ar.cells[2])) bad(p, `alerta ${n}: matricula "${ar.cells[2]}" ausente en PDF`);
      if (!pt.includes(normSpace(ar.cells[4]))) bad(p, `alerta ${n}: puntaje "${ar.cells[4]}" ausente en PDF`);
      if (!pt.includes(normSpace(ar.cells[7] || ar.cells[6] || ''))) { /* periodo */ }
      const periodo = [7, 6].map(c => ar.cells[c]).find(v => v && /^\d{4}-\d{4}\/\d$/.test(v));
      if (periodo && !pr.includes(periodo)) bad(p, `alerta ${n}: periodo "${periodo}" ausente en PDF`);
      if (!pr.includes(normSpace(ar.cells[4]))) bad(p, `alerta ${n}: riesgo/puntaje ausente en PDF`);
      if (!pr.includes(normSpace(ar.cells[5]))) bad(p, `alerta ${n}: estado "${ar.cells[5]}" ausente en PDF`);
      if (!subseq(pr, normSpace(ar.cells[3]))) bad(p, `alerta ${n}: alumno "${ar.cells[3]}" ausente en PDF`);
    }
  }

  // 5. Materias criticas
  if (ind) {
    const mcHeader = ind.rows.find(r => /MATERIAS CRITICAS/i.test(r.cells[1] || ''));
    // rn > header+1: la fila inmediata es el sub-header (Materia | Alumnos Eval. | ...)
    const mcRows = mcHeader
      ? ind.rows.filter(r => r.rn > mcHeader.rn + 1 && r.cells[1] && r.cells[2] && r.cells[5])
      : [];
    for (const mr of mcRows) {
      const mat = normSpace(mr.cells[1]);
      const pr = pdf.rows.find(t => t.includes(mat));
      if (!pr) { bad(p, `materia critica "${mat}": sin fila en PDF`); continue; }
      const pv = tokens(pr).map(t => num(t)).filter(v => v != null);
      const xv = [2, 3, 4].map(c => num(mr.cells[c]));
      if (pv.length !== xv.length || xv.some((v, i) => !numEq(v, pv[i]))) {
        bad(p, `materia critica "${mat}": PDF=[${pv}] Excel=[${xv}]`);
      }
      if (!pr.includes(normSpace(mr.cells[5]))) bad(p, `materia critica "${mat}": nivel "${mr.cells[5]}" ausente en PDF`);
    }
    expect(p, mcRows.length > 0, 'sin materias criticas en Excel');
  }

  // 6. Progresion temporal
  if (ind) {
    const progHeader = ind.rows.find(r => r.cells[1] === 'Mes' || r.cells[2] === 'Bajo');
    const progRow = progHeader ? ind.rows.find(r => r.rn === progHeader.rn + 1) : null;
    const pdfProg = pdf.rows.find(t => /^— 0 |^— /.test(t) && tokens(t).length === 6);
    if (progRow && pdfProg) {
      const xv = [2, 3, 4, 5, 6].map(c => num(progRow.cells[c]));
      const pv = tokens(pdfProg).map(t => num(t)).filter(v => v != null);
      if (xv.length !== pv.length || xv.some((v, i) => !numEq(v, pv[i]))) {
        bad(p, `progresion: PDF=[${pv}] Excel=[${xv}]`);
      }
    } else {
      if (!progRow) bad(p, 'Excel sin fila de progresion');
      if (!pdfProg) bad(p, 'PDF sin fila de progresion');
    }
  }

  // 7. Recomendaciones (presencia del texto base)
  const recRow = findRow(allRowTexts(xl), 'Monitorear el');
  if (recRow) {
    const probe = tight('Monitorear el desempeño y reforzar acompañamiento académico preventivo.');
    if (!tight(pdf.rows.join(' ')).includes(probe)) bad(p, 'PDF sin recomendacion "Monitorear el desempeno..."');
  }
}

// ======================== internos / lint =======================

async function pairResumenInterno(xlFile, name) {
  const p = startPair(name);
  const xl = await loadBook(xlFile);
  const ws = sheet(xl, 'Resumen Ejecutivo');
  expect(p, !!ws, 'falta hoja Resumen Ejecutivo');
  if (!ws) return;
  // A Grupo | B Total Alumnos | C Materias | D Promedio | E Aprobados | F Reprobados | G %
  const dataRows = ws.rows.filter(r => r.cells[1] && r.cells[1] !== 'Grupo' && /^\d+$/.test(r.cells[1] || ''));
  const totalRow = ws.rows.find(r => /^TOTAL$/i.test(r.cells[1] || ''));
  expect(p, dataRows.length > 0, 'sin filas de grupo');
  expect(p, !!totalRow, 'sin fila TOTAL');
  if (!totalRow || !dataRows.length) return;

  const sums = { 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  let wSum = 0; let wDen = 0;
  for (const r of dataRows) {
    for (const c of [2, 3, 4, 5, 6]) sums[c] += num(r.cells[c]) || 0;
    const prom = num(r.cells[4]); const mats = num(r.cells[3]) || 0;
    if (prom != null && mats) { wSum += prom * mats; wDen += mats; }
    // apr + rep == materias (filas PUBLICADAS)
    const apr = num(r.cells[5]) || 0; const rep = num(r.cells[6]) || 0;
    if (apr + rep !== mats) bad(p, `grupo ${r.cells[1]}: aprob ${apr}+reprob ${rep} != materias ${mats}`);
    const pct = num(r.cells[7]);
    const expPct = mats ? Math.round((apr / mats) * 100) : null;
    if (!numEq(pct, expPct)) bad(p, `grupo ${r.cells[1]}: % ${pct} != ${expPct}`);
  }
  for (const c of [2, 3, 5, 6]) {
    if (!numEq(num(totalRow.cells[c]), sums[c])) {
      bad(p, `TOTAL col ${c}: ${totalRow.cells[c]} != suma ${sums[c]}`);
    }
  }
  const expProm = wDen ? r2(wSum / wDen) : null;
  if (!numEq(num(totalRow.cells[4]), expProm)) bad(p, `TOTAL promedio: ${totalRow.cells[4]} != ${expProm}`);
  const expPct = sums[3] ? Math.round((sums[5] / sums[3]) * 100) : null;
  if (!numEq(num(totalRow.cells[7]), expPct)) bad(p, `TOTAL %: ${totalRow.cells[7]} != ${expPct}`);
}

async function pairPreboletasConcentrado(xlFile, name) {
  const p = startPair(name);
  const xl = await loadBook(xlFile);
  const texts = allRowTexts(xl);
  // titulo con el periodo de la ruta (2025-2026/2), no el periodo casa del grupo
  const title = findRow(texts, 'CONCENTRADO');
  expect(p, !!title, 'sin titulo CONCENTRADO');
  if (title && !title.includes('2025-2026/2')) {
    bad(p, `titulo sin periodo de la ruta: "${title}"`);
  }
  const ws = xl[0];
  const header = ws.rows.find(r => r.cells[2] === 'Alumno' || r.cells[2] === 'Matrícula');
  expect(p, !!header, 'sin header de materias');
  const dataRows = ws.rows.filter(r => MATRICULA_RE.test(r.cells[2] || ''));
  expect(p, dataRows.length > 0, 'sin filas');
  if (!header) return;
  const matCols = [];
  for (let c = 4; c < header.cells.length; c++) {
    if (header.cells[c] && !/^Promedio$/i.test(header.cells[c])) matCols.push(c);
  }
  const promCol = header.cells.length - 1;
  for (const xr of dataRows) {
    const vals = matCols.map(c => cellSlot(xr.cells[c]));
    const exp = avg(vals.filter(v => v !== undefined));
    const got = cellSlot(xr.cells[promCol]);
    if (exp != null && !numEq(got, r2(exp))) {
      bad(p, `fila ${xr.cells[2]}: Promedio ${got} != promedio de columnas ${r2(exp)}`);
    }
    for (const c of matCols) {
      const v = normSpace(xr.cells[c]);
      if (v && !SLOT_NULL.test(v) && num(v) == null) bad(p, `celda no numerica ${xr.cells[c]}`);
    }
  }
}

async function pairPreboletasAlumno(xlFile, refXlFile, name) {
  const p = startPair(name);
  const xl = await loadBook(xlFile);
  const ref = await loadBook(refXlFile);
  const ws = sheet(xl, 'Calificaciones');
  const refWs = sheet(ref, 'Calificaciones');
  expect(p, !!ws, 'falta hoja Calificaciones');
  if (!ws || !refWs) return;
  const rows = ws.rows.filter(r => /^\d+$/.test(r.cells[1] || '') && r.cells[2]);
  const refMap = {};
  for (const r of refWs.rows.filter(rr => /^\d+$/.test(rr.cells[1] || '') && rr.cells[2])) {
    refMap[normSpace(r.cells[2])] = r;
  }
  expect(p, rows.length > 0, 'sin filas de materias');
  const nv = v => { const s = cellSlot(v); return s === undefined ? null : s; };
  for (const xr of rows) {
    const mat = normSpace(xr.cells[2]);
    const got = nv(xr.cells[7]);
    // paridad con la preboleta academica de referencia (el promedio puede
    // venir de promedio_parciales con 1 decimal; no recalcularlo aqui)
    const rr = refMap[mat];
    if (!rr) { bad(p, `${mat}: no encontrada en preboleta de referencia`); continue; }
    const refGot = nv(rr.cells[7]);
    if (!(got == null && refGot == null)
      && (got == null || refGot == null || !numEq(got, refGot))) {
      bad(p, `${mat}: promedio preboletas=${xr.cells[7]} != preboleta academica=${rr.cells[7]}`);
    }
  }
}

async function lintExcel(name) {
  const p = startPair(name);
  const dir = OUT;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx'));
  for (const f of files) {
    const xl = await loadBook(f);
    for (const s of xl) {
      for (const r of s.rows) {
        for (let c = 1; c < r.cells.length; c++) {
          const v = r.cells[c];
          if (!v) continue;
          if (/^0\d+$/.test(v) || /^-?\d+\.\d+$/.test(v) && /^0\d/.test(v)) {
            bad(p, `${f} ${s.name} R${r.rn}C${c}: cero a la izquierda "${v}"`);
          }
          if (/^\d{4,}%$/.test(v)) bad(p, `${f} ${s.name} R${r.rn}C${c}: porcentaje absurdo "${v}"`);
          if (/^-\d+%$/.test(v)) bad(p, `${f} ${s.name} R${r.rn}C${c}: porcentaje negativo "${v}"`);
          if (/^-\d+(\.\d+)?$/.test(v) && !/^\d{4}-/.test(v)) {
            const lbl = normSpace(r.cells[c - 1] || '');
            if (!/Folio|Emitido|Fecha|Periodo/i.test(lbl)) {
              bad(p, `${f} ${s.name} R${r.rn}C${c}: valor negativo "${v}"`);
            }
          }
          if (/^\d{7,}$/.test(v) && v.length > 12) bad(p, `${f} ${s.name} R${r.rn}C${c}: numero absurdo "${v}"`);
        }
      }
    }
  }
}

// ============================== main ==============================

const PAIRS = [
  // ---------------- ALUMNO ----------------
  {
    name: 'ALUMNO/boleta',
    run: () => pairBoleta(
      'ALUMNO_academicExport__academic_export_boleta_1_11.xlsx',
      'ALUMNO_academicPDF__academic_pdf_boleta_1_11.pdf')
  },
  {
    name: 'ALUMNO/boleta (calificaciones)',
    run: () => pairBoleta(
      'ALUMNO_calificaciones__calificaciones_export_boleta_1_idPeriodo_11.xlsx',
      'ALUMNO_academicPDF__academic_pdf_boleta_1_11.pdf')
  },
  {
    name: 'ALUMNO/preboleta',
    run: () => pairPreboleta(
      'ALUMNO_academicExport__academic_export_preboleta_1_11.xlsx',
      'ALUMNO_academicPDF__academic_pdf_preboleta_1_11.pdf')
  },
  {
    name: 'ALUMNO/historial',
    run: () => pairHistorial(
      'ALUMNO_academicExport__academic_export_historial_1.xlsx',
      'ALUMNO_academicPDF__academic_pdf_historial_1.pdf')
  },
  {
    name: 'ALUMNO/boleta (preboletas)',
    run: () => pairBoleta(
      'ALUMNO_preboletas__preboletas_export_boleta_excel_1_idPeriodo_11.xlsx',
      'ALUMNO_preboletas__preboletas_export_boleta_pdf_1_idPeriodo_11.pdf')
  },
  {
    name: 'ALUMNO/preboleta (preboletas vs academica)',
    run: () => pairPreboletasAlumno(
      'ALUMNO_preboletas__preboletas_export_excel_alumno_1_idPeriodo_11.xlsx',
      'ALUMNO_academicExport__academic_export_preboleta_1_11.xlsx')
  },
  {
    name: 'ALUMNO/kardex',
    run: () => pairKardex(
      'ALUMNO_reportes__reportes_kardex_me_excel.xlsx',
      'ALUMNO_reportes__reportes_kardex_me_pdf.pdf',
      'ALUMNO_reportes__reportes_kardex_me_pdf_dompdf.pdf')
  },
  // ---------------- DOCENTE ----------------
  {
    name: 'DOCENTE/reporte-grupo',
    run: () => pairReporteGrupo(
      'DOCENTE_academicExport__academic_export_reporte_grupo_23_11.xlsx',
      'DOCENTE_academicPDF__academic_pdf_reporte_grupo_23_11.pdf')
  },
  {
    name: 'DOCENTE/calificaciones-grupo',
    run: () => pairGrupoCalificaciones(
      'DOCENTE_calificaciones__calificaciones_export_grupo_23_periodo_11.xlsx',
      'DOCENTE_academicPDF__academic_pdf_reporte_grupo_23_11.pdf')
  },
  {
    name: 'DOCENTE/parcial',
    run: () => pairParcial(
      'DOCENTE_academicExport__academic_export_parcial_23_11_1.xlsx',
      'DOCENTE_academicPDF__academic_pdf_parcial_23_11_1.pdf')
  },
  {
    name: 'DOCENTE/concentrado',
    run: () => pairConcentrado(
      'DOCENTE_academicExport__academic_export_concentrado_23_11.xlsx',
      'DOCENTE_academicPDF__academic_pdf_periodo_23_11.pdf')
  },
  {
    name: 'DOCENTE/historial',
    run: () => pairHistorial(
      'DOCENTE_academicExport__academic_export_historial_1.xlsx',
      'DOCENTE_academicPDF__academic_pdf_historial_1.pdf')
  },
  {
    name: 'DOCENTE/kardex',
    run: () => pairKardex(
      'DOCENTE_reportes__reportes_kardex_1_excel.xlsx',
      'DOCENTE_reportes__reportes_kardex_1_pdf.pdf',
      'DOCENTE_reportes__reportes_kardex_1_pdf_dompdf.pdf')
  },
  {
    name: 'DOCENTE/preboletas-concentrado',
    run: () => pairPreboletasConcentrado(
      'DOCENTE_preboletas__preboletas_export_excel_grupo_23_periodo_11.xlsx')
  },
  // ---------------- COORDINADOR ----------------
  {
    name: 'COORDINADOR/periodo',
    run: () => pairPeriodoCoordinador(
      'COORDINADOR_academicExport__academic_export_periodo_11.xlsx',
      'DOCENTE_academicPDF__academic_pdf_periodo_23_11.pdf')
  },
  {
    name: 'COORDINADOR/seguimiento',
    run: () => pairSeguimiento(
      'COORDINADOR_academicExport__academic_export_seguimiento_11.xlsx',
      'COORDINADOR_academicPDF__academic_pdf_seguimiento_11.pdf')
  },
  {
    name: 'COORDINADOR/resumen',
    run: () => pairResumenInterno(
      'COORDINADOR_calificaciones__calificaciones_export_resumen_11.xlsx')
  },
  // ---------------- ADMINISTRADOR / SOPORTE / GENERAL ----------------
  {
    name: 'ADMINISTRADOR/kardex',
    run: () => pairAdminKardex(
      'ADMINISTRADOR_adminKardex__admin_kardex_export_excel_1.xlsx',
      'ADMINISTRADOR_adminKardex__admin_kardex_export_pdf_1.pdf')
  },
  {
    name: 'SOPORTE/desercion',
    run: () => pairDesercion(
      'SOPORTE_desercion__ia_desercion_reporte_excel.xlsx',
      'SOPORTE_desercion__ia_desercion_reporte_pdf.pdf')
  },
  { name: 'GENERAL/lint Excel', run: () => lintExcel('lint Excel (todos los .xlsx)') }
];

async function main() {
  for (const j of PAIRS) {
    const before = results.length;
    try {
      await j.run();
    } catch (e) {
      const p = startPair(j.name);
      const msg = e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : String(e);
      bad(p, `ERROR: ${msg}`);
    }
    for (let i = before; i < results.length; i++) {
      if (!results[i].name) results[i].name = j.name;
    }
  }

  let total = 0;
  let rojos = 0;
  console.log('=== FASE D — Paridad PDF <-> Excel ===');
  for (const r of results) {
    if (r.problems.length) {
      rojos++;
      total += r.problems.length;
      console.log(`[ROJO] ${r.name} (${r.problems.length})`);
      for (const m of r.problems) console.log(`   - ${m}`);
    } else {
      console.log(`[VERDE] ${r.name}`);
    }
  }
  console.log(`\nPares: ${results.length} | Pares en rojo: ${rojos} | Discrepancias: ${total}`);
  process.exit(total ? 1 : 0);
}

main().catch(e => {
  console.error('FATAL:', e && e.stack ? e.stack : e);
  process.exit(1);
});
