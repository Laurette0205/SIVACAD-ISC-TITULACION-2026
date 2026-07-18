-- =========================================================
-- MIGRACIÓN: Corregir ENUM estado_seguimiento en ia_alertas_desercion
-- Cambia 'En_revision' por 'En_proceso' para coincidir con el frontend
-- =========================================================

USE sivacad_isc;

ALTER TABLE ia_alertas_desercion
  MODIFY COLUMN estado_seguimiento
  ENUM('Pendiente','En_proceso','Atendida','Cerrada') DEFAULT 'Pendiente';
