'use strict';

const academicControlService = require('../services/academicControlService');
const { registrarExportAudit } = require('../helpers/excelHelpers');

// Helper: resolver id del rol
function esRol(user, ...roles) {
  return roles.includes(String(user.rol).trim().toUpperCase());
}

// Helper: resolver id del docente
async function resolveDocenteId(idUsuario) {
  const pool = require('../config/db');
  const [rows] = await pool.execute(
    'SELECT id_docente FROM docentes WHERE id_usuario = ? LIMIT 1', [idUsuario]
  );
  return rows.length ? rows[0].id_docente : null;
}

// Helper: resolver id del alumno
async function resolveAlumnoId(idUsuario) {
  const pool = require('../config/db');
  const [rows] = await pool.execute(
    'SELECT id_alumno FROM alumnos WHERE id_usuario = ? LIMIT 1', [idUsuario]
  );
  return rows.length ? rows[0].id_alumno : null;
}

// ==============================
// FILTROS DISPONIBLES
// ==============================
async function getFiltros(req, res) {
  try {
    const { idPeriodo } = req.params;
    const filtros = await academicControlService.getFiltrosDisponibles(
      Number(idPeriodo), req.user.rol, req.user.id_usuario
    );
    return res.json({ ok: true, filtros });
  } catch (error) {
    console.error('[AC-CONTROL] Error filtros:', error.message);
    res.status(500).json({ ok: false, message: error.message });
  }
}

// ==============================
// NIVEL 1: PARCIAL
// ==============================
async function getParcial(req, res) {
  try {
    const { idPeriodo, parcial } = req.params;
    const { idGrupo, idMateria, idDocente, estado } = req.query;
    const p = parseInt(parcial, 10);

    const filtros = { idGrupo, idMateria, idDocente, estado };

    // Docente: filtrar por sus grupos
    if (esRol(req.user, 'DOCENTE')) {
      const idDoc = await resolveDocenteId(req.user.id_usuario);
      if (!idDoc) return res.status(403).json({ ok: false, message: 'Perfil docente no encontrado' });
      filtros.idDocente = idDoc;
    }

    // Alumno: solo su calificación
    if (esRol(req.user, 'ALUMNO')) {
      const idAl = await resolveAlumnoId(req.user.id_usuario);
      if (!idAl) return res.status(403).json({ ok: false, message: 'Perfil alumno no encontrado' });
      filtros.idAlumno = idAl;
    }

    const resultado = await academicControlService.getParcial(Number(idPeriodo), p, filtros);

    await registrarExportAudit(req.user.id_usuario, 'CONTROL_PARCIAL',
      `Consulta Parcial ${p} — Periodo ${idPeriodo}`, req);

    return res.json({ ok: true, ...resultado });
  } catch (error) {
    console.error('[AC-CONTROL] Error parcial:', error.message);
    res.status(500).json({ ok: false, message: error.message });
  }
}

// ==============================
// NIVEL 2: MATERIA
// ==============================
async function getMateria(req, res) {
  try {
    const { idPeriodo, idMateria } = req.params;
    const { idGrupo, idDocente } = req.query;

    const filtros = { idGrupo, idDocente };

    if (esRol(req.user, 'DOCENTE')) {
      const idDoc = await resolveDocenteId(req.user.id_usuario);
      if (!idDoc) return res.status(403).json({ ok: false, message: 'Perfil docente no encontrado' });
      filtros.idDocente = idDoc;
    }

    const resultado = await academicControlService.getMateria(Number(idPeriodo), Number(idMateria), filtros);

    await registrarExportAudit(req.user.id_usuario, 'CONTROL_MATERIA',
      `Consulta Materia ${idMateria} — Periodo ${idPeriodo}`, req);

    return res.json({ ok: true, ...resultado });
  } catch (error) {
    console.error('[AC-CONTROL] Error materia:', error.message);
    res.status(500).json({ ok: false, message: error.message });
  }
}

// ==============================
// NIVEL 3: GRUPO
// ==============================
async function getGrupo(req, res) {
  try {
    const { idPeriodo, idGrupo } = req.params;
    const { idMateria, idDocente, estado } = req.query;

    const filtros = { idMateria, idDocente, estado };

    if (esRol(req.user, 'DOCENTE')) {
      const idDoc = await resolveDocenteId(req.user.id_usuario);
      if (!idDoc) return res.status(403).json({ ok: false, message: 'Perfil docente no encontrado' });
      filtros.idDocente = idDoc;
    }

    const resultado = await academicControlService.getGrupo(Number(idPeriodo), Number(idGrupo), filtros);

    await registrarExportAudit(req.user.id_usuario, 'CONTROL_GRUPO',
      `Consulta Grupo ${idGrupo} — Periodo ${idPeriodo}`, req);

    return res.json({ ok: true, ...resultado });
  } catch (error) {
    console.error('[AC-CONTROL] Error grupo:', error.message);
    res.status(500).json({ ok: false, message: error.message });
  }
}

// ==============================
// NIVEL 4: PERÍODO
// ==============================
async function getPeriodo(req, res) {
  try {
    const { idPeriodo } = req.params;
    const { idGrupo, idMateria, idDocente, estado } = req.query;

    const filtros = { idGrupo, idMateria, idDocente, estado };

    if (esRol(req.user, 'DOCENTE')) {
      const idDoc = await resolveDocenteId(req.user.id_usuario);
      if (!idDoc) return res.status(403).json({ ok: false, message: 'Perfil docente no encontrado' });
      filtros.idDocente = idDoc;
    }

    const resultado = await academicControlService.getPeriodo(Number(idPeriodo), filtros);

    await registrarExportAudit(req.user.id_usuario, 'CONTROL_PERIODO',
      `Consulta Periodo ${idPeriodo}`, req);

    return res.json({ ok: true, ...resultado });
  } catch (error) {
    console.error('[AC-CONTROL] Error periodo:', error.message);
    res.status(500).json({ ok: false, message: error.message });
  }
}

// ==============================
// NIVEL 5: SEMESTRE
// ==============================
async function getSemestre(req, res) {
  try {
    const { idPeriodo, semestre } = req.params;
    const { idGrupo, idMateria, idDocente, estado } = req.query;

    const filtros = { idGrupo, idMateria, idDocente, estado };

    if (esRol(req.user, 'DOCENTE')) {
      const idDoc = await resolveDocenteId(req.user.id_usuario);
      if (!idDoc) return res.status(403).json({ ok: false, message: 'Perfil docente no encontrado' });
      filtros.idDocente = idDoc;
    }

    const resultado = await academicControlService.getSemestre(Number(idPeriodo), Number(semestre), filtros);

    await registrarExportAudit(req.user.id_usuario, 'CONTROL_SEMESTRE',
      `Consulta Semestre ${semestre} — Periodo ${idPeriodo}`, req);

    return res.json({ ok: true, ...resultado });
  } catch (error) {
    console.error('[AC-CONTROL] Error semestre:', error.message);
    res.status(500).json({ ok: false, message: error.message });
  }
}

// ==============================
// NIVEL 6: HISTORIAL ALUMNO
// ==============================
async function getHistorial(req, res) {
  try {
    const { idAlumno } = req.params;
    const { idPeriodo, semestre, estado } = req.query;

    // Alumno: solo su propio historial
    if (esRol(req.user, 'ALUMNO')) {
      const idAl = await resolveAlumnoId(req.user.id_usuario);
      if (!idAl) return res.status(403).json({ ok: false, message: 'Perfil alumno no encontrado' });
      if (Number(idAlumno) !== idAl) {
        return res.status(403).json({ ok: false, message: 'No puedes ver el historial de otro alumno' });
      }
    }

    const resultado = await academicControlService.getHistorialAlumno(
      Number(idAlumno), { idPeriodo: idPeriodo ? Number(idPeriodo) : null, semestre: semestre ? Number(semestre) : null, estado }
    );

    await registrarExportAudit(req.user.id_usuario, 'CONTROL_HISTORIAL',
      `Consulta Historial Alumno ${idAlumno}`, req);

    return res.json({ ok: true, ...resultado });
  } catch (error) {
    console.error('[AC-CONTROL] Error historial:', error.message);
    const status = error.message.includes('no encontrado') ? 404 : 500;
    res.status(status).json({ ok: false, message: error.message });
  }
}

module.exports = {
  getFiltros,
  getParcial,
  getMateria,
  getGrupo,
  getPeriodo,
  getSemestre,
  getHistorial
};
