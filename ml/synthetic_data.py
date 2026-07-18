import json
import os
import random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

CONFIG_PATH = os.path.join(os.path.dirname(__file__), 'seed_config.json')
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'output')
os.makedirs(OUTPUT_DIR, exist_ok=True)

with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
    CONFIG = json.load(f)

random.seed(42)
np.random.seed(42)


def sigmoid(x):
    return 1 / (1 + np.exp(-np.clip(x, -10, 10)))


# ──────────────────────────────────────────────
# GENERADOR DE ALUMNOS
# ──────────────────────────────────────────────
def generar_alumnos():
    cfg = CONFIG['desercion']
    total = cfg['total_alumnos']
    start_id = cfg['start_id']
    semestres = cfg['semestres']
    dist_sem = np.array(cfg['distribucion_semestre'])
    dist_sem = dist_sem / dist_sem.sum()

    nombres_m = cfg['nombres_masculinos']
    nombres_f = cfg['nombres_femeninos']
    apellidos = cfg['apellidos']

    rows = []
    asignados_sem = np.random.choice(semestres, size=total, p=dist_sem)

    for i in range(total):
        alumno_id = start_id + i
        sem = int(asignados_sem[i])
        genero = random.choice(['M', 'F'])
        nombre = random.choice(nombres_m if genero == 'M' else nombres_f)
        ap_p = random.choice(apellidos)
        ap_m = random.choice(apellidos)
        matricula = f'SINT-{2024 + (sem // 2):04d}{alumno_id:04d}'

        rows.append({
            'id_alumno': alumno_id,
            'nombres': nombre,
            'apellido_paterno': ap_p,
            'apellido_materno': ap_m,
            'matricula': matricula,
            'semestre_actual': sem,
            'estatus_academico': 'Regular',
            'id_carrera': 1,
            'id_plan': 1,
            'genero': genero,
            'id_usuario': None
        })

    return pd.DataFrame(rows)


# ──────────────────────────────────────────────
# GENERADOR DE PARCIALES + TARGET DESERCIÓN
# ──────────────────────────────────────────────
def generar_parciales_y_target(alumnos_df):
    cfg = CONFIG['desercion']
    pesos = cfg['pesos_desercion']
    thresholds = cfg['thresholds_riesgo']

    parciales_rows = []
    alertas_rows = []
    features_list = []

    for _, alumno in alumnos_df.iterrows():
        alumno_id = alumno['id_alumno']
        sem = alumno['semestre_actual']
        idx_sem = sem - 1

        calif_media = cfg['calif_media_por_semestre'][idx_sem]
        calif_std = cfg['calif_std_por_semestre'][idx_sem]
        materias_sem = cfg['materias_por_semestre'][idx_sem]

        califs = np.random.normal(calif_media, calif_std, 3)
        califs = np.clip(califs, 20, 100)
        califs = np.sort(califs)[::-1]
        ruido = np.random.normal(0, 3, 3)
        califs = califs + ruido
        califs = np.clip(califs, 20, 100)
        califs.sort()
        # Hacer que algunos alumnos mejoren y otros empeoren
        if random.random() < 0.4:
            pass  # ya está ordenado ascendente = mejora
        elif random.random() < 0.35:
            califs = califs[::-1]  # descendente = declive
        else:
            califs = califs + np.random.uniform(-3, 3, 3)  # estable
            califs = np.clip(califs, 20, 100)

        tendencias_posibles = ['Mejora', 'Estable', 'Declive']
        pendiente = np.polyfit([1, 2, 3], califs, 1)[0]
        if pendiente > 2:
            tendencia_label = 'Mejora'
        elif pendiente < -2:
            tendencia_label = 'Declive'
        else:
            tendencia_label = 'Estable'

        materias_reprobadas_list = []
        riesgos_list = []
        for c in califs:
            if c >= 85:
                mr = 0
            elif c >= 70:
                mr = 1 if random.random() < 0.15 else 0
            elif c >= 60:
                mr = random.randint(1, 2)
            else:
                mr = random.randint(2, min(4, materias_sem))
            materias_reprobadas_list.append(mr)
            riesgos_list.append(mr + random.randint(0, 2))

        promedio_general = np.mean(califs)
        materias_reprobadas_total = sum(materias_reprobadas_list)

        logit = (pesos['intercept']
                 + pesos['penalizacion_bajo_promedio'] * max(0, 60 - promedio_general)
                 + pesos['penalizacion_materias_reprobadas'] * materias_reprobadas_total
                 + (pesos['penalizacion_declive'] if tendencia_label == 'Declive' else 0)
                 + pesos['penalizacion_semestre_bajo'] * max(0, 4 - sem))
        prob_desercion = sigmoid(logit)

        # Target binario
        target_binario = 1 if random.random() < prob_desercion else 0

        # Target multiclase
        prob_norm = min(prob_desercion * 1.2, 0.99)
        if prob_norm < thresholds['Medio']:
            nivel_riesgo = 'Bajo'
        elif prob_norm < thresholds['Alto']:
            nivel_riesgo = 'Medio'
        elif prob_norm < thresholds['Critico']:
            nivel_riesgo = 'Alto'
        else:
            nivel_riesgo = 'Critico'

        if target_binario == 0:
            if nivel_riesgo == 'Critico':
                nivel_riesgo = 'Alto'
            elif nivel_riesgo == 'Alto':
                if random.random() < 0.5:
                    nivel_riesgo = 'Medio'

        for p in range(3):
            parciales_rows.append({
                'id_alumno': alumno_id,
                'id_periodo': 1,
                'numero_parcial': p + 1,
                'calificacion_promedio': round(califs[p], 2),
                'riesgos_detectados': riesgos_list[p],
                'materias_reprobadas': materias_reprobadas_list[p],
                'alumnos_activos': random.randint(25, 40),
                'alumnos_desertores': random.randint(0, 3),
                'tendencia': tendencia_label
            })

        if target_binario == 1 or random.random() < 0.15:
            alertas_rows.append({
                'id_alumno': alumno_id,
                'id_periodo': 1,
                'nivel_riesgo': nivel_riesgo,
                'puntaje_riesgo': round(prob_norm * 100, 2),
                'descripcion': f'Predicción sintética: riesgo {nivel_riesgo}',
                'recomendacion': _recomendacion_por_nivel(nivel_riesgo),
                'atendida': 0,
                'modelo_version': 'synthetic-v1',
                'factores_json': json.dumps([{
                    'factor': 'Generación sintética',
                    'peso': round(prob_norm * 100, 2),
                    'detalle': f'Promedio={promedio_general:.2f}, Reprobadas={materias_reprobadas_total}'
                }]),
                'explicacion': f'Promedio={promedio_general:.2f}, Reprobadas={materias_reprobadas_total}, Tendencia={tendencia_label}',
                'estado_seguimiento': 'Pendiente',
                'responsable_id': None,
                'revisado_en': None
            })

        features_list.append({
            'id_alumno': alumno_id,
            'semestre': sem,
            'promedio_general': round(promedio_general, 2),
            'creditos_cursados': materias_sem * 3,
            'materias_reprobadas_total': materias_reprobadas_total,
            'tasa_aprobacion': round(1 - (materias_reprobadas_total / (materias_sem * 3)), 4),
            'promedio_parcial_1': round(califs[0], 2),
            'promedio_parcial_2': round(califs[1], 2),
            'promedio_parcial_3': round(califs[2], 2),
            'pendiente_calificacion': round(pendiente, 4),
            'tendencia_label': tendencia_label,
            'riesgos_acumulados': sum(riesgos_list),
            'materias_cursadas_total': materias_sem * 3,
            'alumnos_activos_promedio': round(np.mean([random.randint(25, 40) for _ in range(3)]), 2),
            'alumnos_desertores_total': random.randint(0, 5),
            'variabilidad_calificacion': round(np.std(califs), 4),
            'estatus_irregular': 1 if materias_reprobadas_total > 2 else 0,
            'probabilidad_desercion': round(prob_desercion, 4),
            'target_binario': target_binario,
            'target_multiclase': nivel_riesgo
        })

    return pd.DataFrame(parciales_rows), pd.DataFrame(alertas_rows), pd.DataFrame(features_list)


def _recomendacion_por_nivel(nivel):
    recs = {
        'Bajo': 'Mantener seguimiento normal y reforzar hábitos de estudio.',
        'Medio': 'Monitorear el desempeño y reforzar acompañamiento académico preventivo.',
        'Alto': 'Programar seguimiento académico prioritario y contacto con el alumno dentro de 48 horas.',
        'Critico': 'Canalizar de inmediato a tutoría, coordinación y control escolar.'
    }
    return recs.get(nivel, recs['Bajo'])


# ──────────────────────────────────────────────
# GENERADOR DE KARDEX
# ──────────────────────────────────────────────
def generar_kardex(alumnos_df, features_df):
    rows = []
    for _, f in features_df.iterrows():
        alumno_id = f['id_alumno']
        alumno = alumnos_df[alumnos_df.id_alumno == alumno_id].iloc[0]
        rows.append({
            'id_alumno': alumno_id,
            'numero_control': alumno['matricula'],
            'promedio_general': f['promedio_general'],
            'creditos_acumulados': f['creditos_cursados'],
            'estatus': 'Vigente',
        })
    return pd.DataFrame(rows)


# ──────────────────────────────────────────────
# GENERADOR DE CHECK-INS DE BIENESTAR
# ──────────────────────────────────────────────
def generar_bienestar(alumnos_df):
    cfg = CONFIG['bienestar']
    total = cfg['total_checkins']
    dimensiones = cfg['dimensiones']
    medias = cfg['dimensiones_medias']
    std = cfg['dimensiones_std']
    invertidas = cfg['dimension_riesgo_invertida']
    pesos_score = cfg['pesos_bienestar_score']
    thresholds = cfg['thresholds_riesgo']
    plantillas = cfg['plantillas']
    pesos_plantilla = cfg['pesos_plantilla']

    alumno_ids = alumnos_df['id_alumno'].tolist()
    alumnos_map = alumnos_df.set_index('id_alumno').to_dict('index')

    checkin_rows = []
    alerta_rows = []
    mensaje_rows = []
    features_list = []

    base_time = datetime(2026, 1, 15, 8, 0, 0)

    for i in range(total):
        alumno_id = random.choice(alumno_ids)
        alumno = alumnos_map[alumno_id]
        plantilla = random.choices(plantillas, weights=pesos_plantilla, k=1)[0]
        ts = base_time + timedelta(days=random.randint(0, 180), hours=random.randint(8, 20))

        vals = {}
        for dim in dimensiones:
            media = medias.get(dim, 5)
            raw = np.random.normal(media, std)
            raw = np.clip(raw, 1, 10)
            vals[dim] = int(round(raw))

        score = 0
        indice_riesgo = 0
        peso_total = 0
        for dim in dimensiones:
            w = pesos_score.get(dim, 0.1)
            peso_total += w
            val = vals[dim]
            val_norm = val / 10.0
            score += val_norm * w * 100
            if dim in invertidas:
                indice_riesgo += (1 - val_norm) * w
            else:
                indice_riesgo += (0.2 + (1 - val_norm) * 0.8) * w

        score = round(score / peso_total, 2) if peso_total > 0 else 50
        indice_riesgo = round(indice_riesgo / peso_total, 4) if peso_total > 0 else 0.5

        if indice_riesgo < thresholds['Medio']:
            nivel = 'Bajo'
        elif indice_riesgo < thresholds['Alto']:
            nivel = 'Medio'
        elif indice_riesgo < thresholds['Critico']:
            nivel = 'Alto'
        else:
            nivel = 'Critico'

        requiere_der = 1 if nivel in ('Alto', 'Critico') else 0
        crisis_911 = 1 if (nivel == 'Critico' and indice_riesgo > 0.85 and random.random() < 0.3) else 0

        checkin_rows.append({
            'id_usuario': alumno_id,
            'codigo_plantilla': plantilla,
            'bienestar_score': score,
            'indice_riesgo': indice_riesgo,
            'nivel_riesgo': nivel,
            **{dim: vals[dim] for dim in dimensiones},
            'creado_en': ts,
        })

        if nivel in ('Alto', 'Critico') or random.random() < 0.1:
            accion = cfg['respuestas_ia'].get(nivel, cfg['respuestas_ia']['Medio'])[0]
            if crisis_911:
                accion = cfg['respuestas_crisis_911']
            alerta_rows.append({
                'id_usuario': alumno_id,
                'codigo_plantilla': plantilla,
                'tipo_alerta': 'CRISIS' if crisis_911 else 'RIESGO_BIENESTAR',
                'nivel_riesgo': nivel,
                'descripcion': f'Check-in nivel {nivel} en {plantilla}.',
                'accion_sugerida': accion,
                'requiere_derivacion': requiere_der,
                'estado': 'PENDIENTE',
                'metadata_json': json.dumps({
                    'crisis_911': bool(crisis_911),
                    'bienestar_score': score,
                    'indice_riesgo': indice_riesgo
                }),
                'creado_en': ts,
            })

        msgs = random.randint(2, 5)
        for m in range(msgs):
            rol = 'user' if m % 2 == 0 else 'assistant'
            if rol == 'assistant':
                texto = random.choice(cfg['respuestas_ia'].get(nivel, cfg['respuestas_ia']['Bajo']))
            else:
                textos_user = [
                    "Me siento estresado con la carga de trabajo.",
                    "No he dormido bien esta semana.",
                    "¿Puedes darme consejos para manejar el estrés?",
                    "Me siento bien hoy.",
                    "La carga académica es muy pesada.",
                    "Necesito ayuda para organizarme.",
                    "Estoy preocupado por mis calificaciones.",
                    "Me siento motivado pero cansado.",
                    "Tengo problemas para concentrarme.",
                    "¿Hay recursos de apoyo disponibles?"
                ]
                texto = random.choice(textos_user)
            mensaje_rows.append({
                'id_usuario': alumno_id,
                'rol_mensaje': rol,
                'mensaje': texto,
                'nivel_riesgo': nivel,
                'creado_en': ts + timedelta(minutes=m * random.randint(1, 8)),
            })

        features_list.append({
            'id_alumno': alumno_id,
            **{dim: vals[dim] for dim in dimensiones},
            'bienestar_score': score,
            'indice_riesgo': indice_riesgo,
            'nivel_riesgo': nivel,
            'requiere_derivacion': requiere_der,
            'crisis_911': crisis_911,
            'codigo_plantilla': plantilla,
        })

    return (pd.DataFrame(checkin_rows), pd.DataFrame(alerta_rows),
            pd.DataFrame(mensaje_rows), pd.DataFrame(features_list))


# ──────────────────────────────────────────────
# VALIDACIÓN DE CALIDAD
# ──────────────────────────────────────────────
def validar_calidad(parciales_df, features_df, bienestar_features):
    report = []
    r = lambda s: report.append(s)
    r('=' * 60)
    r('VALIDACIÓN DE CALIDAD - DATOS SINTÉTICOS')
    r('=' * 60)

    r(f'\n--- DESERCIÓN ---')
    r(f'Alumnos generados: {len(features_df)}')
    r(f'Parciales generados: {len(parciales_df)}')
    r(f'Target binario - Desa: {features_df.target_binario.sum()}, '
      f'No Desa: {(1 - features_df.target_binario).sum()}')
    r(f'Tasa deserción: {features_df.target_binario.mean() * 100:.1f}%')

    dist_multiclase = features_df.target_multiclase.value_counts()
    r(f'Distribución multiclase:')
    for nivel in ['Bajo', 'Medio', 'Alto', 'Critico']:
        cnt = dist_multiclase.get(nivel, 0)
        r(f'  {nivel}: {cnt} ({cnt / len(features_df) * 100:.1f}%)')

    if len(parciales_df):
        corr = parciales_df[['calificacion_promedio', 'materias_reprobadas']].corr().iloc[0, 1]
        r(f'Correlación calif vs materias_reprob: {corr:.4f} (esperado ≈ -0.87)')

    r(f'\n--- BIENESTAR ---')
    if len(bienestar_features):
        r(f'Check-ins generados: {len(bienestar_features)}')
        dist_nivel = bienestar_features.nivel_riesgo.value_counts()
        r(f'Distribución nivel_riesgo:')
        for nivel in ['Bajo', 'Medio', 'Alto', 'Critico']:
            cnt = dist_nivel.get(nivel, 0)
            r(f'  {nivel}: {cnt} ({cnt / len(bienestar_features) * 100:.1f}%)')
        r(f'Requieren derivación: {bienestar_features.requiere_derivacion.sum()} '
          f'({bienestar_features.requiere_derivacion.mean() * 100:.1f}%)')
        r(f'Crisis 911: {bienestar_features.crisis_911.sum()}')

    r('\n--- VALORES NULOS ---')
    nulls_des = features_df.isnull().sum().sum()
    nulls_bien = bienestar_features.isnull().sum().sum()
    r(f'Features deserción: {nulls_des} valores nulos')
    r(f'Features bienestar: {nulls_bien} valores nulos')

    report_path = os.path.join(OUTPUT_DIR, 'validacion_calidad.txt')
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(report))
    return '\n'.join(report)


# ──────────────────────────────────────────────
# ORQUESTADOR PRINCIPAL
# ──────────────────────────────────────────────
def generar_todo():
    print('Generando alumnos sintéticos...')
    alumnos_df = generar_alumnos()
    print(f'  → {len(alumnos_df)} alumnos generados')

    print('Generando parciales y targets de deserción...')
    parciales_df, alertas_df, features_df = generar_parciales_y_target(alumnos_df)
    print(f'  → {len(parciales_df)} parciales, {len(alertas_df)} alertas, {len(features_df)} registros de features')

    print('Generando kardex sintético...')
    kardex_df = generar_kardex(alumnos_df, features_df)
    print(f'  → {len(kardex_df)} registros de kardex')

    print('Generando datos de bienestar...')
    checkin_df, alertas_bien_df, mensajes_df, bienestar_features = generar_bienestar(alumnos_df)
    print(f'  → {len(checkin_df)} check-ins, {len(alertas_bien_df)} alertas, '
          f'{len(mensajes_df)} mensajes, {len(bienestar_features)} features')

    print('Ejecutando validación de calidad...')
    validacion = validar_calidad(parciales_df, features_df, bienestar_features)
    print(f'  → {validacion}')

    return {
        'alumnos': alumnos_df,
        'parciales': parciales_df,
        'alertas': alertas_df,
        'kardex': kardex_df,
        'features': features_df,
        'checkins': checkin_df,
        'alertas_bienestar': alertas_bien_df,
        'mensajes': mensajes_df,
        'features_bienestar': bienestar_features,
    }


if __name__ == '__main__':
    generar_todo()
