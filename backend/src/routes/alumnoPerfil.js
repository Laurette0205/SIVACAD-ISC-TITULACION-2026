'use strict';

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { auth, role } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/auditoria');

const NAME_REGEX = /^[a-zA-ZáéíóúñüÁÉÍÓÚÑÜ\s'-]{1,120}$/;
const APE_REGEX = /^[a-zA-ZáéíóúñüÁÉÍÓÚÑÜ\s'-]{1,160}$/;
const CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;

// GET /api/alumno-perfil — alumno obtiene su propio perfil
router.get('/', auth, async (req, res) => {
  try {
    const idUsuario = req.user.id_usuario;
    const idInstitucion = req.user.id_institucion || 1;

    const [rows] = await pool.execute(
      `SELECT
        a.id_alumno,
        a.id_usuario,
        a.nombres,
        a.apellido_paterno,
        a.apellido_materno,
        CONCAT(a.apellido_paterno, ' ', a.apellido_materno, ' ', a.nombres) AS nombre_completo,
        a.matricula,
        a.curp,
        a.id_carrera,
        c.nombre_carrera,
        a.id_plan,
        p.nombre_plan,
        a.semestre_actual,
        a.fotografia,
        a.estatus_academico,
        a.id_institucion,
        u.correo_institucional,
        u.estado,
        u.ultimo_acceso
      FROM alumnos a
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      LEFT JOIN carreras c ON c.id_carrera = a.id_carrera
      LEFT JOIN planes_estudio p ON p.id_plan = a.id_plan
      WHERE a.id_usuario = ? AND a.id_institucion = ?
      LIMIT 1`,
      [idUsuario, idInstitucion]
    );

    if (!rows.length) {
      return res.status(404).json({ ok: false, message: 'Perfil de alumno no encontrado' });
    }

    return res.json({ ok: true, data: rows[0] });
  } catch (error) {
    console.error('Error al obtener perfil del alumno:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener perfil' });
  }
});

// PUT /api/alumno-perfil — alumno actualiza campos permitidos de su perfil
router.put('/', auth, async (req, res) => {
  try {
    const idUsuario = req.user.id_usuario;
    const idInstitucion = req.user.id_institucion || 1;

    const [existing] = await pool.execute(
      `SELECT a.id_alumno, a.id_usuario, a.nombres, a.apellido_paterno, a.apellido_materno, a.curp
       FROM alumnos a
       WHERE a.id_usuario = ? AND a.id_institucion = ?
       LIMIT 1`,
      [idUsuario, idInstitucion]
    );

    if (!existing.length) {
      return res.status(404).json({ ok: false, message: 'Perfil de alumno no encontrado' });
    }

    const { nombres, apellido_paterno, apellido_materno, curp, fotografia } = req.body;

    const alumUpdates = [];
    const alumParams = [];
    const userUpdates = [];
    const userParams = [];
    const camposModificados = [];

    if (nombres !== undefined) {
      const val = String(nombres || '').trim();
      if (val && !NAME_REGEX.test(val)) {
        return res.status(400).json({ ok: false, message: 'Nombres: solo letras, espacios, guiones y apóstrofes (máx 120 caracteres)' });
      }
      if (val !== existing[0].nombres) {
        alumUpdates.push('nombres = ?');
        alumParams.push(val || null);
        userUpdates.push('nombres = ?');
        userParams.push(val || null);
        camposModificados.push('nombres');
      }
    }

    if (apellido_paterno !== undefined) {
      const val = String(apellido_paterno || '').trim();
      if (val && !APE_REGEX.test(val)) {
        return res.status(400).json({ ok: false, message: 'Apellido paterno: solo letras, espacios, guiones y apóstrofes (máx 160 caracteres)' });
      }
      if (val !== existing[0].apellido_paterno) {
        alumUpdates.push('apellido_paterno = ?');
        alumParams.push(val || null);
        userUpdates.push('apellido_paterno = ?');
        userParams.push(val || null);
        camposModificados.push('apellido_paterno');
      }
    }

    if (apellido_materno !== undefined) {
      const val = String(apellido_materno || '').trim();
      if (val && !APE_REGEX.test(val)) {
        return res.status(400).json({ ok: false, message: 'Apellido materno: solo letras, espacios, guiones y apóstrofes (máx 160 caracteres)' });
      }
      if (val !== existing[0].apellido_materno) {
        alumUpdates.push('apellido_materno = ?');
        alumParams.push(val || null);
        userUpdates.push('apellido_materno = ?');
        userParams.push(val || null);
        camposModificados.push('apellido_materno');
      }
    }

    if (curp !== undefined) {
      const curpUpper = String(curp || '').trim().toUpperCase();
      if (curpUpper && curpUpper.length !== 18) {
        return res.status(400).json({ ok: false, message: 'La CURP debe tener 18 caracteres' });
      }
      if (curpUpper && !CURP_REGEX.test(curpUpper)) {
        return res.status(400).json({ ok: false, message: 'Formato de CURP inválido' });
      }
      if (curpUpper !== (existing[0].curp || '')) {
        alumUpdates.push('curp = ?');
        alumParams.push(curpUpper || null);
        camposModificados.push('curp');
      }
    }

    if (fotografia !== undefined) {
      alumUpdates.push('fotografia = ?');
      alumParams.push(String(fotografia || '').trim() || null);
      camposModificados.push('fotografia');
    }

    if (!alumUpdates.length && !userUpdates.length) {
      return res.status(400).json({ ok: false, message: 'No hay campos para actualizar' });
    }

    if (alumUpdates.length) {
      alumParams.push(existing[0].id_alumno, idInstitucion);
      await pool.execute(
        `UPDATE alumnos SET ${alumUpdates.join(', ')} WHERE id_alumno = ? AND id_institucion = ?`,
        alumParams
      );
    }

    if (userUpdates.length) {
      userParams.push(idUsuario);
      await pool.execute(
        `UPDATE usuarios SET ${userUpdates.join(', ')} WHERE id_usuario = ?`,
        userParams
      );
    }

    await registrarAuditoria({
      id_usuario: idUsuario,
      modulo: 'ALUMNO',
      accion: 'PROFILE_CHANGED',
      descripcion: `Alumno ID ${existing[0].id_alumno} actualizó campos: ${camposModificados.join(', ')}`,
      entidad_afectada: 'alumnos',
      id_entidad: existing[0].id_alumno,
      valor_nuevo: { campos_modificados: camposModificados },
      req
    });

    return res.json({ ok: true, message: 'Perfil actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar perfil del alumno:', error);
    return res.status(500).json({ ok: false, message: 'Error al actualizar perfil' });
  }
});

// GET /api/alumno-perfil/kardex — alumno obtiene su kardex/resumen académico
router.get('/kardex', auth, async (req, res) => {
  try {
    const idUsuario = req.user.id_usuario;
    const idInstitucion = req.user.id_institucion || 1;

    const [alumnoRows] = await pool.execute(
      `SELECT a.id_alumno FROM alumnos a WHERE a.id_usuario = ? AND a.id_institucion = ? LIMIT 1`,
      [idUsuario, idInstitucion]
    );

    if (!alumnoRows.length) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    const idAlumno = alumnoRows[0].id_alumno;

    const [materias] = await pool.execute(
      `SELECT
        kh.id_historial,
        kh.calificacion,
        kh.creditos,
        kh.tipo_materia,
        kh.estado,
        kh.observaciones,
        p.nombre_periodo,
        m.nombre_materia,
        m.creditos AS creditos_materia,
        m.semestre_sugerido AS semestre_materia
      FROM kardex_historial_academico kh
      INNER JOIN materias m ON m.id_materia = kh.id_materia
      INNER JOIN periodos p ON p.id_periodo = kh.id_periodo
      WHERE kh.id_alumno = ? AND kh.id_institucion = ?
      ORDER BY p.nombre_periodo DESC, m.semestre_sugerido ASC`,
      [idAlumno, idInstitucion]
    );

    return res.json({ ok: true, data: materias });
  } catch (error) {
    console.error('Error al obtener kardex del alumno:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener kardex' });
  }
});

// GET /api/alumno-perfil/estadisticas — resumen académico del alumno
router.get('/estadisticas', auth, async (req, res) => {
  try {
    const idUsuario = req.user.id_usuario;
    const idInstitucion = req.user.id_institucion || 1;

    const [alumnoRows] = await pool.execute(
      `SELECT a.id_alumno FROM alumnos a WHERE a.id_usuario = ? AND a.id_institucion = ? LIMIT 1`,
      [idUsuario, idInstitucion]
    );

    if (!alumnoRows.length) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    const idAlumno = alumnoRows[0].id_alumno;

    const [[stats]] = await pool.execute(
      `SELECT
        COUNT(*) AS total_materias,
        COUNT(CASE WHEN kh.estado = 'Acreditada' THEN 1 END) AS materias_aprobadas,
        COUNT(CASE WHEN kh.estado = 'No Acreditada' THEN 1 END) AS materias_reprobadas,
        ROUND(AVG(CASE WHEN kh.calificacion > 0 THEN kh.calificacion END), 2) AS promedio_general,
        SUM(COALESCE(kh.creditos, 0)) AS total_creditos
      FROM kardex_historial_academico kh
      WHERE kh.id_alumno = ? AND kh.id_institucion = ?`,
      [idAlumno, idInstitucion]
    );

    return res.json({ ok: true, data: stats || {} });
  } catch (error) {
    console.error('Error al obtener estadísticas del alumno:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener estadísticas' });
  }
});

module.exports = router;
