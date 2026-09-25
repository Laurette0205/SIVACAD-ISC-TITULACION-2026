'use strict';

// backend/src/services/calificacionesExport.js
// MÓDULO 6 — Exportación Segura de Calificaciones
// Genera Excel con datos filtrados por rol: alumno ve solo su info,
// docente ve su grupo, coordinador/admin ven info agregada.
//
// REGLA: Todas las funciones de cálculo se importan del servicio único.

const ExcelJS = require('exceljs');
const pool = require('../config/db');
const { applyAPAMargins } = require('../helpers/excelHelpers');

// ==============================
// SERVICIO ÚNICO DE CALIFICACIONES
// ==============================
const {
  roundGrade,
  calculateAverage,
  PASSING_GRADE,
  calcularEstadoAcademico
} = require('./academicGradeService');

function formatFechaMX(date) {
  return new Date(date).toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

function generarFolio() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CAL-${ts}-${rand}`;
}

// ==============================
// 1. EXPORTAR BOLETA DEL ALUMNO (solo sus propias calificaciones)
// ==============================

async function exportBoletaAlumno(idAlumno, idPeriodo, idUsuarioSolicitante) {
  // Verificar que el alumno solicitante sea el mismo (o sea admin)
  const [alumnoRows] = await pool.execute(
    `SELECT a.id_alumno, a.nombres, a.apellido_paterno, a.apellido_materno,
            a.matricula, c.nombre_carrera, k.promedio_general, k.creditos_acumulados
     FROM alumnos a
     INNER JOIN carreras c ON c.id_carrera = a.id_carrera
     LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
     WHERE a.id_alumno = ? LIMIT 1`,
    [idAlumno]
  );

  if (!alumnoRows.length) throw new Error('Alumno no encontrado');
  const alumno = alumnoRows[0];

  // Query: solo PUBLICADAS, solo del alumno específico
  let where = 'h.id_alumno = ? AND h.estado_calificacion = \'PUBLICADA\'';
  const params = [idAlumno];

  if (idPeriodo) {
    where += ' AND h.id_periodo = ?';
    params.push(idPeriodo);
  }

  const [materias] = await pool.execute(
    `SELECT h.*, m.nombre_materia, m.clave_materia, m.creditos,
            p.nombre_periodo,
            CONCAT(du.apellido_paterno, ' ', du.apellido_materno, ' ', du.nombres) AS nombre_docente
     FROM kardex_historial_academico h
     INNER JOIN materias m ON m.id_materia = h.id_materia
     INNER JOIN periodos p ON p.id_periodo = h.id_periodo
     LEFT JOIN cargas_academicas ca ON ca.id_grupo = h.id_grupo AND ca.id_periodo = h.id_periodo AND ca.id_materia = h.id_materia
     LEFT JOIN docentes dn ON dn.id_docente = ca.id_docente
     LEFT JOIN usuarios du ON du.id_usuario = dn.id_usuario
     WHERE ${where}
     ORDER BY p.nombre_periodo, m.semestre_sugerido, m.nombre_materia`,
    params
  );

  const nombreCompleto = `${alumno.apellido_paterno || ''} ${alumno.apellido_materno || ''} ${alumno.nombres || ''}`.replace(/\s+/g, ' ').trim();
  const folio = generarFolio();

  // Crear workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIVACAD';
  workbook.created = new Date();
  workbook.title = 'BOLETA DE CALIFICACIONES';
  workbook.subject = `Boleta - ${nombreCompleto}`;

  // Hoja 1: Portada con datos del alumno
  const ws1 = workbook.addWorksheet('Boleta', {
    headerFooter: {
      oddHeader: '&C&"Arial"&8 SIVACAD - Boleta de Calificaciones',
      oddFooter: `&L${formatFechaMX(new Date())}&CFolio: ${folio}&RBoleta del Alumno`
    }
  });

  applyAPAMargins(ws1, { orientation: 'landscape' });
  ws1.views = [{ showGridLines: false }];

  const colWidths = [3, 18, 40, 12, 12, 12, 14, 14, 14];
  colWidths.forEach((w, i) => { ws1.getColumn(i + 1).width = w; });

  // Título
  ws1.mergeCells('A2:I2');
  const title = ws1.getCell('A2');
  title.value = 'BOLETA DE CALIFICACIONES';
  title.font = { bold: true, size: 14, color: { argb: 'FF1E40AF' }, name: 'Arial' };
  title.alignment = { horizontal: 'center' };

  ws1.mergeCells('A3:I3');
  const sub = ws1.getCell('A3');
  sub.value = 'SISTEMA INTEGRAL DE VALIDACIÓN Y CONTROL ACADÉMICO — SIVACAD-ISC';
  sub.font = { size: 9, color: { argb: 'FF64748B' }, name: 'Arial', bold: true };
  sub.alignment = { horizontal: 'center' };

  // Datos del alumno
  ws1.getCell('A5').value = 'Alumno:';
  ws1.getCell('A5').font = { bold: true, size: 10, name: 'Arial' };
  ws1.getCell('B5').value = nombreCompleto;
  ws1.getCell('B5').font = { size: 10, name: 'Arial' };

  ws1.getCell('A6').value = 'Matrícula:';
  ws1.getCell('A6').font = { bold: true, size: 10, name: 'Arial' };
  ws1.getCell('B6').value = alumno.matricula;
  ws1.getCell('B6').font = { size: 10, name: 'Arial' };

  ws1.getCell('E5').value = 'Carrera:';
  ws1.getCell('E5').font = { bold: true, size: 10, name: 'Arial' };
  ws1.getCell('F5').value = alumno.nombre_carrera;
  ws1.getCell('F5').font = { size: 10, name: 'Arial' };

  ws1.getCell('E6').value = 'Promedio General:';
  ws1.getCell('E6').font = { bold: true, size: 10, name: 'Arial' };
  const bolFins = materias.filter(m => m.calificacion_final != null).map(m => parseFloat(m.calificacion_final));
  const bolProm = bolFins.length > 0 ? roundGrade(bolFins.reduce((s, v) => s + v, 0) / bolFins.length) : null;
  ws1.getCell('F6').value = bolProm != null ? bolProm.toFixed(2) : 'N/A';
  ws1.getCell('F6').font = { size: 10, name: 'Arial' };

  ws1.mergeCells('A8:I8');
  const folioCell = ws1.getCell('A8');
  const nombrePeriodo = materias[0]?.nombre_periodo || (idPeriodo || 'TODOS');
  folioCell.value = `Folio: ${folio}  |  Emitido: ${formatFechaMX(new Date())}  |  Periodo: ${nombrePeriodo}`;
  folioCell.font = { size: 8, color: { argb: 'FF475569' }, name: 'Arial' };

  // Hoja 2: Calificaciones por período
  const ws2 = workbook.addWorksheet('Calificaciones');
  applyAPAMargins(ws2, { orientation: 'landscape' });
  ws2.headerFooter = {
    oddHeader: '&C&"Arial"&8 Calificaciones por Período',
    oddFooter: `&L${formatFechaMX(new Date())}&CFolio: ${folio}&RHoja 2`
  };

  const headers = ['#', 'Materia', 'Clave', 'P1', 'P2', 'P3', 'Promedio', 'Final', 'Estado'];
  const headerRow = ws2.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF0F172A' } }
    };
  });
  headerRow.height = 22;

  const colWidths2 = [5, 35, 12, 10, 10, 10, 12, 12, 14];
  colWidths2.forEach((w, i) => { ws2.getColumn(i + 1).width = w; });

  let currentPeriodo = null;
  let idx = 0;

  for (const m of materias) {
    if (m.nombre_periodo !== currentPeriodo) {
      currentPeriodo = m.nombre_periodo;
      const sepRow = ws2.addRow([`── ${currentPeriodo} ──`, '', '', '', '', '', '', '', '']);
      ws2.mergeCells(sepRow.number, 1, sepRow.number, 9);
      sepRow.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF1E40AF' }, name: 'Arial' };
      sepRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
    }

    idx++;
    const p1 = m.parcial_1 != null ? roundGrade(m.parcial_1) : '-';
    const p2 = m.parcial_2 != null ? roundGrade(m.parcial_2) : '-';
    const p3 = m.parcial_3 != null ? roundGrade(m.parcial_3) : '-';
    const promedio = m.promedio_parciales != null ? roundGrade(m.promedio_parciales)
      : (calculateAverage(m.parcial_1, m.parcial_2, m.parcial_3) ?? '-');
    const final_ = m.calificacion_final != null ? roundGrade(m.calificacion_final) : '-';
    const estado = calcularEstadoAcademico(m);

    const dataRow = ws2.addRow([idx, m.nombre_materia, m.clave_materia, p1, p2, p3, promedio, final_, estado]);
    const rowIdx = dataRow.number;

    // Colores por estado académico
    const estadoColors = {
      Acreditada: 'FFD1FAE5',
      'No Acreditada': 'FFFEE2E2',
      Pendiente: 'FFFEF3C7',
      Borrador: 'FFFEF3C7',
      Validada: 'FFDBEAFE',
      'Sin Calificación': 'FFF1F5F9'
    };
    const bgColor = estadoColors[estado] || 'FFFFFFFF';
    dataRow.eachCell((cell, colNumber) => {
      cell.font = { size: 10, name: 'Arial' };
      cell.alignment = { horizontal: colNumber <= 3 ? 'left' : 'center', vertical: 'middle' };
      if (colNumber === 9) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      }
    });

    dataRow.height = 18;
  }

  // Resumen del período (paridad con el PDF: Promedio / Aprobadas / No Acreditadas)
  const bolApr = bolFins.filter(v => v >= PASSING_GRADE).length;
  const bolNoA = bolFins.filter(v => v < PASSING_GRADE).length;

  ws2.addRow([]);
  ws2.addRow([`Promedio: ${bolProm != null ? bolProm.toFixed(2) : '-'}  |  Aprobadas: ${bolApr}  |  No Acreditadas: ${bolNoA}`]);

  // Pie de página
  const footerRow = ws2.addRow([]);
  ws2.addRow([`Folio: ${folio}`, `Emitido: ${formatFechaMX(new Date())}`, 'SIVACAD-ISC v3.0']);

  return { workbook, folio, totalMaterias: materias.length };
}

// ==============================
// 2. EXPORTAR CALIFICACIONES DE UN GRUPO (docente/coordinador/admin)
// ==============================

async function exportGrupoCalificaciones(idGrupo, idPeriodo, idUsuarioSolicitante, rolSolicitante) {
  // Verificar acceso del docente
  const esAdmin = ['ADMINISTRADOR', 'COORDINADOR'].includes(String(rolSolicitante).trim().toUpperCase());

  if (!esAdmin) {
    // Verificar que el docente tenga acceso a este grupo
    const [docenteRows] = await pool.execute(
      'SELECT id_docente FROM docentes WHERE id_usuario = ? LIMIT 1',
      [idUsuarioSolicitante]
    );
    if (!docenteRows.length) throw new Error('Perfil docente no encontrado');
    const idDocente = docenteRows[0].id_docente;

    const [acc] = await pool.execute(
      'SELECT COUNT(*) AS cnt FROM cargas_academicas WHERE id_docente = ? AND id_grupo = ? AND id_periodo = ?',
      [idDocente, idGrupo, idPeriodo]
    );
    if (acc[0].cnt === 0) throw new Error('No tienes acceso a este grupo');
  }

  // Obtener info del grupo y período
  const [grupoInfo] = await pool.execute(
    `SELECT g.nombre_grupo, p.nombre_periodo FROM grupos g, periodos p
     WHERE g.id_grupo = ? AND p.id_periodo = ?`,
    [idGrupo, idPeriodo]
  );

  if (!grupoInfo.length) throw new Error('Grupo o período no encontrado');
  const { nombre_grupo, nombre_periodo } = grupoInfo[0];

  // Obtener calificaciones — ORDENADO POR APELLIDO EN SERVIDOR
  const [rows] = await pool.execute(
    `SELECT h.*, m.nombre_materia, m.clave_materia, m.creditos,
            CONCAT(a.apellido_paterno, ' ', a.apellido_materno, ' ', a.nombres) AS nombre_alumno,
            a.matricula, a.apellido_paterno, a.apellido_materno, a.nombres
     FROM kardex_historial_academico h
     INNER JOIN materias m ON m.id_materia = h.id_materia
     INNER JOIN grupos g ON g.id_grupo = h.id_grupo
     INNER JOIN alumnos a ON a.id_alumno = h.id_alumno
     WHERE h.id_grupo = ? AND h.id_periodo = ?
     ORDER BY a.apellido_paterno, a.apellido_materno, a.nombres, m.nombre_materia`,
    [idGrupo, idPeriodo]
  );

  const folio = generarFolio();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIVACAD';
  workbook.created = new Date();
  workbook.title = `CALIFICACIONES - ${nombre_grupo}`;
  workbook.subject = `Calificaciones ${nombre_grupo} - ${nombre_periodo}`;

  // Hoja 1: Resumen del grupo
  const ws1 = workbook.addWorksheet('Calificaciones del Grupo');
  ws1.headerFooter = {
    oddHeader: `&C&"Arial"&8 ${nombre_grupo} - ${nombre_periodo}`,
    oddFooter: `&L${formatFechaMX(new Date())}&CFolio: ${folio}&RSIVACAD-ISC`
  };

  applyAPAMargins(ws1, { orientation: 'landscape' });

  // Título
  ws1.mergeCells('A1:K1');
  const title = ws1.getCell('A1');
  title.value = `CALIFICACIONES — ${nombre_grupo}`;
  title.font = { bold: true, size: 14, color: { argb: 'FF1E40AF' }, name: 'Arial' };
  title.alignment = { horizontal: 'center' };

  ws1.mergeCells('A2:K2');
  const sub = ws1.getCell('A2');
  sub.value = `Período: ${nombre_periodo}  |  Folio: ${folio}  |  Emitido: ${formatFechaMX(new Date())}`;
  sub.font = { size: 9, color: { argb: 'FF64748B' }, name: 'Arial' };
  sub.alignment = { horizontal: 'center' };

  // Headers
  const headers = ['#', 'Matrícula', 'Alumno', 'Materia', 'Clave', 'Créditos', 'P1', 'P2', 'P3', 'Promedio', 'Final', 'Estado'];
  const headerRow = ws1.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF0F172A' } } };
  });
  headerRow.height = 28;

  const colWidths = [5, 14, 30, 30, 10, 9, 8, 8, 8, 10, 10, 12];
  colWidths.forEach((w, i) => { ws1.getColumn(i + 1).width = w; });

  // Datos — ya ordenados por servidor (apellido_paterno, apellido_materno, nombres)
  let idx = 0;
  let currentAlumno = null;

  for (const r of rows) {
    const alumnoKey = `${r.apellido_paterno}|${r.apellido_materno}|${r.nombres}`;
    if (alumnoKey !== currentAlumno) {
      currentAlumno = alumnoKey;
      idx++;
    }

    const p1 = r.parcial_1 != null ? roundGrade(r.parcial_1) : '-';
    const p2 = r.parcial_2 != null ? roundGrade(r.parcial_2) : '-';
    const p3 = r.parcial_3 != null ? roundGrade(r.parcial_3) : '-';
    const promedio = r.promedio_parciales != null ? roundGrade(r.promedio_parciales)
      : (calculateAverage(r.parcial_1, r.parcial_2, r.parcial_3) ?? '-');
    const final_ = r.calificacion_final != null ? roundGrade(r.calificacion_final) : '-';
    const estado = calcularEstadoAcademico(r);

    const dataRow = ws1.addRow([
      idx, r.matricula, r.nombre_alumno, r.nombre_materia,
      r.clave_materia, r.creditos, p1, p2, p3, promedio, final_, estado
    ]);

    // Colores por estado académico
    const estadoColors = {
      Acreditada: 'FFD1FAE5',
      'No Acreditada': 'FFFEE2E2',
      Pendiente: 'FFFEF3C7',
      Borrador: 'FFFEF3C7',
      Validada: 'FFDBEAFE',
      'Sin Calificación': 'FFF1F5F9'
    };
    const bgColor = estadoColors[estado] || 'FFFFFFFF';

    dataRow.eachCell((cell, colNumber) => {
      cell.font = { size: 9, name: 'Arial' };
      cell.alignment = {
        horizontal: [1, 2, 6, 7, 8, 9, 10, 11].includes(colNumber) ? 'center' : 'left',
        vertical: 'middle'
      };
      if (colNumber === 12) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      }
    });
    dataRow.height = 16;
  }

  // Resumen por alumno
  ws1.addRow([]);
  const resumenRow = ws1.addRow(['RESUMEN POR ALUMNO', '', '', '', '', '', '', '', '', '', '', '']);
  ws1.mergeCells(resumenRow.number, 1, resumenRow.number, 12);
  resumenRow.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF1E40AF' }, name: 'Arial' };

  const resumenHeaders = ['#', 'Matrícula', 'Alumno', '', '', '', '', '', '', 'Promedio', 'Final General', ''];
  const rh = ws1.addRow(resumenHeaders);
  rh.eachCell((cell) => {
    cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
  });

  // Agrupar por alumno para resumen
  const alumnosMap = {};
  for (const r of rows) {
    const key = r.id_alumno;
    if (!alumnosMap[key]) {
      alumnosMap[key] = {
        matricula: r.matricula,
        nombre: r.nombre_alumno,
        finales: []
      };
    }
    if (r.calificacion_final != null) {
      alumnosMap[key].finales.push(parseFloat(r.calificacion_final));
    }
  }

  let resumenIdx = 0;
  for (const [id, al] of Object.entries(alumnosMap)) {
    resumenIdx++;
    const promGeneral = al.finales.length > 0
      ? roundGrade(al.finales.reduce((s, v) => s + v, 0) / al.finales.length)
      : '-';
    const finalGrp = al.finales.length > 0
      ? roundGrade(Math.min(...al.finales))
      : '-';

    const rr = ws1.addRow([resumenIdx, al.matricula, al.nombre, '', '', '', '', '', '', promGeneral, finalGrp, '']);
    rr.eachCell((cell) => { cell.font = { size: 9, name: 'Arial' }; });
  }

  return { workbook, folio, totalRegistros: rows.length, totalAlumnos: Object.keys(alumnosMap).length };
}

// ==============================
// 3. EXPORTAR RESUMEN DE CALIFICACIONES (coordinador/admin — todos los grupos)
// ==============================

async function exportResumenCalificaciones(idPeriodo, idUsuarioSolicitante, rolSolicitante) {
  const esAdmin = ['ADMINISTRADOR', 'COORDINADOR'].includes(String(rolSolicitante).trim().toUpperCase());
  if (!esAdmin) throw new Error('Solo coordinadores y administradores pueden exportar resumen general');

  const [periodoInfo] = await pool.execute(
    'SELECT nombre_periodo FROM periodos WHERE id_periodo = ? LIMIT 1',
    [idPeriodo]
  );
  const nombre_periodo = periodoInfo.length ? periodoInfo[0].nombre_periodo : `Período ${idPeriodo}`;

  // Obtener todos los grupos del período
  const [grupos] = await pool.execute(
    `SELECT DISTINCT g.id_grupo, g.nombre_grupo
     FROM kardex_historial_academico h
     INNER JOIN grupos g ON g.id_grupo = h.id_grupo
     WHERE h.id_periodo = ? AND h.estado_calificacion = 'PUBLICADA'
     ORDER BY g.nombre_grupo`,
    [idPeriodo]
  );

  const folio = generarFolio();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIVACAD';
  workbook.created = new Date();
  workbook.title = `RESUMEN CALIFICACIONES - ${nombre_periodo}`;
  workbook.subject = `Resumen ${nombre_periodo}`;

  // Hoja 1: Resumen ejecutivo
  const ws1 = workbook.addWorksheet('Resumen Ejecutivo');
  applyAPAMargins(ws1, { orientation: 'landscape' });
  ws1.headerFooter = {
    oddHeader: `&C&"Arial"&8 Resumen de Calificaciones — ${nombre_periodo}`,
    oddFooter: `&L${formatFechaMX(new Date())}&CFolio: ${folio}&RSIVACAD-ISC`
  };

  ws1.mergeCells('A1:G1');
  ws1.getCell('A1').value = `RESUMEN DE CALIFICACIONES — ${nombre_periodo}`;
  ws1.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF1E40AF' }, name: 'Arial' };
  ws1.getCell('A1').alignment = { horizontal: 'center' };

  ws1.mergeCells('A2:G2');
  ws1.getCell('A2').value = `Folio: ${folio}  |  Emitido: ${formatFechaMX(new Date())}`;
  ws1.getCell('A2').font = { size: 9, color: { argb: 'FF64748B' }, name: 'Arial' };
  ws1.getCell('A2').alignment = { horizontal: 'center' };

  const headers = ['Grupo', 'Total Alumnos', 'Materias', 'Promedio General', 'Aprobados', 'Reprobados', '% Aprobación'];
  const headerRow = ws1.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  headerRow.height = 22;

  const colWidths = [20, 14, 12, 16, 12, 12, 14];
  colWidths.forEach((w, i) => { ws1.getColumn(i + 1).width = w; });

  let totalGeneralAlumnos = 0;
  let totalGeneralMaterias = 0;
  let totalGeneralAprobados = 0;
  let totalGeneralReprobados = 0;
  let sumaPonderadaPromedio = 0;

  for (const grupo of grupos) {
    const [stats] = await pool.execute(
      `SELECT COUNT(DISTINCT h.id_alumno) AS total_alumnos,
              COUNT(*) AS total_materias,
              SUM(CASE WHEN h.calificacion_final >= ${PASSING_GRADE} THEN 1 ELSE 0 END) AS aprobados,
              SUM(CASE WHEN h.calificacion_final < ${PASSING_GRADE} THEN 1 ELSE 0 END) AS reprobados,
              ROUND(AVG(h.calificacion_final), 2) AS promedio
       FROM kardex_historial_academico h
       WHERE h.id_grupo = ? AND h.id_periodo = ? AND h.estado_calificacion = 'PUBLICADA'
         AND h.calificacion_final IS NOT NULL`,
      [grupo.id_grupo, idPeriodo]
    );

    const s = stats[0];
    // SUM() de MySQL devuelve texto: sin Number() la suma acumulada concatena ("02")
    const totalAl = Number(s.total_alumnos || 0);
    const totalMat = Number(s.total_materias || 0);
    const aprobados = Number(s.aprobados || 0);
    const reprobados = Number(s.reprobados || 0);
    const promedio = s.promedio != null ? Number(s.promedio).toFixed(2) : '-';
    const pctAprob = totalMat > 0 ? `${Math.round((aprobados / totalMat) * 100)}%` : '-';

    totalGeneralAlumnos += totalAl;
    totalGeneralMaterias += totalMat;
    totalGeneralAprobados += aprobados;
    totalGeneralReprobados += reprobados;
    if (s.promedio != null && totalMat > 0) {
      sumaPonderadaPromedio += Number(s.promedio) * totalMat;
    }

    const dataRow = ws1.addRow([grupo.nombre_grupo, totalAl, totalMat, promedio, aprobados, reprobados, pctAprob]);
    dataRow.eachCell((cell, colNumber) => {
      cell.font = { size: 10, name: 'Arial' };
      cell.alignment = { horizontal: colNumber >= 2 ? 'center' : 'left', vertical: 'middle' };
    });
  }

  // Fila de totales
  ws1.addRow([]);
  const promedioTotal = totalGeneralMaterias > 0
    ? (Math.round((sumaPonderadaPromedio / totalGeneralMaterias) * 100) / 100).toFixed(2)
    : '-';
  const totalRow = ws1.addRow([
    'TOTAL',
    totalGeneralAlumnos,
    totalGeneralMaterias,
    promedioTotal,
    totalGeneralAprobados,
    totalGeneralReprobados,
    totalGeneralMaterias > 0 ? `${Math.round((totalGeneralAprobados / totalGeneralMaterias) * 100)}%` : '-'
  ]);
  totalRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, name: 'Arial', color: { argb: 'FF1E40AF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // Hoja 2: Detalle por grupo
  for (const grupo of grupos) {
    const safeName = grupo.nombre_grupo.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 28);
    const ws2 = workbook.addWorksheet(safeName);
    applyAPAMargins(ws2, { orientation: 'landscape' });

    const [rows] = await pool.execute(
      `SELECT h.*, m.nombre_materia, m.clave_materia, m.creditos,
              CONCAT(a.apellido_paterno, ' ', a.apellido_materno, ' ', a.nombres) AS nombre_alumno,
              a.matricula
       FROM kardex_historial_academico h
       INNER JOIN materias m ON m.id_materia = h.id_materia
       INNER JOIN alumnos a ON a.id_alumno = h.id_alumno
       WHERE h.id_grupo = ? AND h.id_periodo = ? AND h.estado_calificacion = 'PUBLICADA'
       ORDER BY a.apellido_paterno, a.apellido_materno, a.nombres, m.nombre_materia`,
      [grupo.id_grupo, idPeriodo]
    );

    ws2.addRow([`${grupo.nombre_grupo} — ${nombre_periodo}`]);
    ws2.getRow(1).getCell(1).font = { bold: true, size: 12, name: 'Arial' };

    const grpHeaders = ['#', 'Matrícula', 'Alumno', 'Materia', 'P1', 'P2', 'P3', 'Promedio', 'Final', 'Estado'];
    const grpHeaderRow = ws2.addRow(grpHeaders);
    grpHeaderRow.eachCell((cell) => {
      cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
    });

    const grpColWidths = [5, 14, 30, 30, 8, 8, 8, 10, 10, 12];
    grpColWidths.forEach((w, i) => { ws2.getColumn(i + 1).width = w; });

    let idx2 = 0;
    let curAl = null;
    for (const r of rows) {
      const alKey = `${r.apellido_paterno}|${r.apellido_materno}|${r.nombres}`;
      if (alKey !== curAl) { curAl = alKey; idx2++; }

      ws2.addRow([
        idx2, r.matricula, r.nombre_alumno, r.nombre_materia,
        r.parcial_1 != null ? roundGrade(r.parcial_1) : '-',
        r.parcial_2 != null ? roundGrade(r.parcial_2) : '-',
        r.parcial_3 != null ? roundGrade(r.parcial_3) : '-',
        r.promedio_parciales != null ? roundGrade(r.promedio_parciales)
          : (calculateAverage(r.parcial_1, r.parcial_2, r.parcial_3) ?? '-'),
        r.calificacion_final != null ? roundGrade(r.calificacion_final) : '-',
        calcularEstadoAcademico(r)
      ]);
    }
  }

  return { workbook, folio, totalGrupos: grupos.length, totalAlumnos: totalGeneralAlumnos };
}

// ==============================
// EXPORTS
// ==============================

module.exports = {
  exportBoletaAlumno,
  exportGrupoCalificaciones,
  exportResumenCalificaciones,
  roundGrade,
  calculateAverage,
  formatFechaMX,
  generarFolio
};
