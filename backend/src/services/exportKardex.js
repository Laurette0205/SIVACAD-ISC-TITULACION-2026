'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Handlebars = require('handlebars');
const puppeteer = require('puppeteer');
const ExcelJS = require('exceljs');
const pool = require('../config/db');

const TEMPLATES_DIR = path.join(__dirname, 'templates');
const ASSETS_DIR = path.resolve(__dirname, '..', '..', '..', 'frontend', 'src', 'assets');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function generarFolio() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `K-${y}${m}${d}-${rand}`;
}

function formatFechaMX(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('es-MX', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Mexico_City'
    });
  } catch { return String(d); }
}

function getTzInfo() {
  return { zona_horaria: 'America/Mexico_City', utc_offset: 'UTC-6', timestamp: new Date().toISOString() };
}

function imageToBase64(filePath) {
  if (!filePath) return null;
  try {
    const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath.replace(/^\//, ''));
    if (!fs.existsSync(abs)) return null;
    const ext = path.extname(abs).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : null;
    if (!mime) return null;
    const data = fs.readFileSync(abs);
    return `data:${mime};base64,${data.toString('base64')}`;
  } catch { return null; }
}

function escXml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function selloCircularSVG(texto, subtitulo, seed) {
  const rng = crypto.createHash('md5').update(String(seed)).digest('hex');
  const tilt = (parseInt(rng.substring(0, 4), 16) % 7) - 3;
  return `<svg viewBox="0 0 140 140" width="110" height="110" xmlns="http://www.w3.org/2000/svg">
    <g transform="rotate(${tilt}, 70, 70)">
      <circle cx="70" cy="70" r="64" fill="none" stroke="#1e40af" stroke-width="3" opacity="0.85"/>
      <circle cx="70" cy="70" r="58" fill="none" stroke="#1e40af" stroke-width="1" opacity="0.4"/>
      <path d="M70 12 A58 58 0 1 1 69.9 12" fill="none" stroke="#1e40af" stroke-width="0.6" opacity="0.3"/>
      <text x="70" y="46" text-anchor="middle" font-size="10" font-weight="700" fill="#1e40af" font-family="Arial">${escXml(texto)}</text>
      <text x="70" y="58" text-anchor="middle" font-size="6" fill="#1e40af" font-family="Arial" opacity="0.8">${escXml(subtitulo)}</text>
      <text x="70" y="72" text-anchor="middle" font-size="11" font-weight="700" fill="#b91c1c" font-family="Arial">● SIVACAD ●</text>
      <text x="70" y="108" text-anchor="middle" font-size="5" fill="#1e40af" font-family="Arial" opacity="0.6">Firma Electrónica</text>
      <line x1="20" y1="116" x2="120" y2="116" stroke="#1e40af" stroke-width="0.5" opacity="0.3"/>
    </g>
  </svg>`;
}

function selloRectangularSVG(texto, subtitulo, seed) {
  const rng = crypto.createHash('md5').update(String(seed)).digest('hex');
  const tilt = (parseInt(rng.substring(0, 4), 16) % 5) - 2;
  return `<svg viewBox="0 0 140 100" width="120" height="90" xmlns="http://www.w3.org/2000/svg">
    <g transform="rotate(${tilt}, 70, 50)">
      <rect x="4" y="4" width="132" height="92" rx="6" fill="none" stroke="#1e40af" stroke-width="2.5" opacity="0.85"/>
      <rect x="9" y="9" width="122" height="82" rx="4" fill="none" stroke="#1e40af" stroke-width="0.8" opacity="0.35"/>
      <text x="70" y="34" text-anchor="middle" font-size="12" font-weight="700" fill="#1e40af" font-family="Arial">${escXml(texto)}</text>
      <text x="70" y="50" text-anchor="middle" font-size="7" fill="#1e40af" font-family="Arial" opacity="0.85">${escXml(subtitulo)}</text>
      <text x="70" y="66" text-anchor="middle" font-size="9" font-weight="700" fill="#b91c1c" font-family="Arial">● SIVACAD ●</text>
      <text x="70" y="84" text-anchor="middle" font-size="4.5" fill="#1e40af" font-family="Arial" opacity="0.5">Documento Oficial</text>
    </g>
  </svg>`;
}

function generarSellosSVG(sellosDB) {
  const defaultSellos = [
    { tipo: 'sivacad', titulo: 'Sello SIVACAD', descripcion: 'Sello oficial del Sistema Integral de Validación y Control Académico' },
    { tipo: 'division_isc', titulo: 'Sello División ISC', descripcion: 'Sello de la División de Ingeniería en Sistemas Computacionales' },
    { tipo: 'control_escolar', titulo: 'Sello Control Escolar', descripcion: 'Sello oficial de Control Escolar' },
  ];
  const sellos = (sellosDB && sellosDB.length > 0) ? sellosDB : defaultSellos;
  return sellos.slice(0, 3).map((s, i) => {
    const titulo = s.titulo || s.tipo;
    const desc = s.descripcion || '';
    let img;
    if (i === 0) img = selloCircularSVG(titulo, desc, `sello-${i}`);
    else if (i === 1) img = selloRectangularSVG(titulo, desc, `sello-${i}`);
    else img = selloCircularSVG(titulo, desc, `sello-${i}`);
    return { titulo, descripcion: desc, img, tipo: s.tipo };
  });
}

async function getKardexData(id) {
  const [rows] = await pool.execute(
    `SELECT k.*,
            a.matricula, a.nombres, a.apellido_paterno, a.apellido_materno,
            a.curp, a.semestre_actual, a.fotografia,
            c.nombre_carrera
     FROM kardex_alumno k
     INNER JOIN alumnos a ON a.id_alumno = k.id_alumno
     LEFT JOIN carreras c ON c.id_carrera = COALESCE(a.id_carrera, 1)
     WHERE k.id_kardex = ? OR a.id_alumno = ? OR a.id_usuario = ?
     LIMIT 1`,
    [id, id, id]
  );
  if (!rows.length) return null;
  return rows[0];
}

async function getHistorial(idAlumno) {
  try {
    const [rows] = await pool.execute(
      `SELECT kh.*, p.nombre_periodo, m.nombre_materia, m.clave_materia, m.creditos AS creditos_materia
       FROM kardex_historial_academico kh
       LEFT JOIN periodos p ON p.id_periodo = kh.id_periodo
       LEFT JOIN materias m ON m.id_materia = kh.id_materia
       WHERE kh.id_alumno = ?
       ORDER BY p.fecha_inicio DESC, kh.creado_en DESC`,
      [idAlumno]
    );
    return rows;
  } catch { return []; }
}

async function getSellos() {
  try {
    const [rows] = await pool.execute('SELECT * FROM kardex_sellos WHERE activo = 1');
    return rows;
  } catch { return []; }
}

async function generateKardexPDF(id) {
  const k = await getKardexData(id);
  if (!k) throw new Error('Kardex no encontrado');

  const folio = k.folio_kardex || generarFolio();
  if (!k.folio_kardex) {
    await pool.execute('UPDATE kardex_alumno SET folio_kardex = ? WHERE id_kardex = ?', [folio, k.id_kardex]);
  }

  const tz = getTzInfo();
  const nombreCompleto = `${k.nombres || ''} ${k.apellido_paterno || ''} ${k.apellido_materno || ''}`.replace(/\s+/g, ' ').trim();
  const creditosCubiertos = Number(k.creditos_acumulados || 0);
  const promedio = Number(k.promedio_general || 0).toFixed(2);

  const sellosDB = await getSellos();
  const sellos = generarSellosSVG(sellosDB);
  const historial = await getHistorial(k.id_alumno);

  const firmaUUID = crypto.randomUUID();
  const firmaData = JSON.stringify({ folio, alumno: nombreCompleto, matricula: k.matricula, emitido: new Date().toISOString(), tz, uuid: firmaUUID });
  const firmaHash = crypto.createHash('sha256').update(firmaData).digest('hex');

  await pool.execute('UPDATE kardex_alumno SET firma_electronica = ? WHERE id_kardex = ?', [firmaHash, k.id_kardex]);

  const logo_tecnm = imageToBase64(path.join(ASSETS_DIR, 'Logo-TecNM.png'));
  const logo_tesi = imageToBase64(path.join(ASSETS_DIR, 'Logo-TESI.png'));

  const photoCandidates = [k.foto_institucional, k.foto_alumno, k.fotografia].filter(Boolean);
  let url_foto = null;
  for (const p of photoCandidates) {
    url_foto = imageToBase64(p);
    if (url_foto) break;
  }

  let url_qr = null;
  if (k.url_qr) url_qr = imageToBase64(k.url_qr);

  const templatePath = path.join(TEMPLATES_DIR, 'kardexPDF.hbs');
  const templateSource = fs.readFileSync(templatePath, 'utf8');
  const template = Handlebars.compile(templateSource);

  const alumno = {
    nombre_completo: nombreCompleto,
    matricula: k.matricula || '',
    curp: k.curp || '—',
    carrera: k.nombre_carrera || '—',
    semestre: String(k.semestre_actual || '—'),
    promedio,
    creditos_cubiertos: String(creditosCubiertos),
    estatus: k.estatus || 'Vigente'
  };

  const hRows = historial.map(h => ({
    periodo: h.nombre_periodo || '—',
    clave: h.clave_materia || '—',
    materia: h.nombre_materia || '—',
    calificacion: h.calificacion != null ? h.calificacion.toFixed(1) : '—',
    creditos: h.creditos || h.creditos_materia || 0,
    estado: h.estado || '—'
  }));

  const html = template({
    folio,
    fecha_emision: formatFechaMX(new Date()),
    zona_horaria: tz.zona_horaria,
    logo_tecnm,
    logo_tesi,
    alumno,
    url_foto,
    url_qr,
    firma_hash: firmaHash.substring(0, 48) + '…',
    sellos,
    historial: hRows
  });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      margin: { top: '30px', right: '40px', bottom: '30px', left: '40px' },
      printBackground: true,
      preferCSSPageSize: true
    });
    return { pdfBuffer, folio };
  } finally {
    await browser.close();
  }
}

async function generateKardexExcel(id) {
  const k = await getKardexData(id);
  if (!k) throw new Error('Kardex no encontrado');

  const folio = k.folio_kardex || generarFolio();
  const tz = getTzInfo();
  const nombreCompleto = `${k.nombres || ''} ${k.apellido_paterno || ''} ${k.apellido_materno || ''}`.replace(/\s+/g, ' ').trim();
  const creditosCubiertos = Number(k.creditos_acumulados || 0);
  const promedio = Number(k.promedio_general || 0).toFixed(2);
  const historial = await getHistorial(k.id_alumno);
  const sellosDB = await getSellos();
  const sellos = (sellosDB && sellosDB.length > 0) ? sellosDB : [
    { titulo: 'Sello SIVACAD', descripcion: 'Sello oficial del SIVACAD' },
    { titulo: 'Sello División ISC', descripcion: 'Sello de la División ISC' },
    { titulo: 'Sello Control Escolar', descripcion: 'Sello oficial de Control Escolar' },
  ];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIVACAD';
  workbook.created = new Date();
  workbook.title = 'KARDEX DEL ALUMNO';
  workbook.subject = `Kardex - ${nombreCompleto}`;

  const logo_tecnm_path = path.join(ASSETS_DIR, 'Logo-TecNM.png');
  const logo_tesi_path = path.join(ASSETS_DIR, 'Logo-TESI.png');

  function addLogo(sheet, filePath, col, row, w, h) {
    if (fs.existsSync(filePath)) {
      try {
        const id = workbook.addImage(filePath);
        sheet.addImage(id, { tl: { col, row }, ext: { width: w, height: h } });
      } catch (e) { /* skip */ }
    }
  }

  // ========================
  // HOJA 1: RESUMEN KARDEX
  // ========================
  const ws1 = workbook.addWorksheet('Kardex del Alumno');
  ws1.headerFooter.oddHeader = '&C&"Arial"&8 SIVACAD - Kardex del Alumno';
  ws1.headerFooter.oddFooter = `&L${formatFechaMX(new Date())}&CFolio: ${folio}&R${tz.zona_horaria}`;

  const colWidths = [3, 22, 55, 15, 15, 15, 15, 15, 15];
  colWidths.forEach((w, i) => { ws1.getColumn(i + 1).width = w; });
  ws1.views = [{ showGridLines: false }];

  addLogo(ws1, logo_tecnm_path, 0.2, 0, 70, 35);
  addLogo(ws1, logo_tesi_path, 6.8, 0, 70, 35);

  ws1.mergeCells('A3:I3');
  const titleCell = ws1.getCell('A3');
  titleCell.value = 'KARDEX DEL ALUMNO';
  titleCell.font = { bold: true, size: 16, color: { argb: 'FF0F172A' }, name: 'Arial' };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(3).height = 28;

  ws1.mergeCells('A4:I4');
  const subCell = ws1.getCell('A4');
  subCell.value = `SISTEMA INTEGRAL DE VALIDACIÓN Y CONTROL ACADÉMICO`;
  subCell.font = { size: 10, color: { argb: 'FF1E40AF' }, name: 'Arial', bold: true };
  subCell.alignment = { horizontal: 'center' };

  ws1.mergeCells('A5:I5');
  const metaCell = ws1.getCell('A5');
  metaCell.value = `Folio: ${folio}  |  Emitido: ${formatFechaMX(new Date()).split(',')[0]}  |  Zona horaria: ${tz.zona_horaria}`;
  metaCell.font = { size: 8, color: { argb: 'FF475569' }, name: 'Arial' };
  metaCell.alignment = { horizontal: 'center' };

  ws1.mergeCells('A7:I7');
  const datTitle = ws1.getCell('A7');
  datTitle.value = 'DATOS DEL ALUMNO';
  datTitle.font = { bold: true, size: 12, color: { argb: 'FF1E40AF' }, name: 'Arial' };
  datTitle.alignment = { horizontal: 'left' };

  const datFields = [
    ['Nombre Completo:', nombreCompleto],
    ['Matrícula:', k.matricula],
    ['CURP:', k.curp || '—'],
    ['Carrera:', k.nombre_carrera || '—'],
    ['Semestre:', String(k.semestre_actual || '—')],
    ['Promedio:', promedio],
    ['Créditos cubiertos:', String(creditosCubiertos)],
    ['Estatus:', k.estatus || 'Vigente']
  ];

  let r = 9;
  datFields.forEach(([label, value]) => {
    const lc = ws1.getCell(`B${r}`);
    lc.value = label;
    lc.font = { bold: true, size: 10, color: { argb: 'FF0F172A' }, name: 'Arial' };
    lc.alignment = { vertical: 'middle' };

    const vc = ws1.getCell(`C${r}`);
    vc.value = value;
    vc.font = { size: 10, color: { argb: 'FF334155' }, name: 'Arial' };
    vc.alignment = { vertical: 'middle' };

    ws1.getRow(r).height = 18;
    r++;
  });

  r += 1;
  ws1.mergeCells(`A${r}:I${r}`);
  const sigaa = ws1.getCell(`A${r}`);
  sigaa.value = 'Si quieres visualizar o verificar qué materias acreditaste, estás en 2da oportunidad, si estás en recurse o te fuiste a materia especial, visita la plataforma oficial SIGAA (Sistema Integral de Gestión Académica y Administrativa) para más información. El link de la plataforma oficial es el siguiente: https://sigaa.tesi.org.mx/index.php';
  sigaa.font = { size: 8, color: { argb: 'FF475569' }, name: 'Arial' };
  sigaa.alignment = { wrapText: true, vertical: 'top' };
  ws1.getRow(r).height = 45;

  r += 2;
  if (sellos.length > 0) {
    ws1.mergeCells(`A${r}:I${r}`);
    ws1.getCell(`A${r}`).value = 'SELLOS INSTITUCIONALES';
    ws1.getCell(`A${r}`).font = { bold: true, size: 10, color: { argb: 'FF0F172A' }, name: 'Arial' };
    r++;
    sellos.slice(0, 3).forEach(s => {
      ws1.getCell(`B${r}`).value = s.titulo;
      ws1.getCell(`B${r}`).font = { bold: true, size: 9, color: { argb: 'FF0F172A' }, name: 'Arial' };
      ws1.mergeCells(`C${r}:E${r}`);
      ws1.getCell(`C${r}`).value = s.descripcion || '';
      ws1.getCell(`C${r}`).font = { size: 8, color: { argb: 'FF64748B' }, name: 'Arial' };
      ws1.getRow(r).height = 20;
      r++;
    });
  }

  r += 2;
  ws1.mergeCells(`A${r}:I${r}`);
  const footer = ws1.getCell(`A${r}`);
  footer.value = `Documento generado electrónicamente el ${formatFechaMX(new Date())}  |  Folio: ${folio}  |  Zona horaria: ${tz.zona_horaria}  |  SIVACAD`;
  footer.font = { size: 7, color: { argb: 'FF94A3B8' }, name: 'Arial' };
  footer.alignment = { horizontal: 'center' };

  // ========================
  // HOJA 2: MATERIAS
  // ========================
  const ws2 = workbook.addWorksheet('Materias');
  ws2.headerFooter.oddHeader = '&C&"Arial"&8 SIVACAD - Detalle Académico';
  ws2.headerFooter.oddFooter = `&L${formatFechaMX(new Date())}&CFolio: ${folio}&R${tz.zona_horaria}`;

  ws2.columns = [
    { width: 6 }, { width: 18 }, { width: 14 }, { width: 42 }, { width: 14 }, { width: 12 }, { width: 16 }
  ];

  ws2.mergeCells('A1:G1');
  ws2.getCell('A1').value = 'DETALLE ACADÉMICO';
  ws2.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF0F172A' }, name: 'Arial' };
  ws2.getCell('A1').alignment = { horizontal: 'center' };
  ws2.getRow(1).height = 24;

  ws2.mergeCells('A2:G2');
  ws2.getCell('A2').value = `${nombreCompleto}  |  Matrícula: ${k.matricula}  |  Folio: ${folio}`;
  ws2.getCell('A2').font = { size: 9, color: { argb: 'FF475569' }, name: 'Arial' };
  ws2.getCell('A2').alignment = { horizontal: 'center' };

  const headers = ['', 'Período', 'Clave', 'Materia', 'Calificación', 'Créditos', 'Estado'];
  const headerRow = ws2.getRow(4);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };
  });
  ws2.getRow(4).height = 22;

  if (historial.length === 0) {
    ws2.mergeCells('A5:G5');
    ws2.getCell('A5').value = 'No se encontraron materias registradas en el historial académico.';
    ws2.getCell('A5').font = { size: 10, color: { argb: 'FF94A3B8' }, name: 'Arial', italic: true };
    ws2.getCell('A5').alignment = { horizontal: 'center' };
  } else {
    let dr = 5;
    historial.forEach(h => {
      ws2.getCell(`A${dr}`).value = '';
      ws2.getCell(`B${dr}`).value = h.nombre_periodo || '—';
      ws2.getCell(`C${dr}`).value = h.clave_materia || '—';
      ws2.getCell(`D${dr}`).value = h.nombre_materia || '—';
      ws2.getCell(`E${dr}`).value = h.calificacion != null ? h.calificacion.toFixed(1) : '—';
      ws2.getCell(`F${dr}`).value = h.creditos || h.creditos_materia || 0;
      ws2.getCell(`G${dr}`).value = h.estado || '—';

      const estadoColor = h.estado === 'Acreditada' ? 'FF16A34A' : h.estado === 'No Acreditada' ? 'FFDC2626' : h.estado === 'Cursando' ? 'FFCA8A04' : 'FF64748B';

      for (let c = 1; c <= 7; c++) {
        const cell = ws2.getCell(dr, c);
        cell.font = { size: 9, color: { argb: c === 7 ? estadoColor : 'FF334155' }, name: 'Arial', bold: c === 7 && h.estado === 'Acreditada' };
        cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'center' };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
        if (dr % 2 === 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        }
      }
      ws2.getRow(dr).height = 20;
      dr++;
    });
  }

  // Print settings
  ws2.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
    margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 }
  };

  return { workbook, folio };
}

module.exports = { generateKardexPDF, generateKardexExcel };