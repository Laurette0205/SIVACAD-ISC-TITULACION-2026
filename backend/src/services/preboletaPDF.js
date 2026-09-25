'use strict';

function generarPreboletaHTML(data) {
  const { institucion, alumno, grupo, periodo, materias, resumen, generado_en } = data;

  const filasHTML = materias.map((m, i) => {
    const p1 = m.parcial_1 != null ? Number(m.parcial_1).toFixed(1) : '—';
    const p2 = m.parcial_2 != null ? Number(m.parcial_2).toFixed(1) : '—';
    const p3 = m.parcial_3 != null ? Number(m.parcial_3).toFixed(1) : '—';
    const prom = m.promedio != null ? Number(m.promedio).toFixed(1) : '—';
    const estadoColor = m.estado === 'Acreditada' ? '#059669' : m.estado === 'No Acreditada' ? '#dc2626' : '#6b7280';

    return `<tr>
      <td style="padding:5px 6px;border:1px solid #d1d5db;text-align:center;font-size:10px">${i + 1}</td>
      <td style="padding:5px 6px;border:1px solid #d1d5db;font-size:10px">${m.nombre_materia}</td>
      <td style="padding:5px 6px;border:1px solid #d1d5db;font-size:9px;color:#6b7280">${m.nombre_docente}</td>
      <td style="padding:5px 6px;border:1px solid #d1d5db;text-align:center;font-size:10px">${p1}</td>
      <td style="padding:5px 6px;border:1px solid #d1d5db;text-align:center;font-size:10px">${p2}</td>
      <td style="padding:5px 6px;border:1px solid #d1d5db;text-align:center;font-size:10px">${p3}</td>
      <td style="padding:5px 6px;border:1px solid #d1d5db;text-align:center;font-size:10px;font-weight:bold">${prom}</td>
      <td style="padding:5px 6px;border:1px solid #d1d5db;text-align:center;font-size:9px;font-weight:bold;color:${estadoColor}">${m.estado}</td>
    </tr>`;
  }).join('');

  const fecha = new Date(generado_en).toLocaleDateString('es-MX', {
    year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/Mexico_City'
  });

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  @page { size: letter landscape; margin: 2.54cm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; font-size: 11px; }
  .header { text-align: center; border-bottom: 3px solid #1e40af; padding-bottom: 8px; margin-bottom: 10px; }
  .header .inst { font-size: 14px; font-weight: bold; color: #1e40af; }
  .header .carrera { font-size: 11px; color: #6b7280; margin-top: 2px; }
  .header .doc-title { font-size: 16px; font-weight: bold; color: #1e40af; margin-top: 6px; text-transform: uppercase; letter-spacing: 1px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 4px 16px; font-size: 10px; margin-bottom: 10px; padding: 8px; background: #f8fafc; border-radius: 4px; border: 1px solid #e2e8f0; }
  .info-grid .label { font-weight: bold; color: #1e40af; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1e40af; color: white; padding: 5px 6px; border: 1px solid #1e40af; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
  .footer { margin-top: 12px; font-size: 8px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 6px; display: flex; justify-content: space-between; }
  .nota { margin-top: 8px; padding: 6px 10px; background: #fef3c7; border: 1px solid #fbbf24; border-radius: 4px; font-size: 9px; color: #92400e; }
  .resumen { display: flex; gap: 12px; margin-top: 8px; font-size: 9px; }
  .resumen-item { padding: 3px 8px; background: #eff6ff; border-radius: 3px; }
  .resumen-item .val { font-weight: bold; color: #1e40af; }
</style></head><body>
  <div class="header">
    <div class="inst">${institucion.nombre}</div>
    <div class="carrera">${institucion.carrera}</div>
    <div class="doc-title">Preboleta de Calificaciones</div>
  </div>
  <div class="info-grid">
    <div><span class="label">Alumno:</span> ${alumno.nombre_completo}</div>
    <div><span class="label">Matrícula:</span> ${alumno.matricula}</div>
    <div><span class="label">Carrera:</span> ${alumno.nombre_carrera}</div>
    <div><span class="label">Plan:</span> ${alumno.nombre_plan || '—'} ${alumno.version_plan || ''}</div>
    <div><span class="label">Semestre:</span> ${alumno.semestre_actual || '—'}</div>
    <div><span class="label">Grupo:</span> ${grupo?.nombre_grupo || '—'}</div>
    <div><span class="label">Turno:</span> ${grupo?.turno || '—'}</div>
    <div><span class="label">Periodo:</span> ${periodo || '—'}</div>
  </div>
  <table>
    <thead><tr>
      <th style="width:3%">#</th>
      <th style="width:25%">Materia</th>
      <th style="width:20%">Docente</th>
      <th style="width:8%">P1</th>
      <th style="width:8%">P2</th>
      <th style="width:8%">P3</th>
      <th style="width:10%">Promedio</th>
      <th style="width:12%">Estado</th>
    </tr></thead>
    <tbody>${filasHTML}</tbody>
  </table>
  <div class="resumen">
    <div class="resumen-item"><span class="val">${resumen.total_materias}</span> Materias</div>
    <div class="resumen-item"><span class="val">${resumen.promedio_general != null ? Number(resumen.promedio_general).toFixed(1) : '—'}</span> Promedio General</div>
    <div class="resumen-item"><span class="val" style="color:#059669">${resumen.materias_aprobadas}</span> Aprobadas</div>
    <div class="resumen-item"><span class="val" style="color:#dc2626">${resumen.materias_no_acreditadas}</span> No Acreditadas</div>
    <div class="resumen-item"><span class="val">${resumen.faltas_totales}</span> Faltas</div>
  </div>
  <div class="nota">
    <strong>Nota:</strong> Este documento es una preboleta (preliminar) y no sustituye la boleta oficial de calificaciones.
  </div>
  <div class="footer">
    <span>Documento generado por SIVACAD-ISC v3.0</span>
    <span>Fecha de emisión: ${fecha}</span>
  </div>
</body></html>`;
}

module.exports = { generarPreboletaHTML };
