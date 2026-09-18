'use strict';

const ExcelJS = require('exceljs');
const pool = require('../config/db');

// ==============================
// SERVICIO ÚNICO DE CALIFICACIONES
// ==============================
const {
  roundGrade,
  PASSING_GRADE
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
  return `PRE-${ts}-${rand}`;
}

// ==============================
// 1. EXPORTAR PREBOLETA ALUMNO (Excel)
// ==============================
async function exportPreboletaAlumno(idAlumno, idPeriodo) {
  const [alumnoRows] = await pool.execute(
    `SELECT a.*, c.nombre_carrera, pe.nombre_plan, pe.version_plan,
            k.promedio_general, k.creditos_acumulados
     FROM alumnos a
     INNER JOIN carreras c ON c.id_carrera = a.id_carrera
     LEFT JOIN planes_estudio pe ON pe.id_plan = a.id_plan
     LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
     WHERE a.id_alumno = ? LIMIT 1`,
    [idAlumno]
  );

  if (!alumnoRows.length) throw new Error('Alumno no encontrado');
  const alumno = alumnoRows[0];

  if (!idPeriodo) throw new Error('Período requerido');

  const [materias] = await pool.execute(
    `SELECT h.*, m.nombre_materia, m.clave_materia, m.creditos, m.semestre_sugerido,
            g.nombre_grupo, g.turno, p.nombre_periodo,
            CONCAT(dn.apellido_paterno, ' ', dn.apellido_materno, ' ', dn.nombres) AS nombre_docente
     FROM kardex_historial_academico h
     INNER JOIN materias m ON m.id_materia = h.id_materia
     INNER JOIN grupos g ON g.id_grupo = h.id_grupo
     INNER JOIN periodos p ON p.id_periodo = h.id_periodo
     LEFT JOIN cargas_academicas ca ON ca.id_grupo = h.id_grupo AND ca.id_periodo = h.id_periodo AND ca.id_materia = h.id_materia
     LEFT JOIN docentes dn ON dn.id_docente = ca.id_docente
     WHERE h.id_alumno = ? AND h.id_periodo = ?
     ORDER BY m.semestre_sugerido, m.nombre_materia`,
    [idAlumno, idPeriodo]
  );

  const nombreCompleto = `${alumno.apellido_paterno || ''} ${alumno.apellido_materno || ''} ${alumno.nombres || ''}`.replace(/\s+/g, ' ').trim();
  const folio = generarFolio();
  const grupo = materias[0];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIVACAD';
  workbook.created = new Date();
  workbook.title = 'PREBOLETA DE CALIFICACIONES';

  // Hoja 1: Portada
  const ws1 = workbook.addWorksheet('Preboleta', {
    headerFooter: {
      oddHeader: '&C&"Arial"&8 SIVACAD — Preboleta de Calificaciones',
      oddFooter: `&L${formatFechaMX(new Date())}&CFolio: ${folio}&RPreboleta`
    }
  });

  ws1.pageSetup.margins = { top: 1.5, bottom: 1.5, left: 1.5, right: 1.5, header: 0, footer: 0 };
  ws1.views = [{ showGridLines: false }];

  const colW = [3, 35, 10, 10, 10, 12, 12, 14];
  colW.forEach((w, i) => { ws1.getColumn(i + 1).width = w; });

  ws1.mergeCells('A2:H2');
  ws1.getCell('A2').value = 'TECNOLÓGICO DE ESTUDIOS SUPERIORES DE IXTAPALUCA (TESI)';
  ws1.getCell('A2').font = { bold: true, size: 13, color: { argb: 'FF1E40AF' }, name: 'Arial' };
  ws1.getCell('A2').alignment = { horizontal: 'center' };

  ws1.mergeCells('A3:H3');
  ws1.getCell('A3').value = 'Ingeniería en Sistemas Computacionales';
  ws1.getCell('A3').font = { size: 10, color: { argb: 'FF64748B' }, name: 'Arial' };
  ws1.getCell('A3').alignment = { horizontal: 'center' };

  ws1.mergeCells('A4:H4');
  ws1.getCell('A4').value = 'PREBOLETA DE CALIFICACIONES';
  ws1.getCell('A4').font = { bold: true, size: 14, color: { argb: 'FF1E40AF' }, name: 'Arial' };
  ws1.getCell('A4').alignment = { horizontal: 'center' };

  const infoRows = [
    ['Alumno:', nombreCompleto, 'Matrícula:', alumno.matricula],
    ['Grupo:', grupo?.nombre_grupo || '-', 'Turno:', grupo?.turno || '-'],
    ['Semestre:', alumno.semestre_actual || '-', 'Periodo:', grupo?.nombre_periodo || '-'],
    ['Plan:', `${alumno.nombre_plan || '-'} ${alumno.version_plan || ''}`, 'Carrera:', alumno.nombre_carrera]
  ];

  let r = 6;
  for (const row of infoRows) {
    ws1.getCell(`A${r}`).value = row[0];
    ws1.getCell(`A${r}`).font = { bold: true, size: 10, name: 'Arial' };
    ws1.getCell(`B${r}`).value = row[1];
    ws1.getCell(`B${r}`).font = { size: 10, name: 'Arial' };
    ws1.getCell(`E${r}`).value = row[2];
    ws1.getCell(`E${r}`).font = { bold: true, size: 10, name: 'Arial' };
    ws1.getCell(`F${r}`).value = row[3];
    ws1.getCell(`F${r}`).font = { size: 10, name: 'Arial' };
    r++;
  }

  ws1.mergeCells(`A${r + 1}:H${r + 1}`);
  ws1.getCell(`A${r + 1}`).value = `Folio: ${folio}  |  Emitido: ${formatFechaMX(new Date())}  |  PREBOLETA (Documento Preliminar)`;
  ws1.getCell(`A${r + 1}`).font = { size: 8, color: { argb: 'FF475569' }, name: 'Arial' };

  // Hoja 2: Calificaciones
  const ws2 = workbook.addWorksheet('Calificaciones');

  const headers = ['#', 'ASIGNATURA', 'Clave', 'P1', 'P2', 'P3', 'Promedio', 'Estado'];
  const headerRow = ws2.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  headerRow.height = 22;

  const colW2 = [5, 38, 12, 10, 10, 10, 12, 14];
  colW2.forEach((w, i) => { ws2.getColumn(i + 1).width = w; });

  for (let i = 0; i < materias.length; i++) {
    const m = materias[i];
    const promedio = m.parcial_1 != null || m.parcial_2 != null || m.parcial_3 != null
      ? roundGrade(((m.parcial_1 || 0) + (m.parcial_2 || 0) + (m.parcial_3 || 0)) /
          [m.parcial_1, m.parcial_2, m.parcial_3].filter(g => g != null).length)
      : null;

    const dataRow = ws2.addRow([
      i + 1, m.nombre_materia, m.clave_materia,
      m.parcial_1 != null ? roundGrade(m.parcial_1) : '-',
      m.parcial_2 != null ? roundGrade(m.parcial_2) : '-',
      m.parcial_3 != null ? roundGrade(m.parcial_3) : '-',
      promedio != null ? promedio : '-',
      m.estado_calificacion || 'BORRADOR'
    ]);

    const estadoColors = {
      PUBLICADA: 'FFD1FAE5', BORRADOR: 'FFFEF3C7',
      VALIDADA: 'FFDBEAFE', CERRADA: 'FFF3F4F6'
    };
    const bgColor = estadoColors[m.estado_calificacion] || 'FFFFFFFF';

    dataRow.eachCell((cell, colNumber) => {
      cell.font = { size: 10, name: 'Arial' };
      cell.alignment = { horizontal: colNumber <= 3 ? 'left' : 'center', vertical: 'middle' };
      if (colNumber === 8) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      }
    });
    dataRow.height = 18;
  }

  // Resumen
  ws2.addRow([]);
  const fins = materias.filter(m => m.calificacion_final != null).map(m => parseFloat(m.calificacion_final));
  const promedioGeneral = fins.length > 0 ? roundGrade(fins.reduce((s, v) => s + v, 0) / fins.length) : '-';
  const aprobadas = fins.filter(v => v >= PASSING_GRADE).length;
  const noAcreditadas = fins.filter(v => v < PASSING_GRADE).length;

  ws2.addRow([`Promedio General: ${promedioGeneral}`, `Aprobadas: ${aprobadas}`, `No Acreditadas: ${noAcreditadas}`]);
  ws2.addRow([`Folio: ${folio}`, `Emitido: ${formatFechaMX(new Date())}`, 'SIVACAD-ISC v3.0 — PREBOLETA']);

  return { workbook, folio, totalMaterias: materias.length };
}

// ==============================
// 2. EXPORTAR PREBOLETA GRUPO (Excel Concentrado)
// ==============================
async function exportPreboletaGrupo(idGrupo, idPeriodo) {
  const [grupoInfo] = await pool.execute(
    `SELECT g.nombre_grupo, g.turno, p.nombre_periodo, c.nombre_carrera
     FROM grupos g
     INNER JOIN periodos p ON p.id_periodo = g.id_periodo
     INNER JOIN carreras c ON c.id_carrera = g.id_carrera
     WHERE g.id_grupo = ? LIMIT 1`,
    [idGrupo]
  );

  if (!grupoInfo.length) throw new Error('Grupo no encontrado');
  const info = grupoInfo[0];

  const [alumnos] = await pool.execute(
    `SELECT DISTINCT a.id_alumno, a.matricula, a.apellido_paterno, a.apellido_materno, a.nombres
     FROM alumnos a
     INNER JOIN grupos_alumnos ga ON ga.id_alumno = a.id_alumno
     WHERE ga.id_grupo = ? AND ga.id_periodo = ? AND ga.estado = 'ACTIVO'
     ORDER BY a.apellido_paterno, a.apellido_materno, a.nombres`,
    [idGrupo, idPeriodo]
  );

  const [materias] = await pool.execute(
    `SELECT DISTINCT m.id_materia, m.nombre_materia, m.clave_materia
     FROM materias m
     INNER JOIN cargas_academicas ca ON ca.id_materia = m.id_materia
     WHERE ca.id_grupo = ? AND ca.id_periodo = ?
     ORDER BY m.nombre_materia`,
    [idGrupo, idPeriodo]
  );

  const [calificaciones] = await pool.execute(
    `SELECT h.id_alumno, h.id_materia, h.parcial_1, h.parcial_2, h.parcial_3,
            h.promedio_parciales, h.calificacion_final, h.estado_calificacion
     FROM kardex_historial_academico h
     WHERE h.id_grupo = ? AND h.id_periodo = ?`,
    [idGrupo, idPeriodo]
  );

  const calMap = {};
  for (const c of calificaciones) {
    calMap[`${c.id_alumno}_${c.id_materia}`] = c;
  }

  const folio = generarFolio();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIVACAD';
  workbook.created = new Date();
  workbook.title = `PREBOLETA — ${info.nombre_grupo}`;

  const ws = workbook.addWorksheet('Concentrado');

  // Encabezado
  ws.mergeCells('A1:N1');
  ws.getCell('A1').value = 'TECNOLÓGICO DE ESTUDIOS SUPERIORES DE IXTAPALUCA (TESI)';
  ws.getCell('A1').font = { bold: true, size: 12, color: { argb: 'FF1E40AF' }, name: 'Arial' };
  ws.getCell('A1').alignment = { horizontal: 'center' };

  ws.mergeCells('A2:N2');
  ws.getCell('A2').value = `CONCENTRADO DE CALIFICACIONES — ${info.nombre_grupo} — ${info.nombre_periodo}`;
  ws.getCell('A2').font = { size: 10, color: { argb: 'FF374151' }, name: 'Arial' };
  ws.getCell('A2').alignment = { horizontal: 'center' };

  ws.mergeCells('A3:N3');
  ws.getCell('A3').value = `Carrera: ${info.nombre_carrera}  |  Turno: ${info.turno}  |  Folio: ${folio}`;
  ws.getCell('A3').font = { size: 9, color: { argb: 'FF64748B' }, name: 'Arial' };
  ws.getCell('A3').alignment = { horizontal: 'center' };

  // Headers de materias
  const matHeaders = ['#', 'Matrícula', 'Alumno'];
  for (const m of materias) {
    matHeaders.push(m.nombre_materia.substring(0, 12));
  }
  matHeaders.push('Promedio');

  const headerRow = ws.addRow(matHeaders);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 8, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  headerRow.height = 32;

  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 14;
  ws.getColumn(3).width = 30;
  for (let i = 0; i < materias.length; i++) {
    ws.getColumn(4 + i).width = 12;
  }
  ws.getColumn(4 + materias.length).width = 10;

  // Datos
  for (let i = 0; i < alumnos.length; i++) {
    const al = alumnos[i];
    const row = [i + 1, al.matricula, `${al.apellido_paterno} ${al.apellido_materno} ${al.nombres}`];

    const fins = [];
    for (const m of materias) {
      const cal = calMap[`${al.id_alumno}_${m.id_materia}`];
      const val = cal ? (cal.parcial_1 != null ? roundGrade(cal.parcial_1) : '-') : '-';
      row.push(val);
      if (cal && cal.calificacion_final != null) fins.push(parseFloat(cal.calificacion_final));
    }

    const promedio = fins.length > 0 ? roundGrade(fins.reduce((s, v) => s + v, 0) / fins.length) : '-';
    row.push(promedio);

    const dataRow = ws.addRow(row);
    dataRow.eachCell((cell, colNumber) => {
      cell.font = { size: 9, name: 'Arial' };
      cell.alignment = { horizontal: colNumber <= 3 ? 'left' : 'center', vertical: 'middle' };
    });
    dataRow.height = 16;
  }

  return { workbook, folio, totalAlumnos: alumnos.length };
}

// ==============================
// 3. EXPORTAR BOLETA ALUMNO (Excel)
// ==============================
async function exportBoletaAlumno(idAlumno, idPeriodo) {
  const boletaService = require('./boletaService');
  const data = await boletaService.buildBoletaAlumno(idAlumno, idPeriodo);

  const folio = generarFolio();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIVACAD';
  workbook.created = new Date();
  workbook.title = 'BOLETA DE CALIFICACIONES';

  // Hoja 1: Portada / Datos del alumno
  const ws1 = workbook.addWorksheet('Boleta', {
    headerFooter: {
      oddHeader: '&C&"Arial"&8 SIVACAD — Boleta de Calificaciones',
      oddFooter: `&L${formatFechaMX(new Date())}&CFolio: ${folio}&RBoleta`
    }
  });

  ws1.pageSetup.margins = { top: 1.5, bottom: 1.5, left: 1.5, right: 1.5, header: 0, footer: 0 };
  ws1.views = [{ showGridLines: false }];

  const colW = [3, 35, 10, 10, 10, 12, 12, 14];
  colW.forEach((w, i) => { ws1.getColumn(i + 1).width = w; });

  ws1.mergeCells('A2:H2');
  ws1.getCell('A2').value = data.institucion.nombre;
  ws1.getCell('A2').font = { bold: true, size: 13, color: { argb: 'FF1E40AF' }, name: 'Arial' };
  ws1.getCell('A2').alignment = { horizontal: 'center' };

  ws1.mergeCells('A3:H3');
  ws1.getCell('A3').value = data.institucion.carrera;
  ws1.getCell('A3').font = { size: 10, color: { argb: 'FF64748B' }, name: 'Arial' };
  ws1.getCell('A3').alignment = { horizontal: 'center' };

  ws1.mergeCells('A4:H4');
  ws1.getCell('A4').value = 'BOLETA DE CALIFICACIONES';
  ws1.getCell('A4').font = { bold: true, size: 14, color: { argb: 'FF1E40AF' }, name: 'Arial' };
  ws1.getCell('A4').alignment = { horizontal: 'center' };

  const infoRows = [
    ['Alumno:', data.alumno.nombre_completo, 'Matrícula:', data.alumno.matricula],
    ['Carrera:', data.alumno.nombre_carrera, 'Plan:', `${data.alumno.nombre_plan || '—'} ${data.alumno.version_plan || ''}`],
    ['Semestre:', data.alumno.semestre_actual || '—', 'Grupo:', data.grupo?.nombre_grupo || '—'],
    ['Turno:', data.grupo?.turno || '—', 'Periodo:', data.periodo || '—'],
    ['Promedio General:', data.alumno.promedio_general != null ? Number(data.alumno.promedio_general).toFixed(2) : '—',
     'Créditos:', data.alumno.creditos_acumulados || 0],
    ['Estatus:', data.alumno.estatus_academico || 'Regular', '', '']
  ];

  let r = 6;
  for (const row of infoRows) {
    ws1.getCell(`A${r}`).value = row[0];
    ws1.getCell(`A${r}`).font = { bold: true, size: 10, name: 'Arial' };
    ws1.getCell(`B${r}`).value = row[1];
    ws1.getCell(`B${r}`).font = { size: 10, name: 'Arial' };
    ws1.getCell(`E${r}`).value = row[2];
    ws1.getCell(`E${r}`).font = { bold: true, size: 10, name: 'Arial' };
    ws1.getCell(`F${r}`).value = row[3];
    ws1.getCell(`F${r}`).font = { size: 10, name: 'Arial' };
    r++;
  }

  ws1.mergeCells(`A${r + 1}:H${r + 1}`);
  ws1.getCell(`A${r + 1}`).value = `Folio: ${folio}  |  Emitido: ${formatFechaMX(new Date())}  |  BOLETA OFICIAL DE CALIFICACIONES`;
  ws1.getCell(`A${r + 1}`).font = { size: 8, color: { argb: 'FF475569' }, name: 'Arial' };

  // Hoja 2: Calificaciones por periodo
  const ws2 = workbook.addWorksheet('Calificaciones');

  const headers = ['#', 'MATERIA', 'DOCENTE', 'P1', 'P2', 'P3', 'FINAL', 'ESTADO'];
  const headerRow = ws2.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  headerRow.height = 22;

  const colW2 = [5, 38, 25, 10, 10, 10, 12, 14];
  colW2.forEach((w, i) => { ws2.getColumn(i + 1).width = w; });

  let numMateria = 0;
  for (const per of data.periodos) {
    ws2.addRow([]);
    const periodHeader = ws2.addRow([`PERIODO: ${per.nombre_periodo} — Promedio: ${per.promedio_periodo != null ? Number(per.promedio_periodo).toFixed(1) : '—'} — Aprobadas: ${per.aprobadas} — No Acreditadas: ${per.no_acreditadas}`]);
    ws2.mergeCells(periodHeader.number, 1, periodHeader.number, 8);
    periodHeader.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF1E40AF' }, name: 'Arial' };
    periodHeader.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };

    for (const m of per.materias) {
      numMateria++;
      const dataRow = ws2.addRow([
        numMateria,
        m.nombre_materia,
        m.nombre_docente,
        m.parcial_1 != null ? Number(m.parcial_1).toFixed(1) : '—',
        m.parcial_2 != null ? Number(m.parcial_2).toFixed(1) : '—',
        m.parcial_3 != null ? Number(m.parcial_3).toFixed(1) : '—',
        m.calificacion_final != null ? Number(m.calificacion_final).toFixed(1) : '—',
        m.estado
      ]);

      const estadoColors = {
        'Acreditada': 'FFD1FAE5', 'No Acreditada': 'FFFEE2E2'
      };
      const bgColor = estadoColors[m.estado] || 'FFFFFFFF';

      dataRow.eachCell((cell, colNumber) => {
        cell.font = { size: 9, name: 'Arial' };
        cell.alignment = { horizontal: colNumber <= 3 ? 'left' : 'center', vertical: 'middle' };
        if (colNumber === 8) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
          cell.font = { bold: true, size: 9, name: 'Arial' };
        }
      });
      dataRow.height = 16;
    }
  }

  // Resumen
  ws2.addRow([]);
  const resumenRow = ws2.addRow([
    `Promedio General: ${data.resumen.promedio_general != null ? Number(data.resumen.promedio_general).toFixed(1) : '—'}`,
    `Aprobadas: ${data.resumen.materias_aprobadas}`,
    `No Acreditadas: ${data.resumen.materias_no_acreditadas}`,
    `Faltas: ${data.resumen.faltas_totales}`,
    `Créditos: ${data.resumen.creditos_acumulados}`
  ]);
  resumenRow.eachCell(cell => { cell.font = { bold: true, size: 9, name: 'Arial' }; });

  ws2.addRow([]);
  ws2.addRow([`Folio: ${folio}`, `Emitido: ${formatFechaMX(new Date())}`, 'SIVACAD-ISC v3.0 — BOLETA OFICIAL']);

  return { workbook, folio, totalMaterias: data.materias.length };
}

module.exports = {
  exportPreboletaAlumno,
  exportPreboletaGrupo,
  exportBoletaAlumno,
  roundGrade,
  formatFechaMX,
  generarFolio
};
