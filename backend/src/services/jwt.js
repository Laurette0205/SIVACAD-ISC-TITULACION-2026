// ==============================
// 📦 IMPORTACIÓN
// ==============================
const jwt = require('jsonwebtoken');

// ==============================
// 🔐 GENERADOR DE TOKEN JWT
// ==============================
// Crea un token firmado con datos del usuario
exports.signToken = (payload) => {
  // ==============================
  // ⚙️ CONFIGURACIÓN
  // ==============================
    const secret = process.env.JWT_SECRET;
    const expiresIn = process.env.JWT_EXPIRES_IN || '8h';

  // ==============================
  // 🛑 VALIDACIÓN DE SEGURIDAD
  // ==============================
    if (!secret) {
        throw new Error('JWT_SECRET no está definido en variables de entorno');
    }

  // ==============================
  // 🎟️ GENERACIÓN DEL TOKEN
  // ==============================
    const token = jwt.sign(payload, secret, {
        expiresIn
    });

    return token;
};