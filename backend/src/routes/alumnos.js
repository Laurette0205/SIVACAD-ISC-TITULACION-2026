const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { auth, role } = require('../middleware/auth');
const { validateAlumnoUpdate } = require('../middleware/validate');
const { registrarAuditoria } = require('../middleware/auditoria');

router.get('/', auth, async (req, res) => {
  try {
    const idInstitucion = req.user.id_institucion || 1;
    const [rows] = await pool.execute(`
      SELECT
        a.id_alumno,
        a.id_usuario,
        a.nombres AS nombre,
        CONCAT(a.apellido_paterno, ' ', a.apellido_materno) AS apellidos,
        a.apellido_paterno,
        a.apellido_materno,
        a.nombres,
        CONCAT(a.apellido_paterno, ' ', a.apellido_materno, ' ', a.nombres) AS nombre_completo,
        a.matricula,
        a.curp,
        a.id_carrera,
        c.nombre_carrera,
        a.id_plan,
        a.semestre_actual,
        a.fotografia,
        a.estatus_academico,
        u.correo_institucional,
        u.estado
      FROM alumnos a
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      LEFT JOIN carreras c ON c.id_carrera = a.id_carrera
      WHERE a.id_institucion = ?
      ORDER BY a.apellido_paterno ASC, a.apellido_materno ASC, a.nombres ASC
    `, [idInstitucion]);

    return res.json({
      ok: true,
      data: rows
    });
  } catch (error) {
    console.error('Error al listar alumnos:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al obtener alumnos'
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
        a.id_alumno,
        a.id_usuario,
        a.nombres AS nombre,
        CONCAT(a.apellido_paterno, ' ', a.apellido_materno) AS apellidos,
        a.apellido_paterno,
        a.apellido_materno,
        a.nombres,
        CONCAT(a.apellido_paterno, ' ', a.apellido_materno, ' ', a.nombres) AS nombre_completo,
        a.matricula,
        a.curp,
        a.id_carrera,
        c.nombre_carrera,
        a.id_plan,
        a.semestre_actual,
        a.fotografia,
        a.estatus_academico,
        u.correo_institucional,
        u.estado
      FROM alumnos a
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      LEFT JOIN carreras c ON c.id_carrera = a.id_carrera
      WHERE a.id_alumno = ? AND a.id_institucion = ?
      LIMIT 1
    `, [id, idInstitucion]);

    if (!rows.length) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    return res.json({ ok: true, data: rows[0] });
  } catch (error) {
    console.error('Error al obtener alumno:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener alumno' });
  }
});

router.put('/:id', auth, role('ADMINISTRADOR', 'COORDINADOR', 'SOPORTE'), validateAlumnoUpdate, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ ok: false, message: 'ID invalido' });
    }

    const { nombres, apellido_paterno, apellido_materno, curp, matricula, semestre_actual, estatus_academico, correo_institucional, estado } = req.body;

    const idInstitucion = req.user.id_institucion || 1;
    const [existing] = await pool.execute(
      `SELECT a.id_alumno, a.id_usuario FROM alumnos a WHERE a.id_alumno = ? AND a.id_institucion = ? LIMIT 1`,
      [id, idInstitucion]
    );
    if (!existing.length) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    const id_usuario = existing[0].id_usuario;

    await pool.execute(
      `UPDATE alumnos SET
        nombres = COALESCE(?, nombres),
        apellido_paterno = COALESCE(?, apellido_paterno),
        apellido_materno = COALESCE(?, apellido_materno),
        matricula = COALESCE(?, matricula),
        semestre_actual = COALESCE(?, semestre_actual),
        estatus_academico = COALESCE(?, estatus_academico)
      WHERE id_alumno = ? AND id_institucion = ?`,
      [
        nombres || null,
        apellido_paterno || null,
        apellido_materno || null,
        matricula || null,
        semestre_actual || null,
        estatus_academico || null,
        id,
        idInstitucion
      ]
    );

    await pool.execute(
      `UPDATE usuarios SET
        nombres = COALESCE(?, nombres),
        apellido_paterno = COALESCE(?, apellido_paterno),
        apellido_materno = COALESCE(?, apellido_materno),
        correo_institucional = COALESCE(?, correo_institucional),
        estado = COALESCE(?, estado)
      WHERE id_usuario = ?`,
      [
        nombres || null,
        apellido_paterno || null,
        apellido_materno || null,
        correo_institucional || null,
        estado || null,
        id_usuario
      ]
    );

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      modulo: 'USUARIOS',
      accion: 'PROFILE_CHANGED',
      descripcion: `Perfil de alumno ID ${id} actualizado por ${req.user.id_usuario}`,
      entidad_afectada: 'usuarios',
      id_entidad: id_usuario,
      valor_nuevo: { campos_modificados: Object.keys(req.body).filter(k => req.body[k] != null) },
      req
    });

    return res.json({ ok: true, message: 'Alumno actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar alumno:', error);
    return res.status(500).json({ ok: false, message: 'Error al actualizar alumno' });
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
      `SELECT a.id_alumno, a.id_usuario FROM alumnos a WHERE a.id_alumno = ? AND a.id_institucion = ? LIMIT 1`,
      [id, idInstitucion]
    );
    if (!existing.length) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    const id_usuario = existing[0].id_usuario;

    await conn.beginTransaction();
    await conn.execute(`DELETE FROM kardex_alumno WHERE id_alumno = ?`, [id]);
    await conn.execute(`DELETE FROM inscripciones WHERE id_alumno = ?`, [id]);
    await conn.execute(`DELETE FROM alumnos WHERE id_alumno = ?`, [id]);
    await conn.execute(`DELETE FROM usuarios WHERE id_usuario = ?`, [id_usuario]);
    await conn.commit();

    return res.json({ ok: true, message: 'Alumno eliminado correctamente' });
  } catch (error) {
    try { await conn.rollback(); } catch (_) {}
    console.error('Error al eliminar alumno:', error);
    return res.status(500).json({ ok: false, message: 'Error al eliminar alumno' });
  } finally {
    conn.release();
  }
});

module.exports = router;
