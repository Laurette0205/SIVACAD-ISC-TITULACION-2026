"""
Feature Engineering - SIVACAD-ISC
Transforma los datos sintéticos en datasets listos para ML.
Exporta CSVs con features + targets para ambos módulos.
"""

import os
import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'output')
os.makedirs(OUTPUT_DIR, exist_ok=True)


def build_desercion_dataset(features_df, alumnos_df):
    df = features_df.copy()

    alu = alumnos_df[['id_alumno', 'semestre_actual', 'genero']].copy()
    alu.columns = ['id_alumno', 'semestre', 'genero']
    df = df.merge(alu, on='id_alumno', how='left')

    df['genero_M'] = (df['genero'] == 'M').astype(int)
    df['genero_F'] = (df['genero'] == 'F').astype(int)
    df.drop(columns=['genero'], inplace=True)

    df['promedio_x_credito'] = df['promedio_general'] / (df['creditos_cursados'] + 1)
    df['tasa_reprobacion'] = df['materias_reprobadas_total'] / (df['materias_cursadas_total'] + 1)
    df['indice_rendimiento'] = df['promedio_general'] * df['tasa_aprobacion']
    df['alerta_roja'] = (df['materias_reprobadas_total'] >= 3).astype(int)

    tend_dummies = pd.get_dummies(df['tendencia_label'], prefix='tend')
    df = pd.concat([df, tend_dummies], axis=1)
    df.drop(columns=['tendencia_label'], inplace=True)

    # Features finales
    feature_cols = [
        'id_alumno', 'semestre',
        'promedio_general', 'creditos_cursados', 'materias_reprobadas_total',
        'tasa_aprobacion', 'promedio_parcial_1', 'promedio_parcial_2',
        'promedio_parcial_3', 'pendiente_calificacion', 'riesgos_acumulados',
        'materias_cursadas_total', 'alumnos_activos_promedio',
        'alumnos_desertores_total', 'variabilidad_calificacion',
        'estatus_irregular', 'probabilidad_desercion',
        'promedio_x_credito', 'tasa_reprobacion', 'indice_rendimiento',
        'alerta_roja', 'genero_M', 'genero_F',
        'tend_Declive', 'tend_Estable', 'tend_Mejora',
        'target_binario', 'target_multiclase'
    ]

    available = [c for c in feature_cols if c in df.columns]
    df = df[available]

    return df


def build_bienestar_dataset(features_df):
    df = features_df.copy()

    dimensiones = ['animo', 'energia', 'sueno', 'estres', 'apoyo', 'ambiente',
                   'carga_academica', 'carga_laboral', 'enfoque']

    df['dimensiones_promedio'] = df[dimensiones].mean(axis=1)
    df['dimensiones_min'] = df[dimensiones].min(axis=1)
    df['dimensiones_std'] = df[dimensiones].std(axis=1)
    df['dimensiones_riesgo_count'] = (df[dimensiones] <= 4).sum(axis=1)
    df['estres_sqrt'] = np.sqrt(df['estres'])

    plant_dummies = pd.get_dummies(df['codigo_plantilla'], prefix='plant')
    df = pd.concat([df, plant_dummies], axis=1)
    df.drop(columns=['codigo_plantilla'], inplace=True)

    le = LabelEncoder()
    df['nivel_riesgo_encoded'] = le.fit_transform(df['nivel_riesgo'])
    nivel_map = dict(zip(le.classes_, le.transform(le.classes_)))

    feature_cols = dimensiones + [
        'bienestar_score', 'indice_riesgo',
        'dimensiones_promedio', 'dimensiones_min', 'dimensiones_std',
        'dimensiones_riesgo_count', 'estres_sqrt',
        'nivel_riesgo', 'nivel_riesgo_encoded',
        'requiere_derivacion', 'crisis_911',
    ]
    for c in plant_dummies.columns:
        feature_cols.append(c)

    available = [c for c in feature_cols if c in df.columns]
    df = df[available]

    return df, nivel_map


def export_datasets(desercion_df, bienestar_df, bienestar_nivel_map):
    desercion_path = os.path.join(OUTPUT_DIR, 'dataset_desercion.csv')
    desercion_df.to_csv(desercion_path, index=False, encoding='utf-8')
    print(f'✅ Dataset deserción: {desercion_path} ({len(desercion_df)} registros, '
          f'{len(desercion_df.columns)} columnas)')

    bienestar_path = os.path.join(OUTPUT_DIR, 'dataset_bienestar.csv')
    bienestar_df.to_csv(bienestar_path, index=False, encoding='utf-8')
    print(f'✅ Dataset bienestar: {bienestar_path} ({len(bienestar_df)} registros, '
          f'{len(bienestar_df.columns)} columnas)')

    report_path = os.path.join(OUTPUT_DIR, 'features_report.txt')
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write('SIVACAD-ISC — REPORTE DE FEATURES ENGINEERING\n')
        f.write(f'Generado: {pd.Timestamp.now()}\n')
        f.write('=' * 60 + '\n\n')

        f.write(f'MÓDULO: IA DE DESERCIÓN\n')
        f.write(f'Registros: {len(desercion_df)}\n')
        f.write(f'Features ({len(desercion_df.columns)}):\n')
        for c in desercion_df.columns:
            dtype = desercion_df[c].dtype
            nulls = desercion_df[c].isnull().sum()
            f.write(f'  • {c:35s} {str(dtype):10s} nulos={nulls}\n')

        f.write(f'\nDistribución target binario:\n')
        bins = desercion_df['target_binario'].value_counts()
        f.write(f'  0 (No deserción): {bins.get(0, 0)}\n')
        f.write(f'  1 (Deserción):    {bins.get(1, 0)}\n')

        f.write(f'\nDistribución target multiclase:\n')
        multiclase = desercion_df['target_multiclase'].value_counts()
        for nivel in ['Bajo', 'Medio', 'Alto', 'Critico']:
            f.write(f'  {nivel}: {multiclase.get(nivel, 0)}\n')

        f.write(f'\n' + '=' * 60 + '\n\n')
        f.write(f'MÓDULO: IA DE BIENESTAR\n')
        f.write(f'Registros: {len(bienestar_df)}\n')
        f.write(f'Features ({len(bienestar_df.columns)}):\n')
        for c in bienestar_df.columns:
            dtype = bienestar_df[c].dtype
            nulls = bienestar_df[c].isnull().sum()
            f.write(f'  • {c:35s} {str(dtype):10s} nulos={nulls}\n')

        f.write(f'\nNivel de riesgo (encoded): {bienestar_nivel_map}\n')
        f.write(f'\nDistribución nivel_riesgo:\n')
        nr = bienestar_df['nivel_riesgo'].value_counts()
        for nivel in ['Bajo', 'Medio', 'Alto', 'Critico']:
            f.write(f'  {nivel}: {nr.get(nivel, 0)}\n')

        f.write(f'\nDistribución requiere_derivacion:\n')
        f.write(f'{bienestar_df["requiere_derivacion"].value_counts().to_string()}\n')

        f.write(f'\nDistribución crisis_911:\n')
        f.write(f'{bienestar_df["crisis_911"].value_counts().to_string()}\n')

    print(f'✅ Features report: {report_path}')
