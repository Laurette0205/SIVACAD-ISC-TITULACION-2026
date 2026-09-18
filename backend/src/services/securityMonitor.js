'use strict';

// backend/src/services/securityMonitor.js
// MÓDULO 5 — Detección de anomalías, scoring de riesgo, generación de alertas

const crypto = require('crypto');
const pool = require('../config/db');

// ==============================
// SCORING DE RIESGO
// ==============================

const RISK_SCORES = {
  NEW_DEVICE_LOGIN: 20,
  FAILED_LOGIN: 10,
  BRUTE_FORCE_DETECTED: 60,
  ROLE_CHANGE: 50,
  PASSWORD_CHANGE_SELF: 15,
  PASSWORD_CHANGE_ADMIN: 30,
  EMAIL_CHANGE: 40,
  MFA_DISABLED: 45,
  BREAK_GLASS_ACCESS: 70,
  UNUSUAL_TIME: 15,
  UNUSUAL_IP_RANGE: 25,
  CONCURRENT_SESSIONS_ANOMALY: 30,
  REAUTH_BYPASS_ATTEMPT: 55,
  MASS_DATA_ACCESS: 40,
  FORBIDDEN_ROUTE_ACCESS: 35,
  SUSPICIOUS_USER_AGENT: 20,
  IP_CHANGED_MID_SESSION: 30,
  TOKEN_REUSE_AFTER_LOGOUT: 50
};

const SEVERITY_THRESHOLDS = {
  BAJA: 0,
  MEDIA: 20,
  ALTA: 40,
  CRITICA: 60
};

function calculateSeverity(score) {
  if (score >= SEVERITY_THRESHOLDS.CRITICA) return 'CRITICA';
  if (score >= SEVERITY_THRESHOLDS.ALTA) return 'ALTA';
  if (score >= SEVERITY_THRESHOLDS.MEDIA) return 'MEDIA';
  return 'BAJA';
}

// ==============================
// ANÁLISIS DE COMPORTAMIENTO
// ==============================

async function analyzeLoginAnomaly(idUsuario, req) {
  const findings = [];
  let totalScore = 0;
  const ip = getClientIp(req);
  const ua = req.headers['user-agent'] || '';
  const fingerprint = generateDeviceFingerprint(req);

  try {
    // 1. Verificar si es dispositivo nuevo
    const [devices] = await pool.execute(
      `SELECT id, es_confiable FROM dispositivos_conocidos
       WHERE id_usuario = ? AND dispositivo_hash = ? LIMIT 1`,
      [idUsuario, fingerprint]
    );

    if (devices.length === 0) {
      findings.push({ type: 'NEW_DEVICE_LOGIN', detail: 'Dispositivo no registrado' });
      totalScore += RISK_SCORES.NEW_DEVICE_LOGIN;
    } else if (devices[0].es_confiable === 0) {
      findings.push({ type: 'UNTRUSTED_DEVICE', detail: 'Dispositivo no marcado como confiable' });
      totalScore += 10;
    }

    // 2. Verificar IP unusual (últimas 24h)
    const [recentIps] = await pool.execute(
      `SELECT DISTINCT ip_primera_sesion, ip_ultima_sesion
       FROM dispositivos_conocidos
       WHERE id_usuario = ? AND ultimo_visto > DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
      [idUsuario]
    );

    const knownIps = new Set();
    recentIps.forEach(row => {
      if (row.ip_primera_sesion) knownIps.add(row.ip_primera_sesion);
      if (row.ip_ultima_sesion) knownIps.add(row.ip_ultima_sesion);
    });

    if (knownIps.size > 0 && !knownIps.has(ip)) {
      findings.push({ type: 'UNUSUAL_IP', detail: `IP ${ip} no vista en últimas 24h` });
      totalScore += RISK_SCORES.UNUSUAL_IP_RANGE;
    }

    // 3. Verificar horario inusual (entre 00:00 y 05:00)
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 5) {
      findings.push({ type: 'UNUSUAL_TIME', detail: `Login a las ${hour}:00` });
      totalScore += RISK_SCORES.UNUSUAL_TIME;
    }

    // 4. Verificar intentos fallidos recientes (últimos 15 min)
    const [failures] = await pool.execute(
      `SELECT COUNT(*) AS cnt FROM intentos_sospechosos
       WHERE id_usuario = ? AND tipo_evento LIKE '%FAILED%'
       AND created_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)`,
      [idUsuario]
    );

    if (failures[0].cnt >= 3) {
      findings.push({ type: 'BRUTE_FORCE_DETECTED', detail: `${failures[0].cnt} intentos fallidos en 15 min` });
      totalScore += RISK_SCORES.BRUTE_FORCE_DETECTED;
    }

    // 5. Verificar sesiones concurrentes anómalas (>3)
    const [sessions] = await pool.execute(
      `SELECT COUNT(*) AS cnt FROM sesiones_activas
       WHERE id_usuario = ? AND activa = 1`,
      [idUsuario]
    );

    if (sessions[0].cnt > 3) {
      findings.push({ type: 'CONCURRENT_SESSIONS_ANOMALY', detail: `${sessions[0].cnt} sesiones activas` });
      totalScore += RISK_SCORES.CONCURRENT_SESSIONS_ANOMALY;
    }

    // 6. Verificar User-Agent sospechoso
    if (isSuspiciousUserAgent(ua)) {
      findings.push({ type: 'SUSPICIOUS_USER_AGENT', detail: `UA: ${ua.slice(0, 100)}` });
      totalScore += RISK_SCORES.SUSPICIOUS_USER_AGENT;
    }

  } catch (err) {
    // Si las tablas no existen, no fallar
  }

  return {
    findings,
    totalScore,
    severity: calculateSeverity(totalScore),
    shouldAlert: totalScore >= SEVERITY_THRESHOLDS.MEDIA,
    shouldBlock: totalScore >= 80,
    shouldRequireMFA: totalScore >= SEVERITY_THRESHOLDS.ALTA
  };
}

function isSuspiciousUserAgent(ua) {
  if (!ua) return true;
  const lower = ua.toLowerCase();
  const suspicious = ['curl', 'wget', 'python-requests', 'postman', 'scrapy', 'bot', 'spider', 'crawler'];
  return suspicious.some(s => lower.includes(s));
}

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    '0.0.0.0'
  );
}

function generateDeviceFingerprint(req) {
  const components = [
    req.headers['user-agent'] || '',
    req.headers['accept-language'] || '',
    req.headers['accept-encoding'] || ''
  ];
  return crypto
    .createHash('sha256')
    .update(components.join('|||'))
    .digest('hex')
    .slice(0, 32);
}

// ==============================
// GENERACIÓN DE ALERTAS
// ==============================

async function createSecurityAlert({
  id_usuario_afectado,
  tipo_alerta,
  titulo,
  descripcion,
  severidad = 'MEDIA',
  ip_origen,
  dispositivo_hash,
  user_agent,
  metadatos = {}
}) {
  try {
    const [result] = await pool.execute(
      `INSERT INTO alertas_seguridad
       (id_usuario_afectado, tipo_alerta, titulo, descripcion, severidad,
        ip_origen, dispositivo_hash, user_agent, metadatos_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        id_usuario_afectado,
        tipo_alerta,
        titulo,
        descripcion,
        severidad,
        ip_origen || null,
        dispositivo_hash || null,
        user_agent ? user_agent.slice(0, 500) : null,
        JSON.stringify(metadatos).slice(0, 5000)
      ]
    );

    // Si es CRÍTICA, también registrar en bitácora de auditoría
    if (severidad === 'CRITICA') {
      try {
        const { registrarAuditoria } = require('../middleware/auditoria');
        await registrarAuditoria({
          id_usuario: id_usuario_afectado,
          modulo: 'SEGURIDAD',
          accion: tipo_alerta,
          descripcion: `[CRÍTICA] ${titulo}: ${descripcion}`,
          nivel: 'CRITICAL',
          req: { user: { id_usuario: id_usuario_afectado }, headers: {} }
        });
      } catch (_) {}
    }

    return { id: result.insertId, severity: severidad };
  } catch (err) {
    console.error('[SECURITY_MONITOR] Error creando alerta:', err.message);
    return null;
  }
}

// ==============================
// LOG DE CAMBIOS CRÍTICOS
// ==============================

async function logCriticalChange({
  id_usuario,
  id_responsable,
  tipo_cambio,
  campo,
  valor_anterior,
  valor_nuevo,
  ip_origen,
  motivo,
  requiere_reauth = false
}) {
  try {
    await pool.execute(
      `INSERT INTO log_cambios_criticos
       (id_usuario, id_responsable, tipo_cambio, campo, valor_anterior,
        valor_nuevo, ip_origen, motivo, requiere_reauth, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        id_usuario,
        id_responsable || null,
        tipo_cambio,
        campo || null,
        valor_anterior ? String(valor_anterior).slice(0, 2000) : null,
        valor_nuevo ? String(valor_nuevo).slice(0, 2000) : null,
        ip_origen || null,
        motivo || null,
        requiere_reauth ? 1 : 0
      ]
    );
  } catch (err) {
    console.error('[SECURITY_MONITOR] Error logging cambio crítico:', err.message);
  }
}

// ==============================
// REGISTRO DE DISPOSITIVO DE SESIÓN
// ==============================

async function trackSessionDevice(idUsuario, req, metadatos = {}) {
  try {
    const ip = getClientIp(req);
    const ua = req.headers['user-agent'] || '';
    const al = req.headers['accept-language'] || '';
    const ae = req.headers['accept-encoding'] || '';
    const fingerprint = generateDeviceFingerprint(req);

    await pool.execute(
      `INSERT INTO dispositivos_sesion
       (id_usuario, dispositivo_hash, ip_address, user_agent, accept_language,
        accept_encoding, screen_res, timezone, created_at, ultimo_visto)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         ip_address = VALUES(ip_address),
         ultimo_visto = NOW(),
         user_agent = VALUES(user_agent)`,
      [
        id_usuario,
        fingerprint,
        ip,
        ua.slice(0, 500),
        al.slice(0, 200),
        ae.slice(0, 200),
        metadatos.screenRes || null,
        metadatos.timezone || null
      ]
    );

    return fingerprint;
  } catch (_) {
    return null;
  }
}

// ==============================
// VERIFICAR CAMBIO DE ROL SOSPECHOSO
// ==============================

async function detectRoleChange(idUsuario, oldRole, newRole, idResponsable, req) {
  if (oldRole === newRole) return;

  const ip = getClientIp(req);
  const score = RISK_SCORES.ROLE_CHANGE;

  await logCriticalChange({
    id_usuario: idUsuario,
    id_responsable: idResponsable,
    tipo_cambio: 'ROLE_CHANGE',
    campo: 'id_rol',
    valor_anterior: oldRole,
    valor_nuevo: newRole,
    ip_origen: ip,
    motivo: `Rol cambiado de ${oldRole} a ${newRole}`,
    requiere_reauth: true
  });

  await createSecurityAlert({
    id_usuario_afectado: idUsuario,
    tipo_alerta: 'ROLE_CHANGE',
    titulo: 'Cambio de rol detectado',
    descripcion: `Rol cambiado de "${oldRole}" a "${newRole}" por usuario ${idResponsable || 'desconocido'}`,
    severidad: calculateSeverity(score),
    ip_origen: ip,
    dispositivo_hash: generateDeviceFingerprint(req),
    user_agent: req.headers['user-agent'],
    metadatos: { oldRole, newRole, idResponsable }
  });
}

// ==============================
// VERIFICAR CAMBIO DE CORREO
// ==============================

async function detectEmailChange(idUsuario, oldEmail, newEmail, idResponsable, req) {
  if (oldEmail === newEmail) return;

  const ip = getClientIp(req);
  const score = RISK_SCORES.EMAIL_CHANGE;

  await logCriticalChange({
    id_usuario: idUsuario,
    id_responsable: idResponsable,
    tipo_cambio: 'EMAIL_CHANGE',
    campo: 'correo_institucional',
    valor_anterior: oldEmail,
    valor_nuevo: newEmail,
    ip_origen: ip,
    motivo: `Correo cambiado de ${oldEmail} a ${newEmail}`,
    requiere_reauth: true
  });

  await createSecurityAlert({
    id_usuario_afectado: idUsuario,
    tipo_alerta: 'EMAIL_CHANGE',
    titulo: 'Cambio de correo detectado',
    descripcion: `Correo cambiado de "${oldEmail}" a "${newEmail}"`,
    severidad: calculateSeverity(score),
    ip_origen: ip,
    user_agent: req.headers['user-agent'],
    metadatos: { oldEmail, newEmail, idResponsable }
  });
}

// ==============================
// DETECTAR ACCESO A RUTAS PROHIBIDAS
// ==============================

async function detectForbiddenAccess(idUsuario, ruta, req) {
  const ip = getClientIp(req);
  const score = RISK_SCORES.FORBIDDEN_ROUTE_ACCESS;

  await createSecurityAlert({
    id_usuario_afectado: idUsuario,
    tipo_alerta: 'FORBIDDEN_ACCESS',
    titulo: 'Acceso a ruta no autorizada',
    descripcion: `Usuario ${idUsuario} intentó acceder a ${ruta}`,
    severidad: calculateSeverity(score),
    ip_origen: ip,
    dispositivo_hash: generateDeviceFingerprint(req),
    user_agent: req.headers['user-agent'],
    metadatos: { ruta, method: req.method }
  });
}

// ==============================
// DASHBOARD DATA
// ==============================

async function getSecurityDashboard() {
  try {
    // Alertas de las últimas 24h por severidad
    const [alertas24h] = await pool.execute(
      `SELECT severidad, COUNT(*) AS total
       FROM alertas_seguridad
       WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
       GROUP BY severidad`
    );

    // Alertas pendientes
    const [pendientes] = await pool.execute(
      `SELECT COUNT(*) AS total FROM alertas_seguridad WHERE estado = 'PENDIENTE'`
    );

    // Últimas 10 alertas
    const [ultimasAlertas] = await pool.execute(
      `SELECT a.*, u.nombres, u.apellido_paterno, u.apellido_materno
       FROM alertas_seguridad a
       LEFT JOIN usuarios u ON a.id_usuario_afectado = u.id_usuario
       ORDER BY a.created_at DESC LIMIT 10`
    );

    // Top usuarios con más alertas (últimos 7 días)
    const [topUsuarios] = await pool.execute(
      `SELECT a.id_usuario_afectado, u.nombres, u.apellido_paterno,
              COUNT(*) AS total_alertas,
              MAX(a.severidad) AS max_severidad
       FROM alertas_seguridad a
       LEFT JOIN usuarios u ON a.id_usuario_afectado = u.id_usuario
       WHERE a.created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY a.id_usuario_afectado
       ORDER BY total_alertas DESC LIMIT 5`
    );

    // Dispositivos sospechosos (más de 3 IPs distintas en 24h)
    const [dispositivosSospechosos] = await pool.execute(
      `SELECT id_usuario, COUNT(DISTINCT ip_address) AS ips_distintas
       FROM dispositivos_sesion
       WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
       GROUP BY id_usuario
       HAVING ips_distintas > 3
       ORDER BY ips_distintas DESC LIMIT 5`
    );

    // Cambios críticos recientes
    const [cambiosRecientes] = await pool.execute(
      `SELECT lc.*, u.nombres, u.apellido_paterno
       FROM log_cambios_criticos lc
       LEFT JOIN usuarios u ON lc.id_usuario = u.id_usuario
       ORDER BY lc.created_at DESC LIMIT 10`
    );

    // Top IPs con más intentos sospechosos
    const [topIps] = await pool.execute(
      `SELECT ip_origen, COUNT(*) AS total, MAX(created_at) AS ultimo_intento
       FROM intentos_sospechosos
       WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
       GROUP BY ip_origen
       ORDER BY total DESC LIMIT 5`
    );

    // Resumen de dispositivos conocidos por usuario
    const [dispositivosPorUsuario] = await pool.execute(
      `SELECT id_usuario, COUNT(*) AS total_dispositivos,
              SUM(CASE WHEN es_confiable = 1 THEN 1 ELSE 0 END) AS confiables
       FROM dispositivos_conocidos
       GROUP BY id_usuario
       ORDER BY total_dispositivos DESC LIMIT 10`
    );

    return {
      alertas24h: alertas24h || [],
      pendientes: pendientes[0]?.total || 0,
      ultimasAlertas: ultimasAlertas || [],
      topUsuarios: topUsuarios || [],
      dispositivosSospechosos: dispositivosSospechosos || [],
      cambiosRecientes: cambiosRecientes || [],
      topIps: topIps || [],
      dispositivosPorUsuario: dispositivosPorUsuario || []
    };
  } catch (err) {
    console.error('[SECURITY_MONITOR] Error obteniendo dashboard:', err.message);
    return {
      alertas24h: [],
      pendientes: 0,
      ultimasAlertas: [],
      topUsuarios: [],
      dispositivosSospechosos: [],
      cambiosRecientes: [],
      topIps: [],
      dispositivosPorUsuario: []
    };
  }
}

// ==============================
// GESTIÓN DE ALERTAS
// ==============================

async function getAlerts({ estado, severidad, limit = 50, offset = 0 } = {}) {
  let where = '1=1';
  const params = [];

  if (estado) { where += ' AND a.estado = ?'; params.push(estado); }
  if (severidad) { where += ' AND a.severidad = ?'; params.push(severidad); }

  const [rows] = await pool.execute(
    `SELECT a.*, u.nombres, u.apellido_paterno, u.apellido_materno
     FROM alertas_seguridad a
     LEFT JOIN usuarios u ON a.id_usuario_afectado = u.id_usuario
     WHERE ${where}
     ORDER BY a.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, String(limit), String(offset)]
  );

  const [countResult] = await pool.execute(
    `SELECT COUNT(*) AS total FROM alertas_seguridad a WHERE ${where}`,
    params
  );

  return { rows: rows || [], total: countResult[0]?.total || 0 };
}

async function updateAlertStatus(id, estado, revisadaPor, notas = null) {
  await pool.execute(
    `UPDATE alertas_seguridad
     SET estado = ?, revisada_por = ?, revisada_en = NOW(), notas_revision = ?
     WHERE id = ?`,
    [estado, revisadaPor || null, notas, id]
  );
}

// ==============================
// GESTIÓN DE DISPOSITIVOS
// ==============================

async function getKnownDevices(idUsuario) {
  const [rows] = await pool.execute(
    `SELECT * FROM dispositivos_conocidos
     WHERE id_usuario = ?
     ORDER BY ultimo_visto DESC`,
    [idUsuario]
  );
  return rows || [];
}

async function trustDevice(id, idUsuario) {
  await pool.execute(
    `UPDATE dispositivos_conocidos SET es_confiable = 1 WHERE id = ? AND id_usuario = ?`,
    [id, idUsuario]
  );
}

async function revokeDevice(id, idUsuario) {
  await pool.execute(
    `DELETE FROM dispositivos_conocidos WHERE id = ? AND id_usuario = ?`,
    [id, idUsuario]
  );
}

async function getSessionDevices(idUsuario) {
  const [rows] = await pool.execute(
    `SELECT * FROM dispositivos_sesion
     WHERE id_usuario = ?
     ORDER BY ultimo_visto DESC LIMIT 20`,
    [idUsuario]
  );
  return rows || [];
}

// ==============================
// INTERCEPTOR MIDDLEWARE
// ==============================

function securityInterceptor(req, res, next) {
  // Intercept after response to log status codes
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    // Log 401/403 as suspicious
    if ((res.statusCode === 401 || res.statusCode === 403) && req.user?.id_usuario) {
      createSecurityAlert({
        id_usuario_afectado: req.user.id_usuario,
        tipo_alerta: res.statusCode === 401 ? 'UNAUTHORIZED_ACCESS' : 'FORBIDDEN_ACCESS',
        titulo: res.statusCode === 401 ? 'Acceso no autorizado (401)' : 'Acceso denegado (403)',
        descripcion: `${req.method} ${req.originalUrl} — ${res.statusCode}`,
        severidad: 'BAJA',
        ip_origen: getClientIp(req),
        dispositivo_hash: generateDeviceFingerprint(req),
        user_agent: req.headers['user-agent'],
        metadatos: { method: req.method, url: req.originalUrl, statusCode: res.statusCode }
      }).catch(() => {});
    }
    return originalJson(body);
  };
  next();
}

// ==============================
// EXPORTS
// ==============================

module.exports = {
  RISK_SCORES,
  SEVERITY_THRESHOLDS,
  calculateSeverity,
  analyzeLoginAnomaly,
  createSecurityAlert,
  logCriticalChange,
  trackSessionDevice,
  detectRoleChange,
  detectEmailChange,
  detectForbiddenAccess,
  getSecurityDashboard,
  getAlerts,
  updateAlertStatus,
  getKnownDevices,
  trustDevice,
  revokeDevice,
  getSessionDevices,
  securityInterceptor,
  getClientIp,
  generateDeviceFingerprint,
  isSuspiciousUserAgent
};
