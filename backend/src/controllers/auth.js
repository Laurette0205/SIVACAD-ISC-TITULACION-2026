'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');
const { sendPasswordResetEmail } = require('../services/mailer');
const { signToken, signRefreshToken, verifyRefreshToken } = require('../services/jwt');
const { validatePassword } = require('../security/passwordPolicy');
const { isAccountLocked, recordFailedAttempt, recordSuccessfulLogin } = require('../services/accountLockout');
const { verifyMFALogin } = require('../services/mfa');
const { resolveByDomain } = require('../services/institutionConfig');
const { logout, trackSession, logoutAllSessions } = require('../services/sessionManager');

// ==============================
// UTILIDADES
// ==============================
function normalizeText(value) {
  return String(value || '').trim();
}

function capitalizeName(value) {
  const LOWER_EXCEPTIONS = new Set(['de', 'del', 'de la', 'de las', 'de los', 'y', 'e', 'van', 'von', 'da', 'dos']);
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => {
      const lower = word.toLowerCase();
      if (LOWER_EXCEPTIONS.has(lower)) return lower;
      return word.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function normalizeEmail(email) {
  return normalizeText(email).toLowerCase();
}

function normalizeRole(role) {
  return normalizeText(role).toLowerCase();
}

function isDevelopmentMode() {
  return String(process.env.NODE_ENV || 'development').trim().toLowerCase() !== 'production';
}

function getAllowedEmailDomains() {
  const fallbackDomains = [
    'tesi.edu.mx',
    'ixtapaluca.tecnm.mx',
    'ixtapaluca.tecnm.edu.mx',
    'outlook.com',
    'outlook.es'
  ];

  const raw = String(
    process.env.ALLOWED_INSTITUTION_EMAIL_DOMAINS || fallbackDomains.join(',')
  );

  return raw
    .split(',')
    .map((domain) => String(domain || '').trim().toLowerCase())
    .map((domain) => domain.replace(/^@+/, ''))
    .filter(Boolean);
}

function isInstitutionalEmail(email) {
  const value = normalizeEmail(email);
  const atIndex = value.lastIndexOf('@');

  if (atIndex === -1) return false;

  const domain = value.slice(atIndex + 1).trim().toLowerCase();
  const allowedDomains = getAllowedEmailDomains();

  return allowedDomains.some(
    (allowed) => domain === allowed || domain.endsWith(`.${allowed}`)
  );
}

function getFrontendUrl() {
  return String(
    process.env.FRONTEND_URL ||
      process.env.APP_URL ||
      'http://localhost:5173'
  ).replace(/\/$/, '');
}

function getResetPasswordUrl(resetToken) {
  const base = getFrontendUrl();
  const path = String(process.env.RESET_PASSWORD_PATH || '/reset-password').trim() || '/reset-password';
  return `${base}${path.replace(/\/$/, '')}/${encodeURIComponent(resetToken)}`;
}

function generateToken(user) {
  return jwt.sign(
    {
      id_usuario: user.id_usuario,
      correo: user.correo,
      rol: user.rol,
      rol_id: user.rol_id,
      id_institucion: user.id_institucion || 1
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h'
    }
  );
}

function getUserFullName(user) {
  return `${user?.nombres || ''} ${user?.apellido_paterno || ''} ${user?.apellido_materno || ''}`
    .replace(/\s+/g, ' ')
    .trim();
}

async function tryUpdateLastAccess(userId) {
  try {
    await pool.execute(
      `UPDATE usuarios SET ultimo_acceso = NOW() WHERE id_usuario = ?`,
      [userId]
    );
  } catch (_) {
    // No rompemos el login si la columna no existe.
  }
}

async function cleanupOldResetTokens(conn, userId) {
  try {
    await conn.execute(
      `UPDATE password_resets SET used = 1 WHERE id_usuario = ? AND used = 0`,
      [userId]
    );
  } catch (_) {
    try {
      await conn.execute(
        `UPDATE password_resets SET used = 1 WHERE usuario_id = ? AND used = 0`,
        [userId]
      );
    } catch (_) {}
  }
}

async function insertResetToken(conn, userId, token, expiresAt) {
  try {
    await conn.execute(
      `INSERT INTO password_resets
       (id_usuario, token, expires_at, created_at)
       VALUES (?, ?, ?, NOW())`,
      [userId, token, expiresAt]
    );
    return;
  } catch (_) {
    await conn.execute(
      `INSERT INTO password_resets
       (usuario_id, token, expira, created_at)
       VALUES (?, ?, ?, NOW())`,
      [userId, token, expiresAt]
    );
  }
}

async function findResetToken(conn, token) {
  try {
    const [rows] = await conn.execute(
      `SELECT
        pr.id_reseteo,
        pr.id_usuario,
        pr.token,
        pr.expires_at,
        u.estado
       FROM password_resets pr
       INNER JOIN usuarios u ON u.id_usuario = pr.id_usuario
       WHERE pr.token = ? AND pr.used = 0 AND pr.expires_at > NOW()
       LIMIT 1`,
      [token]
    );

    return rows?.[0] || null;
  } catch (_) {
    const [rows] = await conn.execute(
      `SELECT
        pr.id_reseteo,
        pr.usuario_id AS id_usuario,
        pr.token,
        pr.expira AS expires_at,
        u.estado
       FROM password_resets pr
       INNER JOIN usuarios u ON u.id_usuario = pr.usuario_id
       WHERE pr.token = ? AND pr.used = 0 AND pr.expira > NOW()
       LIMIT 1`,
      [token]
    );

    return rows?.[0] || null;
  }
}

async function markResetTokenUsed(conn, token, idReseteo) {
  try {
    if (idReseteo !== undefined && idReseteo !== null) {
      await conn.execute(
        `UPDATE password_resets SET used = 1 WHERE id_reseteo = ?`,
        [idReseteo]
      );
      return;
    }

    await conn.execute(
      `UPDATE password_resets SET used = 1 WHERE token = ?`,
      [token]
    );
  } catch (_) {
    // No romper el flujo si la limpieza falla.
  }
}

// ==============================
// REGISTRO
// ==============================
exports.register = async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const {
      nombres,
      apellido_paterno,
      apellido_materno,
      correo,
      contrasena,
      matricula = null,
      curp = null,
      id_carrera = 1,
      id_plan = 1,
      semestre_actual = 1
    } = req.body;

    if (
      !nombres ||
      !apellido_paterno ||
      !apellido_materno ||
      !correo ||
      !contrasena
    ) {
      return res.status(400).json({
        ok: false,
        message: 'Faltan campos obligatorios'
      });
    }

    const passwordValidation = validatePassword(contrasena);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        ok: false,
        message: passwordValidation.message
      });
    }

    const correoNormalizado = normalizeEmail(correo);

    if (!isInstitutionalEmail(correoNormalizado)) {
      return res.status(400).json({
        ok: false,
        message:
          'Solo se permiten correos institucionales autorizados: @tesi.edu.mx, @ixtapaluca.tecnm.mx, @ixtapaluca.tecnm.edu.mx, @outlook.com y @outlook.es.'
      });
    }

    // SEGURIDAD: Registro solo permite rol "alumno"
    // Otros roles deben ser creados por un administrador
    const rolNormalizado = 'alumno';

    // Resolver institución desde dominio del email
    const idInstitucion = await resolveByDomain(correoNormalizado) || 1;

    const [rolRows] = await conn.execute(
      `SELECT id_rol, nombre_rol
       FROM roles
       WHERE LOWER(nombre_rol) = ?
       LIMIT 1`,
      [rolNormalizado]
    );

    if (!rolRows.length) {
      return res.status(400).json({
        ok: false,
        message: 'Rol inválido'
      });
    }

    const id_rol = rolRows[0].id_rol;

    const [existsRows] = await conn.execute(
      `SELECT id_usuario
       FROM usuarios
       WHERE correo_institucional = ?
       LIMIT 1`,
      [correoNormalizado]
    );

    if (existsRows.length > 0) {
      return res.status(409).json({
        ok: false,
        message: 'El correo ya está registrado'
      });
    }

    // Validaciones para alumno (único rol permitido en registro público)
    if (!matricula) {
      return res.status(400).json({
        ok: false,
        message: 'La matrícula es obligatoria para alumnos'
      });
    }
    if (!curp) {
      return res.status(400).json({
        ok: false,
        message: 'La CURP es obligatoria para alumnos'
      });
    }

    const hashedPassword = await bcrypt.hash(contrasena, 12);

    await conn.beginTransaction();

    const [userResult] = await conn.execute(
      `INSERT INTO usuarios
       (nombres, apellido_paterno, apellido_materno, correo_institucional, contrasena_hash, estado, id_rol, id_institucion)
       VALUES (?, ?, ?, ?, ?, 'Activo', ?, ?)`,
      [
        capitalizeName(nombres),
        capitalizeName(apellido_paterno),
        capitalizeName(apellido_materno),
        correoNormalizado,
        hashedPassword,
        id_rol,
        idInstitucion
      ]
    );

    const id_usuario = userResult.insertId;
    let extra = {};

    if (rolNormalizado === 'alumno') {
      const matriculaFinal = normalizeText(matricula) || `ISC-${Date.now()}`;

      const [alumnoResult] = await conn.execute(
        `INSERT INTO alumnos
         (id_usuario, apellido_paterno, apellido_materno, nombres, matricula, curp, id_carrera, id_plan, semestre_actual, fotografia, estatus_academico, id_institucion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'Regular', ?)`,
        [
          id_usuario,
          capitalizeName(apellido_paterno),
          capitalizeName(apellido_materno),
          capitalizeName(nombres),
          matriculaFinal,
          normalizeText(curp).toUpperCase(),
          Number(id_carrera || 1),
          Number(id_plan || 1),
          Number(semestre_actual || 1),
          idInstitucion
        ]
      );

      await conn.execute(
        `INSERT INTO kardex_alumno
         (id_alumno, numero_control, foto_alumno, promedio_general, creditos_acumulados, estatus, qr_token, url_qr)
         VALUES (?, ?, NULL, 0.00, 0, 'Vigente', ?, NULL)`,
        [
          alumnoResult.insertId,
          matriculaFinal,
          crypto.randomUUID()
        ]
      );

      extra = { id_alumno: alumnoResult.insertId };
    }

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.connection?.remoteAddress || '0.0.0.0';
    const ua = req.headers['user-agent'] || '';
    const versionDoc = '2026.1';
    const aceptaciones = [
      { tipo: 'terminos', version: versionDoc },
      { tipo: 'privacidad', version: versionDoc },
      { tipo: 'propiedad_intelectual', version: versionDoc }
    ];
    for (const a of aceptaciones) {
      await conn.execute(
        `INSERT INTO aceptaciones_legales
         (id_usuario, tipo_aceptacion, version_documento, ip_origen, user_agent)
         VALUES (?, ?, ?, ?, ?)`,
        [id_usuario, a.tipo, a.version, ip, ua]
      );
    }

    await conn.commit();

    const token = generateToken({
      id_usuario,
      correo: correoNormalizado,
      rol: rolRows[0].nombre_rol,
      rol_id: id_rol,
      id_institucion: idInstitucion
    });

    return res.status(201).json({
      ok: true,
      message: 'Usuario registrado correctamente',
      token,
      refreshToken: signRefreshToken({ id_usuario }),
      usuario: {
        id_usuario,
        nombres: capitalizeName(nombres),
        apellido_paterno: capitalizeName(apellido_paterno),
        apellido_materno: capitalizeName(apellido_materno),
        nombre_completo: getUserFullName({
          nombres,
          apellido_paterno,
          apellido_materno
        }),
        correo: correoNormalizado,
        rol: rolRows[0].nombre_rol,
        rol_nombre: rolRows[0].nombre_rol,
        rol_id: id_rol,
        id_institucion: idInstitucion,
        ...extra
      }
    });
  } catch (error) {
    try {
      await conn.rollback();
    } catch (_) {}

    console.error('ERROR EN REGISTER:', error);
    const isProd = process.env.NODE_ENV === 'production';
    return res.status(500).json({
      ok: false,
      message: isProd ? 'Error al registrar usuario' : (error.message || 'Error al registrar usuario')
    });
  } finally {
    conn.release();
  }
};

// ==============================
// LOGIN
// ==============================
exports.login = async (req, res) => {
  try {
    const { correo, contrasena, password } = req.body;
    const pass = String(contrasena || password || '');

    if (!correo || !pass) {
      return res.status(400).json({
        ok: false,
        message: 'Correo y contraseña requeridos'
      });
    }

    const correoNormalizado = normalizeEmail(correo);

    if (!isInstitutionalEmail(correoNormalizado)) {
      return res.status(400).json({
        ok: false,
        message:
          'Solo se permiten correos institucionales autorizados: @tesi.edu.mx, @ixtapaluca.tecnm.mx, @ixtapaluca.tecnm.edu.mx, @outlook.com y @outlook.es.'
      });
    }

    // Resolver institución desde dominio del email
    const idInstitucion = await resolveByDomain(correoNormalizado) || 1;

    const [rows] = await pool.execute(
      `SELECT
        u.id_usuario,
        u.nombres,
        u.apellido_paterno,
        u.apellido_materno,
        u.correo_institucional,
        u.contrasena_hash,
        u.estado,
        u.id_rol,
        r.nombre_rol
       FROM usuarios u
       INNER JOIN roles r ON u.id_rol = r.id_rol
       WHERE u.correo_institucional = ?
       LIMIT 1`,
      [correoNormalizado]
    );

    if (!rows.length) {
      const { logSuspiciousActivity } = require('../middleware/seguridad');
      logSuspiciousActivity(req, 'LOGIN_FAILED_EMAIL', { correo: correoNormalizado });
      return res.status(401).json({
        ok: false,
        message: 'Credenciales incorrectas'
      });
    }

    const user = rows[0];

    if (normalizeText(user.estado).toLowerCase() !== 'activo') {
      const { logSuspiciousActivity } = require('../middleware/seguridad');
      logSuspiciousActivity(req, 'LOGIN_ATTEMPT_INACTIVE', { userId: user.id_usuario, correo: correoNormalizado });
      return res.status(403).json({
        ok: false,
        message: 'Usuario inactivo'
      });
    }

    // Obtener id_institucion del usuario (puede no existir la columna aún)
    let userInstitucion = null;
    try {
      const [instRows] = await pool.execute(
        `SELECT id_institucion FROM usuarios WHERE id_usuario = ? LIMIT 1`,
        [user.id_usuario]
      );
      userInstitucion = instRows[0]?.id_institucion || null;
    } catch (_) {
      // Columna id_institucion no existe aún
    }

    // Verificar bloqueo de cuenta
    const lockStatus = await isAccountLocked(user.id_usuario);
    if (lockStatus && lockStatus.locked) {
      const { logSuspiciousActivity } = require('../middleware/seguridad');
      logSuspiciousActivity(req, 'LOGIN_ATTEMPT_LOCKED', { userId: user.id_usuario, remaining: lockStatus.remainingMinutes });
      return res.status(423).json({
        ok: false,
        message: lockStatus.message
      });
    }

    const validPassword = await bcrypt.compare(pass, user.contrasena_hash);

    if (!validPassword) {
      const { logSuspiciousActivity } = require('../middleware/seguridad');
      logSuspiciousActivity(req, 'LOGIN_FAILED_PASSWORD', { userId: user.id_usuario, correo: correoNormalizado });

      // Registrar intento fallido y posiblemente bloquear
      const attemptResult = await recordFailedAttempt(user.id_usuario);
      if (attemptResult.locked) {
        return res.status(423).json({
          ok: false,
          message: attemptResult.message
        });
      }

      return res.status(401).json({
        ok: false,
        message: 'Credenciales incorrectas'
      });
    }

    // Login exitoso — resetear contadores de bloqueo
    await recordSuccessfulLogin(user.id_usuario);

    // Verificar si MFA está activo
    const mfaStatus = await verifyMFALogin(user.id_usuario, null);
    if (mfaStatus.required) {
      // MFA activo: retornar token temporal de 5 minutos para completar login
      const mfaToken = signToken({
        id_usuario: user.id_usuario,
        type: 'mfa_pending',
        id_institucion: userInstitucion || idInstitucion || 1
      }, '5m');

      return res.json({
        ok: true,
        mfaRequired: true,
        mfaToken,
        message: 'Se requiere código de autenticación de dos factores'
      });
    }

    const institucionId = userInstitucion || idInstitucion || 1;

    const token = generateToken({
      id_usuario: user.id_usuario,
      correo: user.correo_institucional,
      rol: user.nombre_rol,
      rol_id: user.id_rol,
      id_institucion: institucionId
    });

    const refreshToken = signRefreshToken({ id_usuario: user.id_usuario });

    await tryUpdateLastAccess(user.id_usuario);

    // Track device on successful login
    const { trackDevice } = require('../middleware/seguridad');
    const deviceInfo = await trackDevice(req, user.id_usuario);

    // Track session
    await trackSession(user.id_usuario, token, req);

    return res.json({
      ok: true,
      token,
      refreshToken,
      usuario: {
        id_usuario: user.id_usuario,
        nombres: user.nombres,
        apellido_paterno: user.apellido_paterno,
        apellido_materno: user.apellido_materno,
        nombre_completo: getUserFullName(user),
        correo: user.correo_institucional,
        rol: user.nombre_rol,
        rol_nombre: user.nombre_rol,
        rol_id: user.id_rol,
        id_institucion: institucionId
      },
      device: deviceInfo.isNew ? { isNew: true, message: 'Dispositivo nuevo detectado' } : undefined
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      ok: false,
      message: 'Error al iniciar sesión'
    });
  }
};

// ==============================
// COMPLETAR LOGIN CON MFA
// ==============================
exports.loginMFA = async (req, res) => {
  try {
    const { mfaToken, codigo } = req.body;

    if (!mfaToken || !codigo) {
      return res.status(400).json({ ok: false, message: 'Token MFA y código son requeridos' });
    }

    // Verificar token temporal MFA
    let decoded;
    try {
      const { verifyToken } = require('../services/jwt');
      decoded = verifyToken(mfaToken);
    } catch (_) {
      return res.status(401).json({ ok: false, message: 'Token MFA inválido o expirado' });
    }

    if (decoded.type !== 'mfa_pending') {
      return res.status(401).json({ ok: false, message: 'Token no es de tipo MFA' });
    }

    const idUsuario = decoded.id_usuario;
    const idInstitucion = decoded.id_institucion || 1;

    // Verificar código MFA
    const mfaResult = await verifyMFALogin(idUsuario, codigo);
    if (!mfaResult.verified) {
      const { registrarAuditoria } = require('../middleware/auditoria');
      await registrarAuditoria({
        id_usuario: idUsuario,
        modulo: 'SEGURIDAD',
        accion: 'MFA_LOGIN_FAILED',
        descripcion: 'Código MFA inválido durante login',
        nivel: 'WARNING',
        req
      });
      return res.status(401).json({ ok: false, message: mfaResult.message || 'Código MFA inválido' });
    }

    const { registrarAuditoria } = require('../middleware/auditoria');
    await registrarAuditoria({
      id_usuario: idUsuario,
      modulo: 'SEGURIDAD',
      accion: 'MFA_LOGIN_SUCCESS',
      descripcion: 'Login completado con MFA verificado',
      nivel: 'INFO',
      req
    });

    // MFA verificado: generar token completo
    const [rows] = await pool.execute(
      `SELECT u.id_usuario, u.nombres, u.apellido_paterno, u.apellido_materno,
              u.correo_institucional, u.estado, u.id_rol, r.nombre_rol
       FROM usuarios u
       INNER JOIN roles r ON u.id_rol = r.id_rol
       WHERE u.id_usuario = ? LIMIT 1`,
      [idUsuario]
    );

    if (!rows.length) {
      return res.status(401).json({ ok: false, message: 'Usuario no encontrado' });
    }

    const user = rows[0];

    if (normalizeText(user.estado).toLowerCase() !== 'activo') {
      return res.status(403).json({ ok: false, message: 'Usuario inactivo' });
    }

    const token = generateToken({
      id_usuario: user.id_usuario,
      correo: user.correo_institucional,
      rol: user.nombre_rol,
      rol_id: user.id_rol,
      id_institucion: idInstitucion
    });

    const refreshToken = signRefreshToken({ id_usuario: user.id_usuario });

    await tryUpdateLastAccess(user.id_usuario);

    const { trackDevice } = require('../middleware/seguridad');
    const deviceInfo = await trackDevice(req, user.id_usuario);

    const { trackSession } = require('../services/sessionManager');
    await trackSession(user.id_usuario, token, req);

    return res.json({
      ok: true,
      token,
      refreshToken,
      usuario: {
        id_usuario: user.id_usuario,
        nombres: user.nombres,
        apellido_paterno: user.apellido_paterno,
        apellido_materno: user.apellido_materno,
        nombre_completo: getUserFullName(user),
        correo: user.correo_institucional,
        rol: user.nombre_rol,
        rol_nombre: user.nombre_rol,
        rol_id: user.id_rol,
        id_institucion: idInstitucion
      },
      device: deviceInfo.isNew ? { isNew: true, message: 'Dispositivo nuevo detectado' } : undefined
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, message: 'Error al completar login MFA' });
  }
};

// ==============================
// PERFIL
// ==============================
exports.me = async (req, res) => {
  try {
    let user = null;

    // Intentar con id_institucion
    try {
      const [rows] = await pool.execute(
        `SELECT
          u.id_usuario,
          u.nombres,
          u.apellido_paterno,
          u.apellido_materno,
          u.correo_institucional AS correo,
          u.id_rol AS rol_id,
          u.id_institucion,
          r.nombre_rol AS rol
         FROM usuarios u
         INNER JOIN roles r ON u.id_rol = r.id_rol
         WHERE u.id_usuario = ?
         LIMIT 1`,
        [req.user.id_usuario]
      );
      user = rows[0] || null;
    } catch (_) {
      // Fallback si id_institucion no existe
      const [rows] = await pool.execute(
        `SELECT
          u.id_usuario,
          u.nombres,
          u.apellido_paterno,
          u.apellido_materno,
          u.correo_institucional AS correo,
          u.id_rol AS rol_id,
          r.nombre_rol AS rol
         FROM usuarios u
         INNER JOIN roles r ON u.id_rol = r.id_rol
         WHERE u.id_usuario = ?
         LIMIT 1`,
        [req.user.id_usuario]
      );
      user = rows[0] || null;
      if (user) user.id_institucion = req.user.id_institucion || 1;
    }

    return res.json({
      ok: true,
      usuario: user
        ? {
            ...user,
            nombre_completo: getUserFullName(user),
            rol_nombre: user.rol
          }
        : null
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      ok: false,
      message: 'Error al obtener perfil'
    });
  }
};

// ==============================
// FORGOT PASSWORD
// ==============================
exports.forgotPassword = async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const correo = normalizeEmail(req.body?.correo);

    if (!correo) {
      return res.status(400).json({
        ok: false,
        message: 'Correo requerido'
      });
    }

    if (!isInstitutionalEmail(correo)) {
      return res.status(400).json({
        ok: false,
        message:
          'Solo se permiten correos institucionales autorizados: @tesi.edu.mx, @ixtapaluca.tecnm.mx, @ixtapaluca.tecnm.edu.mx, @outlook.com y @outlook.es.'
      });
    }

    const [rows] = await conn.execute(
      `SELECT
        u.id_usuario,
        u.nombres,
        u.apellido_paterno,
        u.apellido_materno,
        u.correo_institucional,
        u.estado
       FROM usuarios u
       WHERE u.correo_institucional = ?
       LIMIT 1`,
      [correo]
    );

    if (!rows.length) {
      return res.json({
        ok: true,
        message: 'Si el correo está registrado, recibirás un enlace de recuperación.'
      });
    }

    const user = rows[0];

    if (normalizeText(user.estado).toLowerCase() !== 'activo') {
      return res.json({
        ok: true,
        message: 'Si el correo está registrado, recibirás un enlace de recuperación.'
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await conn.beginTransaction();

    await cleanupOldResetTokens(conn, user.id_usuario);
    await insertResetToken(conn, user.id_usuario, resetToken, expiresAt);

    await conn.commit();

    const resetUrl = getResetPasswordUrl(resetToken);

    try {
      const mailResult = await sendPasswordResetEmail({
        to: user.correo_institucional,
        name: getUserFullName(user),
        resetUrl
      });

      if (mailResult?.mode === 'development' || mailResult?.preview) {
        return res.json({
          ok: true,
          message:
            'Modo local activo: se generó el enlace de recuperación y se mostró en la consola del backend. No se envió un correo real.',
          devMode: true,
          resetUrl
        });
      }
    } catch (mailError) {
      console.error('ERROR SMTP:', mailError);

      if (isDevelopmentMode()) {
        console.warn('[AUTH][DEV] Recuperación habilitada sin SMTP real.');
        console.warn(`[AUTH][DEV] Enlace de recuperación: ${resetUrl}`);

        return res.json({
          ok: true,
          message:
            'Modo local activo: no se envió correo real, pero la solicitud de recuperación quedó generada. Revisa la consola del backend para copiar el enlace.',
          devMode: true,
          resetUrl
        });
      }

      try {
        await cleanupOldResetTokens(conn, user.id_usuario);
      } catch (_) {}

      return res.status(503).json({
        ok: false,
        message: 'No fue posible enviar el correo de recuperación. Verifica la configuración SMTP.'
      });
    }

    return res.json({
      ok: true,
      message: 'Se envió un enlace de recuperación al correo institucional registrado.'
    });
  } catch (error) {
    try {
      await conn.rollback();
    } catch (_) {}

    console.error(error);
    const isProd = process.env.NODE_ENV === 'production';
    return res.status(500).json({
      ok: false,
      message: isProd ? 'Error al procesar solicitud' : (error.message || 'Error al procesar solicitud')
    });
  } finally {
    conn.release();
  }
};

// ==============================
// RESET PASSWORD
// ==============================
exports.resetPassword = async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const resetToken = req.params.token || req.body?.token;
    const contrasena = req.body?.contrasena || req.body?.password;

    if (!resetToken) {
      return res.status(400).json({
        ok: false,
        message: 'Token de recuperación requerido'
      });
    }

    if (!contrasena) {
      return res.status(400).json({
        ok: false,
        message: 'Nueva contraseña requerida'
      });
    }

    const passwordValidationReset = validatePassword(contrasena);
    if (!passwordValidationReset.valid) {
      return res.status(400).json({
        ok: false,
        message: passwordValidationReset.message
      });
    }

    const resetRow = await findResetToken(conn, resetToken);

    if (!resetRow) {
      return res.status(400).json({
        ok: false,
        message: 'El enlace de recuperación no es válido o ha expirado.'
      });
    }

    if (new Date(resetRow.expires_at).getTime() < Date.now()) {
      return res.status(400).json({
        ok: false,
        message: 'El enlace de recuperación ha expirado.'
      });
    }

    if (normalizeText(resetRow.estado).toLowerCase() !== 'activo') {
      return res.status(403).json({
        ok: false,
        message: 'La cuenta está inactiva o bloqueada.'
      });
    }

    const hashedPassword = await bcrypt.hash(contrasena, 12);

    await conn.beginTransaction();

    await conn.execute(
      `UPDATE usuarios
       SET contrasena_hash = ?
       WHERE id_usuario = ?`,
      [hashedPassword, resetRow.id_usuario]
    );

    await markResetTokenUsed(conn, resetToken, resetRow.id_reseteo);

    await conn.commit();

    return res.json({
      ok: true,
      message: 'Contraseña actualizada correctamente'
    });
  } catch (error) {
    try {
      await conn.rollback();
    } catch (_) {}

    console.error(error);
    return res.status(500).json({
      ok: false,
      message: error.message || 'Token inválido o expirado'
    });
  } finally {
    conn.release();
  }
};
// ==============================
// REFRESH TOKEN
// ==============================
exports.refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        ok: false,
        message: 'Refresh token requerido'
      });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (_) {
      return res.status(401).json({
        ok: false,
        message: 'Refresh token invalido o expirado'
      });
    }

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        ok: false,
        message: 'Token de tipo invalido'
      });
    }

    let user = null;
    try {
      const [rows] = await pool.execute(
        `SELECT u.id_usuario, u.id_rol, u.id_institucion, u.estado, r.nombre_rol
         FROM usuarios u
         INNER JOIN roles r ON u.id_rol = r.id_rol
         WHERE u.id_usuario = ?
         LIMIT 1`,
        [decoded.id_usuario]
      );
      user = rows[0] || null;
    } catch (_) {
      const [rows] = await pool.execute(
        `SELECT u.id_usuario, u.id_rol, u.estado, r.nombre_rol
         FROM usuarios u
         INNER JOIN roles r ON u.id_rol = r.id_rol
         WHERE u.id_usuario = ?
         LIMIT 1`,
        [decoded.id_usuario]
      );
      user = rows[0] || null;
      if (user) user.id_institucion = 1;
    }

    if (!user) {
      return res.status(401).json({
        ok: false,
        message: 'Usuario no encontrado'
      });
    }

    if (normalizeText(user.estado).toLowerCase() !== 'activo') {
      return res.status(401).json({
        ok: false,
        message: 'Usuario inactivo'
      });
    }

    const newToken = generateToken({
      id_usuario: user.id_usuario,
      correo: null,
      rol: user.nombre_rol,
      rol_id: user.id_rol,
      id_institucion: user.id_institucion || 1
    });

    const newRefreshToken = signRefreshToken({ id_usuario: user.id_usuario });

    return res.json({
      ok: true,
      token: newToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      ok: false,
      message: 'Error al refrescar token'
    });
  }
};

// ==============================
// LOGOUT
// ==============================
exports.logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (token) {
      await logout(token, 'logout');
    }

    return res.json({
      ok: true,
      message: 'Sesión cerrada correctamente'
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      ok: false,
      message: 'Error al cerrar sesión'
    });
  }
};

// ==============================
// LOGOUT ALL SESSIONS
// ==============================
exports.logoutAll = async (req, res) => {
  try {
    await logoutAllSessions(req.user.id_usuario, 'logout_all');

    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    if (token) {
      await logout(token, 'logout_all');
    }

    return res.json({
      ok: true,
      message: 'Todas las sesiones cerradas correctamente'
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      ok: false,
      message: 'Error al cerrar sesiones'
    });
  }
};

// ==============================
// REAUTHENTICATE — revalidar credenciales antes de ops sensibles
// ==============================
exports.reauthenticate = async (req, res) => {
  try {
    const { contrasena } = req.body;
    if (!contrasena) {
      return res.status(400).json({ ok: false, message: 'Contraseña requerida para reautenticación' });
    }

    const [rows] = await pool.execute(
      `SELECT contrasena_hash FROM usuarios WHERE id_usuario = ? LIMIT 1`,
      [req.user.id_usuario]
    );

    if (!rows.length) {
      return res.status(401).json({ ok: false, message: 'Usuario no encontrado' });
    }

    const valid = await bcrypt.compare(contrasena, rows[0].contrasena_hash);
    if (!valid) {
      const { registrarAuditoria } = require('../middleware/auditoria');
      await registrarAuditoria({
        id_usuario: req.user.id_usuario,
        modulo: 'SEGURIDAD',
        accion: 'REAUTH_FAILED',
        descripcion: 'Reautenticación fallida — contraseña incorrecta',
        nivel: 'WARNING',
        req
      });
      return res.status(401).json({ ok: false, message: 'Contraseña incorrecta' });
    }

    const { signToken } = require('../services/jwt');
    const reauthToken = signToken(
      { id_usuario: req.user.id_usuario, type: 'reauth' },
      '10m'
    );

    const { registrarAuditoria } = require('../middleware/auditoria');
    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      modulo: 'SEGURIDAD',
      accion: 'REAUTH_SUCCESS',
      descripcion: 'Reautenticación exitosa — token temporal emitido',
      nivel: 'INFO',
      req
    });

    return res.json({ ok: true, message: 'Reautenticación exitosa', reauthToken });
  } catch (error) {
    console.error('[REAUTH]', error);
    return res.status(500).json({ ok: false, message: 'Error en reautenticación' });
  }
};
