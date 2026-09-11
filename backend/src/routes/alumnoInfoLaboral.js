'use strict';

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { auth, role } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/auditoria');

const PHONE_REGEX = /^\d{10}$/;

// GET — Información laboral del alumno
router.get('/', auth, role('ALUMNO'), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM informacion_laboral
       WHERE id_alumno = (SELECT id_alumno FROM alumnos WHERE id_usuario = ? LIMIT 1)
       LIMIT 1`,
      [req.user.id_usuario]
    );

    if (!rows.length) {
      return res.json({ ok: true, data: null });
    }

    return res.json({ ok: true, data: rows[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Error al obtener información laboral' });
  }
});

// PUT — Crear o actualizar información laboral
router.put('/', auth, role('ALUMNO'), async (req, res) => {
  try {
    const {
      trabaja_actualmente, empresa, puesto, telefono_laboral,
      direccion_laboral, municipio, horario, contacto_laboral_autorizado
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
    if (empresa && empresa.length > 200) {
      return res.status(400).json({ ok: false, message: 'Empresa: máximo 200 caracteres' });
    }
    if (puesto && puesto.length > 150) {
      return res.status(400).json({ ok: false, message: 'Puesto: máximo 150 caracteres' });
    }
    if (telefono_laboral && !PHONE_REGEX.test(String(telefono_laboral).trim())) {
      return res.status(400).json({ ok: false, message: 'Teléfono laboral: exactamente 10 dígitos numéricos' });
    }
    if (direccion_laboral && direccion_laboral.length > 500) {
      return res.status(400).json({ ok: false, message: 'Dirección laboral: máximo 500 caracteres' });
    }

    const [existing] = await pool.execute(
      `SELECT id_informacion FROM informacion_laboral WHERE id_alumno = ? LIMIT 1`,
      [idAlumno]
    );

    const values = {
      trabaja_actualmente: trabaja_actualmente ? 1 : 0,
      empresa: empresa?.trim() || null,
      puesto: puesto?.trim() || null,
      telefono_laboral: telefono_laboral?.trim() || null,
      direccion_laboral: direccion_laboral?.trim() || null,
      municipio: municipio?.trim() || null,
      horario: horario?.trim() || null,
      contacto_laboral_autorizado: contacto_laboral_autorizado?.trim() || null,
    };

    if (existing.length) {
      await pool.execute(
        `UPDATE informacion_laboral SET
         trabaja_actualmente = ?, empresa = COALESCE(?, empresa),
         puesto = COALESCE(?, puesto), telefono_laboral = COALESCE(?, telefono_laboral),
         direccion_laboral = COALESCE(?, direccion_laboral), municipio = COALESCE(?, municipio),
         horario = COALESCE(?, horario), contacto_laboral_autorizado = COALESCE(?, contacto_laboral_autorizado)
         WHERE id_alumno = ?`,
        [values.trabaja_actualmente, values.empresa, values.puesto,
         values.telefono_laboral, values.direccion_laboral,
         values.municipio, values.horario, values.contacto_laboral_autorizado, idAlumno]
      );
    } else {
      await pool.execute(
        `INSERT INTO informacion_laboral
         (id_alumno, id_institucion, trabaja_actualmente, empresa, puesto,
          telefono_laboral, direccion_laboral, municipio, horario, contacto_laboral_autorizado)
         VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [idAlumno, values.trabaja_actualmente, values.empresa, values.puesto,
         values.telefono_laboral, values.direccion_laboral,
         values.municipio, values.horario, values.contacto_laboral_autorizado]
      );
    }

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      modulo: 'LABORAL',
      accion: existing.length ? 'INFORMACION_LABORAL_ACTUALIZADA' : 'INFORMACION_LABORAL_CREADA',
      descripcion: 'Información laboral del alumno actualizada',
      entidad_afectada: 'informacion_laboral',
      id_entidad: existing.length ? existing[0].id_informacion : idAlumno,
      req
    });

    return res.json({ ok: true, message: 'Información laboral actualizada correctamente' });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Error al actualizar información laboral' });
  }
});

module.exports = router;
