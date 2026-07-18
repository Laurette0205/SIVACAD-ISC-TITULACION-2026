"""
Pobla las tablas MySQL con datos sintéticos y exporta CSVs.
Preserva los registros reales (alumnos 1,2,3) e inserta datos a partir del ID 4.
"""

import sys
import os
import json
import pandas as pd
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import get_connection
from synthetic_data import generar_todo
from features import build_desercion_dataset, build_bienestar_dataset, export_datasets

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'output')
os.makedirs(OUTPUT_DIR, exist_ok=True)


def export_csvs(data):
    path = os.path.join(OUTPUT_DIR, 'alumnos_sinteticos.csv')
    data['alumnos'].to_csv(path, index=False, encoding='utf-8')
    print(f'✅ {path}')

    path = os.path.join(OUTPUT_DIR, 'parciales_sinteticos.csv')
    data['parciales'].to_csv(path, index=False, encoding='utf-8')
    print(f'✅ {path}')

    path = os.path.join(OUTPUT_DIR, 'alertas_desercion_sinteticas.csv')
    data['alertas'].to_csv(path, index=False, encoding='utf-8')
    print(f'✅ {path}')

    path = os.path.join(OUTPUT_DIR, 'kardex_sintetico.csv')
    data['kardex'].to_csv(path, index=False, encoding='utf-8')
    print(f'✅ {path}')

    path = os.path.join(OUTPUT_DIR, 'checkins_bienestar_sinteticos.csv')
    data['checkins'].to_csv(path, index=False, encoding='utf-8')
    print(f'✅ {path}')

    path = os.path.join(OUTPUT_DIR, 'alertas_bienestar_sinteticas.csv')
    data['alertas_bienestar'].to_csv(path, index=False, encoding='utf-8')
    print(f'✅ {path}')

    path = os.path.join(OUTPUT_DIR, 'mensajes_bienestar_sinteticos.csv')
    data['mensajes'].to_csv(path, index=False, encoding='utf-8')
    print(f'✅ {path}')


def insert_alumnos(conn, df):
    cursor = conn.cursor()
    usuarios_insertados = 0
    alumnos_insertados = 0
    id_rol_alumno = 4

    cursor.execute("SELECT MAX(id_usuario) FROM usuarios")
    max_id = cursor.fetchone()[0] or 29
    next_user_id = max_id + 1

    inserted_ids = []
    for _, row in df.iterrows():
        correo = f'{row["matricula"].lower()}@tesi.edu.mx'

        cursor.execute(
            "SELECT COUNT(*) FROM usuarios WHERE correo_institucional = %s",
            (correo,)
        )
        if cursor.fetchone()[0] > 0:
            continue

        cursor.execute(
            "INSERT INTO usuarios (nombres, apellido_paterno, apellido_materno, "
            "correo_institucional, contrasena_hash, estado, id_rol) "
            "VALUES (%s, %s, %s, %s, %s, 'Activo', %s)",
            (row['nombres'], row['apellido_paterno'], row['apellido_materno'],
             correo,
             '$2b$10$synthetic_hash_placeholder_12345678901234',
             id_rol_alumno)
        )
        user_id = cursor.lastrowid
        usuarios_insertados += 1

        cursor.execute(
            "INSERT INTO alumnos (id_usuario, apellido_paterno, apellido_materno, "
            "nombres, matricula, id_carrera, id_plan, semestre_actual, estatus_academico) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (user_id, row['apellido_paterno'], row['apellido_materno'],
             row['nombres'], row['matricula'],
             int(row['id_carrera']), int(row['id_plan']),
             int(row['semestre_actual']), 'Regular')
        )
        alumnos_insertados += 1
        inserted_ids.append(row['id_alumno'])

    conn.commit()
    print(f'  → {usuarios_insertados} usuarios insertados')
    print(f'  → {alumnos_insertados} alumnos insertados')

    alumno_to_user = {}
    synth_to_real_alumno = {}
    for _, srow in df.iterrows():
        cursor.execute("SELECT id_alumno, id_usuario FROM alumnos WHERE matricula = %s",
                       (str(srow['matricula']),))
        res = cursor.fetchone()
        if res:
            synth_to_real_alumno[int(srow['id_alumno'])] = int(res[0])
            alumno_to_user[int(srow['id_alumno'])] = int(res[1])

    return alumno_to_user, synth_to_real_alumno


def insert_kardex(conn, df, synth_to_real_alumno):
    cursor = conn.cursor()
    count = 0
    for _, row in df.iterrows():
        actual_id = synth_to_real_alumno.get(int(row['id_alumno']))
        if actual_id is None:
            continue
        cursor.execute("SELECT COUNT(*) FROM kardex_alumno WHERE id_alumno = %s", (actual_id,))
        if cursor.fetchone()[0] > 0:
            continue
        qr_token = f'synth-{actual_id}-{datetime.now().strftime("%Y%m%d%H%M%S")}'
        cursor.execute(
            "INSERT INTO kardex_alumno (id_alumno, numero_control, promedio_general, "
            "creditos_acumulados, estatus, qr_token) "
            "VALUES (%s, %s, %s, %s, %s, %s)",
            (actual_id, row['numero_control'],
             float(row['promedio_general']), int(row['creditos_acumulados']),
             row['estatus'], qr_token)
        )
        count += 1
    conn.commit()
    print(f'  → {count} kardex insertados')


def insert_parciales(conn, df, synth_to_real_alumno):
    cursor = conn.cursor()
    count = 0
    for _, row in df.iterrows():
        actual_id = synth_to_real_alumno.get(int(row['id_alumno']))
        if actual_id is None:
            continue
        cursor.execute("SELECT COUNT(*) FROM ia_desercion_parciales WHERE id_alumno = %s AND numero_parcial = %s",
                       (actual_id, row['numero_parcial']))
        if cursor.fetchone()[0] > 0:
            continue
        cursor.execute(
            "INSERT INTO ia_desercion_parciales (id_alumno, id_periodo, numero_parcial, "
            "calificacion_promedio, riesgos_detectados, materias_reprobadas, "
            "alumnos_activos, alumnos_desertores, tendencia) "
            "VALUES (%s, 1, %s, %s, %s, %s, %s, %s, %s)",
            (actual_id, int(row['numero_parcial']),
             float(row['calificacion_promedio']), int(row['riesgos_detectados']),
             int(row['materias_reprobadas']), int(row['alumnos_activos']),
             int(row['alumnos_desertores']), row['tendencia'])
        )
        count += 1
    conn.commit()
    print(f'  → {count} parciales insertados')


def insert_alertas_desercion(conn, df, synth_to_real_alumno):
    cursor = conn.cursor()
    count = 0
    for _, row in df.iterrows():
        actual_id = synth_to_real_alumno.get(int(row['id_alumno']))
        if actual_id is None:
            continue
        cursor.execute("SELECT COUNT(*) FROM ia_alertas_desercion WHERE id_alumno = %s AND id_periodo = 1",
                       (actual_id,))
        if cursor.fetchone()[0] > 0:
            continue
        cursor.execute(
            "INSERT INTO ia_alertas_desercion (id_alumno, id_periodo, nivel_riesgo, "
            "puntaje_riesgo, descripcion, recomendacion, atendida, modelo_version, "
            "factores_json, explicacion, estado_seguimiento) "
            "VALUES (%s, 1, %s, %s, %s, %s, 0, %s, %s, %s, 'Pendiente')",
            (actual_id, row['nivel_riesgo'], float(row['puntaje_riesgo']),
             row['descripcion'], row['recomendacion'],
             row['modelo_version'], row['factores_json'], row['explicacion'])
        )
        count += 1
    conn.commit()
    print(f'  → {count} alertas de deserción insertadas')


def insert_bienestar_sesiones_checkins(conn, checkins_df, alumnos_df, alumno_to_user):
    """Crea sesiones + check-ins en orden. Retorna mapa user->session_id."""
    cursor = conn.cursor()
    sesiones_map = {}
    checkins_count = 0
    sesiones_count = 0

    usuarios_unicos = checkins_df['id_usuario'].unique()
    for aid in usuarios_unicos:
        uid = alumno_to_user.get(int(aid))
        if uid is None:
            continue
        alu = alumnos_df[alumnos_df['id_alumno'] == int(aid)]
        if len(alu):
            nombre = f"{alu.iloc[0]['nombres']} {alu.iloc[0]['apellido_paterno']}"
        else:
            nombre = f'Alumno {uid}'

        user_checkins = checkins_df[checkins_df['id_usuario'] == int(aid)]
        nivel = user_checkins['nivel_riesgo'].mode().iloc[0] if len(user_checkins) else 'Bajo'

        cursor.execute(
            "INSERT INTO ia_bienestar_sesiones (id_usuario, perfil_usuario, titulo, "
            "objetivo, estado, nivel_riesgo_actual) "
            "VALUES (%s, 'alumno', %s, %s, 'ACTIVA', %s)",
            (uid, f'Sesión de {nombre}',
             f'Acompañamiento para {nombre}', nivel)
        )
        ses_id = cursor.lastrowid
        sesiones_map[uid] = ses_id
        sesiones_count += 1

    conn.commit()

    for _, row in checkins_df.iterrows():
        uid = alumno_to_user.get(int(row['id_usuario']))
        if uid is None:
            continue
        ses_id = sesiones_map.get(uid)
        if ses_id is None:
            continue
        cursor.execute(
            "INSERT INTO ia_bienestar_checkins (id_usuario, id_sesion, codigo_plantilla, "
            "bienestar_score, indice_riesgo, nivel_riesgo, "
            "animo, energia, sueno, estres, apoyo, ambiente, "
            "carga_academica, carga_laboral, enfoque, creado_en) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (uid, ses_id, row['codigo_plantilla'],
             float(row['bienestar_score']), float(row['indice_riesgo']),
             row['nivel_riesgo'],
             int(row.get('animo', 5)), int(row.get('energia', 5)),
             int(row.get('sueno', 5)), int(row.get('estres', 5)),
             int(row.get('apoyo', 5)), int(row.get('ambiente', 5)),
             int(row.get('carga_academica', 5)), int(row.get('carga_laboral', 5)),
             int(row.get('enfoque', 5)),
             str(row.get('creado_en', datetime.now())))
        )
        checkins_count += 1
    conn.commit()

    print(f'  → {sesiones_count} sesiones de bienestar creadas')
    print(f'  → {checkins_count} check-ins de bienestar insertados')
    return sesiones_map, alumno_to_user


def insert_alertas_bienestar(conn, df, sesiones_map, alumno_to_user):
    cursor = conn.cursor()
    count = 0
    for _, row in df.iterrows():
        uid = alumno_to_user.get(int(row['id_usuario']))
        if uid is None:
            continue
        ses_id = sesiones_map.get(uid)
        if ses_id is None:
            continue
        cursor.execute("SELECT COUNT(*) FROM ia_bienestar_alertas WHERE id_usuario = %s AND tipo_alerta = %s",
                       (uid, row['tipo_alerta']))
        if cursor.fetchone()[0] > 0:
            continue

        cursor.execute(
            "INSERT INTO ia_bienestar_alertas (id_usuario, id_sesion, codigo_plantilla, tipo_alerta, "
            "nivel_riesgo, descripcion, accion_sugerida, requiere_derivacion, "
            "estado, metadata_json, creado_en) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (uid, ses_id, row['codigo_plantilla'], row['tipo_alerta'],
             row['nivel_riesgo'], row['descripcion'], row['accion_sugerida'],
             int(row['requiere_derivacion']), row['estado'],
             row['metadata_json'], str(row.get('creado_en', datetime.now())))
        )
        count += 1
    conn.commit()
    print(f'  → {count} alertas de bienestar insertadas')


def insert_mensajes(conn, df, sesiones_map, alumno_to_user):
    cursor = conn.cursor()
    count = 0
    for _, row in df.iterrows():
        uid = alumno_to_user.get(int(row['id_usuario']))
        if uid is None:
            continue
        ses_id = sesiones_map.get(uid)
        if ses_id is None:
            continue
        cursor.execute(
            "INSERT INTO ia_bienestar_mensajes (id_sesion, id_usuario, rol_mensaje, "
            "mensaje, nivel_riesgo, creado_en) "
            "VALUES (%s, %s, %s, %s, %s, %s)",
            (ses_id, uid, row['rol_mensaje'],
             row['mensaje'], row['nivel_riesgo'],
             str(row.get('creado_en', datetime.now())))
        )
        count += 1
    conn.commit()
    print(f'  → {count} mensajes de bienestar insertados')


def main():
    print('╔══════════════════════════════════════════════════════════════╗')
    print('║  SIVACAD-ISC — GENERACIÓN DE DATOS SINTÉTICOS              ║')
    print('║  Fase 2: Feature Engineering + Población BD + CSV           ║')
    print(f'║  {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}                               ║')
    print('╚══════════════════════════════════════════════════════════════╝')

    # ─── 1. Generar datos sintéticos ───
    print('\n[1/6] Generando datos sintéticos...')
    data = generar_todo()
    print('✅ Datos sintéticos generados')

    # ─── 2. Feature Engineering ───
    print('\n[2/6] Aplicando feature engineering...')
    desercion_df = build_desercion_dataset(data['features'], data['alumnos'])
    bienestar_df, nivel_map = build_bienestar_dataset(data['features_bienestar'])
    print(f'✅ Features deserción: {len(desercion_df)} registros x {len(desercion_df.columns)} cols')
    print(f'✅ Features bienestar: {len(bienestar_df)} registros x {len(bienestar_df.columns)} cols')

    # ─── 3. Exportar CSVs ───
    print('\n[3/6] Exportando datasets a CSV...')
    export_csvs(data)
    export_datasets(desercion_df, bienestar_df, nivel_map)
    print('✅ CSVs exportados')

    # ─── 4. Insertar en MySQL ───
    print('\n[4/6] Insertando datos en MySQL...')
    conn = get_connection()
    cursor = conn.cursor()

    print('\n  --- Alumnos ---')
    alumno_to_user, synth_to_real_alumno = insert_alumnos(conn, data['alumnos'])

    print('\n  --- Kardex ---')
    insert_kardex(conn, data['kardex'], synth_to_real_alumno)

    print('\n  --- Parciales ---')
    insert_parciales(conn, data['parciales'], synth_to_real_alumno)

    print('\n  --- Alertas de Deserción ---')
    insert_alertas_desercion(conn, data['alertas'], synth_to_real_alumno)

    print('\n  --- Sesiones + Check-ins de Bienestar ---')
    sesiones_map, alumno_to_user = insert_bienestar_sesiones_checkins(
        conn, data['checkins'], data['alumnos'], alumno_to_user
    )

    print('\n  --- Alertas de Bienestar ---')
    insert_alertas_bienestar(conn, data['alertas_bienestar'], sesiones_map, alumno_to_user)

    print('\n  --- Mensajes de Bienestar ---')
    insert_mensajes(conn, data['mensajes'], sesiones_map, alumno_to_user)

    conn.close()
    print('\n✅ Inserción en MySQL completada')

    # ─── 5. Verificación ───
    print('\n[5/6] Verificando datos insertados...')
    conn = get_connection()
    cursor = conn.cursor()
    checks = [
        ('alumnos', 'SELECT COUNT(*) FROM alumnos'),
        ('kardex_alumno', 'SELECT COUNT(*) FROM kardex_alumno'),
        ('ia_desercion_parciales', 'SELECT COUNT(*) FROM ia_desercion_parciales'),
        ('ia_alertas_desercion', 'SELECT COUNT(*) FROM ia_alertas_desercion'),
        ('ia_bienestar_checkins', 'SELECT COUNT(*) FROM ia_bienestar_checkins'),
        ('ia_bienestar_alertas', 'SELECT COUNT(*) FROM ia_bienestar_alertas'),
        ('ia_bienestar_sesiones', 'SELECT COUNT(*) FROM ia_bienestar_sesiones'),
        ('ia_bienestar_mensajes', 'SELECT COUNT(*) FROM ia_bienestar_mensajes'),
    ]
    for name, query in checks:
        cursor.execute(query)
        count = cursor.fetchone()[0]
        print(f'  {name:35s}: {count} registros')
    conn.close()

    # ─── 6. Validación ───
    print('\n[6/6] Reporte de validación...')
    val_path = os.path.join(OUTPUT_DIR, 'validacion_calidad.txt')
    with open(val_path, 'r', encoding='utf-8') as f:
        print(f.read())

    print('\n' + '=' * 60)
    print('✅ FASE 2 COMPLETA')
    print(f'   Revisa archivos en: {OUTPUT_DIR}/')
    print('=' * 60)


if __name__ == '__main__':
    main()
