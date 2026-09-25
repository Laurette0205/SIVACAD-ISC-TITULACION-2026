'use strict';

// backend/src/services/academicPDFService.js
// SERVICIO UNIFICADO DE GENERACIÓN PDF ACADÉMICO — SIVACAD-ISC
// 8 documentos PDF profesionales con PDFKit.
// FASE 2-9: Arquitectura + Implementación completa

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const pool = require('../config/db');

// ==============================
// SERVICIO ÚNICO DE CALIFICACIONES
// ==============================
// REGLA: Una calificación almacenada en SIVACAD debe producir
//        el mismo resultado en WEB, EXCEL, PDF y KARDEX.
const {
  roundGrade,
  calculateAverage,
  formatGrade: _formatGradeBase,
  calcularEstadoAcademico,
  calcularEstadoSimple,
  PASSING_GRADE,
  ESTADO_ACADEMICO,
  contarAprobacion,
  promedioGeneral: _promedioGeneral,
  porcentajeAprobacion: _porcentajeAprobacion
} = require('./academicGradeService');

// formatGrade con default '—' para PDF (vs '-' para Excel)
function formatGrade(val) {
  return _formatGradeBase(val, '—');
}

// Wrapper para calcularEstado que acepta objeto completo de kardex
function calcularEstado(m) {
  return calcularEstadoAcademico(m);
}

// ==============================
// DIRECTORIO DE SALIDA
// ==============================
const REPORT_DIR = path.join(__dirname, '..', '..', 'uploads', 'reportes');
if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

// ==============================
// CONSTANTES INSTITUCIONALES
// ==============================
// ==============================
// CONSTANTES APA — Fuente única: exportStandards
// ==============================
const { APA } = require('../helpers/exportStandards');

const INST = {
  nombre: 'TECNOLÓGICO DE ESTUDIOS SUPERIORES DE IXTAPALUCA (TESI)',
  carrera: 'Ingeniería en Sistemas Computacionales',
  sistema: 'SIVACAD — Sistema Integral de Validación y Control Académico',
  version: 'SIVACAD-ISC v3.0',
  azul: '#1E40AF',
  azulClaro: '#DBEAFE',
  azulOscuro: '#1E3A5F',
  gris: '#64748B',
  grisClaro: '#94A3B8',
  grisFondo: '#F8FAFC',
  negro: '#0F172A',
  blanco: '#FFFFFF',
  verde: '#059669',
  verdeFondo: '#D1FAE5',
  rojo: '#DC2626',
  rojoFondo: '#FEE2E2',
  amarillo: '#D97706',
  amarilloFondo: '#FEF3C7',
  borde: '#E2E8F0',
  bordeOscuro: '#CBD5E1'
};

const ESTADO_COLORES = {
  [ESTADO_ACADEMICO.ACREDITADA]: { text: INST.verde, bg: INST.verdeFondo },
  [ESTADO_ACADEMICO.NO_ACREDITADA]: { text: INST.rojo, bg: INST.rojoFondo },
  [ESTADO_ACADEMICO.PENDIENTE]: { text: INST.amarillo, bg: INST.amarilloFondo },
  [ESTADO_ACADEMICO.SIN_CALIFICACION]: { text: INST.gris, bg: '#F1F5F9' },
  [ESTADO_ACADEMICO.BORRADOR]: { text: INST.amarillo, bg: INST.amarilloFondo },
  [ESTADO_ACADEMICO.VALIDADA]: { text: INST.azul, bg: INST.azulClaro },
  'PUBLICADA': { text: INST.verde, bg: INST.verdeFondo },
  'BORRADOR': { text: INST.amarillo, bg: INST.amarilloFondo },
  'VALIDADA': { text: INST.azul, bg: INST.azulClaro },
  'CERRADA': { text: INST.gris, bg: '#F1F5F9' }
};

// ==============================
// HELPERS PDF (solo formato, sin cálculos)
// ==============================

function formatFechaMX(date) {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleDateString('es-MX', {
      year: 'numeric', month: 'long', day: 'numeric',
      timeZone: 'America/Mexico_City'
    });
  } catch (_) { return String(date); }
}

function formatDateTimeMX(date) {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleString('es-MX', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      timeZone: 'America/Mexico_City'
    });
  } catch (_) { return String(date); }
}

function generarFolio(prefix = 'PDF') {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

function resolveLogoPath() {
  const candidates = [
    'uploads/logos/Logo-TESI.png',
    'uploads/logos/Logo-TESI.jpg',
    'uploads/logos/Logo-TESI.jpeg',
    path.join(__dirname, '..', '..', '..', 'frontend', 'src', 'assets', 'Logo-TESI.png'),
    path.join(__dirname, '..', '..', '..', 'frontend', 'src', 'assets', 'Logo-TecNM.png')
  ];
  for (const c of candidates) {
    try {
      const full = path.resolve(c);
      if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
    } catch (_) {}
  }
  return null;
}

function resolveSelloPath() {
  const candidates = [
    'uploads/logos/Sello-SIVACAD.jpeg',
    'uploads/logos/Sello-SIVACAD.jpg',
    path.join(__dirname, '..', '..', '..', 'frontend', 'src', 'assets', 'Sello-SIVACAD.jpeg')
  ];
  for (const c of candidates) {
    try {
      const full = path.resolve(c);
      if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
    } catch (_) {}
  }
  return null;
}

function drawLogo(doc, logoPath, x, y, w, h) {
  if (!logoPath) return;
  try {
    const buf = fs.readFileSync(logoPath);
    doc.image(buf, x, y, { fit: [w, h], align: 'center', valign: 'center' });
  } catch (_) {}
}

function drawInstitutionalHeader(doc, title, subtitle, opts = {}) {
  const pageW = doc.page.width;
  const margin = doc.page.margins.left;
  const contentW = pageW - margin * 2;
  const logoPath = opts.logoPath || resolveLogoPath();
  const selloPath = opts.selloPath || resolveSelloPath();

  // Logo izquierdo
  if (logoPath) drawLogo(doc, logoPath, margin, 28, 56, 40);

  // Logo derecho (sello)
  if (selloPath) drawLogo(doc, selloPath, pageW - margin - 56, 28, 56, 40);

  // Línea superior azul
  doc.save().moveTo(margin, 24).lineTo(pageW - margin, 24).lineWidth(2.5).strokeColor(INST.azul).stroke().restore();

  // Nombre institución
  doc.fillColor(INST.azul).font('Helvetica-Bold').fontSize(11)
    .text(INST.nombre, margin, 32, { width: contentW, align: 'center' });

  // Carrera
  doc.fillColor(INST.gris).font('Helvetica').fontSize(9)
    .text(INST.carrera, margin, 46, { width: contentW, align: 'center' });

  // Título del documento
  doc.fillColor(INST.azul).font('Helvetica-Bold').fontSize(14)
    .text(title, margin, 62, { width: contentW, align: 'center' });

  // Subtítulo
  if (subtitle) {
    doc.fillColor(INST.gris).font('Helvetica').fontSize(9)
      .text(subtitle, margin, 78, { width: contentW, align: 'center' });
  }

  // Línea separadora
  doc.save().moveTo(margin, 90).lineTo(pageW - margin, 90).lineWidth(1).strokeColor(INST.borde).stroke().restore();

  doc.y = 100;
}

function drawFooter(doc, folio, pageNumber, totalPages) {
  const pageW = doc.page.width;
  const margin = doc.page.margins.left;
  const footerY = doc.page.height - 38;

  doc.save().moveTo(margin, footerY).lineTo(pageW - margin, footerY).lineWidth(0.5).strokeColor(INST.borde).stroke().restore();

  doc.fillColor(INST.grisClaro).font('Helvetica').fontSize(7.5)
    .text(
      `${INST.version} • Folio: ${folio} • ${formatDateTimeMX(new Date())} • Página ${pageNumber}${totalPages ? ` de ${totalPages}` : ''}`,
      margin, footerY + 6,
      // height evita que PDFKit salte de página: y cae fuera del área
      // imprimible (debajo del margen inferior APA de 72pt).
      { width: pageW - margin * 2, align: 'center', height: doc.page.height - footerY }
    );
}

function drawInfoGrid(doc, items, startY) {
  const margin = doc.page.margins.left;
  const contentW = doc.page.width - margin * 2;
  const colW = contentW / 4;
  const cols = 4;
  const rows = Math.ceil(items.length / cols);
  const cellPad = 14;

  doc.font('Helvetica').fontSize(8);
  const lineH = doc.currentLineHeight();

  // Medir la altura necesaria de cada fila (los valores largos como
  // "Carrera" se ajustan a 2 líneas y desbordaban la fila fija de 18pt).
  const rowHeights = [];
  for (let r = 0; r < rows; r++) {
    let maxLines = 1;
    for (let c = 0; c < cols; c++) {
      const item = items[r * cols + c];
      if (!item) continue;
      const label = item.label + ': ';
      const valW = Math.max(colW - doc.widthOfString(label) - cellPad, 20);
      const h = doc.heightOfString(String(item.value || '—'), { width: valW });
      maxLines = Math.max(maxLines, Math.ceil(h / lineH));
    }
    rowHeights.push(maxLines * lineH + 4);
  }
  const totalH = rowHeights.reduce((s, h) => s + h, 0);
  const y = startY;

  // Fondo
  doc.save()
    .roundedRect(margin, y - 4, contentW, totalH + 8, 4)
    .fill(INST.grisFondo)
    .restore();

  let cy = y;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx >= items.length) break;
      const cx = margin + c * colW + 8;
      const label = items[idx].label + ':';

      doc.fillColor(INST.azul).font('Helvetica-Bold').fontSize(8)
        .text(label, cx, cy, { width: colW - 10, continued: false });
      const labelW = doc.widthOfString(label + ' ');
      doc.fillColor(INST.negro).font('Helvetica').fontSize(8)
        .text(items[idx].value || '—', cx + labelW + 2, cy, {
          width: Math.max(colW - labelW - cellPad, 20)
        });
    }
    cy += rowHeights[r];
  }

  doc.y = y + totalH + 10;
}

function drawTable(doc, headers, rows, startY, opts = {}) {
  const margin = doc.page.margins.left;
  const contentW = doc.page.width - margin * 2;
  let colWidths = opts.colWidths || headers.map(() => contentW / headers.length);
  // Normalizar anchos al ancho disponible (márgenes APA) para que ninguna
  // columna (p.ej. "Estado") quede fuera de la tabla / fuera de márgenes.
  const widthsSum = colWidths.reduce((s, w) => s + w, 0);
  if (widthsSum > 0 && Math.abs(widthsSum - contentW) > 0.5) {
    const k = contentW / widthsSum;
    colWidths = colWidths.map(w => w * k);
  }
  const headerH = opts.headerHeight || 20;
  const rowH = opts.rowHeight || 16;
  const fontSize = opts.fontSize || 8;

  let y = startY;

  // Header
  doc.save()
    .roundedRect(margin, y, contentW, headerH, 0)
    .fill(INST.azul)
    .restore();

  let hx = margin;
  for (let i = 0; i < headers.length; i++) {
    doc.fillColor(INST.blanco).font('Helvetica-Bold').fontSize(fontSize)
      .text(headers[i], hx + 4, y + 5, { width: colWidths[i] - 8, align: 'center' });
    hx += colWidths[i];
  }
  y += headerH;

  // Rows
  for (let r = 0; r < rows.length; r++) {
    if (y + rowH > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
      // Re-draw header on new page
      doc.save().roundedRect(margin, y, contentW, headerH, 0).fill(INST.azul).restore();
      hx = margin;
      for (let i = 0; i < headers.length; i++) {
        doc.fillColor(INST.blanco).font('Helvetica-Bold').fontSize(fontSize)
          .text(headers[i], hx + 4, y + 5, { width: colWidths[i] - 8, align: 'center' });
        hx += colWidths[i];
      }
      y += headerH;
    }

    const bgColor = r % 2 === 0 ? INST.blanco : '#F8FAFC';
    doc.save().rect(margin, y, contentW, rowH).fill(bgColor).restore();

    let rx = margin;
    for (let c = 0; c < rows[r].length; c++) {
      const cell = rows[r][c];
      const text = typeof cell === 'object' && cell !== null ? (cell.text || '—') : String(cell ?? '—');
      const color = typeof cell === 'object' && cell !== null ? (cell.color || INST.negro) : INST.negro;
      const bold = typeof cell === 'object' && cell !== null ? !!cell.bold : false;

      doc.fillColor(color).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize)
        .text(text, rx + 4, y + 3, { width: colWidths[c] - 8, align: c === 0 ? 'left' : 'center' });
      rx += colWidths[c];
    }
    y += rowH;
  }

  doc.y = y + 4;
  return y;
}

function drawSectionTitle(doc, title, y) {
  const margin = doc.page.margins.left;
  const contentW = doc.page.width - margin * 2;

  doc.fillColor(INST.azul).font('Helvetica-Bold').fontSize(11)
    .text(title, margin, y, { width: contentW });

  doc.save()
    .moveTo(margin, y + 14)
    .lineTo(margin + contentW, y + 14)
    .lineWidth(1.5)
    .strokeColor(INST.azulClaro)
    .stroke()
    .restore();

  doc.y = y + 20;
}

function drawNote(doc, text, y, type = 'info') {
  const margin = doc.page.margins.left;
  const contentW = doc.page.width - margin * 2;

  const colors = {
    info: { bg: INST.azulClaro, border: INST.azul, text: INST.azulOscuro },
    warning: { bg: INST.amarilloFondo, border: INST.amarillo, text: '#92400E' },
    error: { bg: INST.rojoFondo, border: INST.rojo, text: INST.rojo }
  };
  const c = colors[type] || colors.info;

  doc.save()
    .roundedRect(margin, y, contentW, 28, 4)
    .fill(c.bg)
    .lineWidth(0.5).strokeColor(c.border).stroke()
    .restore();

  doc.fillColor(c.text).font('Helvetica').fontSize(8)
    .text(text, margin + 8, y + 8, { width: contentW - 16 });

  doc.y = y + 34;
}

function drawSignatureLines(doc, labels, y) {
  const margin = doc.page.margins.left;
  const contentW = doc.page.width - margin * 2;
  const colW = contentW / labels.length;

  for (let i = 0; i < labels.length; i++) {
    const cx = margin + i * colW + colW / 2;
    doc.save()
      .moveTo(cx - 60, y)
      .lineTo(cx + 60, y)
      .lineWidth(1)
      .strokeColor(INST.negro)
      .stroke()
      .restore();

    doc.fillColor(INST.negro).font('Helvetica').fontSize(8)
      .text(labels[i], cx - 60, y + 4, { width: 120, align: 'center' });
  }

  doc.y = y + 20;
}

// ==============================
// 1. PREBOLETA PDF
// ==============================
async function generarPreboletaPDF(idAlumno, idPeriodo) {
  const [alumnoRows] = await pool.execute(
    `SELECT a.*, c.nombre_carrera, pe.nombre_plan, pe.version_plan,
            k.promedio_general, k.creditos_acumulados
     FROM alumnos a
     INNER JOIN carreras c ON c.id_carrera = a.id_carrera
     LEFT JOIN planes_estudio pe ON pe.id_plan = a.id_plan
     LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
     WHERE a.id_alumno = ? LIMIT 1`, [idAlumno]
  );
  if (!alumnoRows.length) throw new Error('Alumno no encontrado');
  const al = alumnoRows[0];

  const [materias] = await pool.execute(
    `SELECT h.*, m.nombre_materia, m.clave_materia, m.creditos,
            g.nombre_grupo, g.turno, p.nombre_periodo,
            CONCAT(du.apellido_paterno, ' ', du.apellido_materno, ' ', du.nombres) AS nombre_docente
     FROM kardex_historial_academico h
     INNER JOIN materias m ON m.id_materia = h.id_materia
     INNER JOIN grupos g ON g.id_grupo = h.id_grupo
     INNER JOIN periodos p ON p.id_periodo = h.id_periodo
     LEFT JOIN cargas_academicas ca ON ca.id_grupo = h.id_grupo AND ca.id_periodo = h.id_periodo AND ca.id_materia = h.id_materia
     LEFT JOIN docentes dn ON dn.id_docente = ca.id_docente
     LEFT JOIN usuarios du ON du.id_usuario = dn.id_usuario
     WHERE h.id_alumno = ? AND h.id_periodo = ?
     ORDER BY m.semestre_sugerido, m.nombre_materia`, [idAlumno, idPeriodo]
  );

  const nombreCompleto = `${al.apellido_paterno || ''} ${al.apellido_materno || ''} ${al.nombres || ''}`.replace(/\s+/g, ' ').trim();
  const folio = generarFolio('PRE');
  const grupo = materias[0] || {};

  const fileName = `preboleta_${idAlumno}_${folio}.pdf`;
  const filePath = path.join(REPORT_DIR, fileName);

  const doc = new PDFDocument({ size: 'LETTER', orientation: 'landscape', margin: APA.MARGIN_PT, bufferPages: true });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  drawInstitutionalHeader(doc, 'PREBOLETA DE CALIFICACIONES', 'Documento Preliminar — No Válido como Boleta Oficial');

  // Info del alumno
  drawInfoGrid(doc, [
    { label: 'Alumno', value: nombreCompleto },
    { label: 'Matrícula', value: al.matricula },
    { label: 'Carrera', value: al.nombre_carrera },
    { label: 'Plan', value: `${al.nombre_plan || '—'} ${al.version_plan || ''}` },
    { label: 'Semestre', value: al.semestre_actual || '—' },
    { label: 'Grupo', value: grupo.nombre_grupo || '—' },
    { label: 'Turno', value: grupo.turno || '—' },
    { label: 'Periodo', value: grupo.nombre_periodo || '—' }
  ], doc.y);

  // Tabla de calificaciones
  const headers = ['#', 'Materia', 'Docente', 'P1', 'P2', 'P3', 'Promedio', 'Estado'];
  const colWidths = [24, 160, 130, 50, 50, 50, 60, 80];

  const rows = materias.map((m, i) => {
    const estado = calcularEstado(m);
    const ec = ESTADO_COLORES[estado] || { text: INST.negro };
    return [
      String(i + 1),
      m.nombre_materia,
      m.nombre_docente || '—',
      formatGrade(m.parcial_1),
      formatGrade(m.parcial_2),
      formatGrade(m.parcial_3),
      formatGrade(calculateAverage(m.parcial_1, m.parcial_2, m.parcial_3)),
      { text: estado, color: ec.text, bold: true }
    ];
  });

  drawTable(doc, headers, rows, doc.y, { colWidths, fontSize: 8, rowHeight: 18 });

  // Resumen
  const fins = materias.filter(m => m.calificacion_final != null).map(m => parseFloat(m.calificacion_final));
  const promedioGeneral = fins.length > 0 ? roundGrade(fins.reduce((s, v) => s + v, 0) / fins.length) : null;
  const aprobadas = fins.filter(v => v >= PASSING_GRADE).length;
  const noAcreditadas = fins.filter(v => v < PASSING_GRADE).length;

  drawSectionTitle(doc, 'Resumen', doc.y + 4);
  drawInfoGrid(doc, [
    { label: 'Total Materias', value: String(materias.length) },
    { label: 'Promedio General', value: promedioGeneral != null ? promedioGeneral.toFixed(2) : '—' },
    { label: 'Aprobadas', value: String(aprobadas) },
    { label: 'No Acreditadas', value: String(noAcreditadas) }
  ], doc.y);

  drawNote(doc, 'Nota: Este documento es una preboleta (preliminar) y no sustituye la boleta oficial de calificaciones.', doc.y);

  // Footer en todas las páginas
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    drawFooter(doc, folio, i + 1, range.count);
  }

  doc.end();
  await new Promise((resolve, reject) => { stream.on('finish', resolve); stream.on('error', reject); });

  return { filePath, fileName, folio, totalMaterias: materias.length };
}

// ==============================
// 2. BOLETA PDF
// ==============================
async function generarBoletaPDF(idAlumno, idPeriodo) {
  const [alumnoRows] = await pool.execute(
    `SELECT a.*, c.nombre_carrera, pe.nombre_plan, pe.version_plan,
            k.promedio_general, k.creditos_acumulados
     FROM alumnos a
     INNER JOIN carreras c ON c.id_carrera = a.id_carrera
     LEFT JOIN planes_estudio pe ON pe.id_plan = a.id_plan
     LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
     WHERE a.id_alumno = ? LIMIT 1`, [idAlumno]
  );
  if (!alumnoRows.length) throw new Error('Alumno no encontrado');
  const al = alumnoRows[0];

  let where = 'h.id_alumno = ? AND h.estado_calificacion = \'PUBLICADA\'';
  const params = [idAlumno];
  if (idPeriodo) { where += ' AND h.id_periodo = ?'; params.push(idPeriodo); }

  const [materias] = await pool.execute(
    `SELECT h.*, m.nombre_materia, m.clave_materia, m.creditos, m.semestre_sugerido,
            g.nombre_grupo, g.turno, p.nombre_periodo,
            CONCAT(du.apellido_paterno, ' ', du.apellido_materno, ' ', du.nombres) AS nombre_docente
     FROM kardex_historial_academico h
     INNER JOIN materias m ON m.id_materia = h.id_materia
     INNER JOIN grupos g ON g.id_grupo = h.id_grupo
     INNER JOIN periodos p ON p.id_periodo = h.id_periodo
     LEFT JOIN cargas_academicas ca ON ca.id_grupo = h.id_grupo AND ca.id_periodo = h.id_periodo AND ca.id_materia = h.id_materia
     LEFT JOIN docentes dn ON dn.id_docente = ca.id_docente
     LEFT JOIN usuarios du ON du.id_usuario = dn.id_usuario
     WHERE ${where}
     ORDER BY p.nombre_periodo, m.semestre_sugerido, m.nombre_materia`, params
  );

  const nombreCompleto = `${al.apellido_paterno || ''} ${al.apellido_materno || ''} ${al.nombres || ''}`.replace(/\s+/g, ' ').trim();
  const folio = generarFolio('BOL');

  const fileName = `boleta_${idAlumno}_${folio}.pdf`;
  const filePath = path.join(REPORT_DIR, fileName);

  const doc = new PDFDocument({ size: 'LETTER', margin: APA.MARGIN_PT, bufferPages: true });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  drawInstitutionalHeader(doc, 'BOLETA DE CALIFICACIONES', 'Documento Oficial de Calificaciones');

  // Datos del alumno (calculados desde las materias: fuente de verdad)
  const bolCreditos = materias.reduce((s, m) => s + (m.creditos || 0), 0);
  const bolFins = materias.filter(m => m.calificacion_final != null).map(m => parseFloat(m.calificacion_final));
  const bolProm = bolFins.length > 0 ? roundGrade(bolFins.reduce((s, v) => s + v, 0) / bolFins.length) : null;

  drawSectionTitle(doc, 'Datos del Alumno', doc.y);
  drawInfoGrid(doc, [
    { label: 'Nombre', value: nombreCompleto },
    { label: 'Matrícula', value: al.matricula },
    { label: 'Carrera', value: al.nombre_carrera },
    { label: 'Plan', value: `${al.nombre_plan || '—'} ${al.version_plan || ''}` },
    { label: 'Semestre', value: al.semestre_actual || '—' },
    { label: 'Créditos', value: String(bolCreditos) },
    { label: 'Promedio General', value: bolProm != null ? bolProm.toFixed(2) : '—' },
    { label: 'Estatus', value: al.estatus_academico || 'Regular' }
  ], doc.y);

  // Calificaciones por período
  const periodos = {};
  for (const m of materias) {
    const key = m.nombre_periodo || 'Sin período';
    if (!periodos[key]) periodos[key] = [];
    periodos[key].push(m);
  }

  const headers = ['#', 'Materia', 'Clave', 'P1', 'P2', 'P3', 'Promedio', 'Final', 'Estado'];
  const colWidths = [24, 150, 60, 42, 42, 42, 52, 52, 70];

  for (const [nombrePeriodo, mats] of Object.entries(periodos)) {
    if (doc.y > 620) { doc.addPage(); }

    drawSectionTitle(doc, `Periodo: ${nombrePeriodo}`, doc.y);

    const rows = mats.map((m, i) => {
      const estado = calcularEstado(m);
      const ec = ESTADO_COLORES[estado] || { text: INST.negro };
      return [
        String(i + 1),
        m.nombre_materia,
        m.clave_materia || '—',
        formatGrade(m.parcial_1),
        formatGrade(m.parcial_2),
        formatGrade(m.parcial_3),
        formatGrade(m.promedio_parciales != null ? m.promedio_parciales
          : calculateAverage(m.parcial_1, m.parcial_2, m.parcial_3)),
        formatGrade(m.calificacion_final),
        { text: estado, color: ec.text, bold: true }
      ];
    });

    drawTable(doc, headers, rows, doc.y, { colWidths, fontSize: 7.5, rowHeight: 16 });

    // Resumen del período
    const fins = mats.filter(m => m.calificacion_final != null).map(m => parseFloat(m.calificacion_final));
    const prom = fins.length > 0 ? roundGrade(fins.reduce((s, v) => s + v, 0) / fins.length) : null;
    const apr = fins.filter(v => v >= PASSING_GRADE).length;
    const noA = fins.filter(v => v < PASSING_GRADE).length;

    doc.fillColor(INST.azul).font('Helvetica-Bold').fontSize(8)
      .text(`Promedio: ${prom != null ? prom.toFixed(2) : '—'}  |  Aprobadas: ${apr}  |  No Acreditadas: ${noA}`, doc.page.margins.left, doc.y);
    doc.moveDown(0.5);
  }

  // Observaciones
  const totalNoAcreditadas = materias.filter(m => {
    const f = m.calificacion_final != null ? parseFloat(m.calificacion_final) : null;
    return f != null && f < PASSING_GRADE;
  }).length;

  if (doc.y > 660) { doc.addPage(); }
  drawSectionTitle(doc, 'Observaciones', doc.y);
  const obsText = totalNoAcreditadas > 0
    ? `El alumno tiene ${totalNoAcreditadas} materia(s) no acreditada(s). Regularización sujeta a disposiciones académicas institucionales.`
    : 'El alumno acreditó todas las materias del periodo.';
  doc.fillColor(INST.gris).font('Helvetica').fontSize(8.5)
    .text(obsText, doc.page.margins.left, doc.y, { width: doc.page.width - doc.page.margins.left * 2, align: 'justify' });
  doc.moveDown(1);

  // Firmas
  drawSignatureLines(doc, ['Jefe de Departamento', 'Director(a) Académico(a)', 'Coordinador(a) de Carrera'], doc.y + 10);

  // Nota al pie
  doc.moveDown(2);
  drawNote(doc, 'La boleta es un documento oficial de calificaciones del TESI. Las calificaciones aquí registradas son definitivas y forman parte del expediente académico del alumno.', doc.y);

  // Footer
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    drawFooter(doc, folio, i + 1, range.count);
  }

  doc.end();
  await new Promise((resolve, reject) => { stream.on('finish', resolve); stream.on('error', reject); });

  return { filePath, fileName, folio, totalMaterias: materias.length };
}

// ==============================
// 3. CALIFICACIONES POR PARCIAL (P1/P2/P3)
// ==============================
async function generarCalificacionesParcialPDF(idGrupo, idPeriodo, parcial) {
  if (![1, 2, 3].includes(parcial)) throw new Error('Parcial inválido (1-3)');

  const [grupoRows] = await pool.execute(
    `SELECT g.*, c.nombre_carrera FROM grupos g
     LEFT JOIN carreras c ON c.id_carrera = g.id_carrera
     WHERE g.id_grupo = ? LIMIT 1`, [idGrupo]
  );
  if (!grupoRows.length) throw new Error('Grupo no encontrado');
  const grupo = grupoRows[0];

  const [periodoRows] = await pool.execute(
    'SELECT * FROM periodos WHERE id_periodo = ? LIMIT 1', [idPeriodo]
  );
  const periodo = periodoRows[0] || {};

  const [materias] = await pool.execute(
    `SELECT DISTINCT m.id_materia, m.nombre_materia, m.clave_materia
     FROM cargas_academicas ca
     INNER JOIN materias m ON m.id_materia = ca.id_materia
     WHERE ca.id_grupo = ? AND ca.id_periodo = ? ORDER BY m.nombre_materia`,
    [idGrupo, idPeriodo]
  );

  const [alumnos] = await pool.execute(
    `SELECT a.id_alumno, a.matricula, a.apellido_paterno, a.apellido_materno, a.nombres
     FROM alumnos a
     INNER JOIN grupos_alumnos ga ON ga.id_alumno = a.id_alumno
     WHERE ga.id_grupo = ? AND ga.id_periodo = ? AND ga.estado = 'ACTIVO'
     ORDER BY a.apellido_paterno, a.apellido_materno, a.nombres`,
    [idGrupo, idPeriodo]
  );

  const parcialCol = `parcial_${parcial}`;
  const folio = generarFolio(`P${parcial}`);

  const fileName = `calificaciones_P${parcial}_${idGrupo}_${folio}.pdf`;
  const filePath = path.join(REPORT_DIR, fileName);

  const doc = new PDFDocument({ size: 'LETTER', margin: APA.MARGIN_PT, bufferPages: true });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  drawInstitutionalHeader(
    doc,
    `CALIFICACIONES — PARCIAL ${parcial}`,
    `${grupo.nombre_grupo} — ${periodo.nombre_periodo || '—'} — Turno: ${grupo.turno || '—'}`
  );

  // Por cada materia
  for (const mat of materias) {
    if (doc.y > 600) { doc.addPage(); }

    drawSectionTitle(doc, `${mat.nombre_materia} (${mat.clave_materia})`, doc.y);

    // Docente
    const [docenteRows] = await pool.execute(
      `SELECT CONCAT(du.apellido_paterno, ' ', du.apellido_materno, ' ', du.nombres) AS nombre_docente
       FROM cargas_academicas ca
       INNER JOIN docentes dn ON dn.id_docente = ca.id_docente
       LEFT JOIN usuarios du ON du.id_usuario = dn.id_usuario
       WHERE ca.id_grupo = ? AND ca.id_periodo = ? AND ca.id_materia = ? LIMIT 1`,
      [idGrupo, idPeriodo, mat.id_materia]
    );
    const docente = docenteRows[0]?.nombre_docente || '—';
    doc.fillColor(INST.gris).font('Helvetica').fontSize(8)
      .text(`Docente: ${docente}`, doc.page.margins.left, doc.y);
    doc.moveDown(0.3);

    // Calificaciones de esta materia
    const [cals] = await pool.execute(
      `SELECT h.*, CONCAT(a.apellido_paterno, ' ', a.apellido_materno, ' ', a.nombres) AS nombre_alumno, a.matricula
       FROM kardex_historial_academico h
       INNER JOIN alumnos a ON a.id_alumno = h.id_alumno
       WHERE h.id_grupo = ? AND h.id_materia = ? AND h.id_periodo = ?
       ORDER BY a.apellido_paterno, a.apellido_materno, a.nombres`,
      [idGrupo, mat.id_materia, idPeriodo]
    );

    const headers = ['#', 'Matrícula', 'Alumno', 'Calificación', 'Estado'];
    const colWidths = [30, 80, 200, 80, 80];

    const rows = cals.map((c, i) => {
      const cal = c[parcialCol];
      const estado = cal != null ? (parseFloat(cal) >= PASSING_GRADE ? 'Aprobado' : 'No Aprobado') : 'Sin calificar';
      const ec = ESTADO_COLORES[estado] || { text: INST.negro };
      return [
        String(i + 1),
        c.matricula,
        c.nombre_alumno,
        formatGrade(cal),
        { text: estado, color: ec.text, bold: true }
      ];
    });

    drawTable(doc, headers, rows, doc.y, { colWidths, fontSize: 8, rowHeight: 16 });
    doc.moveDown(0.5);
  }

  // Resumen general
  drawSectionTitle(doc, 'Resumen del Parcial', doc.y);
  const totalAlumnos = alumnos.length;
  const totalMaterias = materias.length;
  const totalCalificados = totalAlumnos * totalMaterias;

  drawInfoGrid(doc, [
    { label: 'Parcial', value: String(parcial) },
    { label: 'Grupo', value: grupo.nombre_grupo },
    { label: 'Total Alumnos', value: String(totalAlumnos) },
    { label: 'Total Materias', value: String(totalMaterias) }
  ], doc.y);

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    drawFooter(doc, folio, i + 1, range.count);
  }

  doc.end();
  await new Promise((resolve, reject) => { stream.on('finish', resolve); stream.on('error', reject); });

  return { filePath, fileName, folio, totalAlumnos, totalMaterias };
}

// ==============================
// 4. CALIFICACIONES POR PERÍODO
// ==============================
async function generarCalificacionesPeriodoPDF(idGrupo, idPeriodo) {
  const [grupoRows] = await pool.execute(
    `SELECT g.*, c.nombre_carrera FROM grupos g
     LEFT JOIN carreras c ON c.id_carrera = g.id_carrera
     WHERE g.id_grupo = ? LIMIT 1`, [idGrupo]
  );
  if (!grupoRows.length) throw new Error('Grupo no encontrado');
  const grupo = grupoRows[0];

  const [periodoRows] = await pool.execute(
    'SELECT * FROM periodos WHERE id_periodo = ? LIMIT 1', [idPeriodo]
  );
  const periodo = periodoRows[0] || {};

  const [alumnos] = await pool.execute(
    `SELECT a.id_alumno, a.matricula, a.apellido_paterno, a.apellido_materno, a.nombres
     FROM alumnos a
     INNER JOIN grupos_alumnos ga ON ga.id_alumno = a.id_alumno
     WHERE ga.id_grupo = ? AND ga.id_periodo = ? AND ga.estado = 'ACTIVO'
     ORDER BY a.apellido_paterno, a.apellido_materno, a.nombres`,
    [idGrupo, idPeriodo]
  );

  const [materias] = await pool.execute(
    `SELECT DISTINCT m.id_materia, m.nombre_materia, m.clave_materia
     FROM cargas_academicas ca
     INNER JOIN materias m ON m.id_materia = ca.id_materia
     WHERE ca.id_grupo = ? AND ca.id_periodo = ? ORDER BY m.nombre_materia`,
    [idGrupo, idPeriodo]
  );

  const [calificaciones] = await pool.execute(
    `SELECT * FROM kardex_historial_academico
     WHERE id_grupo = ? AND id_periodo = ?`, [idGrupo, idPeriodo]
  );

  const calMap = {};
  for (const c of calificaciones) calMap[`${c.id_alumno}_${c.id_materia}`] = c;

  const folio = generarFolio('PER');

  const fileName = `calificaciones_periodo_${idGrupo}_${folio}.pdf`;
  const filePath = path.join(REPORT_DIR, fileName);

  const doc = new PDFDocument({ size: 'LETTER', orientation: 'landscape', margin: APA.MARGIN_PT, bufferPages: true });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  drawInstitutionalHeader(
    doc,
    `CALIFICACIONES POR PERÍODO — ${grupo.nombre_grupo}`,
    `${periodo.nombre_periodo || '—'} — Carrera: ${grupo.nombre_carrera || '—'} — Turno: ${grupo.turno || '—'}`
  );

  // Tabla completa: Alumnos x Materias
  const headers = ['#', 'Matrícula', 'Alumno'];
  for (const m of materias) headers.push(m.nombre_materia.slice(0, 12));
  headers.push('Promedio');

  const baseColWidths = [24, 80, 140];
  const matColW = materias.length > 0 ? Math.max(45, (532 - 244) / materias.length) : 45;
  for (let i = 0; i < materias.length; i++) baseColWidths.push(matColW);
  baseColWidths.push(55);

  const rows = alumnos.map((al, i) => {
    const row = [String(i + 1), al.matricula, `${al.apellido_paterno} ${al.apellido_materno} ${al.nombres}`];
    const fines = [];
    for (const m of materias) {
      const cal = calMap[`${al.id_alumno}_${m.id_materia}`];
      const val = cal?.calificacion_final != null ? parseFloat(cal.calificacion_final) : null;
      row.push(formatGrade(val));
      if (val != null) fines.push(val);
    }
    const prom = fines.length > 0 ? roundGrade(fines.reduce((s, v) => s + v, 0) / fines.length) : null;
    row.push(formatGrade(prom));
    return row;
  });

  drawTable(doc, headers, rows, doc.y, { colWidths: baseColWidths, fontSize: 7, rowHeight: 14 });

  // Resumen por materia
  doc.moveDown(0.5);
  drawSectionTitle(doc, 'Estadísticas por Materia', doc.y);

  const statHeaders = ['Materia', 'Promedio', 'Aprobados', 'Reprobados', '% Aprobación'];
  const statColWidths = [180, 80, 80, 80, 80];
  const statRows = materias.map(m => {
    const vals = alumnos.map(al => {
      const cal = calMap[`${al.id_alumno}_${m.id_materia}`];
      return cal?.calificacion_final != null ? parseFloat(cal.calificacion_final) : null;
    }).filter(v => v != null);
    const avg = vals.length > 0 ? roundGrade(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
    const apr = vals.filter(v => v >= PASSING_GRADE).length;
    const rep = vals.filter(v => v < PASSING_GRADE).length;
    const pct = vals.length > 0 ? `${Math.round((apr / vals.length) * 100)}%` : '—';
    return [m.nombre_materia, formatGrade(avg), String(apr), String(rep), pct];
  });

  drawTable(doc, statHeaders, statRows, doc.y, { colWidths: statColWidths, fontSize: 8, rowHeight: 16 });

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    drawFooter(doc, folio, i + 1, range.count);
  }

  doc.end();
  await new Promise((resolve, reject) => { stream.on('finish', resolve); stream.on('error', reject); });

  return { filePath, fileName, folio, totalAlumnos: alumnos.length, totalMaterias: materias.length };
}

// ==============================
// 5. REPORTE INDIVIDUAL / HISTORIAL ACADÉMICO
// ==============================
async function generarHistorialPDF(idAlumno) {
  const [alumnoRows] = await pool.execute(
    `SELECT a.*, c.nombre_carrera, pe.nombre_plan, pe.version_plan,
            k.promedio_general, k.creditos_acumulados
     FROM alumnos a
     INNER JOIN carreras c ON c.id_carrera = a.id_carrera
     LEFT JOIN planes_estudio pe ON pe.id_plan = a.id_plan
     LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
     WHERE a.id_alumno = ? LIMIT 1`, [idAlumno]
  );
  if (!alumnoRows.length) throw new Error('Alumno no encontrado');
  const al = alumnoRows[0];

  const [materias] = await pool.execute(
    `SELECT h.*, m.nombre_materia, m.clave_materia, m.creditos, m.semestre_sugerido,
            p.nombre_periodo, g.nombre_grupo
     FROM kardex_historial_academico h
     INNER JOIN materias m ON m.id_materia = h.id_materia
     INNER JOIN periodos p ON p.id_periodo = h.id_periodo
     INNER JOIN grupos g ON g.id_grupo = h.id_grupo
     WHERE h.id_alumno = ? AND h.estado_calificacion = 'PUBLICADA'
     ORDER BY p.nombre_periodo, m.semestre_sugerido, m.nombre_materia`, [idAlumno]
  );

  const nombreCompleto = `${al.apellido_paterno || ''} ${al.apellido_materno || ''} ${al.nombres || ''}`.replace(/\s+/g, ' ').trim();
  const folio = generarFolio('HIST');

  const fileName = `historial_${idAlumno}_${folio}.pdf`;
  const filePath = path.join(REPORT_DIR, fileName);

  const doc = new PDFDocument({ size: 'LETTER', margin: APA.MARGIN_PT, bufferPages: true });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  drawInstitutionalHeader(doc, 'HISTORIAL ACADÉMICO', `${nombreCompleto} — Matrícula: ${al.matricula}`);

  // Datos del alumno (calculados desde las materias: fuente de verdad)
  const hisCreditos = materias.reduce((s, m) => s + (m.creditos || 0), 0);
  const hisFins = materias.filter(m => m.calificacion_final != null).map(m => parseFloat(m.calificacion_final));
  const hisProm = hisFins.length > 0 ? roundGrade(hisFins.reduce((s, v) => s + v, 0) / hisFins.length) : null;

  drawSectionTitle(doc, 'Datos del Alumno', doc.y);
  drawInfoGrid(doc, [
    { label: 'Nombre', value: nombreCompleto },
    { label: 'Matrícula', value: al.matricula },
    { label: 'Carrera', value: al.nombre_carrera },
    { label: 'Plan', value: `${al.nombre_plan || '—'} ${al.version_plan || ''}` },
    { label: 'Semestre Actual', value: al.semestre_actual || '—' },
    { label: 'Créditos', value: String(hisCreditos) },
    { label: 'Promedio General', value: hisProm != null ? hisProm.toFixed(2) : '—' },
    { label: 'Estatus', value: al.estatus_academico || 'Regular' }
  ], doc.y);

  // Agrupar por período
  const periodos = {};
  for (const m of materias) {
    const key = m.nombre_periodo || 'Sin período';
    if (!periodos[key]) periodos[key] = [];
    periodos[key].push(m);
  }

  const headers = ['#', 'Materia', 'Clave', 'Créditos', 'Semestre', 'Final', 'Estado'];
  const colWidths = [24, 180, 65, 50, 50, 52, 80];

  for (const [nombrePeriodo, mats] of Object.entries(periodos)) {
    if (doc.y > 620) { doc.addPage(); }

    drawSectionTitle(doc, `Periodo: ${nombrePeriodo}`, doc.y);

    const rows = mats.map((m, i) => {
      const estado = calcularEstado(m);
      const ec = ESTADO_COLORES[estado] || { text: INST.negro };
      return [
        String(i + 1),
        m.nombre_materia,
        m.clave_materia || '—',
        String(m.creditos || '—'),
        String(m.semestre_sugerido || '—'),
        formatGrade(m.calificacion_final),
        { text: estado, color: ec.text, bold: true }
      ];
    });

    drawTable(doc, headers, rows, doc.y, { colWidths, fontSize: 8, rowHeight: 16 });

    // Resumen del período
    const fins = mats.filter(m => m.calificacion_final != null).map(m => parseFloat(m.calificacion_final));
    const prom = fins.length > 0 ? roundGrade(fins.reduce((s, v) => s + v, 0) / fins.length) : null;
    const apr = fins.filter(v => v >= PASSING_GRADE).length;
    const noA = fins.filter(v => v < PASSING_GRADE).length;
    const creditos = mats.reduce((s, m) => s + (m.creditos || 0), 0);

    doc.fillColor(INST.azul).font('Helvetica-Bold').fontSize(8)
      .text(`Promedio: ${prom != null ? prom.toFixed(2) : '—'}  |  Aprobadas: ${apr}  |  No Acreditadas: ${noA}  |  Créditos: ${creditos}`, doc.page.margins.left, doc.y);
    doc.moveDown(0.5);
  }

  // Resumen global
  drawSectionTitle(doc, 'Resumen Global', doc.y);
  const totalCreditos = materias.reduce((s, m) => s + (m.creditos || 0), 0);
  const allFins = materias.filter(m => m.calificacion_final != null).map(m => parseFloat(m.calificacion_final));
  const promGeneral = allFins.length > 0 ? roundGrade(allFins.reduce((s, v) => s + v, 0) / allFins.length) : null;
  const totalApr = allFins.filter(v => v >= PASSING_GRADE).length;

  drawInfoGrid(doc, [
    { label: 'Total Materias', value: String(materias.length) },
    { label: 'Promedio General', value: promGeneral != null ? promGeneral.toFixed(2) : '—' },
    { label: 'Créditos Totales', value: String(totalCreditos) },
    { label: 'Materias Aprobadas', value: `${totalApr}/${allFins.length}` }
  ], doc.y);

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    drawFooter(doc, folio, i + 1, range.count);
  }

  doc.end();
  await new Promise((resolve, reject) => { stream.on('finish', resolve); stream.on('error', reject); });

  return { filePath, fileName, folio, totalMaterias: materias.length };
}

// ==============================
// 6. REPORTE POR GRUPO
// ==============================
async function generarReporteGrupoPDF(idGrupo, idPeriodo) {
  const [grupoRows] = await pool.execute(
    `SELECT g.*, c.nombre_carrera FROM grupos g
     LEFT JOIN carreras c ON c.id_carrera = g.id_carrera
     WHERE g.id_grupo = ? LIMIT 1`, [idGrupo]
  );
  if (!grupoRows.length) throw new Error('Grupo no encontrado');
  const grupo = grupoRows[0];

  const [periodoRows] = await pool.execute(
    'SELECT * FROM periodos WHERE id_periodo = ? LIMIT 1', [idPeriodo]
  );
  const periodo = periodoRows[0] || {};

  const [alumnos] = await pool.execute(
    `SELECT a.id_alumno, a.matricula, a.apellido_paterno, a.apellido_materno, a.nombres
     FROM alumnos a
     INNER JOIN grupos_alumnos ga ON ga.id_alumno = a.id_alumno
     WHERE ga.id_grupo = ? AND ga.id_periodo = ? AND ga.estado = 'ACTIVO'
     ORDER BY a.apellido_paterno, a.apellido_materno, a.nombres`,
    [idGrupo, idPeriodo]
  );

  const [materias] = await pool.execute(
    `SELECT ca.id_materia, m.nombre_materia, m.clave_materia,
            CONCAT(du.apellido_paterno, ' ', du.apellido_materno, ' ', du.nombres) AS nombre_docente
     FROM cargas_academicas ca
     INNER JOIN materias m ON m.id_materia = ca.id_materia
     LEFT JOIN docentes dn ON dn.id_docente = ca.id_docente
     LEFT JOIN usuarios du ON du.id_usuario = dn.id_usuario
     WHERE ca.id_grupo = ? AND ca.id_periodo = ? AND ca.estado = 'ACTIVA'
     ORDER BY m.nombre_materia`,
    [idGrupo, idPeriodo]
  );

  const folio = generarFolio('GRP');

  const fileName = `reporte_grupo_${idGrupo}_${folio}.pdf`;
  const filePath = path.join(REPORT_DIR, fileName);

  const doc = new PDFDocument({ size: 'LETTER', margin: APA.MARGIN_PT, bufferPages: true });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  drawInstitutionalHeader(
    doc,
    `REPORTE DE GRUPO — ${grupo.nombre_grupo}`,
    `${periodo.nombre_periodo || '—'} — Carrera: ${grupo.nombre_carrera || '—'} — Turno: ${grupo.turno || '—'}`
  );

  // Info general
  drawInfoGrid(doc, [
    { label: 'Grupo', value: grupo.nombre_grupo },
    { label: 'Semestre', value: String(grupo.semestre || '—') },
    { label: 'Turno', value: grupo.turno || '—' },
    { label: 'Carrera', value: grupo.nombre_carrera || '—' },
    { label: 'Periodo', value: periodo.nombre_periodo || '—' },
    { label: 'Total Alumnos', value: String(alumnos.length) },
    { label: 'Total Materias', value: String(materias.length) },
    { label: 'Ciclo Escolar', value: periodo.ciclo_escolar || '—' }
  ], doc.y);

  // Por cada materia
  for (const mat of materias) {
    if (doc.y > 580) { doc.addPage(); }

    drawSectionTitle(doc, `${mat.nombre_materia} (${mat.clave_materia})`, doc.y);
    doc.fillColor(INST.gris).font('Helvetica').fontSize(8)
      .text(`Docente: ${mat.nombre_docente || '—'}`, doc.page.margins.left, doc.y);
    doc.moveDown(0.3);

    const [cals] = await pool.execute(
      `SELECT h.*, CONCAT(a.apellido_paterno, ' ', a.apellido_materno, ' ', a.nombres) AS nombre_alumno, a.matricula
       FROM kardex_historial_academico h
       INNER JOIN alumnos a ON a.id_alumno = h.id_alumno
       WHERE h.id_grupo = ? AND h.id_materia = ? AND h.id_periodo = ?
       ORDER BY a.apellido_paterno, a.apellido_materno, a.nombres`,
      [idGrupo, mat.id_materia, idPeriodo]
    );

    const headers = ['#', 'Matrícula', 'Alumno', 'P1', 'P2', 'P3', 'Promedio', 'Final', 'Estado'];
    const colWidths = [24, 70, 150, 38, 38, 38, 50, 50, 65];

    const rows = cals.map((c, i) => {
      const estado = calcularEstado(c);
      const ec = ESTADO_COLORES[estado] || { text: INST.negro };
      return [
        String(i + 1),
        c.matricula,
        c.nombre_alumno,
        formatGrade(c.parcial_1),
        formatGrade(c.parcial_2),
        formatGrade(c.parcial_3),
        formatGrade(c.promedio_parciales),
        formatGrade(c.calificacion_final),
        { text: estado, color: ec.text, bold: true }
      ];
    });

    drawTable(doc, headers, rows, doc.y, { colWidths, fontSize: 7.5, rowHeight: 15 });

    // Estadísticas de la materia
    const vals = cals.filter(c => c.calificacion_final != null).map(c => parseFloat(c.calificacion_final));
    const avg = vals.length > 0 ? roundGrade(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
    const apr = vals.filter(v => v >= PASSING_GRADE).length;
    const rep = vals.filter(v => v < PASSING_GRADE).length;
    const pct = vals.length > 0 ? `${Math.round((apr / vals.length) * 100)}%` : '—';

    doc.fillColor(INST.azul).font('Helvetica-Bold').fontSize(8)
      .text(`Promedio: ${avg != null ? avg.toFixed(2) : '—'}  |  Aprobados: ${apr}  |  Reprobados: ${rep}  |  % Aprobación: ${pct}`, doc.page.margins.left, doc.y);
    doc.moveDown(0.8);
  }

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    drawFooter(doc, folio, i + 1, range.count);
  }

  doc.end();
  await new Promise((resolve, reject) => { stream.on('finish', resolve); stream.on('error', reject); });

  return { filePath, fileName, folio, totalAlumnos: alumnos.length, totalMaterias: materias.length };
}

// ==============================
// 7. REPORTE DE SEGUIMIENTO PARA COORDINADOR
// ==============================
async function generarReporteSeguimientoPDF(idPeriodo) {
  const [periodoRows] = await pool.execute(
    'SELECT * FROM periodos WHERE id_periodo = ? LIMIT 1', [idPeriodo]
  );
  const periodo = periodoRows[0] || {};

  const [grupos] = await pool.execute(
    `SELECT DISTINCT g.id_grupo, g.nombre_grupo, g.turno, g.semestre
     FROM kardex_historial_academico h
     INNER JOIN grupos g ON g.id_grupo = h.id_grupo
     WHERE h.id_periodo = ?
     ORDER BY g.nombre_grupo`, [idPeriodo]
  );

  const folio = generarFolio('SEG');

  const fileName = `seguimiento_${idPeriodo}_${folio}.pdf`;
  const filePath = path.join(REPORT_DIR, fileName);

  const doc = new PDFDocument({ size: 'LETTER', margin: APA.MARGIN_PT, bufferPages: true });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  drawInstitutionalHeader(
    doc,
    'REPORTE DE SEGUIMIENTO ACADÉMICO',
    `${periodo.nombre_periodo || '—'} — Para Coordinador(a) de Carrera`
  );

  // Resumen general
  let totalAlumnosGral = 0;
  let totalCapturadosGral = 0;
  let totalPendientesGral = 0;
  let totalEsperadosGral = 0;

  const statHeaders = ['Grupo', 'Semestre', 'Turno', 'Alumnos', 'Capturados', 'Pendientes', '% Captura'];
  const statColWidths = [90, 55, 50, 60, 70, 70, 70];
  const statRows = [];

  for (const g of grupos) {
    const [alumnosCount] = await pool.execute(
      `SELECT COUNT(*) AS total FROM grupos_alumnos
       WHERE id_grupo = ? AND id_periodo = ? AND estado = 'ACTIVO'`,
      [g.id_grupo, idPeriodo]
    );
    const totalAlumnos = Number(alumnosCount[0]?.total || 0);

    const [materiasCount] = await pool.execute(
      `SELECT COUNT(*) AS total FROM cargas_academicas
       WHERE id_grupo = ? AND id_periodo = ? AND estado = 'ACTIVA'`,
      [g.id_grupo, idPeriodo]
    );
    const totalMaterias = Number(materiasCount[0]?.total || 0);

    const [stats] = await pool.execute(
      `SELECT
         SUM(CASE WHEN parcial_1 IS NOT NULL THEN 1 ELSE 0 END) AS p1,
         SUM(CASE WHEN parcial_2 IS NOT NULL THEN 1 ELSE 0 END) AS p2,
         SUM(CASE WHEN parcial_3 IS NOT NULL THEN 1 ELSE 0 END) AS p3
       FROM kardex_historial_academico
       WHERE id_grupo = ? AND id_periodo = ?`,
      [g.id_grupo, idPeriodo]
    );

    const s = stats[0] || {};
    // SUM() de MySQL devuelve texto: sin Number() la suma concatena ("555")
    const capturados = Number(s.p1 || 0) + Number(s.p2 || 0) + Number(s.p3 || 0);
    const esperados = totalAlumnos * totalMaterias * 3;
    const pendientes = esperados - capturados;
    const pct = esperados > 0 ? `${Math.round((capturados / esperados) * 100)}%` : '—';

    totalAlumnosGral += totalAlumnos;
    totalCapturadosGral += capturados;
    totalPendientesGral += pendientes;
    totalEsperadosGral += esperados;

    statRows.push([g.nombre_grupo, String(g.semestre || '—'), g.turno || '—', String(totalAlumnos), String(capturados), String(pendientes), pct]);
  }

  drawSectionTitle(doc, 'Resumen por Grupo', doc.y);
  drawTable(doc, statHeaders, statRows, doc.y, { colWidths: statColWidths, fontSize: 8, rowHeight: 16 });

  // Totales
  const pctGeneral = totalEsperadosGral > 0 ? `${Math.round((totalCapturadosGral / totalEsperadosGral) * 100)}%` : '—';
  doc.fillColor(INST.azul).font('Helvetica-Bold').fontSize(9)
    .text(`TOTAL: ${totalAlumnosGral} alumnos  |  Capturados: ${totalCapturadosGral}  |  Pendientes: ${totalPendientesGral}  |  % General: ${pctGeneral}`, doc.page.margins.left, doc.y);
  doc.moveDown(1);

  // Detalle por grupo y materia
  for (const g of grupos) {
    if (doc.y > 600) { doc.addPage(); }

    drawSectionTitle(doc, `Grupo: ${g.nombre_grupo} — Semestre ${g.semestre || '—'} — Turno ${g.turno || '—'}`, doc.y);

    const [materias] = await pool.execute(
      `SELECT ca.id_materia, m.nombre_materia, m.clave_materia,
              CONCAT(du.apellido_paterno, ' ', du.apellido_materno, ' ', du.nombres) AS nombre_docente
       FROM cargas_academicas ca
       INNER JOIN materias m ON m.id_materia = ca.id_materia
       LEFT JOIN docentes dn ON dn.id_docente = ca.id_docente
       LEFT JOIN usuarios du ON du.id_usuario = dn.id_usuario
       WHERE ca.id_grupo = ? AND ca.id_periodo = ? AND ca.estado = 'ACTIVA'`,
      [g.id_grupo, idPeriodo]
    );

    const matHeaders = ['Materia', 'Docente', 'P1 Cap.', 'P2 Cap.', 'P3 Cap.', 'Promedio', '% Aprob.'];
    const matColWidths = [130, 130, 55, 55, 55, 55, 55];
    const matRows = [];

    for (const mat of materias) {
      const [cals] = await pool.execute(
        `SELECT * FROM kardex_historial_academico
         WHERE id_grupo = ? AND id_materia = ? AND id_periodo = ?`,
        [g.id_grupo, mat.id_materia, idPeriodo]
      );

      let p1 = 0, p2 = 0, p3 = 0;
      const fines = [];
      for (const c of cals) {
        if (c.parcial_1 != null) p1++;
        if (c.parcial_2 != null) p2++;
        if (c.parcial_3 != null) p3++;
        if (c.calificacion_final != null) fines.push(parseFloat(c.calificacion_final));
      }

      const avg = fines.length > 0 ? roundGrade(fines.reduce((s, v) => s + v, 0) / fines.length) : null;
      const apr = fines.filter(v => v >= PASSING_GRADE).length;
      const pctApr = fines.length > 0 ? `${Math.round((apr / fines.length) * 100)}%` : '—';

      matRows.push([mat.nombre_materia, mat.nombre_docente || '—', String(p1), String(p2), String(p3), formatGrade(avg), pctApr]);
    }

    drawTable(doc, matHeaders, matRows, doc.y, { colWidths: matColWidths, fontSize: 7.5, rowHeight: 15 });
    doc.moveDown(0.8);
  }

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    drawFooter(doc, folio, i + 1, range.count);
  }

  doc.end();
  await new Promise((resolve, reject) => { stream.on('finish', resolve); stream.on('error', reject); });

  return { filePath, fileName, folio, totalGrupos: grupos.length };
}

// ==============================
// EXPORTS
// ==============================
module.exports = {
  generarPreboletaPDF,
  generarBoletaPDF,
  generarCalificacionesParcialPDF,
  generarCalificacionesPeriodoPDF,
  generarHistorialPDF,
  generarReporteGrupoPDF,
  generarReporteSeguimientoPDF
};
