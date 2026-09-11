'use strict';

const express = require('express');
const pool = require('../config/db');
const { auth, role } = require('../middleware/auth');

const router = express.Router();

const ADMIN_COORD_ROLES = ['ADMINISTRADOR', 'COORDINADOR'];
const VALID_TURNS = new Set(['Matutino', 'Vespertino', 'Discontinuo']);
const VALID_STATES = new Set(['Abierto', 'Cerrado', 'Cancelado']);

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeTurn(value) {
  const raw = normalizeText(value).toLowerCase();

  if (raw === 'vespertino') return 'Vespertino';
  if (raw === 'discontinuo') return 'Discontinuo';
  return 'Matutino';
}

function normalizeState(value) {
  const raw = normalizeText(value).toLowerCase();

  if (raw === 'cerrado') return 'Cerrado';
  if (raw === 'cancelado') return 'Cancelado';
  return 'Abierto';
}

router.get('/', auth, async (req, res) => {
  try {
    const params = [];
    const where = [];

    if (req.query?.id_periodo) {
      where.push('g.id_periodo = ?');
      params.push(Number(req.query.id_periodo));
    }

    if (req.query?.id_carrera) {
      where.push('g.id_carrera = ?');
      params.push(Number(req.query.id_carrera));
    }

    if (req.query?.semestre) {
      where.push('g.semestre = ?');
      params.push(Number(req.query.semestre));
    }

    if (req.query?.estado) {
      where.push('g.estado = ?');
      params.push(normalizeState(req.query.estado));
    }

    const [rows] = await pool.execute(
      `
      SELECT
        g.id_grupo,
        g.id_periodo,
        p.nombre_periodo,
        g.id_carrera,
        c.nombre_carrera,
        g.nombre_grupo,
        g.semestre,
        g.turno,
        g.estado,
        COUNT(DISTINCT i.id_inscripcion) AS total_inscripciones
      FROM grupos g
      INNER JOIN periodos p ON p.id_periodo = g.id_periodo
      INNER JOIN carreras c ON c.id_carrera = g.id_carrera
      LEFT JOIN inscripciones i ON i.id_periodo = g.id_periodo
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      GROUP BY
        g.id_grupo,
        g.id_periodo,
        p.nombre_periodo,
        g.id_carrera,
        c.nombre_carrera,
        g.nombre_grupo,
        g.semestre,
        g.turno,
        g.estado
      ORDER BY p.fecha_inicio DESC, g.semestre ASC, g.nombre_grupo ASC
      `,
      params
    );

    return res.json({
      ok: true,
      data: rows,
      grupos: rows
    });
  } catch (error) {
    console.error('Error al listar grupos:', error);
    return res.status(500).json({
      ok: false,
      message: 'No fue posible obtener los grupos'
    });
  }
});

router.post('/', auth, role(...ADMIN_COORD_ROLES), async (req, res) => {
  try {
    const idPeriodo = Number(req.body?.id_periodo || 0);
    const idCarrera = Number(req.body?.id_carrera || 0);
    const nombreGrupo = normalizeText(req.body?.nombre_grupo || req.body?.grupo);
    const semestre = Number(req.body?.semestre || 0);
    const turno = normalizeTurn(req.body?.turno);
    const estado = normalizeState(req.body?.estado);

    if (!idPeriodo || !idCarrera || !nombreGrupo || !semestre) {
      return res.status(400).json({
        ok: false,
        message: 'Periodo, carrera, nombre de grupo y semestre son obligatorios'
      });
    }

    if (!VALID_TURNS.has(turno) || !VALID_STATES.has(estado)) {
      return res.status(400).json({
        ok: false,
        message: 'Turno o estado de grupo inválido'
      });
    }

    const [periodRows] = await pool.execute(
      `SELECT id_periodo FROM periodos WHERE id_periodo = ? LIMIT 1`,
      [idPeriodo]
    );

    if (!periodRows.length) {
      return res.status(404).json({
        ok: false,
        message: 'El periodo indicado no existe'
      });
    }

    const [careerRows] = await pool.execute(
      `SELECT id_carrera FROM carreras WHERE id_carrera = ? LIMIT 1`,
      [idCarrera]
    );

    if (!careerRows.length) {
      return res.status(404).json({
        ok: false,
        message: 'La carrera indicada no existe'
      });
    }

    const [result] = await pool.execute(
      `
      INSERT INTO grupos
        (id_periodo, id_carrera, nombre_grupo, semestre, turno, estado)
      VALUES
        (?, ?, ?, ?, ?, ?)
      `,
      [idPeriodo, idCarrera, nombreGrupo, semestre, turno, estado]
    );

    return res.status(201).json({
      ok: true,
      message: 'Grupo creado correctamente',
      data: {
        id_grupo: result.insertId,
        id_periodo: idPeriodo,
        id_carrera: idCarrera,
        nombre_grupo: nombreGrupo,
        semestre,
        turno,
        estado
      }
    });
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        ok: false,
        message: 'Ya existe un grupo con esos datos en el periodo indicado'
      });
    }

    console.error('Error al crear grupo:', error);
    return res.status(500).json({
      ok: false,
      message: 'No fue posible crear el grupo'
    });
  }
});

module.exports = router;
