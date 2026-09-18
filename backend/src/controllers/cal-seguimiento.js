'use strict';

const pool = require('../config/db');
const { registrarAuditoria } = require('../middleware/auditoria');

// ==============================
// 1. DASHBOARD DE SEGUIMIENTO POR PERÍODO
// ==============================
async function getDashboard(req, res) {
  try {
    const { idPeriodo } = req.params;

    const [materias] = await pool.execute(
      `SELECT ca.id_grupo, ca.id_materia, ca.id_docente,
              g.nombre_grupo, m.nombre_materia, m.clave_materia,
              CONCAT(dn.apellido_paterno, ' ', dn.apellido_materno, ' ', dn.nombres) AS nombre_docente,
              p.nombre_periodo
       FROM cargas_academicas ca
       INNER JOIN grupos g ON g.id_grupo = ca.id_grupo
       INNER JOIN materias m ON m.id_materia = ca.id_materia
       INNER JOIN periodos p ON p.id_periodo = ca.id_periodo
       LEFT JOIN docentes dn ON dn.id_docente = ca.id_docente
       WHERE ca.id_periodo = ? AND ca.estado = 'ACTIVA'
       ORDER BY g.nombre_grupo, m.nombre_materia`,
      [idPeriodo]
    );

    const [totalAlumnosGrupo] = await pool.execute(
      `SELECT ga.id_grupo, COUNT(*) AS total
       FROM grupos_alumnos ga
       WHERE ga.id_periodo = ? AND ga.estado = 'ACTIVO'
       GROUP BY ga.id_grupo`,
      [idPeriodo]
    );

    const alumnosPorGrupo = {};
    for (const r of totalAlumnosGrupo) {
      alumnosPorGrupo[r.id_grupo] = r.total;
    }

    const resultado = [];

    for (const mat of materias) {
      const totalAlumnos = alumnosPorGrupo[mat.id_grupo] || 0;
      const totalEsperado = totalAlumnos * 3; // 3 parciales

      const [captura] = await pool.execute(
        `SELECT
           COUNT(*) AS total_registros,
           SUM(CASE WHEN parcial_1 IS NOT NULL THEN 1 ELSE 0 END) AS p1_capturados,
           SUM(CASE WHEN parcial_2 IS NOT NULL THEN 1 ELSE 0 END) AS p2_capturados,
           SUM(CASE WHEN parcial_3 IS NOT NULL THEN 1 ELSE 0 END) AS p3_capturados,
           SUM(CASE WHEN estado_calificacion = 'BORRADOR' THEN 1 ELSE 0 END) AS borradores,
           SUM(CASE WHEN estado_calificacion = 'VALIDADA' THEN 1 ELSE 0 END) AS validadas,
           SUM(CASE WHEN estado_calificacion = 'PUBLICADA' THEN 1 ELSE 0 END) AS publicadas,
           SUM(CASE WHEN estado_calificacion = 'CERRADA' THEN 1 ELSE 0 END) AS cerradas,
           ROUND(AVG(calificacion_final), 2) AS promedio_grupal,
           SUM(CASE WHEN calificacion_final >= 6 THEN 1 ELSE 0 END) AS aprobados,
           SUM(CASE WHEN calificacion_final < 6 AND calificacion_final IS NOT NULL THEN 1 ELSE 0 END) AS no_acreditados
         FROM kardex_historial_academico
         WHERE id_grupo = ? AND id_materia = ? AND id_periodo = ?`,
        [mat.id_grupo, mat.id_materia, idPeriodo]
      );

      const c = captura[0] || {};
      const parcialesCapturados = (c.p1_capturados || 0) + (c.p2_capturados || 0) + (c.p3_capturados || 0);
      const porcentajeCaptura = totalEsperado > 0 ? Math.round((parcialesCapturados / totalEsperado) * 100) : 0;
      const totalPublicadas = (c.publicadas || 0) + (c.cerradas || 0);
      const porcentajeValidacion = (c.total_registros || 0) > 0 ? Math.round(((c.validadas || 0) + (c.publicadas || 0) + (c.cerradas || 0)) / c.total_registros * 100) : 0;
      const porcentajePublicacion = (c.total_registros || 0) > 0 ? Math.round((totalPublicadas / c.total_registros) * 100) : 0;

      resultado.push({
        id_grupo: mat.id_grupo,
        nombre_grupo: mat.nombre_grupo,
        id_materia: mat.id_materia,
        nombre_materia: mat.nombre_materia,
        clave_materia: mat.clave_materia,
        id_docente: mat.id_docente,
        nombre_docente: mat.nombre_docente,
        total_alumnos: totalAlumnos,
        parciales_capturados: parcialesCapturados,
        parciales_pendientes: totalEsperado - parcialesCapturados,
        total_parciales_esperados: totalEsperado,
        porcentaje_captura: porcentajeCaptura,
        porcentaje_validacion: porcentajeValidacion,
        porcentaje_publicacion: porcentajePublicacion,
        borradores: c.borradores || 0,
        validadas: c.validadas || 0,
        publicadas: c.publicadas || 0,
        cerradas: c.cerradas || 0,
        promedio_grupal: c.promedio_grupal || null,
        alumnos_aprobados: c.aprobados || 0,
        alumnos_no_acreditados: c.no_acreditados || 0
      });
    }

    const resumen = {
      total_materias: resultado.length,
      total_grupos: new Set(resultado.map(r => r.id_grupo)).size,
      promedio_captura: resultado.length > 0 ? Math.round(resultado.reduce((s, r) => s + r.porcentaje_captura, 0) / resultado.length) : 0,
      promedio_validacion: resultado.length > 0 ? Math.round(resultado.reduce((s, r) => s + r.porcentaje_validacion, 0) / resultado.length) : 0,
      promedio_publicacion: resultado.length > 0 ? Math.round(resultado.reduce((s, r) => s + r.porcentaje_publicacion, 0) / resultado.length) : 0,
      materias_sin_captura: resultado.filter(r => r.porcentaje_captura === 0).length,
      materias_parcialmente: resultado.filter(r => r.porcentaje_captura > 0 && r.porcentaje_captura < 100).length,
      materias_completas: resultado.filter(r => r.porcentaje_captura === 100).length
    };

    return res.json({ ok: true, estadisticas: resultado, resumen });
  } catch (error) {
    console.error('[SEGUIMIENTO] Error:', error);
    return res.status(500).json({ ok: false, message: 'Error obteniendo dashboard de seguimiento' });
  }
}

// ==============================
// 2. DETALLE POR GRUPO
// ==============================
async function getDetalleGrupo(req, res) {
  try {
    const { idGrupo, idPeriodo } = req.params;

    const [materias] = await pool.execute(
      `SELECT ca.id_materia, ca.id_docente,
              m.nombre_materia, m.clave_materia,
              CONCAT(dn.apellido_paterno, ' ', dn.apellido_materno, ' ', dn.nombres) AS nombre_docente
       FROM cargas_academicas ca
       INNER JOIN materias m ON m.id_materia = ca.id_materia
       LEFT JOIN docentes dn ON dn.id_docente = ca.id_docente
       WHERE ca.id_grupo = ? AND ca.id_periodo = ? AND ca.estado = 'ACTIVA'
       ORDER BY m.nombre_materia`,
      [idGrupo, idPeriodo]
    );

    const [alumnos] = await pool.execute(
      `SELECT a.id_alumno, a.matricula, a.apellido_paterno, a.apellido_materno, a.nombres
       FROM alumnos a
       INNER JOIN grupos_alumnos ga ON ga.id_alumno = a.id_alumno
       WHERE ga.id_grupo = ? AND ga.id_periodo = ? AND ga.estado = 'ACTIVO'
       ORDER BY a.apellido_paterno, a.apellido_materno, a.nombres`,
      [idGrupo, idPeriodo]
    );

    const detalleMaterias = [];

    for (const mat of materias) {
      const [calificaciones] = await pool.execute(
        `SELECT h.id_alumno, h.parcial_1, h.parcial_2, h.parcial_3,
                h.promedio_parciales, h.calificacion_final, h.estado_calificacion
         FROM kardex_historial_academico h
         WHERE h.id_grupo = ? AND h.id_materia = ? AND h.id_periodo = ?`,
        [idGrupo, mat.id_materia, idPeriodo]
      );

      const calMap = {};
      for (const c of calificaciones) {
        calMap[c.id_alumno] = c;
      }

      const alumnosConCal = alumnos.map(al => {
        const cal = calMap[al.id_alumno];
        return {
          id_alumno: al.id_alumno,
          matricula: al.matricula,
          nombre: `${al.apellido_paterno} ${al.apellido_materno} ${al.nombres}`,
          parcial_1: cal ? cal.parcial_1 : null,
          parcial_2: cal ? cal.parcial_2 : null,
          parcial_3: cal ? cal.parcial_3 : null,
          promedio: cal ? cal.promedio_parciales : null,
          calificacion_final: cal ? cal.calificacion_final : null,
          estado: cal ? cal.estado_calificacion : 'SIN_CALIFICACION'
        };
      });

      const total = alumnosConCal.length;
      const capturados = alumnosConCal.filter(a => a.parcial_1 != null || a.parcial_2 != null || a.parcial_3 != null).length;
      const pendientes = total - capturados;

      detalleMaterias.push({
        id_materia: mat.id_materia,
        nombre_materia: mat.nombre_materia,
        clave_materia: mat.clave_materia,
        nombre_docente: mat.nombre_docente,
        total_alumnos: total,
        alumnos_con_datos: capturados,
        alumnos_pendientes: pendientes,
        porcentaje: total > 0 ? Math.round((capturados / total) * 100) : 0,
        alumnos: alumnosConCal
      });
    }

    return res.json({ ok: true, materias: detalleMaterias });
  } catch (error) {
    console.error('[SEGUIMIENTO] Error:', error);
    return res.status(500).json({ ok: false, message: 'Error obteniendo detalle del grupo' });
  }
}

// ==============================
// 3. RECALCULAR SEGUIMIENTO
// ==============================
async function recalcular(req, res) {
  try {
    const { idGrupo, idPeriodo } = req.body;

    if (!idGrupo || !idPeriodo) {
      return res.status(400).json({ ok: false, message: 'idGrupo y idPeriodo requeridos' });
    }

    const [materias] = await pool.execute(
      `SELECT ca.id_materia, ca.id_docente
       FROM cargas_academicas ca
       WHERE ca.id_grupo = ? AND ca.id_periodo = ? AND ca.estado = 'ACTIVA'`,
      [idGrupo, idPeriodo]
    );

    const [alumnosCount] = await pool.execute(
      'SELECT COUNT(*) AS total FROM grupos_alumnos WHERE id_grupo = ? AND id_periodo = ? AND estado = ?',
      [idGrupo, idPeriodo, 'ACTIVO']
    );

    const totalAlumnos = alumnosCount[0]?.total || 0;

    for (const mat of materias) {
      const [stats] = await pool.execute(
        `SELECT
           COUNT(*) AS total_registros,
           SUM(CASE WHEN parcial_1 IS NOT NULL THEN 1 ELSE 0 END) AS p1,
           SUM(CASE WHEN parcial_2 IS NOT NULL THEN 1 ELSE 0 END) AS p2,
           SUM(CASE WHEN parcial_3 IS NOT NULL THEN 1 ELSE 0 END) AS p3,
           SUM(CASE WHEN estado_calificacion = 'VALIDADA' THEN 1 ELSE 0 END) AS validadas,
           SUM(CASE WHEN estado_calificacion IN ('PUBLICADA','CERRADA') THEN 1 ELSE 0 END) AS publicadas,
           ROUND(AVG(calificacion_final), 2) AS promedio,
           SUM(CASE WHEN calificacion_final >= 6 THEN 1 ELSE 0 END) AS aprobados,
           SUM(CASE WHEN calificacion_final < 6 AND calificacion_final IS NOT NULL THEN 1 ELSE 0 END) AS no_acred
         FROM kardex_historial_academico
         WHERE id_grupo = ? AND id_materia = ? AND id_periodo = ?`,
        [idGrupo, mat.id_materia, idPeriodo]
      );

      const s = stats[0] || {};
      const totalEsperado = totalAlumnos * 3;
      const parcialesCapturados = (s.p1 || 0) + (s.p2 || 0) + (s.p3 || 0);

      await pool.execute(
        `INSERT INTO calificaciones_seguimiento_coord
         (id_grupo, id_materia, id_periodo, id_docente, total_alumnos,
          parciales_capturados, parciales_pendientes, total_parciales_esperados,
          porcentaje_captura, porcentaje_validacion, porcentaje_publicacion,
          alumnos_con_pendientes, alumnos_aprobados, alumnos_no_acreditados, promedio_grupal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          total_alumnos = VALUES(total_alumnos),
          parciales_capturados = VALUES(parciales_capturados),
          parciales_pendientes = VALUES(parciales_pendientes),
          total_parciales_esperados = VALUES(total_parciales_esperados),
          porcentaje_captura = VALUES(porcentaje_captura),
          porcentaje_validacion = VALUES(porcentaje_validacion),
          porcentaje_publicacion = VALUES(porcentaje_publicacion),
          alumnos_con_pendientes = VALUES(alumnos_con_pendientes),
          alumnos_aprobados = VALUES(alumnos_aprobados),
          alumnos_no_acreditados = VALUES(alumnos_no_acreditados),
          promedio_grupal = VALUES(promedio_grupal)`,
        [idGrupo, mat.id_materia, idPeriodo, mat.id_docente, totalAlumnos,
         parcialesCapturados, totalEsperado - parcialesCapturados, totalEsperado,
         totalEsperado > 0 ? Math.round(parcialesCapturados / totalEsperado * 100) : 0,
         (s.total_registros || 0) > 0 ? Math.round(((s.validadas || 0) + (s.publicadas || 0)) / s.total_registros * 100) : 0,
         (s.total_registros || 0) > 0 ? Math.round((s.publicadas || 0) / s.total_registros * 100) : 0,
         totalAlumnos - (s.aprobados || 0) - (s.no_acred || 0),
         s.aprobados || 0, s.no_acred || 0, s.promedio || 0]
      );
    }

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      modulo: 'SEGUIMIENTO',
      accion: 'SEGUIMIENTO_RECALCULADO',
      descripcion: `Seguimiento recalculado — Grupo: ${idGrupo}, Periodo: ${idPeriodo}`,
      req
    });

    return res.json({ ok: true, message: 'Seguimiento recalculado correctamente' });
  } catch (error) {
    console.error('[SEGUIMIENTO] Error:', error);
    return res.status(500).json({ ok: false, message: 'Error recalculando seguimiento' });
  }
}

// ==============================
// 4. INCIDENCIAS
// ==============================
async function getIncidencias(req, res) {
  try {
    const { idPeriodo } = req.params;

    const [incidencias] = await pool.execute(
      `SELECT s.*, g.nombre_grupo, m.nombre_materia, m.clave_materia,
              CONCAT(dn.apellido_paterno, ' ', dn.apellido_materno, ' ', dn.nombres) AS nombre_docente
       FROM calificaciones_seguimiento_coord s
       INNER JOIN grupos g ON g.id_grupo = s.id_grupo
       INNER JOIN materias m ON m.id_materia = s.id_materia
       LEFT JOIN docentes dn ON dn.id_docente = s.id_docente
       WHERE s.id_periodo = ?
         AND (s.porcentaje_captura < 50 OR s.alumnos_no_acreditados > s.total_alumnos * 0.3
              OR s.total_alumnos = 0)
       ORDER BY s.porcentaje_captura ASC, s.alumnos_no_acreditados DESC`,
      [idPeriodo]
    );

    const resultado = incidencias.map(inc => ({
      id_grupo: inc.id_grupo,
      nombre_grupo: inc.nombre_grupo,
      id_materia: inc.id_materia,
      nombre_materia: inc.nombre_materia,
      nombre_docente: inc.nombre_docente,
      total_alumnos: inc.total_alumnos,
      porcentaje_captura: inc.porcentaje_captura,
      alumnos_no_acreditados: inc.alumnos_no_acreditados,
      tipo_incidencia: inc.porcentaje_captura < 50 ? 'CAPTURA_BAJA' :
                       inc.alumnos_no_acreditados > inc.total_alumnos * 0.3 ? 'ALTO_REPROBACION' : 'SIN_DATOS'
    }));

    return res.json({ ok: true, incidencias: resultado, total: resultado.length });
  } catch (error) {
    console.error('[SEGUIMIENTO] Error:', error);
    return res.status(500).json({ ok: false, message: 'Error obteniendo incidencias' });
  }
}

// ==============================
// 5. TABLERO COMPLETO DE SEGUIMIENTO ACADÉMICO
// ==============================
async function getTablero(req, res) {
  try {
    const { idPeriodo } = req.params;
    const { idGrupo, idDocente, idMateria, semestre, estado } = req.query;

    // Info del periodo
    const [periodoInfo] = await pool.execute(
      'SELECT * FROM periodos WHERE id_periodo = ? LIMIT 1', [idPeriodo]
    );
    const periodo = periodoInfo[0] || {};
    const hoy = new Date();
    const fechaFin = periodo.fecha_fin ? new Date(periodo.fecha_fin) : null;
    const diasRestantes = fechaFin ? Math.ceil((fechaFin - hoy) / (1000 * 60 * 60 * 24)) : null;

    // Todas las cargas academicas del periodo
    let whereCarga = 'ca.id_periodo = ? AND ca.estado = \'ACTIVA\'';
    const paramsCarga = [idPeriodo];
    if (idGrupo) { whereCarga += ' AND ca.id_grupo = ?'; paramsCarga.push(idGrupo); }
    if (idDocente) { whereCarga += ' AND ca.id_docente = ?'; paramsCarga.push(idDocente); }
    if (idMateria) { whereCarga += ' AND ca.id_materia = ?'; paramsCarga.push(idMateria); }

    const [cargas] = await pool.execute(
      `SELECT ca.id_grupo, ca.id_materia, ca.id_docente,
              g.nombre_grupo, g.semestre, g.turno,
              m.nombre_materia, m.clave_materia,
              CONCAT(dn.apellido_paterno, ' ', dn.apellido_materno, ' ', dn.nombres) AS nombre_docente
       FROM cargas_academicas ca
       INNER JOIN grupos g ON g.id_grupo = ca.id_grupo
       INNER JOIN materias m ON m.id_materia = ca.id_materia
       LEFT JOIN docentes dn ON dn.id_docente = ca.id_docente
       WHERE ${whereCarga}
       ORDER BY g.nombre_grupo, m.nombre_materia`,
      paramsCarga
    );

    // Filtro de semestre post-query
    let cargasFiltradas = cargas;
    if (semestre) {
      cargasFiltradas = cargas.filter(c => String(c.semestre) === String(semestre));
    }

    // Alumnos por grupo
    const [alumnosGrupo] = await pool.execute(
      `SELECT ga.id_grupo, COUNT(*) AS total
       FROM grupos_alumnos ga
       WHERE ga.id_periodo = ? AND ga.estado = 'ACTIVO'
       GROUP BY ga.id_grupo`,
      [idPeriodo]
    );
    const alumnosPorGrupo = {};
    for (const r of alumnosGrupo) alumnosPorGrupo[r.id_grupo] = r.total;

    // Construir filas del tablero
    const filas = [];
    for (const c of cargasFiltradas) {
      const totalAlumnos = alumnosPorGrupo[c.id_grupo] || 0;

      // Captura por parcial
      const [captura] = await pool.execute(
        `SELECT
           COUNT(*) AS total_registros,
           SUM(CASE WHEN parcial_1 IS NOT NULL THEN 1 ELSE 0 END) AS p1_capturados,
           SUM(CASE WHEN parcial_2 IS NOT NULL THEN 1 ELSE 0 END) AS p2_capturados,
           SUM(CASE WHEN parcial_3 IS NOT NULL THEN 1 ELSE 0 END) AS p3_capturados,
           SUM(CASE WHEN estado_calificacion = 'BORRADOR' THEN 1 ELSE 0 END) AS borradores,
           SUM(CASE WHEN estado_calificacion = 'VALIDADA' THEN 1 ELSE 0 END) AS validadas,
           SUM(CASE WHEN estado_calificacion = 'PUBLICADA' THEN 1 ELSE 0 END) AS publicadas,
           SUM(CASE WHEN estado_calificacion = 'CERRADA' THEN 1 ELSE 0 END) AS cerradas,
           ROUND(AVG(calificacion_final), 2) AS promedio_grupal,
           SUM(CASE WHEN calificacion_final >= 6 THEN 1 ELSE 0 END) AS aprobados,
           SUM(CASE WHEN calificacion_final < 6 AND calificacion_final IS NOT NULL THEN 1 ELSE 0 END) AS no_acreditados
         FROM kardex_historial_academico
         WHERE id_grupo = ? AND id_materia = ? AND id_periodo = ?`,
        [c.id_grupo, c.id_materia, idPeriodo]
      );

      const s = captura[0] || {};
      const totalReg = s.total_registros || 0;
      const sinCalificacion = totalAlumnos - totalReg;

      // Calificaciones modificadas (cambios registrados)
      let modificaciones = 0;
      try {
        const [mods] = await pool.execute(
          `SELECT COUNT(*) AS total
           FROM calificaciones_historial_cambios ch
           INNER JOIN kardex_historial_academico h ON h.id_historial = ch.id_historial
           WHERE h.id_grupo = ? AND h.id_materia = ? AND h.id_periodo = ?`,
          [c.id_grupo, c.id_materia, idPeriodo]
        );
        modificaciones = mods[0]?.total || 0;
      } catch (_) {}

      // Estado de calificacion (predominante)
      let estadoPredominante = 'SIN_DATOS';
      if (totalReg > 0) {
        if ((s.cerradas || 0) === totalReg) estadoPredominante = 'CERRADA';
        else if ((s.publicadas || 0) + (s.cerradas || 0) === totalReg) estadoPredominante = 'PUBLICADA';
        else if ((s.validadas || 0) + (s.publicadas || 0) + (s.cerradas || 0) === totalReg) estadoPredominante = 'VALIDADA';
        else if ((s.borradores || 0) === totalReg) estadoPredominante = 'BORRADOR';
        else estadoPredominante = 'EN_PROCESO';
      }

      // Filtro de estado post-query
      if (estado && estado !== 'TODOS' && estadoPredominante !== estado) continue;

      filas.push({
        id_grupo: c.id_grupo,
        nombre_grupo: c.nombre_grupo,
        semestre: c.semestre,
        turno: c.turno,
        id_materia: c.id_materia,
        nombre_materia: c.nombre_materia,
        clave_materia: c.clave_materia,
        id_docente: c.id_docente,
        nombre_docente: c.nombre_docente,
        total_alumnos: totalAlumnos,
        // Parciales
        p1_capturados: s.p1_capturados || 0,
        p1_pendientes: totalAlumnos - (s.p1_capturados || 0),
        p2_capturados: s.p2_capturados || 0,
        p2_pendientes: totalAlumnos - (s.p2_capturados || 0),
        p3_capturados: s.p3_capturados || 0,
        p3_pendientes: totalAlumnos - (s.p3_capturados || 0),
        // Promedio
        promedio_grupal: s.promedio_grupal || null,
        // Estados
        borradores: s.borradores || 0,
        validadas: s.validadas || 0,
        publicadas: s.publicadas || 0,
        cerradas: s.cerradas || 0,
        estado_predominante: estadoPredominante,
        // Pendientes y modificaciones
        calificaciones_pendientes: sinCalificacion > 0 ? sinCalificacion : 0,
        modificaciones: modificaciones,
        // Aprobacion
        alumnos_aprobados: s.aprobados || 0,
        alumnos_no_acreditados: s.no_acreditados || 0
      });
    }

    // ====== ALERTAS (solo datos reales) ======
    const alertas = [];

    // 1. Docentes con calificaciones pendientes
    const docentesPendientes = {};
    for (const f of filas) {
      if (f.calificaciones_pendientes > 0) {
        const key = f.id_docente;
        if (!docentesPendientes[key]) {
          docentesPendientes[key] = { nombre: f.nombre_docente, materias: [], total_pendientes: 0 };
        }
        docentesPendientes[key].materias.push(f.nombre_materia);
        docentesPendientes[key].total_pendientes += f.calificaciones_pendientes;
      }
    }
    for (const [id, d] of Object.entries(docentesPendientes)) {
      alertas.push({
        tipo: 'DOCENTE_PENDIENTE',
        nivel: d.total_pendientes > 10 ? 'ALTO' : 'MEDIO',
        titulo: `Docente con calificaciones pendientes`,
        descripcion: `${d.nombre} tiene ${d.total_pendientes} calificación(es) pendiente(s) en ${d.materias.length} materia(s): ${d.materias.slice(0, 3).join(', ')}${d.materias.length > 3 ? '...' : ''}`,
        docente: d.nombre,
        total: d.total_pendientes
      });
    }

    // 2. Grupos incompletos (materias sin ninguna calificación capturada)
    const gruposIncompletos = filas.filter(f => f.total_alumnos > 0 && f.estado_predominante === 'SIN_DATOS');
    if (gruposIncompletos.length > 0) {
      const porGrupo = {};
      for (const f of gruposIncompletos) {
        if (!porGrupo[f.nombre_grupo]) porGrupo[f.nombre_grupo] = [];
        porGrupo[f.nombre_grupo].push(f.nombre_materia);
      }
      for (const [g, mats] of Object.entries(porGrupo)) {
        alertas.push({
          tipo: 'GRUPO_INCOMPLETO',
          nivel: 'ALTO',
          titulo: `Grupo sin calificaciones capturadas`,
          descripcion: `${g} — ${mats.length} materia(s) sin datos: ${mats.slice(0, 3).join(', ')}${mats.length > 3 ? '...' : ''}`,
          grupo: g,
          total: mats.length
        });
      }
    }

    // 3. Alumnos sin calificación (por materia)
    const materiasConPendientes = filas.filter(f => f.calificaciones_pendientes > 0);
    for (const f of materiasConPendientes.slice(0, 5)) {
      alertas.push({
        tipo: 'ALUMNO_SIN_CALIFICACION',
        nivel: f.calificaciones_pendientes > 5 ? 'ALTO' : 'MEDIO',
        titulo: `Alumnos sin calificación`,
        descripcion: `${f.nombre_grupo} — ${f.nombre_materia}: ${f.calificaciones_pendientes} alumno(s) sin calificar de ${f.total_alumnos}`,
        grupo: f.nombre_grupo,
        materia: f.nombre_materia,
        total: f.calificaciones_pendientes
      });
    }

    // 4. Calificaciones modificadas
    const materiasModificadas = filas.filter(f => f.modificaciones > 0);
    for (const f of materiasModificadas.slice(0, 5)) {
      alertas.push({
        tipo: 'CALIFICACION_MODIFICADA',
        nivel: f.modificaciones > 5 ? 'ALTO' : 'BAJO',
        titulo: `Calificaciones modificadas`,
        descripcion: `${f.nombre_grupo} — ${f.nombre_materia}: ${f.modificaciones} cambio(s) registrado(s)`,
        grupo: f.nombre_grupo,
        materia: f.nombre_materia,
        total: f.modificaciones
      });
    }

    // 5. Periodo proximo a cierre
    if (diasRestantes != null && diasRestantes <= 15 && diasRestantes >= 0) {
      alertas.push({
        tipo: 'PERIODO_CIERRE',
        nivel: diasRestantes <= 5 ? 'CRITICO' : 'ALTO',
        titulo: `Periodo próximo a cerrar`,
        descripcion: `Faltan ${diasRestantes} día(s) para el cierre del periodo ${periodo.nombre_periodo || idPeriodo}`,
        dias_restantes: diasRestantes
      });
    }

    // Resumen general
    const resumen = {
      total_grupos: new Set(filas.map(f => f.id_grupo)).size,
      total_docentes: new Set(filas.map(f => f.id_docente)).size,
      total_materias: filas.length,
      total_alumnos: filas.reduce((s, f) => s + f.total_alumnos, 0),
      parciales_capturados: filas.reduce((s, f) => s + f.p1_capturados + f.p2_capturados + f.p3_capturados, 0),
      parciales_esperados: filas.reduce((s, f) => s + f.total_alumnos * 3, 0),
      porcentaje_general: filas.length > 0
        ? Math.round(filas.reduce((s, f) => s + (f.total_alumnos > 0 ? ((f.p1_capturados + f.p2_capturados + f.p3_capturados) / (f.total_alumnos * 3)) * 100 : 0), 0) / filas.length)
        : 0,
      materias_completas: filas.filter(f => f.estado_predominante === 'PUBLICADA' || f.estado_predominante === 'CERRADA').length,
      materias_en_proceso: filas.filter(f => f.estado_predominante === 'EN_PROCESO' || f.estado_predominante === 'BORRADOR').length,
      materias_sin_datos: filas.filter(f => f.estado_predominante === 'SIN_DATOS').length,
      total_modificaciones: filas.reduce((s, f) => s + f.modificaciones, 0),
      total_pendientes: filas.reduce((s, f) => s + f.calificaciones_pendientes, 0),
      total_alertas: alertas.length,
      dias_restantes_periodo: diasRestantes,
      periodo_nombre: periodo.nombre_periodo || null
    };

    return res.json({ ok: true, filas, alertas, resumen });
  } catch (error) {
    console.error('[SEGUIMIENTO] Error en tablero:', error);
    return res.status(500).json({ ok: false, message: 'Error obteniendo tablero de seguimiento' });
  }
}

module.exports = {
  getDashboard,
  getDetalleGrupo,
  recalcular,
  getIncidencias,
  getTablero
};
