'use strict';

function generarBoletaHTML(data) {
  const { institucion, alumno, grupo, periodo, periodos, materias, resumen, generado_en } = data;

  const fecha = new Date(generado_en).toLocaleDateString('es-MX', {
    year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/Mexico_City'
  });

  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const fechaActual = new Date();
  const mesActual = meses[fechaActual.getMonth()];
  const anioActual = fechaActual.getFullYear();

  const materiasPorPeriodo = periodos || [{ nombre_periodo: periodo, materias }];

  let seccionesPeriodoHTML = '';
  for (const per of materiasConPeriodo(materiasPorPeriodo)) {
    const filas = per.materias.map((m, i) => {
      const p1 = m.parcial_1 != null ? Number(m.parcial_1).toFixed(1) : '—';
      const p2 = m.parcial_2 != null ? Number(m.parcial_2).toFixed(1) : '—';
      const p3 = m.parcial_3 != null ? Number(m.parcial_3).toFixed(1) : '—';
      const calFinal = m.calificacion_final != null ? Number(m.calificacion_final).toFixed(1) : '—';
      const estadoColor = m.estado === 'Acreditada' ? '#059669' : m.estado === 'No Acreditada' ? '#dc2626' : '#6b7280';
      const estadoBg = m.estado === 'Acreditada' ? '#d1fae5' : m.estado === 'No Acreditada' ? '#fee2e2' : '#f3f4f6';

      return `<tr>
        <td style="padding:4px 5px;border:1px solid #d1d5db;text-align:center;font-size:9px">${i + 1}</td>
        <td style="padding:4px 5px;border:1px solid #d1d5db;font-size:9px">${m.nombre_materia}</td>
        <td style="padding:4px 5px;border:1px solid #d1d5db;font-size:8px;color:#6b7280">${m.nombre_docente}</td>
        <td style="padding:4px 5px;border:1px solid #d1d5db;text-align:center;font-size:9px">${p1}</td>
        <td style="padding:4px 5px;border:1px solid #d1d5db;text-align:center;font-size:9px">${p2}</td>
        <td style="padding:4px 5px;border:1px solid #d1d5db;text-align:center;font-size:9px">${p3}</td>
        <td style="padding:4px 5px;border:1px solid #d1d5db;text-align:center;font-size:9px;font-weight:bold">${calFinal}</td>
        <td style="padding:4px 5px;border:1px solid #d1d5db;text-align:center;font-size:8px;font-weight:bold;background:${estadoBg};color:${estadoColor}">${m.estado}</td>
      </tr>`;
    }).join('');

    const promedioPer = per.promedio_periodo != null ? Number(per.promedio_periodo).toFixed(1) : '—';

    seccionesPeriodoHTML += `
    <div style="margin-bottom:10px">
      <div style="background:#1e40af;color:white;padding:4px 8px;font-size:10px;font-weight:bold;border-radius:3px 3px 0 0">
        PERIODO: ${per.nombre_periodo} — Promedio: ${promedioPer} — Aprobadas: ${per.aprobadas} — No Acreditadas: ${per.no_acreditadas}
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="width:3%">#</th>
          <th style="width:24%">Materia</th>
          <th style="width:18%">Docente</th>
          <th style="width:8%">P1</th>
          <th style="width:8%">P2</th>
          <th style="width:8%">P3</th>
          <th style="width:10%">Final</th>
          <th style="width:12%">Estado</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
  }

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  @page { size: letter portrait; margin: 2.54cm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; font-size: 10px; }
  .header { text-align: center; border-bottom: 3px solid #1e40af; padding-bottom: 10px; margin-bottom: 12px; }
  .header .inst { font-size: 15px; font-weight: bold; color: #1e40af; }
  .header .carrera { font-size: 11px; color: #6b7280; margin-top: 2px; }
  .header .doc-title { font-size: 18px; font-weight: bold; color: #1e40af; margin-top: 8px; text-transform: uppercase; letter-spacing: 2px; }
  .section { margin-bottom: 12px; }
  .section-title { font-size: 11px; font-weight: bold; color: #1e40af; text-transform: uppercase; border-bottom: 2px solid #dbeafe; padding-bottom: 3px; margin-bottom: 6px; letter-spacing: 0.5px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 20px; font-size: 10px; padding: 8px; background: #f8fafc; border-radius: 4px; border: 1px solid #e2e8f0; }
  .info-grid .label { font-weight: bold; color: #1e40af; }
  .resumen-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 6px; }
  .resumen-card { text-align: center; padding: 6px; border-radius: 4px; border: 1px solid #e2e8f0; }
  .resumen-card .val { font-size: 18px; font-weight: bold; color: #1e40af; }
  .resumen-card .lbl { font-size: 8px; color: #6b7280; margin-top: 2px; }
  .firma-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 20px; text-align: center; }
  .firma-box { border-top: 1px solid #374151; padding-top: 4px; font-size: 9px; color: #374151; }
  .footer { margin-top: 15px; font-size: 8px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 6px; text-align: center; }
  .nota { margin-top: 8px; padding: 6px 10px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px; font-size: 9px; color: #1e40af; }
</style></head><body>
  <div class="header">
    <div class="inst">${institucion.nombre}</div>
    <div class="carrera">${institucion.carrera}</div>
    <div class="doc-title">Boleta de Calificaciones</div>
  </div>

  <div class="section">
    <div class="section-title">Datos del Alumno</div>
    <div class="info-grid">
      <div><span class="label">Nombre:</span> ${alumno.nombre_completo}</div>
      <div><span class="label">Matrícula:</span> ${alumno.matricula}</div>
      <div><span class="label">Carrera:</span> ${alumno.nombre_carrera}</div>
      <div><span class="label">Plan de Estudios:</span> ${alumno.nombre_plan || '—'} ${alumno.version_plan || ''}</div>
      <div><span class="label">Semestre:</span> ${alumno.semestre_actual || '—'}</div>
      <div><span class="label">Grupo:</span> ${grupo?.nombre_grupo || '—'}</div>
      <div><span class="label">Turno:</span> ${grupo?.turno || '—'}</div>
      <div><span class="label">Periodo:</span> ${periodo || '—'}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Datos Académicos</div>
    <div class="info-grid">
      <div><span class="label">Estatus Académico:</span> ${alumno.estatus_academico || 'Regular'}</div>
      <div><span class="label">Créditos Acumulados:</span> ${alumno.creditos_acumulados || 0}</div>
      <div><span class="label">Promedio General:</span> ${alumno.promedio_general != null ? Number(alumno.promedio_general).toFixed(2) : '—'}</div>
      <div><span class="label">Total de Materias:</span> ${resumen.total_materias}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Calificaciones</div>
    ${seccionesPeriodoHTML}
  </div>

  <div class="section">
    <div class="section-title">Resumen</div>
    <div class="resumen-grid">
      <div class="resumen-card">
        <div class="val">${resumen.promedio_general != null ? Number(resumen.promedio_general).toFixed(1) : '—'}</div>
        <div class="lbl">Promedio General</div>
      </div>
      <div class="resumen-card" style="border-color:#059669">
        <div class="val" style="color:#059669">${resumen.materias_aprobadas}</div>
        <div class="lbl">Materias Aprobadas</div>
      </div>
      <div class="resumen-card" style="border-color:#dc2626">
        <div class="val" style="color:#dc2626">${resumen.materias_no_acreditadas}</div>
        <div class="lbl">No Acreditadas</div>
      </div>
      <div class="resumen-card" style="border-color:#d97706">
        <div class="val" style="color:#d97706">${resumen.faltas_totales}</div>
        <div class="lbl">Faltas Totales</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Observaciones</div>
    <div style="padding:8px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;font-size:9px;color:#6b7280;min-height:30px">
      ${resumen.materias_no_acreditadas > 0
        ? `El alumno tiene ${resumen.materias_no_acreditadas} materia(s) no acreditada(s) en el periodo ${periodo}. Regularización sujeta a disposiciones académicas institucionales.`
        : 'El alumno acreditó todas las materias del periodo.'}
    </div>
  </div>

  <div class="firma-grid">
    <div class="firma-box">Jefe de Departamento</div>
    <div class="firma-box">Director(a) Académico(a)</div>
    <div class="firma-box">Coordinador(a) de Carrera</div>
  </div>

  <div class="nota">
    <strong>Nota:</strong> La boleta es un documento oficial de calificaciones del Tecnológico de Estudios Superiores de Ixtapaluca.
    Las calificaciones aquí registradas son definitivas y forman parte del expediente académico del alumno.
  </div>

  <div class="footer">
    <p>SIVACAD-ISC v3.0 — Sistema de Gestión Académica — Documento generado el ${fecha}</p>
    <p>Este documento es de uso exclusivo del alumno y la institución. Cualquier alteración es nula de pleno derecho.</p>
  </div>
</body></html>`;
}

function materiasConPeriodo(periodos) {
  return periodos;
}

module.exports = { generarBoletaHTML };
