"""
evaluate_model.py — Evaluacion grafica de modelos ML
Genera: matriz de confusion, curva ROC, feature importance, reporte
"""

import os
import sys
import pandas as pd
import numpy as np
import json
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import (confusion_matrix, roc_curve, auc,
                             classification_report)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import joblib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from utils import setup_plot_style

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'output')
MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')
os.makedirs(OUTPUT_DIR, exist_ok=True)

setup_plot_style()


def _p(s):
    try:
        print(s)
    except UnicodeEncodeError:
        cleaned = s
        for k, v in {'📊':'[G]','✅':'[OK]','❌':'[!!]','⚠️':'[!]','★':'*','•':'*','→':'->','╔':'','╗':'','║':'','╚':'','╝':'','═':'-','├':'|','┤':'|','─':'-','│':'|','┌':'+','┐':'+','└':'+','┘':'+','á':'a','é':'e','í':'i','ó':'o','ú':'u','ñ':'n','ü':'u'}.items():
            cleaned = cleaned.replace(k, v)
        try:
            print(cleaned)
        except UnicodeEncodeError:
            print(cleaned.encode('ascii', 'replace').decode())


def evaluar_binario():
    _p('\n[G] Evaluando modelo: Desercion Binaria...')

    df = pd.read_csv(os.path.join(OUTPUT_DIR, 'dataset_desercion.csv'))

    id_cols = ['id_alumno']
    target_col = 'target_binario'
    feature_cols = [c for c in df.columns if c not in id_cols + [target_col, 'target_multiclase']]

    X = df[feature_cols].copy()
    y = df[target_col]
    for c in X.select_dtypes(include=['bool']).columns:
        X[c] = X[c].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = joblib.load(os.path.join(MODELS_DIR, 'desercion_binario.pkl'))
    scaler = joblib.load(os.path.join(MODELS_DIR, 'scaler_desercion_binario.pkl'))

    X_test_scaled = scaler.transform(X_test)
    y_pred = model.predict(X_test_scaled)
    y_proba = model.predict_proba(X_test_scaled)[:, 1]

    # 1. Matriz de confusion
    cm = confusion_matrix(y_test, y_pred)
    fig1, ax1 = plt.subplots(figsize=(6, 5))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                xticklabels=['No Deserta', 'Deserta'],
                yticklabels=['No Deserta', 'Deserta'],
                ax=ax1, cbar=False)
    ax1.set_xlabel('Prediccion')
    ax1.set_ylabel('Real')
    ax1.set_title('Matriz de Confusion - Desercion Binaria')
    plt.tight_layout()
    fig1.savefig(os.path.join(OUTPUT_DIR, 'confusion_matrix.png'), dpi=150, bbox_inches='tight')
    _p('  [OK] confusion_matrix.png')

    # 2. Curva ROC
    fpr, tpr, _ = roc_curve(y_test, y_proba)
    roc_auc = auc(fpr, tpr)

    fig2, ax2 = plt.subplots(figsize=(7, 6))
    ax2.plot(fpr, tpr, color='#2196F3', lw=2, label=f'XGBoost (AUC = {roc_auc:.3f})')
    ax2.plot([0, 1], [0, 1], color='gray', linestyle='--', label='Aleatorio (AUC = 0.5)')
    ax2.fill_between(fpr, tpr, alpha=0.15, color='#2196F3')
    ax2.set_xlim([0.0, 1.0])
    ax2.set_ylim([0.0, 1.05])
    ax2.set_xlabel('Tasa de Falsos Positivos (1 - Especificidad)')
    ax2.set_ylabel('Tasa de Verdaderos Positivos (Sensibilidad)')
    ax2.set_title('Curva ROC - Desercion Binaria')
    ax2.legend(loc='lower right')
    ax2.grid(True, alpha=0.3)
    plt.tight_layout()
    fig2.savefig(os.path.join(OUTPUT_DIR, 'roc_curve.png'), dpi=150, bbox_inches='tight')
    _p('  [OK] roc_curve.png')

    # 3. Feature Importance
    importance = pd.DataFrame({
        'feature': feature_cols,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=True).tail(15)

    fig3, ax3 = plt.subplots(figsize=(8, 6))
    colors = plt.cm.Blues(np.linspace(0.4, 1, len(importance)))
    ax3.barh(range(len(importance)), importance['importance'].values, color=colors)
    ax3.set_yticks(range(len(importance)))
    ax3.set_yticklabels(importance['feature'].values)
    ax3.set_xlabel('Importancia (ganancia de informacion)')
    ax3.set_title('Top 15 Variables Mas Importantes - XGBoost')
    plt.tight_layout()
    fig3.savefig(os.path.join(OUTPUT_DIR, 'feature_importance.png'), dpi=150, bbox_inches='tight')
    _p('  [OK] feature_importance.png')

    # 4. Reporte de clasificacion
    report = classification_report(y_test, y_pred,
                                   target_names=['No Deserta', 'Deserta'],
                                   output_dict=True)
    report_path = os.path.join(OUTPUT_DIR, 'classification_report.txt')
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write('REPORTE DE CLASIFICACION - DESERCION BINARIA\n')
        f.write('=' * 50 + '\n')
        f.write(classification_report(y_test, y_pred, target_names=['No Deserta', 'Deserta']))
        f.write(f'\nAUC-ROC: {roc_auc:.4f}\n')
    _p('  [OK] classification_report.txt')

    plt.close('all')
    return {
        'auc_roc': roc_auc,
        'confusion_matrix': cm.tolist(),
        'report': report
    }


def evaluar_multiclase():
    _p('\n[G] Evaluando modelo: Desercion Multiclase...')

    df = pd.read_csv(os.path.join(OUTPUT_DIR, 'dataset_desercion.csv'))

    id_cols = ['id_alumno', 'target_binario']
    target_col = 'target_multiclase'
    feature_cols = [c for c in df.columns if c not in id_cols + [target_col]]

    X = df[feature_cols].copy()
    y = df[target_col]
    for c in X.select_dtypes(include=['bool']).columns:
        X[c] = X[c].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = joblib.load(os.path.join(MODELS_DIR, 'desercion_multiclase.pkl'))
    scaler = joblib.load(os.path.join(MODELS_DIR, 'scaler_desercion_multiclase.pkl'))
    le = joblib.load(os.path.join(MODELS_DIR, 'label_encoder_desercion.pkl'))

    X_test_scaled = scaler.transform(X_test)
    y_pred = model.predict(X_test_scaled)
    y_pred_labels = le.inverse_transform(y_pred)

    cm = confusion_matrix(y_test, y_pred_labels, labels=le.classes_)
    fig, ax = plt.subplots(figsize=(8, 6))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                xticklabels=le.classes_,
                yticklabels=le.classes_,
                ax=ax, cbar=False)
    ax.set_xlabel('Prediccion')
    ax.set_ylabel('Real')
    ax.set_title('Matriz de Confusion - Desercion Multiclase')
    plt.tight_layout()
    fig.savefig(os.path.join(OUTPUT_DIR, 'confusion_matrix_multiclase.png'), dpi=150, bbox_inches='tight')
    _p('  [OK] confusion_matrix_multiclase.png')
    plt.close('all')


def evaluar_bienestar():
    _p('\n[G] Evaluando modelo: Bienestar...')

    df = pd.read_csv(os.path.join(OUTPUT_DIR, 'dataset_bienestar.csv'))

    target_col = 'nivel_riesgo'
    drop_cols = ['nivel_riesgo_encoded', 'crisis_911', 'requiere_derivacion']
    feature_cols = [c for c in df.columns if c not in drop_cols + [target_col]]

    X = df[feature_cols].copy()
    y = df[target_col]
    for c in X.select_dtypes(include=['bool']).columns:
        X[c] = X[c].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    model = joblib.load(os.path.join(MODELS_DIR, 'bienestar_riesgo.pkl'))
    scaler = joblib.load(os.path.join(MODELS_DIR, 'scaler_bienestar.pkl'))
    le = joblib.load(os.path.join(MODELS_DIR, 'label_encoder_bienestar.pkl'))

    X_test_scaled = scaler.transform(X_test)
    y_pred = model.predict(X_test_scaled)
    y_pred_labels = le.inverse_transform(y_pred)

    cm = confusion_matrix(y_test, y_pred_labels, labels=le.classes_)
    fig, ax = plt.subplots(figsize=(8, 6))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Oranges',
                xticklabels=le.classes_,
                yticklabels=le.classes_,
                ax=ax, cbar=False)
    ax.set_xlabel('Prediccion')
    ax.set_ylabel('Real')
    ax.set_title('Matriz de Confusion - Riesgo de Bienestar')
    plt.tight_layout()
    fig.savefig(os.path.join(OUTPUT_DIR, 'confusion_matrix_bienestar.png'), dpi=150, bbox_inches='tight')
    _p('  [OK] confusion_matrix_bienestar.png')
    plt.close('all')


def main():
    _p('================================================')
    _p('  SIVACAD-ISC - EVALUACION DE MODELOS ML')
    _p('================================================')

    resultados = {}

    try:
        resultados['binario'] = evaluar_binario()
    except Exception as e:
        _p(f'[!!] Error evaluando binario: {e}')

    try:
        evaluar_multiclase()
    except Exception as e:
        _p(f'[!!] Error evaluando multiclase: {e}')

    try:
        evaluar_bienestar()
    except Exception as e:
        _p(f'[!!] Error evaluando bienestar: {e}')

    _p('\n[OK] Evaluacion completa. Graficos en output/')


if __name__ == '__main__':
    main()
