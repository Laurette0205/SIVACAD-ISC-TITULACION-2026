'use strict';

const express = require('express');
const router = express.Router();

const { auth } = require('../middleware/auth');
const { role } = require('../middleware/auth');
const { verifyRoleAgainstDB } = require('../middleware/auth');
const { resolveInstitution, byInstitution } = require('../middleware/institution');
const pool = require('../config/db');
const { invalidateAll, invalidateConfig } = require('../services/institutionConfig');

// ==============================
// LIST INSTITUTIONS (super-admin)
// ==============================
router.get('/',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR'),
  async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT id_institucion, nombre_corto, nombre_completo, nombre_legal,
                dominios_email, logo_url, color_primario, color_secundario,
                activa, created_at
         FROM instituciones
         ORDER BY id_institucion ASC`
      );

      return res.json({ ok: true, institutions: rows });
    } catch (error) {
      console.error('[INSTITUCIONES] Error:', error);
      return res.status(500).json({ ok: false, message: 'Error listando instituciones' });
    }
  }
);

// ==============================
// GET INSTITUTION CONFIG
// ==============================
router.get('/:id',
  auth,
  resolveInstitution,
  async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT * FROM instituciones WHERE id_institucion = ? LIMIT 1`,
        [req.params.id]
      );

      if (!rows.length) {
        return res.status(404).json({ ok: false, message: 'Institución no encontrada' });
      }

      return res.json({ ok: true, institution: rows[0] });
    } catch (error) {
      return res.status(500).json({ ok: false, message: 'Error obteniendo institución' });
    }
  }
);

// ==============================
// CREATE INSTITUTION (super-admin)
// ==============================
router.post('/',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR'),
  async (req, res) => {
    try {
      const {
        nombre_corto, nombre_completo, nombre_legal,
        dominios_email, logo_url, color_primario, color_secundario,
        telefono_crisis, frontend_url
      } = req.body;

      if (!nombre_corto || !nombre_completo || !dominios_email) {
        return res.status(400).json({
          ok: false,
          message: 'nombre_corto, nombre_completo y dominios_email requeridos'
        });
      }

      const [result] = await pool.execute(
        `INSERT INTO instituciones
         (nombre_corto, nombre_completo, nombre_legal, dominios_email, logo_url,
          color_primario, color_secundario, telefono_crisis, frontend_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nombre_corto, nombre_completo, nombre_legal || null,
          JSON.stringify(dominios_email), logo_url || null,
          color_primario || '#1a56db', color_secundario || '#1e40af',
          telefono_crisis || null, frontend_url || null
        ]
      );

      return res.status(201).json({
        ok: true,
        message: 'Institución creada',
        id: result.insertId
      });
    } catch (error) {
      console.error('[INSTITUCIONES] Error creando:', error);
      return res.status(500).json({ ok: false, message: 'Error creando institución' });
    }
  }
);

// ==============================
// UPDATE INSTITUTION (admin)
// ==============================
router.put('/:id',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR'),
  resolveInstitution,
  async (req, res) => {
    try {
      const {
        nombre_corto, nombre_completo, nombre_legal,
        dominios_email, logo_url, color_primario, color_secundario,
        telefono_crisis, frontend_url, formato_matricula, formato_folio_tramite
      } = req.body;

      const updates = [];
      const params = [];

      if (nombre_corto !== undefined) { updates.push('nombre_corto = ?'); params.push(nombre_corto); }
      if (nombre_completo !== undefined) { updates.push('nombre_completo = ?'); params.push(nombre_completo); }
      if (nombre_legal !== undefined) { updates.push('nombre_legal = ?'); params.push(nombre_legal); }
      if (dominios_email !== undefined) { updates.push('dominios_email = ?'); params.push(JSON.stringify(dominios_email)); }
      if (logo_url !== undefined) { updates.push('logo_url = ?'); params.push(logo_url); }
      if (color_primario !== undefined) { updates.push('color_primario = ?'); params.push(color_primario); }
      if (color_secundario !== undefined) { updates.push('color_secundario = ?'); params.push(color_secundario); }
      if (telefono_crisis !== undefined) { updates.push('telefono_crisis = ?'); params.push(telefono_crisis); }
      if (frontend_url !== undefined) { updates.push('frontend_url = ?'); params.push(frontend_url); }
      if (formato_matricula !== undefined) { updates.push('formato_matricula = ?'); params.push(formato_matricula); }
      if (formato_folio_tramite !== undefined) { updates.push('formato_folio_tramite = ?'); params.push(formato_folio_tramite); }

      if (!updates.length) {
        return res.status(400).json({ ok: false, message: 'No hay campos para actualizar' });
      }

      params.push(req.params.id);

      await pool.execute(
        `UPDATE instituciones SET ${updates.join(', ')} WHERE id_institucion = ?`,
        params
      );

      invalidateAll(req.params.id);

      return res.json({ ok: true, message: 'Institución actualizada' });
    } catch (error) {
      console.error('[INSTITUCIONES] Error actualizando:', error);
      return res.status(500).json({ ok: false, message: 'Error actualizando institución' });
    }
  }
);

module.exports = router;
