'use strict';

const express = require('express');
const pool = require('../config/db');
const { auth, role } = require('../middleware/auth');

const router = express.Router();

const ADMIN_ROLES = ['ADMINISTRADOR'];
const VALID_STATES = new Set(['Planeado', 'Activo', 'Cerrado']);

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeState(value) {
  const raw = normalizeText(value).toLowerCase();

  if (raw === 'activo') return 'Activo';
  if (raw === 'cerrado') return 'Cerrado';
  return 'Planeado';
}

router.get('/', auth, async (req, res) => {
  try {
    const estado = normalizeText(req.query?.estado);
    const params = [];
    const where = [];

    if (estado) {
      where.push('p.estado = ?');
      params.push(normalizeState(estado));
    }

    const [rows] = await pool.execute(
      `
      SELECT
        p.id_periodo,
        p.nombre_periodo,
        p.fecha_inicio,
        p.fecha_fin,
        p.estado,
        COUNT(DISTINCT g.id_grupo) AS total_grupos,
        COUNT(DISTINCT i.id_inscripcion) AS total_inscripciones,
        COUNT(DISTINCT e.id_evaluacion) AS total_evaluaciones
      FROM periodos p
      LEFT JOIN grupos g ON g.id_periodo = p.id_periodo
      LEFT JOIN inscripciones i ON i.id_periodo = p.id_periodo
      LEFT JOIN evaluaciones e ON e.id_periodo = p.id_periodo
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      GROUP BY
        p.id_periodo,
        p.nombre_periodo,
        p.fecha_inicio,
        p.fecha_fin,
        p.estado
      ORDER BY p.fecha_inicio DESC, p.id_periodo DESC
      `,
      params
    );

    return res.json({
      ok: true,
      data: rows,
      periodos: rows
    });
  } catch (error) {
    console.error('Error al listar periodos:', error);
    return res.status(500).json({
      ok: false,
      message: 'No fue posible obtener los periodos'
    });
  }
});

router.post('/', auth, role(...ADMIN_ROLES), async (req, res) => {
  try {
    const nombrePeriodo = normalizeText(req.body?.nombre_periodo || req.body?.nombre);
    const fechaInicio = normalizeText(req.body?.fecha_inicio);
    const fechaFin = normalizeText(req.body?.fecha_fin);
    const estado = normalizeState(req.body?.estado);

    if (!nombrePeriodo || !fechaInicio || !fechaFin) {
      return res.status(400).json({
        ok: false,
        message: 'Nombre, fecha de inicio y fecha de fin son obligatorios'
      });
    }

    if (!VALID_STATES.has(estado)) {
      return res.status(400).json({
        ok: false,
        message: 'Estado de periodo inválido'
      });
    }

    if (new Date(fechaInicio).getTime() > new Date(fechaFin).getTime()) {
      return res.status(400).json({
        ok: false,
        message: 'La fecha de inicio no puede ser posterior a la fecha de fin'
      });
    }

    const [result] = await pool.execute(
      `
      INSERT INTO periodos
        (nombre_periodo, fecha_inicio, fecha_fin, estado)
      VALUES
        (?, ?, ?, ?)
      `,
      [nombrePeriodo, fechaInicio, fechaFin, estado]
    );

    return res.status(201).json({
      ok: true,
      message: 'Periodo creado correctamente',
      data: {
        id_periodo: result.insertId,
        nombre_periodo: nombrePeriodo,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        estado
      }
    });
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        ok: false,
        message: 'Ya existe un periodo con ese nombre'
      });
    }

    console.error('Error al crear periodo:', error);
    return res.status(500).json({
      ok: false,
      message: 'No fue posible crear el periodo'
    });
  }
});

module.exports = router;
