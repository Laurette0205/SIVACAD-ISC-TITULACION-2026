'use strict';

const pool = require('../config/db');

// ==============================
// SERVICIO ÚNICO DE CALIFICACIONES
// ==============================
const {
  roundGrade,
  calcularEstadoSimple,
  PASSING_GRADE
} = require('./academicGradeService');

// Wrapper para compatibilidad con código existente
function calcularEstado(calificacion) {
  return calcularEstadoSimple(calificacion);
}

function getLetraCalificacion(cal) {
  if (cal == null) return '—';
  if (cal >= 9) return 'EXE';
  if (cal >= 8) return 'B';
  if (cal >= 7) return 'B-';
  if (cal >= PASSING_GRADE) return 'S';
  if (cal >= 5) return 'NA';
  return 'NA';
}

async function buildBoletaAlumno(idAlumno, idPeriodo) {
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

  let where = 'h.id_alumno = ? AND h.estado_calificacion = \'PUBLICADA\'';
  const params = [idAlumno];
  if (idPeriodo) {
    where += ' AND h.id_periodo = ?';
    params.push(idPeriodo);
  }

  const [materias] = await pool.execute(
    `SELECT h.*, m.nombre_materia, m.clave_materia, m.creditos, m.semestre_sugerido,
            g.nombre_grupo, g.turno, g.semestre, p.nombre_periodo,
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

  let faltasPorMateria = {};
  try {
    const periodoIds = [...new Set(materias.map(m => m.id_periodo))];
    if (periodoIds.length > 0) {
      const placeholders = periodoIds.map(() => '?').join(',');
      const [faltas] = await pool.execute(
        `SELECT id_materia, id_periodo, SUM(CASE WHEN asistio = 0 THEN 1 ELSE 0 END) AS total_faltas
         FROM docente_asistencias
         WHERE id_alumno = ? AND id_periodo IN (${placeholders})
         GROUP BY id_materia, id_periodo`,
        [idAlumno, ...periodoIds]
      );
      for (const f of faltas) faltasPorMateria[`${f.id_periodo}_${f.id_materia}`] = f.total_faltas;
    }
  } catch (_) {}

  const materiasConDetalles = materias.map(m => {
    const promedio = roundGrade(
      [m.parcial_1, m.parcial_2, m.parcial_3].filter(g => g != null).length > 0
        ? [m.parcial_1, m.parcial_2, m.parcial_3].filter(g => g != null).reduce((s, v) => s + v, 0) /
          [m.parcial_1, m.parcial_2, m.parcial_3].filter(g => g != null).length
        : null
    );
    const calFinal = roundGrade(m.calificacion_final) || promedio;
    const estado = calcularEstado(calFinal);

    return {
      id_materia: m.id_materia,
      nombre_materia: m.nombre_materia,
      clave_materia: m.clave_materia,
      creditos: m.creditos,
      semestre_sugerido: m.semestre_sugerido,
      nombre_docente: m.nombre_docente || '—',
      parcial_1: roundGrade(m.parcial_1),
      parcial_2: roundGrade(m.parcial_2),
      parcial_3: roundGrade(m.parcial_3),
      promedio: promedio,
      calificacion_final: calFinal,
      estado_calificacion: m.estado_calificacion,
      estado: estado,
      calificacion_letra: getLetraCalificacion(calFinal),
      faltas: faltasPorMateria[`${m.id_periodo}_${m.id_materia}`] || 0
    };
  });

  const nombreCompleto = `${alumno.apellido_paterno || ''} ${alumno.apellido_materno || ''} ${alumno.nombres || ''}`.replace(/\s+/g, ' ').trim();

  const periodos = {};
  for (const m of materiasConDetalles) {
    const key = m.nombre_periodo || 'Sin periodo';
    if (!periodos[key]) periodos[key] = { nombre_periodo: key, materias: [] };
    periodos[key].materias.push(m);
  }

  const periodosConResumen = Object.values(periodos).map(p => {
    const conCalificacion = p.materias.filter(m => m.calificacion_final != null);
    const promedio = conCalificacion.length > 0
      ? roundGrade(conCalificacion.reduce((s, m) => s + m.calificacion_final, 0) / conCalificacion.length)
      : null;
    return {
      nombre_periodo: p.nombre_periodo,
      materias: p.materias,
      total_materias: p.materias.length,
      promedio_periodo: promedio,
      aprobadas: conCalificacion.filter(m => m.calificacion_final >= PASSING_GRADE).length,
      no_acreditadas: conCalificacion.filter(m => m.calificacion_final < PASSING_GRADE).length,
      faltas_totales: p.materias.reduce((s, m) => s + m.faltas, 0)
    };
  });

  const primerGrupo = materiasConDetalles[0];

  return {
    documento: 'BOLETA',
    institucion: {
      nombre: 'TECNOLÓGICO DE ESTUDIOS SUPERIORES DE IXTAPALUCA (TESI)',
      carrera: 'Ingeniería en Sistemas Computacionales'
    },
    alumno: {
      id_alumno: alumno.id_alumno,
      matricula: alumno.matricula,
      nombre_completo: nombreCompleto,
      apellido_paterno: alumno.apellido_paterno,
      apellido_materno: alumno.apellido_materno,
      nombres: alumno.nombres,
      semestre_actual: alumno.semestre_actual,
      estatus_academico: alumno.estatus_academico,
      nombre_carrera: alumno.nombre_carrera,
      nombre_plan: alumno.nombre_plan,
      version_plan: alumno.version_plan,
      promedio_general: roundGrade(alumno.promedio_general),
      creditos_acumulados: alumno.creditos_acumulados || 0
    },
    grupo: primerGrupo ? {
      nombre_grupo: primerGrupo.nombre_grupo,
      turno: primerGrupo.turno,
      semestre: primerGrupo.semestre
    } : null,
    periodo: primerGrupo ? primerGrupo.nombre_periodo : null,
    periodos: periodosConResumen,
    materias: materiasConDetalles,
    resumen: {
      total_materias: materiasConDetalles.length,
      promedio_general: materiasConDetalles.filter(m => m.calificacion_final != null).length > 0
        ? roundGrade(materiasConDetalles.filter(m => m.calificacion_final != null).reduce((s, m) => s + m.calificacion_final, 0) /
            materiasConDetalles.filter(m => m.calificacion_final != null).length)
        : null,
      materias_aprobadas: materiasConDetalles.filter(m => m.calificacion_final != null && m.calificacion_final >= PASSING_GRADE).length,
      materias_no_acreditadas: materiasConDetalles.filter(m => m.calificacion_final != null && m.calificacion_final < PASSING_GRADE).length,
      faltas_totales: materiasConDetalles.reduce((s, m) => s + m.faltas, 0),
      creditos_acumulados: alumno.creditos_acumulados || 0
    },
    generado_en: new Date().toISOString()
  };
}

module.exports = { buildBoletaAlumno, roundGrade, calcularEstado, getLetraCalificacion };
