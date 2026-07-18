'use strict';

const pool = require('../config/db');

function nombreCompleto(row) {
  const parts = [row.apellido_paterno || '', row.apellido_materno || '', row.nombres || row.nombre || ''];
  return parts.filter(Boolean).join(' ').trim();
}

async function getAlumnosByGroup(grupoNombre) {
  const sql = `
    SELECT a.id_alumno, a.apellido_paterno, a.apellido_materno, a.nombres, a.matricula,
           g.nombre_grupo, g.semestre
    FROM grupos_alumnos ga
    JOIN alumnos a ON ga.id_alumno = a.id_alumno
    JOIN grupos g ON ga.id_grupo = g.id_grupo
    WHERE g.nombre_grupo LIKE ? AND g.estado = 'Abierto'
    ORDER BY a.apellido_paterno, a.apellido_materno, a.nombres`;
  const [rows] = await pool.execute(sql, [`%${grupoNombre}%`]);
  return rows;
}

async function getAusenciasJustificadasConNotificacion(periodoId) {
  let sql = `
    SELECT a.id_alumno, a.apellido_paterno, a.apellido_materno, a.nombres, a.matricula,
           da.fecha, da.motivo_ausencia, da.justificante, g.nombre_grupo
    FROM docente_asistencias da
    JOIN alumnos a ON da.id_alumno = a.id_alumno
    JOIN grupos g ON da.id_grupo = g.id_grupo
    WHERE da.asistio = 0 AND da.notifico_coordinador = 1
      AND da.justificante IS NOT NULL`;
  const params = [];
  if (periodoId) { sql += ' AND da.id_periodo = ?'; params.push(periodoId); }
  sql += ' ORDER BY da.fecha DESC, a.apellido_paterno, a.apellido_materno, a.nombres';
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function getEmbarazosByGroup() {
  const sql = `
    SELECT a.id_alumno, a.apellido_paterno, a.apellido_materno, a.nombres, a.matricula,
           g.nombre_grupo, g.semestre, dse.observaciones, dse.fecha_registro
    FROM docente_salud_estudiantil dse
    JOIN alumnos a ON dse.id_alumno = a.id_alumno
    JOIN grupos_alumnos ga ON a.id_alumno = ga.id_alumno
    JOIN grupos g ON ga.id_grupo = g.id_grupo
    WHERE dse.tipo = 'EMBARAZO' AND dse.confidencial = 0
    ORDER BY g.nombre_grupo, a.apellido_paterno, a.apellido_materno, a.nombres`;
  const [rows] = await pool.execute(sql);
  return rows;
}

async function getRiesgoDesercion() {
  const sql = `
    SELECT a.id_alumno, a.apellido_paterno, a.apellido_materno, a.nombres, a.matricula,
           iad.nivel_riesgo, iad.puntaje_riesgo, iad.factores_json AS factores_detectados, iad.revisado_en AS fecha_deteccion,
           g.nombre_grupo
    FROM ia_alertas_desercion iad
    JOIN alumnos a ON iad.id_alumno = a.id_alumno
    JOIN grupos_alumnos ga ON a.id_alumno = ga.id_alumno
    JOIN grupos g ON ga.id_grupo = g.id_grupo
    WHERE iad.estado_seguimiento IN ('Pendiente','En_revision')
    ORDER BY iad.nivel_riesgo DESC, a.apellido_paterno, a.apellido_materno, a.nombres`;
  const [rows] = await pool.execute(sql);
  return rows;
}

async function getInscritosActividad(tipo) {
  const tiposValidos = ['HACKATON', 'INNOVATECNM', 'TESICHALLENGE'];
  const t = tipo.toUpperCase();
  if (!tiposValidos.includes(t)) return [];
  const sql = `
    SELECT a.id_alumno, a.apellido_paterno, a.apellido_materno, a.nombres, a.matricula,
           dae.actividad, dae.fecha_inscripcion, dae.estatus
    FROM docente_actividades_extracurriculares dae
    JOIN alumnos a ON dae.id_alumno = a.id_alumno
    WHERE dae.tipo = ? AND dae.estatus IN ('INSCRITO','PARTICIPANDO')
    ORDER BY a.apellido_paterno, a.apellido_materno, a.nombres`;
  const [rows] = await pool.execute(sql, [t]);
  return rows;
}

async function getInscritosBecas() {
  const sql = `
    SELECT a.id_alumno, a.apellido_paterno, a.apellido_materno, a.nombres, a.matricula,
           ibs.id_solicitud, ibs.estatus_solicitud
    FROM ia_becas_solicitudes ibs
    JOIN alumnos a ON ibs.id_alumno = a.id_alumno
    WHERE ibs.estatus_solicitud IN ('REGISTRADA','EN_REVISION','APROBADA')
    ORDER BY a.apellido_paterno, a.apellido_materno, a.nombres`;
  const [rows] = await pool.execute(sql);
  return rows;
}

async function getServicioSocialConvenios() {
  const sql = `
    SELECT a.id_alumno, a.apellido_paterno, a.apellido_materno, a.nombres, a.matricula,
           dss.empresa, dss.programa, dss.horas_totales, dss.horas_cumplidas, dss.estatus,
           dce.nombre_empresa AS empresa_convenio
    FROM docente_servicio_social dss
    JOIN alumnos a ON dss.id_alumno = a.id_alumno
    LEFT JOIN docente_convenios_empresariales dce ON dss.id_convenio = dce.id_convenio AND dce.estatus = 'VIGENTE'
    WHERE dce.id_convenio IS NOT NULL
    ORDER BY a.apellido_paterno, a.apellido_materno, a.nombres`;
  const [rows] = await pool.execute(sql);
  return rows;
}

async function getResidenciasConvenios() {
  const sql = `
    SELECT a.id_alumno, a.apellido_paterno, a.apellido_materno, a.nombres, a.matricula,
           drp.empresa, drp.proyecto, drp.estatus,
           dce.nombre_empresa AS empresa_convenio
    FROM docente_residencia_profesional drp
    JOIN alumnos a ON drp.id_alumno = a.id_alumno
    LEFT JOIN docente_convenios_empresariales dce ON drp.id_convenio = dce.id_convenio AND dce.estatus = 'VIGENTE'
    WHERE dce.id_convenio IS NOT NULL
    ORDER BY a.apellido_paterno, a.apellido_materno, a.nombres`;
  const [rows] = await pool.execute(sql);
  return rows;
}

async function getCreditosCompletos() {
  const sql = `
    SELECT a.id_alumno, a.apellido_paterno, a.apellido_materno, a.nombres, a.matricula,
           SUM(CASE WHEN dcc.tipo = 'ACADEMICO' AND dcc.estatus = 'CUBIERTO' THEN 1 ELSE 0 END) AS academicos_cubiertos,
           SUM(CASE WHEN dcc.tipo = 'CULTURAL' AND dcc.estatus = 'CUBIERTO' THEN 1 ELSE 0 END) AS culturales_cubiertos,
           SUM(CASE WHEN dcc.tipo = 'DEPORTIVO' AND dcc.estatus = 'CUBIERTO' THEN 1 ELSE 0 END) AS deportivos_cubiertos
    FROM alumnos a
    LEFT JOIN docente_creditos_complementarios dcc ON a.id_alumno = dcc.id_alumno AND dcc.estatus = 'CUBIERTO'
    GROUP BY a.id_alumno, a.apellido_paterno, a.apellido_materno, a.nombres, a.matricula
    HAVING academicos_cubiertos > 0 AND culturales_cubiertos > 0 AND deportivos_cubiertos > 0
    ORDER BY a.apellido_paterno, a.apellido_materno, a.nombres`;
  const [rows] = await pool.execute(sql);
  return rows;
}

async function getSegundasOportunidades() {
  const sql = `
    SELECT a.id_alumno, a.apellido_paterno, a.apellido_materno, a.nombres, a.matricula,
           dso.tipo, dso.calificacion_anterior, dso.calificacion_actual, m.nombre_materia,
           dso.estatus AS estatus_materia
    FROM docente_segundas_oportunidades dso
    JOIN alumnos a ON dso.id_alumno = a.id_alumno
    JOIN materias m ON dso.id_materia = m.id_materia
    WHERE dso.estatus IN ('PENDIENTE','EN_CURSO','REPROBADO')
    ORDER BY a.apellido_paterno, a.apellido_materno, a.nombres`;
  const [rows] = await pool.execute(sql);
  return rows;
}

async function getAptosTitulacionPorModalidad(modalidad) {
  const modalidadesValidas = ['PROMEDIO', 'MEMORIA_RESIDENCIA', 'TESIS', 'PROYECTO_INVESTIGACION', 'CENEVAL'];
  const m = modalidad.toUpperCase();
  if (!modalidadesValidas.includes(m)) return [];
  const sql = `
    SELECT a.id_alumno, a.apellido_paterno, a.apellido_materno, a.nombres, a.matricula,
           dt.promedio_general, dt.observaciones, dt.fecha_dictamen,
            p.nombre_periodo AS periodo_nombre
    FROM docente_titulacion dt
    JOIN alumnos a ON dt.id_alumno = a.id_alumno
    JOIN periodos p ON dt.id_periodo = p.id_periodo
    WHERE dt.modalidad = ? AND dt.estatus = 'APTO'
    ORDER BY a.apellido_paterno, a.apellido_materno, a.nombres`;
  const [rows] = await pool.execute(sql, [m]);
  return rows;
}

async function getAptosBecaExtranjero() {
  const sql = `
    SELECT a.id_alumno, a.apellido_paterno, a.apellido_materno, a.nombres, a.matricula,
           dbe.pais, dbe.universidad, dbe.programa, dbe.niveles_ingles, dbe.promedio_minimo,
           die.nivel AS nivel_ingles, die.niveles_completados
    FROM docente_beca_extranjero dbe
    JOIN alumnos a ON dbe.id_alumno = a.id_alumno
    LEFT JOIN docente_idiomas die ON a.id_alumno = die.id_alumno AND die.idioma = 'INGLES'
    WHERE dbe.estatus = 'APTO' AND die.niveles_completados >= 5
    ORDER BY a.apellido_paterno, a.apellido_materno, a.nombres`;
  const [rows] = await pool.execute(sql);
  return rows;
}

async function getKardexResumen(idDocente) {
  const sql = `
    SELECT DISTINCT a.id_alumno, a.apellido_paterno, a.apellido_materno, a.nombres, a.matricula,
           ka.promedio_general, ka.creditos_acumulados, ka.estatus,
           g.nombre_grupo
    FROM kardex_alumno ka
    JOIN alumnos a ON ka.id_alumno = a.id_alumno
    JOIN grupos_alumnos ga ON a.id_alumno = ga.id_alumno AND ga.id_periodo = (SELECT id_periodo FROM periodos WHERE estado = 'Activo' LIMIT 1)
    JOIN grupos g ON ga.id_grupo = g.id_grupo
    JOIN cargas_academicas ca ON g.id_grupo = ca.id_grupo AND ca.id_periodo = (SELECT id_periodo FROM periodos WHERE estado = 'Activo' LIMIT 1)
    WHERE ca.id_docente = ? AND ca.estado = 'ACTIVA'
    ORDER BY g.nombre_grupo, a.apellido_paterno, a.apellido_materno, a.nombres`;
  const [rows] = await pool.execute(sql, [idDocente]);
  return rows;
}

async function detectarTipoConsulta(texto) {
  const t = String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  if (t.includes('cuantos alumnos') && (t.includes('grupo') || t.includes('1101') || t.includes('1102'))) {
    const match = t.match(/grupo\s*(\w+)/);
    return { tipo: 'ALUMNOS_GRUPO', grupo: match ? match[1] : null };
  }
  if ((t.includes('falto') || t.includes('ausencia') || t.includes('falt')) && (t.includes('notifico') || t.includes('justific') || t.includes('coordinador'))) {
    return { tipo: 'AUSENCIAS_JUSTIFICADAS' };
  }
  if (t.includes('embaraz') || t.includes('embarazo')) {
    return { tipo: 'EMBARAZOS' };
  }
  if (t.includes('riesgo') && (t.includes('desercion') || t.includes('deserción'))) {
    return { tipo: 'RIESGO_DESERCION' };
  }
  if (t.includes('inscribieron') || t.includes('inscritos')) {
    if (t.includes('hackaton') || t.includes('hackathon')) return { tipo: 'INSCRITOS_ACTIVIDAD', actividad: 'HACKATON' };
    if (t.includes('innovatecnm') || t.includes('innova')) return { tipo: 'INSCRITOS_ACTIVIDAD', actividad: 'INNOVATECNM' };
    if (t.includes('tesichallenge') || t.includes('tesi challenge')) return { tipo: 'INSCRITOS_ACTIVIDAD', actividad: 'TESICHALLENGE' };
    if (t.includes('beca') || t.includes('becas')) return { tipo: 'INSCRITOS_BECAS' };
  }
  if (t.includes('servicio social') && (t.includes('convenio') || t.includes('empresa'))) {
    return { tipo: 'SERVICIO_SOCIAL_CONVENIOS' };
  }
  if ((t.includes('residencia') || t.includes('residencias')) && (t.includes('convenio') || t.includes('empresa'))) {
    return { tipo: 'RESIDENCIAS_CONVENIOS' };
  }
  if (t.includes('credito') && (t.includes('completo') || t.includes('cubierto') || t.includes('academico') || t.includes('cultural') || t.includes('deportivo'))) {
    return { tipo: 'CREDITOS_COMPLETOS' };
  }
  if (t.includes('segunda') || t.includes('2das') || t.includes('2da') || t.includes('materia especial') || t.includes('recurse') || t.includes('recurses')) {
    return { tipo: 'SEGUNDAS_OPORTUNIDADES' };
  }
  if (t.includes('apto') || t.includes('titular') || t.includes('titulacion') || t.includes('titulacion')) {
    if (t.includes('promedio')) return { tipo: 'APTOS_TITULACION', modalidad: 'PROMEDIO' };
    if (t.includes('memoria') || t.includes('residencia')) return { tipo: 'APTOS_TITULACION', modalidad: 'MEMORIA_RESIDENCIA' };
    if (t.includes('ceneval')) return { tipo: 'APTOS_TITULACION', modalidad: 'CENEVAL' };
    if (t.includes('tesis')) return { tipo: 'APTOS_TITULACION', modalidad: 'TESIS' };
    if (t.includes('proyecto') || t.includes('investigacion')) return { tipo: 'APTOS_TITULACION', modalidad: 'PROYECTO_INVESTIGACION' };
    return { tipo: 'APTOS_TITULACION', modalidad: null };
  }
  if (t.includes('beca') && (t.includes('extranjero') || t.includes('extranjero') || t.includes('ingles') || t.includes('idioma'))) {
    return { tipo: 'APTOS_BECA_EXTRANJERO' };
  }
  if (t.includes('kardex') || t.includes('promedio') || t.includes('calificacion')) {
    return { tipo: 'KARDEX' };
  }

  return { tipo: 'GENERAL' };
}

async function ejecutarConsulta(tipoConsulta, params, idDocente, periodoActivo) {
  switch (tipoConsulta.tipo) {
    case 'ALUMNOS_GRUPO': {
      const grupo = tipoConsulta.grupo || '1101';
      const rows = await getAlumnosByGroup(grupo);
      const nombres = rows.map(r => `  - ${nombreCompleto(r)} (${r.matricula})`).join('\n');
      return {
        respuesta: rows.length === 0
          ? `No se encontraron alumnos en el grupo ${grupo}.`
          : `Hay ${rows.length} alumno(s) en el grupo ${grupo}:\n${nombres}`,
        count: rows.length,
        tipo: 'ALUMNOS_GRUPO'
      };
    }
    case 'AUSENCIAS_JUSTIFICADAS': {
      const rows = await getAusenciasJustificadasConNotificacion(periodoActivo);
      const detalles = rows.map(r => `  - ${nombreCompleto(r)} - Grupo ${r.nombre_grupo} - ${r.fecha}: ${r.motivo_ausencia || 'Sin motivo'}`).join('\n');
      return {
        respuesta: rows.length === 0
          ? 'No hay ausencias justificadas con notificacion al coordinador en el periodo actual.'
          : `Se encontraron ${rows.length} ausencia(s) justificada(s) con notificacion:\n${detalles}`,
        count: rows.length,
        tipo: 'AUSENCIAS_JUSTIFICADAS'
      };
    }
    case 'EMBARAZOS': {
      const rows = await getEmbarazosByGroup();
      const agrupados = {};
      rows.forEach(r => {
        const g = r.nombre_grupo;
        if (!agrupados[g]) agrupados[g] = [];
        agrupados[g].push(r);
      });
      let respuesta = Object.keys(agrupados).length === 0
        ? 'No hay registros de embarazos en el sistema.'
        : 'Alumnas embarazadas por grupo:\n';
      Object.entries(agrupados).forEach(([grupo, alumnas]) => {
        respuesta += `\nGrupo ${grupo} (${alumnas.length}):\n`;
        alumnas.forEach(a => { respuesta += `  - ${nombreCompleto(a)}\n`; });
      });
      return { respuesta, count: rows.length, tipo: 'EMBARAZOS' };
    }
    case 'RIESGO_DESERCION': {
      const rows = await getRiesgoDesercion();
      const detalles = rows.map(r =>
        `  - ${nombreCompleto(r)} (${r.matricula}) - Grupo ${r.nombre_grupo} - Riesgo: ${r.nivel_riesgo} (${r.puntaje_riesgo}%) - Factores: ${r.factores_detectados || 'No especificados'}`
      ).join('\n');
      return {
        respuesta: rows.length === 0
          ? 'No hay alumnos con riesgo de desercion activo en este momento.'
          : `Se detectaron ${rows.length} alumno(s) con riesgo de desercion:\n${detalles}`,
        count: rows.length,
        tipo: 'RIESGO_DESERCION'
      };
    }
    case 'INSCRITOS_ACTIVIDAD': {
      const actividad = tipoConsulta.actividad || 'HACKATON';
      const rows = await getInscritosActividad(actividad);
      const nombres = rows.map(r => `  - ${nombreCompleto(r)} (${r.matricula})`).join('\n');
      return {
        respuesta: rows.length === 0
          ? `No hay alumnos inscritos en ${actividad}.`
          : `Hay ${rows.length} alumno(s) inscritos en ${actividad}:\n${nombres}`,
        count: rows.length,
        tipo: 'INSCRITOS_ACTIVIDAD'
      };
    }
    case 'INSCRITOS_BECAS': {
      const rows = await getInscritosBecas();
      const detalles = rows.map(r =>
        `  - ${nombreCompleto(r)} (${r.matricula}) - Solicitud #${r.id_solicitud} (${r.estatus_solicitud})`
      ).join('\n');
      return {
        respuesta: rows.length === 0
          ? 'No hay alumnos inscritos en programas de becas.'
          : `Hay ${rows.length} alumno(s) inscritos en programas de becas:\n${detalles}`,
        count: rows.length,
        tipo: 'INSCRITOS_BECAS'
      };
    }
    case 'SERVICIO_SOCIAL_CONVENIOS': {
      const rows = await getServicioSocialConvenios();
      const detalles = rows.map(r =>
        `  - ${nombreCompleto(r)} (${r.matricula}) - Empresa: ${r.empresa_convenio || r.empresa} - Horas: ${r.horas_cumplidas}/${r.horas_totales}`
      ).join('\n');
      return {
        respuesta: rows.length === 0
          ? 'No hay alumnos realizando servicio social en empresas con convenio TESI.'
          : `Hay ${rows.length} alumno(s) en servicio social con convenio:\n${detalles}`,
        count: rows.length,
        tipo: 'SERVICIO_SOCIAL_CONVENIOS'
      };
    }
    case 'RESIDENCIAS_CONVENIOS': {
      const rows = await getResidenciasConvenios();
      const detalles = rows.map(r =>
        `  - ${nombreCompleto(r)} (${r.matricula}) - Empresa: ${r.empresa_convenio || r.empresa} - Proyecto: ${r.proyecto || 'No especificado'}`
      ).join('\n');
      return {
        respuesta: rows.length === 0
          ? 'No hay alumnos realizando residencias profesionales en empresas con convenio TESI.'
          : `Hay ${rows.length} alumno(s) en residencias profesionales con convenio:\n${detalles}`,
        count: rows.length,
        tipo: 'RESIDENCIAS_CONVENIOS'
      };
    }
    case 'CREDITOS_COMPLETOS': {
      const rows = await getCreditosCompletos();
      const nombres = rows.map(r => `  - ${nombreCompleto(r)} (${r.matricula}) - Academicos: ${r.academicos_cubiertos}, Culturales: ${r.culturales_cubiertos}, Deportivos: ${r.deportivos_cubiertos}`).join('\n');
      return {
        respuesta: rows.length === 0
          ? 'No hay alumnos con creditos academicos, culturales y deportivos completos.'
          : `Hay ${rows.length} alumno(s) con creditos completos:\n${nombres}`,
        count: rows.length,
        tipo: 'CREDITOS_COMPLETOS'
      };
    }
    case 'SEGUNDAS_OPORTUNIDADES': {
      const rows = await getSegundasOportunidades();
      const detalles = rows.map(r =>
        `  - ${nombreCompleto(r)} (${r.matricula}) - ${r.nombre_materia} - ${r.tipo} - Calif anterior: ${r.calificacion_anterior || 'N/A'} - Estado: ${r.estatus_materia}`
      ).join('\n');
      return {
        respuesta: rows.length === 0
          ? 'No hay alumnos con segundas oportunidades, materias especiales o recurses pendientes.'
          : `Hay ${rows.length} alumno(s) con segundas oportunidades/materias especiales/recurses:\n${detalles}`,
        count: rows.length,
        tipo: 'SEGUNDAS_OPORTUNIDADES'
      };
    }
    case 'APTOS_TITULACION': {
      if (!tipoConsulta.modalidad) {
        const modalidades = ['PROMEDIO', 'MEMORIA_RESIDENCIA', 'TESIS', 'PROYECTO_INVESTIGACION', 'CENEVAL'];
        let respuesta = 'Alumnos aptos para titulacion:\n';
        let total = 0;
        for (const mod of modalidades) {
          const rows = await getAptosTitulacionPorModalidad(mod);
          total += rows.length;
          respuesta += `\n${mod} (${rows.length}):\n`;
          rows.forEach(r => { respuesta += `  - ${nombreCompleto(r)} (${r.matricula}) - Prom: ${r.promedio_general || 'N/A'}\n`; });
        }
        if (total === 0) respuesta = 'No hay alumnos aptos para titulacion en ninguna modalidad.';
        return { respuesta, count: total, tipo: 'APTOS_TITULACION' };
      }
      const rows = await getAptosTitulacionPorModalidad(tipoConsulta.modalidad);
      const nombres = rows.map(r => `  - ${nombreCompleto(r)} (${r.matricula}) - Prom: ${r.promedio_general || 'N/A'}`).join('\n');
      return {
        respuesta: rows.length === 0
          ? `No hay alumnos aptos para titulacion por ${tipoConsulta.modalidad}.`
          : `Hay ${rows.length} alumno(s) aptos para titulacion por ${tipoConsulta.modalidad}:\n${nombres}`,
        count: rows.length,
        tipo: 'APTOS_TITULACION'
      };
    }
    case 'APTOS_BECA_EXTRANJERO': {
      const rows = await getAptosBecaExtranjero();
      const detalles = rows.map(r =>
        `  - ${nombreCompleto(r)} (${r.matricula}) - Ingles: ${r.niveles_ingles || r.niveles_completados || 0} niveles - Promedio: ${r.promedio_minimo} - Pais: ${r.pais || 'No especificado'}`
      ).join('\n');
      return {
        respuesta: rows.length === 0
          ? 'No hay alumnos aptos para beca al extranjero (requisitos: 5 niveles de ingles y promedio minimo 8.0).'
          : `Hay ${rows.length} alumno(s) aptos para beca al extranjero:\n${detalles}`,
        count: rows.length,
        tipo: 'APTOS_BECA_EXTRANJERO'
      };
    }
    case 'KARDEX': {
      if (!idDocente) return { respuesta: 'No se pudo identificar al docente.', count: 0, tipo: 'KARDEX' };
      const rows = await getKardexResumen(idDocente);
      const detalles = rows.map(r =>
        `  - ${nombreCompleto(r)} (${r.matricula}) - Grupo ${r.nombre_grupo} - Promedio: ${r.promedio_general} - Creditos: ${r.creditos_acumulados} - Estatus: ${r.estatus}`
      ).join('\n');
      return {
        respuesta: rows.length === 0
          ? 'No se encontraron alumnos vinculados a sus grupos.'
          : `Resumen de kardex de sus grupos (${rows.length} alumno(s)):\n${detalles}`,
        count: rows.length,
        tipo: 'KARDEX'
      };
    }
    default:
      return null;
  }
}

async function logQuery(idDocente, pregunta, respuesta, tipoConsulta) {
  if (!idDocente) return;
  try {
    await pool.execute(
      `INSERT INTO docente_query_log (id_docente, pregunta, respuesta, tipo_consulta) VALUES (?, ?, ?, ?)`,
      [idDocente, pregunta.substring(0, 500), (respuesta || '').substring(0, 2000), tipoConsulta]
    );
  } catch (err) {
    console.error('Error logging docente query:', err.message);
  }
}

async function getPeriodoActivo() {
  try {
    const [rows] = await pool.execute("SELECT id_periodo FROM periodos WHERE estado = 'Activo' LIMIT 1");
    return rows.length > 0 ? rows[0].id_periodo : null;
  } catch { return null; }
}

module.exports = {
  detectarTipoConsulta,
  ejecutarConsulta,
  logQuery,
  getPeriodoActivo,
  getAlumnosByGroup,
  getAusenciasJustificadasConNotificacion,
  getEmbarazosByGroup,
  getRiesgoDesercion,
  getInscritosActividad,
  getInscritosBecas,
  getServicioSocialConvenios,
  getResidenciasConvenios,
  getCreditosCompletos,
  getSegundasOportunidades,
  getAptosTitulacionPorModalidad,
  getAptosBecaExtranjero,
  getKardexResumen
};
