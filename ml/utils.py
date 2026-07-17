import os
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'output')
os.makedirs(OUTPUT_DIR, exist_ok=True)

def query(conn, sql):
    return pd.read_sql(sql, conn)

def export_txt(path, content):
    full = os.path.join(OUTPUT_DIR, path)
    with open(full, 'w', encoding='utf-8') as f:
        f.write(content)
    return full

def export_png(path, fig=None):
    full = os.path.join(OUTPUT_DIR, path)
    (fig or plt).savefig(full, dpi=150, bbox_inches='tight')
    plt.close(fig) if fig else plt.close()
    return full

def export_jpeg(path, fig=None):
    full = os.path.join(OUTPUT_DIR, path)
    (fig or plt).savefig(full, dpi=150, bbox_inches='tight', format='jpeg')
    plt.close(fig) if fig else plt.close()
    return full

def export_csv(path, df):
    full = os.path.join(OUTPUT_DIR, path)
    df.to_csv(full, index=False, encoding='utf-8')
    return full

def separador(titulo, char='━', width=78):
    return f'\n{char * width}\n{titulo}\n{char * width}\n'

def tabla_texto(columns, rows, title=None):
    cols = len(columns)
    col_widths = [max(len(str(c)), max((len(str(r[i])) for r in rows), default=0)) for i, c in enumerate(columns)]
    sep = '─' * (sum(col_widths) + 3 * cols + 1)
    lines = []
    if title:
        lines.append(f'  {title}')
    hdr = '│' + '│'.join(f' {c:^{col_widths[i]}} ' for i, c in enumerate(columns)) + '│'
    lines.append(sep)
    lines.append(hdr)
    lines.append(sep)
    for r in rows:
        lines.append('│' + '│'.join(f' {str(r[i]):{col_widths[i]}} ' for i in range(cols)) + '│')
    lines.append(sep)
    return '\n'.join(lines)

def setup_plot_style():
    sns.set_theme(style='whitegrid', palette='muted', font_scale=0.9)
    plt.rcParams['figure.facecolor'] = 'white'
    plt.rcParams['axes.facecolor'] = '#fafafa'
