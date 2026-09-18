'use strict';

// backend/src/services/academicExportService.js
// SERVICIO UNIFICADO DE EXPORTACIÓN ACADÉMICA — SIVACAD-ISC
// 10 exportaciones Excel concentradas en un solo servicio.
// FASE 2-4: Arquitectura + Implementación

const {
  roundGrade, calculateAverage, formatGrade, formatFechaMX, generarFolio,
  INSTITUTIONAL, ESTADO_COLORS, createWorkbook, styleHeaderRow, styleDataRow,
  applyEstadoColor, styleTitle, styleSubtitle, setColumnWidths, addFolioRow,
  getAlumnoById, getAlumnosByGrupo, getGrupoInfo, getPeriodoInfo,
  getMateriasByGrupo, getCalificacionesByGrupoMateria,
  getCalificacionesByAlumnoPeriodo, PASSING_GRADE, pool
} = require('../helpers/excelHelpers');

// ==============================
// 1. CONCENTRADO GENERAL (CON / SÁBANA)
// ==============================
async function exportConcentradoGeneral(idGrupo, idPeriodo) {
  const grupo = await getGrupoInfo(idGrupo);
  if (!grupo) throw new Error('Grupo no encontrado');
  const periodo = await getPeriodoInfo(idPeriodo);
  const alumnos = await getAlumnosByGrupo(idGrupo, idPeriodo);
  const materias = await getMateriasByGrupo(idGrupo, idPeriodo);

  const [calificaciones] = await pool.execute(
    `SELECT * FROM kardex_historial_academico
     WHERE id_grupo = ? AND id_periodo = ?`,
    [idGrupo, idPeriodo]
  );

  const calMap = {};
  for (const c of calificaciones) calMap[`${c.id_alumno}_${c.id_materia}`] = c;

  const folio = generarFolio('CON');
  const wb = createWorkbook(
    `CONCENTRADO - ${grupo.nombre_grupo}`,
    `Concentrado ${grupo.nombre_grupo} - ${periodo?.nombre_periodo || idPeriodo}`
  );

  const ws = wb.addWorksheet('CON', {
    headerFooter: {
      oddHeader: `&C&"Arial"&8 ${INSTITUTIONAL.tesi}`,
      oddFooter: `&L${formatFechaMX(new Date())}&CFolio: ${folio}&R${INSTITUTIONAL.carrera}`
    }
  });

  ws.pageSetup.margins = { top: 1.2, bottom: 1.2, left: 0.8, right: 0.8, header: 0, footer: 0 };
  ws.views = [{ showGridLines: false }];

  // Encabezado institucional
  ws.mergeCells('A1:J1');
  ws.getCell('A1').value = INSTITUTIONAL.tesi;
  ws.getCell('A1').font = { bold: true, size: 12, color: { argb: INSTITUTIONAL.azulInstitucional }, name: 'Arial' };
  ws.getCell('A1').alignment = { horizontal: 'center' };

  ws.mergeCells('A2:J2');
  ws.getCell('A2').value = INSTITUTIONAL.carrera;
  ws.getCell('A2').font = { size: 10, color: { argb: INSTITUTIONAL.grisClaro }, name: 'Arial' };
  ws.getCell('A2').alignment = { horizontal: 'center' };

  ws.mergeCells('A3:J3');
  ws.getCell('A3').value = `CONCENTRADO GENERAL DE CALIFICACIONES — ${grupo.nombre_grupo}`;
  ws.getCell('A3').font = { bold: true, size: 13, color: { argb: INSTITUTIONAL.azulInstitucional }, name: 'Arial' };
  ws.getCell('A3').alignment = { horizontal: 'center' };

  ws.mergeCells('A4:J4');
  ws.getCell('A4').value = `Período: ${periodo?.nombre_periodo || idPeriodo}  |  Turno: ${grupo.turno || '-'}  |  Carrera: ${grupo.nombre_carrera || '-'}`;
  ws.getCell('A4').font = { size: 9, color: { argb: INSTITUTIONAL.grisClaro }, name: 'Arial' };
  ws.getCell('A4').alignment = { horizontal: 'center' };

  addFolioRow(ws, 5, 10, folio, `Grupo: ${grupo.nombre_grupo}`);

  // Headers dinámicos: # | MATRÍCULA | ALUMNO | [MATERIAS...] | PROMEDIO
  const numCols = materias.length + 4;
  const headers = ['#', 'MATRÍCULA', 'ALUMNO'];
  for (const m of materias) headers.push(m.nombre_materia);
  headers.push('PROMEDIO');

  ws.addRow([]);
  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow, { fontSize: 8, height: 30 });

  // Column widths
  const colW = [4, 14, 30];
  for (let i = 0; i < materias.length; i++) colW.push(10);
  colW.push(10);
  setColumnWidths(ws, colW);

  // Datos
  let idx = 0;
  for (const al of alumnos) {
    idx++;
    const row = [idx, al.matricula, `${al.apellido_paterno} ${al.apellido_materno} ${al.nombres}`];
    const promedios = [];
    for (const m of materias) {
      const cal = calMap[`${al.id_alumno}_${m.id_materia}`];
      const val = cal ? formatGrade(cal.calificacion_final) : '-';
      row.push(val);
      if (cal?.calificacion_final != null) promedios.push(parseFloat(cal.calificacion_final));
    }
    const promedio = promedios.length > 0
      ? roundGrade(promedios.reduce((s, v) => s + v, 0) / promedios.length)
      : '-';
    row.push(promedio);

    const dataRow = ws.addRow(row);
    styleDataRow(dataRow, { fontSize: 8, centerColumns: [1, 2, ...Array.from({ length: materias.length }, (_, i) => i + 4), numCols] });

    // Color de fila si hay promedio reprobado
    if (promedio !== '-' && promedio < PASSING_GRADE) {
      dataRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      });
    }
  }

  // Fila de estadísticas por materia
  ws.addRow([]);
  const statsRow = ['MATERIA', '', ''];
  for (const m of materias) {
    const vals = alumnos.map(al => {
      const cal = calMap[`${al.id_alumno}_${m.id_materia}`];
      return cal?.calificacion_final != null ? parseFloat(cal.calificacion_final) : null;
    }).filter(v => v != null);
    const avg = vals.length > 0 ? roundGrade(vals.reduce((s, v) => s + v, 0) / vals.length) : '-';
    statsRow.push(avg);
  }
  statsRow.push('');
  const sr = ws.addRow(statsRow);
  sr.getCell(1).font = { bold: true, size: 8, name: 'Arial', color: { argb: INSTITUTIONAL.azulInstitucional } };

  // % Aprobación
  const aprRow = ['% APROBACIÓN', '', ''];
  for (const m of materias) {
    const vals = alumnos.map(al => {
      const cal = calMap[`${al.id_alumno}_${m.id_materia}`];
      return cal?.calificacion_final != null ? parseFloat(cal.calificacion_final) : null;
    }).filter(v => v != null);
    const apr = vals.length > 0 ? `${Math.round(vals.filter(v => v >= PASSING_GRADE).length / vals.length * 100)}%` : '-';
    aprRow.push(apr);
  }
  aprRow.push('');
  ws.addRow(aprRow);

  // Resumen final
  ws.addRow([]);
  ws.addRow([`Folio: ${folio}`, `Emitido: ${formatFechaMX(new Date())}`, INSTITUTIONAL.version, `Total Alumnos: ${alumnos.length}`, `Total Materias: ${materias.length}`]);

  return { workbook: wb, folio, totalAlumnos: alumnos.length, totalMaterias: materias.length };
}

// ==============================
// 2-4. CONCENTRADO PARCIAL (P1, P2, P3)
// ==============================
async function exportConcentradoParcial(idGrupo, idPeriodo, parcial) {
  if (![1, 2, 3].includes(parcial)) throw new Error('Parcial inválido (1-3)');

  const grupo = await getGrupoInfo(idGrupo);
  if (!grupo) throw new Error('Grupo no encontrado');
  const periodo = await getPeriodoInfo(idPeriodo);
  const alumnos = await getAlumnosByGrupo(idGrupo, idPeriodo);
  const materias = await getMateriasByGrupo(idGrupo, idPeriodo);

  const parcialCol = `parcial_${parcial}`;

  const [calificaciones] = await pool.execute(
    `SELECT * FROM kardex_historial_academico
     WHERE id_grupo = ? AND id_periodo = ?`,
    [idGrupo, idPeriodo]
  );

  const calMap = {};
  for (const c of calificaciones) calMap[`${c.id_alumno}_${c.id_materia}`] = c;

  const folio = generarFolio(`P${parcial}`);
  const wb = createWorkbook(
    `CONCENTRADO P${parcial} - ${grupo.nombre_grupo}`,
    `Concentrado Parcial ${parcial} - ${grupo.nombre_grupo} - ${periodo?.nombre_periodo || idPeriodo}`
  );

  const ws = wb.addWorksheet(`P${parcial}`, {
    headerFooter: {
      oddHeader: `&C&"Arial"&8 ${INSTITUTIONAL.tesi} — Parcial ${parcial}`,
      oddFooter: `&L${formatFechaMX(new Date())}&CFolio: ${folio}&RSIVACAD-ISC`
    }
  });

  ws.pageSetup.margins = { top: 1.2, bottom: 1.2, left: 0.8, right: 0.8, header: 0, footer: 0 };
  ws.views = [{ showGridLines: false }];

  // Encabezado
  ws.mergeCells('A1:J1');
  ws.getCell('A1').value = INSTITUTIONAL.tesi;
  ws.getCell('A1').font = { bold: true, size: 12, color: { argb: INSTITUTIONAL.azulInstitucional }, name: 'Arial' };
  ws.getCell('A1').alignment = { horizontal: 'center' };

  ws.mergeCells('A2:J2');
  ws.getCell('A2').value = INSTITUTIONAL.carrera;
  ws.getCell('A2').font = { size: 10, color: { argb: INSTITUTIONAL.grisClaro }, name: 'Arial' };
  ws.getCell('A2').alignment = { horizontal: 'center' };

  ws.mergeCells('A3:J3');
  ws.getCell('A3').value = `CONCENTRADO PARCIAL ${parcial} — ${grupo.nombre_grupo}`;
  ws.getCell('A3').font = { bold: true, size: 13, color: { argb: INSTITUTIONAL.azulInstitucional }, name: 'Arial' };
  ws.getCell('A3').alignment = { horizontal: 'center' };

  ws.mergeCells('A4:J4');
  ws.getCell('A4').value = `Período: ${periodo?.nombre_periodo || idPeriodo}  |  Turno: ${grupo.turno || '-'}  |  Materia(s): ${materias.length}`;
  ws.getCell('A4').font = { size: 9, color: { argb: INSTITUTIONAL.grisClaro }, name: 'Arial' };
  ws.getCell('A4').alignment = { horizontal: 'center' };

  addFolioRow(ws, 5, 10, folio, `Parcial ${parcial}`);

  ws.addRow([]);
  const headers = ['#', 'MATRÍCULA', 'ALUMNO'];
  for (const m of materias) headers.push(m.nombre_materia);
  headers.push('PROM. PARCIAL');

  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow, { fontSize: 8, height: 30 });

  const colW = [4, 14, 30];
  for (let i = 0; i < materias.length; i++) colW.push(10);
  colW.push(10);
  setColumnWidths(ws, colW);

  let idx = 0;
  for (const al of alumnos) {
    idx++;
    const row = [idx, al.matricula, `${al.apellido_paterno} ${al.apellido_materno} ${al.nombres}`];
    const vals = [];
    for (const m of materias) {
      const cal = calMap[`${al.id_alumno}_${m.id_materia}`];
      const val = cal ? formatGrade(cal[parcialCol]) : '-';
      row.push(val);
      if (cal?.[parcialCol] != null) vals.push(parseFloat(cal[parcialCol]));
    }
    const promP = vals.length > 0 ? roundGrade(vals.reduce((s, v) => s + v, 0) / vals.length) : '-';
    row.push(promP);

    const dataRow = ws.addRow(row);
    styleDataRow(dataRow, { fontSize: 8, centerColumns: [1, 2, ...Array.from({ length: materias.length }, (_, i) => i + 4), materias.length + 4] });
  }

  // Estadísticas
  ws.addRow([]);
  for (const m of materias) {
    const vals = alumnos.map(al => {
      const cal = calMap[`${al.id_alumno}_${m.id_materia}`];
      return cal?.[parcialCol] != null ? parseFloat(cal[parcialCol]) : null;
    }).filter(v => v != null);
    if (vals.length === 0) continue;
    const avg = roundGrade(vals.reduce((s, v) => s + v, 0) / vals.length);
    const max_ = Math.max(...vals);
    const min_ = Math.min(...vals);
    const apr = Math.round(vals.filter(v => v >= PASSING_GRADE).length / vals.length * 100);
    ws.addRow([m.nombre_materia, `Prom: ${avg}`, `Max: ${max_}`, `Min: ${min_}`, `%Apr: ${apr}%`]);
  }

  ws.addRow([]);
  ws.addRow([`Folio: ${folio}`, `Emitido: ${formatFechaMX(new Date())}`, INSTITUTIONAL.version, `Parcial ${parcial}`, `Alumnos: ${alumnos.length}`]);

  return { workbook: wb, folio, totalAlumnos: alumnos.length, parcial };
}

// ==============================
// 5. CONCENTRADO GENERAL DEL PERÍODO (PG)
// ==============================
async function exportConcentradoPeriodo(idPeriodo) {
  const periodo = await getPeriodoInfo(idPeriodo);

  const [grupos] = await pool.execute(
    `SELECT DISTINCT g.id_grupo, g.nombre_grupo, g.turno
     FROM kardex_historial_academico h
     INNER JOIN grupos g ON g.id_grupo = h.id_grupo
     WHERE h.id_periodo = ?
     ORDER BY g.nombre_grupo`,
    [idPeriodo]
  );

  const folio = generarFolio('PG');
  const wb = createWorkbook(
    `CONCENTRADO PERÍODO - ${periodo?.nombre_periodo || idPeriodo}`,
    `Concentrado General del Periodo ${periodo?.nombre_periodo || idPeriodo}`
  );

  const ws = wb.addWorksheet('PG', {
    headerFooter: {
      oddHeader: `&C&"Arial"&8 ${INSTITUTIONAL.tesi} — Periodo ${periodo?.nombre_periodo || idPeriodo}`,
      oddFooter: `&L${formatFechaMX(new Date())}&CFolio: ${folio}&RSIVACAD-ISC`
    }
  });

  ws.pageSetup.margins = { top: 1.2, bottom: 1.2, left: 0.8, right: 0.8, header: 0, footer: 0 };
  ws.views = [{ showGridLines: false }];

  ws.mergeCells('A1:H1');
  ws.getCell('A1').value = INSTITUTIONAL.tesi;
  ws.getCell('A1').font = { bold: true, size: 12, color: { argb: INSTITUTIONAL.azulInstitucional }, name: 'Arial' };
  ws.getCell('A1').alignment = { horizontal: 'center' };

  ws.mergeCells('A2:H2');
  ws.getCell('A2').value = `RESUMEN GENERAL DE CALIFICACIONES — PERÍODO ${periodo?.nombre_periodo || idPeriodo}`;
  ws.getCell('A2').font = { bold: true, size: 13, color: { argb: INSTITUTIONAL.azulInstitucional }, name: 'Arial' };
  ws.getCell('A2').alignment = { horizontal: 'center' };

  addFolioRow(ws, 3, 8, folio);

  ws.addRow([]);
  const headers = ['Grupo', 'Turno', 'Total Alumnos', 'Total Materias', 'Promedio General', 'Aprobados', 'Reprobados', '% Aprobación'];
  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow);

  setColumnWidths(ws, [18, 10, 14, 14, 16, 12, 12, 14]);

  let totalAl = 0, totalMat = 0, totalApr = 0, totalRep = 0;

  for (const g of grupos) {
    const [stats] = await pool.execute(
      `SELECT COUNT(DISTINCT h.id_alumno) AS total_alumnos,
              COUNT(*) AS total_materias,
              ROUND(AVG(h.calificacion_final), 2) AS promedio,
              SUM(CASE WHEN h.calificacion_final >= ${PASSING_GRADE} THEN 1 ELSE 0 END) AS aprobados,
              SUM(CASE WHEN h.calificacion_final < ${PASSING_GRADE} THEN 1 ELSE 0 END) AS reprobados
       FROM kardex_historial_academico h
       WHERE h.id_grupo = ? AND h.id_periodo = ? AND h.calificacion_final IS NOT NULL`,
      [g.id_grupo, idPeriodo]
    );

    const s = stats[0];
    const al = s.total_alumnos || 0;
    const mat = s.total_materias || 0;
    const apr = s.aprobados || 0;
    const rep = s.reprobados || 0;
    const prom = s.promedio != null ? Number(s.promedio).toFixed(2) : '-';
    const pctApr = mat > 0 ? `${Math.round((apr / mat) * 100)}%` : '-';

    totalAl += al; totalMat += mat; totalApr += apr; totalRep += rep;

    const dataRow = ws.addRow([g.nombre_grupo, g.turno || '-', al, mat, prom, apr, rep, pctApr]);
    styleDataRow(dataRow, { centerColumns: [2, 3, 4, 5, 6, 7, 8] });
  }

  ws.addRow([]);
  const totalRow = ws.addRow([
    'TOTAL GENERAL', '-', totalAl, totalMat,
    totalMat > 0 ? `${(totalApr / totalMat).toFixed(2)}` : '-',
    totalApr, totalRep,
    totalMat > 0 ? `${Math.round((totalApr / totalMat) * 100)}%` : '-'
  ]);
  totalRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, name: 'Arial', color: { argb: INSTITUTIONAL.azulInstitucional } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INSTITUTIONAL.azulClaro } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  ws.addRow([]);
  ws.addRow([`Folio: ${folio}`, `Emitido: ${formatFechaMX(new Date())}`, INSTITUTIONAL.version, `Grupos: ${grupos.length}`]);

  return { workbook: wb, folio, totalGrupos: grupos.length, totalAlumnos: totalAl };
}

// ==============================
// 6. PREBOLETA INDIVIDUAL (Excel)
// ==============================
async function exportPreboletaIndividual(idAlumno, idPeriodo) {
  const alumno = await getAlumnoById(idAlumno);
  if (!alumno) throw new Error('Alumno no encontrado');
  if (!idPeriodo) throw new Error('Período requerido');

  const materias = await getCalificacionesByAlumnoPeriodo(idAlumno, idPeriodo, false);

  const nombreCompleto = `${alumno.apellido_paterno || ''} ${alumno.apellido_materno || ''} ${alumno.nombres || ''}`.replace(/\s+/g, ' ').trim();
  const folio = generarFolio('PRE');

  const wb = createWorkbook('PREBOLETA DE CALIFICACIONES', `Preboleta - ${nombreCompleto}`);
  const ws = wb.addWorksheet('Preboleta', {
    headerFooter: {
      oddHeader: `&C&"Arial"&8 ${INSTITUTIONAL.tesi} — Preboleta`,
      oddFooter: `&L${formatFechaMX(new Date())}&CFolio: ${folio}&RPreboleta`
    }
  });

  ws.pageSetup.margins = { top: 1.5, bottom: 1.5, left: 1.2, right: 1.2, header: 0, footer: 0 };
  ws.views = [{ showGridLines: false }];

  setColumnWidths(ws, [3, 35, 10, 10, 10, 12, 12, 14]);

  // Encabezado
  ws.mergeCells('A2:H2');
  ws.getCell('A2').value = INSTITUTIONAL.tesi;
  ws.getCell('A2').font = { bold: true, size: 13, color: { argb: INSTITUTIONAL.azulInstitucional }, name: 'Arial' };
  ws.getCell('A2').alignment = { horizontal: 'center' };

  ws.mergeCells('A3:H3');
  ws.getCell('A3').value = INSTITUTIONAL.carrera;
  ws.getCell('A3').font = { size: 10, color: { argb: INSTITUTIONAL.grisClaro }, name: 'Arial' };
  ws.getCell('A3').alignment = { horizontal: 'center' };

  ws.mergeCells('A4:H4');
  ws.getCell('A4').value = 'PREBOLETA DE CALIFICACIONES';
  ws.getCell('A4').font = { bold: true, size: 14, color: { argb: INSTITUTIONAL.azulInstitucional }, name: 'Arial' };
  ws.getCell('A4').alignment = { horizontal: 'center' };

  // Datos del alumno
  const infoRows = [
    ['Alumno:', nombreCompleto, 'Matrícula:', alumno.matricula],
    ['Grupo:', materias[0]?.nombre_grupo || '-', 'Turno:', materias[0]?.turno || '-'],
    ['Semestre:', alumno.semestre_actual || '-', 'Periodo:', materias[0]?.nombre_periodo || '-'],
    ['Plan:', `${alumno.nombre_plan || '-'} ${alumno.version_plan || ''}`, 'Carrera:', alumno.nombre_carrera]
  ];

  let r = 6;
  for (const row of infoRows) {
    ws.getCell(`A${r}`).value = row[0];
    ws.getCell(`A${r}`).font = { bold: true, size: 10, name: 'Arial' };
    ws.getCell(`B${r}`).value = row[1];
    ws.getCell(`B${r}`).font = { size: 10, name: 'Arial' };
    ws.getCell(`E${r}`).value = row[2];
    ws.getCell(`E${r}`).font = { bold: true, size: 10, name: 'Arial' };
    ws.getCell(`F${r}`).value = row[3];
    ws.getCell(`F${r}`).font = { size: 10, name: 'Arial' };
    r++;
  }

  addFolioRow(ws, r + 1, 8, folio, 'PREBOLETA (Documento Preliminar)');

  // Hoja de calificaciones
  const ws2 = wb.addWorksheet('Calificaciones');

  const headers = ['#', 'ASIGNATURA', 'Clave', 'P1', 'P2', 'P3', 'Promedio', 'Estado'];
  const headerRow = ws2.addRow(headers);
  styleHeaderRow(headerRow);

  setColumnWidths(ws2, [5, 38, 12, 10, 10, 10, 12, 14]);

  for (let i = 0; i < materias.length; i++) {
    const m = materias[i];
    const promedio = calculateAverage(m.parcial_1, m.parcial_2, m.parcial_3);
    const dataRow = ws2.addRow([
      i + 1, m.nombre_materia, m.clave_materia,
      formatGrade(m.parcial_1), formatGrade(m.parcial_2), formatGrade(m.parcial_3),
      promedio != null ? promedio : '-',
      m.estado_calificacion || 'BORRADOR'
    ]);
    const estadoCell = dataRow.getCell(8);
    applyEstadoColor(estadoCell, m.estado_calificacion);
    styleDataRow(dataRow, { fontSize: 10, centerColumns: [1, 3, 4, 5, 6, 7, 8] });
  }

  ws2.addRow([]);
  const fins = materias.filter(m => m.calificacion_final != null).map(m => parseFloat(m.calificacion_final));
  const promedioGeneral = fins.length > 0 ? roundGrade(fins.reduce((s, v) => s + v, 0) / fins.length) : '-';
  const aprobadas = fins.filter(v => v >= PASSING_GRADE).length;
  const noAcreditadas = fins.filter(v => v < PASSING_GRADE).length;

  ws2.addRow([`Promedio General: ${promedioGeneral}`, `Aprobadas: ${aprobadas}`, `No Acreditadas: ${noAcreditadas}`]);
  ws2.addRow([`Folio: ${folio}`, `Emitido: ${formatFechaMX(new Date())}`, `${INSTITUTIONAL.version} — PREBOLETA`]);

  return { workbook: wb, folio, totalMaterias: materias.length };
}

// ==============================
// 7. BOLETA INDIVIDUAL (Excel)
// ==============================
async function exportBoletaIndividual(idAlumno, idPeriodo) {
  const alumno = await getAlumnoById(idAlumno);
  if (!alumno) throw new Error('Alumno no encontrado');

  const materias = await getCalificacionesByAlumnoPeriodo(idAlumno, idPeriodo, true);

  const nombreCompleto = `${alumno.apellido_paterno || ''} ${alumno.apellido_materno || ''} ${alumno.nombres || ''}`.replace(/\s+/g, ' ').trim();
  const folio = generarFolio('BOL');

  const wb = createWorkbook('BOLETA DE CALIFICACIONES', `Boleta - ${nombreCompleto}`);
  const ws = wb.addWorksheet('Boleta', {
    headerFooter: {
      oddHeader: `&C&"Arial"&8 ${INSTITUTIONAL.tesi} — Boleta Oficial`,
      oddFooter: `&L${formatFechaMX(new Date())}&CFolio: ${folio}&RBoleta Oficial`
    }
  });

  ws.pageSetup.margins = { top: 1.5, bottom: 1.5, left: 1.2, right: 1.2, header: 0, footer: 0 };
  ws.views = [{ showGridLines: false }];

  setColumnWidths(ws, [3, 18, 40, 12, 12, 12, 14, 14, 14]);

  // Encabezado
  styleTitle(ws, 'A2', 'BOLETA DE CALIFICACIONES', 'I2');
  styleSubtitle(ws, 'A3', INSTITUTIONAL.sistema, 'I3');

  ws.getCell('A5').value = 'Alumno:';
  ws.getCell('A5').font = { bold: true, size: 10, name: 'Arial' };
  ws.getCell('B5').value = nombreCompleto;
  ws.getCell('B5').font = { size: 10, name: 'Arial' };

  ws.getCell('A6').value = 'Matrícula:';
  ws.getCell('A6').font = { bold: true, size: 10, name: 'Arial' };
  ws.getCell('B6').value = alumno.matricula;
  ws.getCell('B6').font = { size: 10, name: 'Arial' };

  ws.getCell('E5').value = 'Carrera:';
  ws.getCell('E5').font = { bold: true, size: 10, name: 'Arial' };
  ws.getCell('F5').value = alumno.nombre_carrera;
  ws.getCell('F5').font = { size: 10, name: 'Arial' };

  ws.getCell('E6').value = 'Promedio:';
  ws.getCell('E6').font = { bold: true, size: 10, name: 'Arial' };
  ws.getCell('F6').value = alumno.promedio_general != null ? Number(alumno.promedio_general).toFixed(2) : 'N/A';
  ws.getCell('F6').font = { size: 10, name: 'Arial' };

  addFolioRow(ws, 8, 9, folio, `Periodo: ${materias[0]?.nombre_periodo || 'TODOS'}`);

  // Hoja calificaciones
  const ws2 = wb.addWorksheet('Calificaciones');
  const headers = ['#', 'Materia', 'Clave', 'P1', 'P2', 'P3', 'Promedio', 'Final', 'Estado'];
  const headerRow = ws2.addRow(headers);
  styleHeaderRow(headerRow);

  setColumnWidths(ws2, [5, 35, 12, 10, 10, 10, 12, 12, 14]);

  let currentPeriodo = null;
  let idx = 0;

  for (const m of materias) {
    if (m.nombre_periodo !== currentPeriodo) {
      currentPeriodo = m.nombre_periodo;
      const sepRow = ws2.addRow([`── ${currentPeriodo} ──`, '', '', '', '', '', '', '', '']);
      ws2.mergeCells(sepRow.number, 1, sepRow.number, 9);
      sepRow.getCell(1).font = { bold: true, size: 10, color: { argb: INSTITUTIONAL.azulInstitucional }, name: 'Arial' };
      sepRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INSTITUTIONAL.azulClaro } };
    }

    idx++;
    const dataRow = ws2.addRow([
      idx, m.nombre_materia, m.clave_materia,
      formatGrade(m.calificacion_parcial_1), formatGrade(m.calificacion_parcial_2), formatGrade(m.calificacion_parcial_3),
      formatGrade(m.promedio_calculado), formatGrade(m.calificacion_final),
      m.estado_calificacion || '-'
    ]);
    const estadoCell = dataRow.getCell(9);
    applyEstadoColor(estadoCell, m.estado_calificacion);
    styleDataRow(dataRow, { fontSize: 10, centerColumns: [1, 3, 4, 5, 6, 7, 8, 9] });
  }

  ws2.addRow([]);
  ws2.addRow([`Folio: ${folio}`, `Emitido: ${formatFechaMX(new Date())}`, INSTITUTIONAL.version]);

  return { workbook: wb, folio, totalMaterias: materias.length };
}

// ==============================
// 8. HISTORIAL ACADÉMICO (Excel)
// ==============================
async function exportHistorialAcademico(idAlumno) {
  const alumno = await getAlumnoById(idAlumno);
  if (!alumno) throw new Error('Alumno no encontrado');

  const [materias] = await pool.execute(
    `SELECT h.*, m.nombre_materia, m.clave_materia, m.creditos, m.semestre_sugerido,
            p.nombre_periodo, g.nombre_grupo
     FROM kardex_historial_academico h
     INNER JOIN materias m ON m.id_materia = h.id_materia
     INNER JOIN periodos p ON p.id_periodo = h.id_periodo
     INNER JOIN grupos g ON g.id_grupo = h.id_grupo
     WHERE h.id_alumno = ? AND h.estado_calificacion = 'PUBLICADA'
     ORDER BY p.nombre_periodo, m.semestre_sugerido, m.nombre_materia`,
    [idAlumno]
  );

  const nombreCompleto = `${alumno.apellido_paterno || ''} ${alumno.apellido_materno || ''} ${alumno.nombres || ''}`.replace(/\s+/g, ' ').trim();
  const folio = generarFolio('HIST');

  const wb = createWorkbook('HISTORIAL ACADÉMICO', `Historial - ${nombreCompleto}`);
  const ws = wb.addWorksheet('Historial', {
    headerFooter: {
      oddHeader: `&C&"Arial"&8 ${INSTITUTIONAL.tesi} — Historial Académico`,
      oddFooter: `&L${formatFechaMX(new Date())}&CFolio: ${folio}&RHistorial`
    }
  });

  ws.pageSetup.margins = { top: 1.5, bottom: 1.5, left: 1.2, right: 1.2, header: 0, footer: 0 };

  ws.mergeCells('A1:I1');
  ws.getCell('A1').value = INSTITUTIONAL.tesi;
  ws.getCell('A1').font = { bold: true, size: 12, color: { argb: INSTITUTIONAL.azulInstitucional }, name: 'Arial' };
  ws.getCell('A1').alignment = { horizontal: 'center' };

  ws.mergeCells('A2:I2');
  ws.getCell('A2').value = `HISTORIAL ACADÉMICO — ${nombreCompleto}`;
  ws.getCell('A2').font = { bold: true, size: 13, color: { argb: INSTITUTIONAL.azulInstitucional }, name: 'Arial' };
  ws.getCell('A2').alignment = { horizontal: 'center' };

  ws.mergeCells('A3:I3');
  ws.getCell('A3').value = `Matrícula: ${alumno.matricula}  |  Carrera: ${alumno.nombre_carrera}  |  Promedio: ${alumno.promedio_general != null ? Number(alumno.promedio_general).toFixed(2) : 'N/A'}`;
  ws.getCell('A3').font = { size: 9, color: { argb: INSTITUTIONAL.grisClaro }, name: 'Arial' };
  ws.getCell('A3').alignment = { horizontal: 'center' };

  addFolioRow(ws, 4, 9, folio);

  ws.addRow([]);
  const headers = ['#', 'Periodo', 'Grupo', 'Materia', 'Clave', 'Créditos', 'Sem.', 'Final', 'Estado'];
  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow);

  setColumnWidths(ws, [4, 16, 12, 35, 12, 9, 6, 10, 14]);

  // Agrupar por período
  let currentPeriodo = null;
  for (let i = 0; i < materias.length; i++) {
    const m = materias[i];
    if (m.nombre_periodo !== currentPeriodo) {
      currentPeriodo = m.nombre_periodo;
      const sepRow = ws.addRow([`── ${currentPeriodo} ──`, '', '', '', '', '', '', '', '']);
      ws2_mergeCells(ws, sepRow.number, 9);
      sepRow.getCell(1).font = { bold: true, size: 10, color: { argb: INSTITUTIONAL.azulInstitucional }, name: 'Arial' };
      sepRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INSTITUTIONAL.azulClaro } };
    }

    const dataRow = ws.addRow([
      i + 1, m.nombre_periodo, m.nombre_grupo, m.nombre_materia, m.clave_materia,
      m.creditos, m.semestre_sugerido, formatGrade(m.calificacion_final), m.estado_calificacion || '-'
    ]);
    const estadoCell = dataRow.getCell(9);
    applyEstadoColor(estadoCell, m.estado_calificacion);
    styleDataRow(dataRow, { fontSize: 10, centerColumns: [1, 2, 3, 5, 6, 7, 8, 9] });
  }

  // Resumen
  ws.addRow([]);
  const totalCreditos = materias.reduce((s, m) => s + (m.creditos || 0), 0);
  const fins = materias.filter(m => m.calificacion_final != null).map(m => parseFloat(m.calificacion_final));
  const promedioGeneral = fins.length > 0 ? roundGrade(fins.reduce((s, v) => s + v, 0) / fins.length) : '-';
  const aprobadas = fins.filter(v => v >= PASSING_GRADE).length;

  ws.addRow([`Créditos Totales: ${totalCreditos}`, `Promedio General: ${promedioGeneral}`, `Materias Aprobadas: ${aprobadas}/${fins.length}`]);
  ws.addRow([`Folio: ${folio}`, `Emitido: ${formatFechaMX(new Date())}`, INSTITUTIONAL.version]);

  return { workbook: wb, folio, totalMaterias: materias.length };
}

function ws2_mergeCells(ws, rowNum, numCols) {
  ws.mergeCells(rowNum, 1, rowNum, numCols);
}

// ==============================
// 9. REPORTE POR GRUPO (Excel)
// ==============================
async function exportReporteGrupo(idGrupo, idPeriodo) {
  const grupo = await getGrupoInfo(idGrupo);
  if (!grupo) throw new Error('Grupo no encontrado');
  const periodo = await getPeriodoInfo(idPeriodo);
  const alumnos = await getAlumnosByGrupo(idGrupo, idPeriodo);
  const materias = await getMateriasByGrupo(idGrupo, idPeriodo);

  const folio = generarFolio('GRP');
  const wb = createWorkbook(
    `REPORTE GRUPO - ${grupo.nombre_grupo}`,
    `Reporte ${grupo.nombre_grupo} - ${periodo?.nombre_periodo || idPeriodo}`
  );

  // Hoja 1: Resumen ejecutivo
  const ws = wb.addWorksheet('Resumen', {
    headerFooter: {
      oddHeader: `&C&"Arial"&8 ${INSTITUTIONAL.tesi} — Reporte de Grupo`,
      oddFooter: `&L${formatFechaMX(new Date())}&CFolio: ${folio}&RSIVACAD-ISC`
    }
  });

  ws.pageSetup.margins = { top: 1.2, bottom: 1.2, left: 0.8, right: 0.8, header: 0, footer: 0 };
  ws.views = [{ showGridLines: false }];

  ws.mergeCells('A1:G1');
  ws.getCell('A1').value = `${INSTITUTIONAL.tesi}`;
  ws.getCell('A1').font = { bold: true, size: 12, color: { argb: INSTITUTIONAL.azulInstitucional }, name: 'Arial' };
  ws.getCell('A1').alignment = { horizontal: 'center' };

  ws.mergeCells('A2:G2');
  ws.getCell('A2').value = `REPORTE DE GRUPO — ${grupo.nombre_grupo}`;
  ws.getCell('A2').font = { bold: true, size: 13, color: { argb: INSTITUTIONAL.azulInstitucional }, name: 'Arial' };
  ws.getCell('A2').alignment = { horizontal: 'center' };

  ws.mergeCells('A3:G3');
  ws.getCell('A3').value = `Período: ${periodo?.nombre_periodo || idPeriodo}  |  Turno: ${grupo.turno || '-'}  |  Carrera: ${grupo.nombre_carrera || '-'}`;
  ws.getCell('A3').font = { size: 9, color: { argb: INSTITUTIONAL.grisClaro }, name: 'Arial' };
  ws.getCell('A3').alignment = { horizontal: 'center' };

  addFolioRow(ws, 4, 7, folio);

  // Resumen por materia
  ws.addRow([]);
  const headers = ['Materia', 'Clave', 'Total Alumnos', 'Promedio Grupal', 'Aprobados', 'Reprobados', '% Aprobación'];
  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow);

  setColumnWidths(ws, [35, 12, 14, 16, 12, 12, 14]);

  for (const m of materias) {
    const [stats] = await pool.execute(
      `SELECT COUNT(*) AS total,
              ROUND(AVG(calificacion_final), 2) AS promedio,
              SUM(CASE WHEN calificacion_final >= ${PASSING_GRADE} THEN 1 ELSE 0 END) AS aprobados,
              SUM(CASE WHEN calificacion_final < ${PASSING_GRADE} THEN 1 ELSE 0 END) AS reprobados
       FROM kardex_historial_academico
       WHERE id_grupo = ? AND id_materia = ? AND id_periodo = ? AND calificacion_final IS NOT NULL`,
      [idGrupo, m.id_materia, idPeriodo]
    );

    const s = stats[0];
    const total = s.total || 0;
    const prom = s.promedio != null ? Number(s.promedio).toFixed(2) : '-';
    const apr = s.aprobados || 0;
    const rep = s.reprobados || 0;
    const pctApr = total > 0 ? `${Math.round((apr / total) * 100)}%` : '-';

    const dataRow = ws.addRow([m.nombre_materia, m.clave_materia, total, prom, apr, rep, pctApr]);
    styleDataRow(dataRow, { centerColumns: [2, 3, 4, 5, 6, 7] });
  }

  // Hoja 2: Listado de alumnos
  const ws2 = wb.addWorksheet('Alumnos');
  ws2.addRow([`ALUMNOS — ${grupo.nombre_grupo}`]);
  ws2.getRow(1).getCell(1).font = { bold: true, size: 12, name: 'Arial' };

  const alHeaders = ['#', 'Matrícula', 'Alumno', 'Semestre', 'Estado'];
  const alHeaderRow = ws2.addRow(alHeaders);
  styleHeaderRow(alHeaderRow, { bgColor: INSTITUTIONAL.azulSecundario });

  setColumnWidths(ws2, [4, 14, 40, 10, 10]);

  for (let i = 0; i < alumnos.length; i++) {
    const al = alumnos[i];
    const dataRow = ws2.addRow([
      i + 1, al.matricula,
      `${al.apellido_paterno} ${al.apellido_materno} ${al.nombres}`,
      '-', 'ACTIVO'
    ]);
    styleDataRow(dataRow, { centerColumns: [1, 2, 4, 5] });
  }

  ws2.addRow([]);
  ws2.addRow([`Total Alumnos: ${alumnos.length}`, `Folio: ${folio}`, `Emitido: ${formatFechaMX(new Date())}`, INSTITUTIONAL.version]);

  return { workbook: wb, folio, totalAlumnos: alumnos.length, totalMaterias: materias.length };
}

// ==============================
// 10. REPORTE DE SEGUIMIENTO PARA COORDINADOR (Excel)
// ==============================
async function exportReporteSeguimiento(idPeriodo) {
  const periodo = await getPeriodoInfo(idPeriodo);

  const [grupos] = await pool.execute(
    `SELECT DISTINCT g.id_grupo, g.nombre_grupo, g.turno
     FROM kardex_historial_academico h
     INNER JOIN grupos g ON g.id_grupo = h.id_grupo
     WHERE h.id_periodo = ?
     ORDER BY g.nombre_grupo`,
    [idPeriodo]
  );

  const folio = generarFolio('SEG');
  const wb = createWorkbook(
    `SEGUIMIENTO ACADÉMICO - ${periodo?.nombre_periodo || idPeriodo}`,
    `Reporte de Seguimiento ${periodo?.nombre_periodo || idPeriodo}`
  );

  const ws = wb.addWorksheet('Seguimiento', {
    headerFooter: {
      oddHeader: `&C&"Arial"&8 ${INSTITUTIONAL.tesi} — Seguimiento Académico`,
      oddFooter: `&L${formatFechaMX(new Date())}&CFolio: ${folio}&RCoordinador`
    }
  });

  ws.pageSetup.margins = { top: 1.2, bottom: 1.2, left: 0.8, right: 0.8, header: 0, footer: 0 };
  ws.views = [{ showGridLines: false }];

  ws.mergeCells('A1:I1');
  ws.getCell('A1').value = INSTITUTIONAL.tesi;
  ws.getCell('A1').font = { bold: true, size: 12, color: { argb: INSTITUTIONAL.azulInstitucional }, name: 'Arial' };
  ws.getCell('A1').alignment = { horizontal: 'center' };

  ws.mergeCells('A2:I2');
  ws.getCell('A2').value = `REPORTE DE SEGUIMIENTO ACADÉMICO — ${periodo?.nombre_periodo || idPeriodo}`;
  ws.getCell('A2').font = { bold: true, size: 13, color: { argb: INSTITUTIONAL.azulInstitucional }, name: 'Arial' };
  ws.getCell('A2').alignment = { horizontal: 'center' };

  addFolioRow(ws, 3, 9, folio);

  // Hoja 1: Resumen ejecutivo
  ws.addRow([]);
  const headers = ['Grupo', 'Materia', 'Alumnos', 'Capturados', 'Pendientes', '% Captura', 'Promedio', 'Aprobados', '% Aprobación'];
  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow);

  setColumnWidths(ws, [16, 30, 10, 12, 12, 12, 12, 12, 14]);

  let totalAl = 0, totalCapt = 0, totalPend = 0;

  for (const g of grupos) {
    const [materias] = await pool.execute(
      `SELECT ca.id_materia, m.nombre_materia, m.clave_materia
       FROM cargas_academicas ca
       INNER JOIN materias m ON m.id_materia = ca.id_materia
       WHERE ca.id_grupo = ? AND ca.id_periodo = ? AND ca.estado = 'ACTIVA'`,
      [g.id_grupo, idPeriodo]
    );

    const [alumnosCount] = await pool.execute(
      `SELECT COUNT(*) AS total FROM grupos_alumnos
       WHERE id_grupo = ? AND id_periodo = ? AND estado = 'ACTIVO'`,
      [g.id_grupo, idPeriodo]
    );
    const totalAlumnos = alumnosCount[0]?.total || 0;

    for (const m of materias) {
      const [stats] = await pool.execute(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN parcial_1 IS NOT NULL THEN 1 ELSE 0 END) AS p1,
                SUM(CASE WHEN parcial_2 IS NOT NULL THEN 1 ELSE 0 END) AS p2,
                SUM(CASE WHEN parcial_3 IS NOT NULL THEN 1 ELSE 0 END) AS p3,
                ROUND(AVG(calificacion_final), 2) AS promedio,
                SUM(CASE WHEN calificacion_final >= ${PASSING_GRADE} THEN 1 ELSE 0 END) AS aprobados
         FROM kardex_historial_academico
         WHERE id_grupo = ? AND id_materia = ? AND id_periodo = ?`,
        [g.id_grupo, m.id_materia, idPeriodo]
      );

      const s = stats[0];
      const capturados = (s.p1 || 0) + (s.p2 || 0) + (s.p3 || 0);
      const pendientes = (totalAlumnos * 3) - capturados;
      const pctCaptura = (totalAlumnos * 3) > 0 ? Math.round((capturados / (totalAlumnos * 3)) * 100) : 0;
      const promedio = s.promedio != null ? Number(s.promedio).toFixed(2) : '-';
      const aprobados = s.aprobados || 0;
      const pctApr = (s.total || 0) > 0 ? `${Math.round((aprobados / s.total) * 100)}%` : '-';

      totalAl += totalAlumnos; totalCapt += capturados; totalPend += pendientes;

      const dataRow = ws.addRow([g.nombre_grupo, m.nombre_materia, totalAlumnos, capturados, pendientes, `${pctCaptura}%`, promedio, aprobados, pctApr]);
      styleDataRow(dataRow, { centerColumns: [3, 4, 5, 6, 7, 8, 9] });

      // Color si hay pendientes altos
      if (pctCaptura < 50) {
        dataRow.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        });
      }
    }
  }

  ws.addRow([]);
  const totalRow = ws.addRow([
    'TOTAL', '-', totalAl, totalCapt, totalPend,
    `${totalAl > 0 ? Math.round((totalCapt / (totalAl * 3)) * 100) : 0}%`, '-', '-', '-'
  ]);
  totalRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, name: 'Arial', color: { argb: INSTITUTIONAL.azulInstitucional } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INSTITUTIONAL.azulClaro } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // Hoja 2: Alertas
  const ws2 = wb.addWorksheet('Alertas');
  ws2.addRow(['ALERTAS Y OBSERVACIONES']);
  ws2.getRow(1).getCell(1).font = { bold: true, size: 12, name: 'Arial', color: { argb: INSTITUTIONAL.azulInstitucional } };

  const alertHeaders = ['Tipo', 'Grupo', 'Materia', 'Detalle'];
  const alertHeaderRow = ws2.addRow(alertHeaders);
  styleHeaderRow(alertHeaderRow, { bgColor: 'FFDC2626' });

  setColumnWidths(ws2, [25, 16, 30, 40]);

  // Generar alertas basadas en datos reales
  for (const g of grupos) {
    const [materias] = await pool.execute(
      `SELECT ca.id_materia, m.nombre_materia
       FROM cargas_academicas ca
       INNER JOIN materias m ON m.id_materia = ca.id_materia
       WHERE ca.id_grupo = ? AND ca.id_periodo = ? AND ca.estado = 'ACTIVA'`,
      [g.id_grupo, idPeriodo]
    );

    for (const m of materias) {
      const [stats] = await pool.execute(
        `SELECT SUM(CASE WHEN calificacion_final IS NULL THEN 1 ELSE 0 END) AS sin_cal,
                SUM(CASE WHEN calificacion_final < ${PASSING_GRADE} THEN 1 ELSE 0 END) AS reprobados,
                COUNT(*) AS total
         FROM kardex_historial_academico
         WHERE id_grupo = ? AND id_materia = ? AND id_periodo = ?`,
        [g.id_grupo, m.id_materia, idPeriodo]
      );

      const s = stats[0];
      if ((s.sin_cal || 0) > 0) {
        ws2.addRow(['SIN CALIFICACIONES', g.nombre_grupo, m.nombre_materia, `${s.sin_cal} alumno(s) sin calificar`]);
      }
      if ((s.reprobados || 0) > (s.total || 0) * 0.3 && (s.total || 0) > 0) {
        ws2.addRow(['ALTO REPROBACION', g.nombre_grupo, m.nombre_materia, `${s.reprobados}/${s.total} reprobados (${Math.round((s.reprobados / s.total) * 100)}%)`]);
      }
    }
  }

  ws2.addRow([]);
  ws2.addRow([`Folio: ${folio}`, `Emitido: ${formatFechaMX(new Date())}`, INSTITUTIONAL.version]);

  return { workbook: wb, folio, totalGrupos: grupos.length };
}

// ==============================
// EXPORTS
// ==============================
module.exports = {
  exportConcentradoGeneral,
  exportConcentradoParcial,
  exportConcentradoPeriodo,
  exportPreboletaIndividual,
  exportBoletaIndividual,
  exportHistorialAcademico,
  exportReporteGrupo,
  exportReporteSeguimiento
};
