'use strict';

// backend/src/services/academicControlService.js
// ═══════════════════════════════════════════════════════════════
// CONTROL ACADÉMICO POR PARCIAL Y PERÍODO — SIVACAD-ISC
// ═══════════════════════════════════════════════════════════════
// 6 niveles de consulta:
//   NIVEL 1: Parcial (P1/P2/P3)
//   NIVEL 2: Materia
//   NIVEL 3: Grupo
//   NIVEL 4: Periodo / ciclo escolar
//   NIVEL 5: Semestre
//   NIVEL 6: Historial académico
//
// Roles: Coordinador, Docente, Alumno
// Regla: Un alumno solo ve su propio historial.
// ═══════════════════════════════════════════════════════════════

const pool = require('../config/db');
const {
  roundGrade,
  calculateAverage,
  PASSING_GRADE,
  calcularEstadoAcademico,
  calcularEstadoSimple,
  contarAprobacion,
  promedioGeneral,
  normalizarParciales,
  ESTADO_ACADEMICO,
  getCalificacionesGrupo,
  getCalificacionesAlumno
} = require('./academicGradeService');

// ==============================
// QUERIES BASE
// ==============================

async function getPeriodos() {
  const [rows] = await pool.execute(
    `SELECT id_periodo, nombre_periodo, fecha_inicio, fecha_fin, ciclo_escolar, estado
     FROM periodos ORDER BY fecha_inicio DESC`
  );
  return rows;
}

async function getGruposByPeriodo(idPeriodo) {
  const [rows] = await pool.execute(
    `SELECT g.id_grupo, g.nombre_grupo, g.turno, g.semestre, c.nombre_carrera
     FROM grupos g
     INNER JOIN carreras c ON c.id_carrera = g.id_carrera
     WHERE g.id_periodo = ?
     ORDER BY g.semestre, g.nombre_grupo`, [idPeriodo]
  );
  return rows;
}

async function getDocentesByPeriodo(idPeriodo) {
  const [rows] = await pool.execute(
    `SELECT DISTINCT dn.id_docente,
            CONCAT(du.apellido_paterno, ' ', du.apellido_materno, ' ', du.nombres) AS nombre_docente
     FROM cargas_academicas ca
     INNER JOIN docentes dn ON dn.id_docente = ca.id_docente
     LEFT JOIN usuarios du ON du.id_usuario = dn.id_usuario
     WHERE ca.id_periodo = ? AND ca.estado = 'ACTIVA'
     ORDER BY nombre_docente`, [idPeriodo]
  );
  return rows;
}

async function getMateriasByPeriodo(idPeriodo) {
  const [rows] = await pool.execute(
    `SELECT DISTINCT m.id_materia, m.nombre_materia, m.clave_materia, m.semestre_sugerido
     FROM cargas_academicas ca
     INNER JOIN materias m ON m.id_materia = ca.id_materia
     WHERE ca.id_periodo = ? AND ca.estado = 'ACTIVA'
     ORDER BY m.semestre_sugerido, m.nombre_materia`, [idPeriodo]
  );
  return rows;
}

async function getSemestresByPeriodo(idPeriodo) {
  const [rows] = await pool.execute(
    `SELECT DISTINCT g.semestre
     FROM grupos g
     WHERE g.id_periodo = ?
     ORDER BY g.semestre`, [idPeriodo]
  );
  return rows.map(r => r.semestre).filter(Boolean);
}

// ==============================
// NIVEL 1: PARCIAL
// ==============================

/**
 * Consulta por parcial específico (P1/P2/P3).
 * Coordinador: cualquier grupo/materia
 * Docente: solo sus grupos/materias
 * Alumno: solo su propia calificación
 */
async function getParcial(idPeriodo, parcial, filtros = {}) {
  if (![1, 2, 3].includes(parcial)) throw new Error('Parcial inválido (1-3)');

  const parcialCol = `parcial_${parcial}`;
  const fechaCol = `fecha_parcial_${parcial}`;

  let where = 'h.id_periodo = ?';
  const params = [idPeriodo];

  if (filtros.idGrupo) { where += ' AND h.id_grupo = ?'; params.push(filtros.idGrupo); }
  if (filtros.idMateria) { where += ' AND h.id_materia = ?'; params.push(filtros.idMateria); }
  if (filtros.idDocente) {
    where += ` AND EXISTS (
      SELECT 1 FROM cargas_academicas ca
      WHERE ca.id_grupo = h.id_grupo AND ca.id_periodo = h.id_periodo
        AND ca.id_materia = h.id_materia AND ca.id_docente = ?
    )`;
    params.push(filtros.idDocente);
  }
  if (filtros.idAlumno) { where += ' AND h.id_alumno = ?'; params.push(filtros.idAlumno); }
  if (filtros.estado) {
    if (filtros.estado === 'CON_CALIFICACION') {
      where += ` AND h.${parcialCol} IS NOT NULL`;
    } else if (filtros.estado === 'SIN_CALIFICACION') {
      where += ` AND h.${parcialCol} IS NULL`;
    } else {
      where += ' AND h.estado_calificacion = ?';
      params.push(filtros.estado);
    }
  }

  const [rows] = await pool.execute(
    `SELECT h.id_historial, h.${parcialCol} AS calificacion, h.${fechaCol} AS fecha_captura,
            h.estado_calificacion, h.calificacion_final,
            m.nombre_materia, m.clave_materia,
            g.nombre_grupo, g.turno, g.semestre,
            CONCAT(a.apellido_paterno, ' ', a.apellido_materno, ' ', a.nombres) AS nombre_alumno,
            a.matricula, a.id_alumno,
            CONCAT(du.apellido_paterno, ' ', du.apellido_materno, ' ', du.nombres) AS nombre_docente,
            h.fecha_registro, h.fecha_modificacion
     FROM kardex_historial_academico h
     INNER JOIN materias m ON m.id_materia = h.id_materia
     INNER JOIN grupos g ON g.id_grupo = h.id_grupo
     INNER JOIN alumnos a ON a.id_alumno = h.id_alumno
     LEFT JOIN cargas_academicas ca ON ca.id_grupo = h.id_grupo AND ca.id_periodo = h.id_periodo AND ca.id_materia = h.id_materia
     LEFT JOIN docentes dn ON dn.id_docente = ca.id_docente
     LEFT JOIN usuarios du ON du.id_usuario = dn.id_usuario
     WHERE ${where}
     ORDER BY a.apellido_paterno, a.apellido_materno, a.nombres`,
    params
  );

  // Estadísticas del parcial
  const conCalificacion = rows.filter(r => r.calificacion != null);
  const sinCalificacion = rows.filter(r => r.calificacion == null);
  const aprobados = conCalificacion.filter(r => parseFloat(r.calificacion) >= PASSING_GRADE).length;
  const noAcreditados = conCalificacion.filter(r => parseFloat(r.calificacion) < PASSING_GRADE).length;
  const promedio = conCalificacion.length > 0
    ? roundGrade(conCalificacion.reduce((s, r) => s + parseFloat(r.calificacion), 0) / conCalificacion.length)
    : null;

  return {
    parcial,
    total_alumnos: rows.length,
    con_calificacion: conCalificacion.length,
    sin_calificacion: sinCalificacion.length,
    aprobados,
    no_acreditados: noAcreditados,
    promedio_parcial: promedio,
    porcentaje_captura: rows.length > 0 ? Math.round((conCalificacion.length / rows.length) * 100) : 0,
    calificaciones: rows.map(r => ({
      ...normalizarParciales(r),
      nombre_alumno: r.nombre_alumno,
      matricula: r.matricula,
      id_alumno: r.id_alumno,
      nombre_materia: r.nombre_materia,
      clave_materia: r.clave_materia,
      nombre_grupo: r.nombre_grupo,
      nombre_docente: r.nombre_docente,
      calificacion_parcial: r.calificacion,
      fecha_captura: r.fecha_captura,
      fecha_registro: r.fecha_registro,
      fecha_modificacion: r.fecha_modificacion
    }))
  };
}

// ==============================
// NIVEL 2: MATERIA
// ==============================

async function getMateria(idPeriodo, idMateria, filtros = {}) {
  let where = 'h.id_periodo = ? AND h.id_materia = ?';
  const params = [idPeriodo, idMateria];

  if (filtros.idGrupo) { where += ' AND h.id_grupo = ?'; params.push(filtros.idGrupo); }
  if (filtros.idDocente) {
    where += ` AND EXISTS (
      SELECT 1 FROM cargas_academicas ca
      WHERE ca.id_grupo = h.id_grupo AND ca.id_periodo = h.id_periodo
        AND ca.id_materia = h.id_materia AND ca.id_docente = ?
    )`;
    params.push(filtros.idDocente);
  }
  if (filtros.idAlumno) { where += ' AND h.id_alumno = ?'; params.push(filtros.idAlumno); }

  const [materiaRows] = await pool.execute(
    'SELECT * FROM materias WHERE id_materia = ? LIMIT 1', [idMateria]
  );
  const materia = materiaRows[0] || {};

  const [rows] = await pool.execute(
    `SELECT h.*,
            g.nombre_grupo, g.turno, g.semestre,
            CONCAT(a.apellido_paterno, ' ', a.apellido_materno, ' ', a.nombres) AS nombre_alumno,
            a.matricula, a.id_alumno,
            CONCAT(du.apellido_paterno, ' ', du.apellido_materno, ' ', du.nombres) AS nombre_docente
     FROM kardex_historial_academico h
     INNER JOIN grupos g ON g.id_grupo = h.id_grupo
     INNER JOIN alumnos a ON a.id_alumno = h.id_alumno
     LEFT JOIN cargas_academicas ca ON ca.id_grupo = h.id_grupo AND ca.id_periodo = h.id_periodo AND ca.id_materia = h.id_materia
     LEFT JOIN docentes dn ON dn.id_docente = ca.id_docente
     LEFT JOIN usuarios du ON du.id_usuario = dn.id_usuario
     WHERE ${where}
     ORDER BY g.nombre_grupo, a.apellido_paterno, a.apellido_materno, a.nombres`,
    params
  );

  // Calcular estado académico para cada registro
  const calificaciones = rows.map(r => {
    const norm = normalizarParciales(r);
    return {
      ...r,
      parcial_1: norm.parcial_1,
      parcial_2: norm.parcial_2,
      parcial_3: norm.parcial_3,
      promedio_parciales: norm.promedio_parciales,
      estado_academico: calcularEstadoAcademico(norm)
    };
  });

  const stats = contarAprobacion(calificaciones);
  const prom = promedioGeneral(calificaciones);

  // Por parcial
  const parciales = {};
  for (let p = 1; p <= 3; p++) {
    const col = `parcial_${p}`;
    const vals = calificaciones.filter(c => c[col] != null).map(c => parseFloat(c[col]));
    parciales[`p${p}`] = {
      capturados: vals.length,
      pendientes: calificaciones.length - vals.length,
      promedio: vals.length > 0 ? roundGrade(vals.reduce((s, v) => s + v, 0) / vals.length) : null,
      aprobados: vals.filter(v => v >= PASSING_GRADE).length,
      no_acreditados: vals.filter(v => v < PASSING_GRADE).length
    };
  }

  // Docentes asignados
  const [docentes] = await pool.execute(
    `SELECT DISTINCT dn.id_docente,
            CONCAT(du.apellido_paterno, ' ', du.apellido_materno, ' ', du.nombres) AS nombre_docente
     FROM cargas_academicas ca
     INNER JOIN docentes dn ON dn.id_docente = ca.id_docente
     LEFT JOIN usuarios du ON du.id_usuario = dn.id_usuario
     WHERE ca.id_periodo = ? AND ca.id_materia = ?
     ORDER BY nombre_docente`, [idPeriodo, idMateria]
  );

  return {
    materia: {
      id_materia: materia.id_materia,
      nombre_materia: materia.nombre_materia,
      clave_materia: materia.clave_materia,
      creditos: materia.creditos,
      semestre_sugerido: materia.semestre_sugerido
    },
    estadisticas: {
      total_alumnos: calificaciones.length,
      aprobados: stats.aprobados,
      no_acreditados: stats.noAcreditados,
      pendientes: stats.pendientes,
      promedio_general: prom,
      porcentaje_aprobacion: calificaciones.length > 0 ? Math.round((stats.aprobados / calificaciones.length) * 100) : 0
    },
    parciales,
    docentes: docentes.map(d => d.nombre_docente),
    calificaciones
  };
}

// ==============================
// NIVEL 3: GRUPO
// ==============================

async function getGrupo(idPeriodo, idGrupo, filtros = {}) {
  let where = 'h.id_periodo = ? AND h.id_grupo = ?';
  const params = [idPeriodo, idGrupo];

  if (filtros.idMateria) { where += ' AND h.id_materia = ?'; params.push(filtros.idMateria); }
  if (filtros.idDocente) {
    where += ` AND EXISTS (
      SELECT 1 FROM cargas_academicas ca
      WHERE ca.id_grupo = h.id_grupo AND ca.id_periodo = h.id_periodo
        AND ca.id_materia = h.id_materia AND ca.id_docente = ?
    )`;
    params.push(filtros.idDocente);
  }
  if (filtros.estado) { where += ' AND h.estado_calificacion = ?'; params.push(filtros.estado); }

  const [grupoRows] = await pool.execute(
    `SELECT g.*, c.nombre_carrera FROM grupos g
     LEFT JOIN carreras c ON c.id_carrera = g.id_carrera
     WHERE g.id_grupo = ? LIMIT 1`, [idGrupo]
  );
  const grupo = grupoRows[0] || {};

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

  const [rows] = await pool.execute(
    `SELECT h.*,
            CONCAT(a.apellido_paterno, ' ', a.apellido_materno, ' ', a.nombres) AS nombre_alumno,
            a.matricula, a.id_alumno,
            m.nombre_materia, m.clave_materia,
            CONCAT(du.apellido_paterno, ' ', du.apellido_materno, ' ', du.nombres) AS nombre_docente
     FROM kardex_historial_academico h
     INNER JOIN alumnos a ON a.id_alumno = h.id_alumno
     INNER JOIN materias m ON m.id_materia = h.id_materia
     LEFT JOIN cargas_academicas ca ON ca.id_grupo = h.id_grupo AND ca.id_periodo = h.id_periodo AND ca.id_materia = h.id_materia
     LEFT JOIN docentes dn ON dn.id_docente = ca.id_docente
     LEFT JOIN usuarios du ON du.id_usuario = dn.id_usuario
     WHERE ${where}
     ORDER BY a.apellido_paterno, a.apellido_materno, a.nombres, m.nombre_materia`,
    params
  );

  const calificaciones = rows.map(r => {
    const norm = normalizarParciales(r);
    return {
      ...r,
      parcial_1: norm.parcial_1,
      parcial_2: norm.parcial_2,
      parcial_3: norm.parcial_3,
      promedio_parciales: norm.promedio_parciales,
      estado_academico: calcularEstadoAcademico(norm)
    };
  });

  // Estadísticas por materia
  const porMateria = {};
  for (const m of materias) {
    const cals = calificaciones.filter(c => c.id_materia === m.id_materia);
    const stats = contarAprobacion(cals);
    const prom = promedioGeneral(cals);
    porMateria[m.id_materia] = {
      nombre_materia: m.nombre_materia,
      clave_materia: m.clave_materia,
      nombre_docente: m.nombre_docente,
      total: cals.length,
      aprobados: stats.aprobados,
      no_acreditados: stats.noAcreditados,
      promedio: prom,
      porcentaje_aprobacion: cals.length > 0 ? Math.round((stats.aprobados / cals.length) * 100) : 0
    };
  }

  // Resumen general
  const statsGeneral = contarAprobacion(calificaciones);
  const promGeneral = promedioGeneral(calificaciones);

  return {
    grupo: {
      id_grupo: grupo.id_grupo,
      nombre_grupo: grupo.nombre_grupo,
      semestre: grupo.semestre,
      turno: grupo.turno,
      carrera: grupo.nombre_carrera
    },
    estadisticas: {
      total_alumnos: alumnos.length,
      total_materias: materias.length,
      aprobados: statsGeneral.aprobados,
      no_acreditados: statsGeneral.noAcreditados,
      promedio_general: promGeneral,
      porcentaje_aprobacion: calificaciones.length > 0 ? Math.round((statsGeneral.aprobados / calificaciones.length) * 100) : 0
    },
    por_materia: Object.values(porMateria),
    alumnos: alumnos.map(a => ({
      id_alumno: a.id_alumno,
      matricula: a.matricula,
      nombre: `${a.apellido_paterno} ${a.apellido_materno} ${a.nombres}`
    })),
    calificaciones
  };
}

// ==============================
// NIVEL 4: PERÍODO
// ==============================

async function getPeriodo(idPeriodo, filtros = {}) {
  let where = 'h.id_periodo = ?';
  const params = [idPeriodo];

  if (filtros.idGrupo) { where += ' AND h.id_grupo = ?'; params.push(filtros.idGrupo); }
  if (filtros.idMateria) { where += ' AND h.id_materia = ?'; params.push(filtros.idMateria); }
  if (filtros.idDocente) {
    where += ` AND EXISTS (
      SELECT 1 FROM cargas_academicas ca
      WHERE ca.id_grupo = h.id_grupo AND ca.id_periodo = h.id_periodo
        AND ca.id_materia = h.id_materia AND ca.id_docente = ?
    )`;
    params.push(filtros.idDocente);
  }
  if (filtros.estado) { where += ' AND h.estado_calificacion = ?'; params.push(filtros.estado); }

  const [periodoRows] = await pool.execute(
    'SELECT * FROM periodos WHERE id_periodo = ? LIMIT 1', [idPeriodo]
  );
  const periodo = periodoRows[0] || {};

  const [grupos] = await pool.execute(
    `SELECT g.id_grupo, g.nombre_grupo, g.turno, g.semestre, c.nombre_carrera
     FROM grupos g
     LEFT JOIN carreras c ON c.id_carrera = g.id_carrera
     WHERE g.id_periodo = ?
     ORDER BY g.semestre, g.nombre_grupo`, [idPeriodo]
  );

  const [rows] = await pool.execute(
    `SELECT h.*,
            CONCAT(a.apellido_paterno, ' ', a.apellido_materno, ' ', a.nombres) AS nombre_alumno,
            a.matricula, a.id_alumno,
            m.nombre_materia, m.clave_materia,
            g.nombre_grupo, g.semestre, g.turno,
            CONCAT(du.apellido_paterno, ' ', du.apellido_materno, ' ', du.nombres) AS nombre_docente
     FROM kardex_historial_academico h
     INNER JOIN alumnos a ON a.id_alumno = h.id_alumno
     INNER JOIN materias m ON m.id_materia = h.id_materia
     INNER JOIN grupos g ON g.id_grupo = h.id_grupo
     LEFT JOIN cargas_academicas ca ON ca.id_grupo = h.id_grupo AND ca.id_periodo = h.id_periodo AND ca.id_materia = h.id_materia
     LEFT JOIN docentes dn ON dn.id_docente = ca.id_docente
     LEFT JOIN usuarios du ON du.id_usuario = dn.id_usuario
     WHERE ${where}
     ORDER BY g.nombre_grupo, a.apellido_paterno, a.apellido_materno, a.nombres, m.nombre_materia`,
    params
  );

  const calificaciones = rows.map(r => {
    const norm = normalizarParciales(r);
    return {
      ...r,
      parcial_1: norm.parcial_1,
      parcial_2: norm.parcial_2,
      parcial_3: norm.parcial_3,
      promedio_parciales: norm.promedio_parciales,
      estado_academico: calcularEstadoAcademico(norm)
    };
  });

  const statsGeneral = contarAprobacion(calificaciones);
  const promGeneral = promedioGeneral(calificaciones);

  // Por grupo
  const porGrupo = {};
  for (const g of grupos) {
    const cals = calificaciones.filter(c => c.id_grupo === g.id_grupo);
    const stats = contarAprobacion(cals);
    porGrupo[g.id_grupo] = {
      nombre_grupo: g.nombre_grupo,
      semestre: g.semestre,
      total: cals.length,
      aprobados: stats.aprobados,
      no_acreditados: stats.noAcreditados,
      promedio: promedioGeneral(cals)
    };
  }

  return {
    periodo: {
      id_periodo: periodo.id_periodo,
      nombre_periodo: periodo.nombre_periodo,
      ciclo_escolar: periodo.ciclo_escolar,
      fecha_inicio: periodo.fecha_inicio,
      fecha_fin: periodo.fecha_fin
    },
    estadisticas: {
      total_grupos: grupos.length,
      total_alumnos: new Set(calificaciones.map(c => c.id_alumno)).size,
      total_materias: new Set(calificaciones.map(c => c.id_materia)).size,
      total_registros: calificaciones.length,
      aprobados: statsGeneral.aprobados,
      no_acreditados: statsGeneral.noAcreditados,
      promedio_general: promGeneral,
      porcentaje_aprobacion: calificaciones.length > 0 ? Math.round((statsGeneral.aprobados / calificaciones.length) * 100) : 0
    },
    por_grupo: Object.values(porGrupo),
    grupos: grupos.map(g => ({
      id_grupo: g.id_grupo,
      nombre_grupo: g.nombre_grupo,
      semestre: g.semestre,
      turno: g.turno,
      carrera: g.nombre_carrera
    }))
  };
}

// ==============================
// NIVEL 5: SEMESTRE
// ==============================

async function getSemestre(idPeriodo, semestre, filtros = {}) {
  let where = 'h.id_periodo = ? AND g.semestre = ?';
  const params = [idPeriodo, semestre];

  if (filtros.idGrupo) { where += ' AND h.id_grupo = ?'; params.push(filtros.idGrupo); }
  if (filtros.idMateria) { where += ' AND h.id_materia = ?'; params.push(filtros.idMateria); }
  if (filtros.idDocente) {
    where += ` AND EXISTS (
      SELECT 1 FROM cargas_academicas ca
      WHERE ca.id_grupo = h.id_grupo AND ca.id_periodo = h.id_periodo
        AND ca.id_materia = h.id_materia AND ca.id_docente = ?
    )`;
    params.push(filtros.idDocente);
  }
  if (filtros.estado) { where += ' AND h.estado_calificacion = ?'; params.push(filtros.estado); }

  const [rows] = await pool.execute(
    `SELECT h.*,
            CONCAT(a.apellido_paterno, ' ', a.apellido_materno, ' ', a.nombres) AS nombre_alumno,
            a.matricula, a.id_alumno,
            m.nombre_materia, m.clave_materia,
            g.nombre_grupo, g.turno, g.semestre,
            CONCAT(du.apellido_paterno, ' ', du.apellido_materno, ' ', du.nombres) AS nombre_docente
     FROM kardex_historial_academico h
     INNER JOIN alumnos a ON a.id_alumno = h.id_alumno
     INNER JOIN materias m ON m.id_materia = h.id_materia
     INNER JOIN grupos g ON g.id_grupo = h.id_grupo
     LEFT JOIN cargas_academicas ca ON ca.id_grupo = h.id_grupo AND ca.id_periodo = h.id_periodo AND ca.id_materia = h.id_materia
     LEFT JOIN docentes dn ON dn.id_docente = ca.id_docente
     LEFT JOIN usuarios du ON du.id_usuario = dn.id_usuario
     WHERE ${where}
     ORDER BY g.nombre_grupo, a.apellido_paterno, a.apellido_materno, a.nombres, m.nombre_materia`,
    params
  );

  const calificaciones = rows.map(r => {
    const norm = normalizarParciales(r);
    return {
      ...r,
      parcial_1: norm.parcial_1,
      parcial_2: norm.parcial_2,
      parcial_3: norm.parcial_3,
      promedio_parciales: norm.promedio_parciales,
      estado_academico: calcularEstadoAcademico(norm)
    };
  });

  const statsGeneral = contarAprobacion(calificaciones);

  return {
    semestre,
    estadisticas: {
      total_grupos: new Set(calificaciones.map(c => c.id_grupo)).size,
      total_alumnos: new Set(calificaciones.map(c => c.id_alumno)).size,
      total_materias: new Set(calificaciones.map(c => c.id_materia)).size,
      total_registros: calificaciones.length,
      aprobados: statsGeneral.aprobados,
      no_acreditados: statsGeneral.noAcreditados,
      promedio_general: promedioGeneral(calificaciones),
      porcentaje_aprobacion: calificaciones.length > 0 ? Math.round((statsGeneral.aprobados / calificaciones.length) * 100) : 0
    },
    calificaciones
  };
}

// ==============================
// NIVEL 6: HISTORIAL ACADÉMICO (solo Alumno)
// ==============================

async function getHistorialAlumno(idAlumno, filtros = {}) {
  let where = 'h.id_alumno = ?';
  const params = [idAlumno];

  if (filtros.idPeriodo) { where += ' AND h.id_periodo = ?'; params.push(filtros.idPeriodo); }
  if (filtros.semestre) { where += ' AND g.semestre = ?'; params.push(filtros.semestre); }
  if (filtros.estado) { where += ' AND h.estado_calificacion = ?'; params.push(filtros.estado); }

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
  const alumno = alumnoRows[0];

  const [rows] = await pool.execute(
    `SELECT h.*,
            m.nombre_materia, m.clave_materia, m.creditos, m.semestre_sugerido,
            g.nombre_grupo, g.semestre, g.turno,
            p.nombre_periodo, p.ciclo_escolar,
            CONCAT(du.apellido_paterno, ' ', du.apellido_materno, ' ', du.nombres) AS nombre_docente
     FROM kardex_historial_academico h
     INNER JOIN materias m ON m.id_materia = h.id_materia
     INNER JOIN grupos g ON g.id_grupo = h.id_grupo
     INNER JOIN periodos p ON p.id_periodo = h.id_periodo
     LEFT JOIN cargas_academicas ca ON ca.id_grupo = h.id_grupo AND ca.id_periodo = h.id_periodo AND ca.id_materia = h.id_materia
     LEFT JOIN docentes dn ON dn.id_docente = ca.id_docente
     LEFT JOIN usuarios du ON du.id_usuario = dn.id_usuario
     WHERE ${where}
     ORDER BY p.nombre_periodo DESC, m.semestre_sugerido, m.nombre_materia`,
    params
  );

  const calificaciones = rows.map(r => {
    const norm = normalizarParciales(r);
    return {
      ...r,
      parcial_1: norm.parcial_1,
      parcial_2: norm.parcial_2,
      parcial_3: norm.parcial_3,
      promedio_parciales: norm.promedio_parciales,
      estado_academico: calcularEstadoAcademico(norm)
    };
  });

  // Agrupar por período
  const porPeriodo = {};
  for (const c of calificaciones) {
    const key = c.nombre_periodo || 'Sin período';
    if (!porPeriodo[key]) porPeriodo[key] = [];
    porPeriodo[key].push(c);
  }

  const statsGeneral = contarAprobacion(calificaciones);
  const totalCreditos = calificaciones.reduce((s, c) => s + (c.creditos || 0), 0);

  return {
    alumno: {
      id_alumno: alumno.id_alumno,
      matricula: alumno.matricula,
      nombre: `${alumno.apellido_paterno} ${alumno.apellido_materno} ${alumno.nombres}`,
      carrera: alumno.nombre_carrera,
      plan: `${alumno.nombre_plan || '—'} ${alumno.version_plan || ''}`,
      semestre_actual: alumno.semestre_actual,
      promedio_general: alumno.promedio_general,
      creditos_acumulados: alumno.creditos_acumulados
    },
    estadisticas: {
      total_materias: calificaciones.length,
      total_creditos: totalCreditos,
      aprobados: statsGeneral.aprobados,
      no_acreditados: statsGeneral.noAcreditados,
      promedio_historial: promedioGeneral(calificaciones)
    },
    por_periodo: porPeriodo,
    calificaciones
  };
}

// ==============================
// FILTROS DISPONIBLES (para UI)
// ==============================

async function getFiltrosDisponibles(idPeriodo, rol, idUsuario) {
  const filtros = {
    periodos: await getPeriodos(),
    grupos: await getGruposByPeriodo(idPeriodo),
    materias: await getMateriasByPeriodo(idPeriodo),
    docentes: await getDocentesByPeriodo(idPeriodo),
    semestres: await getSemestresByPeriodo(idPeriodo),
    parciales: [1, 2, 3],
    estados: ['BORRADOR', 'VALIDADA', 'PUBLICADA', 'CERRADA']
  };

  // Docente: filtrar solo sus grupos y materias
  if (rol === 'DOCENTE') {
    const [docenteRows] = await pool.execute(
      'SELECT id_docente FROM docentes WHERE id_usuario = ? LIMIT 1', [idUsuario]
    );
    if (docenteRows.length) {
      const idDocente = docenteRows[0].id_docente;
      const [misGrupos] = await pool.execute(
        `SELECT DISTINCT g.id_grupo, g.nombre_grupo, g.turno, g.semestre, c.nombre_carrera
         FROM cargas_academicas ca
         INNER JOIN grupos g ON g.id_grupo = ca.id_grupo
         LEFT JOIN carreras c ON c.id_carrera = g.id_carrera
         WHERE ca.id_docente = ? AND ca.id_periodo = ? AND ca.estado = 'ACTIVA'`,
        [idDocente, idPeriodo]
      );
      const [misMaterias] = await pool.execute(
        `SELECT DISTINCT m.id_materia, m.nombre_materia, m.clave_materia, m.semestre_sugerido
         FROM cargas_academicas ca
         INNER JOIN materias m ON m.id_materia = ca.id_materia
         WHERE ca.id_docente = ? AND ca.id_periodo = ? AND ca.estado = 'ACTIVA'`,
        [idDocente, idPeriodo]
      );
      filtros.grupos = misGrupos;
      filtros.materias = misMaterias;
      filtros.docentes = filtros.docentes.filter(d => d.id_docente === idDocente);
    }
  }

  // Alumno: solo sus datos
  if (rol === 'ALUMNO') {
    const [alumnoRows] = await pool.execute(
      'SELECT id_alumno FROM alumnos WHERE id_usuario = ? LIMIT 1', [idUsuario]
    );
    if (alumnoRows.length) {
      filtros.idAlumno = alumnoRows[0].id_alumno;
    }
  }

  return filtros;
}

// ==============================
// EXPORTS
// ==============================
module.exports = {
  getParcial,
  getMateria,
  getGrupo,
  getPeriodo,
  getSemestre,
  getHistorialAlumno,
  getFiltrosDisponibles,
  getPeriodos,
  getGruposByPeriodo,
  getMateriasByPeriodo,
  getDocentesByPeriodo,
  getSemestresByPeriodo
};
