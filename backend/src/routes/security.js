'use strict';

// backend/src/routes/security.js
// MÓDULO 5 — Rutas del dashboard de seguridad y gestión de alertas/dispositivos

const express = require('express');
const router = express.Router();
const { auth, role } = require('../middleware/auth');
const {
  getSecurityDashboard,
  getAlerts,
  updateAlertStatus,
  getKnownDevices,
  trustDevice,
  revokeDevice,
  getSessionDevices,
  getClientIp,
  generateDeviceFingerprint
} = require('../services/securityMonitor');

// ==============================
// DASHBOARD DE SEGURIDAD (solo ADMIN)
// ==============================

router.get('/dashboard', auth, role('ADMINISTRADOR'), async (req, res) => {
  try {
    const data = await getSecurityDashboard();
    res.json({ ok: true, data });
  } catch (err) {
    console.error('[SECURITY] Dashboard error:', err.message);
    // Return empty dashboard instead of 500
    res.json({
      ok: true,
      data: {
        alertas24h: [], pendientes: 0, ultimasAlertas: [], topUsuarios: [],
        dispositivosSospechosos: [], cambiosRecientes: [], topIps: [],
        dispositivosPorUsuario: []
      }
    });
  }
});

// ==============================
// ALERTAS
// ==============================

router.get('/alerts', auth, role('ADMINISTRADOR'), async (req, res) => {
  try {
    const { estado, severidad, limit = 50, offset = 0 } = req.query;
    const data = await getAlerts({ estado, severidad, limit: Number(limit), offset: Number(offset) });
    res.json({ ok: true, data });
  } catch (err) {
    console.error('[SECURITY] Alerts list error:', err.message);
    res.json({ ok: true, data: { rows: [], total: 0 } });
  }
});

router.patch('/alerts/:id', auth, role('ADMINISTRADOR'), async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, notas } = req.body;

    if (!['PENDIENTE', 'REVISADA', 'RESUELTA', 'DESCARTADA'].includes(estado)) {
      return res.status(400).json({ ok: false, message: 'Estado inválido' });
    }

    await updateAlertStatus(id, estado, req.user.id_usuario, notas);
    res.json({ ok: true, message: 'Alerta actualizada' });
  } catch (err) {
    console.error('[SECURITY] Alert update error:', err.message);
    res.status(500).json({ ok: false, message: 'Error al actualizar alerta' });
  }
});

// ==============================
// DISPOSITIVOS CONOCIDOS
// ==============================

router.get('/devices', auth, async (req, res) => {
  try {
    const userId = req.user.id_usuario;
    const devices = await getKnownDevices(userId);
    res.json({ ok: true, data: devices });
  } catch (err) {
    console.error('[SECURITY] Devices list error:', err.message);
    res.status(500).json({ ok: false, message: 'Error al obtener dispositivos' });
  }
});

router.get('/devices/all', auth, role('ADMINISTRADOR'), async (req, res) => {
  try {
    const pool = require('../config/db');
    let rows = [];
    try {
      [rows] = await pool.execute(
        `SELECT d.*, u.nombres, u.apellido_paterno, u.apellido_materno
         FROM dispositivos_conocidos d
         LEFT JOIN usuarios u ON d.id_usuario = u.id_usuario
         ORDER BY d.ultimo_visto DESC LIMIT 100`
      );
    } catch (_) {
      // Tabla puede no existir aún
      rows = [];
    }
    res.json({ ok: true, data: rows || [] });
  } catch (err) {
    console.error('[SECURITY] All devices error:', err.message);
    res.json({ ok: true, data: [] });
  }
});

router.post('/devices/:id/trust', auth, async (req, res) => {
  try {
    const { id } = req.params;
    await trustDevice(id, req.user.id_usuario);
    res.json({ ok: true, message: 'Dispositivo marcado como confiable' });
  } catch (err) {
    console.error('[SECURITY] Trust device error:', err.message);
    res.status(500).json({ ok: false, message: 'Error al confiar en dispositivo' });
  }
});

router.delete('/devices/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    await revokeDevice(id, req.user.id_usuario);
    res.json({ ok: true, message: 'Dispositivo eliminado' });
  } catch (err) {
    console.error('[SECURITY] Revoke device error:', err.message);
    res.status(500).json({ ok: false, message: 'Error al eliminar dispositivo' });
  }
});

// ==============================
// SESIONES DE DISPOSITIVOS
// ==============================

router.get('/session-devices', auth, role('ADMINISTRADOR'), async (req, res) => {
  try {
    const { userId } = req.query;
    const devices = await getSessionDevices(userId ? Number(userId) : null);
    res.json({ ok: true, data: devices });
  } catch (err) {
    console.error('[SECURITY] Session devices error:', err.message);
    res.status(500).json({ ok: false, message: 'Error al obtener sesiones de dispositivos' });
  }
});

// ==============================
// INFO DEL DISPOSITIVO ACTUAL
// ==============================

router.get('/current-device', auth, async (req, res) => {
  try {
    const ip = getClientIp(req);
    const fingerprint = generateDeviceFingerprint(req);
    const ua = req.headers['user-agent'] || '';

    res.json({
      ok: true,
      data: {
        ip,
        fingerprint,
        userAgent: ua.slice(0, 200),
        acceptLanguage: (req.headers['accept-language'] || '').slice(0, 100),
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Error al obtener info del dispositivo' });
  }
});

module.exports = router;
