// ==============================
// 📦 IMPORTACIÓN
// ==============================
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// ==============================
// 🔐 MIDDLEWARE: AUTENTICACIÓN JWT
// ==============================
// Verifica que el usuario tenga un token válido
exports.auth = (req, res, next) => {
  // Obtener header Authorization
  const authHeader = req.headers.authorization;

  // ==============================
  // 🛑 VALIDAR TOKEN EXISTENTE
  // ==============================
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      ok: false,
      message: 'Token no proporcionado'
    });
  }

  try {
    // Extraer token (Bearer TOKEN)
    const token = authHeader.split(' ')[1];

    // Verificar token con clave secreta
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Guardar datos del usuario en request
    req.user = decoded;

    // Continuar al siguiente middleware/controlador
    next();
  } catch (error) {
    const message = error.name === 'TokenExpiredError'
      ? 'Tu sesión ha expirado. Inicia sesión nuevamente.'
      : 'Token inválido o expirado. Inicia sesión nuevamente.';
    return res.status(401).json({
      ok: false,
      message
    });
  }
};

// ==============================
// 🔐 MIDDLEWARE: VERIFICACIÓN DE ROL CONTRA BD
// ==============================
// Opcional: verifica que el rol del token aún coincida con la BD
// (protege contra cuentas cuyo rol cambió después de emitir el token)
exports.verifyRoleAgainstDB = async (req, res, next) => {
  if (!req.user?.id_usuario) return next();

  try {
    const [rows] = await pool.execute(
      `SELECT u.id_rol, r.nombre_rol
       FROM usuarios u
       INNER JOIN roles r ON u.id_rol = r.id_rol
       WHERE u.id_usuario = ? AND u.estado = 'Activo'
       LIMIT 1`,
      [req.user.id_usuario]
    );

    if (!rows.length) {
      return res.status(401).json({ ok: false, message: 'Usuario inactivo o no encontrado' });
    }

    const dbRol = rows[0].nombre_rol;
    const tokenRol = String(req.user.rol || '').trim();

    if (dbRol.toLowerCase() !== tokenRol.toLowerCase()) {
      return res.status(401).json({ ok: false, message: 'Rol de usuario inválido. Refresca la sesión.' });
    }

    // Actualizar datos frescos en req.user
    req.user.rol_id = rows[0].id_rol;
    req.user.rol = dbRol;

    next();
  } catch (_) {
    // Si la verificación falla (tabla/columnas no existen), continuar sin bloquear
    next();
  }
};

// ==============================
// 🛡️ MIDDLEWARE: CONTROL DE ROLES
// ==============================
// Permite restringir acceso según roles (RBAC)
exports.role = (...rolesPermitidos) => {
  return (req, res, next) => {
    // ==============================
    // 🛑 VALIDAR USUARIO AUTENTICADO
    // ==============================
    if (!req.user) {
      return res.status(401).json({
        ok: false,
        message: 'Usuario no autenticado'
      });
    }

    // Normalizar rol del usuario
    const rolUsuario = String(req.user.rol || '').trim().toUpperCase();

    // Normalizar roles permitidos
    const rolesNormalizados = rolesPermitidos.map((rol) =>
      String(rol).trim().toUpperCase()
    );

    // ==============================
    // 🛑 VALIDAR PERMISOS
    // ==============================
    if (!rolesNormalizados.includes(rolUsuario)) {
      return res.status(403).json({
        ok: false,
        message: 'No tienes permisos para acceder a este recurso'
      });
    }

    // Usuario autorizado
    next();
  };
};