'use strict';
const assert = require('assert');

let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err) {
    failed++;
    console.log(`  \x1b[31m✗\x1b[0m ${name}: ${err.message}`);
  }
}

async function run() {
  console.log('\n\x1b[36m━━━ iaDesercionPredictor.js — Pruebas unitarias ━━━\x1b[0m\n');

  let predictor;
  try {
    predictor = require('../src/services/iaDesercionPredictor');
    console.log('  \x1b[32m✓\x1b[0m predictor module loaded');
  } catch (e) {
    console.log('  \x1b[31m✗\x1b[0m predictor module load failed:', e.message);
    failed++;
    return { passed: 0, failed: 1 };
  }

  test('module exports correct functions', () => {
    assert.strictEqual(typeof predictor.getAlumnoContext, 'function');
    assert.strictEqual(typeof predictor.buildRiskAnalysis, 'function');
    assert.strictEqual(typeof predictor.savePrediction, 'function');
    assert.strictEqual(typeof predictor.predictWithML, 'function');
    assert.strictEqual(typeof predictor.predictWithMLFull, 'function');
  });

  test('buildRiskAnalysis — contexto null devuelve respuesta por defecto', () => {
    const r = predictor.buildRiskAnalysis(null);
    assert.strictEqual(r.score, 0);
    assert.strictEqual(r.nivel, 'Bajo');
    assert.strictEqual(r.confianza, 0);
    assert.strictEqual(r.modelo_version, 'rule-v2');
  });

  test('buildRiskAnalysis — contexto vacío devuelve respuesta por defecto', () => {
    const r = predictor.buildRiskAnalysis({});
    assert.strictEqual(r.score, 0);
    assert.strictEqual(r.nivel, 'Bajo');
  });

  test('buildRiskAnalysis — bajo riesgo con buen promedio', () => {
    const context = {
      alumno: { promedio_general: 90, estatus_academico: 'Regular' },
      alertasPrevias: 0,
      reinscripciones: 1
    };
    const r = predictor.buildRiskAnalysis(context);
    assert.ok(r.score >= 0);
    assert.ok(['Bajo', 'Medio', 'Alto', 'Critico'].includes(r.nivel));
    assert.ok(Array.isArray(r.factores));
    assert.ok(typeof r.recomendacion === 'string');
    assert.strictEqual(r.modelo_version, 'rule-v2');
  });

  test('buildRiskAnalysis — alto riesgo con mal promedio y alertas', () => {
    const context = {
      alumno: { promedio_general: 55, estatus_academico: 'Irregular' },
      alertasPrevias: 5,
      reinscripciones: 0
    };
    const r = predictor.buildRiskAnalysis(context);
    assert.ok(r.score >= 0);
    assert.ok(r.factores.length > 0);
  });

  test('predictWithML — contexto null devuelve null', async () => {
    const r = await predictor.predictWithML(null);
    assert.strictEqual(r, null);
  });

  test('predictWithML — contexto sin alumno devuelve null', async () => {
    const r = await predictor.predictWithML({});
    assert.strictEqual(r, null);
  });

  test('predictWithML — contexto válido (ML disponible o fallback null)', async () => {
    const context = {
      alumno: {
        promedio_general: 72, creditos_acumulados: 110, materias_reprobadas: 4,
        tasa_aprobacion: 0.78, parcial_1: 68, parcial_2: 65, parcial_3: 70,
        pendiente_calificacion: 0, materias_cursadas: 28, grupo_activos: 22,
        grupo_desertores: 4, variabilidad_notas: 10, estatus_academico: 'Regular',
        probabilidad_previa: 0.35, promedio_x_credito: 2.3, tasa_reprobacion: 0.15,
        indice_rendimiento: 0.65, alerta_roja: 0, genero_M: 1, genero_F: 0,
        tendencia_calificacion: 'Declive'
      },
      alertasPrevias: 2
    };
    const r = await predictor.predictWithML(context);
    if (r !== null) {
      assert.ok(typeof r.score === 'number');
      assert.ok(r.score >= 0 && r.score <= 100);
      assert.ok(['Bajo', 'Medio', 'Alto', 'Critico'].includes(r.nivel));
      assert.ok(Array.isArray(r.factores));
      assert.ok(typeof r.recomendacion === 'string');
      assert.ok(typeof r.confianza === 'number');
      assert.ok(r.confianza >= 0 && r.confianza <= 1);
      assert.ok(typeof r.modelo_version === 'string');
      assert.ok(r.ml_raw);
      assert.ok('prediccion' in r.ml_raw);
    }
  });

  test('predictWithMLFull — feature vector devuelve data o null', async () => {
    const features = {
      promedio_general: 75, creditos_cursados: 120, materias_reprobadas_total: 3,
      tasa_aprobacion: 0.85, promedio_parcial_1: 70, promedio_parcial_2: 70,
      promedio_parcial_3: 70, pendiente_calificacion: 0, riesgos_acumulados: 2,
      materias_cursadas_total: 30, alumnos_activos_promedio: 25,
      alumnos_desertores_total: 3, variabilidad_calificacion: 8,
      estatus_irregular: 0, probabilidad_desercion: 0.3, promedio_x_credito: 2.5,
      tasa_reprobacion: 0.1, indice_rendimiento: 0.7, alerta_roja: 0,
      genero_M: 1, genero_F: 0, tend_Declive: 0, tend_Estable: 1, tend_Mejora: 0
    };
    const r = await predictor.predictWithMLFull(features);
    if (r !== null) {
      assert.ok('prediccion' in r);
      assert.ok('probabilidad' in r);
    }
  });

  return { passed, failed };
}

module.exports = { run };
