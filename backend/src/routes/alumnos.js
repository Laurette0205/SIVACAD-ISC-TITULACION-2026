const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { auth } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
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
      ORDER BY a.apellido_paterno ASC, a.apellido_materno ASC, a.nombres ASC
    `);

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
      return res.status(400).json({ ok: false, message: 'ID inválido' });
    }

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
      WHERE a.id_alumno = ?
      LIMIT 1
    `, [id]);

    if (!rows.length) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    return res.json({ ok: true, data: rows[0] });
  } catch (error) {
    console.error('Error al obtener alumno:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener alumno' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ ok: false, message: 'ID inválido' });
    }

    const { nombres, apellido_paterno, apellido_materno, curp, matricula, semestre_actual, estatus_academico, correo_institucional, estado } = req.body;

    const [existing] = await pool.execute(
      `SELECT a.id_alumno, a.id_usuario FROM alumnos a WHERE a.id_alumno = ? LIMIT 1`,
      [id]
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
      WHERE id_alumno = ?`,
      [
        nombres || null,
        apellido_paterno || null,
        apellido_materno || null,
        matricula || null,
        semestre_actual || null,
        estatus_academico || null,
        id
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

    return res.json({ ok: true, message: 'Alumno actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar alumno:', error);
    return res.status(500).json({ ok: false, message: 'Error al actualizar alumno' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ ok: false, message: 'ID inválido' });
    }

    const [existing] = await pool.execute(
      `SELECT a.id_alumno, a.id_usuario FROM alumnos a WHERE a.id_alumno = ? LIMIT 1`,
      [id]
    );
    if (!existing.length) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    const id_usuario = existing[0].id_usuario;

    await pool.execute(`DELETE FROM kardex_alumno WHERE id_alumno = ?`, [id]);
    await pool.execute(`DELETE FROM inscripciones WHERE id_alumno = ?`, [id]);
    await pool.execute(`DELETE FROM alumnos WHERE id_alumno = ?`, [id]);
    await pool.execute(`DELETE FROM usuarios WHERE id_usuario = ?`, [id_usuario]);

    return res.json({ ok: true, message: 'Alumno eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar alumno:', error);
    return res.status(500).json({ ok: false, message: 'Error al eliminar alumno' });
  }
});

module.exports = router;
