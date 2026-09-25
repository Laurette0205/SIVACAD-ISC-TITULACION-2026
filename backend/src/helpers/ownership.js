'use strict';

const pool = require('../config/db');

function rolDe(req) {
  return String(req.user?.rol || '').trim().toUpperCase();
}

async function resolverIdAlumno(req) {
  if (!req?.user) return null;
  if (req.user.id_alumno) return Number(req.user.id_alumno);
  try {
    const [rows] = await pool.execute(
      'SELECT id_alumno FROM alumnos WHERE id_usuario = ? LIMIT 1',
      [req.user.id_usuario]
    );
    return rows.length ? Number(rows[0].id_alumno) : null;
  } catch (_) {
    return null;
  }
}

// Devuelve null si el acceso está permitido; {status, message} si debe denegarse.
// Aplica solo al rol ALUMNO (ownership). Otros roles se validan en la ruta con role().
async function denegarSiNoEsAlumnoPropio(req, idAlumno, mensaje) {
  if (rolDe(req) !== 'ALUMNO') return null;
  const propio = await resolverIdAlumno(req);
  if (propio && propio === Number(idAlumno)) return null;
  return { status: 403, message: mensaje };
}

module.exports = {
  rolDe,
  resolverIdAlumno,
  denegarSiNoEsAlumnoPropio
};
