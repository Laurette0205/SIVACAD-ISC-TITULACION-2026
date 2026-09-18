'use strict';

const ExcelJS = require('exceljs');
const pool = require('../config/db');

// ==============================
// GRADE HELPERS — Importados del servicio único
// ==============================
// REGLA: Una calificación almacenada en SIVACAD debe producir
//        el mismo resultado en WEB, EXCEL, PDF y KARDEX.
// Fuente de verdad: academicGradeService.js
const {
  roundGrade,
  calculateAverage,
  formatGrade: _formatGradeBase,
  PASSING_GRADE,
  calcularEstadoAcademico,
  calcularEstadoSimple,
  contarAprobacion,
  promedioGeneral,
  porcentajeAprobacion,
  ESTADO_ACADEMICO
} = require('../services/academicGradeService');

// formatGrade con default '-' para Excel (vs '—' para PDF)
function formatGrade(val) {
  return _formatGradeBase(val, '-');
}

// ==============================
// DATE / FOLIO HELPERS
// ==============================

function formatFechaMX(date) {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  } catch (_) { return String(date); }
}

function formatFechaLargaMX(date) {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleDateString('es-MX', {
      year: 'numeric', month: 'long', day: 'numeric',
      timeZone: 'America/Mexico_City'
    });
  } catch (_) { return String(date); }
}

function generarFolio(prefix = 'SIV') {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

// ==============================
// INSTITUTIONAL HELPERS
// ==============================

const INSTITUTIONAL = {
  tesi: 'TECNOLÓGICO DE ESTUDIOS SUPERIORES DE IXTAPALUCA (TESI)',
  carrera: 'Ingeniería en Sistemas Computacionales',
  sistema: 'SISTEMA INTEGRAL DE VALIDACIÓN Y CONTROL ACADÉMICO — SIVACAD-ISC',
  version: 'SIVACAD-ISC v3.0',
  azulInstitucional: 'FF1E40AF',
  azulSecundario: 'FF334155',
  grisClaro: 'FF64748B',
  grisFondo: 'FFF1F5F9',
  verde: 'FFD1FAE5',
  amarillo: 'FFFEF3C7',
  azulClaro: 'FFDBEAFE',
  gris: 'FFF3F4F6',
  blanco: 'FFFFFFFF'
};

const ESTADO_COLORS = {
  PUBLICADA: INSTITUTIONAL.verde,
  BORRADOR: INSTITUTIONAL.amarillo,
  VALIDADA: INSTITUTIONAL.azulClaro,
  CERRADA: INSTITUTIONAL.gris,
  SIN_CALIFICACION: 'FFFFF1F2'
};

// ==============================
// EXCEL STYLE HELPERS
// ==============================

function createWorkbook(title, subject, creator = 'SIVACAD') {
  const wb = new ExcelJS.Workbook();
  wb.creator = creator;
  wb.created = new Date();
  wb.title = title;
  wb.subject = subject;
  return wb;
}

function styleHeaderRow(row, options = {}) {
  const {
    bgColor = INSTITUTIONAL.azulInstitucional,
    fontColor = INSTITUTIONAL.blanco,
    fontSize = 9,
    height = 22
  } = options;

  row.height = height;
  row.eachCell((cell) => {
    cell.font = { bold: true, size: fontSize, color: { argb: fontColor }, name: 'Arial' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF0F172A' } } };
  });
}

function styleDataRow(row, options = {}) {
  const { fontSize = 9, centerColumns = [] } = options;
  row.height = 16;
  row.eachCell((cell, colNumber) => {
    cell.font = { size: fontSize, name: 'Arial' };
    cell.alignment = {
      horizontal: centerColumns.includes(colNumber) ? 'center' : 'left',
      vertical: 'middle'
    };
  });
}

function applyEstadoColor(cell, estado) {
  const bg = ESTADO_COLORS[estado] || INSTITUTIONAL.blanco;
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
}

function styleTitle(ws, cellRef, value, mergeEnd) {
  const cell = ws.getCell(cellRef);
  cell.value = value;
  cell.font = { bold: true, size: 14, color: { argb: INSTITUTIONAL.azulInstitucional }, name: 'Arial' };
  cell.alignment = { horizontal: 'center' };
  if (mergeEnd) ws.mergeCells(`${cellRef}:${mergeEnd}`);
}

function styleSubtitle(ws, cellRef, value, mergeEnd) {
  const cell = ws.getCell(cellRef);
  cell.value = value;
  cell.font = { size: 9, color: { argb: INSTITUTIONAL.grisClaro }, name: 'Arial', bold: true };
  cell.alignment = { horizontal: 'center' };
  if (mergeEnd) ws.mergeCells(`${cellRef}:${mergeEnd}`);
}

function setColumnWidths(ws, widths) {
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
}

function addFolioRow(ws, rowNumber, cols, folio, extraText) {
  ws.mergeCells(rowNumber, 1, rowNumber, cols);
  const cell = ws.getCell(rowNumber, 1);
  cell.value = `Folio: ${folio}  |  Emitido: ${formatFechaMX(new Date())}${extraText ? '  |  ' + extraText : ''}`;
  cell.font = { size: 8, color: { argb: 'FF475569' }, name: 'Arial' };
}

// ==============================
// DATA ACCESS HELPERS
// ==============================

async function getAlumnoById(idAlumno) {
  const [rows] = await pool.execute(
    `SELECT a.*, c.nombre_carrera, pe.nombre_plan, pe.version_plan,
            k.promedio_general, k.creditos_acumulados
     FROM alumnos a
     INNER JOIN carreras c ON c.id_carrera = a.id_carrera
     LEFT JOIN planes_estudio pe ON pe.id_plan = a.id_plan
     LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
     WHERE a.id_alumno = ? LIMIT 1`,
    [idAlumno]
  );
  return rows[0] || null;
}

async function getAlumnosByGrupo(idGrupo, idPeriodo) {
  const [rows] = await pool.execute(
    `SELECT a.id_alumno, a.matricula, a.apellido_paterno, a.apellido_materno, a.nombres
     FROM alumnos a
     INNER JOIN grupos_alumnos ga ON ga.id_alumno = a.id_alumno
     WHERE ga.id_grupo = ? AND ga.id_periodo = ? AND ga.estado = 'ACTIVO'
     ORDER BY a.apellido_paterno, a.apellido_materno, a.nombres`,
    [idGrupo, idPeriodo]
  );
  return rows;
}

async function getGrupoInfo(idGrupo) {
  const [rows] = await pool.execute(
    `SELECT g.*, c.nombre_carrera
     FROM grupos g
     LEFT JOIN carreras c ON c.id_carrera = g.id_carrera
     WHERE g.id_grupo = ? LIMIT 1`,
    [idGrupo]
  );
  return rows[0] || null;
}

async function getPeriodoInfo(idPeriodo) {
  const [rows] = await pool.execute(
    'SELECT * FROM periodos WHERE id_periodo = ? LIMIT 1',
    [idPeriodo]
  );
  return rows[0] || null;
}

async function getMateriasByGrupo(idGrupo, idPeriodo) {
  const [rows] = await pool.execute(
    `SELECT DISTINCT m.id_materia, m.nombre_materia, m.clave_materia, m.creditos, m.semestre_sugerido
     FROM materias m
     INNER JOIN cargas_academicas ca ON ca.id_materia = m.id_materia
     WHERE ca.id_grupo = ? AND ca.id_periodo = ?
     ORDER BY m.semestre_sugerido, m.nombre_materia`,
    [idGrupo, idPeriodo]
  );
  return rows;
}

async function getCalificacionesByGrupoMateria(idGrupo, idMateria, idPeriodo) {
  const [rows] = await pool.execute(
    `SELECT h.*, CONCAT(a.apellido_paterno, ' ', a.apellido_materno, ' ', a.nombres) AS nombre_alumno,
            a.matricula
     FROM kardex_historial_academico h
     INNER JOIN alumnos a ON a.id_alumno = h.id_alumno
     WHERE h.id_grupo = ? AND h.id_materia = ? AND h.id_periodo = ?
     ORDER BY a.apellido_paterno, a.apellido_materno, a.nombres`,
    [idGrupo, idMateria, idPeriodo]
  );
  return rows;
}

async function getCalificacionesByAlumnoPeriodo(idAlumno, idPeriodo, onlyPublicadas = false) {
  let where = 'h.id_alumno = ?';
  const params = [idAlumno];
  if (idPeriodo) { where += ' AND h.id_periodo = ?'; params.push(idPeriodo); }
  if (onlyPublicadas) where += " AND h.estado_calificacion = 'PUBLICADA'";

  const [rows] = await pool.execute(
    `SELECT h.*, m.nombre_materia, m.clave_materia, m.creditos, m.semestre_sugerido,
            g.nombre_grupo, g.turno, p.nombre_periodo,
            CONCAT(dn.apellido_paterno, ' ', dn.apellido_materno, ' ', dn.nombres) AS nombre_docente
     FROM kardex_historial_academico h
     INNER JOIN materias m ON m.id_materia = h.id_materia
     INNER JOIN grupos g ON g.id_grupo = h.id_grupo
     INNER JOIN periodos p ON p.id_periodo = h.id_periodo
     LEFT JOIN cargas_academicas ca ON ca.id_grupo = h.id_grupo AND ca.id_periodo = h.id_periodo AND ca.id_materia = h.id_materia
     LEFT JOIN docentes dn ON dn.id_docente = ca.id_docente
     WHERE ${where}
     ORDER BY p.nombre_periodo, m.semestre_sugerido, m.nombre_materia`,
    params
  );
  return rows;
}

// ==============================
// AUDIT HELPER
// ==============================

async function registrarExportAudit(idUsuario, accion, descripcion, req = null) {
  try {
    const { registrarAuditoria } = require('../middleware/auditoria');
    await registrarAuditoria({
      id_usuario: idUsuario,
      modulo: 'EXPORTACION',
      accion,
      descripcion,
      nivel: 'INFO',
      req
    });
  } catch (_) {}
}

// ==============================
// HTTP RESPONSE HELPER
// ==============================

function sendExcel(res, workbook, filename, folio) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('X-Export-Folio', folio);
  return workbook.xlsx.write(res).then(() => res.end());
}

module.exports = {
  // Grade functions (from academicGradeService — single source of truth)
  roundGrade,
  calculateAverage,
  formatGrade,
  PASSING_GRADE,
  calcularEstadoAcademico,
  calcularEstadoSimple,
  contarAprobacion,
  promedioGeneral,
  porcentajeAprobacion,
  ESTADO_ACADEMICO,
  // Format helpers
  formatFechaMX,
  formatFechaLargaMX,
  generarFolio,
  INSTITUTIONAL,
  ESTADO_COLORS,
  // Excel helpers
  createWorkbook,
  styleHeaderRow,
  styleDataRow,
  applyEstadoColor,
  styleTitle,
  styleSubtitle,
  setColumnWidths,
  addFolioRow,
  // Data access
  getAlumnoById,
  getAlumnosByGrupo,
  getGrupoInfo,
  getPeriodoInfo,
  getMateriasByGrupo,
  getCalificacionesByGrupoMateria,
  getCalificacionesByAlumnoPeriodo,
  // Utilities
  registrarExportAudit,
  sendExcel,
  pool
};
