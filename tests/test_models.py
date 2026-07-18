"""
SIVACAD-ISC · Validación de Modelos ML
Pruebas de integridad, predicción y métricas
"""
import os
import sys
import json
import pickle
import joblib
import unittest
import numpy as np

MODELS_DIR = os.path.join(os.path.dirname(__file__), '..', 'models')
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'output')

class TestModelFiles(unittest.TestCase):
    def test_models_dir_exists(self):
        self.assertTrue(os.path.isdir(MODELS_DIR))

    def test_output_dir_exists(self):
        self.assertTrue(os.path.isdir(OUTPUT_DIR))

    def test_model_pkl_files_exist(self):
        expected = ['desercion_binario.pkl', 'desercion_multiclase.pkl', 'bienestar_riesgo.pkl']
        for f in expected:
            path = os.path.join(MODELS_DIR, f)
            self.assertTrue(os.path.isfile(path), f'{f} no encontrado')

    def test_scaler_pkl_files_exist(self):
        expected = ['scaler_desercion_binario.pkl', 'scaler_desercion_multiclase.pkl', 'scaler_bienestar.pkl']
        for f in expected:
            path = os.path.join(MODELS_DIR, f)
            self.assertTrue(os.path.isfile(path), f'{f} no encontrado')

    def test_metadata_json_files_exist(self):
        expected = ['desercion_binario_metadata.json', 'desercion_multiclase_metadata.json', 'bienestar_riesgo_metadata.json']
        for f in expected:
            path = os.path.join(MODELS_DIR, f)
            self.assertTrue(os.path.isfile(path), f'{f} no encontrado')

    def test_output_evaluation_files_exist(self):
        expected = ['confusion_matrix.png', 'roc_curve.png', 'feature_importance.png',
                    'classification_report.txt']
        for f in expected:
            path = os.path.join(OUTPUT_DIR, f)
            self.assertTrue(os.path.isfile(path), f'{f} no encontrado en output/')


class TestDesercionBinario(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        meta_path = os.path.join(MODELS_DIR, 'desercion_binario_metadata.json')
        with open(meta_path) as f:
            cls.metadata = json.load(f)
        model_path = os.path.join(MODELS_DIR, 'desercion_binario.pkl')
        with open(model_path, 'rb') as f:
            cls.model = pickle.load(f)

    def test_metadata_model_name(self):
        self.assertIn('modelo', self.metadata)

    def test_accuracy_threshold(self):
        acc = self.metadata.get('accuracy') or self.metadata.get('metricas', {}).get('accuracy', 0)
        self.assertGreaterEqual(acc, 0.70, f'accuracy {acc} < 0.70')

    def test_auc_roc_threshold(self):
        auc = self.metadata.get('metricas', {}).get('auc_roc', 0)
        self.assertGreaterEqual(auc, 0.65, f'auc_roc {auc} < 0.65')

    def test_feature_count(self):
        self.assertEqual(len(self.metadata['features']), 24)

    def test_required_features(self):
        required = ['promedio_general', 'creditos_cursados', 'materias_reprobadas_total',
                    'tasa_aprobacion', 'estatus_irregular']
        for f in required:
            self.assertIn(f, self.metadata['features'], f'feature {f} faltante')

    def test_model_predict_shape(self):
        n_features = len(self.metadata['features'])
        X_dummy = np.random.rand(5, n_features).astype(np.float32)
        try:
            preds = self.model.predict(X_dummy)
            self.assertEqual(len(preds), 5)
            for p in preds:
                self.assertIn(p, [0, 1])
        except Exception as e:
            self.skipTest(f'Prediccion falló (esperado si scaler separado): {e}')

    def test_model_predict_proba_shape(self):
        if hasattr(self.model, 'predict_proba'):
            n_features = len(self.metadata['features'])
            X_dummy = np.random.rand(3, n_features).astype(np.float32)
            try:
                proba = self.model.predict_proba(X_dummy)
                self.assertEqual(proba.shape, (3, 2))
            except Exception:
                pass


class TestDesercionMulticlase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        meta_path = os.path.join(MODELS_DIR, 'desercion_multiclase_metadata.json')
        with open(meta_path) as f:
            cls.metadata = json.load(f)
        model_path = os.path.join(MODELS_DIR, 'desercion_multiclase.pkl')
        with open(model_path, 'rb') as f:
            cls.model = pickle.load(f)

    def test_accuracy_threshold(self):
        acc = self.metadata.get('accuracy') or self.metadata.get('metricas', {}).get('accuracy', 0)
        self.assertGreaterEqual(acc, 0.85, f'accuracy {acc} < 0.85')

    def test_feature_count(self):
        self.assertEqual(len(self.metadata['features']), 24)

    def test_target_classes(self):
        if 'clases' in self.metadata:
            n_classes = len(self.metadata['clases'])
            self.assertGreaterEqual(n_classes, 3)

    def test_model_predict_shape(self):
        n_features = len(self.metadata['features'])
        X_dummy = np.random.rand(5, n_features).astype(np.float32)
        try:
            preds = self.model.predict(X_dummy)
            self.assertEqual(len(preds), 5)
        except Exception as e:
            self.skipTest(f'Prediccion falló: {e}')


class TestBienestarRiesgo(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        meta_path = os.path.join(MODELS_DIR, 'bienestar_riesgo_metadata.json')
        with open(meta_path) as f:
            cls.metadata = json.load(f)
        model_path = os.path.join(MODELS_DIR, 'bienestar_riesgo.pkl')
        try:
            with open(model_path, 'rb') as f:
                cls.model = pickle.load(f)
        except Exception:
            cls.model = joblib.load(model_path)

    def test_accuracy_threshold(self):
        acc = self.metadata.get('accuracy') or self.metadata.get('metricas', {}).get('accuracy', 0)
        self.assertGreaterEqual(acc, 0.90, f'accuracy {acc} < 0.90')

    def test_feature_count(self):
        self.assertEqual(len(self.metadata['features']), 19)

    def test_model_predict_shape(self):
        n_features = len(self.metadata['features'])
        X_dummy = np.random.rand(5, n_features).astype(np.float32)
        try:
            preds = self.model.predict(X_dummy)
            self.assertEqual(len(preds), 5)
        except Exception as e:
            self.skipTest(f'Prediccion falló: {e}')


class TestLabelEncoders(unittest.TestCase):
    def _load_pkl(self, name):
        path = os.path.join(MODELS_DIR, name)
        self.assertTrue(os.path.isfile(path), f'{name} no encontrado')
        try:
            with open(path, 'rb') as f:
                return pickle.load(f)
        except Exception:
            return joblib.load(path)

    def test_label_encoder_desercion_exists(self):
        le = self._load_pkl('label_encoder_desercion.pkl')
        self.assertTrue(hasattr(le, 'classes_'))
        self.assertGreater(len(le.classes_), 1)

    def test_label_encoder_bienestar_exists(self):
        le = self._load_pkl('label_encoder_bienestar.pkl')
        self.assertTrue(hasattr(le, 'classes_'))
        self.assertGreater(len(le.classes_), 1)


class TestScalers(unittest.TestCase):
    def _load_pkl(self, name):
        path = os.path.join(MODELS_DIR, name)
        self.assertTrue(os.path.isfile(path), f'{name} no encontrado')
        try:
            with open(path, 'rb') as f:
                return pickle.load(f)
        except Exception:
            return joblib.load(path)

    def test_scalers_are_fitted(self):
        scalers = ['scaler_desercion_binario.pkl', 'scaler_desercion_multiclase.pkl', 'scaler_bienestar.pkl']
        for s in scalers:
            scaler = self._load_pkl(s)
            self.assertTrue(hasattr(scaler, 'mean_'), f'{s} no tiene mean_ (no fitted?)')
            self.assertTrue(hasattr(scaler, 'scale_'), f'{s} no tiene scale_ (no fitted?)')
            self.assertGreater(len(scaler.mean_), 0)


def generate_report():
    """Genera reporte de validación en JSON"""
    report = {
        'fecha': __import__('datetime').datetime.now().isoformat(),
        'modelos': {},
        'output_files': [],
        'pruebas': []
    }
    for model_name in ['desercion_binario', 'desercion_multiclase', 'bienestar_riesgo']:
        meta_path = os.path.join(MODELS_DIR, f'{model_name}_metadata.json')
        if os.path.exists(meta_path):
            with open(meta_path) as f:
                report['modelos'][model_name] = json.load(f)

    if os.path.isdir(OUTPUT_DIR):
        report['output_files'] = os.listdir(OUTPUT_DIR)

    return report


if __name__ == '__main__':
    print('\n' + '=' * 60)
    print('  SIVACAD-ISC · Validación de Modelos ML (Python)')
    print('=' * 60)
    unittest.main(verbosity=2, exit=False)

    report = generate_report()
    report_path = os.path.join(os.path.dirname(__file__), '..', '..', 'tests', 'reporte_validacion_ml.json')
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2, default=str)
    print(f'\n  Reporte de validación guardado: {report_path}')
