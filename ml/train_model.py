"""
train_model.py — Entrenamiento de Modelos de Machine Learning para SIVACAD
===========================================================================
Entrena 3 modelos:
  1. Deserción Binaria  (XGBoost)  → ¿Deserta o no?
  2. Deserción Multiclase (XGBoost) → Bajo/Medio/Alto/Crítico
  3. Bienestar (Random Forest) → Nivel de Riesgo

Guarda: models/*.pkl, models/*scaler.pkl
Reportes: output/train_report.txt
"""

import os
import sys
import warnings
import pandas as pd
import numpy as np
import json
from datetime import datetime

warnings.filterwarnings('ignore')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'output')
MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')
os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

REPORT = []
def _clean_ascii(s):
    replacements = {
        '═': '=', '╔': '+', '╗': '+', '║': '|', '╚': '+', '╝': '+',
        '📦': '[ML]', '📎': '[.]',
        '✅': '[OK]', '❌': '[!!]', '⚠️': '[!]',
        '•': '*', '├': '|', '┤': '|', '─': '-', '│': '|',
        '┌': '+', '┐': '+', '└': '+', '┘': '+',
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
        'ñ': 'n', 'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ñ': 'N',
        'ü': 'u', 'Ü': 'U', '→': '->', '📊': '[G]',
    }
    for k, v in replacements.items():
        s = s.replace(k, v)
    return s

def r(s):
    REPORT.append(s)
    try:
        print(s)
    except UnicodeEncodeError:
        print(_clean_ascii(s))


def load_dataset(path, name):
    r(f'\n{"=" * 60}')
    r(f'CARGANDO DATASET: {name}')
    r(f'{"=" * 60}')
    df = pd.read_csv(path)
    r(f'  Registros: {len(df)}')
    r(f'  Columnas: {list(df.columns)}')
    return df


def entrenar_desercion_binario(df):
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import StandardScaler
    from xgboost import XGBClassifier
    from sklearn.metrics import (accuracy_score, precision_score, recall_score,
                                 f1_score, roc_auc_score, roc_curve,
                                 confusion_matrix, classification_report)
    import joblib

    r(f'\n{"-" * 50}')
    r('MODELO 1: DESERCIÓN BINARIA (XGBoost)')
    r(f'{"-" * 50}')
    r('Objetivo: Predecir si un alumno desertará (1) o no (0)')
    r('Algoritmo: XGBoost (Extreme Gradient Boosting)')
    r('')
    r('¿CÓMO FUNCIONA XGBOOST?')
    r('  1. Crea un primer árbol de decisión simple')
    r('  2. Identifica en qué alumnos se equivocó')
    r('  3. Crea un segundo árbol enfocado en corregir esos errores')
    r('  4. Repite 200 veces (n_estimators=200)')
    r('  5. La predicción final es la suma ponderada de todos los árboles')
    r('')

    # Preparar datos
    id_cols = ['id_alumno']
    target_col = 'target_binario'
    feature_cols = [c for c in df.columns if c not in id_cols + [target_col, 'target_multiclase']]

    X = df[feature_cols].copy()
    y = df[target_col]

    # Convertir dummies categóricas a int
    for c in X.select_dtypes(include=['bool']).columns:
        X[c] = X[c].astype(int)

    r(f'Features ({len(feature_cols)}):')
    for f in feature_cols:
        r(f'  • {f}')

    r(f'\nDistribución target:')
    r(f'  Clase 0 (No deserta): {(y == 0).sum()} ({((y == 0).mean() * 100):.1f}%)')
    r(f'  Clase 1 (Deserta):    {(y == 1).sum()} ({((y == 1).mean() * 100):.1f}%)')

    # Dividir 80/20 estratificado
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    r(f'\nSplit: Train={len(X_train)}, Test={len(X_test)}')
    r(f'  Train: clase 0={sum(y_train==0)}, clase 1={sum(y_train==1)}')
    r(f'  Test:  clase 0={sum(y_test==0)}, clase 1={sum(y_test==1)}')

    # Escalar
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    r('  ✅ Scaler ajustado con Media y Std de cada feature')

    # Entrenar XGBoost
    r('\nENTRENANDO XGBoost...')
    model = XGBClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=1,
        gamma=0,
        reg_alpha=0,
        reg_lambda=1,
        scale_pos_weight=(y_train == 0).sum() / (y_train == 1).sum(),
        random_state=42,
        eval_metric='logloss',
        use_label_encoder=False,
        n_jobs=-1
    )
    model.fit(X_train_scaled, y_train)

    r('  ✅ Entrenamiento completado')
    r(f'  Árboles creados: {model.n_estimators}')

    # Predecir
    r('\nEVALUANDO EN TEST (datos no vistos durante entrenamiento)...')
    y_pred = model.predict(X_test_scaled)
    y_proba = model.predict_proba(X_test_scaled)[:, 1]

    # Métricas
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    auc = roc_auc_score(y_test, y_proba)

    r(f'\n═══ MÉTRICAS ═══')
    r(f'  Accuracy:  {accuracy:.4f}  ({accuracy * 100:.1f}%)')
    r(f'  Precision: {precision:.4f}  ({precision * 100:.1f}%)')
    r(f'  Recall:    {recall:.4f}  ({recall * 100:.1f}%)')
    r(f'  F1-Score:  {f1:.4f}  ({f1 * 100:.1f}%)')
    r(f'  AUC-ROC:   {auc:.4f}  ({auc * 100:.1f}%)')

    r(f'\nExplicación de métricas:')
    r(f'  • Accuracy:  Del total de predicciones, {accuracy*100:.1f}% fueron correctas')
    r(f'  • Precision: De los que predije como desertores, {precision*100:.1f}% realmente lo fueron')
    r(f'  • Recall:    De los que realmente desertaron, detecté el {recall*100:.1f}%')
    r(f'  • F1-Score:  Balance entre Precision y Recall = {f1:.3f}')
    r(f'  • AUC-ROC:   Capacidad de separar clases = {auc:.3f} (1.0 = perfecto)')

    # Matriz de confusión
    cm = confusion_matrix(y_test, y_pred)
    r(f'\nMatriz de Confusión:')
    r(f'              ───────────────')
    r(f'              │  NO DES  DES │')
    r(f'  ───────────────────────────────')
    r(f'  Pred NO DES  │  {cm[0][0]:3d}     {cm[0][1]:3d}  │')
    r(f'  Pred DES     │  {cm[1][0]:3d}     {cm[1][1]:3d}  │')
    r(f'  ───────────────────────────────')

    # Feature importance
    importance = pd.DataFrame({
        'feature': feature_cols,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)

    r(f'\nTop 10 variables más importantes:')
    for i, (_, row) in enumerate(importance.head(10).iterrows()):
        r(f'  {i + 1}. {row["feature"]:35s} → {row["importance"]:.4f} ({row["importance"] * 100:.2f}%)')

    # Guardar
    model_path = os.path.join(MODELS_DIR, 'desercion_binario.pkl')
    scaler_path = os.path.join(MODELS_DIR, 'scaler_desercion_binario.pkl')
    joblib.dump(model, model_path)
    joblib.dump(scaler, scaler_path)
    r(f'\n✅ Modelo guardado: {model_path}')
    r(f'✅ Scaler guardado: {scaler_path}')

    # Guardar metadatos
    metadata = {
        'modelo': 'XGBoost Deserción Binaria',
        'fecha_entrenamiento': datetime.now().isoformat(),
        'dataset': 'dataset_desercion.csv',
        'registros_entrenamiento': len(X_train),
        'registros_prueba': len(X_test),
        'features': feature_cols,
        'target': target_col,
        'distribucion_train': {
            'clase_0': int(sum(y_train == 0)),
            'clase_1': int(sum(y_train == 1))
        },
        'distribucion_test': {
            'clase_0': int(sum(y_test == 0)),
            'clase_1': int(sum(y_test == 1))
        },
        'metricas': {
            'accuracy': float(accuracy),
            'precision': float(precision),
            'recall': float(recall),
            'f1_score': float(f1),
            'auc_roc': float(auc)
        },
        'top_features': importance.head(10).to_dict('records'),
        'hiperparametros': model.get_params()
    }
    meta_path = os.path.join(MODELS_DIR, 'desercion_binario_metadata.json')
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, default=str)
    r(f'✅ Metadata guardada: {meta_path}')

    return model, scaler, metadata


def entrenar_desercion_multiclase(df):
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import StandardScaler, LabelEncoder
    from xgboost import XGBClassifier
    from sklearn.metrics import (accuracy_score, classification_report,
                                 confusion_matrix)
    import joblib

    r(f'\n{"-" * 50}')
    r('MODELO 2: DESERCIÓN MULTICLASE (XGBoost)')
    r(f'{"-" * 50}')
    r('Objetivo: Clasificar riesgo en 4 niveles: Bajo/Medio/Alto/Crítico')
    r('')

    id_cols = ['id_alumno', 'target_binario']
    target_col = 'target_multiclase'
    feature_cols = [c for c in df.columns if c not in id_cols + [target_col]]

    X = df[feature_cols].copy()
    y_raw = df[target_col]

    for c in X.select_dtypes(include=['bool']).columns:
        X[c] = X[c].astype(int)

    le = LabelEncoder()
    y = le.fit_transform(y_raw)
    r(f'Mapping clases: {dict(zip(le.classes_, le.transform(le.classes_)))}')

    r(f'\nDistribución:')
    for cls in le.classes_:
        cnt = sum(y_raw == cls)
        r(f'  {cls}: {cnt} ({cnt / len(y_raw) * 100:.1f}%)')

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    model = XGBClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        objective='multi:softprob',
        num_class=len(le.classes_),
        random_state=42,
        eval_metric='mlogloss',
        n_jobs=-1
    )
    model.fit(X_train_scaled, y_train)

    y_pred = model.predict(X_test_scaled)
    accuracy = accuracy_score(y_test, y_pred)
    cm = confusion_matrix(y_test, y_pred)
    report = classification_report(y_test, y_pred, target_names=le.classes_)

    r(f'\nAccuracy: {accuracy:.4f} ({accuracy * 100:.1f}%)')
    r(f'\nClassification Report:')
    r(f'{report}')

    # Matriz de confusión
    r(f'Matriz de Confusión (filas=real, columnas=predicción):')
    header = '  {"":12s}'
    for cls in le.classes_:
        header += f'{cls:10s}'
    r(header)
    for i, cls in enumerate(le.classes_):
        line = f'  {cls:10s} '
        for j in range(len(le.classes_)):
            line += f'{cm[i][j]:<10d}'
        r(line)

    model_path = os.path.join(MODELS_DIR, 'desercion_multiclase.pkl')
    scaler_path = os.path.join(MODELS_DIR, 'scaler_desercion_multiclase.pkl')
    le_path = os.path.join(MODELS_DIR, 'label_encoder_desercion.pkl')
    joblib.dump(model, model_path)
    joblib.dump(scaler, scaler_path)
    joblib.dump(le, le_path)
    r(f'\n✅ Modelo guardado: {model_path}')

    # Guardar metadatos
    metadata = {
        'modelo': 'XGBoost Deserción Multiclase',
        'fecha_entrenamiento': datetime.now().isoformat(),
        'dataset': 'dataset_desercion.csv',
        'registros_entrenamiento': len(X_train),
        'registros_prueba': len(X_test),
        'features': feature_cols,
        'target': target_col,
        'clases': list(le.classes_),
        'distribucion_train': {str(le.classes_[i]): int(sum(y_train == i)) for i in range(len(le.classes_))},
        'distribucion_test': {str(le.classes_[i]): int(sum(y_test == i)) for i in range(len(le.classes_))},
        'metricas': {
            'accuracy': float(accuracy),
        },
        'hiperparametros': {k: str(v) for k, v in model.get_params().items()}
    }
    meta_path = os.path.join(MODELS_DIR, 'desercion_multiclase_metadata.json')
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, default=str)
    r(f'✅ Metadata guardada: {meta_path}')

    return model, scaler, le


def entrenar_bienestar(df):
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import StandardScaler, LabelEncoder
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import (accuracy_score, classification_report,
                                 confusion_matrix)
    import joblib

    r(f'\n{"-" * 50}')
    r('MODELO 3: BIENESTAR — NIVEL DE RIESGO (Random Forest)')
    r(f'{"-" * 50}')
    r('Objetivo: Predecir nivel de riesgo psicosocial del alumno')
    r('Algoritmo: Random Forest (Bosque Aleatorio)')
    r('')
    r('¿CÓMO FUNCIONA RANDOM FOREST?')
    r('  1. Crea 100 árboles de decisión')
    r('  2. Cada árbol usa una muestra aleatoria de datos y variables')
    r('  3. Cada árbol "vota" por una clase de riesgo')
    r('  4. La clase con más votos es la predicción final')
    r('  5. Esto reduce el sobreajuste (overfitting)')
    r('')

    target_col = 'nivel_riesgo'
    drop_cols = ['nivel_riesgo_encoded', 'crisis_911', 'requiere_derivacion']
    feature_cols = [c for c in df.columns if c not in drop_cols + [target_col]]

    X = df[feature_cols].copy()
    y_raw = df[target_col]

    for c in X.select_dtypes(include=['bool']).columns:
        X[c] = X[c].astype(int)

    le = LabelEncoder()
    y = le.fit_transform(y_raw)
    r(f'Mapping clases: {dict(zip(le.classes_, le.transform(le.classes_)))}')

    r(f'\nDistribución:')
    for cls in le.classes_:
        cnt = sum(y_raw == cls)
        r(f'  {cls}: {cnt} ({cnt / len(y_raw) * 100:.1f}%)')

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=10,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
        class_weight='balanced'
    )
    model.fit(X_train_scaled, y_train)

    y_pred = model.predict(X_test_scaled)
    accuracy = accuracy_score(y_test, y_pred)
    cm = confusion_matrix(y_test, y_pred, labels=list(range(len(le.classes_))))
    report = classification_report(y_test, y_pred, target_names=le.classes_, labels=list(range(len(le.classes_))))

    r(f'\nAccuracy: {accuracy:.4f} ({accuracy * 100:.1f}%)')
    r(f'\nClassification Report:')
    r(f'{report}')

    model_path = os.path.join(MODELS_DIR, 'bienestar_riesgo.pkl')
    scaler_path = os.path.join(MODELS_DIR, 'scaler_bienestar.pkl')
    le_path = os.path.join(MODELS_DIR, 'label_encoder_bienestar.pkl')
    joblib.dump(model, model_path)
    joblib.dump(scaler, scaler_path)
    joblib.dump(le, le_path)
    r(f'\n✅ Modelo guardado: {model_path}')

    # Guardar metadatos
    metadata = {
        'modelo': 'Random Forest Bienestar',
        'fecha_entrenamiento': datetime.now().isoformat(),
        'dataset': 'dataset_bienestar.csv',
        'registros_entrenamiento': len(X_train),
        'registros_prueba': len(X_test),
        'features': feature_cols,
        'target': target_col,
        'clases': list(le.classes_),
        'distribucion_train': {str(le.classes_[i]): int(sum(y_train == i)) for i in range(len(le.classes_))},
        'distribucion_test': {str(le.classes_[i]): int(sum(y_test == i)) for i in range(len(le.classes_))},
        'metricas': {
            'accuracy': float(accuracy),
        },
        'top_features': [{'feature': f, 'importance': float(i)} for f, i in
                         sorted(zip(feature_cols, model.feature_importances_),
                                key=lambda x: x[1], reverse=True)[:10]],
        'hiperparametros': {k: str(v) for k, v in model.get_params().items()}
    }
    meta_path = os.path.join(MODELS_DIR, 'bienestar_riesgo_metadata.json')
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, default=str)
    r(f'✅ Metadata guardada: {meta_path}')

    return model, scaler, le


def main():
    r('╔══════════════════════════════════════════════════════════════╗')
    r('║  SIVACAD-ISC — ENTRENAMIENTO DE MODELOS ML                 ║')
    r(f'║  {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}                              ║')
    r('╚══════════════════════════════════════════════════════════════╝')
    r('')
    r('FASE 3: ENTRENAMIENTO DE MACHINE LEARNING')
    r('')
    r('¿QUÉ VAMOS A HACER?')
    r('  Entrenar 3 modelos de Machine Learning para predecir:')
    r('    1. Deserción académica (binario: deserta/no deserta)')
    r('    2. Deserción académica (multiclase: Bajo/Medio/Alto/Crítico)')
    r('    3. Riesgo de bienestar (Bajo/Medio/Alto/Crítico)')
    r('')
    r('¿CÓMO FUNCIONA EL ENTRENAMIENTO?')
    r('  Los modelos "aprenden" patrones a partir de datos históricos')
    r('  (500 alumnos sintéticos + datos reales) usando algoritmos')
    r('  como XGBoost y Random Forest. No se programan reglas if-else:')
    r('  el algoritmo descubre automáticamente las relaciones entre')
    r('  variables (promedio, materias reprobadas, tendencia, etc.)')
    r('  y el resultado (deserción o nivel de riesgo).')

    # Cargar datasets
    desercion_df = load_dataset(
        os.path.join(OUTPUT_DIR, 'dataset_desercion.csv'),
        'DESERCIÓN ACADÉMICA (500 alumnos)'
    )
    bienestar_df = load_dataset(
        os.path.join(OUTPUT_DIR, 'dataset_bienestar.csv'),
        'BIENESTAR ESTUDIANTIL (300 check-ins)'
    )

    # Entrenar modelos
    r('\n' + '=' * 60)
    r('INICIANDO ENTRENAMIENTO...')
    r('=' * 60)

    try:
        m1, s1, meta1 = entrenar_desercion_binario(desercion_df)
    except Exception as e:
        r(f'\n❌ Error en Deserción Binaria: {e}')

    try:
        m2, s2, le2 = entrenar_desercion_multiclase(desercion_df)
    except Exception as e:
        r(f'\n❌ Error en Deserción Multiclase: {e}')

    try:
        m3, s3, le3 = entrenar_bienestar(bienestar_df)
    except Exception as e:
        r(f'\n❌ Error en Bienestar: {e}')

    # Resumen final
    r('\n' + '=' * 60)
    r('RESUMEN FINAL')
    r('=' * 60)
    r('')
    r('Modelos entrenados y guardados en backend/ml/models/:')
    r('  📦 desercion_binario.pkl        → XGBoost (Deserta/No Deserta)')
    r('  📦 desercion_multiclase.pkl     → XGBoost (Bajo/Medio/Alto/Crítico)')
    r('  📦 bienestar_riesgo.pkl         → Random Forest (Riesgo Bienestar)')
    r('')
    r('Archivos auxiliares:')
    r('  📎 scaler_desercion_binario.pkl → Normalización Z-score')
    r('  📎 scaler_desercion_multiclase.pkl')
    r('  📎 scaler_bienestar.pkl')
    r('  📎 label_encoder_desercion.pkl  → Codificador de etiquetas')
    r('  📎 label_encoder_bienestar.pkl')
    r('  📎 desercion_binario_metadata.json → Métricas y parámetros')
    r('')
    r('¿CÓMO USAR LOS MODELOS EN PRODUCCIÓN?')
    r('  1. Iniciar API: python predict_api.py')
    r('  2. Enviar POST a http://localhost:5001/predict')
    r('  3. Recibir predicción en JSON')
    r('')
    r('El puente Node.js (mlBridge.js) conecta el backend Express')
    r('con la API de Python automáticamente.')

    # Guardar reporte
    report_path = os.path.join(OUTPUT_DIR, 'train_report.txt')
    final_report = '\n'.join(REPORT)
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(final_report)
    print(f'\n[k] Reporte guardado: {report_path}')
    print(f'[k] Modelos en: {MODELS_DIR}/')


if __name__ == '__main__':
    main()
