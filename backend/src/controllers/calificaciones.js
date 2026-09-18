'use strict';

const pool = require('../config/db');
const { registrarAuditoria } = require('../middleware/auditoria');

// ==============================
// SERVICIO ÚNICO DE CALIFICACIONES
// ==============================
const { roundGrade, calculateAverage } = require('../services/academicGradeService');

async function getConfig(idInstitucion = 1) {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM calificaciones_config WHERE id_institucion = ? LIMIT 1',
      [idInstitucion]
    );
    return rows[0] || { max_cambios_por_calificacion: 3, requiere_aprobacion_coordinador: 1 };
  } catch (_) {
    return { max_cambios_por_calificacion: 3, requiere_aprobacion_coordinador: 1 };
  }
}

async function resolveDocenteId(conn, idUsuario) {
  const [rows] = await conn.execute(
    'SELECT id_docente FROM docentes WHERE id_usuario = ? LIMIT 1',
    [idUsuario]
  );
  return rows.length ? rows[0].id_docente : null;
}

async function docenteTieneAcceso(conn, idDocente, idHistorial) {
  if (idDocente == null) return true;
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS cnt
     FROM kardex_historial_academico h
     INNER JOIN cargas_academicas ca ON ca.id_grupo = h.id_grupo AND ca.id_periodo = h.id_periodo AND ca.id_materia = h.id_materia
     WHERE h.id_historial = ? AND ca.id_docente = ?`,
    [idHistorial, idDocente]
  );
  return rows[0].cnt > 0;
}

// ==============================
// 1. OBTENER CALIFICACIONES DE UN GRUPO POR PERÍODO
// ==============================
async function getCalificacionesGrupo(req, res) {
  try {
    const { idGrupo, idPeriodo } = req.params;
    const idInstitucion = req.user?.id_institucion || 1;
    const docente = await resolveDocenteId(pool, req.user.id_usuario);
    const esAdmin = ['ADMINISTRADOR', 'COORDINADOR'].includes(String(req.user.rol).trim().toUpperCase());

    if (!docente && !esAdmin) {
      return res.status(403).json({ ok: false, message: 'Perfil docente no encontrado' });
    }

    if (docente && !esAdmin) {
      const [acc] = await pool.execute(
        'SELECT COUNT(*) AS cnt FROM cargas_academicas WHERE id_docente = ? AND id_grupo = ? AND id_periodo = ?',
        [docente, idGrupo, idPeriodo]
      );
      if (acc[0].cnt === 0) {
        return res.status(403).json({ ok: false, message: 'No tienes acceso a este grupo' });
      }
    }

    const [rows] = await pool.execute(
      `SELECT h.*, m.nombre_materia, m.clave_materia, m.creditos,
              g.nombre_grupo, p.nombre_periodo,
              CONCAT(a.nombres, ' ', a.apellido_paterno, ' ', a.apellido_materno) AS nombre_alumno,
              a.matricula
       FROM kardex_historial_academico h
       INNER JOIN materias m ON m.id_materia = h.id_materia
       INNER JOIN grupos g ON g.id_grupo = h.id_grupo
       INNER JOIN periodos p ON p.id_periodo = h.id_periodo
       INNER JOIN alumnos a ON a.id_alumno = h.id_alumno
       WHERE h.id_grupo = ? AND h.id_periodo = ?
       ORDER BY a.apellido_paterno, a.apellido_materno, m.nombre_materia`,
      [idGrupo, idPeriodo]
    );

    const config = await getConfig(idInstitucion);

    return res.json({ ok: true, calificaciones: rows, config });
  } catch (error) {
    console.error('[CALIFICACIONES] Error:', error);
    return res.status(500).json({ ok: false, message: 'Error obteniendo calificaciones' });
  }
}

// ==============================
// 2. CAPTURAR / ACTUALIZAR CALIFICACIONES (BORRADOR)
// ==============================
async function capturarCalificaciones(req, res) {
  try {
    const { calificaciones } = req.body;
    if (!Array.isArray(calificaciones) || !calificaciones.length) {
      return res.status(400).json({ ok: false, message: 'Array calificaciones requerido' });
    }

    const docente = await resolveDocenteId(pool, req.user.id_usuario);
    const esAdmin = ['ADMINISTRADOR', 'COORDINADOR'].includes(String(req.user.rol).trim().toUpperCase());

    if (!docente && !esAdmin) {
      return res.status(403).json({ ok: false, message: 'Perfil docente no encontrado' });
    }

    const config = await getConfig(req.user?.id_institucion || 1);
    const results = [];

    for (const cal of calificaciones) {
      const { id_historial, parcial_1, parcial_2, parcial_3, motivo } = cal;

      if (!id_historial) {
        results.push({ id_historial: null, success: false, message: 'id_historial requerido' });
        continue;
      }

      const [existing] = await pool.execute(
        'SELECT * FROM kardex_historial_academico WHERE id_historial = ? LIMIT 1',
        [id_historial]
      );

      if (!existing.length) {
        results.push({ id_historial, success: false, message: 'Registro no encontrado' });
        continue;
      }

      const h = existing[0];

      if (h.estado_calificacion === 'PUBLICADA' || h.estado_calificacion === 'CERRADA') {
        results.push({ id_historial, success: false, message: `Calificación ${h.estado_calificacion.toLowerCase()}. No se puede modificar.` });
        continue;
      }

      if (!esAdmin && docente) {
        const acceso = await docenteTieneAcceso(pool, docente, id_historial);
        if (!acceso) {
          results.push({ id_historial, success: false, message: 'Sin acceso a este registro' });
          continue;
        }
      }

      // Límite de ediciones: max_cambios_por_calificacion (default 3)
      const maxCambios = config.max_cambios_por_calificacion || 3;
      if (h.version >= maxCambios) {
        results.push({
          id_historial, success: false,
          message: `Límite de ${maxCambios} ediciones alcanzado (versión ${h.version}). La calificación está cerrada.`,
          cerrado: true
        });
        continue;
      }

      const newP1 = parcial_1 !== undefined ? roundGrade(parcial_1) : h.parcial_1;
      const newP2 = parcial_2 !== undefined ? roundGrade(parcial_2) : h.parcial_2;
      const newP3 = parcial_3 !== undefined ? roundGrade(parcial_3) : h.parcial_3;
      const newProm = calculateAverage(newP1, newP2, newP3);
      const newFinal = newProm;

      const newVersion = h.version + 1;

      await pool.execute(
        `UPDATE kardex_historial_academico
         SET parcial_1 = ?, parcial_2 = ?, parcial_3 = ?,
             promedio_parciales = ?, calificacion_final = ?,
             version = ?, estado_calificacion = 'BORRADOR'
         WHERE id_historial = ?`,
        [newP1, newP2, newP3, newProm, newFinal, newVersion, id_historial]
      );

      if (h.parcial_1 !== newP1) {
        await pool.execute(
          `INSERT INTO calificaciones_historial_cambios
           (id_historial, id_usuario, id_alumno, version_anterior, version_nueva,
            campo_modificado, valor_anterior, valor_nuevo, motivo, ip_origen)
           VALUES (?, ?, ?, ?, ?, 'parcial_1', ?, ?, ?, ?)`,
          [id_historial, req.user.id_usuario, h.id_alumno, h.version, newVersion,
           h.parcial_1, newP1, motivo || 'Captura de calificación', req.ip]
        );
      }
      if (h.parcial_2 !== newP2) {
        await pool.execute(
          `INSERT INTO calificaciones_historial_cambios
           (id_historial, id_usuario, id_alumno, version_anterior, version_nueva,
            campo_modificado, valor_anterior, valor_nuevo, motivo, ip_origen)
           VALUES (?, ?, ?, ?, ?, 'parcial_2', ?, ?, ?, ?)`,
          [id_historial, req.user.id_usuario, h.id_alumno, h.version, newVersion,
           h.parcial_2, newP2, motivo || 'Captura de calificación', req.ip]
        );
      }
      if (h.parcial_3 !== newP3) {
        await pool.execute(
          `INSERT INTO calificaciones_historial_cambios
           (id_historial, id_usuario, id_alumno, version_anterior, version_nueva,
            campo_modificado, valor_anterior, valor_nuevo, motivo, ip_origen)
           VALUES (?, ?, ?, ?, ?, 'parcial_3', ?, ?, ?, ?)`,
          [id_historial, req.user.id_usuario, h.id_alumno, h.version, newVersion,
           h.parcial_3, newP3, motivo || 'Captura de calificación', req.ip]
        );
      }

      await registrarAuditoria({
        id_usuario: req.user.id_usuario,
        modulo: 'CALIFICACIONES',
        accion: 'BORRADOR_GUARDADO',
        descripcion: `Calificación borrador guardada para historial ${id_historial}`,
        entidad_afectada: 'kardex_historial_academico',
        id_entidad: id_historial,
        valor_nuevo: { parcial_1: newP1, parcial_2: newP2, parcial_3: newP3, promedio: newProm },
        req
      });

      results.push({ id_historial, success: true, version: newVersion, promedio: newProm, final: newFinal });
    }

    return res.json({ ok: true, results });
  } catch (error) {
    console.error('[CALIFICACIONES] Error:', error);
    return res.status(500).json({ ok: false, message: 'Error capturando calificaciones' });
  }
}

// ==============================
// 3. VALIDAR CALIFICACIONES (Coordinador/Admin)
// ==============================
async function validarCalificaciones(req, res) {
  try {
    const { ids_historial } = req.body;
    if (!Array.isArray(ids_historial) || !ids_historial.length) {
      return res.status(400).json({ ok: false, message: 'Array ids_historial requerido' });
    }

    const rol = String(req.user.rol).trim().toUpperCase();
    if (!['ADMINISTRADOR', 'COORDINADOR'].includes(rol)) {
      return res.status(403).json({ ok: false, message: 'Solo coordinadores y administradores pueden validar' });
    }

    const results = [];
    for (const id of ids_historial) {
      const [existing] = await pool.execute(
        'SELECT * FROM kardex_historial_academico WHERE id_historial = ? LIMIT 1',
        [id]
      );

      if (!existing.length) {
        results.push({ id_historial: id, success: false, message: 'No encontrado' });
        continue;
      }

      const h = existing[0];
      if (h.estado_calificacion !== 'BORRADOR') {
        results.push({ id_historial: id, success: false, message: `Estado actual: ${h.estado_calificacion}. Solo se puede validar BORRADOR.` });
        continue;
      }

      if (h.parcial_1 == null && h.parcial_2 == null && h.parcial_3 == null) {
        results.push({ id_historial: id, success: false, message: 'No tiene calificaciones parciales registradas' });
        continue;
      }

      await pool.execute(
        'UPDATE kardex_historial_academico SET estado_calificacion = \'VALIDADA\' WHERE id_historial = ?',
        [id]
      );

      await registrarAuditoria({
        id_usuario: req.user.id_usuario,
        modulo: 'CALIFICACIONES',
        accion: 'CALIFICACION_VALIDADA',
        descripcion: `Calificación ${id} validada`,
        entidad_afectada: 'kardex_historial_academico',
        id_entidad: id,
        req
      });

      results.push({ id_historial: id, success: true });
    }

    return res.json({ ok: true, results });
  } catch (error) {
    console.error('[CALIFICACIONES] Error:', error);
    return res.status(500).json({ ok: false, message: 'Error validando calificaciones' });
  }
}

// ==============================
// 4. PUBLICAR CALIFICACIONES
// ==============================
async function publicarCalificaciones(req, res) {
  try {
    const { ids_historial } = req.body;
    if (!Array.isArray(ids_historial) || !ids_historial.length) {
      return res.status(400).json({ ok: false, message: 'Array ids_historial requerido' });
    }

    const rol = String(req.user.rol).trim().toUpperCase();
    if (!['ADMINISTRADOR', 'COORDINADOR'].includes(rol)) {
      return res.status(403).json({ ok: false, message: 'Solo coordinadores y administradores pueden publicar' });
    }

    const results = [];
    for (const id of ids_historial) {
      const [existing] = await pool.execute(
        'SELECT * FROM kardex_historial_academico WHERE id_historial = ? LIMIT 1',
        [id]
      );

      if (!existing.length) {
        results.push({ id_historial: id, success: false, message: 'No encontrado' });
        continue;
      }

      const h = existing[0];
      if (h.estado_calificacion !== 'VALIDADA') {
        results.push({ id_historial: id, success: false, message: `Estado actual: ${h.estado_calificacion}. Solo se puede publicar VALIDADA.` });
        continue;
      }

      await pool.execute(
        `UPDATE kardex_historial_academico
         SET estado_calificacion = 'PUBLICADA', publicado_por = ?, fecha_publicacion = NOW()
         WHERE id_historial = ?`,
        [req.user.id_usuario, id]
      );

      await registrarAuditoria({
        id_usuario: req.user.id_usuario,
        modulo: 'CALIFICACIONES',
        accion: 'CALIFICACION_PUBLICADA',
        descripcion: `Calificación ${id} publicada - visible para el alumno`,
        entidad_afectada: 'kardex_historial_academico',
        id_entidad: id,
        req
      });

      results.push({ id_historial: id, success: true });
    }

    return res.json({ ok: true, results });
  } catch (error) {
    console.error('[CALIFICACIONES] Error:', error);
    return res.status(500).json({ ok: false, message: 'Error publicando calificaciones' });
  }
}

// ==============================
// 5. CERRAR CALIFICACIONES (fin de periodo)
// ==============================
async function cerrarCalificaciones(req, res) {
  try {
    const { idGrupo, idPeriodo } = req.body;
    if (!idGrupo || !idPeriodo) {
      return res.status(400).json({ ok: false, message: 'idGrupo y idPeriodo requeridos' });
    }

    const rol = String(req.user.rol).trim().toUpperCase();
    if (!['ADMINISTRADOR'].includes(rol)) {
      return res.status(403).json({ ok: false, message: 'Solo administradores pueden cerrar calificaciones' });
    }

    const [result] = await pool.execute(
      `UPDATE kardex_historial_academico
       SET estado_calificacion = 'CERRADA', cerrado_por = ?, fecha_cierre = NOW()
       WHERE id_grupo = ? AND id_periodo = ? AND estado_calificacion != 'CERRADA'`,
      [req.user.id_usuario, idGrupo, idPeriodo]
    );

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      modulo: 'CALIFICACIONES',
      accion: 'CALIFICACIONES_CERRADAS',
      descripcion: `Calificaciones del grupo ${idGrupo}, periodo ${idPeriodo} cerradas`,
      entidad_afectada: 'kardex_historial_academico',
      req
    });

    return res.json({ ok: true, message: `${result.affectedRows} calificación(es) cerrada(s)` });
  } catch (error) {
    console.error('[CALIFICACIONES] Error:', error);
    return res.status(500).json({ ok: false, message: 'Error cerrando calificaciones' });
  }
}

// ==============================
// 6. HISTORIAL DE CAMBIOS
// ==============================
async function getHistorialCambios(req, res) {
  try {
    const { idHistorial } = req.params;
    const [rows] = await pool.execute(
      `SELECT c.*, u.nombre AS nombre_usuario
       FROM calificaciones_historial_cambios c
       LEFT JOIN usuarios u ON u.id_usuario = c.id_usuario
       WHERE c.id_historial = ?
       ORDER BY c.created_at DESC`,
      [idHistorial]
    );
    return res.json({ ok: true, cambios: rows });
  } catch (error) {
    console.error('[CALIFICACIONES] Error:', error);
    return res.status(500).json({ ok: false, message: 'Error obteniendo historial' });
  }
}

// ==============================
// 7. BOLETA DEL ALUMNO
// ==============================
async function getBoletaAlumno(req, res) {
  try {
    const { idAlumno } = req.params;
    const { idPeriodo } = req.query;
    const idInstitucion = req.user?.id_institucion || 1;

    const esAlumno = String(req.user.rol).trim().toUpperCase() === 'ALUMNO';
    if (esAlumno && req.user.id_alumno !== Number(idAlumno)) {
      return res.status(403).json({ ok: false, message: 'No puedes ver la boleta de otro alumno' });
    }

    let where = 'h.id_alumno = ? AND h.estado_calificacion = \'PUBLICADA\'';
    const params = [idAlumno];

    if (idPeriodo) {
      where += ' AND h.id_periodo = ?';
      params.push(idPeriodo);
    }

    const [alumno] = await pool.execute(
      `SELECT a.*, c.nombre_carrera, k.promedio_general, k.creditos_acumulados
       FROM alumnos a
       INNER JOIN carreras c ON c.id_carrera = a.id_carrera
       LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
       WHERE a.id_alumno = ? LIMIT 1`,
      [idAlumno]
    );

    if (!alumno.length) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    const [materias] = await pool.execute(
      `SELECT h.*, m.nombre_materia, m.clave_materia, m.creditos,
              g.nombre_grupo, p.nombre_periodo,
              CONCAT(dn.apellido_paterno, ' ', dn.apellido_materno, ' ', dn.nombres) AS nombre_docente
       FROM kardex_historial_academico h
       INNER JOIN materias m ON m.id_materia = h.id_materia
       INNER JOIN grupos g ON g.id_grupo = h.id_grupo
       INNER JOIN periodos p ON p.id_periodo = h.id_periodo
       LEFT JOIN cargas_academicas ca ON ca.id_grupo = h.id_grupo AND ca.id_periodo = h.id_periodo AND ca.id_materia = h.id_materia
       LEFT JOIN docentes dn ON dn.id_docente = ca.id_docente
       WHERE ${where}
       ORDER BY p.nombre_periodo, m.semestre_sugerido, m.nombre_materia`,
      params
    );

    const periodos = {};
    for (const m of materias) {
      if (!periodos[m.nombre_periodo]) {
        periodos[m.nombre_periodo] = { periodo: m.nombre_periodo, materias: [], promedio: 0, total: 0 };
      }
      periodos[m.nombre_periodo].materias.push(m);
      periodos[m.nombre_periodo].total++;
      if (m.calificacion_final != null) {
        periodos[m.nombre_periodo].promedio += parseFloat(m.calificacion_final);
      }
    }

    for (const p of Object.values(periodos)) {
      p.promedio = p.total > 0 ? Math.round((p.promedio / p.total) * 100) / 100 : 0;
    }

    return res.json({
      ok: true,
      alumno: alumno[0],
      periodos: Object.values(periodos),
      totalMaterias: materias.length
    });
  } catch (error) {
    console.error('[CALIFICACIONES] Error:', error);
    return res.status(500).json({ ok: false, message: 'Error obteniendo boleta' });
  }
}

// ==============================
// 8. RESUMEN DE ESTADO PARA DOCENTE
// ==============================
async function getResumenCalificaciones(req, res) {
  try {
    const docente = await resolveDocenteId(pool, req.user.id_usuario);
    const esAdmin = ['ADMINISTRADOR', 'COORDINADOR'].includes(String(req.user.rol).trim().toUpperCase());

    if (!docente && !esAdmin) {
      return res.status(403).json({ ok: false, message: 'Perfil docente no encontrado' });
    }

    let where = '1=1';
    const params = [];

    if (docente && !esAdmin) {
      where = 'ca.id_docente = ?';
      params.push(docente);
    }

    const [rows] = await pool.execute(
      `SELECT h.estado_calificacion, COUNT(*) AS total,
              h.id_grupo, h.id_periodo, g.nombre_grupo, p.nombre_periodo
       FROM kardex_historial_academico h
       INNER JOIN cargas_academicas ca ON ca.id_grupo = h.id_grupo AND ca.id_periodo = h.id_periodo AND ca.id_materia = h.id_materia
       INNER JOIN grupos g ON g.id_grupo = h.id_grupo
       INNER JOIN periodos p ON p.id_periodo = h.id_periodo
       WHERE ${where}
       GROUP BY h.estado_calificacion, h.id_grupo, h.id_periodo, g.nombre_grupo, p.nombre_periodo
       ORDER BY p.nombre_periodo DESC, g.nombre_grupo`,
      params
    );

    return res.json({ ok: true, resumen: rows });
  } catch (error) {
    console.error('[CALIFICACIONES] Error:', error);
    return res.status(500).json({ ok: false, message: 'Error obteniendo resumen' });
  }
}

module.exports = {
  getCalificacionesGrupo,
  capturarCalificaciones,
  validarCalificaciones,
  publicarCalificaciones,
  cerrarCalificaciones,
  getHistorialCambios,
  getBoletaAlumno,
  getResumenCalificaciones
};
