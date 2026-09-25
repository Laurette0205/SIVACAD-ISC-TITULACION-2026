'use strict';

const pool = require('../config/db');
const { registrarAuditoria } = require('../middleware/auditoria');
const { denegarSiNoEsAlumnoPropio } = require('../helpers/ownership');

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

    const denegado = await denegarSiNoEsAlumnoPropio(req, idAlumno, 'No puedes ver la preboleta de otro alumno');
    if (denegado) return res.status(denegado.status).json({ ok: false, message: denegado.message });

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
              CONCAT(du.apellido_paterno, ' ', du.apellido_materno, ' ', du.nombres) AS nombre_docente
       FROM kardex_historial_academico h
       INNER JOIN materias m ON m.id_materia = h.id_materia
       INNER JOIN grupos g ON g.id_grupo = h.id_grupo
       INNER JOIN periodos p ON p.id_periodo = h.id_periodo
       LEFT JOIN cargas_academicas ca ON ca.id_grupo = h.id_grupo AND ca.id_periodo = h.id_periodo AND ca.id_materia = h.id_materia
       LEFT JOIN docentes dn ON dn.id_docente = ca.id_docente
       LEFT JOIN usuarios du ON du.id_usuario = dn.id_usuario
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
              CONCAT(du.apellido_paterno, ' ', du.apellido_materno, ' ', du.nombres) AS nombre_docente
       FROM materias m
       INNER JOIN cargas_academicas ca ON ca.id_materia = m.id_materia
       LEFT JOIN docentes dn ON dn.id_docente = ca.id_docente
       LEFT JOIN usuarios du ON du.id_usuario = dn.id_usuario
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

    const denegado = await denegarSiNoEsAlumnoPropio(req, idAlumno, 'No puedes exportar la preboleta de otro alumno');
    if (denegado) return res.status(denegado.status).json({ ok: false, message: denegado.message });

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

    const denegado = await denegarSiNoEsAlumnoPropio(req, pb.id_alumno, 'No puedes exportar la preboleta de otro alumno');
    if (denegado) return res.status(denegado.status).json({ ok: false, message: denegado.message });

    const academicPDFService = require('../services/academicPDFService');
    const { filePath, fileName, folio } = await academicPDFService.generarPreboletaPDF(
      Number(pb.id_alumno), Number(pb.id_periodo)
    );

    await pool.execute(
      "UPDATE preboletas SET estado = 'IMPRESA', impreso_en = NOW() WHERE id_preboleta = ?",
      [idPreboleta]
    );

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      modulo: 'PREBOLETA',
      accion: 'PREBOLETA_PDF_EXPORTADA',
      descripcion: `Preboleta PDF exportada — ID: ${idPreboleta} — Folio: ${folio}`,
      nivel: 'INFO',
      req
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    require('fs').createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error('[PREBOLETAS] Error exportando PDF:', error);
    const status = error.message && error.message.includes('no encontrado') ? 404 : 500;
    res.status(status).json({ ok: false, message: 'Error exportando PDF' });
  }
}

// ==============================
// 7. EXPORTAR BOLETA EXCEL (ALUMNO) — Documento Oficial
// ==============================
async function exportBoletaExcelAlumno(req, res) {
  try {
    const { idAlumno } = req.params;
    const { idPeriodo } = req.query;

    const denegado = await denegarSiNoEsAlumnoPropio(req, idAlumno, 'No puedes exportar la boleta de otro alumno');
    if (denegado) return res.status(denegado.status).json({ ok: false, message: denegado.message });

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

    const denegado = await denegarSiNoEsAlumnoPropio(req, idAlumno, 'No puedes exportar la boleta de otro alumno');
    if (denegado) return res.status(denegado.status).json({ ok: false, message: denegado.message });

    const academicPDFService = require('../services/academicPDFService');
    const { filePath, fileName, folio } = await academicPDFService.generarBoletaPDF(
      Number(idAlumno), idPeriodo ? Number(idPeriodo) : undefined
    );

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      modulo: 'BOLETA',
      accion: 'BOLETA_PDF_EXPORTADA',
      descripcion: `Boleta PDF exportada — Alumno: ${idAlumno} — Folio: ${folio}`,
      nivel: 'INFO',
      req
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    require('fs').createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error('[PREBOLETAS] Error exportando boleta PDF:', error);
    const status = error.message && error.message.includes('no encontrado') ? 404 : 500;
    res.status(status).json({ ok: false, message: 'Error exportando boleta PDF' });
  }
}

// ==============================
// 9. EXPORTAR PREBOLETA PDF (ALUMNO, POR PERÍODO — datos vivos de BD)
// ==============================
async function exportPreboletaPDFAlumno(req, res) {
  try {
    const { idAlumno } = req.params;
    const { idPeriodo } = req.query;

    if (!idPeriodo) {
      return res.status(400).json({ ok: false, message: 'idPeriodo requerido' });
    }

    const denegado = await denegarSiNoEsAlumnoPropio(req, idAlumno, 'No puedes exportar la preboleta de otro alumno');
    if (denegado) return res.status(denegado.status).json({ ok: false, message: denegado.message });

    const academicPDFService = require('../services/academicPDFService');
    const { filePath, fileName, folio } = await academicPDFService.generarPreboletaPDF(
      Number(idAlumno), Number(idPeriodo)
    );

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      modulo: 'PREBOLETA',
      accion: 'PREBOLETA_PDF_EXPORTADA',
      descripcion: `Preboleta PDF exportada — Alumno: ${idAlumno}, Periodo: ${idPeriodo} — Folio: ${folio}`,
      nivel: 'INFO',
      req
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    require('fs').createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error('[PREBOLETAS] Error exportando preboleta PDF alumno:', error);
    const status = error.message && error.message.includes('no encontrado') ? 404 : 500;
    res.status(status).json({ ok: false, message: 'Error exportando preboleta PDF' });
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
  exportBoletaPDFAlumno,
  exportPreboletaPDFAlumno
};
