'use strict';

const express = require('express');
const router = express.Router();

const { auth } = require('../middleware/auth');
const { role } = require('../middleware/auth');
const { resolveInstitution } = require('../middleware/institution');
const pool = require('../config/db');
const { getIAPrompt, invalidatePrompts } = require('../services/institutionConfig');

// ==============================
// GET PROMPTS FOR INSTITUTION
// ==============================
router.get('/',
  auth,
  role('ADMINISTRADOR'),
  resolveInstitution,
  async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT id_prompt, modulo, rol, system_prompt, sufijo_rol, activo, created_at
         FROM ia_prompts
         WHERE id_institucion = ?
         ORDER BY modulo, rol`,
        [req.id_institucion]
      );

      return res.json({ ok: true, prompts: rows });
    } catch (error) {
      return res.status(500).json({ ok: false, message: 'Error listando prompts' });
    }
  }
);

// ==============================
// GET SINGLE PROMPT
// ==============================
router.get('/:modulo/:rol?',
  auth,
  resolveInstitution,
  async (req, res) => {
    try {
      const prompt = await getIAPrompt(req.id_institucion, req.params.modulo, req.params.rol || null);

      if (!prompt) {
        return res.status(404).json({ ok: false, message: 'Prompt no encontrado' });
      }

      return res.json({ ok: true, prompt });
    } catch (error) {
      return res.status(500).json({ ok: false, message: 'Error obteniendo prompt' });
    }
  }
);

// ==============================
// CREATE/UPDATE PROMPT
// ==============================
router.post('/',
  auth,
  role('ADMINISTRADOR'),
  resolveInstitution,
  async (req, res) => {
    try {
      const { modulo, rol, system_prompt, sufijo_rol } = req.body;

      if (!modulo || !system_prompt) {
        return res.status(400).json({
          ok: false,
          message: 'modulo y system_prompt requeridos'
        });
      }

      // Upsert
      await pool.execute(
        `INSERT INTO ia_prompts (id_institucion, modulo, rol, system_prompt, sufijo_rol, activo, created_at)
         VALUES (?, ?, ?, ?, ?, 1, NOW())
         ON DUPLICATE KEY UPDATE
           system_prompt = VALUES(system_prompt),
           sufijo_rol = VALUES(sufijo_rol),
           activo = 1`,
        [req.id_institucion, modulo, rol || null, system_prompt, sufijo_rol || null]
      );

      invalidatePrompts(req.id_institucion);

      return res.json({ ok: true, message: 'Prompt guardado' });
    } catch (error) {
      console.error('[IA_PROMPTS] Error:', error);
      return res.status(500).json({ ok: false, message: 'Error guardando prompt' });
    }
  }
);

// ==============================
// DELETE PROMPT
// ==============================
router.delete('/:id',
  auth,
  role('ADMINISTRADOR'),
  resolveInstitution,
  async (req, res) => {
    try {
      await pool.execute(
        `DELETE FROM ia_prompts WHERE id_prompt = ? AND id_institucion = ?`,
        [req.params.id, req.id_institucion]
      );

      invalidatePrompts(req.id_institucion);

      return res.json({ ok: true, message: 'Prompt eliminado' });
    } catch (error) {
      return res.status(500).json({ ok: false, message: 'Error eliminando prompt' });
    }
  }
);

module.exports = router;
