const db = require('../config/db');

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

async function registrarHistorialEstado(id_tramite, anterior, nuevo, cambiado_por, obs) {
  try {
    await db.query(
      `INSERT INTO tramites_historial_estados (id_tramite, estado_anterior, estado_nuevo, cambiado_por, observaciones)
       VALUES (?, ?, ?, ?, ?)`,
      [id_tramite, anterior, nuevo, cambiado_por, obs || null]
    );
  } catch (err) {
    console.error('Error registrando historial:', err);
  }
}

async function registrarBitacora(id_usuario, accion, detalle, req) {
  try {
    await db.query(
      `INSERT INTO bitacora_auditoria (id_usuario, modulo, accion, detalle, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id_usuario, 'TRAMITES_COORD', accion, detalle || null,
        req?.ip || req?.headers?.['x-forwarded-for'] || req?.connection?.remoteAddress || null,
        req?.headers?.['user-agent'] || null]
    );
  } catch (err) {
    console.error('Error registrando bitácora:', err);
  }
}

const bandeja = async (req, res) => {
  try {
    const estadosVisibles = ['SOLICITADO', 'EN_REVISION', 'EN_ANALISIS', 'DICTAMINADO', 'VALIDADO'];
    const params = [];
    let sql = `
      SELECT t.id_tramite, t.folio, tt.nombre AS tipo_tramite, tt.codigo AS tipo_codigo,
        CONCAT(a.nombres, ' ', a.apellido_paterno, ' ', a.apellido_materno) AS alumno_nombre,
        a.matricula, a.curp, c.nombre_carrera, a.semestre_actual,
        t.estado_actual, t.motivo, t.dictamen_tipo, t.procedencia_academica,
        t.solicitud_validada, t.validado_coordinador,
        t.creado_en, t.actualizado_en,
        u_sol.nombres AS sol_nombre, u_sol.apellido_paterno AS sol_apellido
      FROM tramites t
      JOIN tramites_tipos tt ON tt.id_tipo = t.id_tipo
      JOIN alumnos a ON a.id_alumno = t.id_alumno
      LEFT JOIN carreras c ON c.id_carrera = a.id_carrera
      JOIN usuarios u_sol ON u_sol.id_usuario = t.id_usuario_solicitante
      WHERE t.estado_actual IN (?)
    `;
    params.push(estadosVisibles);

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
    if (req.query.carrera) {
      sql += ' AND a.id_carrera = ?';
      params.push(req.query.carrera);
    }

    sql += ' ORDER BY t.creado_en DESC LIMIT 200';

    const [rows] = await db.query(sql, params);
    return res.json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error en bandeja coordinador:', error);
    return res.status(500).json({ ok: false, message: 'Error al cargar bandeja' });
  }
};

const obtenerTramite = async (req, res) => {
  try {
    const { id } = req.params;
    const [tramites] = await db.query(
      `SELECT t.*, tt.nombre AS tipo_tramite, tt.codigo AS tipo_codigo,
        CONCAT(a.nombres, ' ', a.apellido_paterno, ' ', a.apellido_materno) AS alumno_nombre,
        a.matricula, a.curp, a.semestre_actual, c.nombre_carrera,
        u_sol.nombres AS sol_nombre, u_sol.apellido_paterno AS sol_apellido, u_sol.correo_institucional AS sol_correo,
        u_proc.nombres AS proc_nombre, u_proc.apellido_paterno AS proc_apellido,
        u_val.nombres AS val_nombre, u_val.apellido_paterno AS val_apellido
      FROM tramites t
      JOIN tramites_tipos tt ON tt.id_tipo = t.id_tipo
      JOIN alumnos a ON a.id_alumno = t.id_alumno
      LEFT JOIN carreras c ON c.id_carrera = a.id_carrera
      JOIN usuarios u_sol ON u_sol.id_usuario = t.id_usuario_solicitante
      LEFT JOIN usuarios u_proc ON u_proc.id_usuario = t.procedencia_determinada_por
      LEFT JOIN usuarios u_val ON u_val.id_usuario = t.validado_coordinador_por
      WHERE t.id_tramite = ?`,
      [id]
    );
    if (tramites.length === 0) {
      return res.status(404).json({ ok: false, message: 'Trámite no encontrado' });
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
    console.error('Error obteniendo trámite:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener trámite' });
  }
};

const pasarARevision = async (req, res) => {
  try {
    const { id } = req.params;
    const { observaciones } = req.body;
    const [tramites] = await db.query('SELECT * FROM tramites WHERE id_tramite = ?', [id]);
    if (tramites.length === 0) return res.status(404).json({ ok: false, message: 'Trámite no encontrado' });
    const t = tramites[0];
    if (t.estado_actual !== 'SOLICITADO') {
      return res.status(400).json({ ok: false, message: 'El trámite debe estar en estado Solicitado' });
    }

    await db.query(
      `UPDATE tramites SET estado_actual = 'EN_REVISION', observaciones = COALESCE(NULLIF(?, ''), observaciones) WHERE id_tramite = ?`,
      [observaciones, id]
    );
    await registrarHistorialEstado(id, t.estado_actual, 'EN_REVISION', req.user.id_usuario, observaciones);
    await registrarAuditoria(id, req.user.id_usuario, 'TOMAR_REVISION', `Coordinador tomó el trámite ${t.folio} para revisión`, req);
    await registrarBitacora(req.user.id_usuario, 'REVISAR_TRAMITE', `Coordinador inició revisión: ${t.folio}`, req);
    return res.json({ ok: true, message: 'Trámite en revisión' });
  } catch (error) {
    console.error('Error al pasar a revisión:', error);
    return res.status(500).json({ ok: false, message: 'Error al cambiar estado' });
  }
};

const pasarAAnalisis = async (req, res) => {
  try {
    const { id } = req.params;
    const { analisis_curricular } = req.body;
    const [tramites] = await db.query('SELECT * FROM tramites WHERE id_tramite = ?', [id]);
    if (tramites.length === 0) return res.status(404).json({ ok: false, message: 'Trámite no encontrado' });
    const t = tramites[0];
    if (t.estado_actual !== 'EN_REVISION') {
      return res.status(400).json({ ok: false, message: 'El trámite debe estar en Revisión' });
    }

    await db.query(
      `UPDATE tramites SET estado_actual = 'EN_ANALISIS', analisis_curricular = ? WHERE id_tramite = ?`,
      [analisis_curricular || null, id]
    );
    await registrarHistorialEstado(id, t.estado_actual, 'EN_ANALISIS', req.user.id_usuario, analisis_curricular);
    await registrarAuditoria(id, req.user.id_usuario, 'INICIAR_ANALISIS', `Análisis curricular iniciado para ${t.folio}`, req);
    return res.json({ ok: true, message: 'Trámite en análisis' });
  } catch (error) {
    console.error('Error al pasar a análisis:', error);
    return res.status(500).json({ ok: false, message: 'Error al cambiar estado' });
  }
};

const determinarProcedencia = async (req, res) => {
  try {
    const { id } = req.params;
    const { procede, fundamento, observaciones } = req.body;

    if (procede === undefined || procede === null) {
      return res.status(400).json({ ok: false, message: 'Indique si procede (true/false)' });
    }

    const [tramites] = await db.query('SELECT * FROM tramites WHERE id_tramite = ?', [id]);
    if (tramites.length === 0) return res.status(404).json({ ok: false, message: 'Trámite no encontrado' });
    const t = tramites[0];
    if (!['EN_REVISION', 'EN_ANALISIS'].includes(t.estado_actual)) {
      return res.status(400).json({ ok: false, message: 'El trámite debe estar en Revisión o Análisis' });
    }

    const nuevoEstado = procede ? 'DICTAMINADO' : 'RECHAZADO';

    await db.query(
      `UPDATE tramites SET
        estado_actual = ?,
        procedencia_academica = ?,
        procedencia_determinada_por = ?,
        procedencia_determinada_en = NOW(),
        analisis_curricular = COALESCE(NULLIF(?, ''), analisis_curricular),
        observaciones = CONCAT(COALESCE(observaciones, ''), '\n', COALESCE(NULLIF(?, ''), ''))
      WHERE id_tramite = ?`,
      [nuevoEstado, procede ? 1 : 0, req.user.id_usuario, fundamento || null, observaciones || null, id]
    );

    await registrarHistorialEstado(id, t.estado_actual, nuevoEstado, req.user.id_usuario, fundamento);
    await registrarAuditoria(id, req.user.id_usuario, 'DETERMINAR_PROCEDENCIA',
      `Procedencia: ${procede ? 'FAVORABLE' : 'NO PROCEDE'} - ${t.folio}`, req);
    await registrarBitacora(req.user.id_usuario, 'PROCEDENCIA_TRAMITE',
      `Procedencia ${procede ? 'favorable' : 'desfavorable'}: ${t.folio}`, req);

    return res.json({ ok: true, message: `Procedencia determinada: ${procede ? 'Procede' : 'No procede'}` });
  } catch (error) {
    console.error('Error determinando procedencia:', error);
    return res.status(500).json({ ok: false, message: 'Error al determinar procedencia' });
  }
};

const validarTramite = async (req, res) => {
  try {
    const { id } = req.params;
    const { observaciones } = req.body;

    const [tramites] = await db.query('SELECT * FROM tramites WHERE id_tramite = ?', [id]);
    if (tramites.length === 0) return res.status(404).json({ ok: false, message: 'Trámite no encontrado' });
    const t = tramites[0];
    if (t.estado_actual !== 'DICTAMINADO') {
      return res.status(400).json({ ok: false, message: 'El trámite debe estar Dictaminado' });
    }

    await db.query(
      `UPDATE tramites SET
        estado_actual = 'VALIDADO',
        validado_coordinador = 1,
        validado_coordinador_por = ?,
        validado_coordinador_en = NOW(),
        observaciones = COALESCE(NULLIF(?, ''), observaciones)
      WHERE id_tramite = ?`,
      [req.user.id_usuario, observaciones, id]
    );

    await registrarHistorialEstado(id, t.estado_actual, 'VALIDADO', req.user.id_usuario, observaciones);
    await registrarAuditoria(id, req.user.id_usuario, 'VALIDAR_TRAMITE', `Coordinador validó trámite ${t.folio}`, req);
    await registrarBitacora(req.user.id_usuario, 'VALIDAR_TRAMITE', `Trámite validado por coordinador: ${t.folio}`, req);

    return res.json({ ok: true, message: 'Trámite validado exitosamente' });
  } catch (error) {
    console.error('Error validando trámite:', error);
    return res.status(500).json({ ok: false, message: 'Error al validar trámite' });
  }
};

const rechazarTramite = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo_rechazo } = req.body;
    if (!motivo_rechazo) return res.status(400).json({ ok: false, message: 'Motivo de rechazo requerido' });

    const [tramites] = await db.query('SELECT * FROM tramites WHERE id_tramite = ?', [id]);
    if (tramites.length === 0) return res.status(404).json({ ok: false, message: 'Trámite no encontrado' });
    const t = tramites[0];

    if (!['SOLICITADO', 'EN_REVISION', 'EN_ANALISIS'].includes(t.estado_actual)) {
      return res.status(400).json({ ok: false, message: 'No se puede rechazar en el estado actual' });
    }

    await db.query(
      `UPDATE tramites SET estado_actual = 'RECHAZADO', observaciones = CONCAT(COALESCE(observaciones, ''), '\nRECHAZO: ', ?) WHERE id_tramite = ?`,
      [motivo_rechazo, id]
    );
    await registrarHistorialEstado(id, t.estado_actual, 'RECHAZADO', req.user.id_usuario, motivo_rechazo);
    await registrarAuditoria(id, req.user.id_usuario, 'RECHAZAR', `${t.folio} rechazado: ${motivo_rechazo}`, req);
    await registrarBitacora(req.user.id_usuario, 'RECHAZAR_TRAMITE', `${t.folio} rechazado por coordinador`, req);

    return res.json({ ok: true, message: 'Trámite rechazado' });
  } catch (error) {
    console.error('Error rechazando:', error);
    return res.status(500).json({ ok: false, message: 'Error al rechazar' });
  }
};

const agregarObservacion = async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo, observacion, documento_referencia } = req.body;

    if (!observacion) return res.status(400).json({ ok: false, message: 'Observación requerida' });

    const [tramites] = await db.query('SELECT id_tramite, folio FROM tramites WHERE id_tramite = ?', [id]);
    if (tramites.length === 0) return res.status(404).json({ ok: false, message: 'Trámite no encontrado' });

    await db.query(
      `INSERT INTO tramites_observaciones (id_tramite, id_usuario, tipo, observacion, documento_referencia)
       VALUES (?, ?, ?, ?, ?)`,
      [id, req.user.id_usuario, tipo || 'OBSERVACION_GRAL', observacion, documento_referencia || null]
    );

    await registrarAuditoria(id, req.user.id_usuario, 'AGREGAR_OBSERVACION',
      `Observación (${tipo || 'GRAL'}) en ${tramites[0].folio}`, req);

    return res.status(201).json({ ok: true, message: 'Observación registrada' });
  } catch (error) {
    console.error('Error agregando observación:', error);
    return res.status(500).json({ ok: false, message: 'Error al agregar observación' });
  }
};

const validarDocumento = async (req, res) => {
  try {
    const { id } = req.params;
    const { id_documento, observaciones } = req.body;

    const [tramites] = await db.query('SELECT id_tramite, folio FROM tramites WHERE id_tramite = ?', [id]);
    if (tramites.length === 0) return res.status(404).json({ ok: false, message: 'Trámite no encontrado' });

    const [docs] = await db.query('SELECT * FROM tramites_documentos WHERE id_documento = ? AND id_tramite = ?', [id_documento, id]);
    if (docs.length === 0) return res.status(404).json({ ok: false, message: 'Documento no encontrado' });

    await db.query(
      `UPDATE tramites_documentos SET validado = 1, validado_por = ?, validado_en = NOW(), observaciones = COALESCE(NULLIF(?, ''), observaciones) WHERE id_documento = ?`,
      [req.user.id_usuario, observaciones, id_documento]
    );

    await registrarAuditoria(id, req.user.id_usuario, 'VALIDAR_DOCUMENTO',
      `Documento ${docs[0].tipo_documento} validado en ${tramites[0].folio}`, req);

    return res.json({ ok: true, message: 'Documento validado' });
  } catch (error) {
    console.error('Error validando documento:', error);
    return res.status(500).json({ ok: false, message: 'Error al validar documento' });
  }
};

const catalogos = async (req, res) => {
  try {
    const [tipos] = await db.query('SELECT * FROM tramites_tipos WHERE activo = 1 ORDER BY nombre');
    const [estados] = await db.query('SELECT * FROM tramites_estados ORDER BY orden');
    const [carreras] = await db.query('SELECT id_carrera, nombre_carrera FROM carreras ORDER BY nombre_carrera');
    const [periodos] = await db.query('SELECT * FROM periodos ORDER BY fecha_inicio DESC');
    return res.json({ ok: true, data: { tipos, estados, carreras, periodos } });
  } catch (error) {
    console.error('Error en catálogos:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener catálogos' });
  }
};

const resumen = async (req, res) => {
  try {
    const estadosVisibles = ['SOLICITADO', 'EN_REVISION', 'EN_ANALISIS', 'DICTAMINADO', 'VALIDADO'];

    const [total] = await db.query(
      'SELECT COUNT(*) AS total FROM tramites WHERE estado_actual IN (?)', [estadosVisibles]
    );
    const [porEstado] = await db.query(
      `SELECT estado_actual, COUNT(*) AS cantidad FROM tramites WHERE estado_actual IN (?) GROUP BY estado_actual ORDER BY estado_actual`,
      [estadosVisibles]
    );
    const [porTipo] = await db.query(
      `SELECT tt.nombre, tt.codigo, COUNT(*) AS cantidad
       FROM tramites t JOIN tramites_tipos tt ON tt.id_tipo = t.id_tipo
       WHERE t.estado_actual IN (?)
       GROUP BY tt.id_tipo, tt.nombre, tt.codigo`, [estadosVisibles]
    );
    const [pendientes] = await db.query(
      "SELECT COUNT(*) AS pendientes FROM tramites WHERE estado_actual IN ('SOLICITADO', 'EN_REVISION', 'EN_ANALISIS')"
    );
    const [dictaminados] = await db.query(
      "SELECT COUNT(*) AS dictaminados FROM tramites WHERE estado_actual = 'DICTAMINADO'"
    );
    const [validados] = await db.query(
      "SELECT COUNT(*) AS validados FROM tramites WHERE estado_actual = 'VALIDADO'"
    );

    return res.json({
      ok: true,
      data: {
        total: total[0].total,
        por_estado: porEstado,
        por_tipo: porTipo,
        pendientes: pendientes[0].pendientes,
        dictaminados: dictaminados[0].dictaminados,
        validados: validados[0].validados
      }
    });
  } catch (error) {
    console.error('Error en resumen:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener resumen' });
  }
};

const reportes = async (req, res) => {
  try {
    const { tipo, desde, hasta, carrera } = req.query;
    const params = [];
    let sql = `
      SELECT t.id_tramite, t.folio, tt.nombre AS tipo_tramite,
        CONCAT(a.nombres, ' ', a.apellido_paterno, ' ', a.apellido_materno) AS alumno,
        a.matricula, c.nombre_carrera, t.estado_actual,
        t.dictamen_tipo, t.procedencia_academica,
        u.nombres AS coord_nombre, u.apellido_paterno AS coord_apellido,
        t.creado_en, t.actualizado_en
      FROM tramites t
      JOIN tramites_tipos tt ON tt.id_tipo = t.id_tipo
      JOIN alumnos a ON a.id_alumno = t.id_alumno
      LEFT JOIN carreras c ON c.id_carrera = a.id_carrera
      LEFT JOIN usuarios u ON u.id_usuario = t.procedencia_determinada_por
      WHERE 1=1
    `;
    if (tipo) { sql += ' AND tt.codigo = ?'; params.push(tipo); }
    if (desde) { sql += ' AND t.creado_en >= ?'; params.push(desde); }
    if (hasta) { sql += ' AND t.creado_en <= ?'; params.push(hasta); }
    if (carrera) { sql += ' AND a.id_carrera = ?'; params.push(carrera); }
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
      SELECT ta.*, u.nombres, u.apellido_paterno, u.correo_institucional, t.folio
      FROM tramites_auditoria ta
      LEFT JOIN usuarios u ON u.id_usuario = ta.id_usuario
      LEFT JOIN tramites t ON t.id_tramite = ta.id_tramite
      WHERE ta.accion IN ('TOMAR_REVISION','INICIAR_ANALISIS','DETERMINAR_PROCEDENCIA','VALIDAR_TRAMITE','RECHAZAR','AGREGAR_OBSERVACION','VALIDAR_DOCUMENTO')
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
  bandeja, obtenerTramite, catalogos, resumen, reportes, bitacora,
  pasarARevision, pasarAAnalisis, determinarProcedencia, validarTramite,
  rechazarTramite, agregarObservacion, validarDocumento
};
