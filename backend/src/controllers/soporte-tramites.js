'use strict';

const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function registrarLog(accion, descripcion, id_usuario, ip, id_incidencia = null, id_tramite = null) {
  try {
    await pool.execute(
      `INSERT INTO soporte_tramites_logs (accion, descripcion, nivel, modulo, id_usuario, ip_origen, id_incidencia, id_tramite, creado_en)
       VALUES (?, ?, 'INFO', 'TRAMITES', ?, ?, ?, ?, NOW())`,
      ['SOPORTE_' + accion, descripcion, id_usuario || null, ip || null, id_incidencia, id_tramite]
    );
  } catch (_) {}
}

// =====================================================
// 1. PANEL TÉCNICO PRINCIPAL
// =====================================================
exports.getPanel = async (req, res) => {
  try {
    const [
      [totalTramites],
      [incidenciasAbiertas],
      [archivosPendientes],
      [recuperacionesPendientes],
      [tramitesPorTipo],
      [incidenciasPorEstado],
      [monitoreoReciente]
    ] = await Promise.all([
      pool.execute('SELECT COUNT(*) AS total FROM tramites'),
      pool.execute("SELECT COUNT(*) AS total FROM soporte_tramites_incidencias WHERE estado NOT IN ('CERRADO','CORREGIDO')"),
      pool.execute("SELECT COUNT(*) AS total FROM soporte_tramites_archivos WHERE estado_archivo = 'RECIBIDO' AND validado = 0"),
      pool.execute("SELECT COUNT(*) AS total FROM soporte_tramites_recuperacion WHERE estado = 'EN_PROCESO'"),
      pool.execute(
        `SELECT tt.codigo, tt.nombre, COUNT(t.id_tramite) AS total
         FROM tramites_tipos tt
         LEFT JOIN tramites t ON t.id_tipo = tt.id_tipo
         GROUP BY tt.id_tipo, tt.codigo, tt.nombre
         ORDER BY total DESC`
      ),
      pool.execute(
        `SELECT estado, COUNT(*) AS total
         FROM soporte_tramites_incidencias
         GROUP BY estado
         ORDER BY total DESC`
      ),
      pool.execute(
        `SELECT id_monitoreo, tipo_monitoreo, estado, total_tramites, con_incidencias,
                resueltos, pendientes, iniciado_en, completado_en
         FROM soporte_tramites_monitoreo
         ORDER BY iniciado_en DESC LIMIT 5`
      )
    ]);

    await registrarLog('PANEL', 'Panel técnico de trámites consultado', req.user?.id_usuario, req.ip);

    return res.json({
      ok: true,
      data: {
        resumen: {
          total_tramites: totalTramites[0].total,
          incidencias_abiertas: incidenciasAbiertas[0].total,
          archivos_pendientes: archivosPendientes[0].total,
          recuperaciones_pendientes: recuperacionesPendientes[0].total
        },
        tramites_por_tipo: tramitesPorTipo,
        incidencias_por_estado: incidenciasPorEstado,
        monitoreo_reciente: monitoreoReciente
      }
    });
  } catch (error) {
    console.error('getPanel:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener panel técnico' });
  }
};

// =====================================================
// 2. INCIDENCIAS DE TRÁMITES
// =====================================================
exports.getIncidencias = async (req, res) => {
  try {
    const { estado, tipo, limite } = req.query;
    let sql = `SELECT i.*, u.correo_institucional AS reportado_por_correo,
                      tt.nombre AS tipo_tramite_nombre, t.folio
               FROM soporte_tramites_incidencias i
               LEFT JOIN usuarios u ON u.id_usuario = i.reportado_por
               LEFT JOIN tramites_tipos tt ON tt.id_tipo = i.id_tipo_tramite
               LEFT JOIN tramites t ON t.id_tramite = i.id_tramite
               WHERE 1=1`;
    const params = [];

    if (estado) { sql += ' AND i.estado = ?'; params.push(estado); }
    if (tipo) { sql += ' AND i.tipo_incidencia = ?'; params.push(tipo); }

    sql += ' ORDER BY i.creado_en DESC LIMIT ?';
    params.push(parseInt(limite) || 50);

    const [rows] = await pool.execute(sql, params);

    const [porEstado] = await pool.execute(
      `SELECT estado, COUNT(*) AS total FROM soporte_tramites_incidencias GROUP BY estado`
    );
    const [abiertas] = await pool.execute(
      "SELECT COUNT(*) AS total FROM soporte_tramites_incidencias WHERE estado NOT IN ('CERRADO','CORREGIDO')"
    );

    return res.json({
      ok: true,
      data: { incidencias: rows, resumen_estados: porEstado, abiertas: abiertas[0].total }
    });
  } catch (error) {
    console.error('getIncidencias:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener incidencias' });
  }
};

// =====================================================
// 3. CREAR INCIDENCIA
// =====================================================
exports.crearIncidencia = async (req, res) => {
  try {
    const { id_tramite, folio_tramite, id_tipo_tramite, tipo_incidencia, titulo, descripcion, nivel, modulo_afectado } = req.body;

    if (!titulo) {
      return res.status(400).json({ ok: false, message: 'Título requerido' });
    }

    const [result] = await pool.execute(
      `INSERT INTO soporte_tramites_incidencias
       (id_tramite, folio_tramite, id_tipo_tramite, tipo_incidencia, titulo, descripcion, nivel, modulo_afectado, estado, reportado_por, creado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'EN_PROCESO', ?, NOW())`,
      [
        id_tramite || null,
        folio_tramite || null,
        id_tipo_tramite || null,
        tipo_incidencia || 'FALLA_GENERACION',
        titulo,
        descripcion || null,
        nivel || 'MEDIA',
        modulo_afectado || 'TRAMITES',
        req.user?.id_usuario || null
      ]
    );

    await registrarLog('CREAR_INCIDENCIA', 'Incidencia #' + result.insertId + ': ' + titulo,
      req.user?.id_usuario, req.ip, result.insertId, id_tramite || null);

    return res.status(201).json({
      ok: true, message: 'Incidencia registrada correctamente',
      data: { id_incidencia: result.insertId }
    });
  } catch (error) {
    console.error('crearIncidencia:', error);
    return res.status(500).json({ ok: false, message: 'Error al crear incidencia' });
  }
};

// =====================================================
// 4. ACTUALIZAR INCIDENCIA (estado, solución, reintento)
// =====================================================
exports.actualizarIncidencia = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: 'ID inválido' });

    const { estado, solucion, nivel } = req.body;

    const updates = [];
    const params = [];

    if (estado) {
      updates.push('estado = ?');
      params.push(estado);

      if (estado === 'EN_REVISION_TECNICA' || estado === 'ATENDIDA') {
        updates.push('atendido_por = ?, atendido_en = NOW()');
        params.push(req.user?.id_usuario || null);
      }
      if (estado === 'CORREGIDO' || estado === 'CERRADO') {
        updates.push('cerrado_por = ?, cerrado_en = NOW()');
        params.push(req.user?.id_usuario || null);
      }
      if (estado === 'REINTENTADO') {
        updates.push('reintentos = reintentos + 1, ultimo_reintento_en = NOW()');
      }
    }
    if (solucion !== undefined) {
      updates.push('solucion = ?');
      params.push(solucion);
    }
    if (nivel) {
      updates.push('nivel = ?');
      params.push(nivel);
    }

    if (updates.length === 0) {
      return res.status(400).json({ ok: false, message: 'Sin campos para actualizar' });
    }

    params.push(id);
    await pool.execute(
      `UPDATE soporte_tramites_incidencias SET ${updates.join(', ')} WHERE id_incidencia = ?`,
      params
    );

    await registrarLog('ACTUALIZAR_INCIDENCIA', 'Incidencia #' + id + ' -> ' + (estado || 'actualizada'),
      req.user?.id_usuario, req.ip, id);

    return res.json({ ok: true, message: 'Incidencia actualizada' });
  } catch (error) {
    console.error('actualizarIncidencia:', error);
    return res.status(500).json({ ok: false, message: 'Error al actualizar incidencia' });
  }
};

// =====================================================
// 5. CARGA DE ARCHIVOS
// =====================================================
exports.getArchivos = async (req, res) => {
  try {
    const { estado, accion } = req.query;
    let sql = `SELECT a.*, u.correo_institucional AS subido_por_correo,
                      uv.correo_institucional AS validado_por_correo,
                      i.titulo AS incidencia_titulo
               FROM soporte_tramites_archivos a
               LEFT JOIN usuarios u ON u.id_usuario = a.subido_por
               LEFT JOIN usuarios uv ON uv.id_usuario = a.validado_por
               LEFT JOIN soporte_tramites_incidencias i ON i.id_incidencia = a.id_incidencia
               WHERE 1=1`;
    const params = [];

    if (estado) { sql += ' AND a.estado_archivo = ?'; params.push(estado); }
    if (accion) { sql += ' AND a.accion = ?'; params.push(accion); }

    sql += ' ORDER BY a.subido_en DESC LIMIT 50';

    const [rows] = await pool.execute(sql, params);

    const [resumen] = await pool.execute(
      `SELECT accion, COUNT(*) AS total, SUM(validado = 1) AS validados, SUM(validado = 0) AS pendientes
       FROM soporte_tramites_archivos GROUP BY accion`
    );

    return res.json({ ok: true, data: { archivos: rows, resumen } });
  } catch (error) {
    console.error('getArchivos:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener archivos' });
  }
};

// =====================================================
// 6. VALIDAR ARCHIVO
// =====================================================
exports.validarArchivo = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: 'ID inválido' });

    const { validado, observaciones } = req.body;

    await pool.execute(
      `UPDATE soporte_tramites_archivos SET validado = ?, validado_por = ?, validado_en = NOW(), observaciones = ? WHERE id_archivo = ?`,
      [validado ? 1 : 0, req.user?.id_usuario || null, observaciones || null, id]
    );

    await registrarLog('VALIDAR_ARCHIVO', 'Archivo #' + id + ' validado: ' + (validado ? 'OK' : 'RECHAZADO'),
      req.user?.id_usuario, req.ip);

    return res.json({ ok: true, message: 'Archivo validado' });
  } catch (error) {
    console.error('validarArchivo:', error);
    return res.status(500).json({ ok: false, message: 'Error al validar archivo' });
  }
};

// =====================================================
// 7. RECUPERACIÓN DE DOCUMENTOS
// =====================================================
exports.getRecuperacion = async (req, res) => {
  try {
    const { estado } = req.query;
    let sql = `SELECT r.*, u.correo_institucional AS realizado_por_correo,
                      i.titulo AS incidencia_titulo, t.folio
               FROM soporte_tramites_recuperacion r
               LEFT JOIN usuarios u ON u.id_usuario = r.realizado_por
               LEFT JOIN soporte_tramites_incidencias i ON i.id_incidencia = r.id_incidencia
               LEFT JOIN tramites t ON t.id_tramite = r.id_tramite
               WHERE 1=1`;
    const params = [];

    if (estado) { sql += ' AND r.estado = ?'; params.push(estado); }

    sql += ' ORDER BY r.creado_en DESC LIMIT 50';

    const [rows] = await pool.execute(sql, params);

    const [resumen] = await pool.execute(
      `SELECT estado, COUNT(*) AS total FROM soporte_tramites_recuperacion GROUP BY estado`
    );

    return res.json({ ok: true, data: { recuperaciones: rows, resumen } });
  } catch (error) {
    console.error('getRecuperacion:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener recuperaciones' });
  }
};

// =====================================================
// 8. REALIZAR RECUPERACIÓN DE DOCUMENTO
// =====================================================
exports.realizarRecuperacion = async (req, res) => {
  try {
    const { id_incidencia, id_tramite, id_tramite_documento, tipo_recuperacion, observaciones } = req.body;
    if (!id_tramite_documento) {
      return res.status(400).json({ ok: false, message: 'Documento origen requerido' });
    }

    const [docs] = await pool.execute(
      `SELECT id_documento, nombre_original, ruta_archivo, mime_type, peso_bytes
       FROM tramites_documentos WHERE id_documento = ?`,
      [id_tramite_documento]
    );
    if (!docs.length) {
      return res.status(404).json({ ok: false, message: 'Documento no encontrado' });
    }

    const doc = docs[0];
    const existeOriginal = doc.ruta_archivo ? fs.existsSync(path.resolve(process.cwd(), doc.ruta_archivo.replace(/^\//, ''))) : false;

    let rutaRecuperada = null;
    let pesoRecuperado = 0;
    let integridadOk = 0;

    if (existeOriginal) {
      rutaRecuperada = doc.ruta_archivo;
      try {
        pesoRecuperado = fs.statSync(path.resolve(process.cwd(), doc.ruta_archivo.replace(/^\//, ''))).size;
        integridadOk = 1;
      } catch (_) {}
    }

    const [result] = await pool.execute(
      `INSERT INTO soporte_tramites_recuperacion
       (id_incidencia, id_tramite, id_tramite_documento, tipo_recuperacion, estado,
        documento_original, documento_recuperado, peso_original_bytes, peso_recuperado_bytes,
        integridad_ok, realizado_por, realizado_en, observaciones, creado_en)
       VALUES (?, ?, ?, ?, 'COMPLETADO', ?, ?, ?, ?, ?, ?, NOW(), ?, NOW())`,
      [
        id_incidencia || null,
        id_tramite || null,
        id_tramite_documento,
        tipo_recuperacion || 'ARCHIVO',
        doc.ruta_archivo,
        rutaRecuperada,
        doc.peso_bytes || 0,
        pesoRecuperado,
        integridadOk,
        req.user?.id_usuario || null,
        observaciones || null
      ]
    );

    await registrarLog('RECUPERAR_DOCUMENTO', 'Documento #' + id_tramite_documento + ' recuperado (ok=' + integridadOk + ')',
      req.user?.id_usuario, req.ip, id_incidencia, id_tramite);

    return res.status(201).json({
      ok: true, message: integridadOk ? 'Documento recuperado exitosamente' : 'Documento no encontrado en disco',
      data: { id_recuperacion: result.insertId, integridad_ok: integridadOk, existe_en_disco: existeOriginal }
    });
  } catch (error) {
    console.error('realizarRecuperacion:', error);
    return res.status(500).json({ ok: false, message: 'Error al recuperar documento' });
  }
};

// =====================================================
// 9. VALIDACIÓN DE INTEGRIDAD
// =====================================================
exports.validarIntegridad = async (req, res) => {
  try {
    const [documentos] = await pool.execute(
      `SELECT td.id_documento, td.id_tramite, td.nombre_original, td.ruta_archivo,
              td.mime_type, td.peso_bytes, t.folio
       FROM tramites_documentos td
       INNER JOIN tramites t ON t.id_tramite = td.id_tramite
       ORDER BY td.subido_en DESC LIMIT 200`
    );

    const resultados = documentos.map((d) => {
      let existeEnDisco = false;
      let tamanoReal = null;
      let extensionOk = false;
      let pesoOk = false;

      if (d.ruta_archivo) {
        const absPath = path.resolve(process.cwd(), d.ruta_archivo.replace(/^\//, ''));
        existeEnDisco = fs.existsSync(absPath);
        if (existeEnDisco) {
          try {
            tamanoReal = fs.statSync(absPath).size;
            pesoOk = Math.abs(tamanoReal - (d.peso_bytes || 0)) < 1024;
          } catch (_) {}
        }
      }

      const ext = path.extname(d.nombre_original || '').toLowerCase();
      const extensionesValidas = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.doc', '.docx', '.xls', '.xlsx'];
      extensionOk = extensionesValidas.includes(ext);

      return {
        id_documento: d.id_documento,
        id_tramite: d.id_tramite,
        folio: d.folio,
        nombre: d.nombre_original,
        mime_type: d.mime_type,
        extension_valida: extensionOk,
        archivo_existe: existeEnDisco,
        peso_original: d.peso_bytes,
        peso_real: tamanoReal,
        peso_coincide: pesoOk,
        integro: existeEnDisco && extensionOk && pesoOk
      };
    });

    const integros = resultados.filter((r) => r.integro).length;
    const danados = resultados.filter((r) => !r.integro).length;

    await registrarLog('VALIDAR_INTEGRIDAD', 'Integridad: ' + integros + ' ok, ' + danados + ' dañados de ' + resultados.length + ' documentos',
      req.user?.id_usuario, req.ip);

    return res.json({
      ok: true,
      data: {
        total: resultados.length,
        integros,
        danados,
        detalle: resultados
      }
    });
  } catch (error) {
    console.error('validarIntegridad:', error);
    return res.status(500).json({ ok: false, message: 'Error al validar integridad' });
  }
};

// =====================================================
// 10. HISTORIAL TÉCNICO
// =====================================================
exports.getHistorial = async (req, res) => {
  try {
    const { limite, accion } = req.query;
    let sql = `SELECT l.*, u.correo_institucional AS usuario_correo
               FROM soporte_tramites_logs l
               LEFT JOIN usuarios u ON u.id_usuario = l.id_usuario
               WHERE 1=1`;
    const params = [];

    if (accion) { sql += ' AND l.accion LIKE ?'; params.push('%' + accion + '%'); }

    sql += ' ORDER BY l.creado_en DESC LIMIT ?';
    params.push(parseInt(limite) || 100);

    const [rows] = await pool.execute(sql, params);

    return res.json({ ok: true, data: { logs: rows } });
  } catch (error) {
    console.error('getHistorial:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener historial' });
  }
};

// =====================================================
// 11. ERRORES DEL MÓDULO DE TRÁMITES
// =====================================================
exports.getErrores = async (req, res) => {
  try {
    const [erroresRecientes] = await pool.execute(
      `SELECT l.*, u.correo_institucional AS usuario_correo,
              i.titulo AS incidencia_titulo
       FROM soporte_tramites_logs l
       LEFT JOIN usuarios u ON u.id_usuario = l.id_usuario
       LEFT JOIN soporte_tramites_incidencias i ON i.id_incidencia = l.id_incidencia
       WHERE l.nivel IN ('ERROR', 'CRITICO', 'WARN')
       ORDER BY l.creado_en DESC LIMIT 50`
    );

    const [porTipo] = await pool.execute(
      `SELECT accion, COUNT(*) AS total, MAX(creado_en) AS ultimo
       FROM soporte_tramites_logs WHERE nivel IN ('ERROR','CRITICO')
       GROUP BY accion ORDER BY total DESC`
    );

    const [masFrecuentes] = await pool.execute(
      `SELECT i.tipo_incidencia, COUNT(*) AS total,
              tt.nombre AS tipo_tramite
       FROM soporte_tramites_incidencias i
       LEFT JOIN tramites_tipos tt ON tt.id_tipo = i.id_tipo_tramite
       GROUP BY i.tipo_incidencia, tt.nombre
       ORDER BY total DESC LIMIT 10`
    );

    return res.json({
      ok: true,
      data: { errores: erroresRecientes, por_tipo: porTipo, mas_frecuentes: masFrecuentes }
    });
  } catch (error) {
    console.error('getErrores:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener errores' });
  }
};

// =====================================================
// 12. REINTENTAR PROCESO
// =====================================================
exports.reintentarProceso = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: 'ID de incidencia inválido' });

    const [rows] = await pool.execute(
      `SELECT id_incidencia, estado, reintentos FROM soporte_tramites_incidencias WHERE id_incidencia = ?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ ok: false, message: 'Incidencia no encontrada' });

    await pool.execute(
      `UPDATE soporte_tramites_incidencias
       SET estado = 'REINTENTADO', reintentos = reintentos + 1, ultimo_reintento_en = NOW(),
           atendido_por = ?, atendido_en = NOW()
       WHERE id_incidencia = ?`,
      [req.user?.id_usuario || null, id]
    );

    await registrarLog('REINTENTAR', 'Incidencia #' + id + ' reintentada (intento #' + (rows[0].reintentos + 1) + ')',
      req.user?.id_usuario, req.ip, id);

    return res.json({ ok: true, message: 'Proceso reintentado correctamente' });
  } catch (error) {
    console.error('reintentarProceso:', error);
    return res.status(500).json({ ok: false, message: 'Error al reintentar proceso' });
  }
};

// =====================================================
// 13. VALIDAR COMPATIBILIDAD DE ARCHIVOS
// =====================================================
exports.validarCompatibilidad = async (req, res) => {
  try {
    const { id_tramite } = req.body;

    const [documentos] = await pool.execute(
      `SELECT td.*, tt.codigo AS tipo_tramite_codigo
       FROM tramites_documentos td
       INNER JOIN tramites t ON t.id_tramite = td.id_tramite
       INNER JOIN tramites_tipos tt ON tt.id_tipo = t.id_tipo
       WHERE td.id_tramite = ?`,
      [id_tramite]
    );

    if (!documentos.length) {
      return res.json({ ok: true, data: { compatible: true, documentos: [], observaciones: 'Sin documentos para validar' } });
    }

    const resultados = documentos.map((d) => {
      const ext = path.extname(d.nombre_original || '').toLowerCase();
      const mime = (d.mime_type || '').toLowerCase();

      const pdfOk = ext === '.pdf' && (mime === 'application/pdf' || !mime);
      const imgOk = ['.jpg', '.jpeg', '.png', '.gif'].includes(ext) && (!mime || mime.startsWith('image/'));
      const docOk = ['.doc', '.docx', '.xls', '.xlsx'].includes(ext);

      const tamanoOk = (d.peso_bytes || 0) <= 10 * 1024 * 1024;

      let existeEnDisco = false;
      if (d.ruta_archivo) {
        existeEnDisco = fs.existsSync(path.resolve(process.cwd(), d.ruta_archivo.replace(/^\//, '')));
      }

      return {
        id_documento: d.id_documento,
        nombre: d.nombre_original,
        tipo: ext,
        mime,
        tamano_bytes: d.peso_bytes,
        tamano_ok: tamanoOk,
        formato_valido: pdfOk || imgOk || docOk,
        archivo_existe: existeEnDisco,
        compatible: (pdfOk || imgOk || docOk) && tamanoOk && existeEnDisco
      };
    });

    const compatibles = resultados.filter((r) => r.compatible).length;
    const total = resultados.length;

    await registrarLog('VALIDAR_COMPATIBILIDAD', 'Compatibilidad: ' + compatibles + '/' + total + ' documentos compatibles',
      req.user?.id_usuario, req.ip, null, id_tramite);

    return res.json({
      ok: true,
      data: {
        compatible: compatibles === total,
        compatibles,
        total,
        documentos: resultados,
        observaciones: compatibles === total ? 'Todos los documentos son compatibles' : (total - compatibles) + ' documento(s) presentan problemas'
      }
    });
  } catch (error) {
    console.error('validarCompatibilidad:', error);
    return res.status(500).json({ ok: false, message: 'Error al validar compatibilidad' });
  }
};

// =====================================================
// 14. LISTAR TRÁMITES (apoyo técnico - vista read-only)
// =====================================================
exports.listarTramites = async (req, res) => {
  try {
    const { tipo, estado, folio, limite } = req.query;
    let sql = `SELECT t.id_tramite, t.folio, tt.codigo AS tipo_codigo, tt.nombre AS tipo_nombre,
                      t.estado_actual, t.motivo, t.creado_en, t.actualizado_en,
                      a.matricula,
                      CONCAT(a.nombres, ' ', a.apellido_paterno, ' ', a.apellido_materno) AS alumno_nombre,
                      p.nombre_periodo
               FROM tramites t
               INNER JOIN tramites_tipos tt ON tt.id_tipo = t.id_tipo
               INNER JOIN alumnos a ON a.id_alumno = t.id_alumno
               LEFT JOIN periodos p ON p.id_periodo = t.id_periodo
               WHERE 1=1`;
    const params = [];

    if (tipo) { sql += ' AND tt.codigo = ?'; params.push(tipo); }
    if (estado) { sql += ' AND t.estado_actual = ?'; params.push(estado); }
    if (folio) { sql += ' AND t.folio LIKE ?'; params.push('%' + folio + '%'); }

    sql += ' ORDER BY t.creado_en DESC LIMIT ?';
    params.push(parseInt(limite) || 50);

    const [rows] = await pool.execute(sql, params);

    return res.json({ ok: true, data: { tramites: rows } });
  } catch (error) {
    console.error('listarTramites:', error);
    return res.status(500).json({ ok: false, message: 'Error al listar trámites' });
  }
};

// =====================================================
// 15. TRÁMITES DE BAJA, CAMBIO DE ESCUELA, CAMBIO DE CARRERA
// =====================================================
exports.getTramitesEspeciales = async (req, res) => {
  try {
    const codigos = ['BAJA', 'TRASLADO', 'CAMBIO_CARRERA'];
    const placeholders = codigos.map(() => '?').join(',');

    const [rows] = await pool.execute(
      `SELECT tt.codigo, tt.nombre AS tipo_nombre, COUNT(t.id_tramite) AS total,
              SUM(t.estado_actual = 'SOLICITADO') AS solicitados,
              SUM(t.estado_actual = 'EN_REVISION') AS en_revision,
              SUM(t.estado_actual IN ('APROBADO','EMITIDO','CERRADO')) AS completados,
              SUM(t.estado_actual = 'RECHAZADO') AS rechazados
       FROM tramites_tipos tt
       LEFT JOIN tramites t ON t.id_tipo = tt.id_tipo
       WHERE tt.codigo IN (${placeholders})
       GROUP BY tt.id_tipo, tt.codigo, tt.nombre`,
      codigos
    );

    const [recientes] = await pool.execute(
      `SELECT t.id_tramite, t.folio, tt.codigo AS tipo_codigo, tt.nombre AS tipo_nombre,
              t.estado_actual, t.creado_en,
              a.matricula,
              CONCAT(a.nombres, ' ', a.apellido_paterno) AS alumno_nombre
       FROM tramites t
       INNER JOIN tramites_tipos tt ON tt.id_tipo = t.id_tipo
       INNER JOIN alumnos a ON a.id_alumno = t.id_alumno
       WHERE tt.codigo IN (${placeholders})
       ORDER BY t.creado_en DESC LIMIT 20`,
      codigos
    );

    return res.json({
      ok: true,
      data: { resumen: rows, recientes }
    });
  } catch (error) {
    console.error('getTramitesEspeciales:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener trámites especiales' });
  }
};
