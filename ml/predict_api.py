"""
predict_api.py — API REST para servir modelos ML de SIVACAD
===========================================================
Endpoints:
  POST /predict         -> Prediccion principal
  GET  /health          -> Health check
  GET  /modelos         -> Lista de modelos disponibles
  GET  /modelo/<nombre> -> Metadata del modelo

Uso: python predict_api.py
     -> Inicia en http://0.0.0.0:5001
"""

import os
import sys
import json
import pandas as pd
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
from datetime import datetime


def _numpy_default(obj):
    """Default serialization for numpy types."""
    if isinstance(obj, (np.integer,)):
        return int(obj)
    elif isinstance(obj, (np.floating,)):
        return float(obj)
    elif isinstance(obj, (np.ndarray,)):
        return obj.tolist()
    elif isinstance(obj, (np.bool_,)):
        return bool(obj)
    raise TypeError(f'Object of type {type(obj).__name__} is not JSON serializable')


app = Flask(__name__)
# Override Flask's JSON default handler
app.json.default = staticmethod(_numpy_default)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
CORS(app)

MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')

# ---------- Cargar modelos al iniciar ----------
MODELS = {}
METADATA = {}


def load_all_models():
    global MODELS, METADATA
    model_files = {
        'desercion_binario': {
            'model': 'desercion_binario.pkl',
            'scaler': 'scaler_desercion_binario.pkl',
        },
        'desercion_multiclase': {
            'model': 'desercion_multiclase.pkl',
            'scaler': 'scaler_desercion_multiclase.pkl',
            'encoder': 'label_encoder_desercion.pkl',
        },
        'bienestar_riesgo': {
            'model': 'bienestar_riesgo.pkl',
            'scaler': 'scaler_bienestar.pkl',
            'encoder': 'label_encoder_bienestar.pkl',
        }
    }

    for name, files in model_files.items():
        try:
            model_path = os.path.join(MODELS_DIR, files['model'])
            if not os.path.exists(model_path):
                print(f'  [!] {name}: modelo no encontrado en {model_path}')
                continue

            MODELS[name] = {
                'model': joblib.load(model_path),
                'scaler': joblib.load(os.path.join(MODELS_DIR, files['scaler'])) if 'scaler' in files else None,
            }
            if 'encoder' in files:
                enc_path = os.path.join(MODELS_DIR, files['encoder'])
                if os.path.exists(enc_path):
                    MODELS[name]['encoder'] = joblib.load(enc_path)

            meta_path = os.path.join(MODELS_DIR, files['model'].replace('.pkl', '_metadata.json'))
            if os.path.exists(meta_path):
                with open(meta_path, 'r') as f:
                    METADATA[name] = json.load(f)
            else:
                METADATA[name] = {'modelo': name, 'fecha_carga': datetime.now().isoformat()}

            print(f'  [OK] {name}: cargado exitosamente')
        except Exception as e:
            print(f'  [!!] {name}: error al cargar - {e}')


# ---------- Endpoints ----------

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.now().isoformat(),
        'modelos_cargados': list(MODELS.keys()),
        'version': '1.0'
    })


@app.route('/modelos', methods=['GET'])
def listar_modelos():
    info = {}
    for name, meta in METADATA.items():
        info[name] = {
            'tipo': meta.get('modelo', name),
            'fecha_entrenamiento': meta.get('fecha_entrenamiento', 'desconocida'),
            'metricas': meta.get('metricas', {}),
            'features': meta.get('features', [])[:5],
        }
    return jsonify(info)


@app.route('/modelo/<nombre>', methods=['GET'])
def metadata_modelo(nombre):
    if nombre not in METADATA:
        return jsonify({'error': 'Modelo no encontrado'}), 404
    return jsonify(METADATA[nombre])


@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'JSON invalido'}), 400

        modulo = data.get('modulo', 'desercion')
        tipo = data.get('tipo', 'binario')
        features = data.get('features', {})

        # Determinar que modelo usar
        if modulo == 'desercion' and tipo == 'binario':
            model_key = 'desercion_binario'
        elif modulo == 'desercion' and tipo == 'multiclase':
            model_key = 'desercion_multiclase'
        elif modulo == 'bienestar':
            model_key = 'bienestar_riesgo'
        else:
            return jsonify({'error': f'Combinacion modulo/tipo no valida: {modulo}/{tipo}'}), 400

        if model_key not in MODELS:
            return jsonify({'error': f'Modelo {model_key} no cargado'}), 503

        model_data = MODELS[model_key]
        model = model_data['model']
        scaler = model_data['scaler']
        encoder = model_data.get('encoder')

        # Convertir features a DataFrame
        X = pd.DataFrame([features])

        # Asegurar tipos correctos
        for c in X.select_dtypes(include=['bool']).columns:
            X[c] = X[c].astype(int)

        # Validar y ordenar features
        expected_features = METADATA.get(model_key, {}).get('features', [])
        if expected_features:
            missing = [f for f in expected_features if f not in X.columns]
            if missing:
                return jsonify({
                    'error': f'Faltan features: {missing}',
                    'esperadas': expected_features,
                    'recibidas': list(X.columns)
                }), 400
            # Reordenar para coincidir con el entrenamiento
            X = X[expected_features]

        # Escalar
        if scaler:
            X_scaled = scaler.transform(X)
        else:
            X_scaled = X.values

        # Predecir
        prediccion = model.predict(X_scaled)

        # Probabilidades (convertir a Python nativo)
        probas = None
        if hasattr(model, 'predict_proba'):
            probas = model.predict_proba(X_scaled)
            # Convertir a floats nativos
            probas = [[float(p) for p in row] for row in probas]

        # Formatear respuesta segun tipo
        if model_key == 'desercion_binario':
            clase = int(prediccion[0])
            probabilidad = float(probas[0][1]) if probas is not None else 0.0
            if probabilidad >= 0.75:
                nivel = 'Critico'
            elif probabilidad >= 0.5:
                nivel = 'Alto'
            elif probabilidad >= 0.25:
                nivel = 'Medio'
            else:
                nivel = 'Bajo'
            response = {
                'prediccion': clase,
                'probabilidad': round(probabilidad, 4),
                'nivel_riesgo': nivel,
                'confianza': round(probabilidad, 4),
                'label': 'Deserta' if clase == 1 else 'No Deserta',
                'modelo': 'xgboost-desercion-binario-v1',
                'timestamp': datetime.now().isoformat()
            }

        elif model_key == 'desercion_multiclase':
            clase_idx = int(prediccion[0])
            clases = list(encoder.classes_) if encoder else []
            clase_label = encoder.inverse_transform([clase_idx])[0] if encoder else str(clase_idx)
            probas_dict = {}
            if probas is not None and encoder:
                for i, cls in enumerate(encoder.classes_):
                    probas_dict[str(cls)] = round(float(probas[0][i]), 4)
            response = {
                'prediccion': clase_label,
                'probabilidades': probas_dict,
                'confianza': round(float(max(probas[0])) if probas else 0, 4),
                'modelo': 'xgboost-desercion-multiclase-v1',
                'timestamp': datetime.now().isoformat()
            }

        elif model_key == 'bienestar_riesgo':
            clase_idx = int(prediccion[0])
            clases = list(encoder.classes_) if encoder else []
            clase_label = encoder.inverse_transform([clase_idx])[0] if encoder else str(clase_idx)
            probas_dict = {}
            if probas is not None and encoder:
                # Handle case where model predicts fewer classes than encoder has
                n_probas = len(probas[0])
                for i, cls in enumerate(encoder.classes_):
                    if i < n_probas:
                        probas_dict[str(cls)] = round(float(probas[0][i]), 4)
                    else:
                        probas_dict[str(cls)] = 0.0
            requiere_derivacion = clase_label in ('Alto', 'Critico')
            response = {
                'prediccion': clase_label,
                'probabilidades': probas_dict,
                'confianza': round(float(max(probas[0])) if probas else 0, 4),
                'requiere_derivacion': requiere_derivacion,
                'modelo': 'rf-bienestar-riesgo-v1',
                'timestamp': datetime.now().isoformat()
            }

        # Feature importance
        try:
            if hasattr(model, 'feature_importances_') and expected_features:
                feats_imp = sorted(zip(expected_features, [float(x) for x in model.feature_importances_]),
                                  key=lambda x: x[1], reverse=True)[:5]
                response['factores_importantes'] = [
                    {'variable': f, 'importancia': round(i, 4)} for f, i in feats_imp
                ]
        except Exception as e:
            response['factores_importantes_error'] = str(e)

        return jsonify(response)

    except Exception as e:
        return jsonify({'error': str(e), 'tipo': type(e).__name__}), 500


if __name__ == '__main__':
    import sys as _sys
    def _p(s):
        try:
            print(s)
        except UnicodeEncodeError:
            for k, v in {'╔':'','╗':'','║':'','╚':'','╝':'','═':'-','•':'*','→':'->','✅':'[OK]','⚠️':'[!]','á':'a','é':'e','í':'i','ó':'o','ú':'u','ñ':'n'}.items():
                s = s.replace(k, v)
            try:
                print(s)
            except UnicodeEncodeError:
                print(s.encode('ascii', 'replace').decode())
    _p('+==============================================================+')
    _p('|  SIVACAD-ISC - API DE PREDICCION ML                        |')
    _p('+==============================================================+')
    _p('')

    _p('Cargando modelos...')
    load_all_models()
    _p(f'\nModelos disponibles: {len(MODELS)}')

    if not MODELS:
        _p('[!] No hay modelos cargados. Ejecuta primero train_model.py')
    else:
        _p('\n[OK] API lista en http://0.0.0.0:5001')
        _p('   Endpoints:')
        _p('   GET  /health          -> Health check')
        _p('   GET  /modelos         -> Listar modelos')
        _p('   GET  /modelo/<nombre> -> Metadata del modelo')
        _p('   POST /predict         -> Predecir')
        _p('')

    app.run(host='0.0.0.0', port=5001, debug=False)
