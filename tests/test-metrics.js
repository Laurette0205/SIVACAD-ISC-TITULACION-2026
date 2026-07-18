'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;

const MODELS_DIR = path.join(__dirname, '..', 'ml', 'models');

const MIN_THRESHOLDS = {
  desercion_binario: {
    accuracy: 0.70,
    precision: 0.40,
    recall: 0.35,
    f1_score: 0.35,
    auc_roc: 0.65
  },
  desercion_multiclase: {
    accuracy: 0.85
  },
  bienestar_riesgo: {
    accuracy: 0.90
  }
};

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

function loadMetadata(modelName) {
  const p = path.join(MODELS_DIR, `${modelName}_metadata.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function run() {
  console.log('\n\x1b[36m━━━ Métricas de modelos — Validación ━━━\x1b[0m\n');

  test('Directorio de modelos existe', () => {
    assert.ok(fs.existsSync(MODELS_DIR));
  });

  test('Archivos de metadata existen para los 3 modelos', () => {
    const models = ['desercion_binario', 'desercion_multiclase', 'bienestar_riesgo'];
    for (const m of models) {
      const meta = loadMetadata(m);
      assert.ok(meta !== null, `metadata para ${m} no encontrada`);
    }
  });

  test('Archivos .pkl existen para los 3 modelos', () => {
    const models = ['desercion_binario.pkl', 'desercion_multiclase.pkl', 'bienestar_riesgo.pkl'];
    for (const m of models) {
      assert.ok(fs.existsSync(path.join(MODELS_DIR, m)), `${m} no encontrado`);
    }
  });

  test('Archivos scaler existen', () => {
    const scalers = ['scaler_desercion_binario.pkl', 'scaler_desercion_multiclase.pkl', 'scaler_bienestar.pkl'];
    for (const s of scalers) {
      assert.ok(fs.existsSync(path.join(MODELS_DIR, s)), `${s} no encontrado`);
    }
  });

  Object.entries(MIN_THRESHOLDS).forEach(([modelName, thresholds]) => {
    const meta = loadMetadata(modelName);
    if (!meta) return;

    test(`${modelName} — metadata tiene campos requeridos`, () => {
      assert.ok(meta.modelo);
      assert.ok(meta.fecha_entrenamiento);
      assert.ok(Array.isArray(meta.features));
      assert.ok(meta.features.length > 0);
    });

    test(`${modelName} — features list tiene al menos 5 features`, () => {
      assert.ok(meta.features.length >= 5);
    });

    if (meta.registros_entrenamiento) {
      test(`${modelName} — registros_entrenamiento > 0`, () => {
        assert.ok(meta.registros_entrenamiento > 0);
      });
    }

    if (meta.registros_prueba) {
      test(`${modelName} — registros_prueba > 0`, () => {
        assert.ok(meta.registros_prueba > 0);
      });
    }

    Object.entries(thresholds).forEach(([metric, minVal]) => {
      const actual = meta.metricas?.[metric] ?? meta[metric];
      if (actual !== undefined) {
        test(`${modelName} — ${metric} >= ${minVal} (actual: ${typeof actual === 'number' ? actual.toFixed(4) : actual})`, () => {
          assert.ok(actual >= minVal, `${metric} ${actual} < umbral mínimo ${minVal}`);
        });
      }
    });
  });

  const binMeta = loadMetadata('desercion_binario');
  if (binMeta) {
    test('desercion_binario — 24 features exactas', () => {
      assert.strictEqual(binMeta.features.length, 24);
    });

    test('desercion_binario — features requeridas presentes', () => {
      const required = ['promedio_general', 'creditos_cursados', 'materias_reprobadas_total'];
      for (const f of required) {
        assert.ok(binMeta.features.includes(f), `feature '${f}' no encontrada`);
      }
    });
  }

  const bienMeta = loadMetadata('bienestar_riesgo');
  if (bienMeta) {
    test('bienestar_riesgo — 19 features exactas', () => {
      assert.strictEqual(bienMeta.features.length, 19);
    });
  }

  test('Output directory existe y tiene archivos de evaluación', () => {
    const outDir = path.join(__dirname, '..', 'ml', 'output');
    assert.ok(fs.existsSync(outDir));
    const files = fs.readdirSync(outDir);
    const expectedGraphics = ['confusion_matrix.png', 'roc_curve.png', 'feature_importance.png'];
    for (const f of expectedGraphics) {
      assert.ok(files.includes(f), `gráfico '${f}' no encontrado en output/`);
    }
  });

  return { passed, failed };
}

module.exports = { run };
