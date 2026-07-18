const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const service = require('../services/actasOCRService');

function authFromHeader(req, res, next) {
  const auth = String(req.headers.authorization || '');
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ ok: false, message: 'Token no disponible' });
  try {
    const token = auth.slice(7).trim();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const rol = String(decoded.rol || decoded.rol_nombre || '').toUpperCase();
    if (rol !== 'ADMINISTRADOR' && Number(decoded.rol_id) !== 1) {
      return res.status(403).json({ ok: false, message: 'Solo administradores pueden acceder a este módulo.' });
    }
    req.user = decoded;
    req.token = token;
    return next();
  } catch (error) {
    return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
  }
}

router.get('/panel', authFromHeader, async (req, res) => {
  try {
    const [resumen, catalogos] = await Promise.all([service.getResumen(), service.getCatalogos()]);
    return res.json({ ok: true, data: { resumen, catalogos: { plantillas: catalogos.plantillas.length, periodos: catalogos.periodos.length, grupos: catalogos.grupos.length, materias: catalogos.materias.length, docentes: catalogos.docentes.length, firmas: catalogos.firmas.length } } });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al cargar panel.' });
  }
});

router.get('/catalogos', authFromHeader, async (req, res) => {
  try {
    const catalogos = await service.getCatalogos();
    return res.json({ ok: true, catalogos });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al cargar catálogos.' });
  }
});

router.get('/resumen', authFromHeader, async (req, res) => {
  try {
    const data = await service.getResumen();
    return res.json({ ok: true, data });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al obtener resumen.' });
  }
});

router.get('/cargas', authFromHeader, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const offset = Math.max(Number(req.query.offset || 0), 0);
    const estado = req.query.estado || null;
    const data = await service.listCargas(limit, offset, estado);
    return res.json({ ok: true, data });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al listar cargas.' });
  }
});

router.get('/cargas/:id', authFromHeader, async (req, res) => {
  try {
    const data = await service.getCargaById(req.params.id);
    if (!data) return res.status(404).json({ ok: false, message: 'La carga OCR no existe.' });
    return res.json({ ok: true, data });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al obtener carga.' });
  }
});

router.post('/subir', authFromHeader, service.upload.single('archivo'), async (req, res) => {
  try {
    const userId = service.pickUserId(req);
    const result = await service.subirActa({ body: req.body, file: req.file, userId });
    return res.status(201).json({ ok: true, message: 'Acta procesada correctamente.', data: result });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ ok: false, message: error.message || 'Error al procesar acta.' });
  }
});

router.post('/cargas/:id/validar', authFromHeader, async (req, res) => {
  try {
    const userId = service.pickUserId(req);
    const result = await service.validarCarga(req.params.id, userId);
    return res.json({ ok: true, message: result.resultado === 'APROBADA' ? 'Validación exitosa.' : 'Carga con observaciones.', data: result });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ ok: false, message: error.message || 'Error al validar.' });
  }
});

router.put('/cargas/:id/aprobar', authFromHeader, async (req, res) => {
  try {
    const userId = service.pickUserId(req);
    const result = await service.aprobarCarga(req.params.id, userId, req.body?.comentario || '');
    return res.json(result);
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ ok: false, message: error.message || 'Error al aprobar.' });
  }
});

router.put('/cargas/:id/rechazar', authFromHeader, async (req, res) => {
  try {
    const userId = service.pickUserId(req);
    const result = await service.rechazarCarga(req.params.id, userId, req.body?.comentario || '');
    return res.json(result);
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ ok: false, message: error.message || 'Error al rechazar.' });
  }
});

router.get('/bitacora', authFromHeader, async (req, res) => {
  try {
    const data = await service.getBitacora(Math.min(Number(req.query.limit || 50), 200));
    return res.json({ ok: true, data });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al cargar bitácora.' });
  }
});

router.get('/auditoria', authFromHeader, async (req, res) => {
  try {
    const data = await service.getAuditoria(Math.min(Number(req.query.limit || 50), 200));
    return res.json({ ok: true, data });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al cargar auditoría.' });
  }
});

router.get('/incidencias', authFromHeader, async (req, res) => {
  try {
    const data = await service.getIncidencias();
    return res.json({ ok: true, data });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al cargar incidencias.' });
  }
});

router.get('/configuracion', authFromHeader, async (req, res) => {
  try {
    const data = await service.getConfiguracion();
    return res.json({ ok: true, data });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al cargar configuración.' });
  }
});

router.put('/configuracion', authFromHeader, async (req, res) => {
  try {
    const userId = service.pickUserId(req);
    const { clave, valor } = req.body || {};
    if (!clave) return res.status(400).json({ ok: false, message: 'Se requiere clave.' });
    await service.updateConfiguracion(clave, valor, userId);
    return res.json({ ok: true, message: 'Configuración actualizada.' });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al actualizar configuración.' });
  }
});

module.exports = router;
