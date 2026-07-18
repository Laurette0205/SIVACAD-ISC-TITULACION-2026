const db = require('../config/db');

async function resolveDocenteId(idUsuario) {
  const [rows] = await db.query(
    'SELECT id_docente, clave_docente FROM docentes WHERE id_usuario = ? LIMIT 1',
    [idUsuario]
  );
  return rows.length > 0 ? rows[0] : null;
}

async function registrarAuditoria(id_tramite, id_usuario, accion, detalle, req) {
  try {
    await db.query(
      `INSERT INTO tramites_auditoria (id_tramite, id_usuario, accion, detalle, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id_tramite, id_usuario, accion, detalle || null,
        req?.ip || req?.headers?.['x-forwarded-for'] || req?.connection?.remoteAddress || null,
        req?.headers?.['user-agent'] || null]
    );
  } catch (err) {
    console.error('Error registrando auditoría:', err);
  }
}

async function registrarBitacora(id_usuario, accion, detalle, req) {
  try {
    await db.query(
      `INSERT INTO bitacora_auditoria (id_usuario, modulo, accion, detalle, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id_usuario, 'TRAMITES_DOC', accion, detalle || null,
        req?.ip || req?.headers?.['x-forwarded-for'] || req?.connection?.remoteAddress || null,
        req?.headers?.['user-agent'] || null]
    );
  } catch (err) {
    console.error('Error registrando bitácora:', err);
  }
}

function buildDocenteFilter(idDocente) {
  return `
    EXISTS (
      SELECT 1 FROM grupos_alumnos ga
      JOIN cargas_academicas ca ON ca.id_grupo = ga.id_grupo
        AND ca.id_periodo = ga.id_periodo
        AND ca.id_docente = ${idDocente}
        AND ca.estado = 'ACTIVA'
      WHERE ga.id_alumno = t.id_alumno
        AND ga.estado = 'ACTIVO'
    )`;
}

const resumen = async (req, res) => {
  try {
    const docente = await resolveDocenteId(req.user.id_usuario);
    if (!docente) return res.status(400).json({ ok: false, message: 'Perfil docente no encontrado' });

    const filter = buildDocenteFilter(docente.id_docente);
    const estadosVisibles = ['SOLICITADO', 'EN_REVISION', 'EN_ANALISIS', 'OBSERVADO', 'DICTAMINADO', 'VALIDADO'];

    const [total] = await db.query(
      `SELECT COUNT(*) AS total FROM tramites t WHERE t.estado_actual IN (?) AND ${filter}`,
      [estadosVisibles]
    );
    const [porEstado] = await db.query(
      `SELECT t.estado_actual, COUNT(*) AS cantidad FROM tramites t
       WHERE t.estado_actual IN (?) AND ${filter}
       GROUP BY t.estado_actual ORDER BY t.estado_actual`,
      [estadosVisibles]
    );
    const [pendientesOpinion] = await db.query(
      `SELECT COUNT(*) AS pendientes FROM tramites t
       WHERE t.estado_actual IN ('SOLICITADO', 'EN_REVISION', 'EN_ANALISIS')
         AND t.docente_opinion_emitida = 0
         AND ${filter}`
    );
    const [conOpinion] = await db.query(
      `SELECT COUNT(*) AS emitidas FROM tramites t
       WHERE t.docente_opinion_emitida = 1 AND ${filter}`
    );
    const [misGrupos] = await db.query(
      `SELECT COUNT(*) AS total FROM cargas_academicas ca
       JOIN grupos g ON g.id_grupo = ca.id_grupo
       WHERE ca.id_docente = ? AND ca.estado = 'ACTIVA'`,
      [docente.id_docente]
    );

    return res.json({
      ok: true,
      data: {
        total: total[0].total,
        por_estado: porEstado,
        pendientes_opinion: pendientesOpinion[0].pendientes,
        opiniones_emitidas: conOpinion[0].emitidas,
        mis_grupos: misGrupos[0].total
      }
    });
  } catch (error) {
    console.error('Error en resumen docente tramites:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener resumen' });
  }
};

const misGrupos = async (req, res) => {
  try {
    const docente = await resolveDocenteId(req.user.id_usuario);
    if (!docente) return res.status(400).json({ ok: false, message: 'Perfil docente no encontrado' });

    const [rows] = await db.query(
      `SELECT ca.id_carga_academica, ca.id_grupo, ca.id_materia, ca.id_periodo,
              g.nombre_grupo, g.semestre, g.turno,
              m.nombre_materia, m.clave_materia,
              p.nombre_periodo,
              (SELECT COUNT(*) FROM grupos_alumnos ga
               WHERE ga.id_grupo = ca.id_grupo AND ga.id_periodo = ca.id_periodo
                 AND ga.estado = 'ACTIVO') AS alumnos_activos
       FROM cargas_academicas ca
       JOIN grupos g ON g.id_grupo = ca.id_grupo
       JOIN materias m ON m.id_materia = ca.id_materia
       JOIN periodos p ON p.id_periodo = ca.id_periodo
       WHERE ca.id_docente = ? AND ca.estado = 'ACTIVA'
       ORDER BY p.fecha_inicio DESC, g.nombre_grupo`,
      [docente.id_docente]
    );
    return res.json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error en misGrupos docente:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener grupos' });
  }
};

const alumnosGrupo = async (req, res) => {
  try {
    const { idGrupo, idPeriodo } = req.params;
    const docente = await resolveDocenteId(req.user.id_usuario);
    if (!docente) return res.status(400).json({ ok: false, message: 'Perfil docente no encontrado' });

    const [acceso] = await db.query(
      `SELECT 1 FROM cargas_academicas
       WHERE id_docente = ? AND id_grupo = ? AND id_periodo = ? AND estado = 'ACTIVA'
       LIMIT 1`,
      [docente.id_docente, idGrupo, idPeriodo]
    );
    if (acceso.length === 0) {
      return res.status(403).json({ ok: false, message: 'No tienes acceso a este grupo' });
    }

    const [rows] = await db.query(
      `SELECT a.id_alumno, a.matricula, a.nombres, a.apellido_paterno, a.apellido_materno,
              a.curp, a.semestre_actual, a.estatus_academico,
              c.nombre_carrera,
              (SELECT COUNT(*) FROM tramites t WHERE t.id_alumno = a.id_alumno) AS tramites_activos
       FROM grupos_alumnos ga
       JOIN alumnos a ON a.id_alumno = ga.id_alumno
       LEFT JOIN carreras c ON c.id_carrera = a.id_carrera
       WHERE ga.id_grupo = ? AND ga.id_periodo = ? AND ga.estado = 'ACTIVO'
       ORDER BY a.apellido_paterno, a.apellido_materno, a.nombres`,
      [idGrupo, idPeriodo]
    );
    return res.json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error en alumnosGrupo docente:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener alumnos del grupo' });
  }
};

const bandeja = async (req, res) => {
  try {
    const docente = await resolveDocenteId(req.user.id_usuario);
    if (!docente) return res.status(400).json({ ok: false, message: 'Perfil docente no encontrado' });

    const estadosVisibles = ['SOLICITADO', 'EN_REVISION', 'EN_ANALISIS', 'OBSERVADO', 'DICTAMINADO', 'VALIDADO'];
    const params = [estadosVisibles];
    const filter = buildDocenteFilter(docente.id_docente);

    let sql = `
      SELECT DISTINCT t.id_tramite, t.folio, tt.nombre AS tipo_tramite, tt.codigo AS tipo_codigo,
        CONCAT(a.nombres, ' ', a.apellido_paterno, ' ', a.apellido_materno) AS alumno_nombre,
        a.matricula, a.curp, c.nombre_carrera, a.semestre_actual,
        t.estado_actual, t.motivo,
        t.docente_opinion_emitida,
        t.creado_en, t.actualizado_en
      FROM tramites t
      JOIN tramites_tipos tt ON tt.id_tipo = t.id_tipo
      JOIN alumnos a ON a.id_alumno = t.id_alumno
      LEFT JOIN carreras c ON c.id_carrera = a.id_carrera
      WHERE t.estado_actual IN (?) AND ${filter}
    `;

    if (req.query.tipo) {
      sql += ' AND tt.codigo = ?';
      params.push(req.query.tipo);
    }
    if (req.query.estado) {
      sql += ' AND t.estado_actual = ?';
      params.push(req.query.estado);
    }
    if (req.query.search) {
      const s = `%${req.query.search}%`;
      sql += ' AND (a.matricula LIKE ? OR CONCAT(a.nombres, \' \', a.apellido_paterno, \' \', a.apellido_materno) LIKE ? OR t.folio LIKE ?)';
      params.push(s, s, s);
    }
    if (req.query.opinion_pendiente === '1') {
      sql += ' AND t.docente_opinion_emitida = 0';
    }

    sql += ' ORDER BY t.creado_en DESC LIMIT 200';

    const [rows] = await db.query(sql, params);
    return res.json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error en bandeja docente:', error);
    return res.status(500).json({ ok: false, message: 'Error al cargar bandeja' });
  }
};

const obtenerTramite = async (req, res) => {
  try {
    const { id } = req.params;
    const docente = await resolveDocenteId(req.user.id_usuario);
    if (!docente) return res.status(400).json({ ok: false, message: 'Perfil docente no encontrado' });

    const filter = buildDocenteFilter(docente.id_docente);

    const [tramites] = await db.query(
      `SELECT t.*, tt.nombre AS tipo_tramite, tt.codigo AS tipo_codigo,
        CONCAT(a.nombres, ' ', a.apellido_paterno, ' ', a.apellido_materno) AS alumno_nombre,
        a.matricula, a.curp, a.semestre_actual, c.nombre_carrera,
        u_sol.nombres AS sol_nombre, u_sol.apellido_paterno AS sol_apellido
      FROM tramites t
      JOIN tramites_tipos tt ON tt.id_tipo = t.id_tipo
      JOIN alumnos a ON a.id_alumno = t.id_alumno
      LEFT JOIN carreras c ON c.id_carrera = a.id_carrera
      JOIN usuarios u_sol ON u_sol.id_usuario = t.id_usuario_solicitante
      WHERE t.id_tramite = ? AND ${filter}`,
      [id]
    );
    if (tramites.length === 0) {
      return res.status(404).json({ ok: false, message: 'Trámite no encontrado o sin acceso' });
    }

    const [documentos] = await db.query(
      'SELECT * FROM tramites_documentos WHERE id_tramite = ? ORDER BY subido_en DESC', [id]
    );
    const [observaciones] = await db.query(
      `SELECT o.*, u.nombres, u.apellido_paterno
       FROM tramites_observaciones o
       LEFT JOIN usuarios u ON u.id_usuario = o.id_usuario
       WHERE o.id_tramite = ?
       ORDER BY o.creado_en DESC`, [id]
    );
    const [historial] = await db.query(
      `SELECT h.*, u.nombres, u.apellido_paterno
       FROM tramites_historial_estados h
       LEFT JOIN usuarios u ON u.id_usuario = h.cambiado_por
       WHERE h.id_tramite = ?
       ORDER BY h.creado_en DESC`, [id]
    );

    return res.json({ ok: true, data: { ...tramites[0], documentos, observaciones, historial_estados: historial } });
  } catch (error) {
    console.error('Error obteniendo trámite docente:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener trámite' });
  }
};

const emitirOpinionAcademica = async (req, res) => {
  try {
    const { id } = req.params;
    const { opinion, tipo_dictamen, observaciones } = req.body;
    if (!opinion) return res.status(400).json({ ok: false, message: 'La opinión académica es requerida' });

    const docente = await resolveDocenteId(req.user.id_usuario);
    if (!docente) return res.status(400).json({ ok: false, message: 'Perfil docente no encontrado' });

    const filter = buildDocenteFilter(docente.id_docente);
    const [tramites] = await db.query(
      `SELECT id_tramite, folio, estado_actual FROM tramites t WHERE t.id_tramite = ? AND ${filter}`,
      [id]
    );
    if (tramites.length === 0) return res.status(404).json({ ok: false, message: 'Trámite no encontrado o sin acceso' });
    const t = tramites[0];

    if (!['SOLICITADO', 'EN_REVISION', 'EN_ANALISIS'].includes(t.estado_actual)) {
      return res.status(400).json({ ok: false, message: 'No se puede emitir opinión en el estado actual' });
    }

    const nuevoEstado = tipo_dictamen === 'OBSERVADO' ? 'OBSERVADO' : t.estado_actual;

    await db.query(
      `UPDATE tramites SET
        docente_opinion = ?,
        docente_opinion_emitida = 1,
        docente_opinion_por = ?,
        docente_opinion_en = NOW(),
        estado_actual = ?,
        observaciones = COALESCE(NULLIF(?, ''), observaciones)
      WHERE id_tramite = ?`,
      [opinion, req.user.id_usuario, nuevoEstado, observaciones || null, id]
    );

    await db.query(
      `INSERT INTO tramites_observaciones (id_tramite, id_usuario, tipo, observacion)
       VALUES (?, ?, 'OPINION_DOCENTE', ?)`,
      [id, req.user.id_usuario, opinion]
    );

    await registrarAuditoria(id, req.user.id_usuario, 'OPINION_DOCENTE',
      `Opinión académica emitida para ${t.folio}${tipo_dictamen === 'OBSERVADO' ? ' (Observado)' : ''}`, req);
    await registrarBitacora(req.user.id_usuario, 'OPINION_DOCENTE',
      `Opinión académica emitida: ${t.folio}`, req);

    return res.json({ ok: true, message: 'Opinión académica emitida exitosamente' });
  } catch (error) {
    console.error('Error emitiendo opinión:', error);
    return res.status(500).json({ ok: false, message: 'Error al emitir opinión académica' });
  }
};

const confirmarCompatibilidad = async (req, res) => {
  try {
    const { id } = req.params;
    const { compatible, fundamento, materias } = req.body;

    if (compatible === undefined || compatible === null) {
      return res.status(400).json({ ok: false, message: 'Indique si las materias son compatibles (true/false)' });
    }

    const docente = await resolveDocenteId(req.user.id_usuario);
    if (!docente) return res.status(400).json({ ok: false, message: 'Perfil docente no encontrado' });

    const filter = buildDocenteFilter(docente.id_docente);
    const [tramites] = await db.query(
      `SELECT id_tramite, folio, estado_actual FROM tramites t WHERE t.id_tramite = ? AND ${filter}`,
      [id]
    );
    if (tramites.length === 0) return res.status(404).json({ ok: false, message: 'Trámite no encontrado o sin acceso' });
    const t = tramites[0];

    const validacion = JSON.stringify({ compatible: !!compatible, fundamento: fundamento || '', materias: materias || [] });

    await db.query(
      `UPDATE tramites SET docente_validacion_materias = ? WHERE id_tramite = ?`,
      [validacion, id]
    );

    await db.query(
      `INSERT INTO tramites_observaciones (id_tramite, id_usuario, tipo, observacion)
       VALUES (?, ?, 'VALIDACION_MATERIAS', ?)`,
      [id, req.user.id_usuario, `Compatibilidad: ${compatible ? 'COMPATIBLE' : 'NO COMPATIBLE'}. ${fundamento || ''}`]
    );

    await registrarAuditoria(id, req.user.id_usuario, 'VALIDAR_MATERIAS',
      `Validación de materias para ${t.folio}: ${compatible ? 'COMPATIBLE' : 'NO COMPATIBLE'}`, req);

    return res.json({ ok: true, message: `Compatibilidad confirmada: ${compatible ? 'Compatible' : 'No compatible'}` });
  } catch (error) {
    console.error('Error confirmando compatibilidad:', error);
    return res.status(500).json({ ok: false, message: 'Error al confirmar compatibilidad' });
  }
};

const revisarTrayectoria = async (req, res) => {
  try {
    const { id } = req.params;

    const docente = await resolveDocenteId(req.user.id_usuario);
    if (!docente) return res.status(400).json({ ok: false, message: 'Perfil docente no encontrado' });

    const filter = buildDocenteFilter(docente.id_docente);
    const [tramites] = await db.query(
      `SELECT t.id_alumno FROM tramites t WHERE t.id_tramite = ? AND ${filter}`,
      [id]
    );
    if (tramites.length === 0) return res.status(404).json({ ok: false, message: 'Trámite no encontrado o sin acceso' });
    const idAlumno = tramites[0].id_alumno;

    const [historialAcademico] = await db.query(
      `SELECT i.id_inscripcion, i.id_periodo, p.nombre_periodo, p.fecha_inicio, p.fecha_fin,
              i.semestre, i.estado_inscripcion, i.promedio_general,
              i.materias_acreditadas, i.materias_reprobadas
       FROM inscripciones i
       JOIN periodos p ON p.id_periodo = i.id_periodo
       WHERE i.id_alumno = ?
       ORDER BY p.fecha_inicio DESC`, [idAlumno]
    );
    const [kardex] = await db.query(
      `SELECT k.*, m.nombre_materia, m.clave_materia, m.creditos
       FROM kardex k
       JOIN materias m ON m.id_materia = k.id_materia
       WHERE k.id_alumno = ?
       ORDER BY k.periodo_cursado DESC, m.nombre_materia`, [idAlumno]
    );
    const [alumno] = await db.query(
      `SELECT a.id_alumno, a.matricula, a.nombres, a.apellido_paterno, a.apellido_materno,
              a.semestre_actual, a.estatus_academico, c.nombre_carrera
       FROM alumnos a
       LEFT JOIN carreras c ON c.id_carrera = a.id_carrera
       WHERE a.id_alumno = ?`, [idAlumno]
    );

    return res.json({
      ok: true,
      data: {
        alumno: alumno[0] || null,
        historial: historialAcademico,
        kardex: kardex
      }
    });
  } catch (error) {
    console.error('Error revisando trayectoria:', error);
    return res.status(500).json({ ok: false, message: 'Error al revisar trayectoria académica' });
  }
};

const agregarObservacionDocente = async (req, res) => {
  try {
    const { id } = req.params;
    const { observacion, tipo } = req.body;

    if (!observacion) return res.status(400).json({ ok: false, message: 'Observación requerida' });

    const docente = await resolveDocenteId(req.user.id_usuario);
    if (!docente) return res.status(400).json({ ok: false, message: 'Perfil docente no encontrado' });

    const filter = buildDocenteFilter(docente.id_docente);
    const [tramites] = await db.query(
      `SELECT id_tramite, folio FROM tramites t WHERE t.id_tramite = ? AND ${filter}`,
      [id]
    );
    if (tramites.length === 0) return res.status(404).json({ ok: false, message: 'Trámite no encontrado o sin acceso' });

    await db.query(
      `INSERT INTO tramites_observaciones (id_tramite, id_usuario, tipo, observacion)
       VALUES (?, ?, ?, ?)`,
      [id, req.user.id_usuario, tipo || 'OPINION_DOCENTE', observacion]
    );

    await registrarAuditoria(id, req.user.id_usuario, 'OBSERVACION_DOCENTE',
      `Observación docente (${tipo || 'OPINION_DOCENTE'}) en ${tramites[0].folio}`, req);

    return res.status(201).json({ ok: true, message: 'Observación registrada' });
  } catch (error) {
    console.error('Error agregando observación docente:', error);
    return res.status(500).json({ ok: false, message: 'Error al agregar observación' });
  }
};

const validarObservaciones = async (req, res) => {
  try {
    const { id } = req.params;
    const { observacion } = req.body;

    const docente = await resolveDocenteId(req.user.id_usuario);
    if (!docente) return res.status(400).json({ ok: false, message: 'Perfil docente no encontrado' });

    const filter = buildDocenteFilter(docente.id_docente);
    const [tramites] = await db.query(
      `SELECT id_tramite, folio FROM tramites t WHERE t.id_tramite = ? AND ${filter}`,
      [id]
    );
    if (tramites.length === 0) return res.status(404).json({ ok: false, message: 'Trámite no encontrado o sin acceso' });

    await db.query(
      `INSERT INTO tramites_observaciones (id_tramite, id_usuario, tipo, observacion)
       VALUES (?, ?, 'VALIDACION', ?)`,
      [id, req.user.id_usuario, observacion || 'Observaciones validadas por docente']
    );

    await registrarAuditoria(id, req.user.id_usuario, 'VALIDAR_OBSERVACIONES',
      `Observaciones validadas por docente en ${tramites[0].folio}`, req);

    return res.json({ ok: true, message: 'Observaciones validadas exitosamente' });
  } catch (error) {
    console.error('Error validando observaciones:', error);
    return res.status(500).json({ ok: false, message: 'Error al validar observaciones' });
  }
};

const catalogos = async (req, res) => {
  try {
    const [tipos] = await db.query('SELECT * FROM tramites_tipos WHERE activo = 1 ORDER BY nombre');
    const [estados] = await db.query('SELECT * FROM tramites_estados ORDER BY orden');
    const [carreras] = await db.query('SELECT id_carrera, nombre_carrera FROM carreras ORDER BY nombre_carrera');
    return res.json({ ok: true, data: { tipos, estados, carreras } });
  } catch (error) {
    console.error('Error en catálogos:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener catálogos' });
  }
};

const reportes = async (req, res) => {
  try {
    const docente = await resolveDocenteId(req.user.id_usuario);
    if (!docente) return res.status(400).json({ ok: false, message: 'Perfil docente no encontrado' });

    const { tipo, desde, hasta, estado } = req.query;
    const params = [];
    const filter = buildDocenteFilter(docente.id_docente);

    let sql = `
      SELECT DISTINCT t.id_tramite, t.folio, tt.nombre AS tipo_tramite,
        CONCAT(a.nombres, ' ', a.apellido_paterno, ' ', a.apellido_materno) AS alumno,
        a.matricula, c.nombre_carrera, t.estado_actual,
        t.docente_opinion_emitida,
        t.creado_en, t.actualizado_en
      FROM tramites t
      JOIN tramites_tipos tt ON tt.id_tipo = t.id_tipo
      JOIN alumnos a ON a.id_alumno = t.id_alumno
      LEFT JOIN carreras c ON c.id_carrera = a.id_carrera
      WHERE ${filter}
    `;
    if (tipo) { sql += ' AND tt.codigo = ?'; params.push(tipo); }
    if (estado) { sql += ' AND t.estado_actual = ?'; params.push(estado); }
    if (desde) { sql += ' AND t.creado_en >= ?'; params.push(desde); }
    if (hasta) { sql += ' AND t.creado_en <= ?'; params.push(hasta); }
    sql += ' ORDER BY t.creado_en DESC LIMIT 500';

    const [rows] = await db.query(sql, params);
    return res.json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error en reportes:', error);
    return res.status(500).json({ ok: false, message: 'Error al generar reportes' });
  }
};

const bitacora = async (req, res) => {
  try {
    const params = [];
    let sql = `
      SELECT ta.*, u.nombres, u.apellido_paterno, t.folio
      FROM tramites_auditoria ta
      LEFT JOIN usuarios u ON u.id_usuario = ta.id_usuario
      LEFT JOIN tramites t ON t.id_tramite = ta.id_tramite
      WHERE ta.accion IN ('OPINION_DOCENTE','OBSERVACION_DOCENTE','VALIDAR_MATERIAS','VALIDAR_OBSERVACIONES')
    `;
    if (req.query.tramite_id) { sql += ' AND ta.id_tramite = ?'; params.push(req.query.tramite_id); }
    sql += ' ORDER BY ta.creado_en DESC LIMIT 200';
    const [rows] = await db.query(sql, params);
    return res.json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error en bitácora:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener bitácora' });
  }
};

module.exports = {
  resumen, misGrupos, alumnosGrupo, bandeja, obtenerTramite,
  emitirOpinionAcademica, confirmarCompatibilidad, revisarTrayectoria,
  agregarObservacionDocente, validarObservaciones,
  catalogos, reportes, bitacora
};
