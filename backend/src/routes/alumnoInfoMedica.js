'use strict';

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { auth, role } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/auditoria');

// GET — Información médica del alumno
router.get('/', auth, role('ALUMNO'), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT im.*,
              u.nombres AS autorizado_por_nombre,
              u.apellido_paterno AS autorizado_por_apellido
       FROM informacion_medica im
       LEFT JOIN usuarios u ON im.autorizado_por = u.id_usuario
       WHERE im.id_alumno = (SELECT id_alumno FROM alumnos WHERE id_usuario = ? LIMIT 1)
       LIMIT 1`,
      [req.user.id_usuario]
    );

    if (!rows.length) {
      return res.json({ ok: true, data: null });
    }

    return res.json({ ok: true, data: rows[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Error al obtener información médica' });
  }
});

// PUT — Crear o actualizar información médica
router.put('/', auth, role('ALUMNO'), async (req, res) => {
  try {
    const {
      tipo_sangre, alergias, restricciones_fisicas,
      medicamentos, condiciones_cronicas, informacion_psicologica,
      notas_autorizadas
    } = req.body;

    const [alumnoRows] = await pool.execute(
      `SELECT id_alumno FROM alumnos WHERE id_usuario = ? LIMIT 1`,
      [req.user.id_usuario]
    );

    if (!alumnoRows.length) {
      return res.status(404).json({ ok: false, message: 'Perfil de alumno no encontrado' });
    }

    const idAlumno = alumnoRows[0].id_alumno;

    // Validaciones
    if (tipo_sangre && tipo_sangre.length > 5) {
      return res.status(400).json({ ok: false, message: 'Tipo de sangre inválido (máx. 5 caracteres)' });
    }
    if (alergias && alergias.length > 2000) {
      return res.status(400).json({ ok: false, message: 'Alergias: máximo 2000 caracteres' });
    }
    if (medicamentos && medicamentos.length > 2000) {
      return res.status(400).json({ ok: false, message: 'Medicamentos: máximo 2000 caracteres' });
    }

    const [existing] = await pool.execute(
      `SELECT id_informacion FROM informacion_medica WHERE id_alumno = ? LIMIT 1`,
      [idAlumno]
    );

    const values = {
      tipo_sangre: tipo_sangre?.trim() || null,
      alergias: alergias?.trim() || null,
      restricciones_fisicas: restricciones_fisicas?.trim() || null,
      medicamentos: medicamentos?.trim() || null,
      condiciones_cronicas: condiciones_cronicas?.trim() || null,
      informacion_psicologica: informacion_psicologica?.trim() || null,
      notas_autorizadas: notas_autorizadas?.trim() || null,
    };

    if (existing.length) {
      await pool.execute(
        `UPDATE informacion_medica SET
         tipo_sangre = COALESCE(?, tipo_sangre),
         alergias = COALESCE(?, alergias),
         restricciones_fisicas = COALESCE(?, restricciones_fisicas),
         medicamentos = COALESCE(?, medicamentos),
         condiciones_cronicas = COALESCE(?, condiciones_cronicas),
         informacion_psicologica = COALESCE(?, informacion_psicologica),
         notas_autorizadas = COALESCE(?, notas_autorizadas)
         WHERE id_alumno = ?`,
        [values.tipo_sangre, values.alergias, values.restricciones_fisicas,
         values.medicamentos, values.condiciones_cronicas,
         values.informacion_psicologica, values.notas_autorizadas, idAlumno]
      );
    } else {
      await pool.execute(
        `INSERT INTO informacion_medica
         (id_alumno, id_institucion, tipo_sangre, alergias, restricciones_fisicas,
          medicamentos, condiciones_cronicas, informacion_psicologica, notas_autorizadas)
         VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?)`,
        [idAlumno, values.tipo_sangre, values.alergias, values.restricciones_fisicas,
         values.medicamentos, values.condiciones_cronicas,
         values.informacion_psicologica, values.notas_autorizadas]
      );
    }

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      modulo: 'SALUD',
      accion: existing.length ? 'INFORMACION_MEDICA_ACTUALIZADA' : 'INFORMACION_MEDICA_CREADA',
      descripcion: 'Información médica del alumno actualizada',
      entidad_afectada: 'informacion_medica',
      id_entidad: existing.length ? existing[0].id_informacion : idAlumno,
      req
    });

    return res.json({ ok: true, message: 'Información médica actualizada correctamente' });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Error al actualizar información médica' });
  }
});

module.exports = router;
