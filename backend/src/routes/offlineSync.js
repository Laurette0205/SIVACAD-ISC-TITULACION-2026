'use strict';

const express = require('express');
const router = express.Router();

const { auth } = require('../middleware/auth');
const { resolveInstitution } = require('../middleware/institution');
const offlineSync = require('../services/offlineSync');

// ==============================
// UPLOAD OFFLINE EVENTS
// ==============================
router.post('/upload',
  auth,
  resolveInstitution,
  async (req, res) => {
    try {
      const { events } = req.body;

      if (!Array.isArray(events) || !events.length) {
        return res.status(400).json({ ok: false, message: 'events array requerido' });
      }

      const results = [];
      for (const event of events) {
        const result = await offlineSync.processEvent(event);
        results.push({ ...result, originalEvent: event });
      }

      // Marcar como sincronizados los exitosos
      const successfulIds = results
        .filter(r => r.success && r.originalEvent?.id)
        .map(r => r.originalEvent.id);

      if (successfulIds.length) {
        await offlineSync.markSynced(successfulIds);
      }

      return res.json({
        ok: true,
        processed: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        details: results
      });
    } catch (error) {
      console.error('[SYNC] Error uploading:', error);
      return res.status(500).json({ ok: false, message: 'Error sincronizando eventos' });
    }
  }
);

// ==============================
// DOWNLOAD CHANGES
// ==============================
router.get('/download',
  auth,
  resolveInstitution,
  async (req, res) => {
    try {
      const since = req.query.since || '1970-01-01T00:00:00';
      const changes = await offlineSync.getNewChanges(req.user.id_usuario, since);

      return res.json({
        ok: true,
        changes,
        count: changes.length
      });
    } catch (error) {
      return res.status(500).json({ ok: false, message: 'Error descargando cambios' });
    }
  }
);

// ==============================
// GET PENDING EVENTS
// ==============================
router.get('/pending',
  auth,
  async (req, res) => {
    try {
      const pending = await offlineSync.getPendingEvents(req.user.id_usuario);
      return res.json({ ok: true, pending, count: pending.length });
    } catch (error) {
      return res.status(500).json({ ok: false, message: 'Error obteniendo pendientes' });
    }
  }
);

module.exports = router;
