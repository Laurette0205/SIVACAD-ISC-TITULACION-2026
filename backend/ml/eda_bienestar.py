import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon
from math import pi
from utils import query, export_txt, export_png, export_jpeg, separador, setup_plot_style

DIMENSIONES = ['animo', 'energia', 'sueno', 'estres', 'apoyo', 'ambiente',
               'carga_academica', 'carga_laboral', 'enfoque']
DIMENSIONES_LABEL = ['Ánimo', 'Energía', 'Sueño', 'Estrés', 'Apoyo',
                     'Ambiente', 'Carga Acad.', 'Carga Laboral', 'Enfoque']

CATEGORIAS = {
    'Saludable (8-10)': (8, 10, '#4CAF50'),
    'Atención (5-7)': (5, 7.99, '#FFC107'),
    'Riesgo (1-4)': (1, 4.99, '#F44336'),
}

def analizar_bienestar(conn):
    setup_plot_style()
    report = []
    r = lambda s: report.append(s)
    r('╔══════════════════════════════════════════════════════════════╗')
    r('║  SIVACAD-ISC — EDA: IA DE BIENESTAR ESTUDIANTIL             ║')
    r('║  Fecha: 2026-07-14                                         ║')
    r('╚══════════════════════════════════════════════════════════════╝')

    # ──────────────────────────────────────────────
    # 1. CHECK-IN
    # ──────────────────────────────────────────────
    r(separador('1. CHECK-IN DE BIENESTAR (ia_bienestar_checkins)'))
    checkins = query(conn, '''
        SELECT c.*, u.nombres, u.apellido_paterno
        FROM ia_bienestar_checkins c
        JOIN usuarios u ON c.id_usuario = u.id_usuario
        ORDER BY c.creado_en DESC
        LIMIT 5
    ''')
    r(f'Total check-ins: {len(checkins)}')
    if len(checkins) == 0:
        r('❌ No hay check-ins registrados')
        return '\n'.join(report)

    ck = checkins.iloc[0]
    r(f'\nCheck-in más reciente:')
    r(f'  Usuario: {ck.get("nombres","?")} {ck.get("apellido_paterno","?")} (ID={ck.id_usuario})')
    r(f'  Plantilla: {ck.codigo_plantilla}')
    r(f'  Bienestar Score: {ck.bienestar_score}/100')
    r(f'  Índice de Riesgo: {ck.indice_riesgo:.2f}')
    r(f'  Nivel de Riesgo: {ck.nivel_riesgo}')
    r(f'  Fecha: {ck.creado_en}')

    r('\nPerfil dimensional (escala 1-10):')
    valores = {}
    for dim, label in zip(DIMENSIONES, DIMENSIONES_LABEL):
        val = int(ck.get(dim, 0) or 0)
        valores[dim] = val
        if dim == 'estres':
            val_inv = 11 - val
        cat = 'Saludable' if val >= 8 else ('Atención' if val >= 5 else 'Riesgo')
        r(f'  {label:20s}: {val}/10 → {cat}')

    # ──────────────────────────────────────────────
    # 2. ALERTAS
    # ──────────────────────────────────────────────
    r(separador('2. ALERTAS DE BIENESTAR (ia_bienestar_alertas)'))
    alertas = query(conn, '''
        SELECT a.*, u.nombres, u.apellido_paterno
        FROM ia_bienestar_alertas a
        JOIN usuarios u ON a.id_usuario = u.id_usuario
        ORDER BY a.creado_en DESC
    ''')
    r(f'Total alertas: {len(alertas)}')
    for _, al in alertas.iterrows():
        r(f'  • Alerta #{al.id_alerta}: Usuario={al.nombres} {al.apellido_paterno}')
        r(f'    Tipo: {al.tipo_alerta}')
        r(f'    Nivel: {al.nivel_riesgo}')
        r(f'    Descripción: {al.descripcion}')
        r(f'    Acción sugerida: {al.accion_sugerida}')
        r(f'    Requiere derivación: {"SÍ ⚠️" if al.requiere_derivacion else "No"}')
        r(f'    Estado: {al.estado}')
        if al.metadata_json:
            import json
            try:
                meta = json.loads(al.metadata_json)
                if 'crisis_911' in meta:
                    r(f'    🚨 Crisis 911: {meta["crisis_911"]}')
                if 'recomendaciones' in meta:
                    r(f'    Recomendaciones IA: {meta["recomendaciones"][:200]}')
            except:
                pass

    # ──────────────────────────────────────────────
    # 3. SESIONES
    # ──────────────────────────────────────────────
    r(separador('3. SESIONES DE BIENESTAR'))
    sesiones = query(conn, '''
        SELECT s.*, u.nombres, u.apellido_paterno
        FROM ia_bienestar_sesiones s
        JOIN usuarios u ON s.id_usuario = u.id_usuario
        ORDER BY s.creado_en DESC
    ''')
    r(f'Total sesiones: {len(sesiones)}')
    for _, s in sesiones.iterrows():
        r(f'  • Sesión #{s.id_sesion}: {s.nombres} {s.apellido_paterno}')
        r(f'    Estado: {s.estado}, Nivel riesgo: {s.nivel_riesgo_actual}')

    # ──────────────────────────────────────────────
    # 4. DERIVACIONES
    # ──────────────────────────────────────────────
    r(separador('4. DERIVACIONES'))
    deriv = query(conn, 'SELECT COUNT(*) AS n FROM ia_bienestar_derivaciones').iloc[0, 0]
    r(f'Total derivaciones: {deriv}')
    if deriv == 0:
        r('  ℹ️ Sin derivaciones registradas (consistente con alertas de bajo nivel)')

    # ──────────────────────────────────────────────
    # 5. MENSAJES
    # ──────────────────────────────────────────────
    r(separador('5. MENSAJES DE LA CONVERSACIÓN'))
    mensajes = query(conn, '''
        SELECT m.*, u.nombres, u.apellido_paterno
        FROM ia_bienestar_mensajes m
        JOIN usuarios u ON m.id_usuario = u.id_usuario
        ORDER BY m.creado_en ASC
    ''')
    r(f'Total mensajes: {len(mensajes)}')
    for _, msg in mensajes.iterrows():
        rol = '🧑‍🎓 Alumno' if msg.rol_mensaje == 'user' else '🤖 IA'
        texto = str(msg.mensaje)[:120] + ('...' if len(str(msg.mensaje)) > 120 else '')
        r(f'  [{msg.creado_en}] {rol}: {texto}')

    # ──────────────────────────────────────────────
    # 6. PLANTILLAS
    # ──────────────────────────────────────────────
    r(separador('6. PLANTILLAS DISPONIBLES'))
    plantillas = query(conn, 'SELECT * FROM ia_bienestar_plantillas')
    r(f'Total plantillas: {len(plantillas)}')
    for _, pt in plantillas.iterrows():
        r(f'  • {pt.codigo_plantilla}: {pt.nombre_plantilla}'
          f' — {pt.descripcion or "Sin descripción"}')

    # ──────────────────────────────────────────────
    # 7. GRÁFICOS
    # ──────────────────────────────────────────────
    r(separador('7. GRÁFICOS GENERADOS'))

    # Gráfico 1: Radar chart
    fig1, ax1 = plt.subplots(figsize=(8, 8), subplot_kw=dict(polar=True))
    fig1.suptitle('Perfil de Bienestar — Check-in', fontsize=14, fontweight='bold')

    if len(checkins):
        valores_radar = [valores.get(d, 0) for d in DIMENSIONES]
        angulos = [n / float(len(DIMENSIONES)) * 2 * pi for n in range(len(DIMENSIONES))]
        angulos += angulos[:1]
        vals_plot = valores_radar + valores_radar[:1]

        ax1.plot(angulos, vals_plot, 'o-', linewidth=2, color='#2196F3', markersize=6)
        ax1.fill(angulos, vals_plot, alpha=0.15, color='#2196F3')

        ax1.set_xticks(angulos[:-1])
        ax1.set_xticklabels(DIMENSIONES_LABEL, fontsize=10)
        ax1.set_ylim(0, 11)
        ax1.set_yticks([2, 4, 6, 8, 10])
        ax1.set_yticklabels(['2', '4', '6', '8', '10'], fontsize=9, color='gray')
        ax1.grid(True, alpha=0.3)

        niveles = [2, 5, 8]
        for nivel in niveles:
            ax1.plot(angulos, [nivel] * len(angulos), '--', color='gray', alpha=0.3, linewidth=0.8)

        score = ck.bienestar_score
        riesgo = ck.indice_riesgo
        nivel_riesgo = ck.nivel_riesgo
        color_riesgo = {'Bajo': '#4CAF50', 'Medio': '#FFC107', 'Alto': '#FF9800', 'Crítico': '#F44336'}
        ax1.text(0, -0.15, f'Bienestar Score: {score}/100  |  '
                           f'Índice de Riesgo: {riesgo:.2f}  |  '
                           f'Nivel: {nivel_riesgo}',
                ha='center', va='center', fontsize=11,
                transform=ax1.transAxes,
                bbox=dict(boxstyle='round,pad=0.3',
                         facecolor=color_riesgo.get(nivel_riesgo, '#eee'),
                         alpha=0.3))
    else:
        ax1.text(0, 0, 'Sin datos', ha='center', va='center', fontsize=14)

    plt.tight_layout()
    p1r = export_png('bienestar_radar.png', fig1)
    r(f'  ✅ bienestar_radar.png → {p1r}')
    export_jpeg('bienestar_radar.jpeg', fig1)

    # Gráfico 2: Barras de dimensiones
    fig2, ax2 = plt.subplots(figsize=(10, 6))
    fig2.suptitle('Dimensiones de Bienestar', fontsize=14, fontweight='bold')

    if len(checkins):
        vals_bar = valores_radar
        bars = ax2.barh(DIMENSIONES_LABEL, vals_bar, height=0.6)
        colores_bar = []
        for v in vals_bar:
            if v >= 8:
                colores_bar.append('#4CAF50')
            elif v >= 5:
                colores_bar.append('#FFC107')
            else:
                colores_bar.append('#F44336')
        for bar, c in zip(bars, colores_bar):
            bar.set_color(c)
            bar.set_edgecolor('white')
            bar.set_linewidth(0.5)

        ax2.axvline(x=8, color='#4CAF50', linestyle='--', alpha=0.5, label='Saludable (8+)')
        ax2.axvline(x=5, color='#FFC107', linestyle='--', alpha=0.5, label='Atención (5-7)')
        ax2.axvline(x=1, color='#F44336', linestyle='--', alpha=0.5, label='Riesgo (1-4)')
        ax2.set_xlim(0, 11)
        ax2.set_xlabel('Valor (escala 1-10)')
        ax2.legend(loc='lower right')

        for bar, v in zip(bars, vals_bar):
            ax2.text(bar.get_width() + 0.2, bar.get_y() + bar.get_height()/2,
                    f'{v}/10', va='center', fontsize=9, color='#333')
    else:
        ax2.text(0.5, 0.5, 'Sin datos', ha='center', va='center', fontsize=14,
                transform=ax2.transAxes)

    plt.tight_layout()
    p2r = export_png('bienestar_barras.png', fig2)
    r(f'  ✅ bienestar_barras.png → {p2r}')
    export_jpeg('bienestar_barras.jpeg', fig2)

    # ──────────────────────────────────────────────
    # 8. CONCLUSIONES
    # ──────────────────────────────────────────────
    r(separador('8. CONCLUSIONES Y HALLAZGOS'))
    r('1. VOLUMEN DE DATOS:')
    r(f'   • 1 check-in, {len(alertas)} alerta(s), {len(sesiones)} sesión(es), {len(mensajes)} mensaje(s)')
    r(f'   • 0 derivaciones — consistentes con nivel de riesgo {ck.nivel_riesgo if len(checkins) else "N/A"}')
    r('')
    r('2. DIMENSIONES CAPTURADAS (9 variables escala 1-10):')
    r('   • Ánimo, Energía, Sueño, Estrés, Apoyo, Ambiente,')
    r('   • Carga Académica, Carga Laboral, Enfoque')
    r('   • Además: bienestar_score global, índice_riesgo compuesto')
    r('')
    r('3. POTENCIAL PARA ML EN BIENESTAR:')
    r('   • Clasificación: predecir nivel_riesgo (Bajo/Medio/Alto/Crítico) desde las 9 dimensiones')
    r('   • Regresión: predecir bienestar_score continuo')
    r('   • Detección de anomalías: identificar patrones atípicos previos a crisis')
    r('   • Alertas tempranas: clasificar si requiere_derivacion = True')
    r('')
    r('4. LIMITACIONES:')
    r('   • 1 solo registro → insuficiente para entrenar cualquier modelo')
    r('   • No hay historial temporal para detectar tendencias de bienestar')
    r('   • No hay datos de crisis (derivaciones=0) para aprendizaje de casos graves')
    r('')
    r('5. RECOMENDACIÓN:')
    r('   • Implementar check-ins semanales obligatorios para acumular datos')
    r('   • Una vez con 200+ registros, entrenar clasificador de nivel_riesgo')
    r('   • Integrar con el sistema de alertas para derivación automática ML-based')
    r('   • El sistema actual con Gemini API + reglas es adecuado por ahora')

    return '\n'.join(report)
