'use strict';

const express = require('express');
const router = express.Router();

const { auth } = require('../middleware/auth');
const { resolveInstitution } = require('../middleware/institution');
const privacyManager = require('../services/privacyManager');

// ==============================
// RECORD CONSENT
// ==============================
router.post('/consent',
  auth,
  async (req, res) => {
    try {
      const { tipo, version, aceptado } = req.body;

      if (!tipo || aceptado === undefined) {
        return res.status(400).json({ ok: false, message: 'tipo y aceptado requeridos' });
      }

      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
      const result = await privacyManager.recordConsent(
        req.user.id_usuario, tipo, version || '2026.1', aceptado, ip
      );

      return res.json({ ok: true, success: result });
    } catch (error) {
      return res.status(500).json({ ok: false, message: 'Error registrando consentimiento' });
    }
  }
);

// ==============================
// CHECK CONSENT
// ==============================
router.get('/consent/:tipo',
  auth,
  async (req, res) => {
    try {
      const hasConsent = await privacyManager.hasConsent(req.user.id_usuario, req.params.tipo);
      return res.json({ ok: true, hasConsent });
    } catch (error) {
      return res.status(500).json({ ok: false, message: 'Error verificando consentimiento' });
    }
  }
);

// ==============================
// REVOKE CONSENT
// ==============================
router.post('/consent/revoke',
  auth,
  async (req, res) => {
    try {
      const { tipo, motivo } = req.body;
      const result = await privacyManager.revokeConsent(req.user.id_usuario, tipo, motivo);
      return res.json({ ok: true, success: result });
    } catch (error) {
      return res.status(500).json({ ok: false, message: 'Error revocando consentimiento' });
    }
  }
);

// ==============================
// CONSENT HISTORY
// ==============================
router.get('/consent-history',
  auth,
  async (req, res) => {
    try {
      const history = await privacyManager.getConsentHistory(req.user.id_usuario);
      return res.json({ ok: true, history });
    } catch (error) {
      return res.status(500).json({ ok: false, message: 'Error obteniendo historial' });
    }
  }
);

// ==============================
// SUBMIT ARCO REQUEST
// ==============================
router.post('/arco',
  auth,
  async (req, res) => {
    try {
      const { tipoSolicitud, datosSolicitados, motivo } = req.body;

      if (!tipoSolicitud || !motivo) {
        return res.status(400).json({ ok: false, message: 'tipoSolicitud y motivo requeridos' });
      }

      const result = await privacyManager.submitARCORequest(
        req.user.id_usuario, tipoSolicitud, datosSolicitados, motivo
      );

      return res.json({ ok: true, ...result });
    } catch (error) {
      return res.status(500).json({ ok: false, message: 'Error creando solicitud ARCO' });
    }
  }
);

// ==============================
// GET MY PERSONAL DATA
// ==============================
router.get('/my-data',
  auth,
  async (req, res) => {
    try {
      const data = await privacyManager.getPersonalData(req.user.id_usuario);
      return res.json({ ok: true, data });
    } catch (error) {
      return res.status(500).json({ ok: false, message: 'Error obteniendo datos' });
    }
  }
);

// ==============================
// RETENTION POLICIES (admin)
// ==============================
router.get('/retention-policies',
  auth,
  resolveInstitution,
  async (req, res) => {
    try {
      const policies = await privacyManager.getRetentionPolicies(req.id_institucion);
      return res.json({ ok: true, policies });
    } catch (error) {
      return res.status(500).json({ ok: false, message: 'Error obteniendo políticas' });
    }
  }
);

module.exports = router;
