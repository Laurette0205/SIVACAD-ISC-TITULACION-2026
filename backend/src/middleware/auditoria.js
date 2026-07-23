/**
 * SIVACAD-ISC — Sistema Integral para la Administración y Control
 *               Académico de la carrera de Ingeniería en Sistemas
 *               Computacionales
 *
 * Copyright (c) 2026 Bárcenas González Laura Casandra &
 *                    Morales Ibarra Sandivel
 *
 * Tecnológico de Estudios Superiores de Ixtapaluca (TESI)
 *
 * Este software es propiedad de las autoras y fue desarrollado
 * como proyecto de titulación. Prohibida su distribución no
 * autorizada, uso comercial o modificación sin consentimiento
 * expreso de las autoras.
 */
const crypto = require('crypto');
const pool = require('../config/db');

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim();
    return req.connection?.remoteAddress || req.ip || '0.0.0.0';
}

function getDeviceHash(req) {
    const ua = req.headers['user-agent'] || '';
    const ip = getClientIp(req);
    const lang = req.headers['accept-language'] || '';
    return crypto.createHash('sha256').update(`${ua}|${ip}|${lang}`).digest('hex');
}

async function registrarAuditoria({
    id_usuario = null,
    id_sesion = null,
    modulo,
    accion,
    descripcion = '',
    entidad_afectada = null,
    id_entidad = null,
    valor_anterior = null,
    valor_nuevo = null,
    ip_origen = null,
    user_agent = null,
    nivel = 'INFO',
    req = null
} = {}) {
    try {
        if (req) {
            ip_origen = ip_origen || getClientIp(req);
            user_agent = user_agent || req.headers['user-agent'] || null;
        }
        const payload = `${id_usuario}|${accion}|${new Date().toISOString()}|${JSON.stringify(valor_nuevo || '')}`;
        const hash_integridad = crypto.createHash('sha256').update(payload).digest('hex');
        await pool.execute(
            `INSERT INTO auditoria_global
             (id_usuario, id_sesion, modulo, accion, descripcion,
              entidad_afectada, id_entidad, valor_anterior, valor_nuevo,
              ip_origen, user_agent, nivel, hash_integridad)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id_usuario, id_sesion, modulo, accion, descripcion,
                entidad_afectada, id_entidad,
                valor_anterior ? JSON.stringify(valor_anterior) : null,
                valor_nuevo ? JSON.stringify(valor_nuevo) : null,
                ip_origen, user_agent, nivel, hash_integridad
            ]
        );
    } catch (error) {
        console.error('[AUDITORIA] Error al registrar:', error.message);
    }
}

async function registrarLogin(userId, req, exitoso = true) {
    const ip = getClientIp(req);
    const ua = req.headers['user-agent'] || '';
    const dispositivoHash = getDeviceHash(req);
    try {
        if (exitoso) {
            const [result] = await pool.execute(
                `INSERT INTO sesiones_activas
                 (id_usuario, token_jwt, ip_origen, user_agent, dispositivo_hash)
                 VALUES (?, ?, ?, ?, ?)`,
                [userId, req.headers.authorization?.replace('Bearer ', '') || '', ip, ua, dispositivoHash]
            );
            const idSesion = result.insertId;
            await registrarAuditoria({
                id_usuario: userId,
                id_sesion: idSesion,
                modulo: 'AUTH',
                accion: 'LOGIN_EXITOSO',
                descripcion: 'Inicio de sesión exitoso',
                ip_origen: ip,
                user_agent: ua,
                nivel: 'INFO'
            });
            return idSesion;
        } else {
            await registrarAuditoria({
                modulo: 'AUTH',
                accion: 'LOGIN_FALLIDO',
                descripcion: 'Intento de inicio de sesión fallido',
                ip_origen: ip,
                user_agent: ua,
                nivel: 'WARNING'
            });
        }
    } catch (error) {
        console.error('[AUDITORIA] Error en registrarLogin:', error.message);
    }
    return null;
}

async function registrarLogout(userId, idSesion) {
    try {
        if (idSesion) {
            await pool.execute(
                `UPDATE sesiones_activas
                 SET fecha_cierre = NOW(), cerrada_por = 'usuario'
                 WHERE id_sesion = ?`,
                [idSesion]
            );
        }
        await registrarAuditoria({
            id_usuario: userId,
            modulo: 'AUTH',
            accion: 'LOGOUT',
            descripcion: 'Cierre de sesión',
            nivel: 'INFO'
        });
    } catch (error) {
        console.error('[AUDITORIA] Error en registrarLogout:', error.message);
    }
}

const auditoriaMiddleware = (modulo, accion, desc = '') => {
    return (req, res, next) => {
        const originalJson = res.json.bind(res);
        res.json = function (body) {
            if (res.statusCode < 400) {
                registrarAuditoria({
                    id_usuario: req.user?.id_usuario || null,
                    modulo,
                    accion,
                    descripcion: desc || `${accion} en ${modulo}`,
                    req
                }).catch(() => {});
            }
            return originalJson(body);
        };
        next();
    };
};

module.exports = {
    registrarAuditoria,
    registrarLogin,
    registrarLogout,
    auditoriaMiddleware,
    getClientIp,
    getDeviceHash
};
