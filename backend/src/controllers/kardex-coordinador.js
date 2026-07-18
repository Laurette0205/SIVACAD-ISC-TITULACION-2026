'use strict';

const pool = require('../config/db');

// ──────────────────────────────────────────────
// CATÁLOGOS (periodos, carreras, grupos)
// ──────────────────────────────────────────────
async function getCatalogosKardex(req, res) {
  try {
    const [periodos] = await pool.query(
      'SELECT id_periodo, nombre_periodo FROM periodos ORDER BY fecha_inicio DESC'
    );
    const [carreras] = await pool.query(
      'SELECT id_carrera, nombre_carrera FROM carreras ORDER BY nombre_carrera'
    );
    const [grupos] = await pool.query(`
      SELECT g.id_grupo, g.nombre_grupo, g.semestre, g.turno,
             p.nombre_periodo, c.nombre_carrera
      FROM grupos g
      JOIN periodos p ON p.id_periodo = g.id_periodo
      JOIN carreras c ON c.id_carrera = g.id_carrera
      ORDER BY p.fecha_inicio DESC, c.nombre_carrera, g.nombre_grupo
    `);

    res.json({ ok: true, data: { periodos, carreras, grupos } });
  } catch (error) {
    console.error('Error en getCatalogosKardex:', error);
    res.status(500).json({ ok: false, message: 'Error al cargar catálogos' });
  }
}

// ──────────────────────────────────────────────
// KARDEX POR GRUPO
// ──────────────────────────────────────────────
async function getKardexGrupo(req, res) {
  try {
    const { idGrupo } = req.params;

    const [grupo] = await pool.query(`
      SELECT g.*, p.nombre_periodo, c.nombre_carrera
      FROM grupos g
      JOIN periodos p ON p.id_periodo = g.id_periodo
      JOIN carreras c ON c.id_carrera = g.id_carrera
      WHERE g.id_grupo = ?
    `, [idGrupo]);

    if (grupo.length === 0) {
      return res.status(404).json({ ok: false, message: 'Grupo no encontrado' });
    }

    const [alumnos] = await pool.query(`
      SELECT
        a.id_alumno,
        CONCAT(a.apellido_paterno, ' ', a.apellido_materno, ' ', a.nombres) AS nombre_completo,
        a.matricula,
        a.semestre_actual,
        a.estatus_academico,
        COALESCE(k.promedio_general, 0) AS promedio_general,
        COALESCE(k.creditos_acumulados, 0) AS creditos_acumulados,
        k.estatus AS estatus_kardex,
        k.folio_kardex,
        k.url_qr,
        (SELECT COUNT(*) FROM kardex_historial_academico h
         WHERE h.id_alumno = a.id_alumno AND h.estado = 'No Acreditada') AS materias_reprobadas,
        (SELECT COUNT(*) FROM kardex_historial_academico h
         WHERE h.id_alumno = a.id_alumno AND h.tipo_materia = 'Extraordinario') AS extraordinarios
      FROM grupos_alumnos ga
      JOIN alumnos a ON a.id_alumno = ga.id_alumno
      LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
      WHERE ga.id_grupo = ? AND ga.estado = 'ACTIVO'
      ORDER BY a.apellido_paterno, a.apellido_materno
    `, [idGrupo]);

    const total = alumnos.length;
    const conRezago = alumnos.filter(a =>
      a.promedio_general < 70 || a.materias_reprobadas > 2
    ).length;
    const promedioGrupo = total > 0
      ? alumnos.reduce((s, a) => s + (parseFloat(a.promedio_general) || 0), 0) / total
      : 0;

    res.json({
      ok: true,
      data: {
        grupo: grupo[0],
        alumnos,
        estadisticas: { total, conRezago, promedioGrupo: Math.round(promedioGrupo * 100) / 100 }
      }
    });
  } catch (error) {
    console.error('Error en getKardexGrupo:', error);
    res.status(500).json({ ok: false, message: 'Error al consultar kardex del grupo' });
  }
}

// ──────────────────────────────────────────────
// KARDEX POR ALUMNO (detalle con análisis)
// ──────────────────────────────────────────────
async function getKardexAlumnoDetalle(req, res) {
  try {
    const { idAlumno } = req.params;

    const [alumno] = await pool.query(`
      SELECT
        a.*,
        c.nombre_carrera,
        COALESCE(k.promedio_general, 0) AS promedio_general,
        COALESCE(k.creditos_acumulados, 0) AS creditos_acumulados,
        k.estatus AS estatus_kardex,
        k.folio_kardex,
        k.firma_electronica,
        k.foto_institucional,
        k.url_qr,
        k.numero_control
      FROM alumnos a
      JOIN carreras c ON c.id_carrera = a.id_carrera
      LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
      WHERE a.id_alumno = ?
    `, [idAlumno]);

    if (alumno.length === 0) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    const [historial] = await pool.query(`
      SELECT
        h.*,
        p.nombre_periodo,
        m.clave_materia,
        m.nombre_materia,
        m.creditos AS creditos_materia,
        g.nombre_grupo
      FROM kardex_historial_academico h
      LEFT JOIN periodos p ON p.id_periodo = h.id_periodo
      LEFT JOIN materias m ON m.id_materia = h.id_materia
      LEFT JOIN grupos g ON g.id_grupo = h.id_grupo
      WHERE h.id_alumno = ?
      ORDER BY p.fecha_inicio DESC, m.semestre_sugerido
    `, [idAlumno]);

    const totalMaterias = historial.length;
    const acreditadas = historial.filter(h => h.estado === 'Acreditada').length;
    const noAcreditadas = historial.filter(h => h.estado === 'No Acreditada').length;
    const cursando = historial.filter(h => h.estado === 'Cursando').length;
    const extraordinarios = historial.filter(h => h.tipo_materia === 'Extraordinario').length;

    const creditosTotales = historial.reduce((s, h) => s + (parseFloat(h.creditos) || 0), 0);
    const creditosAcreditados = historial
      .filter(h => h.estado === 'Acreditada')
      .reduce((s, h) => s + (parseFloat(h.creditos) || 0), 0);

    const promedio = alumno[0].promedio_general;
    const rezagoDetectado = promedio < 70 || noAcreditadas > 2 || extraordinarios > 1;
    const irregularidades = [];
    if (promedio < 60) irregularidades.push('Promedio crítico menor a 60');
    if (noAcreditadas > 3) irregularidades.push(`Exceso de materias no acreditadas (${noAcreditadas})`);
    if (extraordinarios > 2) irregularidades.push(`Múltiples extraordinarios (${extraordinarios})`);
    if (alumno[0].semestre_actual >= 5 && creditosAcreditados < 150)
      irregularidades.push('Avance insuficiente para el semestre actual');

    res.json({
      ok: true,
      data: {
        alumno: alumno[0],
        historial,
        analisis: {
          totalMaterias, acreditadas, noAcreditadas, cursando, extraordinarios,
          creditosTotales, creditosAcreditados,
          avanceCreditos: creditosTotales > 0
            ? Math.round((creditosAcreditados / creditosTotales) * 100) : 0,
          rezagoDetectado,
          irregularidades
        }
      }
    });
  } catch (error) {
    console.error('Error en getKardexAlumnoDetalle:', error);
    res.status(500).json({ ok: false, message: 'Error al consultar kardex del alumno' });
  }
}

// ──────────────────────────────────────────────
// RESUMEN POR PERIODO
// ──────────────────────────────────────────────
async function getResumenPorPeriodo(req, res) {
  try {
    const { idPeriodo } = req.params;

    const [periodo] = await pool.query(
      'SELECT * FROM periodos WHERE id_periodo = ?', [idPeriodo]
    );
    if (periodo.length === 0) {
      return res.status(404).json({ ok: false, message: 'Periodo no encontrado' });
    }

    const [resumen] = await pool.query(`
      SELECT
        COUNT(DISTINCT a.id_alumno) AS total_alumnos,
        ROUND(AVG(COALESCE(k.promedio_general, 0)), 2) AS promedio_general,
        SUM(COALESCE(k.creditos_acumulados, 0)) AS creditos_totales,
        ROUND(AVG(COALESCE(k.creditos_acumulados, 0)), 1) AS promedio_creditos,
        SUM(CASE WHEN a.estatus_academico = 'Regular' THEN 1 ELSE 0 END) AS regulares,
        SUM(CASE WHEN a.estatus_academico = 'Irregular' THEN 1 ELSE 0 END) AS irregulares,
        SUM(CASE WHEN COALESCE(k.promedio_general, 0) < 70 THEN 1 ELSE 0 END) AS rezago,
        SUM(CASE WHEN COALESCE(k.promedio_general, 0) >= 90 THEN 1 ELSE 0 END) AS excelencia
      FROM alumnos a
      LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
      JOIN grupos_alumnos ga ON ga.id_alumno = a.id_alumno AND ga.id_periodo = ? AND ga.estado = 'ACTIVO'
    `, [idPeriodo, idPeriodo]);

    const [porCarrera] = await pool.query(`
      SELECT
        c.id_carrera,
        c.nombre_carrera,
        COUNT(DISTINCT a.id_alumno) AS total_alumnos,
        ROUND(AVG(COALESCE(k.promedio_general, 0)), 2) AS promedio,
        SUM(CASE WHEN COALESCE(k.promedio_general, 0) < 70 THEN 1 ELSE 0 END) AS rezago
      FROM alumnos a
      JOIN carreras c ON c.id_carrera = a.id_carrera
      LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
      JOIN grupos_alumnos ga ON ga.id_alumno = a.id_alumno AND ga.id_periodo = ? AND ga.estado = 'ACTIVO'
      GROUP BY c.id_carrera, c.nombre_carrera
      ORDER BY c.nombre_carrera
    `, [idPeriodo]);

    res.json({
      ok: true,
      data: {
        periodo: periodo[0],
        resumen: resumen[0],
        porCarrera
      }
    });
  } catch (error) {
    console.error('Error en getResumenPorPeriodo:', error);
    res.status(500).json({ ok: false, message: 'Error al obtener resumen por periodo' });
  }
}

// ──────────────────────────────────────────────
// HISTORIAL POR CARRERA
// ──────────────────────────────────────────────
async function getHistorialPorCarrera(req, res) {
  try {
    const { idCarrera } = req.params;

    const [carrera] = await pool.query(
      'SELECT * FROM carreras WHERE id_carrera = ?', [idCarrera]
    );
    if (carrera.length === 0) {
      return res.status(404).json({ ok: false, message: 'Carrera no encontrada' });
    }

    const [porPeriodo] = await pool.query(`
      SELECT
        p.id_periodo,
        p.nombre_periodo,
        COUNT(DISTINCT a.id_alumno) AS alumnos_activos,
        ROUND(AVG(COALESCE(k.promedio_general, 0)), 2) AS promedio_carrera,
        SUM(CASE WHEN COALESCE(k.promedio_general, 0) < 70 THEN 1 ELSE 0 END) AS rezago,
        SUM(CASE WHEN COALESCE(k.promedio_general, 0) >= 90 THEN 1 ELSE 0 END) AS excelencia,
        ROUND(AVG(COALESCE(k.creditos_acumulados, 0)), 1) AS promedio_creditos,
        SUM(COALESCE(k.creditos_acumulados, 0)) AS creditos_totales
      FROM periodos p
      JOIN grupos g ON g.id_periodo = p.id_periodo AND g.id_carrera = ?
      LEFT JOIN grupos_alumnos ga ON ga.id_grupo = g.id_grupo AND ga.estado = 'ACTIVO'
      LEFT JOIN alumnos a ON a.id_alumno = ga.id_alumno
      LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
      GROUP BY p.id_periodo, p.nombre_periodo
      ORDER BY p.fecha_inicio DESC
    `, [idCarrera]);

    const [tendenciaSemestral] = await pool.query(`
      SELECT
        a.semestre_actual,
        COUNT(*) AS total_alumnos,
        ROUND(AVG(COALESCE(k.promedio_general, 0)), 2) AS promedio_semestre,
        SUM(CASE WHEN COALESCE(k.promedio_general, 0) < 70 THEN 1 ELSE 0 END) AS rezago
      FROM alumnos a
      LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
      JOIN grupos_alumnos ga ON ga.id_alumno = a.id_alumno AND ga.estado = 'ACTIVO'
      WHERE a.id_carrera = ?
      GROUP BY a.semestre_actual
      ORDER BY a.semestre_actual
    `, [idCarrera]);

    const [alumnosRezago] = await pool.query(`
      SELECT
        a.id_alumno,
        CONCAT(a.apellido_paterno, ' ', a.apellido_materno, ' ', a.nombres) AS nombre_completo,
        a.matricula,
        a.semestre_actual,
        COALESCE(k.promedio_general, 0) AS promedio_general,
        (SELECT COUNT(*) FROM kardex_historial_academico h
         WHERE h.id_alumno = a.id_alumno AND h.estado = 'No Acreditada') AS materias_reprobadas
      FROM alumnos a
      LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
      JOIN grupos_alumnos ga ON ga.id_alumno = a.id_alumno AND ga.estado = 'ACTIVO'
      WHERE a.id_carrera = ?
        AND (COALESCE(k.promedio_general, 0) < 70 OR
             (SELECT COUNT(*) FROM kardex_historial_academico h
              WHERE h.id_alumno = a.id_alumno AND h.estado = 'No Acreditada') > 2)
      GROUP BY a.id_alumno
      ORDER BY COALESCE(k.promedio_general, 0) ASC
      LIMIT 50
    `, [idCarrera]);

    res.json({
      ok: true,
      data: {
        carrera: carrera[0],
        porPeriodo,
        tendenciaSemestral,
        alumnosRezago
      }
    });
  } catch (error) {
    console.error('Error en getHistorialPorCarrera:', error);
    res.status(500).json({ ok: false, message: 'Error al obtener historial por carrera' });
  }
}

// ──────────────────────────────────────────────
// VALIDACIÓN DE TRAYECTORIA (individual)
// ──────────────────────────────────────────────
async function getValidacionTrayectoria(req, res) {
  try {
    const { idAlumno } = req.params;

    const [alumno] = await pool.query(`
      SELECT a.*, c.nombre_carrera,
        COALESCE(k.promedio_general, 0) AS promedio_general,
        COALESCE(k.creditos_acumulados, 0) AS creditos_acumulados
      FROM alumnos a
      JOIN carreras c ON c.id_carrera = a.id_carrera
      LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
      WHERE a.id_alumno = ?
    `, [idAlumno]);

    if (alumno.length === 0) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    const [historial] = await pool.query(`
      SELECT h.*, p.nombre_periodo, m.clave_materia, m.nombre_materia, m.creditos AS creditos_materia
      FROM kardex_historial_academico h
      LEFT JOIN periodos p ON p.id_periodo = h.id_periodo
      LEFT JOIN materias m ON m.id_materia = h.id_materia
      WHERE h.id_alumno = ?
      ORDER BY p.fecha_inicio, m.semestre_sugerido
    `, [idAlumno]);

    const a = alumno[0];
    const creditosAcreditados = historial
      .filter(h => h.estado === 'Acreditada')
      .reduce((s, h) => s + (parseFloat(h.creditos) || 0), 0);
    const noAcreditadas = historial.filter(h => h.estado === 'No Acreditada').length;
    const extraordinarios = historial.filter(h => h.tipo_materia === 'Extraordinario').length;
    const semestreActual = a.semestre_actual;

    const validaciones = [];

    // 1. Validación de promedio
    if (a.promedio_general >= 80) validaciones.push({ tipo: 'aprobado', indicador: 'Promedio general', valor: a.promedio_general, resultado: 'Aceptable', detalle: 'El alumno mantiene un promedio adecuado.' });
    else if (a.promedio_general >= 70) validaciones.push({ tipo: 'precaucion', indicador: 'Promedio general', valor: a.promedio_general, resultado: 'Riesgo moderado', detalle: 'Promedio por debajo de 80. Requiere seguimiento.' });
    else validaciones.push({ tipo: 'critico', indicador: 'Promedio general', valor: a.promedio_general, resultado: 'Crítico', detalle: 'Promedio menor a 70. Se recomienda intervención académica inmediata.' });

    // 2. Validación de créditos
    const creditosEsperados = semestreActual * 50;
    if (creditosAcreditados >= creditosEsperados) validaciones.push({ tipo: 'aprobado', indicador: 'Avance de créditos', valor: `${creditosAcreditados}/${creditosEsperados}`, resultado: 'Aceptable', detalle: 'El alumno lleva el avance esperado.' });
    else validaciones.push({ tipo: 'precaucion', indicador: 'Avance de créditos', valor: `${creditosAcreditados}/${creditosEsperados}`, resultado: 'Rezago', detalle: `Créditos acumulados (${creditosAcreditados}) por debajo de lo esperado (${creditosEsperados}).` });

    // 3. Validación de materias no acreditadas
    if (noAcreditadas === 0) validaciones.push({ tipo: 'aprobado', indicador: 'Materias no acreditadas', valor: noAcreditadas, resultado: 'Aceptable', detalle: 'No registra materias reprobadas.' });
    else if (noAcreditadas <= 2) validaciones.push({ tipo: 'precaucion', indicador: 'Materias no acreditadas', valor: noAcreditadas, resultado: 'Riesgo moderado', detalle: `${noAcreditadas} materia(s) no acreditada(s). Requiere seguimiento.` });
    else validaciones.push({ tipo: 'critico', indicador: 'Materias no acreditadas', valor: noAcreditadas, resultado: 'Crítico', detalle: `Exceso de materias no acreditadas (${noAcreditadas}).` });

    // 4. Validación de extraordinarios
    if (extraordinarios === 0) validaciones.push({ tipo: 'aprobado', indicador: 'Extraordinarios', valor: extraordinarios, resultado: 'Aceptable', detalle: 'No registra extraordinarios.' });
    else if (extraordinarios <= 2) validaciones.push({ tipo: 'precaucion', indicador: 'Extraordinarios', valor: extraordinarios, resultado: 'Riesgo moderado', detalle: `${extraordinarios} extraordinario(s) registrado(s).` });
    else validaciones.push({ tipo: 'critico', indicador: 'Extraordinarios', valor: extraordinarios, resultado: 'Crítico', detalle: `Múltiples extraordinarios (${extraordinarios}).` });

    // 5. Validación de estatus académico
    const estatusMap = { 'Regular': 'aprobado', 'Irregular': 'critico', 'Egresado': 'aprobado', 'Baja_Temporal': 'precaucion', 'Baja_Definitiva': 'critico' };
    const estatusTipo = estatusMap[a.estatus_academico] || 'precaucion';
    const estatusLabel = a.estatus_academico.replace(/_/g, ' ');
    validaciones.push({
      tipo: estatusTipo,
      indicador: 'Estatus académico',
      valor: estatusLabel,
      resultado: estatusTipo === 'aprobado' ? 'Aceptable' : estatusTipo === 'critico' ? 'Crítico' : 'Requiere atención',
      detalle: `El alumno se encuentra en estatus "${estatusLabel}".`
    });

    const nivelRiesgo = validaciones.some(v => v.tipo === 'critico') ? 'Crítico'
      : validaciones.some(v => v.tipo === 'precaucion') ? 'Precaución'
      : 'Aceptable';

    res.json({
      ok: true,
      data: {
        alumno: a,
        validaciones,
        nivelRiesgo,
        historial
      }
    });
  } catch (error) {
    console.error('Error en getValidacionTrayectoria:', error);
    res.status(500).json({ ok: false, message: 'Error al validar trayectoria' });
  }
}

// ──────────────────────────────────────────────
// DIAGNÓSTICO DE REZAGO
// ──────────────────────────────────────────────
async function getDiagnosticoRezago(req, res) {
  try {
    const { idPeriodo, idCarrera } = req.query;

    let whereExtra = '';
    const params = [];
    if (idPeriodo) { whereExtra += ' AND ga.id_periodo = ?'; params.push(idPeriodo); }
    if (idCarrera) { whereExtra += ' AND a.id_carrera = ?'; params.push(idCarrera); }

    const [alumnosRezago] = await pool.query(`
      SELECT
        a.id_alumno,
        CONCAT(a.apellido_paterno, ' ', a.apellido_materno, ' ', a.nombres) AS nombre_completo,
        a.matricula,
        a.semestre_actual,
        a.estatus_academico,
        c.nombre_carrera,
        COALESCE(k.promedio_general, 0) AS promedio_general,
        COALESCE(k.creditos_acumulados, 0) AS creditos_acumulados,
        (SELECT COUNT(*) FROM kardex_historial_academico h
         WHERE h.id_alumno = a.id_alumno AND h.estado = 'No Acreditada') AS materias_reprobadas,
        (SELECT COUNT(*) FROM kardex_historial_academico h
         WHERE h.id_alumno = a.id_alumno AND h.estado = 'No Acreditada' AND h.tipo_materia = 'Extraordinario') AS extraordinarios_reprobados
      FROM alumnos a
      JOIN carreras c ON c.id_carrera = a.id_carrera
      LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
      JOIN grupos_alumnos ga ON ga.id_alumno = a.id_alumno AND ga.estado = 'ACTIVO'
      WHERE (COALESCE(k.promedio_general, 0) < 70
         OR (SELECT COUNT(*) FROM kardex_historial_academico h
             WHERE h.id_alumno = a.id_alumno AND h.estado = 'No Acreditada') > 2)
        ${whereExtra}
      GROUP BY a.id_alumno
      ORDER BY COALESCE(k.promedio_general, 0) ASC
      LIMIT 100
    `, params);

    const totalConRezago = alumnosRezago.length;
    const promedioRezago = totalConRezago > 0
      ? alumnosRezago.reduce((s, a) => s + parseFloat(a.promedio_general), 0) / totalConRezago
      : 0;

    const [totalActivos] = await pool.query(`
      SELECT COUNT(DISTINCT a.id_alumno) AS total
      FROM alumnos a
      JOIN grupos_alumnos ga ON ga.id_alumno = a.id_alumno AND ga.estado = 'ACTIVO'
      ${whereExtra.replace(/ga\./g, 'ga.')}
    `, params);

    const totalAlumnos = totalActivos[0]?.total || 0;
    const porcentajeRezago = totalAlumnos > 0
      ? Math.round((totalConRezago / totalAlumnos) * 100) : 0;

    res.json({
      ok: true,
      data: {
        totalAlumnos,
        totalConRezago,
        porcentajeRezago,
        promedioRezago: Math.round(promedioRezago * 100) / 100,
        alumnos: alumnosRezago
      }
    });
  } catch (error) {
    console.error('Error en getDiagnosticoRezago:', error);
    res.status(500).json({ ok: false, message: 'Error al obtener diagnóstico de rezago' });
  }
}

// ──────────────────────────────────────────────
// DIAGNÓSTICO DE IRREGULARIDADES
// ──────────────────────────────────────────────
async function getDiagnosticoIrregularidades(req, res) {
  try {
    const { idPeriodo, idCarrera } = req.query;

    let whereExtra = '';
    const params = [];
    if (idPeriodo) { whereExtra += ' AND ga.id_periodo = ?'; params.push(idPeriodo); }
    if (idCarrera) { whereExtra += ' AND a.id_carrera = ?'; params.push(idCarrera); }

    const [irregularidades] = await pool.query(`
      SELECT
        a.id_alumno,
        CONCAT(a.apellido_paterno, ' ', a.apellido_materno, ' ', a.nombres) AS nombre_completo,
        a.matricula,
        a.semestre_actual,
        c.nombre_carrera,
        COALESCE(k.promedio_general, 0) AS promedio_general,
        CASE
          WHEN COALESCE(k.promedio_general, 0) < 60 THEN 'Promedio crítico'
          WHEN (SELECT COUNT(*) FROM kardex_historial_academico h
                WHERE h.id_alumno = a.id_alumno AND h.estado = 'No Acreditada') > 3 THEN 'Exceso de reprobación'
          WHEN (SELECT COUNT(*) FROM kardex_historial_academico h
                WHERE h.id_alumno = a.id_alumno AND h.tipo_materia = 'Extraordinario') > 2 THEN 'Múltiples extraordinarios'
          WHEN a.estatus_academico = 'Irregular' THEN 'Estatus irregular'
          WHEN (COALESCE(k.promedio_general, 0) >= 70 AND COALESCE(k.promedio_general, 0) < 80
                AND (SELECT COUNT(*) FROM kardex_historial_academico h
                     WHERE h.id_alumno = a.id_alumno AND h.estado = 'No Acreditada') > 0)
            THEN 'Rendimiento borderline'
          ELSE 'Sin irregularidad'
        END AS tipo_irregularidad,
        (SELECT COUNT(*) FROM kardex_historial_academico h
         WHERE h.id_alumno = a.id_alumno AND h.estado = 'No Acreditada') AS materias_reprobadas,
        (SELECT COUNT(*) FROM kardex_historial_academico h
         WHERE h.id_alumno = a.id_alumno AND h.tipo_materia = 'Extraordinario') AS extraordinarios
      FROM alumnos a
      JOIN carreras c ON c.id_carrera = a.id_carrera
      LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
      JOIN grupos_alumnos ga ON ga.id_alumno = a.id_alumno AND ga.estado = 'ACTIVO'
      WHERE (
        COALESCE(k.promedio_general, 0) < 80
        OR (SELECT COUNT(*) FROM kardex_historial_academico h
            WHERE h.id_alumno = a.id_alumno AND h.estado = 'No Acreditada') > 0
        OR a.estatus_academico = 'Irregular'
      )
      ${whereExtra}
      GROUP BY a.id_alumno
      ORDER BY COALESCE(k.promedio_general, 0) ASC
      LIMIT 100
    `, params);

    const agrupadas = {};
    for (const irr of irregularidades) {
      const tipo = irr.tipo_irregularidad;
      if (!agrupadas[tipo]) agrupadas[tipo] = { tipo, count: 0, alumnos: [] };
      agrupadas[tipo].count++;
      agrupadas[tipo].alumnos.push(irr);
    }

    res.json({
      ok: true,
      data: {
        total: irregularidades.length,
        agrupadas: Object.values(agrupadas).sort((a, b) => b.count - a.count),
        alumnos: irregularidades
      }
    });
  } catch (error) {
    console.error('Error en getDiagnosticoIrregularidades:', error);
    res.status(500).json({ ok: false, message: 'Error al obtener irregularidades' });
  }
}

module.exports = {
  getCatalogosKardex,
  getKardexGrupo,
  getKardexAlumnoDetalle,
  getResumenPorPeriodo,
  getHistorialPorCarrera,
  getValidacionTrayectoria,
  getDiagnosticoRezago,
  getDiagnosticoIrregularidades
};
