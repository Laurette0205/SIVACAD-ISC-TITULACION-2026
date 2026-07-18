const db = require('../config/db');
const path = require('path');
const fs = require('fs');

async function resolveAlumnoId(idUsuario) {
  const [rows] = await db.query(
    'SELECT id_alumno, matricula, nombres, apellido_paterno, apellido_materno FROM alumnos WHERE id_usuario = ? LIMIT 1',
    [idUsuario]
  );
  return rows.length > 0 ? rows[0] : null;
}

function generarFolio(contador) {
  const year = new Date().getFullYear();
  const padded = String(contador).padStart(6, '0');
  return `TRM-${year}-${padded}`;
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

const solicitar = async (req, res) => {
  try {
    const alumno = await resolveAlumnoId(req.user.id_usuario);
    if (!alumno) return res.status(400).json({ ok: false, message: 'Perfil alumno no encontrado' });

    const { id_tipo, motivo, id_periodo } = req.body;
    if (!id_tipo) return res.status(400).json({ ok: false, message: 'Tipo de trámite requerido' });

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
      [folio, id_tipo, alumno.id_alumno, req.user.id_usuario, id_periodo || null, motivo || null]
    );

    const id_tramite = result.insertId;

    await registrarHistorialEstado(id_tramite, null, 'SOLICITADO', req.user.id_usuario, 'Solicitud iniciada por el alumno');
    await registrarAuditoria(id_tramite, req.user.id_usuario, 'SOLICITAR',
      `Alumno solicitó trámite ${folio} (tipo: ${id_tipo})`, req);

    return res.status(201).json({
      ok: true,
      message: 'Solicitud de trámite creada exitosamente',
      data: { id_tramite, folio }
    });
  } catch (error) {
    console.error('Error al solicitar trámite:', error);
    return res.status(500).json({ ok: false, message: 'Error al crear la solicitud' });
  }
};

const misTramites = async (req, res) => {
  try {
    const alumno = await resolveAlumnoId(req.user.id_usuario);
    if (!alumno) return res.status(400).json({ ok: false, message: 'Perfil alumno no encontrado' });

    const params = [alumno.id_alumno];
    let sql = `
      SELECT t.id_tramite, t.folio, tt.nombre AS tipo_tramite, tt.codigo AS tipo_codigo,
        t.estado_actual, t.motivo, t.creado_en, t.actualizado_en,
        t.docente_opinion_emitida, t.entregado,
        (SELECT COUNT(*) FROM tramites_documentos td WHERE td.id_tramite = t.id_tramite) AS docs_subidos
      FROM tramites t
      JOIN tramites_tipos tt ON tt.id_tipo = t.id_tipo
      WHERE t.id_alumno = ?
    `;

    if (req.query.tipo) {
      sql += ' AND tt.codigo = ?';
      params.push(req.query.tipo);
    }
    if (req.query.estado) {
      sql += ' AND t.estado_actual = ?';
      params.push(req.query.estado);
    }

    sql += ' ORDER BY t.creado_en DESC LIMIT 100';

    const [rows] = await db.query(sql, params);
    return res.json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error en misTrámites:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener trámites' });
  }
};

const obtenerTramite = async (req, res) => {
  try {
    const { id } = req.params;
    const alumno = await resolveAlumnoId(req.user.id_usuario);
    if (!alumno) return res.status(400).json({ ok: false, message: 'Perfil alumno no encontrado' });

    const [tramites] = await db.query(
      `SELECT t.*, tt.nombre AS tipo_tramite, tt.codigo AS tipo_codigo,
        p.nombre_periodo
      FROM tramites t
      JOIN tramites_tipos tt ON tt.id_tipo = t.id_tipo
      LEFT JOIN periodos p ON p.id_periodo = t.id_periodo
      WHERE t.id_tramite = ? AND t.id_alumno = ?`,
      [id, alumno.id_alumno]
    );
    if (tramites.length === 0) {
      return res.status(404).json({ ok: false, message: 'Trámite no encontrado' });
    }

    const [documentos] = await db.query(
      'SELECT id_documento, tipo_documento, nombre_original, mime_type, peso_bytes, subido_en, validado FROM tramites_documentos WHERE id_tramite = ? ORDER BY subido_en DESC',
      [id]
    );
    const [observaciones] = await db.query(
      `SELECT o.id_observacion, o.tipo, o.observacion, o.creado_en,
        u.nombres, u.apellido_paterno
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

    return res.json({
      ok: true,
      data: { ...tramites[0], documentos, observaciones, historial_estados: historial }
    });
  } catch (error) {
    console.error('Error obteniendo trámite:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener trámite' });
  }
};

const subirDocumento = async (req, res) => {
  try {
    const { id } = req.params;
    const alumno = await resolveAlumnoId(req.user.id_usuario);
    if (!alumno) return res.status(400).json({ ok: false, message: 'Perfil alumno no encontrado' });

    const [tramites] = await db.query(
      'SELECT id_tramite, folio, estado_actual FROM tramites WHERE id_tramite = ? AND id_alumno = ?',
      [id, alumno.id_alumno]
    );
    if (tramites.length === 0) return res.status(404).json({ ok: false, message: 'Trámite no encontrado' });

    const t = tramites[0];
    if (!['SOLICITADO', 'EN_REVISION', 'OBSERVADO'].includes(t.estado_actual)) {
      return res.status(400).json({ ok: false, message: 'No se pueden subir documentos en el estado actual' });
    }

    if (!req.file) return res.status(400).json({ ok: false, message: 'Archivo requerido' });

    const { originalname, filename, mimetype, size } = req.file;
    const tipo_documento = req.body.tipo_documento || 'GENERAL';

    await db.query(
      `INSERT INTO tramites_documentos (id_tramite, tipo_documento, nombre_original, ruta_archivo, mime_type, peso_bytes, subido_por)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, tipo_documento, originalname, filename, mimetype, size, req.user.id_usuario]
    );

    await registrarAuditoria(id, req.user.id_usuario, 'SUBIR_DOCUMENTO',
      `Alumno subió documento: ${tipo_documento} (${originalname})`, req);

    return res.status(201).json({ ok: true, message: 'Documento subido exitosamente' });
  } catch (error) {
    console.error('Error subiendo documento:', error);
    return res.status(500).json({ ok: false, message: 'Error al subir documento' });
  }
};

const descargarDocumento = async (req, res) => {
  try {
    const { id, id_documento } = req.params;
    const alumno = await resolveAlumnoId(req.user.id_usuario);
    if (!alumno) return res.status(400).json({ ok: false, message: 'Perfil alumno no encontrado' });

    const [tramites] = await db.query(
      'SELECT id_tramite FROM tramites WHERE id_tramite = ? AND id_alumno = ?',
      [id, alumno.id_alumno]
    );
    if (tramites.length === 0) return res.status(404).json({ ok: false, message: 'Trámite no encontrado' });

    const [docs] = await db.query(
      'SELECT * FROM tramites_documentos WHERE id_documento = ? AND id_tramite = ?',
      [id_documento, id]
    );
    if (docs.length === 0) return res.status(404).json({ ok: false, message: 'Documento no encontrado' });

    const doc = docs[0];
    const ruta = path.resolve(process.cwd(), 'uploads', 'documentos', doc.ruta_archivo);

    if (!fs.existsSync(ruta)) {
      return res.status(404).json({ ok: false, message: 'Archivo no encontrado en el servidor' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${doc.nombre_original}"`);
    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    const stream = fs.createReadStream(ruta);
    stream.pipe(res);
  } catch (error) {
    console.error('Error descargando documento:', error);
    return res.status(500).json({ ok: false, message: 'Error al descargar documento' });
  }
};

const historial = async (req, res) => {
  try {
    const alumno = await resolveAlumnoId(req.user.id_usuario);
    if (!alumno) return res.status(400).json({ ok: false, message: 'Perfil alumno no encontrado' });

    const [rows] = await db.query(
      `SELECT t.id_tramite, t.folio, tt.nombre AS tipo_tramite,
        t.estado_actual, t.creado_en, t.actualizado_en,
        h.estado_anterior, h.estado_nuevo, h.observaciones, h.creado_en AS cambio_en,
        u.nombres AS cambiado_por_nombre, u.apellido_paterno AS cambiado_por_apellido
      FROM tramites t
      JOIN tramites_tipos tt ON tt.id_tipo = t.id_tipo
      JOIN tramites_historial_estados h ON h.id_tramite = t.id_tramite
      LEFT JOIN usuarios u ON u.id_usuario = h.cambiado_por
      WHERE t.id_alumno = ?
      ORDER BY h.creado_en DESC
      LIMIT 200`,
      [alumno.id_alumno]
    );

    return res.json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error en historial:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener historial' });
  }
};

const seguimiento = async (req, res) => {
  try {
    const { id } = req.params;
    const alumno = await resolveAlumnoId(req.user.id_usuario);
    if (!alumno) return res.status(400).json({ ok: false, message: 'Perfil alumno no encontrado' });

    const [tramites] = await db.query(
      `SELECT t.id_tramite, t.folio, tt.nombre AS tipo_tramite,
        t.estado_actual, t.motivo, t.creado_en, t.actualizado_en,
        t.docente_opinion_emitida, t.solicitud_validada,
        t.dictamen, t.dictamen_tipo, t.dictamen_en,
        t.documento_oficial_emitido, t.emitido_en,
        t.autorizacion_control_escolar, t.autorizacion_division_isc,
        t.entregado, t.entregado_en
      FROM tramites t
      JOIN tramites_tipos tt ON tt.id_tipo = t.id_tipo
      WHERE t.id_tramite = ? AND t.id_alumno = ?`,
      [id, alumno.id_alumno]
    );
    if (tramites.length === 0) return res.status(404).json({ ok: false, message: 'Trámite no encontrado' });

    const t = tramites[0];

    const steps = [
      { label: 'Solicitud', completed: true, date: t.creado_en },
      { label: 'Validación', completed: t.solicitud_validada === 1, date: null },
      { label: 'Dictamen', completed: !!t.dictamen_en, date: t.dictamen_en },
      { label: 'Documento emitido', completed: t.documento_oficial_emitido === 1, date: t.emitido_en },
      { label: 'Autorización CE', completed: t.autorizacion_control_escolar === 1, date: null },
      { label: 'Autorización DIS', completed: t.autorizacion_division_isc === 1, date: null },
      { label: 'Entregado', completed: t.entregado === 1, date: t.entregado_en },
    ];

    return res.json({ ok: true, data: { tramite: t, pasos: steps } });
  } catch (error) {
    console.error('Error en seguimiento:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener seguimiento' });
  }
};

const catalogos = async (req, res) => {
  try {
    const alumno = await resolveAlumnoId(req.user.id_usuario);
    if (!alumno) return res.status(400).json({ ok: false, message: 'Perfil alumno no encontrado' });

    const [tipos] = await db.query(
      'SELECT id_tipo, codigo, nombre, descripcion FROM tramites_tipos WHERE activo = 1 ORDER BY nombre'
    );
    const [periodos] = await db.query(
      'SELECT id_periodo, nombre_periodo FROM periodos ORDER BY fecha_inicio DESC LIMIT 5'
    );

    const tramitesActivos = await db.query(
      `SELECT COUNT(*) AS activos FROM tramites
       WHERE id_alumno = ? AND estado_actual NOT IN ('CERRADO', 'RECHAZADO', 'ENTREGADO')`,
      [alumno.id_alumno]
    );

    return res.json({
      ok: true,
      data: {
        tipos,
        periodos,
        alumno: {
          id_alumno: alumno.id_alumno,
          matricula: alumno.matricula,
          nombre_completo: `${alumno.nombres} ${alumno.apellido_paterno} ${alumno.apellido_materno}`
        },
        tramites_activos: tramitesActivos[0][0]?.activos || 0
      }
    });
  } catch (error) {
    console.error('Error en catálogos alumno:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener catálogos' });
  }
};

module.exports = {
  solicitar, misTramites, obtenerTramite,
  subirDocumento, descargarDocumento,
  historial, seguimiento, catalogos
};
