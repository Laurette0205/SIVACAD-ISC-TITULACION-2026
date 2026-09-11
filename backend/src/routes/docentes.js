const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { auth, role } = require('../middleware/auth');
const { validateDocenteUpdate } = require('../middleware/validate');
const { registrarAuditoria } = require('../middleware/auditoria');

router.get('/', auth, async (req, res) => {
  try {
    const idInstitucion = req.user.id_institucion || 1;
    const [rows] = await pool.execute(`
      SELECT
        d.id_docente,
        d.id_usuario,
        d.clave_docente,
        d.numero_empleado,
        d.especialidad,
        d.fotografia,
        d.estatus,
        u.nombres AS nombre,
        CONCAT(u.apellido_paterno, ' ', u.apellido_materno) AS apellidos,
        CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS nombre_completo,
        u.nombres,
        u.apellido_paterno,
        u.apellido_materno,
        u.correo_institucional,
        u.estado
      FROM docentes d
      INNER JOIN usuarios u ON u.id_usuario = d.id_usuario
      WHERE d.id_institucion = ?
      ORDER BY u.apellido_paterno ASC, u.apellido_materno ASC, u.nombres ASC
    `, [idInstitucion]);

    return res.json({
      ok: true,
      data: rows
    });
  } catch (error) {
    console.error('Error al listar docentes:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al obtener docentes'
    });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ ok: false, message: 'ID invalido' });
    }

    const idInstitucion = req.user.id_institucion || 1;
    const [rows] = await pool.execute(`
      SELECT
        d.id_docente,
        d.id_usuario,
        d.clave_docente,
        d.numero_empleado,
        d.especialidad,
        d.fotografia,
        d.estatus,
        u.nombres AS nombre,
        CONCAT(u.apellido_paterno, ' ', u.apellido_materno) AS apellidos,
        CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS nombre_completo,
        u.nombres,
        u.apellido_paterno,
        u.apellido_materno,
        u.correo_institucional,
        u.estado
      FROM docentes d
      INNER JOIN usuarios u ON u.id_usuario = d.id_usuario
      WHERE d.id_docente = ? AND d.id_institucion = ?
      LIMIT 1
    `, [id, idInstitucion]);

    if (!rows.length) {
      return res.status(404).json({ ok: false, message: 'Docente no encontrado' });
    }

    return res.json({ ok: true, data: rows[0] });
  } catch (error) {
    console.error('Error al obtener docente:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener docente' });
  }
});

router.put('/:id', auth, role('ADMINISTRADOR', 'COORDINADOR', 'SOPORTE'), validateDocenteUpdate, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ ok: false, message: 'ID invalido' });
    }

    const { nombres, apellido_paterno, apellido_materno, clave_docente, numero_empleado, especialidad, estatus, correo_institucional, estado } = req.body;

    const idInstitucion = req.user.id_institucion || 1;
    const [existing] = await pool.execute(
      `SELECT d.id_docente, d.id_usuario FROM docentes d WHERE d.id_docente = ? AND d.id_institucion = ? LIMIT 1`,
      [id, idInstitucion]
    );
    if (!existing.length) {
      return res.status(404).json({ ok: false, message: 'Docente no encontrado' });
    }

    const id_usuario = existing[0].id_usuario;

    await pool.execute(
      `UPDATE docentes SET
        clave_docente = COALESCE(?, clave_docente),
        numero_empleado = COALESCE(?, numero_empleado),
        especialidad = COALESCE(?, especialidad),
        estatus = COALESCE(?, estatus)
      WHERE id_docente = ?`,
      [
        clave_docente || null,
        numero_empleado || null,
        especialidad || null,
        estatus || null,
        id
      ]
    );

    await pool.execute(
      `UPDATE usuarios SET
        correo_institucional = COALESCE(?, correo_institucional),
        estado = COALESCE(?, estado)
      WHERE id_usuario = ?`,
      [correo_institucional || null, estado || null, id_usuario]
    );

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      modulo: 'USUARIOS',
      accion: 'PROFILE_CHANGED',
      descripcion: `Perfil de docente ID ${id} actualizado por ${req.user.id_usuario}`,
      entidad_afectada: 'usuarios',
      id_entidad: id_usuario,
      valor_nuevo: { campos_modificados: Object.keys(req.body).filter(k => req.body[k] != null) },
      req
    });

    return res.json({ ok: true, message: 'Docente actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar docente:', error);
    return res.status(500).json({ ok: false, message: 'Error al actualizar docente' });
  }
});

router.delete('/:id', auth, role('ADMINISTRADOR', 'COORDINADOR', 'SOPORTE'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ ok: false, message: 'ID invalido' });
    }

    const idInstitucion = req.user.id_institucion || 1;
    const [existing] = await conn.execute(
      `SELECT d.id_docente, d.id_usuario FROM docentes d WHERE d.id_docente = ? AND d.id_institucion = ? LIMIT 1`,
      [id, idInstitucion]
    );
    if (!existing.length) {
      return res.status(404).json({ ok: false, message: 'Docente no encontrado' });
    }

    const id_usuario = existing[0].id_usuario;

    await conn.beginTransaction();
    await conn.execute(`DELETE FROM docentes WHERE id_docente = ?`, [id]);
    await conn.execute(`DELETE FROM usuarios WHERE id_usuario = ?`, [id_usuario]);
    await conn.commit();

    return res.json({ ok: true, message: 'Docente eliminado correctamente' });
  } catch (error) {
    try { await conn.rollback(); } catch (_) {}
    console.error('Error al eliminar docente:', error);
    return res.status(500).json({ ok: false, message: 'Error al eliminar docente' });
  } finally {
    conn.release();
  }
});

module.exports = router;
