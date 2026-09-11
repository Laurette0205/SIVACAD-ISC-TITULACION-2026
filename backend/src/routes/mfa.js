'use strict';

const express = require('express');
const router = express.Router();

const { auth } = require('../middleware/auth');
const mfa = require('../services/mfa');
const { registrarAuditoria } = require('../middleware/auditoria');

// ==============================
// SETUP MFA
// ==============================
router.post('/setup',
  auth,
  async (req, res) => {
    try {
      const result = await mfa.setupMFA(req.user.id_usuario, req.user.correo);
      return res.json({ ok: true, ...result });
    } catch (error) {
      console.error('[MFA] Error setup:', error);
      return res.status(500).json({ ok: false, message: 'Error configurando MFA' });
    }
  }
);

// ==============================
// ENABLE MFA
// ==============================
router.post('/enable',
  auth,
  async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ ok: false, message: 'Token requerido' });
      }

      const result = await mfa.enableMFA(req.user.id_usuario, token);
      if (result.enabled) {
        await registrarAuditoria({
          id_usuario: req.user.id_usuario,
          modulo: 'SEGURIDAD',
          accion: 'MFA_ENABLED',
          descripcion: 'MFA activado exitosamente',
          entidad_afectada: 'usuarios',
          id_entidad: req.user.id_usuario,
          req
        });
      }
      return res.json({ ok: true, ...result });
    } catch (error) {
      await registrarAuditoria({
        id_usuario: req.user.id_usuario,
        modulo: 'SEGURIDAD',
        accion: 'MFA_ENABLE_FAILED',
        descripcion: `Error activando MFA: ${error.message}`,
        nivel: 'ERROR',
        req
      });
      return res.status(500).json({ ok: false, message: 'Error activando MFA' });
    }
  }
);

// ==============================
// VERIFY MFA TOKEN
// ==============================
router.post('/verify',
  auth,
  async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ ok: false, message: 'Token requerido' });
      }

      const result = await mfa.verifyMFALogin(req.user.id_usuario, token);
      return res.json({ ok: true, ...result });
    } catch (error) {
      return res.status(500).json({ ok: false, message: 'Error verificando MFA' });
    }
  }
);

// ==============================
// DISABLE MFA
// ==============================
router.post('/disable',
  auth,
  async (req, res) => {
    try {
      const { token } = req.body;
      const result = await mfa.disableMFA(req.user.id_usuario, token);
      if (result.disabled) {
        await registrarAuditoria({
          id_usuario: req.user.id_usuario,
          modulo: 'SEGURIDAD',
          accion: 'MFA_DISABLED',
          descripcion: 'MFA deshabilitado',
          entidad_afectada: 'usuarios',
          id_entidad: req.user.id_usuario,
          req
        });
      }
      return res.json({ ok: true, ...result });
    } catch (error) {
      return res.status(500).json({ ok: false, message: 'Error deshabilitando MFA' });
    }
  }
);

// ==============================
// GET MFA STATUS
// ==============================
router.get('/status',
  auth,
  async (req, res) => {
    try {
      const status = await mfa.getMFAStatus(req.user.id_usuario);
      return res.json({ ok: true, ...status });
    } catch (error) {
      return res.status(500).json({ ok: false, message: 'Error obteniendo estado MFA' });
    }
  }
);

module.exports = router;
