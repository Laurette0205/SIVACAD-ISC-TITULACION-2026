'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');
const { sendPasswordResetEmail } = require('../services/mailer');

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
      rol_id: user.rol_id
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
      rol = 'alumno',
      matricula = null,
      curp = null,
      numero_empleado = null,
      especialidad = null,
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

    const correoNormalizado = normalizeEmail(correo);
    const rolNormalizado = normalizeRole(rol);

    if (!isInstitutionalEmail(correoNormalizado)) {
      return res.status(400).json({
        ok: false,
        message:
          'Solo se permiten correos institucionales autorizados: @tesi.edu.mx, @ixtapaluca.tecnm.mx, @ixtapaluca.tecnm.edu.mx, @outlook.com y @outlook.es.'
      });
    }

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

    if (rolNormalizado === 'alumno') {
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
    }

    if (
      rolNormalizado === 'docente' ||
      rolNormalizado === 'coordinador' ||
      rolNormalizado === 'administrador' ||
      rolNormalizado === 'soporte'
    ) {
      if (!numero_empleado) {
        return res.status(400).json({
          ok: false,
          message: 'El número de empleado es obligatorio para este perfil'
        });
      }
      if (!curp) {
        return res.status(400).json({
          ok: false,
          message: 'La CURP es obligatoria para este perfil'
        });
      }
      if (!especialidad) {
        return res.status(400).json({
          ok: false,
          message: 'La especialidad es obligatoria para este perfil'
        });
      }
    }

    const hashedPassword = await bcrypt.hash(contrasena, 12);

    await conn.beginTransaction();

    const [userResult] = await conn.execute(
      `INSERT INTO usuarios
       (nombres, apellido_paterno, apellido_materno, correo_institucional, contrasena_hash, estado, id_rol)
       VALUES (?, ?, ?, ?, ?, 'Activo', ?)`,
      [
        capitalizeName(nombres),
        capitalizeName(apellido_paterno),
        capitalizeName(apellido_materno),
        correoNormalizado,
        hashedPassword,
        id_rol
      ]
    );

    const id_usuario = userResult.insertId;
    let extra = {};

    if (rolNormalizado === 'alumno') {
      const matriculaFinal = normalizeText(matricula) || `ISC-${Date.now()}`;

      const [alumnoResult] = await conn.execute(
        `INSERT INTO alumnos
         (id_usuario, apellido_paterno, apellido_materno, nombres, matricula, curp, id_carrera, id_plan, semestre_actual, fotografia, estatus_academico)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'Regular')`,
        [
          id_usuario,
          capitalizeName(apellido_paterno),
          capitalizeName(apellido_materno),
          capitalizeName(nombres),
          matriculaFinal,
          normalizeText(curp).toUpperCase(),
          Number(id_carrera || 1),
          Number(id_plan || 1),
          Number(semestre_actual || 1)
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

    if (rolNormalizado === 'docente') {
      const [docenteResult] = await conn.execute(
        `INSERT INTO docentes
         (id_usuario, clave_docente, numero_empleado, especialidad, fotografia, estatus)
         VALUES (?, ?, ?, ?, NULL, 'Activo')`,
        [
          id_usuario,
          `DOC-${Date.now()}`,
          capitalizeName(numero_empleado),
          capitalizeName(especialidad)
        ]
      );

      extra = { id_docente: docenteResult.insertId };
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
      rol_id: id_rol
    });

    return res.status(201).json({
      ok: true,
      message: 'Usuario registrado correctamente',
      token,
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
        ...extra
      }
    });
  } catch (error) {
    try {
      await conn.rollback();
    } catch (_) {}

    console.error('ERROR EN REGISTER:', error);
    return res.status(500).json({
      ok: false,
      message: error.message || 'Error al registrar usuario'
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
    const pass = String(contrasena || password || '').trim();

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
      return res.status(401).json({
        ok: false,
        message: 'Credenciales incorrectas'
      });
    }

    const user = rows[0];

    if (normalizeText(user.estado).toLowerCase() !== 'activo') {
      return res.status(403).json({
        ok: false,
        message: 'Usuario inactivo'
      });
    }

    const validPassword = await bcrypt.compare(pass, user.contrasena_hash);

    if (!validPassword) {
      return res.status(401).json({
        ok: false,
        message: 'Credenciales incorrectas'
      });
    }

    const token = generateToken({
      id_usuario: user.id_usuario,
      correo: user.correo_institucional,
      rol: user.nombre_rol,
      rol_id: user.id_rol
    });

    await tryUpdateLastAccess(user.id_usuario);

    return res.json({
      ok: true,
      token,
      usuario: {
        id_usuario: user.id_usuario,
        nombres: user.nombres,
        apellido_paterno: user.apellido_paterno,
        apellido_materno: user.apellido_materno,
        nombre_completo: getUserFullName(user),
        correo: user.correo_institucional,
        rol: user.nombre_rol,
        rol_nombre: user.nombre_rol,
        rol_id: user.id_rol
      }
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
// PERFIL
// ==============================
exports.me = async (req, res) => {
  try {
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

    const user = rows[0] || null;

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
    return res.status(500).json({
      ok: false,
      message: error.message || 'Error al procesar solicitud'
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

    if (String(contrasena).length < 8) {
      return res.status(400).json({
        ok: false,
        message: 'La contraseña debe tener al menos 8 caracteres'
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