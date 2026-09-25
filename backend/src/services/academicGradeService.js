'use strict';

// backend/src/services/academicGradeService.js
// ═══════════════════════════════════════════════════════════════
// SERVICIO ÚNICO DE CALIFICACIONES — SIVACAD-ISC
// ═══════════════════════════════════════════════════════════════
// REGLA: Una calificación almacenada en SIVACAD debe producir
//        el mismo resultado en WEB, EXCEL, PDF y KARDEX.
//
// NO duplicar algoritmos.
// NO copiar fórmulas manualmente.
// NO calcular el promedio de una manera en Excel y de otra en PDF.
//
// Todos consumen este servicio como fuente única de verdad.
// ═══════════════════════════════════════════════════════════════

const pool = require('../config/db');

// ==============================
// CONSTANTES ACADÉMICAS
// ==============================

const PASSING_GRADE = 6;
const MAX_GRADE = 10;
const MIN_GRADE = 0;
const GRADE_PRECISION = 2; // decimales

// Estados de calificación (valores de `estado_calificacion` en DB)
const ESTADO_CALIFICACION = {
  BORRADOR: 'BORRADOR',
  VALIDADA: 'VALIDADA',
  PUBLICADA: 'PUBLICADA',
  CERRADA: 'CERRADA'
};

// Estados académicos resultantes (calculados, no almacenados)
const ESTADO_ACADEMICO = {
  ACREDITADA: 'Acreditada',
  NO_ACREDITADA: 'No Acreditada',
  PENDIENTE: 'Pendiente',
  SIN_CALIFICACION: 'Sin Calificación',
  BORRADOR: 'Borrador',
  VALIDADA: 'Validada'
};

// ==============================
// 1. ROUND GRADE — Redondeo consistente
// ==============================
function roundGrade(value) {
  if (value == null) return null;
  const num = parseFloat(value);
  if (isNaN(num)) return null;
  return Math.round(num * Math.pow(10, GRADE_PRECISION)) / Math.pow(10, GRADE_PRECISION);
}

// ==============================
// 2. CALCULAR PROMEDIO — Variádico, siempre usa roundGrade
// ==============================
function calculateAverage(...values) {
  const valid = values.filter(g => g != null && !isNaN(g) && !isNaN(parseFloat(g)));
  if (valid.length === 0) return null;
  const sum = valid.reduce((s, g) => s + parseFloat(g), 0);
  return roundGrade(sum / valid.length);
}

// ==============================
// 3. FORMATEAR CALIFICACIÓN — Salida consistente
// ==============================
function formatGrade(val, nullSentinel = '—') {
  if (val == null || isNaN(val)) return nullSentinel;
  return String(roundGrade(val));
}

// ==============================
// 4. DETERMINAR ESTADO ACADÉMICO — Lógica única
// ==============================

/**
 * Determina el estado académico de una calificación individual.
 *
 * REGLAS (en orden de prioridad):
 * 1. Si `estado_calificacion` es CERRADA o PUBLICADA:
 *    - Si `calificacion_final` >= 6 → Acreditada
 *    - Si `calificacion_final` < 6  → No Acreditada
 * 2. Si `estado_calificacion` es BORRADOR → Borrador
 * 3. Si `estado_calificacion` es VALIDADA → Validada
 * 4. Si no hay `calificacion_final` → Pendiente
 * 5. Si no hay datos → Sin Calificación
 *
 * @param {Object} calificacion - Fila de kardex_historial_academico
 * @returns {string} Estado académico
 */
function calcularEstadoAcademico(calificacion) {
  if (!calificacion) return ESTADO_ACADEMICO.SIN_CALIFICACION;

  const estado = calificacion.estado_calificacion;
  const final_ = calificacion.calificacion_final != null
    ? parseFloat(calificacion.calificacion_final)
    : null;

  // Estados definitivos: evaluar contra umbral de aprobación
  if (estado === ESTADO_CALIFICACION.CERRADA || estado === ESTADO_CALIFICACION.PUBLICADA) {
    if (final_ != null) {
      return final_ >= PASSING_GRADE
        ? ESTADO_ACADEMICO.ACREDITADA
        : ESTADO_ACADEMICO.NO_ACREDITADA;
    }
    // PUBLICADA/CERRADA sin calificación final →仍 pendiente de cálculo
    return ESTADO_ACADEMICO.PENDIENTE;
  }

  // Estados intermedios
  if (estado === ESTADO_CALIFICACION.BORRADOR) return ESTADO_ACADEMICO.BORRADOR;
  if (estado === ESTADO_CALIFICACION.VALIDADA) return ESTADO_ACADEMICO.VALIDADA;

  // Sin estado definido
  if (final_ != null) {
    return final_ >= PASSING_GRADE
      ? ESTADO_ACADEMICO.ACREDITADA
      : ESTADO_ACADEMICO.NO_ACREDITADA;
  }

  return ESTADO_ACADEMICO.PENDIENTE;
}

/**
 * Versión simplificada: dado solo un valor numérico, determina si aprueba.
 * Para uso en cálculos donde solo se tiene la calificación final.
 */
function determinarAprobacion(calificacionFinal) {
  if (calificacionFinal == null || isNaN(calificacionFinal)) return false;
  return parseFloat(calificacionFinal) >= PASSING_GRADE;
}

/**
 * Versión simplificada: dado un valor numérico, retorna el estado textual.
 * Para uso donde solo se tiene el promedio/calificación final.
 */
function calcularEstadoSimple(calificacion) {
  if (calificacion == null || isNaN(calificacion)) return ESTADO_ACADEMICO.SIN_CALIFICACION;
  return parseFloat(calificacion) >= PASSING_GRADE
    ? ESTADO_ACADEMICO.ACREDITADA
    : ESTADO_ACADEMICO.NO_ACREDITADA;
}

// ==============================
// 5. CONTADORES DE APROBACIÓN — Consistencia total
// ==============================

/**
 * Cuenta aprobados y no acreditados de un array de calificaciones.
 * @param {Array} calificaciones - Array de objetos con `calificacion_final`
 * @returns {{ aprobados: number, noAcreditados: number, pendientes: number, total: number }}
 */
function contarAprobacion(calificaciones) {
  const result = { aprobados: 0, noAcreditados: 0, pendientes: 0, total: calificaciones.length };
  for (const c of calificaciones) {
    const fin = c.calificacion_final != null ? parseFloat(c.calificacion_final) : null;
    if (fin == null) {
      result.pendientes++;
    } else if (fin >= PASSING_GRADE) {
      result.aprobados++;
    } else {
      result.noAcreditados++;
    }
  }
  return result;
}

/**
 * Calcula promedio de un array de calificaciones finales.
 * @param {Array} calificaciones - Array de objetos con `calificacion_final`
 * @returns {number|null}
 */
function promedioGeneral(calificaciones) {
  const fins = calificaciones
    .filter(c => c.calificacion_final != null)
    .map(c => parseFloat(c.calificacion_final));
  if (fins.length === 0) return null;
  return roundGrade(fins.reduce((s, v) => s + v, 0) / fins.length);
}

/**
 * Calcula porcentaje de aprobación.
 * @param {Array} calificaciones - Array de objetos con `calificacion_final`
 * @returns {number} Porcentaje 0-100
 */
function porcentajeAprobacion(calificaciones) {
  const fins = calificaciones.filter(c => c.calificacion_final != null);
  if (fins.length === 0) return 0;
  const aprobados = fins.filter(c => parseFloat(c.calificacion_final) >= PASSING_GRADE).length;
  return Math.round((aprobados / fins.length) * 100);
}

// ==============================
// 6. NORMALIZACIÓN DE CAMPOS — Consistencia de nomenclatura
// ==============================

/**
 * Normaliza los campos de parciales independient del nombre en DB.
 * Algunas tablas usan `parcial_1/2/3`, otras `calificacion_parcial_1/2/3`.
 * Este servicio siempre retorna `parcial_1`, `parcial_2`, `parcial_3`.
 */
function normalizarParciales(calificacion) {
  return {
    parcial_1: calificacion.parcial_1 ?? calificacion.calificacion_parcial_1 ?? null,
    parcial_2: calificacion.parcial_2 ?? calificacion.calificacion_parcial_2 ?? null,
    parcial_3: calificacion.parcial_3 ?? calificacion.calificacion_parcial_3 ?? null,
    promedio_parciales: calificacion.promedio_parciales ?? calificacion.promedio_calculado ?? null,
    calificacion_final: calificacion.calificacion_final ?? null,
    estado_calificacion: calificacion.estado_calificacion ?? null
  };
}

/**
 * Calcula el promedio de parciales a partir de los valores normalizados.
 * Siempre usa la misma fórmula: promedio de los parciales no nulos.
 */
function calcularPromedioParciales(parcial_1, parcial_2, parcial_3) {
  return calculateAverage(parcial_1, parcial_2, parcial_3);
}

// ==============================
// 7. QUERY ESTÁNDAR — Una sola consulta para todos los consumidores
// ==============================

/**
 * Consulta estándar de calificaciones por grupo y período.
 * Retorna datos normalizados listos para WEB, EXCEL, PDF y KARDEX.
 *
 * @param {number} idGrupo
 * @param {number} idPeriodo
 * @returns {Promise<Array>} Calificaciones normalizadas
 */
async function getCalificacionesGrupo(idGrupo, idPeriodo) {
  const [rows] = await pool.execute(
    `SELECT h.*, m.nombre_materia, m.clave_materia, m.creditos, m.semestre_sugerido,
            g.nombre_grupo, g.turno, g.semestre,
            CONCAT(a.apellido_paterno, ' ', a.apellido_materno, ' ', a.nombres) AS nombre_alumno,
            a.matricula, a.id_alumno,
            p.nombre_periodo,
            CONCAT(du.apellido_paterno, ' ', du.apellido_materno, ' ', du.nombres) AS nombre_docente
     FROM kardex_historial_academico h
     INNER JOIN materias m ON m.id_materia = h.id_materia
     INNER JOIN grupos g ON g.id_grupo = h.id_grupo
     INNER JOIN alumnos a ON a.id_alumno = h.id_alumno
     INNER JOIN periodos p ON p.id_periodo = h.id_periodo
     LEFT JOIN cargas_academicas ca ON ca.id_grupo = h.id_grupo AND ca.id_periodo = h.id_periodo AND ca.id_materia = h.id_materia
     LEFT JOIN docentes dn ON dn.id_docente = ca.id_docente
     LEFT JOIN usuarios du ON du.id_usuario = dn.id_usuario
     WHERE h.id_grupo = ? AND h.id_periodo = ?
     ORDER BY a.apellido_paterno, a.apellido_materno, a.nombres, m.nombre_materia`,
    [idGrupo, idPeriodo]
  );

  return rows.map(r => {
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
}

/**
 * Consulta estándar de calificaciones por alumno y período.
 * Filtra por estado PUBLICADA si se solicita solo boleta oficial.
 */
async function getCalificacionesAlumno(idAlumno, idPeriodo, soloPublicadas = false) {
  let where = 'h.id_alumno = ?';
  const params = [idAlumno];
  if (idPeriodo) { where += ' AND h.id_periodo = ?'; params.push(idPeriodo); }
  if (soloPublicadas) where += " AND h.estado_calificacion = 'PUBLICADA'";

  const [rows] = await pool.execute(
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
     ORDER BY p.nombre_periodo, m.semestre_sugerido, m.nombre_materia`,
    params
  );

  return rows.map(r => {
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
}

// ==============================
// EXPORTS — Fuente única de verdad
// ==============================
module.exports = {
  // Constantes
  PASSING_GRADE,
  MAX_GRADE,
  MIN_GRADE,
  GRADE_PRECISION,
  ESTADO_CALIFICACION,
  ESTADO_ACADEMICO,

  // Funciones de cálculo (MISMA LÓGICA PARA TODOS)
  roundGrade,
  calculateAverage,
  formatGrade,

  // Determinación de estado (MISMA LÓGICA PARA TODOS)
  calcularEstadoAcademico,
  determinarAprobacion,
  calcularEstadoSimple,

  // Contadores (MISMA LÓGICA PARA TODOS)
  contarAprobacion,
  promedioGeneral,
  porcentajeAprobacion,

  // Normalización (MISMA LÓGICA PARA TODOS)
  normalizarParciales,
  calcularPromedioParciales,

  // Queries estándar (MISMA CONSULTA PARA TODOS)
  getCalificacionesGrupo,
  getCalificacionesAlumno
};
