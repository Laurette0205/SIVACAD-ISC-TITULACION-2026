const db = require('../config/db');

function generarFolio(contador) {
  const year = new Date().getFullYear();
  const num = String(contador).padStart(6, '0');
  return `TRM-${year}-${num}`;
}

async function registrarAuditoria(id_tramite, id_usuario, accion, detalle, req) {
  try {
    await db.query(
      `INSERT INTO tramites_auditoria (id_tramite, id_usuario, accion, detalle, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id_tramite,
        id_usuario,
        accion,
        detalle || null,
        req?.ip || req?.headers?.['x-forwarded-for'] || req?.connection?.remoteAddress || null,
        req?.headers?.['user-agent'] || null
      ]
    );
  } catch (err) {
    console.error('Error registrando auditoría de trámite:', err);
  }
}

async function registrarHistorialEstado(id_tramite, estado_anterior, estado_nuevo, cambiado_por, observaciones) {
  try {
    await db.query(
      `INSERT INTO tramites_historial_estados (id_tramite, estado_anterior, estado_nuevo, cambiado_por, observaciones)
       VALUES (?, ?, ?, ?, ?)`,
      [id_tramite, estado_anterior, estado_nuevo, cambiado_por, observaciones || null]
    );
  } catch (err) {
    console.error('Error registrando historial de estado:', err);
  }
}

async function registrarEnBitacoraGeneral(id_usuario, accion, detalle, req) {
  try {
    await db.query(
      `INSERT INTO bitacora_auditoria (id_usuario, modulo, accion, detalle, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id_usuario,
        'TRAMITES_ADMIN',
        accion,
        detalle || null,
        req?.ip || req?.headers?.['x-forwarded-for'] || req?.connection?.remoteAddress || null,
        req?.headers?.['user-agent'] || null
      ]
    );
  } catch (err) {
    console.error('Error registrando en bitácora general:', err);
  }
}

const listarTramites = async (req, res) => {
  try {
    let sql = `
      SELECT
        t.id_tramite,
        t.folio,
        tt.nombre AS tipo_tramite,
        tt.codigo AS tipo_codigo,
        CONCAT(a.nombres, ' ', a.apellido_paterno, ' ', a.apellido_materno) AS alumno_nombre,
        a.matricula,
        a.curp,
        c.nombre_carrera,
        a.semestre_actual,
        t.estado_actual,
        t.motivo,
        t.solicitud_validada,
        t.documento_oficial_emitido,
        t.autorizacion_control_escolar,
        t.autorizacion_division_isc,
        t.cerrado,
        t.dictamen_tipo,
        t.folio_documento_oficial,
        t.creado_en,
        t.actualizado_en,
        u_sol.nombres AS solicitante_nombre,
        u_sol.apellido_paterno AS solicitante_apellido
      FROM tramites t
      JOIN tramites_tipos tt ON tt.id_tipo = t.id_tipo
      JOIN alumnos a ON a.id_alumno = t.id_alumno
      LEFT JOIN carreras c ON c.id_carrera = a.id_carrera
      JOIN usuarios u_sol ON u_sol.id_usuario = t.id_usuario_solicitante
    `;

    const condiciones = [];
    const params = [];

    if (req.query.tipo) {
      condiciones.push('tt.codigo = ?');
      params.push(req.query.tipo);
    }

    if (req.query.estado) {
      condiciones.push('t.estado_actual = ?');
      params.push(req.query.estado);
    }

    if (req.query.alumno_id) {
      condiciones.push('t.id_alumno = ?');
      params.push(req.query.alumno_id);
    }

    if (req.query.search) {
      const s = `%${req.query.search}%`;
      condiciones.push('(a.matricula LIKE ? OR CONCAT(a.nombres, \' \', a.apellido_paterno, \' \', a.apellido_materno) LIKE ? OR t.folio LIKE ?)');
      params.push(s, s, s);
    }

    if (req.query.periodo) {
      condiciones.push('t.id_periodo = ?');
      params.push(req.query.periodo);
    }

    if (condiciones.length > 0) {
      sql += ' WHERE ' + condiciones.join(' AND ');
    }

    sql += ' ORDER BY t.creado_en DESC';

    if (req.query.limit) {
      sql += ' LIMIT ?';
      params.push(parseInt(req.query.limit));
    }

    const [rows] = await db.query(sql, params);

    return res.json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error listando trámites:', error);
    return res.status(500).json({ ok: false, message: 'Error al listar trámites' });
  }
};

const obtenerTramite = async (req, res) => {
  try {
    const { id } = req.params;

    const [tramites] = await db.query(
      `SELECT
        t.*,
        tt.nombre AS tipo_tramite,
        tt.codigo AS tipo_codigo,
        tt.descripcion AS tipo_descripcion,
        CONCAT(a.nombres, ' ', a.apellido_paterno, ' ', a.apellido_materno) AS alumno_nombre,
        a.matricula,
        a.curp,
        a.semestre_actual,
        c.nombre_carrera,
        u_sol.nombres AS solicitante_nombre,
        u_sol.apellido_paterno AS solicitante_apellido,
        u_sol.correo_institucional AS solicitante_correo,
        u_dict.nombres AS dictaminador_nombre,
        u_dict.apellido_paterno AS dictaminador_apellido,
        u_emi.nombres AS emisor_nombre,
        u_emi.apellido_paterno AS emisor_apellido,
        u_cer.nombres AS cerrador_nombre,
        u_cer.apellido_paterno AS cerrador_apellido,
        u_val.nombres AS validador_nombre,
        u_val.apellido_paterno AS validador_apellido,
        u_ce.nombres AS control_escolar_nombre,
        u_ce.apellido_paterno AS control_escolar_apellido,
        u_dis.nombres AS division_isc_nombre,
        u_dis.apellido_paterno AS division_isc_apellido
      FROM tramites t
      JOIN tramites_tipos tt ON tt.id_tipo = t.id_tipo
      JOIN alumnos a ON a.id_alumno = t.id_alumno
      LEFT JOIN carreras c ON c.id_carrera = a.id_carrera
      JOIN usuarios u_sol ON u_sol.id_usuario = t.id_usuario_solicitante
      LEFT JOIN usuarios u_dict ON u_dict.id_usuario = t.id_coordinador_dictamen
      LEFT JOIN usuarios u_emi ON u_emi.id_usuario = t.emitido_por
      LEFT JOIN usuarios u_cer ON u_cer.id_usuario = t.cerrado_por
      LEFT JOIN usuarios u_val ON u_val.id_usuario = t.solicitud_validada_por
      LEFT JOIN usuarios u_ce ON u_ce.id_usuario = t.autorizacion_control_escolar_por
      LEFT JOIN usuarios u_dis ON u_dis.id_usuario = t.autorizacion_division_isc_por
      WHERE t.id_tramite = ?`,
      [id]
    );

    if (tramites.length === 0) {
      return res.status(404).json({ ok: false, message: 'Trámite no encontrado' });
    }

    const [documentos] = await db.query(
      `SELECT * FROM tramites_documentos WHERE id_tramite = ? ORDER BY subido_en DESC`,
      [id]
    );

    const [historial] = await db.query(
      `SELECT h.*, u.nombres, u.apellido_paterno
       FROM tramites_historial_estados h
       LEFT JOIN usuarios u ON u.id_usuario = h.cambiado_por
       WHERE h.id_tramite = ?
       ORDER BY h.creado_en DESC`,
      [id]
    );

    return res.json({
      ok: true,
      data: {
        ...tramites[0],
        documentos,
        historial_estados: historial
      }
    });
  } catch (error) {
    console.error('Error obteniendo trámite:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener trámite' });
  }
};

const catalogos = async (req, res) => {
  try {
    const [tipos] = await db.query('SELECT * FROM tramites_tipos WHERE activo = 1 ORDER BY nombre');
    const [estados] = await db.query('SELECT * FROM tramites_estados ORDER BY orden');
    const [alumnos] = await db.query(`
      SELECT a.id_alumno, CONCAT(a.nombres, ' ', a.apellido_paterno, ' ', a.apellido_materno) AS nombre_completo,
             a.matricula, c.nombre_carrera
      FROM alumnos a
      LEFT JOIN carreras c ON c.id_carrera = a.id_carrera
      ORDER BY a.apellido_paterno, a.apellido_materno
    `);
    const [periodos] = await db.query('SELECT * FROM periodos ORDER BY fecha_inicio DESC');

    return res.json({ ok: true, data: { tipos, estados, alumnos, periodos } });
  } catch (error) {
    console.error('Error obteniendo catálogos:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener catálogos' });
  }
};

const crearTramite = async (req, res) => {
  try {
    const { id_tipo, id_alumno, motivo, id_periodo } = req.body;

    if (!id_tipo || !id_alumno) {
      return res.status(400).json({ ok: false, message: 'Tipo de trámite y alumno son requeridos' });
    }

    const [config] = await db.query(
      "SELECT valor FROM tramites_configuracion WHERE clave = 'folio_contador'"
    );
    let contador = parseInt(config[0]?.valor || '0');
    contador++;

    const folio = generarFolio(contador);

    await db.query(
      "UPDATE tramites_configuracion SET valor = ? WHERE clave = 'folio_contador'",
      [String(contador)]
    );

    const [result] = await db.query(
      `INSERT INTO tramites (folio, id_tipo, id_alumno, id_usuario_solicitante, id_periodo, estado_actual, motivo)
       VALUES (?, ?, ?, ?, ?, 'SOLICITADO', ?)`,
      [folio, id_tipo, id_alumno, req.user.id_usuario, id_periodo || null, motivo || null]
    );

    const id_tramite = result.insertId;

    await registrarHistorialEstado(id_tramite, null, 'SOLICITADO', req.user.id_usuario, 'Creación del trámite');

    await registrarAuditoria(id_tramite, req.user.id_usuario, 'CREAR', `Trámite ${folio} creado`, req);

    await registrarEnBitacoraGeneral(req.user.id_usuario, 'CREAR_TRAMITE', `Trámite ${folio} creado para alumno ID ${id_alumno}`, req);

    return res.status(201).json({
      ok: true,
      message: 'Trámite creado exitosamente',
      data: { id_tramite, folio }
    });
  } catch (error) {
    console.error('Error creando trámite:', error);
    return res.status(500).json({ ok: false, message: 'Error al crear trámite' });
  }
};

const validarSolicitud = async (req, res) => {
  try {
    const { id } = req.params;
    const { observaciones } = req.body;

    const [tramites] = await db.query('SELECT * FROM tramites WHERE id_tramite = ?', [id]);
    if (tramites.length === 0) {
      return res.status(404).json({ ok: false, message: 'Trámite no encontrado' });
    }

    const tramite = tramites[0];

    await db.query(
      `UPDATE tramites SET
        solicitud_validada = 1,
        solicitud_validada_por = ?,
        solicitud_validada_en = NOW(),
        estado_actual = 'EN_REVISION',
        observaciones = COALESCE(NULLIF(?, ''), observaciones)
      WHERE id_tramite = ?`,
      [req.user.id_usuario, observaciones, id]
    );

    await registrarHistorialEstado(id, tramite.estado_actual, 'EN_REVISION', req.user.id_usuario, observaciones);
    await registrarAuditoria(id, req.user.id_usuario, 'VALIDAR_SOLICITUD', `Solicitud validada para trámite ${tramite.folio}`, req);
    await registrarEnBitacoraGeneral(req.user.id_usuario, 'VALIDAR_TRAMITE', `Solicitud validada: ${tramite.folio}`, req);

    return res.json({ ok: true, message: 'Solicitud validada exitosamente' });
  } catch (error) {
    console.error('Error validando solicitud:', error);
    return res.status(500).json({ ok: false, message: 'Error al validar solicitud' });
  }
};

const emitirDictamen = async (req, res) => {
  try {
    const { id } = req.params;
    const { dictamen, dictamen_tipo } = req.body;

    if (!dictamen || !dictamen_tipo) {
      return res.status(400).json({ ok: false, message: 'Dictamen y tipo son requeridos' });
    }

    if (!['FAVORABLE', 'DESFAVORABLE'].includes(dictamen_tipo)) {
      return res.status(400).json({ ok: false, message: 'Tipo de dictamen inválido' });
    }

    const [tramites] = await db.query('SELECT * FROM tramites WHERE id_tramite = ?', [id]);
    if (tramites.length === 0) {
      return res.status(404).json({ ok: false, message: 'Trámite no encontrado' });
    }

    const tramite = tramites[0];
    const nuevoEstado = dictamen_tipo === 'FAVORABLE' ? 'APROBADO' : 'RECHAZADO';

    await db.query(
      `UPDATE tramites SET
        id_coordinador_dictamen = ?,
        dictamen = ?,
        dictamen_tipo = ?,
        dictamen_en = NOW(),
        estado_actual = ?
      WHERE id_tramite = ?`,
      [req.user.id_usuario, dictamen, dictamen_tipo, nuevoEstado, id]
    );

    await registrarHistorialEstado(id, tramite.estado_actual, nuevoEstado, req.user.id_usuario, dictamen);
    await registrarAuditoria(id, req.user.id_usuario, 'EMITIR_DICTAMEN', `Dictamen ${dictamen_tipo} para trámite ${tramite.folio}`, req);
    await registrarEnBitacoraGeneral(req.user.id_usuario, 'DICTAMINAR_TRAMITE', `Dictamen ${dictamen_tipo}: ${tramite.folio}`, req);

    return res.json({ ok: true, message: `Dictamen ${dictamen_tipo === 'FAVORABLE' ? 'favorable' : 'desfavorable'} registrado` });
  } catch (error) {
    console.error('Error emitiendo dictamen:', error);
    return res.status(500).json({ ok: false, message: 'Error al emitir dictamen' });
  }
};

const autorizarControlEscolar = async (req, res) => {
  try {
    const { id } = req.params;
    const { observaciones } = req.body;

    const [tramites] = await db.query('SELECT * FROM tramites WHERE id_tramite = ?', [id]);
    if (tramites.length === 0) {
      return res.status(404).json({ ok: false, message: 'Trámite no encontrado' });
    }

    const tramite = tramites[0];

    await db.query(
      `UPDATE tramites SET
        autorizacion_control_escolar = 1,
        autorizacion_control_escolar_por = ?,
        autorizacion_control_escolar_en = NOW(),
        observaciones = COALESCE(NULLIF(?, ''), observaciones)
      WHERE id_tramite = ?`,
      [req.user.id_usuario, observaciones, id]
    );

    await registrarAuditoria(id, req.user.id_usuario, 'AUTORIZAR_CONTROL_ESCOLAR', `Autorización de Control Escolar para trámite ${tramite.folio}`, req);
    await registrarEnBitacoraGeneral(req.user.id_usuario, 'AUTORIZAR_CE_TRAMITE', `Control Escolar autorizó: ${tramite.folio}`, req);

    return res.json({ ok: true, message: 'Autorización de Control Escolar registrada' });
  } catch (error) {
    console.error('Error autorizando control escolar:', error);
    return res.status(500).json({ ok: false, message: 'Error al autorizar Control Escolar' });
  }
};

const autorizarDivisionISC = async (req, res) => {
  try {
    const { id } = req.params;
    const { observaciones } = req.body;

    const [tramites] = await db.query('SELECT * FROM tramites WHERE id_tramite = ?', [id]);
    if (tramites.length === 0) {
      return res.status(404).json({ ok: false, message: 'Trámite no encontrado' });
    }

    const tramite = tramites[0];

    await db.query(
      `UPDATE tramites SET
        autorizacion_division_isc = 1,
        autorizacion_division_isc_por = ?,
        autorizacion_division_isc_en = NOW(),
        observaciones = COALESCE(NULLIF(?, ''), observaciones)
      WHERE id_tramite = ?`,
      [req.user.id_usuario, observaciones, id]
    );

    await registrarAuditoria(id, req.user.id_usuario, 'AUTORIZAR_DIVISION_ISC', `Autorización de División ISC para trámite ${tramite.folio}`, req);
    await registrarEnBitacoraGeneral(req.user.id_usuario, 'AUTORIZAR_DIV_ISC_TRAMITE', `División ISC autorizó: ${tramite.folio}`, req);

    return res.json({ ok: true, message: 'Autorización de División ISC registrada' });
  } catch (error) {
    console.error('Error autorizando división ISC:', error);
    return res.status(500).json({ ok: false, message: 'Error al autorizar División ISC' });
  }
};

const emitirDocumentoOficial = async (req, res) => {
  try {
    const { id } = req.params;
    const { folio_documento, observaciones } = req.body;

    const [tramites] = await db.query('SELECT * FROM tramites WHERE id_tramite = ?', [id]);
    if (tramites.length === 0) {
      return res.status(404).json({ ok: false, message: 'Trámite no encontrado' });
    }

    const tramite = tramites[0];

    await db.query(
      `UPDATE tramites SET
        documento_oficial_emitido = 1,
        emitido_en = NOW(),
        emitido_por = ?,
        folio_documento_oficial = ?,
        estado_actual = 'EMITIDO',
        observaciones = COALESCE(NULLIF(?, ''), observaciones)
      WHERE id_tramite = ?`,
      [req.user.id_usuario, folio_documento || null, observaciones, id]
    );

    await registrarHistorialEstado(id, tramite.estado_actual, 'EMITIDO', req.user.id_usuario, `Documento oficial emitido: ${folio_documento || 'Sin folio'}`);
    await registrarAuditoria(id, req.user.id_usuario, 'EMITIR_DOCUMENTO', `Documento oficial emitido para trámite ${tramite.folio}. Folio: ${folio_documento || 'N/A'}`, req);
    await registrarEnBitacoraGeneral(req.user.id_usuario, 'EMITIR_DOC_TRAMITE', `Documento emitido: ${tramite.folio} - Folio: ${folio_documento || 'N/A'}`, req);

    return res.json({ ok: true, message: 'Documento oficial emitido exitosamente' });
  } catch (error) {
    console.error('Error emitiendo documento:', error);
    return res.status(500).json({ ok: false, message: 'Error al emitir documento oficial' });
  }
};

const cerrarTramite = async (req, res) => {
  try {
    const { id } = req.params;
    const { observaciones } = req.body;

    const [tramites] = await db.query('SELECT * FROM tramites WHERE id_tramite = ?', [id]);
    if (tramites.length === 0) {
      return res.status(404).json({ ok: false, message: 'Trámite no encontrado' });
    }

    const tramite = tramites[0];

    await db.query(
      `UPDATE tramites SET
        cerrado = 1,
        cerrado_en = NOW(),
        cerrado_por = ?,
        estado_actual = 'CERRADO',
        observaciones = COALESCE(NULLIF(?, ''), observaciones)
      WHERE id_tramite = ?`,
      [req.user.id_usuario, observaciones, id]
    );

    await registrarHistorialEstado(id, tramite.estado_actual, 'CERRADO', req.user.id_usuario, observaciones);
    await registrarAuditoria(id, req.user.id_usuario, 'CERRAR', `Trámite ${tramite.folio} cerrado`, req);
    await registrarEnBitacoraGeneral(req.user.id_usuario, 'CERRAR_TRAMITE', `Trámite cerrado: ${tramite.folio}`, req);

    return res.json({ ok: true, message: 'Trámite cerrado exitosamente' });
  } catch (error) {
    console.error('Error cerrando trámite:', error);
    return res.status(500).json({ ok: false, message: 'Error al cerrar trámite' });
  }
};

const rechazarTramite = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo_rechazo } = req.body;

    if (!motivo_rechazo) {
      return res.status(400).json({ ok: false, message: 'Motivo de rechazo es requerido' });
    }

    const [tramites] = await db.query('SELECT * FROM tramites WHERE id_tramite = ?', [id]);
    if (tramites.length === 0) {
      return res.status(404).json({ ok: false, message: 'Trámite no encontrado' });
    }

    const tramite = tramites[0];

    await db.query(
      `UPDATE tramites SET
        estado_actual = 'RECHAZADO',
        observaciones = CONCAT(COALESCE(observaciones, ''), '\nRECHAZO: ', ?)
      WHERE id_tramite = ?`,
      [motivo_rechazo, id]
    );

    await registrarHistorialEstado(id, tramite.estado_actual, 'RECHAZADO', req.user.id_usuario, motivo_rechazo);
    await registrarAuditoria(id, req.user.id_usuario, 'RECHAZAR', `Trámite ${tramite.folio} rechazado: ${motivo_rechazo}`, req);
    await registrarEnBitacoraGeneral(req.user.id_usuario, 'RECHAZAR_TRAMITE', `Trámite rechazado: ${tramite.folio} - ${motivo_rechazo}`, req);

    return res.json({ ok: true, message: 'Trámite rechazado' });
  } catch (error) {
    console.error('Error rechazando trámite:', error);
    return res.status(500).json({ ok: false, message: 'Error al rechazar trámite' });
  }
};

const subirDocumento = async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo_documento, observaciones } = req.body;

    if (!tipo_documento) {
      return res.status(400).json({ ok: false, message: 'Tipo de documento es requerido' });
    }

    const [tramites] = await db.query('SELECT * FROM tramites WHERE id_tramite = ?', [id]);
    if (tramites.length === 0) {
      return res.status(404).json({ ok: false, message: 'Trámite no encontrado' });
    }

    const archivo = req.file;
    if (!archivo) {
      return res.status(400).json({ ok: false, message: 'Archivo es requerido' });
    }

    await db.query(
      `INSERT INTO tramites_documentos (id_tramite, tipo_documento, nombre_original, ruta_archivo, mime_type, peso_bytes, subido_por, observaciones)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tipo_documento, archivo.originalname, archivo.path, archivo.mimetype, archivo.size, req.user.id_usuario, observaciones || null]
    );

    await registrarAuditoria(id, req.user.id_usuario, 'SUBIR_DOCUMENTO', `Documento ${tipo_documento} subido: ${archivo.originalname}`, req);

    return res.status(201).json({ ok: true, message: 'Documento subido exitosamente' });
  } catch (error) {
    console.error('Error subiendo documento:', error);
    return res.status(500).json({ ok: false, message: 'Error al subir documento' });
  }
};

const listarDocumentos = async (req, res) => {
  try {
    const { id } = req.params;

    const [documentos] = await db.query(
      `SELECT d.*, u.nombres AS subido_por_nombre, u.apellido_paterno AS subido_por_apellido
       FROM tramites_documentos d
       LEFT JOIN usuarios u ON u.id_usuario = d.subido_por
       WHERE d.id_tramite = ?
       ORDER BY d.subido_en DESC`,
      [id]
    );

    return res.json({ ok: true, data: documentos });
  } catch (error) {
    console.error('Error listando documentos:', error);
    return res.status(500).json({ ok: false, message: 'Error al listar documentos' });
  }
};

const bitacora = async (req, res) => {
  try {
    let sql = `
      SELECT
        ta.*,
        u.nombres,
        u.apellido_paterno,
        u.correo_institucional,
        t.folio
      FROM tramites_auditoria ta
      LEFT JOIN usuarios u ON u.id_usuario = ta.id_usuario
      LEFT JOIN tramites t ON t.id_tramite = ta.id_tramite
    `;

    const condiciones = [];
    const params = [];

    if (req.query.tramite_id) {
      condiciones.push('ta.id_tramite = ?');
      params.push(req.query.tramite_id);
    }

    if (req.query.accion) {
      condiciones.push('ta.accion LIKE ?');
      params.push(`%${req.query.accion}%`);
    }

    if (condiciones.length > 0) {
      sql += ' WHERE ' + condiciones.join(' AND ');
    }

    sql += ' ORDER BY ta.creado_en DESC LIMIT 200';

    const [rows] = await db.query(sql, params);

    return res.json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error obteniendo bitácora:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener bitácora' });
  }
};

const auditoria = async (req, res) => {
  try {
    let sql = `
      SELECT
        ta.*,
        u.nombres,
        u.apellido_paterno,
        u.correo_institucional,
        t.folio,
        tt.nombre AS tipo_tramite
      FROM tramites_auditoria ta
      LEFT JOIN usuarios u ON u.id_usuario = ta.id_usuario
      LEFT JOIN tramites t ON t.id_tramite = ta.id_tramite
      LEFT JOIN tramites_tipos tt ON tt.id_tipo = t.id_tipo
    `;

    const condiciones = [];
    const params = [];

    if (req.query.desde) {
      condiciones.push('ta.creado_en >= ?');
      params.push(req.query.desde);
    }

    if (req.query.hasta) {
      condiciones.push('ta.creado_en <= ?');
      params.push(req.query.hasta);
    }

    if (req.query.usuario_id) {
      condiciones.push('ta.id_usuario = ?');
      params.push(req.query.usuario_id);
    }

    if (condiciones.length > 0) {
      sql += ' WHERE ' + condiciones.join(' AND ');
    }

    sql += ' ORDER BY ta.creado_en DESC';

    const limit = parseInt(req.query.limit) || 500;
    sql += ' LIMIT ?';
    params.push(limit);

    const [rows] = await db.query(sql, params);

    return res.json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error obteniendo auditoría:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener auditoría' });
  }
};

const obtenerConfiguracion = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tramites_configuracion ORDER BY clave');
    return res.json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error obteniendo configuración:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener configuración' });
  }
};

const actualizarConfiguracion = async (req, res) => {
  try {
    const { id } = req.params;
    const { valor } = req.body;

    if (valor === undefined || valor === null) {
      return res.status(400).json({ ok: false, message: 'Valor es requerido' });
    }

    const [config] = await db.query('SELECT * FROM tramites_configuracion WHERE id_config = ?', [id]);
    if (config.length === 0) {
      return res.status(404).json({ ok: false, message: 'Configuración no encontrada' });
    }

    await db.query(
      'UPDATE tramites_configuracion SET valor = ?, actualizado_por = ? WHERE id_config = ?',
      [String(valor), req.user.id_usuario, id]
    );

    await registrarEnBitacoraGeneral(req.user.id_usuario, 'ACTUALIZAR_CONFIG_TRAMITES', `Configuración '${config[0].clave}' actualizada a: ${valor}`, req);

    return res.json({ ok: true, message: 'Configuración actualizada' });
  } catch (error) {
    console.error('Error actualizando configuración:', error);
    return res.status(500).json({ ok: false, message: 'Error al actualizar configuración' });
  }
};

const resumen = async (req, res) => {
  try {
    const [total] = await db.query('SELECT COUNT(*) AS total FROM tramites');
    const [porEstado] = await db.query(
      `SELECT estado_actual, COUNT(*) AS cantidad FROM tramites GROUP BY estado_actual ORDER BY estado_actual`
    );
    const [porTipo] = await db.query(
      `SELECT tt.nombre, tt.codigo, COUNT(*) AS cantidad
       FROM tramites t
       JOIN tramites_tipos tt ON tt.id_tipo = t.id_tipo
       GROUP BY tt.id_tipo, tt.nombre, tt.codigo`
    );
    const [pendientes] = await db.query(
      "SELECT COUNT(*) AS pendientes FROM tramites WHERE estado_actual IN ('SOLICITADO', 'EN_REVISION')"
    );
    const [emitidos] = await db.query(
      "SELECT COUNT(*) AS emitidos FROM tramites WHERE estado_actual = 'EMITIDO'"
    );
    const [cerrados] = await db.query(
      "SELECT COUNT(*) AS cerrados FROM tramites WHERE estado_actual = 'CERRADO'"
    );

    return res.json({
      ok: true,
      data: {
        total: total[0].total,
        por_estado: porEstado,
        por_tipo: porTipo,
        pendientes: pendientes[0].pendientes,
        emitidos: emitidos[0].emitidos,
        cerrados: cerrados[0].cerrados
      }
    });
  } catch (error) {
    console.error('Error obteniendo resumen:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener resumen' });
  }
};

module.exports = {
  listarTramites,
  obtenerTramite,
  catalogos,
  crearTramite,
  validarSolicitud,
  emitirDictamen,
  autorizarControlEscolar,
  autorizarDivisionISC,
  emitirDocumentoOficial,
  cerrarTramite,
  rechazarTramite,
  subirDocumento,
  listarDocumentos,
  bitacora,
  auditoria,
  obtenerConfiguracion,
  actualizarConfiguracion,
  resumen
};
