'use strict';

const express = require('express');
const router = express.Router();

const { auth } = require('../middleware/auth');
const { role } = require('../middleware/auth');
const { verifyRoleAgainstDB } = require('../middleware/auth');
const { resolveInstitution, requireInstitutionFeature } = require('../middleware/institution');
const breakGlass = require('../services/breakGlass');

// ==============================
// GRANT EMERGENCY ACCESS (admin/coord)
// ==============================
router.post('/grant',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR'),
  resolveInstitution,
  async (req, res) => {
    try {
      const { receptorId, permisos, motivo, expirationHours } = req.body;

      if (!receptorId || !permisos || !motivo) {
        return res.status(400).json({
          ok: false,
          message: 'receptorId, permisos y motivo son requeridos'
        });
      }

      const result = await breakGlass.grantEmergencyAccess(
        req.user.id_usuario,
        receptorId,
        permisos,
        motivo,
        expirationHours || 8
      );

      return res.json({ ok: true, ...result });
    } catch (error) {
      console.error('[BREAK_GLASS] Error:', error);
      return res.status(500).json({ ok: false, message: 'Error al generar credencial' });
    }
  }
);

// ==============================
// VERIFY EMERGENCY ACCESS
// ==============================
router.post('/verify',
  auth,
  async (req, res) => {
    try {
      const { pin } = req.body;

      if (!pin) {
        return res.status(400).json({ ok: false, message: 'PIN requerido' });
      }

      const result = await breakGlass.verifyEmergencyAccess(req.user.id_usuario, pin);

      if (!result.valid) {
        return res.status(401).json({ ok: false, message: result.message });
      }

      // Obtener datos mínimos de emergencia
      const emergencyData = await breakGlass.getEmergencyData(req.user.id_usuario);

      return res.json({
        ok: true,
        permisos: result.permisos,
        motivo: result.motivo,
        datos: emergencyData
      });
    } catch (error) {
      console.error('[BREAK_GLASS] Error:', error);
      return res.status(500).json({ ok: false, message: 'Error verificando acceso' });
    }
  }
);

// ==============================
// LIST MY CREDENTIALS
// ==============================
router.get('/credentials',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR'),
  async (req, res) => {
    try {
      const credentials = await breakGlass.listActiveCredentials(req.user.id_usuario);
      return res.json({ ok: true, credentials });
    } catch (error) {
      return res.status(500).json({ ok: false, message: 'Error listando credenciales' });
    }
  }
);

// ==============================
// REVOKE CREDENTIAL
// ==============================
router.post('/revoke/:id',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR'),
  async (req, res) => {
    try {
      const success = await breakGlass.revokeCredential(req.params.id, req.user.id_usuario);
      if (!success) {
        return res.status(404).json({ ok: false, message: 'Credencial no encontrada' });
      }
      return res.json({ ok: true, message: 'Credencial revocada' });
    } catch (error) {
      return res.status(500).json({ ok: false, message: 'Error revocando credencial' });
    }
  }
);

module.exports = router;
