'use strict';
// Fase E — Validación visual/estructural de exports por rol
// Uso: node tests/phase-e-exports.js

const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3000/api';
const OUT = path.join(__dirname, '_phase_e_out');

const USERS = {
  ADMINISTRADOR: 'admin@tesi.edu.mx',
  COORDINADOR: 'coordinador@tesi.edu.mx',
  DOCENTE: 'docente@tesi.edu.mx',
  ALUMNO: 'alumno@tesi.edu.mx',
  SOPORTE: 'soporte@tesi.edu.mx'
};
const PASS = 'Testing123!';

// IDs de prueba (grupo 23 / periodo 11 / alumno 1)
const G = 23, P = 11, A = 1;

const CASES = [
  // ALUMNO
  { rol: 'ALUMNO', method: 'get', url: `/academic-export/preboleta/${A}/${P}`, tipo: 'xlsx', grupo: 'academicExport' },
  { rol: 'ALUMNO', method: 'get', url: `/academic-export/boleta/${A}/${P}`, tipo: 'xlsx', grupo: 'academicExport' },
  { rol: 'ALUMNO', method: 'get', url: `/academic-export/historial/${A}`, tipo: 'xlsx', grupo: 'academicExport' },
  { rol: 'ALUMNO', method: 'get', url: `/academic-pdf/preboleta/${A}/${P}`, tipo: 'pdf', grupo: 'academicPDF' },
  { rol: 'ALUMNO', method: 'get', url: `/academic-pdf/boleta/${A}/${P}`, tipo: 'pdf', grupo: 'academicPDF' },
  { rol: 'ALUMNO', method: 'get', url: `/academic-pdf/historial/${A}`, tipo: 'pdf', grupo: 'academicPDF' },
  { rol: 'ALUMNO', method: 'get', url: `/preboletas/export/excel/alumno/${A}?idPeriodo=${P}`, tipo: 'xlsx', grupo: 'preboletas' },
  { rol: 'ALUMNO', method: 'get', url: `/preboletas/export/boleta/excel/${A}?idPeriodo=${P}`, tipo: 'xlsx', grupo: 'preboletas' },
  { rol: 'ALUMNO', method: 'get', url: `/preboletas/export/boleta/pdf/${A}?idPeriodo=${P}`, tipo: 'pdf', grupo: 'preboletas' },
  { rol: 'ALUMNO', method: 'get', url: `/calificaciones/export/boleta/${A}?idPeriodo=${P}`, tipo: 'xlsx', grupo: 'calificaciones' },
  { rol: 'ALUMNO', method: 'get', url: `/reportes/kardex/me/pdf`, tipo: 'pdf', grupo: 'reportes' },
  { rol: 'ALUMNO', method: 'get', url: `/reportes/kardex/me/pdf/dompdf`, tipo: 'pdf', grupo: 'reportes' },
  { rol: 'ALUMNO', method: 'get', url: `/reportes/kardex/me/excel`, tipo: 'xlsx', grupo: 'reportes' },

  // DOCENTE
  { rol: 'DOCENTE', method: 'get', url: `/academic-export/concentrado/${G}/${P}`, tipo: 'xlsx', grupo: 'academicExport' },
  { rol: 'DOCENTE', method: 'get', url: `/academic-export/parcial/${G}/${P}/1`, tipo: 'xlsx', grupo: 'academicExport' },
  { rol: 'DOCENTE', method: 'get', url: `/academic-export/reporte-grupo/${G}/${P}`, tipo: 'xlsx', grupo: 'academicExport' },
  { rol: 'DOCENTE', method: 'get', url: `/academic-export/preboleta/${A}/${P}`, tipo: 'xlsx', grupo: 'academicExport' },
  { rol: 'DOCENTE', method: 'get', url: `/academic-export/boleta/${A}/${P}`, tipo: 'xlsx', grupo: 'academicExport' },
  { rol: 'DOCENTE', method: 'get', url: `/academic-export/historial/${A}`, tipo: 'xlsx', grupo: 'academicExport' },
  { rol: 'DOCENTE', method: 'get', url: `/academic-pdf/parcial/${G}/${P}/1`, tipo: 'pdf', grupo: 'academicPDF' },
  { rol: 'DOCENTE', method: 'get', url: `/academic-pdf/periodo/${G}/${P}`, tipo: 'pdf', grupo: 'academicPDF' },
  { rol: 'DOCENTE', method: 'get', url: `/academic-pdf/reporte-grupo/${G}/${P}`, tipo: 'pdf', grupo: 'academicPDF' },
  { rol: 'DOCENTE', method: 'get', url: `/academic-pdf/historial/${A}`, tipo: 'pdf', grupo: 'academicPDF' },
  { rol: 'DOCENTE', method: 'get', url: `/calificaciones/export/grupo/${G}/periodo/${P}`, tipo: 'xlsx', grupo: 'calificaciones' },
  { rol: 'DOCENTE', method: 'get', url: `/preboletas/export/excel/grupo/${G}/periodo/${P}`, tipo: 'xlsx', grupo: 'preboletas' },
  { rol: 'DOCENTE', method: 'get', url: `/reportes/kardex/${A}/pdf`, tipo: 'pdf', grupo: 'reportes' },
  { rol: 'DOCENTE', method: 'get', url: `/reportes/kardex/${A}/pdf/dompdf`, tipo: 'pdf', grupo: 'reportes' },
  { rol: 'DOCENTE', method: 'get', url: `/reportes/kardex/${A}/excel`, tipo: 'xlsx', grupo: 'reportes' },

  // COORDINADOR
  { rol: 'COORDINADOR', method: 'get', url: `/academic-export/periodo/${P}`, tipo: 'xlsx', grupo: 'academicExport' },
  { rol: 'COORDINADOR', method: 'get', url: `/academic-export/seguimiento/${P}`, tipo: 'xlsx', grupo: 'academicExport' },
  { rol: 'COORDINADOR', method: 'get', url: `/academic-pdf/seguimiento/${P}`, tipo: 'pdf', grupo: 'academicPDF' },
  { rol: 'COORDINADOR', method: 'get', url: `/calificaciones/export/resumen/${P}`, tipo: 'xlsx', grupo: 'calificaciones' },

  // ADMINISTRADOR
  { rol: 'ADMINISTRADOR', method: 'get', url: `/admin-kardex/export/pdf/${A}`, tipo: 'pdf', grupo: 'adminKardex' },
  { rol: 'ADMINISTRADOR', method: 'get', url: `/admin-kardex/export/excel/${A}`, tipo: 'xlsx', grupo: 'adminKardex' },

  // SOPORTE
  { rol: 'SOPORTE', method: 'get', url: `/ia/desercion/reporte/pdf`, tipo: 'pdf', grupo: 'desercion' },
  { rol: 'SOPORTE', method: 'get', url: `/ia/desercion/reporte/excel`, tipo: 'xlsx', grupo: 'desercion' },
  { rol: 'SOPORTE', method: 'get', url: `/reportes/seguridad/mfa`, tipo: 'csv', grupo: 'reportes' }
];

async function login(rol) {
  const correo = USERS[rol];
  const resp = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, contrasena: PASS })
  });
  const data = await resp.json();
  const token = data.token || data.accessToken || data.data?.token;
  if (!token) throw new Error(`No token for ${rol}: ${JSON.stringify(data).slice(0, 200)}`);
  return token;
}

function validatePdf(buf) {
  const head = buf.slice(0, 5).toString('latin1');
  if (head !== '%PDF-') return { ok: false, reason: `magic=${JSON.stringify(head)}` };
  if (buf.length < 800) return { ok: false, reason: `too small ${buf.length}` };
  const tail = buf.slice(-2048).toString('latin1');
  if (!/%%EOF/.test(tail)) return { ok: false, reason: 'missing %%EOF' };
  const m = buf.toString('latin1').match(/\/MediaBox\s*\[\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)/);
  let letter = null;
  if (m) letter = Math.abs(parseFloat(m[1]) - 612) < 2 && Math.abs(parseFloat(m[2]) - 792) < 2;
  return { ok: true, bytes: buf.length, letter };
}

function validateXlsx(buf) {
  if (buf.length < 500) return { ok: false, reason: `too small ${buf.length}` };
  const zip = buf.slice(0, 2).toString('latin1');
  if (zip !== 'PK') return { ok: false, reason: `magic=${JSON.stringify(zip)}` };
  if (buf.indexOf('[Content_Types].xml') < 0 && buf.indexOf('xl/') < 0) {
    // strings may be compressed; check end of central directory exists
    const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (eocd < 0) return { ok: false, reason: 'no zip EOCD' };
  }
  return { ok: true, bytes: buf.length };
}

function validateCsv(buf) {
  const text = buf.toString('utf8');
  if (!text.trim()) return { ok: false, reason: 'empty' };
  return { ok: true, bytes: buf.length, lines: text.split(/\r?\n/).filter(Boolean).length };
}

async function checkXlsxMargins(filePath) {
  try {
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);
    const sheets = [];
    for (const ws of wb.worksheets) {
      const m = ws.pageSetup && ws.pageSetup.margins;
      sheets.push({
        name: ws.name,
        rows: ws.rowCount,
        margins: m || null,
        paperSize: ws.pageSetup ? ws.pageSetup.paperSize : null,
        orientation: ws.pageSetup ? ws.pageSetup.orientation : null
      });
    }
    return { ok: true, sheets };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

async function main() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  const results = [];
  const tokens = {};

  for (const rol of Object.keys(USERS)) {
    try {
      tokens[rol] = await login(rol);
      console.log(`[LOGIN] ${rol} OK`);
    } catch (e) {
      console.error(`[LOGIN] ${rol} FAIL: ${e.message}`);
      results.push({ rol, url: '(login)', status: 0, ok: false, reason: e.message });
    }
  }

  for (const c of CASES) {
    const token = tokens[c.rol];
    const row = { rol: c.rol, grupo: c.grupo, url: c.url, tipo: c.tipo };
    if (!token) {
      row.ok = false; row.status = 0; row.reason = 'sin token';
      results.push(row); continue;
    }
    try {
      const resp = await fetch(`${BASE}${c.url}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(60000)
      });
      row.status = resp.status;
      const arrBuf = await resp.arrayBuffer();
      const buf = Buffer.from(arrBuf);
      if (resp.status !== 200) {
        row.ok = false;
        let msg = '';
        try { msg = JSON.parse(buf.toString('utf8')).message || ''; } catch (_) {}
        row.reason = `HTTP ${resp.status} ${msg}`.trim();
        results.push(row);
        console.log(`[FAIL ${resp.status}] ${c.rol} ${c.url} ${row.reason}`);
        continue;
      }

      const ct = resp.headers.get('content-type') || '';
      const expectCt = c.tipo === 'pdf' ? 'pdf'
        : c.tipo === 'xlsx' ? 'spreadsheetml'
        : null;
      if (expectCt && !ct.includes(expectCt)) {
        row.ok = false;
        row.reason = `content-type "${ct}" != ${expectCt}`;
        results.push(row);
        console.log(`[FAIL CT] ${c.rol} ${c.url} ${row.reason}`);
        continue;
      }

      let v;
      if (c.tipo === 'pdf') v = validatePdf(buf);
      else if (c.tipo === 'xlsx') v = validateXlsx(buf);
      else v = validateCsv(buf);

      row.ok = v.ok;
      if (!v.ok) row.reason = v.reason;
      row.bytes = v.bytes;

      const safe = `${c.rol}_${c.grupo}_${c.url.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 80)}.${c.tipo}`;
      const fp = path.join(OUT, safe);
      fs.writeFileSync(fp, buf);
      row.file = safe;

      if (c.tipo === 'xlsx' && v.ok) {
        const mv = await checkXlsxMargins(fp);
        row.sheets = mv.sheets;
        if (!mv.ok) { row.ok = false; row.reason = `xlsx-open: ${mv.reason}`; }
        else {
          const bad = (mv.sheets || []).filter(s => !s.margins || Math.abs(s.margins.left - 1) > 0.01);
          if (bad.length) { row.ok = false; row.reason = `APA margins missing on: ${bad.map(b => b.name).join(', ')}`; }
        }
      }

      console.log(`${row.ok ? '[OK]' : '[FAIL]'} ${c.rol} ${c.url} ${row.bytes || ''} ${row.reason || ''}`);
    } catch (e) {
      row.ok = false;
      row.reason = e.message;
      console.log(`[ERROR] ${c.rol} ${c.url}: ${e.message}`);
    }
    results.push(row);
  }

  const pass = results.filter(r => r.ok).length;
  const fail = results.filter(r => !r.ok).length;
  console.log(`\n=== FASE E: ${pass} OK / ${fail} FAIL / ${results.length} total ===`);
  if (fail) {
    console.log('Fallos:');
    results.filter(r => !r.ok).forEach(r => console.log(` - [${r.rol}] ${r.url}: ${r.reason}`));
  }
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
