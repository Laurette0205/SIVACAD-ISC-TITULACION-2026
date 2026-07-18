'use strict';

const pool = require('../config/db');
const mlBridge = require('./mlBridge');

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeStatus(value) {
  return normalizeText(value).toLowerCase();
}

async function getAlumnoContext(idAlumno, idPeriodo) {
  const alumnoId = safeNumber(idAlumno, 0);
  const periodoId = safeNumber(idPeriodo, 0);

  if (alumnoId <= 0) {
    return null;
  }

  const [[alumno]] = await pool.execute(
    `
    SELECT
      a.id_alumno,
      a.nombres,
      a.apellido_paterno,
      a.apellido_materno,
      a.matricula,
      a.semestre_actual,
      a.estatus_academico,
      COALESCE(k.promedio_general, 0) AS promedio_general,
      COALESCE(k.creditos_acumulados, 0) AS creditos_acumulados
    FROM alumnos a
    LEFT JOIN kardex_alumno k
      ON k.id_alumno = a.id_alumno
    WHERE a.id_alumno = ?
    LIMIT 1
    `,
    [alumnoId]
  );

  if (!alumno) {
    return null;
  }

  const [[alertasPrevias]] = await pool.execute(
    `
    SELECT COUNT(*) AS total
    FROM ia_alertas_desercion
    WHERE id_alumno = ?
    `,
    [alumnoId]
  );

  let reinscripcionesTotal = 0;

  if (periodoId > 0) {
    const [[reinscripciones]] = await pool.execute(
      `
      SELECT COUNT(*) AS total
      FROM reinscripciones r
      INNER JOIN inscripciones i
        ON i.id_inscripcion = r.id_inscripcion
      WHERE i.id_alumno = ?
        AND i.id_periodo = ?
      `,
      [alumnoId, periodoId]
    );

    reinscripcionesTotal = Number(reinscripciones?.total || 0);
  }

  return {
    alumno,
    alertasPrevias: Number(alertasPrevias?.total || 0),
    reinscripciones: reinscripcionesTotal
  };
}

function buildRiskAnalysis(context) {
  if (!context || !context.alumno) {
    return {
      score: 0,
      nivel: 'Bajo',
      factores: [],
      explicacion: 'No se encontró contexto académico suficiente para calcular el riesgo.',
      recomendacion: 'Verificar el alumno y el periodo antes de generar la predicción.',
      confianza: 0,
      modelo_version: 'rule-v2'
    };
  }

  const { alumno, alertasPrevias, reinscripciones } = context;

  let score = 0;
  const factores = [];

  const promedio = safeNumber(alumno.promedio_general, 0);
  const semestre = Math.max(1, safeNumber(alumno.semestre_actual, 1));
  const creditos = safeNumber(alumno.creditos_acumulados, 0);
  const estatusAcademico = normalizeStatus(alumno.estatus_academico);

  if (promedio < 60) {
    score += 35;
    factores.push({
      factor: 'Promedio general muy bajo',
      peso: 35,
      detalle: `Promedio actual: ${promedio.toFixed(2)}`
    });
  } else if (promedio < 70) {
    score += 20;
    factores.push({
      factor: 'Promedio por debajo del umbral',
      peso: 20,
      detalle: `Promedio actual: ${promedio.toFixed(2)}`
    });
  } else if (promedio < 80) {
    score += 8;
    factores.push({
      factor: 'Promedio aceptable pero vulnerable',
      peso: 8,
      detalle: `Promedio actual: ${promedio.toFixed(2)}`
    });
  }

  if (estatusAcademico === 'irregular') {
    score += 15;
    factores.push({
      factor: 'Estatus académico irregular',
      peso: 15,
      detalle: 'El alumno presenta rezago o inconsistencia académica.'
    });
  }

  const creditosEsperadosMinimos = semestre * 6;
  if (creditos < creditosEsperadosMinimos) {
    score += 10;
    factores.push({
      factor: 'Bajo avance de créditos',
      peso: 10,
      detalle: `Créditos acumulados: ${creditos}, esperados mínimos: ${creditosEsperadosMinimos}`
    });
  }

  if (reinscripciones >= 2) {
    score += 12;
    factores.push({
      factor: 'Historial repetido de reinscripciones',
      peso: 12,
      detalle: `Reinscripciones en el periodo: ${reinscripciones}`
    });
  } else if (reinscripciones === 1) {
    score += 6;
    factores.push({
      factor: 'Reinscripción reciente',
      peso: 6,
      detalle: 'Existe una reinscripción en el periodo actual.'
    });
  }

  if (alertasPrevias >= 1) {
    const pesoAlertas = Math.min(10 + alertasPrevias * 3, 20);
    score += pesoAlertas;
    factores.push({
      factor: 'Alertas previas acumuladas',
      peso: pesoAlertas,
      detalle: `Alertas anteriores: ${alertasPrevias}`
    });
  }

  score = Math.min(score, 100);

  let nivel = 'Bajo';
  if (score >= 75) nivel = 'Crítico';
  else if (score >= 50) nivel = 'Alto';
  else if (score >= 25) nivel = 'Medio';

  let recomendacion = 'Mantener seguimiento normal y reforzar hábitos de estudio.';
  if (nivel === 'Crítico') {
    recomendacion =
      'Canalizar de inmediato a tutoría, coordinación y control escolar. Revisar situación académica y posible intervención urgente.';
  } else if (nivel === 'Alto') {
    recomendacion =
      'Programar seguimiento académico prioritario y contacto con el alumno dentro de 48 horas.';
  } else if (nivel === 'Medio') {
    recomendacion =
      'Monitorear el desempeño y reforzar acompañamiento académico preventivo.';
  }

  const explicacion = factores.length
    ? factores.map((f) => `${f.factor}: ${f.detalle}`).join(' | ')
    : 'No se detectaron factores de riesgo relevantes con los datos actuales.';

  return {
    score,
    nivel,
    factores,
    explicacion,
    recomendacion,
    confianza: Number((score / 100).toFixed(2)),
    modelo_version: 'rule-v2'
  };
}

async function savePrediction({
  idAlumno,
  idPeriodo,
  analysis,
  responsableId = null
}) {
  const alumnoId = safeNumber(idAlumno, 0);
  const periodoId = safeNumber(idPeriodo, 0);

  if (alumnoId <= 0 || periodoId <= 0) {
    throw new Error('idAlumno e idPeriodo son obligatorios para guardar la predicción.');
  }

  const safeAnalysis = analysis || {};
  const factoresJson = JSON.stringify(Array.isArray(safeAnalysis.factores) ? safeAnalysis.factores : []);

  const [result] = await pool.execute(
    `
    INSERT INTO ia_alertas_desercion
      (id_alumno, id_periodo, nivel_riesgo, puntaje_riesgo, descripcion, recomendacion, atendida, modelo_version, factores_json, explicacion, responsable_id)
    VALUES
      (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
    `,
    [
      alumnoId,
      periodoId,
      safeAnalysis.nivel || 'Medio',
      safeNumber(safeAnalysis.score, 0),
      `Predicción automática: riesgo ${safeAnalysis.nivel || 'Medio'}`,
      safeAnalysis.recomendacion || null,
      safeAnalysis.modelo_version || 'rule-v2',
      factoresJson,
      safeAnalysis.explicacion || null,
      responsableId
    ]
  );

  return result.insertId;
}

async function predictWithML(context) {
  if (!context || !context.alumno) {
    return null;
  }

  const { alumno } = context;

  const features = {
    promedio_general: safeNumber(alumno.promedio_general, 70),
    creditos_cursados: safeNumber(alumno.creditos_acumulados, 0),
    materias_reprobadas_total: safeNumber(alumno.materias_reprobadas, 0),
    tasa_aprobacion: safeNumber(alumno.tasa_aprobacion, 0.8),
    promedio_parcial_1: safeNumber(alumno.parcial_1, 70),
    promedio_parcial_2: safeNumber(alumno.parcial_2, 70),
    promedio_parcial_3: safeNumber(alumno.parcial_3, 70),
    pendiente_calificacion: safeNumber(alumno.pendiente_calificacion, 0),
    riesgos_acumulados: Math.min(safeNumber(context.alertasPrevias, 0), 10),
    materias_cursadas_total: safeNumber(alumno.materias_cursadas, 0),
    alumnos_activos_promedio: safeNumber(alumno.grupo_activos, 15),
    alumnos_desertores_total: safeNumber(alumno.grupo_desertores, 0),
    variabilidad_calificacion: safeNumber(alumno.variabilidad_notas, 5),
    estatus_irregular: normalizeStatus(alumno.estatus_academico) === 'irregular' ? 1 : 0,
    probabilidad_desercion: safeNumber(alumno.probabilidad_previa, 0.3),
    promedio_x_credito: safeNumber(alumno.promedio_x_credito, 2.5),
    tasa_reprobacion: safeNumber(alumno.tasa_reprobacion, 0.1),
    indice_rendimiento: safeNumber(alumno.indice_rendimiento, 0.7),
    alerta_roja: safeNumber(alumno.alerta_roja, 0),
    genero_M: safeNumber(alumno.genero_M, 1),
    genero_F: safeNumber(alumno.genero_F, 0),
    tend_Declive: 0,
    tend_Estable: 1,
    tend_Mejora: 0
  };

  if (alumno.tendencia_calificacion === 'Declive') {
    features.tend_Declive = 1; features.tend_Estable = 0; features.tend_Mejora = 0;
  } else if (alumno.tendencia_calificacion === 'Mejora') {
    features.tend_Declive = 0; features.tend_Estable = 0; features.tend_Mejora = 1;
  }

  const result = await mlBridge.predictDesercion(features);

  if (!result.success) {
    return null;
  }

  const ml = result.data;
  const score = Math.round(ml.probabilidad * 100);

  return {
    score,
    nivel: ml.nivel_riesgo || (score >= 75 ? 'Critico' : score >= 50 ? 'Alto' : score >= 25 ? 'Medio' : 'Bajo'),
    factores: (ml.factores_importantes || []).map(f => ({
      factor: f.variable,
      peso: Math.round(f.importancia * 100),
      detalle: `Importancia ML: ${(f.importancia * 100).toFixed(1)}%`
    })),
    explicacion: `Prediccion ML (XGBoost): riesgo ${ml.nivel_riesgo || 'N/D'} con ${(ml.probabilidad * 100).toFixed(1)}% de probabilidad.`,
    recomendacion: score >= 75 ? 'Canalizar de inmediato a tutoria y coordinacion. Intervencion urgente.' :
                   score >= 50 ? 'Programar seguimiento academico prioritario en 48 horas.' :
                   score >= 25 ? 'Monitorear desempeno y reforzar acompanamiento preventivo.' :
                                'Mantener seguimiento normal.',
    confianza: ml.probabilidad,
    modelo_version: ml.modelo || 'xgboost-desercion-binario-v1',
    ml_raw: ml
  };
}

async function predictWithMLFull(features) {
  const result = await mlBridge.predictDesercion(features);
  if (!result.success) {
    return null;
  }
  return result.data;
}

module.exports = {
  getAlumnoContext,
  buildRiskAnalysis,
  savePrediction,
  predictWithML,
  predictWithMLFull
};