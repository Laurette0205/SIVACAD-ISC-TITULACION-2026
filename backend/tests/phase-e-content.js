'use strict';
// Verificación de contenido de los archivos exportados en Fase E
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const OUT = path.join(__dirname, '_phase_e_out');
const APA_M = 1.0, HF = 0.5;

const EXPECT = {
  boleta: ['#', 'Materia', 'Clave', 'P1', 'P2', 'P3', 'Promedio', 'Final', 'Estado'],
  preboleta: ['#', 'Materia', 'Docente', 'P1', 'P2', 'P3', 'Promedio', 'Estado']
};

function findRow(ws, values) {
  // busca fila cuyas primeras celdas coincidan con values
  let found = null;
  ws.eachRow({ includeEmpty: false }, (row, rn) => {
    if (found) return;
    const cells = [];
    row.eachCell({ includeEmpty: true }, c => cells.push(String(c.value ?? '').trim()));
    const ok = values.every((v, i) => cells[i] === v);
    if (ok) found = { rn, cells: cells.slice(0, values.length) };
  });
  return found;
}

function headerState(ws) {
  const m = ws.pageSetup && ws.pageSetup.margins;
  const okM = m && Math.abs(m.left - APA_M) < 0.01 && Math.abs(m.top - APA_M) < 0.01
    && Math.abs(m.right - APA_M) < 0.01 && Math.abs(m.bottom - APA_M) < 0.01
    && Math.abs(m.header - HF) < 0.01 && Math.abs(m.footer - HF) < 0.01;
  return {
    ok: !!okM,
    paper: ws.pageSetup && ws.pageSetup.paperSize,
    orient: ws.pageSetup && ws.pageSetup.orientation,
    fitW: ws.pageSetup && ws.pageSetup.fitToWidth,
    fitH: ws.pageSetup && ws.pageSetup.fitToHeight
  };
}

function collectText(ws, limit = 400) {
  const out = [];
  ws.eachRow({ includeEmpty: false }, row => {
    if (out.length >= limit) return;
    const cells = [];
    row.eachCell({ includeEmpty: false }, c => { const v = c.value; if (v != null && v !== '') cells.push(String(typeof v === 'object' ? (v.result ?? v.text ?? '') : v).trim()); });
    if (cells.length) out.push(cells.join(' | '));
  });
  return out;
}

async function main() {
  const files = fs.readdirSync(OUT).filter(f => f.endsWith('.xlsx'));
  let problems = 0;
  const report = [];

  for (const f of files) {
    const p = path.join(OUT, f);
    const wb = new ExcelJS.Workbook();
    try { await wb.xlsx.readFile(p); } catch (e) { console.log(`[READ-FAIL] ${f}: ${e.message}`); problems++; continue; }

    const sheets = [];
    let allApa = true;
    for (const ws of wb.worksheets) {
      const st = headerState(ws);
      if (!st.ok) allApa = false;
      sheets.push(`${ws.name}(r${ws.rowCount} ${st.orient} pap${st.paper} fitW${st.fitW}/fitH${st.fitH} APA:${st.ok ? 'S' : 'N'})`);
    }

    // checks específicos
    const checks = [];
    const allSheets = wb.worksheets;

    if (/boleta/i.test(f) && !/excel_grupo/i.test(f)) {
      let found = null;
      for (const ws of allSheets) {
        if (findRow(ws, EXPECT.boleta)) { found = 'boleta-header-OK'; break; }
        if (findRow(ws, EXPECT.preboleta)) { found = 'preboleta-header-OK'; break; }
      }
      checks.push(found || 'HEADER-NO-ENCONTRADO');
      if (!found) { problems++; console.log(`[HDR-FAIL] ${f}`); }

      let bad = 0;
      for (const ws of allSheets) {
        ws.eachRow({ includeEmpty: false }, row => {
          const c = [];
          row.eachCell({ includeEmpty: true }, cell => c.push(String(cell.value ?? '').trim()));
          if (c[0] !== '' && /^\d+$/.test(c[0]) && c[1] && c[3] === '-' && c[4] === '-' && c[5] === '-') bad++;
        });
      }
      checks.push(bad === 0 ? 'parciales-OK' : `parciales-vacios:${bad}`);
      if (bad > 0) problems++;
    }

    if (/reporte_grupo/i.test(f)) {
      const names = wb.worksheets.map(w => w.name);
      checks.push(names.some(n => /calificaciones/i.test(n)) ? 'hoja3-OK' : 'hoja3-FALTA');
      if (!names.some(n => /calificaciones/i.test(n))) problems++;
    }

    // buscar estados académicos en cualquier libro
    const text = wb.worksheets.map(w => collectText(w).join('\n')).join('\n');
    const estados = ['Acreditada', 'No Acreditada', 'Pendiente', 'Sin Calificación'];
    const found = estados.filter(e => text.includes(e));
    if (/boleta|historial|calificaciones|reporte_grupo/i.test(f) && !/excel_grupo/i.test(f)) {
      checks.push(found.length ? `estados:[${found.join(',')}]` : 'estados:ninguno');
      if (!found.length) { problems++; console.log(`[EST-FAIL] ${f}: sin estados académicos`); }
    }

    // colores de estado (fill) presentes
    report.push(`${f}\n  sheets: ${sheets.join(', ')}\n  checks: ${checks.join(' | ')}`);
  }

  // PDFs: tamaño carta
  const pdfs = fs.readdirSync(OUT).filter(f => f.endsWith('.pdf'));
  let pdfNoLetter = 0;
  for (const f of pdfs) {
    const buf = fs.readFileSync(path.join(OUT, f));
    const s = buf.toString('latin1');
    const m = s.match(/\/MediaBox\s*\[\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)/);
    const letter = m && Math.abs(parseFloat(m[1]) - 612) < 2 && Math.abs(parseFloat(m[2]) - 792) < 2;
    if (!letter) { pdfNoLetter++; console.log(`[PDF-NO-LETTER] ${f}: ${m ? m[1] + 'x' + m[2] : 'sin MediaBox'}`); }
  }

  console.log(report.join('\n'));
  console.log(`\nXLSX: ${files.length} | PDF: ${pdfs.length} | PDF no-Letter: ${pdfNoLetter} | problemas: ${problems}`);
  process.exit(problems + pdfNoLetter > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
