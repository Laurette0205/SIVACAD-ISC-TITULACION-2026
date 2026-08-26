'use strict';

const { body, param, validationResult } = require('express-validator');

function handleErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      ok: false,
      message: 'Datos de entrada inválidos',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
}

exports.validateRegister = [
  body('nombres').trim().isLength({ min: 1, max: 100 }).withMessage('Nombres requerido (máx. 100 caracteres)'),
  body('apellido_paterno').trim().isLength({ min: 1, max: 50 }).withMessage('Apellido paterno requerido (máx. 50 caracteres)'),
  body('apellido_materno').trim().isLength({ min: 1, max: 50 }).withMessage('Apellido materno requerido (máx. 50 caracteres)'),
  body('correo').isEmail().normalizeEmail().withMessage('Correo electrónico inválido'),
  body('contrasena').isLength({ min: 12, max: 20 }).withMessage('Contraseña debe tener entre 12 y 20 caracteres'),
  body('rol').optional().trim().isLength({ min: 1, max: 30 }).withMessage('Rol inválido'),
  body('curp').optional().trim().isLength({ min: 18, max: 18 }).withMessage('CURP debe tener 18 caracteres'),
  body('matricula').optional().trim().isLength({ min: 1, max: 20 }).withMessage('Matrícula inválida'),
  body('numero_empleado').optional().trim().isLength({ min: 1, max: 20 }).withMessage('Número de empleado inválido'),
  body('especialidad').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Especialidad inválida'),
  body('semestre_actual').optional().isInt({ min: 1, max: 12 }).withMessage('Semestre debe ser entre 1 y 12'),
  body('id_carrera').optional().isInt({ min: 1 }).withMessage('Carrera inválida'),
  body('id_plan').optional().isInt({ min: 1 }).withMessage('Plan inválido'),
  handleErrors
];

exports.validateLogin = [
  body('correo').isEmail().normalizeEmail().withMessage('Correo electrónico inválido'),
  body('contrasena').notEmpty().withMessage('Contraseña requerida'),
  handleErrors
];

exports.validateAlumnoUpdate = [
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  body('nombres').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Nombres inválidos'),
  body('apellido_paterno').optional().trim().isLength({ min: 1, max: 50 }).withMessage('Apellido paterno inválido'),
  body('apellido_materno').optional().trim().isLength({ min: 1, max: 50 }).withMessage('Apellido materno inválido'),
  body('curp').optional().trim().isLength({ min: 18, max: 18 }).withMessage('CURP debe tener 18 caracteres'),
  body('matricula').optional().trim().isLength({ min: 1, max: 20 }).withMessage('Matrícula inválida'),
  body('semestre_actual').optional().isInt({ min: 1, max: 12 }).withMessage('Semestre debe ser entre 1 y 12'),
  body('estatus_academico').optional().isIn(['Regular', 'Irregular', 'Baja', 'Egresado']).withMessage('Estatus académico inválido'),
  body('correo_institucional').optional().isEmail().normalizeEmail().withMessage('Correo inválido'),
  body('estado').optional().isIn(['Activo', 'Inactivo']).withMessage('Estado inválido'),
  handleErrors
];

exports.validateDocenteUpdate = [
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  body('clave_docente').optional().trim().isLength({ min: 1, max: 20 }).withMessage('Clave docente inválida'),
  body('numero_empleado').optional().trim().isLength({ min: 1, max: 20 }).withMessage('Número de empleado inválido'),
  body('especialidad').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Especialidad inválida'),
  body('estatus').optional().isIn(['Activo', 'Inactivo', 'Jubilado']).withMessage('Estatus inválido'),
  body('correo_institucional').optional().isEmail().normalizeEmail().withMessage('Correo inválido'),
  body('estado').optional().isIn(['Activo', 'Inactivo']).withMessage('Estado inválido'),
  handleErrors
];

exports.validatePasswordReset = [
  body('contrasena').isLength({ min: 12, max: 20 }).withMessage('Contraseña debe tener entre 12 y 20 caracteres'),
  handleErrors
];
