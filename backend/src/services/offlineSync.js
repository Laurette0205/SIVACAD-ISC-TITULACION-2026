'use strict';

// backend/src/services/offlineSync.js
// Servicio de sincronización offline → online

const pool = require('../config/db');

// ==============================
// ENCOLAR EVENTO OFFLINE
// ==============================
exports.enqueueEvent = async (idUsuario, idInstitucion, accion, entidad, entidadId, datos, timestampDispositivo) => {
  try {
    const [result] = await pool.execute(
      `INSERT INTO offline_sync_queue
       (id_usuario, id_institucion, accion, entidad, entidad_id, datos, timestamp_dispositivo, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [idUsuario, idInstitucion, accion, entidad, entidadId || null, JSON.stringify(datos), timestampDispositivo]
    );

    return { id: result.insertId, queued: true };
  } catch (error) {
    console.error('[SYNC] Error encolando evento:', error.message);
    return { id: null, queued: false };
  }
};

// ==============================
// OBTENER EVENTOS PENDIENTES
// ==============================
exports.getPendingEvents = async (idUsuario) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, accion, entidad, entidad_id, datos, timestamp_dispositivo, created_at
       FROM offline_sync_queue
       WHERE id_usuario = ? AND sincronizado = 0
       ORDER BY timestamp_dispositivo ASC
       LIMIT 100`,
      [idUsuario]
    );

    return rows.map(row => ({
      ...row,
      datos: typeof row.datos === 'string' ? JSON.parse(row.datos) : row.datos
    }));
  } catch (_) {
    return [];
  }
};

// ==============================
// MARCAR COMO SINCRONIZADO
// ==============================
exports.markSynced = async (eventIds) => {
  if (!eventIds.length) return;

  try {
    const placeholders = eventIds.map(() => '?').join(',');
    await pool.execute(
      `UPDATE offline_sync_queue
       SET sincronizado = 1, sincronizado_en = NOW()
       WHERE id IN (${placeholders})`,
      eventIds
    );
  } catch (error) {
    console.error('[SYNC] Error marcando eventos:', error.message);
  }
};

// ==============================
// PROCESAR EVENTO (aplicar al servidor)
// ==============================
exports.processEvent = async (evento) => {
  const { accion, entidad, entidad_id, datos } = evento;

  try {
    switch (accion) {
      case 'create':
        return await processCreate(entidad, datos);
      case 'update':
        return await processUpdate(entidad, entidad_id, datos);
      case 'delete':
        return await processDelete(entidad, entidad_id);
      default:
        return { success: false, message: `Acción desconocida: ${accion}` };
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
};

async function processCreate(entidad, datos) {
  const allowedEntities = ['ia_bienestar_checkins', 'consentimientos', 'contactos_emergencia'];
  if (!allowedEntities.includes(entidad)) {
    return { success: false, message: `Entidad no permitida para sync offline: ${entidad}` };
  }

  const columns = Object.keys(datos).filter(k => k !== 'id');
  const placeholders = columns.map(() => '?').join(',');
  const values = columns.map(k => datos[k]);

  const [result] = await pool.execute(
    `INSERT INTO ${entidad} (${columns.join(',')}) VALUES (${placeholders})`,
    values
  );

  return { success: true, insertId: result.insertId };
}

async function processUpdate(entidad, entidadId, datos) {
  if (!entidadId) return { success: false, message: 'ID requerido para update' };

  const columns = Object.keys(datos).filter(k => k !== 'id' && k !== 'created_at');
  const setClause = columns.map(k => `${k} = ?`).join(', ');
  const values = columns.map(k => datos[k]);

  await pool.execute(
    `UPDATE ${entidad} SET ${setClause} WHERE id = ?`,
    [...values, entidadId]
  );

  return { success: true };
}

async function processDelete(entidad, entidadId) {
  if (!entidadId) return { success: false, message: 'ID requerido para delete' };

  await pool.execute(
    `DELETE FROM ${entidad} WHERE id = ?`,
    [entidadId]
  );

  return { success: true };
}

// ==============================
// OBTENER CAMBIOS NUEVOS DEL SERVIDOR
// ==============================
exports.getNewChanges = async (idUsuario, sinceTimestamp) => {
  try {
    const [rows] = await pool.execute(
      `SELECT entidad, entidad_id, accion, datos, created_at
       FROM offline_sync_queue
       WHERE id_usuario = ? AND sincronizado = 0 AND created_at > ?
       ORDER BY created_at ASC
       LIMIT 100`,
      [idUsuario, sinceTimestamp]
    );

    return rows.map(row => ({
      ...row,
      datos: typeof row.datos === 'string' ? JSON.parse(row.datos) : row.datos
    }));
  } catch (_) {
    return [];
  }
};
