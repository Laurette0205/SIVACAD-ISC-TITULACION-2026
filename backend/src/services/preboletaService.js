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
function calcularEstado(promedio) {
  return calcularEstadoSimple(promedio);
}

async function getDatosInstitucionales() {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM calificaciones_config WHERE id_institucion = 1 LIMIT 1'
    );
    return rows[0] || {};
  } catch (_) {
    return {};
  }
}

async function buildPreboletaAlumno(idAlumno, idPeriodo) {
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

  const [materias] = await pool.execute(
    `SELECT h.*, m.nombre_materia, m.clave_materia, m.creditos, m.semestre_sugerido,
            g.nombre_grupo, g.turno, g.semestre, p.nombre_periodo,
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

  let faltasPorMateria = {};
  try {
    const [faltas] = await pool.execute(
      `SELECT id_materia, SUM(CASE WHEN asistio = 0 THEN 1 ELSE 0 END) AS total_faltas
       FROM docente_asistencias
       WHERE id_alumno = ? AND id_periodo = ?
       GROUP BY id_materia`,
      [idAlumno, idPeriodo]
    );
    for (const f of faltas) faltasPorMateria[f.id_materia] = f.total_faltas;
  } catch (_) {}

  const materiasConDetalles = materias.map(m => {
    const promedio = roundGrade(
      [m.parcial_1, m.parcial_2, m.parcial_3].filter(g => g != null).length > 0
        ? [m.parcial_1, m.parcial_2, m.parcial_3].filter(g => g != null).reduce((s, v) => s + v, 0) /
          [m.parcial_1, m.parcial_2, m.parcial_3].filter(g => g != null).length
        : null
    );
    const estado = m.estado_calificacion === 'CERRADA'
      ? calcularEstado(m.calificacion_final ?? promedio)
      : calcularEstado(promedio);

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
      calificacion_final: roundGrade(m.calificacion_final),
      estado_calificacion: m.estado_calificacion || 'BORRADOR',
      faltas: faltasPorMateria[m.id_materia] || 0
    };
  });

  const grupo = materias[0] ? {
    nombre_grupo: materias[0].nombre_grupo,
    turno: materias[0].turno,
    semestre: materias[0].semestre
  } : null;

  const periodo = materias[0] ? materias[0].nombre_periodo : null;

  const promedioGeneral = materiasConDetalles.length > 0
    ? roundGrade(
        materiasConDetalles.filter(m => m.promedio != null).reduce((s, m) => s + m.promedio, 0) /
        materiasConDetalles.filter(m => m.promedio != null).length
      )
    : null;

  const nombreCompleto = `${alumno.apellido_paterno || ''} ${alumno.apellido_materno || ''} ${alumno.nombres || ''}`.replace(/\s+/g, ' ').trim();

  return {
    documento: 'PREBOLETA',
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
      promedio_general: alumno.promedio_general,
      creditos_acumulados: alumno.creditos_acumulados
    },
    grupo,
    periodo,
    materias: materiasConDetalles,
    resumen: {
      total_materias: materiasConDetalles.length,
      promedio_general: promedioGeneral,
      materias_aprobadas: materiasConDetalles.filter(m => m.promedio != null && m.promedio >= PASSING_GRADE).length,
      materias_no_acreditadas: materiasConDetalles.filter(m => m.promedio != null && m.promedio < PASSING_GRADE).length,
      materias_pendientes: materiasConDetalles.filter(m => m.promedio == null).length,
      faltas_totales: Object.values(faltasPorMateria).reduce((s, v) => s + v, 0)
    },
    generado_en: new Date().toISOString()
  };
}

module.exports = { buildPreboletaAlumno, getDatosInstitucionales, roundGrade, calcularEstado };
