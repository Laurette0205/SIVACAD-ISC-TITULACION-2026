'use strict';

const express = require('express');
const router = express.Router();

const { auth } = require('../middleware/auth');
const pool = require('../config/db');
const { registrarAuditoria } = require('../middleware/auditoria');

const PHONE_REGEX = /^\d{10}$/;
const NAME_REGEX = /^[a-zA-ZáéíóúñüÁÉÍÓÚÑÜ\s'-]{2,200}$/;
const PARENTESCO_OPTIONS = ['Madre', 'Padre', 'Hermano/a', 'Tío/a', 'Abuelo/a', 'Esposo/a', 'Pareja', 'Amigo/a', 'Tutor legal', 'Otro'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ==============================
// GET MY EMERGENCY CONTACTS
// ==============================
router.get('/',
  auth,
  async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT id, nombre, parentesco, telefono, telefono_alt, correo, principal
         FROM contactos_emergencia
         WHERE id_usuario = ?
         ORDER BY principal DESC, nombre ASC`,
        [req.user.id_usuario]
      );
      return res.json({ ok: true, contactos: rows });
    } catch (error) {
      return res.status(500).json({ ok: false, message: 'Error obteniendo contactos' });
    }
  }
);

// ==============================
// ADD EMERGENCY CONTACT
// ==============================
router.post('/',
  auth,
  async (req, res) => {
    try {
      const { nombre, parentesco, telefono, telefono_alt, correo, principal } = req.body;

      if (!nombre || !parentesco || !telefono) {
        return res.status(400).json({
          ok: false,
          message: 'nombre, parentesco y telefono son requeridos'
        });
      }

      if (!NAME_REGEX.test(String(nombre).trim())) {
        return res.status(400).json({ ok: false, message: 'Nombre: solo letras, espacios, guiones y apóstrofes (2-200 caracteres)' });
      }

      if (!PHONE_REGEX.test(String(telefono).trim())) {
        return res.status(400).json({ ok: false, message: 'Teléfono: exactamente 10 dígitos numéricos' });
      }

      if (telefono_alt && !PHONE_REGEX.test(String(telefono_alt).trim())) {
        return res.status(400).json({ ok: false, message: 'Teléfono alternativo: exactamente 10 dígitos numéricos' });
      }

      if (correo && !EMAIL_REGEX.test(String(correo).trim())) {
        return res.status(400).json({ ok: false, message: 'Correo electrónico inválido' });
      }

      if (principal) {
        await pool.execute(
          `UPDATE contactos_emergencia SET principal = 0 WHERE id_usuario = ?`,
          [req.user.id_usuario]
        );
      }

      const [result] = await pool.execute(
        `INSERT INTO contactos_emergencia
         (id_usuario, nombre, parentesco, telefono, telefono_alt, correo, principal, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [req.user.id_usuario, nombre.trim(), parentesco, telefono.trim(), telefono_alt?.trim() || null, correo?.trim() || null, principal ? 1 : 0]
      );

      await registrarAuditoria({
        id_usuario: req.user.id_usuario,
        modulo: 'EMERGENCIA',
        accion: 'CONTACTO_CREADO',
        descripcion: `Contacto de emergencia "${nombre}" creado`,
        entidad_afectada: 'contactos_emergencia',
        id_entidad: result.insertId,
        req
      });

      return res.status(201).json({
        ok: true,
        message: 'Contacto agregado',
        id: result.insertId
      });
    } catch (error) {
      return res.status(500).json({ ok: false, message: 'Error agregando contacto' });
    }
  }
);

// ==============================
// UPDATE EMERGENCY CONTACT
// ==============================
router.put('/:id',
  auth,
  async (req, res) => {
    try {
      const { nombre, parentesco, telefono, telefono_alt, correo, principal } = req.body;

      const [existing] = await pool.execute(
        `SELECT id, nombre FROM contactos_emergencia WHERE id = ? AND id_usuario = ?`,
        [req.params.id, req.user.id_usuario]
      );

      if (!existing.length) {
        return res.status(404).json({ ok: false, message: 'Contacto no encontrado' });
      }

      if (nombre && !NAME_REGEX.test(String(nombre).trim())) {
        return res.status(400).json({ ok: false, message: 'Nombre: solo letras, espacios, guiones y apóstrofes (2-200 caracteres)' });
      }

      if (telefono && !PHONE_REGEX.test(String(telefono).trim())) {
        return res.status(400).json({ ok: false, message: 'Teléfono: exactamente 10 dígitos numéricos' });
      }

      if (telefono_alt && !PHONE_REGEX.test(String(telefono_alt).trim())) {
        return res.status(400).json({ ok: false, message: 'Teléfono alternativo: exactamente 10 dígitos numéricos' });
      }

      if (correo && !EMAIL_REGEX.test(String(correo).trim())) {
        return res.status(400).json({ ok: false, message: 'Correo electrónico inválido' });
      }

      if (principal) {
        await pool.execute(
          `UPDATE contactos_emergencia SET principal = 0 WHERE id_usuario = ?`,
          [req.user.id_usuario]
        );
      }

      await pool.execute(
        `UPDATE contactos_emergencia
         SET nombre = ?, parentesco = ?, telefono = ?, telefono_alt = ?, correo = ?, principal = ?
         WHERE id = ? AND id_usuario = ?`,
        [(nombre || existing[0].nombre).trim(), parentesco, (telefono || '').trim() || null, telefono_alt?.trim() || null, correo?.trim() || null, principal ? 1 : 0, req.params.id, req.user.id_usuario]
      );

      await registrarAuditoria({
        id_usuario: req.user.id_usuario,
        modulo: 'EMERGENCIA',
        accion: 'CONTACTO_ACTUALIZADO',
        descripcion: `Contacto de emergencia ID ${req.params.id} actualizado`,
        entidad_afectada: 'contactos_emergencia',
        id_entidad: Number(req.params.id),
        req
      });

      return res.json({ ok: true, message: 'Contacto actualizado' });
    } catch (error) {
      return res.status(500).json({ ok: false, message: 'Error actualizando contacto' });
    }
  }
);

// ==============================
// DELETE EMERGENCY CONTACT
// ==============================
router.delete('/:id',
  auth,
  async (req, res) => {
    try {
      const [existing] = await pool.execute(
        `SELECT id, nombre FROM contactos_emergencia WHERE id = ? AND id_usuario = ?`,
        [req.params.id, req.user.id_usuario]
      );

      if (!existing.length) {
        return res.status(404).json({ ok: false, message: 'Contacto no encontrado' });
      }

      await pool.execute(
        `DELETE FROM contactos_emergencia WHERE id = ? AND id_usuario = ?`,
        [req.params.id, req.user.id_usuario]
      );

      await registrarAuditoria({
        id_usuario: req.user.id_usuario,
        modulo: 'EMERGENCIA',
        accion: 'CONTACTO_ELIMINADO',
        descripcion: `Contacto de emergencia "${existing[0].nombre}" eliminado`,
        entidad_afectada: 'contactos_emergencia',
        id_entidad: Number(req.params.id),
        req
      });

      return res.json({ ok: true, message: 'Contacto eliminado' });
    } catch (error) {
      return res.status(500).json({ ok: false, message: 'Error eliminando contacto' });
    }
  }
);

module.exports = router;
