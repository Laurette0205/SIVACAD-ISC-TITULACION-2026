'use strict';

const pool = require('../config/db');
const { registrarAuditoria } = require('../middleware/auditoria');

// ==============================
// SERVICIO ÚNICO DE CALIFICACIONES
// ==============================
const { roundGrade, calculateAverage, PASSING_GRADE } = require('../services/academicGradeService');

// ==============================
// 1. PREBOLETA DEL ALUMNO
// ==============================
async function getPreboletaAlumno(req, res) {
  try {
    const { idAlumno, idPeriodo } = req.params;
    const esAlumno = String(req.user.rol).trim().toUpperCase() === 'ALUMNO';

    if (esAlumno && req.user.id_alumno !== Number(idAlumno)) {
      return res.status(403).json({ ok: false, message: 'No puedes ver la preboleta de otro alumno' });
    }

    const [alumnoRows] = await pool.execute(
      `SELECT a.*, c.nombre_carrera, k.promedio_general, k.creditos_acumulados,
              pe.nombre_plan, pe.version_plan
       FROM alumnos a
       INNER JOIN carreras c ON c.id_carrera = a.id_carrera
       LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
       LEFT JOIN planes_estudio pe ON pe.id_plan = a.id_plan
       WHERE a.id_alumno = ? LIMIT 1`,
      [idAlumno]
    );

    if (!alumnoRows.length) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    const alumno = alumnoRows[0];

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

    // Calcular faltas por materia desde docente_asistencias
    let faltasPorMateria = {};
    try {
      const [faltas] = await pool.execute(
        `SELECT id_materia, SUM(CASE WHEN asistio = 0 THEN 1 ELSE 0 END) AS total_faltas
         FROM docente_asistencias
         WHERE id_alumno = ? AND id_periodo = ?
         GROUP BY id_materia`,
        [idAlumno, idPeriodo]
      );
      for (const f of faltas) {
        faltasPorMateria[f.id_materia] = f.total_faltas;
      }
    } catch (_) {
      // tabla puede no existir
    }

    const materiasConFaltas = materias.map(m => ({
      ...m,
      faltas: faltasPorMateria[m.id_materia] || 0,
      promedio_calculado: calculateAverage(m.parcial_1, m.parcial_2, m.parcial_3)
    }));

    const totalFaltas = Object.values(faltasPorMateria).reduce((s, v) => s + v, 0);
    const promedioGeneral = materiasConFaltas.length > 0
      ? roundGrade(materiasConFaltas.reduce((s, m) => s + (m.promedio_calculado || 0), 0) / materiasConFaltas.filter(m => m.promedio_calculado != null).length)
      : null;

    return res.json({
      ok: true,
      alumno: {
        ...alumno,
        nombre_completo: `${alumno.apellido_paterno || ''} ${alumno.apellido_materno || ''} ${alumno.nombres || ''}`.replace(/\s+/g, ' ').trim()
      },
      grupo: materias[0] ? { nombre_grupo: materias[0].nombre_grupo, turno: materias[0].turno } : null,
      periodo: materias[0] ? materias[0].nombre_periodo : null,
      materias: materiasConFaltas,
      resumen: {
        total_materias: materiasConFaltas.length,
        faltas_totales: totalFaltas,
        promedio_general: promedioGeneral,
        materias_aprobadas: materiasConFaltas.filter(m => m.calificacion_final != null && m.calificacion_final >= PASSING_GRADE).length,
        materias_no_acreditadas: materiasConFaltas.filter(m => m.calificacion_final != null && m.calificacion_final < PASSING_GRADE).length,
        materias_pendientes: materiasConFaltas.filter(m => m.calificacion_final == null).length
      }
    });
  } catch (error) {
    console.error('[PREBOLETAS] Error:', error);
    return res.status(500).json({ ok: false, message: 'Error obteniendo preboleta' });
  }
}

// ==============================
// 2. PREBOLETA DEL GRUPO (Concentrado)
// ==============================
async function getPreboletaGrupo(req, res) {
  try {
    const { idGrupo, idPeriodo } = req.params;

    const [grupoInfo] = await pool.execute(
      `SELECT g.*, p.nombre_periodo, c.nombre_carrera
       FROM grupos g
       INNER JOIN periodos p ON p.id_periodo = g.id_periodo
       INNER JOIN carreras c ON c.id_carrera = g.id_carrera
       WHERE g.id_grupo = ? LIMIT 1`,
      [idGrupo]
    );

    if (!grupoInfo.length) {
      return res.status(404).json({ ok: false, message: 'Grupo no encontrado' });
    }

    const [alumnos] = await pool.execute(
      `SELECT DISTINCT a.id_alumno, a.matricula, a.apellido_paterno, a.apellido_materno, a.nombres,
              ga.estado AS estado_inscripcion
       FROM alumnos a
       INNER JOIN grupos_alumnos ga ON ga.id_alumno = a.id_alumno
       WHERE ga.id_grupo = ? AND ga.id_periodo = ? AND ga.estado = 'ACTIVO'
       ORDER BY a.apellido_paterno, a.apellido_materno, a.nombres`,
      [idGrupo, idPeriodo]
    );

    const [materias] = await pool.execute(
      `SELECT DISTINCT m.id_materia, m.nombre_materia, m.clave_materia, m.semestre_sugerido,
              CONCAT(dn.apellido_paterno, ' ', dn.apellido_materno, ' ', dn.nombres) AS nombre_docente
       FROM materias m
       INNER JOIN cargas_academicas ca ON ca.id_materia = m.id_materia
       LEFT JOIN docentes dn ON dn.id_docente = ca.id_docente
       WHERE ca.id_grupo = ? AND ca.id_periodo = ?
       ORDER BY m.semestre_sugerido, m.nombre_materia`,
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
      const key = `${c.id_alumno}_${c.id_materia}`;
      calMap[key] = c;
    }

    const alumnosConCal = alumnos.map(al => {
      const materiasCal = materias.map(m => {
        const cal = calMap[`${al.id_alumno}_${m.id_materia}`];
        return {
          id_materia: m.id_materia,
          nombre_materia: m.nombre_materia,
          clave_materia: m.clave_materia,
          parcial_1: cal ? cal.parcial_1 : null,
          parcial_2: cal ? cal.parcial_2 : null,
          parcial_3: cal ? cal.parcial_3 : null,
          promedio: cal ? cal.promedio_parciales : null,
          calificacion_final: cal ? cal.calificacion_final : null,
          estado: cal ? cal.estado_calificacion : 'SIN_CALIFICACION'
        };
      });

      const fins = materiasCal.filter(m => m.calificacion_final != null).map(m => parseFloat(m.calificacion_final));
      const promedio = fins.length > 0 ? roundGrade(fins.reduce((s, v) => s + v, 0) / fins.length) : null;

      return {
        id_alumno: al.id_alumno,
        matricula: al.matricula,
        apellido_paterno: al.apellido_paterno,
        apellido_materno: al.apellido_materno,
        nombres: al.nombres,
        estado_inscripcion: al.estado_inscripcion,
        materias: materiasCal,
        promedio_general: promedio,
        materias_aprobadas: fins.filter(v => v >= PASSING_GRADE).length,
        materias_no_acreditadas: fins.filter(v => v < PASSING_GRADE).length
      };
    });

    return res.json({
      ok: true,
      grupo: grupoInfo[0],
      periodo: grupoInfo[0].nombre_periodo,
      carrera: grupoInfo[0].nombre_carrera,
      materias,
      alumnos: alumnosConCal,
      estadisticas: {
        total_alumnos: alumnos.length,
        total_materias: materias.length,
        alumnos_aprobados: alumnosConCal.filter(a => a.materias_no_acreditadas === 0 && a.materias.length > 0).length,
        alumnos_pendientes: alumnosConCal.filter(a => a.materias.some(m => m.estado === 'SIN_CALIFICACION')).length
      }
    });
  } catch (error) {
    console.error('[PREBOLETAS] Error:', error);
    return res.status(500).json({ ok: false, message: 'Error obteniendo preboleta del grupo' });
  }
}

// ==============================
// 3. GENERAR PREBOLETA
// ==============================
async function generarPreboleta(req, res) {
  try {
    const { idAlumno, idGrupo, idPeriodo } = req.body;

    if (!idAlumno || !idGrupo || !idPeriodo) {
      return res.status(400).json({ ok: false, message: 'idAlumno, idGrupo, idPeriodo requeridos' });
    }

    const [materias] = await pool.execute(
      `SELECT h.*, m.nombre_materia, m.clave_materia
       FROM kardex_historial_academico h
       INNER JOIN materias m ON m.id_materia = h.id_materia
       WHERE h.id_alumno = ? AND h.id_grupo = ? AND h.id_periodo = ?`,
      [idAlumno, idGrupo, idPeriodo]
    );

    if (!materias.length) {
      return res.status(404).json({ ok: false, message: 'No se encontraron calificaciones para este alumno/grupo' });
    }

    const snapshot = {
      alumno_id: idAlumno,
      grupo_id: idGrupo,
      periodo_id: idPeriodo,
      generado_en: new Date().toISOString(),
      materias: materias.map(m => ({
        id_materia: m.id_materia,
        nombre: m.nombre_materia,
        parcial_1: m.parcial_1,
        parcial_2: m.parcial_2,
        parcial_3: m.parcial_3,
        promedio: m.promedio_parciales,
        final: m.calificacion_final,
        estado: m.estado_calificacion
      }))
    };

    const promedioGeneral = calculateAverage(
      materias.reduce((s, m) => s + (m.parcial_1 || 0), 0) / materias.length || null,
      materias.reduce((s, m) => s + (m.parcial_2 || 0), 0) / materias.length || null,
      materias.reduce((s, m) => s + (m.parcial_3 || 0), 0) / materias.length || null
    );

    const [result] = await pool.execute(
      `INSERT INTO preboletas
       (id_alumno, id_grupo, id_periodo, calificacion_parcial_1, calificacion_parcial_2,
        calificacion_parcial_3, promedio, calificacion_final, snapshot, generado_por)
       VALUES (?, ?, ?,
               (SELECT AVG(parcial_1) FROM kardex_historial_academico WHERE id_alumno = ? AND id_grupo = ? AND id_periodo = ?),
               (SELECT AVG(parcial_2) FROM kardex_historial_academico WHERE id_alumno = ? AND id_grupo = ? AND id_periodo = ?),
               (SELECT AVG(parcial_3) FROM kardex_historial_academico WHERE id_alumno = ? AND id_grupo = ? AND id_periodo = ?),
               ?, ?, ?, ?)`,
      [idAlumno, idGrupo, idPeriodo,
       idAlumno, idGrupo, idPeriodo,
       idAlumno, idGrupo, idPeriodo,
       promedioGeneral, promedioGeneral,
       JSON.stringify(snapshot), req.user.id_usuario]
    );

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      modulo: 'PREBOLETA',
      accion: 'PREBOLETA_GENERADA',
      descripcion: `Preboleta generada para alumno ${idAlumno}, grupo ${idGrupo}, periodo ${idPeriodo}`,
      entidad_afectada: 'preboletas',
      id_entidad: result.insertId,
      req
    });

    return res.json({ ok: true, id_preboleta: result.insertId, estado: 'GENERADA' });
  } catch (error) {
    console.error('[PREBOLETAS] Error:', error);
    return res.status(500).json({ ok: false, message: 'Error generando preboleta' });
  }
}

// ==============================
// 4. EXPORTAR PREBOLETA EXCEL (ALUMNO)
// ==============================
async function exportPreboletaExcelAlumno(req, res) {
  try {
    const { idAlumno } = req.params;
    const { idPeriodo } = req.query;
    const esAlumno = String(req.user.rol).trim().toUpperCase() === 'ALUMNO';

    if (esAlumno && req.user.id_alumno !== Number(idAlumno)) {
      return res.status(403).json({ ok: false, message: 'No puedes exportar la preboleta de otro alumno' });
    }

    const preboletasExport = require('../services/preboletasExport');
    const { workbook, folio } = await preboletasExport.exportPreboletaAlumno(idAlumno, idPeriodo);

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      modulo: 'PREBOLETA',
      accion: 'PREBOLETA_EXPORTADA',
      descripcion: `Preboleta Excel exportada — Alumno: ${idAlumno} — Folio: ${folio}`,
      nivel: 'INFO',
      req
    });

    const filename = `preboleta_${idAlumno}_${folio}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Export-Folio', folio);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('[PREBOLETAS] Error exportando:', error.message);
    if (error.message.includes('no encontrado')) {
      return res.status(404).json({ ok: false, message: error.message });
    }
    res.status(500).json({ ok: false, message: 'Error exportando preboleta' });
  }
}

// ==============================
// 5. EXPORTAR PREBOLETA EXCEL GRUPO
// ==============================
async function exportPreboletaExcelGrupo(req, res) {
  try {
    const { idGrupo, idPeriodo } = req.params;

    const preboletasExport = require('../services/preboletasExport');
    const { workbook, folio, totalAlumnos } = await preboletasExport.exportPreboletaGrupo(idGrupo, idPeriodo);

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      modulo: 'PREBOLETA',
      accion: 'PREBOLETA_GRUPO_EXPORTADA',
      descripcion: `Concentrado preboleta grupo ${idGrupo} — Folio: ${folio} — Alumnos: ${totalAlumnos}`,
      nivel: 'INFO',
      req
    });

    const filename = `preboleta_grupo_${idGrupo}_${folio}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Export-Folio', folio);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('[PREBOLETAS] Error exportando grupo:', error.message);
    res.status(500).json({ ok: false, message: 'Error exportando concentrado del grupo' });
  }
}

// ==============================
// 6. EXPORTAR PREBOLETA PDF
// ==============================
async function exportPreboletaPDF(req, res) {
  try {
    const { idPreboleta } = req.params;

    const [preboleta] = await pool.execute(
      'SELECT * FROM preboletas WHERE id_preboleta = ? LIMIT 1',
      [idPreboleta]
    );

    if (!preboleta.length) {
      return res.status(404).json({ ok: false, message: 'Preboleta no encontrada' });
    }

    const pb = preboleta[0];

    // Verificar propiedad: alumno solo puede ver sus propias preboletas
    const esAlumno = String(req.user.rol).trim().toUpperCase() === 'ALUMNO';
    if (esAlumno && req.user.id_alumno !== Number(pb.id_alumno)) {
      return res.status(403).json({ ok: false, message: 'No puedes exportar la preboleta de otro alumno' });
    }
    const snapshot = typeof pb.snapshot === 'string' ? JSON.parse(pb.snapshot) : pb.snapshot;

    const [alumno] = await pool.execute(
      `SELECT a.*, c.nombre_carrera FROM alumnos a
       INNER JOIN carreras c ON c.id_carrera = a.id_carrera
       WHERE a.id_alumno = ? LIMIT 1`,
      [pb.id_alumno]
    );

    const [grupo] = await pool.execute(
      `SELECT g.*, p.nombre_periodo FROM grupos g
       INNER JOIN periodos p ON p.id_periodo = g.id_periodo
       WHERE g.id_grupo = ? LIMIT 1`,
      [pb.id_grupo]
    );

    const html = generatePreboletaHTML(alumno[0], grupo[0], snapshot);

    let pdfBuffer;
    try {
      const reportesService = require('../services/reportesService');
      pdfBuffer = await reportesService.generatePdfWithDompdf(html);
    } catch (_) {
      return res.status(500).json({ ok: false, message: 'Generador de PDF no disponible' });
    }

    await pool.execute(
      "UPDATE preboletas SET estado = 'IMPRESA', impreso_en = NOW() WHERE id_preboleta = ?",
      [idPreboleta]
    );

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      modulo: 'PREBOLETA',
      accion: 'PREBOLETA_PDF_EXPORTADA',
      descripcion: `Preboleta PDF exportada — ID: ${idPreboleta}`,
      nivel: 'INFO',
      req
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="preboleta_${idPreboleta}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('[PREBOLETAS] Error exportando PDF:', error);
    res.status(500).json({ ok: false, message: 'Error exportando PDF' });
  }
}

function generatePreboletaHTML(alumno, grupo, snapshot) {
  const materias = snapshot?.materias || [];
  const nombreCompleto = `${alumno.apellido_paterno || ''} ${alumno.apellido_materno || ''} ${alumno.nombres || ''}`.replace(/\s+/g, ' ').trim();

  let filasHTML = materias.map((m, i) => `
    <tr>
      <td style="padding:6px;border:1px solid #ccc;text-align:center">${i + 1}</td>
      <td style="padding:6px;border:1px solid #ccc">${m.nombre}</td>
      <td style="padding:6px;border:1px solid #ccc;text-align:center">${m.parcial_1 != null ? Number(m.parcial_1).toFixed(1) : '-'}</td>
      <td style="padding:6px;border:1px solid #ccc;text-align:center">${m.parcial_2 != null ? Number(m.parcial_2).toFixed(1) : '-'}</td>
      <td style="padding:6px;border:1px solid #ccc;text-align:center">${m.parcial_3 != null ? Number(m.parcial_3).toFixed(1) : '-'}</td>
      <td style="padding:6px;border:1px solid #ccc;text-align:center;font-weight:bold">${m.promedio != null ? Number(m.promedio).toFixed(1) : '-'}</td>
      <td style="padding:6px;border:1px solid #ccc;text-align:center">${m.estado || '-'}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; margin: 20px; color: #1a1a1a; }
  .header { text-align: center; border-bottom: 2px solid #1e40af; padding-bottom: 10px; margin-bottom: 15px; }
  .header h1 { color: #1e40af; margin: 0; font-size: 16px; }
  .header h2 { color: #374151; margin: 5px 0 0; font-size: 13px; font-weight: normal; }
  .info { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; font-size: 12px; margin-bottom: 15px; }
  .info div { padding: 3px 0; }
  .info strong { color: #1e40af; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #1e40af; color: white; padding: 6px; border: 1px solid #1e40af; }
  .footer { margin-top: 20px; font-size: 10px; color: #666; text-align: center; border-top: 1px solid #ccc; padding-top: 10px; }
</style></head><body>
  <div class="header">
    <h1>TECNOLÓGICO DE ESTUDIOS SUPERIORES DE IXTAPALUCA (TESI)</h1>
    <h2>Ingeniería en Sistemas Computacionales</h2>
    <h2 style="color:#1e40af;font-weight:bold;margin-top:8px">PREBOLETA DE CALIFICACIONES</h2>
  </div>
  <div class="info">
    <div><strong>Alumno:</strong> ${nombreCompleto}</div>
    <div><strong>Matrícula:</strong> ${alumno.matricula}</div>
    <div><strong>Grupo:</strong> ${grupo?.nombre_grupo || '-'}</div>
    <div><strong>Semestre:</strong> ${alumno.semestre_actual || '-'}</div>
    <div><strong>Turno:</strong> ${grupo?.turno || '-'}</div>
    <div><strong>Periodo:</strong> ${grupo?.nombre_periodo || '-'}</div>
  </div>
  <table>
    <thead><tr><th>#</th><th>ASIGNATURA</th><th>P1</th><th>P2</th><th>P3</th><th>PROMEDIO</th><th>ESTADO</th></tr></thead>
    <tbody>${filasHTML}</tbody>
  </table>
  <div class="footer">
    <p>Documento generado por SIVACAD-ISC v3.0 — ${new Date().toLocaleDateString('es-MX')} — Folio: PREBOLETA-${alumno.matricula}</p>
    <p>Este documento es una preboleta y no sustituye la boleta oficial.</p>
  </div>
</body></html>`;
}

// ==============================
// 7. EXPORTAR BOLETA EXCEL (ALUMNO) — Documento Oficial
// ==============================
async function exportBoletaExcelAlumno(req, res) {
  try {
    const { idAlumno } = req.params;
    const { idPeriodo } = req.query;
    const esAlumno = String(req.user.rol).trim().toUpperCase() === 'ALUMNO';

    if (esAlumno && req.user.id_alumno !== Number(idAlumno)) {
      return res.status(403).json({ ok: false, message: 'No puedes exportar la boleta de otro alumno' });
    }

    const preboletasExport = require('../services/preboletasExport');
    const { workbook, folio, totalMaterias } = await preboletasExport.exportBoletaAlumno(idAlumno, idPeriodo);

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      modulo: 'BOLETA',
      accion: 'BOLETA_EXPORTADA',
      descripcion: `Boleta Excel exportada — Alumno: ${idAlumno} — Folio: ${folio}`,
      nivel: 'INFO',
      req
    });

    const filename = `boleta_${idAlumno}_${folio}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Export-Folio', folio);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('[PREBOLETAS] Error exportando boleta Excel:', error.message);
    if (error.message.includes('no encontrado')) {
      return res.status(404).json({ ok: false, message: error.message });
    }
    res.status(500).json({ ok: false, message: 'Error exportando boleta' });
  }
}

// ==============================
// 8. EXPORTAR BOLETA PDF (ALUMNO) — Documento Oficial
// ==============================
async function exportBoletaPDFAlumno(req, res) {
  try {
    const { idAlumno } = req.params;
    const { idPeriodo } = req.query;
    const esAlumno = String(req.user.rol).trim().toUpperCase() === 'ALUMNO';

    if (esAlumno && req.user.id_alumno !== Number(idAlumno)) {
      return res.status(403).json({ ok: false, message: 'No puedes exportar la boleta de otro alumno' });
    }

    const boletaService = require('../services/boletaService');
    const boletaPDF = require('../services/boletaPDF');
    const data = await boletaService.buildBoletaAlumno(idAlumno, idPeriodo);
    const html = boletaPDF.generarBoletaHTML(data);

    let pdfBuffer;
    try {
      const reportesService = require('../services/reportesService');
      pdfBuffer = await reportesService.generatePdfWithDompdf(idAlumno, req.baseUrl);
    } catch (_) {
      try {
        const phpBridge = require('../services/phpKardexBridge');
        if (phpBridge.isPhpAvailable()) {
          pdfBuffer = await phpBridge.generateKardexPdfWithPhp(idAlumno);
        }
      } catch (_) {}
    }

    if (!pdfBuffer) {
      return res.status(500).json({ ok: false, message: 'Generador de PDF no disponible' });
    }

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      modulo: 'BOLETA',
      accion: 'BOLETA_PDF_EXPORTADA',
      descripcion: `Boleta PDF exportada — Alumno: ${idAlumno}`,
      nivel: 'INFO',
      req
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="boleta_${idAlumno}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('[PREBOLETAS] Error exportando boleta PDF:', error);
    res.status(500).json({ ok: false, message: 'Error exportando boleta PDF' });
  }
}

module.exports = {
  getPreboletaAlumno,
  getPreboletaGrupo,
  generarPreboleta,
  exportPreboletaExcelAlumno,
  exportPreboletaExcelGrupo,
  exportPreboletaPDF,
  exportBoletaExcelAlumno,
  exportBoletaPDFAlumno
};
