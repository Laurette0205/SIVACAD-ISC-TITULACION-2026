'use strict';
const assert = require('assert');

let passed = 0, failed = 0;

function test(name, fn) {
  fn().then(() => { passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); })
    .catch(err => { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${err.message}`); });
}

async function run() {
  console.log('\n\x1b[36m━━━ mlBridge.js — Pruebas unitarias ━━━\x1b[0m\n');

  let mlBridge;
  try {
    mlBridge = require('../src/services/mlBridge');
    console.log('  \x1b[32m✓\x1b[0m mlBridge module loaded');
  } catch (e) {
    console.log('  \x1b[31m✗\x1b[0m mlBridge module load failed:', e.message);
    failed++;
    return { passed: 0, failed: 1 };
  }

  test('healthCheck — devuelve { success, data } o { success: false }', async () => {
    const r = await mlBridge.healthCheck();
    assert.ok('success' in r);
    if (r.success) {
      assert.ok(r.data);
      assert.ok(r.data.status);
    }
  });

  test('getModelos — devuelve lista de modelos', async () => {
    const r = await mlBridge.getModelos();
    assert.ok('success' in r);
  });

  test('predictDesercion — feature vector binario', async () => {
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
    const r = await mlBridge.predictDesercion(features);
    if (r.success) {
      assert.ok(r.data);
      assert.ok('prediccion' in r.data);
      assert.ok('probabilidad' in r.data);
      assert.ok('nivel_riesgo' in r.data);
      assert.ok([0, 1].includes(r.data.prediccion));
      assert.ok(r.data.probabilidad >= 0 && r.data.probabilidad <= 1);
    }
  });

  test('predictDesercionMulticlase — feature vector multiclase', async () => {
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
    const r = await mlBridge.predictDesercionMulticlase(features);
    if (r.success) {
      assert.ok(r.data);
      assert.ok('prediccion' in r.data);
    }
  });

  test('predictBienestar — feature vector bienestar', async () => {
    const features = {
      animo: 3, energia: 3, sueno: 3, estres: 3, apoyo: 3, ambiente: 3,
      carga_academica: 3, carga_laboral: 3, enfoque: 3, bienestar_score: 50,
      indice_riesgo: 2.5, dimensiones_promedio: 3, dimensiones_min: 1,
      dimensiones_std: 1, dimensiones_riesgo_count: 0, estres_sqrt: 1.732,
      plant_ACOMPANAMIENTO_ACADEMICO: 0, plant_BIENESTAR_GENERAL: 1,
      plant_BIENESTAR_LABORAL: 0
    };
    const r = await mlBridge.predictBienestar(features);
    if (r.success) {
      assert.ok(r.data);
      assert.ok('prediccion' in r.data);
      assert.ok('probabilidades' in r.data);
    }
  });

  test('error response — success=false y error string cuando falla', async () => {
    const r = await mlBridge.healthCheck();
    if (!r.success) {
      assert.ok(typeof r.error === 'string');
      assert.ok(r.error.length > 0);
    }
  });

  return { passed, failed };
}

module.exports = { run };
