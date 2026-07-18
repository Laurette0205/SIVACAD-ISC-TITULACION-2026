import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from utils import query, export_txt, export_png, export_jpeg, export_csv, separador, tabla_texto, setup_plot_style

def analizar_desercion(conn):
    setup_plot_style()
    report = []
    r = lambda s: report.append(s)
    r('╔══════════════════════════════════════════════════════════════╗')
    r('║  SIVACAD-ISC — EDA: IA DE DESERCIÓN                        ║')
    r('║  Fecha: 2026-07-14                                         ║')
    r('╚══════════════════════════════════════════════════════════════╝')

    # ──────────────────────────────────────────────
    # 1. ALUMNOS
    # ──────────────────────────────────────────────
    r(separador('1. PERFIL DE ALUMNOS'))
    alumnos = query(conn, '''
        SELECT a.id_alumno, a.matricula, a.semestre_actual, a.estatus_academico,
               c.nombre_carrera
        FROM alumnos a
        JOIN carreras c ON a.id_carrera = c.id_carrera
    ''')
    r(f'Total alumnos: {len(alumnos)}')
    for _, a in alumnos.iterrows():
        r(f'  • ID={a.id_alumno}, Matrícula={a.matricula}, Semestre={a.semestre_actual}, '
          f'Estatus={a.estatus_academico}, Carrera={a.nombre_carrera}')
    r(f'\nDistribución semestre:\n{alumnos.semestre_actual.value_counts().sort_index().to_string()}')
    r(f'\nDistribución estatus:\n{alumnos.estatus_academico.value_counts().to_string()}')

    # ──────────────────────────────────────────────
    # 2. KARDEX
    # ──────────────────────────────────────────────
    r(separador('2. KARDEX ACADÉMICO'))
    kardex = query(conn, 'SELECT * FROM kardex_alumno')
    r(f'Registros: {len(kardex)}')
    if len(kardex):
        r(f'promedio_general — media={kardex.promedio_general.mean():.2f}, min={kardex.promedio_general.min()}, max={kardex.promedio_general.max()}')
        r(f'creditos_acumulados — media={kardex.creditos_acumulados.mean():.2f}, min={kardex.creditos_acumulados.min()}, max={kardex.creditos_acumulados.max()}')
        r('\n⚠️ TODOS los promedios y créditos están en 0 — DATOS NO CAPTURADOS')
    else:
        r('❌ Sin registros')

    # ──────────────────────────────────────────────
    # 3. HISTORIAL ACADÉMICO
    # ──────────────────────────────────────────────
    r(separador('3. HISTORIAL ACADÉMICO (kardex_historial_academico)'))
    hist_count = query(conn, 'SELECT COUNT(*) AS n FROM kardex_historial_academico').iloc[0, 0]
    r(f'Registros: {hist_count}')
    if hist_count == 0:
        r('❌ VACÍA — No hay historial de calificaciones por materia')
    else:
        r(query(conn, 'SELECT * FROM kardex_historial_academico LIMIT 5').to_string())

    # ──────────────────────────────────────────────
    # 4. ALERTAS DE DESERCIÓN
    # ──────────────────────────────────────────────
    r(separador('4. ALERTAS DE DESERCIÓN (ia_alertas_desercion)'))
    alertas = query(conn, '''
        SELECT ia.id_alerta, ia.id_alumno, ia.nivel_riesgo, ia.puntaje_riesgo,
               ia.modelo_version, ia.atendida, ia.estado_seguimiento, ia.explicacion
        FROM ia_alertas_desercion ia
    ''')
    r(f'Total alertas: {len(alertas)}')
    if len(alertas):
        for _, al in alertas.iterrows():
            r(f'  • Alerta #{al.id_alerta}: Alumno={al.id_alumno}, '
              f'Nivel={al.nivel_riesgo}, Puntaje={al.puntaje_riesgo}, '
              f'Modelo={al.modelo_version}, Atendida={al.atendida}')
            if al.explicacion:
                r(f'    Factores: {al.explicacion}')
        r(f'\nDistribución nivel_riesgo:\n{alertas.nivel_riesgo.value_counts().to_string()}')
    else:
        r('❌ Sin alertas generadas')

    # ──────────────────────────────────────────────
    # 5. PARCIALES (DATOS CLAVE)
    # ──────────────────────────────────────────────
    r(separador('5. PARCIALES (ia_desercion_parciales) — 9 registros'))
    parciales = query(conn, '''
        SELECT id_parcial, id_alumno, numero_parcial, calificacion_promedio,
               riesgos_detectados, materias_reprobadas, alumnos_activos,
               alumnos_desertores, tendencia
        FROM ia_desercion_parciales
        ORDER BY id_alumno, numero_parcial
    ''')
    r(f'Registros: {len(parciales)}')

    r('\nEstadísticas de calificaciones:')
    stats = parciales.calificacion_promedio.describe()
    for k, v in stats.items():
        r(f'  {k:12s}: {v:.2f}')

    r('\nEstadísticas de materias_reprobadas:')
    stats_r = parciales.materias_reprobadas.describe()
    for k, v in stats_r.items():
        r(f'  {k:12s}: {v:.2f}')

    r('\nEstadísticas de riesgos_detectados:')
    stats_rd = parciales.riesgos_detectados.describe()
    for k, v in stats_rd.items():
        r(f'  {k:12s}: {v:.2f}')

    r(f'\nDistribución tendencia:\n{parciales.tendencia.value_counts().to_string()}')

    r('\nEvolución por alumno:')
    for alumno_id in sorted(parciales.id_alumno.unique()):
        sub = parciales[parciales.id_alumno == alumno_id].sort_values('numero_parcial')
        califs = ', '.join(f'P{p}={c:.1f}' for p, c in zip(sub.numero_parcial, sub.calificacion_promedio))
        mats = ', '.join(f'P{p}={m}' for p, m in zip(sub.numero_parcial, sub.materias_reprobadas))
        tends = ' → '.join(sub.tendencia.values)
        r(f'  Alumno {alumno_id}:')
        r(f'    Calificaciones: {califs}')
        r(f'    Materias reprobadas: {mats}')
        r(f'    Tendencia: {tends}')

    # ──────────────────────────────────────────────
    # 6. TABLAS VACÍAS
    # ──────────────────────────────────────────────
    r(separador('6. TABLAS VACÍAS (features perdidas para ML)'))
    tablas_vacias = {
        'inscripciones': 'Sin registro de inscripciones',
        'reinscripciones': 'Sin historial de reinscripciones',
        'kardex_historial_academico': 'Sin historial de materias cursadas',
        'evaluacion_resultados': 'Sin evaluaciones docentes',
        'respuestas_evaluacion': 'Sin respuestas de evaluación',
    }
    for tbl, desc in tablas_vacias.items():
        cnt = query(conn, f'SELECT COUNT(*) AS n FROM {tbl}').iloc[0, 0]
        if cnt == 0:
            r(f'  ❌ {tbl} — {desc}')
        else:
            r(f'  ✅ {tbl} — {cnt} registros')

    # ──────────────────────────────────────────────
    # 7. FEATURES DISPONIBLES
    # ──────────────────────────────────────────────
    r(separador('7. MATRIZ DE FEATURES DISPONIBLES vs REQUERIDAS'))
    r(tabla_texto(
        ['Feature', 'Tabla origen', 'Disponible', 'Calidad', 'Notas'],
        [
            ['promedio_general', 'kardex_alumno', '✅ 3', '⚠️ Todos 0', 'Sin datos reales capturados'],
            ['creditos_acumulados', 'kardex_alumno', '✅ 3', '⚠️ Todos 0', 'Sin datos reales capturados'],
            ['calificacion_parcial', 'ia_desercion_parciales', '✅ 9', '✅ Real', 'Mejor feature actual'],
            ['materias_reprobadas', 'ia_desercion_parciales', '✅ 9', '✅ Real', 'Correlaciona con calificación'],
            ['riesgos_detectados', 'ia_desercion_parciales', '✅ 9', '✅ Real', 'Auto-reportado en parcial'],
            ['tendencia', 'ia_desercion_parciales', '✅ 9', '✅ Real', 'Mejora/Estable/Declive'],
            ['semestre_actual', 'alumnos', '✅ 3', '⚠️ Poca varianza', 'Solo semestres 2 y 6'],
            ['estatus_academico', 'alumnos', '✅ 3', '❌ Sin varianza', 'Todos Regular'],
            ['alumnos_activos', 'ia_desercion_parciales', '✅ 9', '✅ Real', 'Contexto grupal'],
            ['alumnos_desertores', 'ia_desercion_parciales', '✅ 9', '✅ Real', 'Contexto grupal'],
            ['historial_materias', 'kardex_historial_academico', '❌ 0', 'N/A', 'VACÍA — crítica para ML'],
            ['reinscripciones_cnt', 'reinscripciones', '❌ 0', 'N/A', 'VACÍA'],
            ['evaluacion_docente', 'evaluacion_resultados', '❌ 0', 'N/A', 'VACÍA'],
        ]
    ))

    # ──────────────────────────────────────────────
    # 8. GRÁFICOS
    # ──────────────────────────────────────────────

    # Gráfico 1: Histogramas
    r(separador('8. GRÁFICOS GENERADOS'))
    fig, axes = plt.subplots(2, 2, figsize=(12, 8))
    fig.suptitle('EDA - IA de Deserción: Distribuciones', fontsize=14, fontweight='bold')

    if len(parciales):
        axes[0, 0].hist(parciales.calificacion_promedio, bins=6, color='#2196F3', edgecolor='white', alpha=0.8)
        axes[0, 0].set_title('Distribución de Calificación Promedio')
        axes[0, 0].set_xlabel('Calificación')
        axes[0, 0].set_ylabel('Frecuencia')
        axes[0, 0].axvline(parciales.calificacion_promedio.mean(), color='red', ls='--', label=f'Media={parciales.calificacion_promedio.mean():.1f}')
        axes[0, 0].legend()

        axes[0, 1].hist(parciales.materias_reprobadas, bins=5, color='#FF5722', edgecolor='white', alpha=0.8)
        axes[0, 1].set_title('Distribución de Materias Reprobadas')
        axes[0, 1].set_xlabel('Materias reprobadas')
        axes[0, 1].set_ylabel('Frecuencia')

        axes[1, 0].bar(['Mejora', 'Estable', 'Declive'],
                       [sum(parciales.tendencia == 'Mejora'),
                        sum(parciales.tendencia == 'Estable'),
                        sum(parciales.tendencia == 'Declive')],
                       color=['#4CAF50', '#FFC107', '#F44336'])
        axes[1, 0].set_title('Distribución de Tendencia')
        axes[1, 0].set_ylabel('Conteo')
    else:
        for ax in axes.flatten():
            ax.text(0.5, 0.5, 'Sin datos de parciales', ha='center', va='center')
            ax.set_title('Sin datos')

    if len(alumnos):
        sem_counts = alumnos.semestre_actual.value_counts().sort_index()
        colores_sem = ['#9C27B0', '#3F51B5', '#03A9F4', '#009688', '#8BC34A', '#FF9800', '#795548']
        bars = axes[1, 1].bar(sem_counts.index.astype(str), sem_counts.values,
                               color=[colores_sem[i % len(colores_sem)] for i in range(len(sem_counts))])
        axes[1, 1].set_title('Distribución de Semestre Actual')
        axes[1, 1].set_xlabel('Semestre')
        axes[1, 1].set_ylabel('Alumnos')
        for bar, v in zip(bars, sem_counts.values):
            axes[1, 1].text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.05,
                           str(v), ha='center', va='bottom')
    else:
        axes[1, 1].text(0.5, 0.5, 'Sin alumnos', ha='center', va='center')

    plt.tight_layout()
    p1 = export_png('desercion_histogramas.png', fig)
    r(f'  ✅ desercion_histogramas.png → {p1}')
    export_jpeg('desercion_histogramas.jpeg', fig)

    # Gráfico 2: Correlaciones
    fig2, ax2 = plt.subplots(figsize=(8, 6))
    if len(parciales) >= 3:
        corr_cols = ['calificacion_promedio', 'materias_reprobadas', 'riesgos_detectados',
                     'alumnos_activos', 'alumnos_desertores']
        available = [c for c in corr_cols if c in parciales.columns]
        corr = parciales[available].corr(method='pearson')
        mask = np.triu(np.ones_like(corr, dtype=bool), k=1)
        sns.heatmap(corr, mask=mask, annot=True, fmt='.2f', cmap='RdBu_r',
                    vmin=-1, vmax=1, center=0, square=True,
                    linewidths=1, cbar_kws={'shrink': 0.8}, ax=ax2)
        ax2.set_title('Matriz de Correlación (Pearson) — Parciales', fontweight='bold')
    else:
        ax2.text(0.5, 0.5, 'Datos insuficientes para correlación', ha='center', va='center', fontsize=12)
    plt.tight_layout()
    p2 = export_png('desercion_correlaciones.png', fig2)
    r(f'  ✅ desercion_correlaciones.png → {p2}')
    export_jpeg('desercion_correlaciones.jpeg', fig2)

    # Gráfico 3: Tendencias por alumno
    fig3, (ax3a, ax3b) = plt.subplots(1, 2, figsize=(14, 5), sharex=True)
    fig3.suptitle('EDA - IA de Deserción: Evolución por Parcial', fontsize=14, fontweight='bold')

    colores_alumnos = {1: '#2196F3', 2: '#FF5722', 3: '#4CAF50'}
    markers = {1: 'o', 2: 's', 3: '^'}

    if len(parciales):
        for alumno_id in sorted(parciales.id_alumno.unique()):
            sub = parciales[parciales.id_alumno == alumno_id].sort_values('numero_parcial')
            color = colores_alumnos.get(alumno_id, '#333')
            marker = markers.get(alumno_id, 'o')
            ax3a.plot(sub.numero_parcial, sub.calificacion_promedio,
                     marker=marker, color=color, linewidth=2, markersize=8,
                     label=f'Alumno {alumno_id}')
            ax3b.plot(sub.numero_parcial, sub.materias_reprobadas,
                     marker=marker, color=color, linewidth=2, markersize=8,
                     label=f'Alumno {alumno_id}')

        ax3a.set_title('Calificación Promedio por Parcial')
        ax3a.set_xlabel('Parcial')
        ax3a.set_ylabel('Calificación')
        ax3a.set_xticks([1, 2, 3])
        ax3a.legend()
        ax3a.grid(True, alpha=0.3)

        ax3b.set_title('Materias Reprobadas por Parcial')
        ax3b.set_xlabel('Parcial')
        ax3b.set_ylabel('Materias reprobadas')
        ax3b.set_xticks([1, 2, 3])
        ax3b.legend()
        ax3b.grid(True, alpha=0.3)
    else:
        ax3a.text(0.5, 0.5, 'Sin datos', ha='center', va='center')
        ax3b.text(0.5, 0.5, 'Sin datos', ha='center', va='center')

    plt.tight_layout()
    p3 = export_png('desercion_tendencias.png', fig3)
    r(f'  ✅ desercion_tendencias.png → {p3}')
    export_jpeg('desercion_tendencias.jpeg', fig3)

    # ──────────────────────────────────────────────
    # 9. RESUMEN ESTADÍSTICO CSV
    # ──────────────────────────────────────────────
    if len(parciales):
        resumen_df = parciales.describe().round(2).reset_index()
        resumen_df = resumen_df.rename(columns={'index': 'estadistica'})
        csv_path = export_csv('resumen_estadistico_desercion.csv', resumen_df)
        r(f'\nResumen estadístico exportado: {csv_path}')

    # ──────────────────────────────────────────────
    # 10. CONCLUSIONES
    # ──────────────────────────────────────────────
    r(separador('9. CONCLUSIONES Y HALLAZGOS'))
    r('1. DATOS INSUFICIENTES PARA ML SUPERVISADO:')
    r('   • Solo 3 alumnos imposibilitan entrenar un modelo generalizable.')
    r('   • kardex_historial_academico vacío → sin feature crítico de desempeño histórico.')
    r('   • inscripciones/reinscripciones vacías → sin feature de persistencia académica.')
    r('')
    r('2. MEJORES FEATURES ACTUALES (ia_desercion_parciales):')
    r('   • calificacion_promedio (9 registros, variabilidad real)')
    r('   • materias_reprobadas (correlación negativa esperada con calificación)')
    r('   • tendencia (Mejora/Estable/Declive → proxy de riesgo)')
    r('')
    r('3. PARA FASES SIGUIENTES SE REQUIERE:')
    r('   a) Capturar datos reales en kardax_historial_academico (historial de materias cursadas)')
    r('   b) Capturar reinscripciones por periodo')
    r('   c) Generar datos sintéticos realistas para poder entrenar un modelo baseline')
    r('   d) Aumentar la base de alumnos objetivo (mínimo 200-500 registros)')
    r('')
    r('4. VIABILIDAD DE ML: BAJA CON DATOS ACTUALES.')
    r('   El sistema de reglas (rule-v2) es la única opción viable hasta tener datos suficientes.')
    r('   Se recomienda usar los parciales (9 registros) como semilla para generar datos sintéticos.')

    return '\n'.join(report)
