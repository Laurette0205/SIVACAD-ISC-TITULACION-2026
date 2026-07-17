#!/usr/bin/env python3
"""
EDA Principal — SIVACAD-ISC
Ejecuta el análisis exploratorio completo de los módulos:
  1. IA de Deserción Académica
  2. IA de Bienestar Estudiantil

Genera reportes de texto (.txt), gráficos (.png / .jpeg) y CSV.
"""

import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import get_connection
from utils import export_txt
from eda_desercion import analizar_desercion
from eda_bienestar import analizar_bienestar


def main():
    inicio = datetime.now()
    print('╔══════════════════════════════════════════════════════════════╗')
    print('║  SIVACAD-ISC — ANÁLISIS EXPLORATORIO DE DATOS (EDA)        ║')
    print(f'║  {inicio.strftime("%Y-%m-%d %H:%M:%S")}                                          ║')
    print('╚══════════════════════════════════════════════════════════════╝')

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT DATABASE(), VERSION()")
    db_name, db_ver = cursor.fetchone()
    print(f'\n📦 Conectado a: {db_name} | MariaDB/MySQL {db_ver}')
    cursor.close()

    resultados = {}

    try:
        print('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        print('  [1/2] Analizando módulo: IA DE DESERCIÓN...')
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        reporte_desercion = analizar_desercion(conn)
        resultados['desercion'] = reporte_desercion
        path = export_txt('reporte_eda_desercion.txt', reporte_desercion)
        print(f'  ✅ Reporte guardado: {path}')
        print(f'  📊 Gráficos: desercion_histogramas, desercion_correlaciones, desercion_tendencias')
    except Exception as e:
        print(f'  ❌ Error en análisis de deserción: {e}')
        import traceback
        traceback.print_exc()
        resultados['desercion'] = f'ERROR: {e}'

    try:
        print('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        print('  [2/2] Analizando módulo: IA DE BIENESTAR...')
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        reporte_bienestar = analizar_bienestar(conn)
        resultados['bienestar'] = reporte_bienestar
        path = export_txt('reporte_eda_bienestar.txt', reporte_bienestar)
        print(f'  ✅ Reporte guardado: {path}')
        print(f'  📊 Gráficos: bienestar_radar, bienestar_barras')
    except Exception as e:
        print(f'  ❌ Error en análisis de bienestar: {e}')
        import traceback
        traceback.print_exc()
        resultados['bienestar'] = f'ERROR: {e}'

    # ─── Reporte consolidado ───
    print('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    print('  Generando reporte consolidado...')
    consolidado = []
    consolidado.append('╔══════════════════════════════════════════════════════════════╗')
    consolidado.append('║  SIVACAD-ISC — REPORTE EDA CONSOLIDADO                      ║')
    consolidado.append(f'║  Generado: {inicio.strftime("%Y-%m-%d %H:%M:%S")}                             ║')
    consolidado.append('║  Módulos: IA Deserción + IA Bienestar                       ║')
    consolidado.append('╚══════════════════════════════════════════════════════════════╝')
    consolidado.append('')
    consolidado.append(f'DATABASE: {db_name} | VERSION: {db_ver}')
    consolidado.append(f'TABLAS ANALIZADAS: alumnos, kardex_alumno, kardex_historial_academico,')
    consolidado.append('  ia_alertas_desercion, ia_desercion_parciales, inscripciones,')
    consolidado.append('  reinscripciones, ia_bienestar_checkins, ia_bienestar_alertas,')
    consolidado.append('  ia_bienestar_sesiones, ia_bienestar_derivaciones, ia_bienestar_mensajes')
    consolidado.append('')

    for key in ['desercion', 'bienestar']:
        if key in resultados:
            texto = resultados[key]
            lines = texto.split('\n')
            consolidado.append(f'{"━" * 78}')
            consolidado.append(f'>>> MÓDULO: IA DE {key.upper()} <<<')
            consolidado.append(f'{"━" * 78}')
            consolidado.append('')
            for line in lines:
                if line.startswith('╔') or line.startswith('║') or line.startswith('╚'):
                    continue
                consolidado.append(line)
            consolidado.append('')

    path_c = export_txt('reporte_eda_completo.txt', '\n'.join(consolidado))
    print(f'  ✅ Reporte consolidado: {path_c}')

    conn.close()
    delta = datetime.now() - inicio
    print(f'\n✅ EDA COMPLETO en {delta.total_seconds():.1f}s')
    print(f'   Revisa la carpeta: {os.path.join(os.path.dirname(__file__), "output")}/')
    print()
    print('Archivos generados:')
    output_dir = os.path.join(os.path.dirname(__file__), 'output')
    for f in sorted(os.listdir(output_dir)):
        fpath = os.path.join(output_dir, f)
        size = os.path.getsize(fpath)
        print(f'  📄 {f:50s} {size:>8,d} bytes')


if __name__ == '__main__':
    main()
