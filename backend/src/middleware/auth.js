// ==============================
// 📦 IMPORTACIÓN
// ==============================
const jwt = require('jsonwebtoken');

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