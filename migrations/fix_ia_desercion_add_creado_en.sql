-- =========================================================
-- MIGRACIÓN: Agregar columna creado_en a ia_alertas_desercion
-- La columna faltaba, causando error 500 en endpoints alumno
-- =========================================================

USE sivacad_isc;

ALTER TABLE ia_alertas_desercion
  ADD COLUMN creado_en DATETIME DEFAULT CURRENT_TIMESTAMP AFTER responsable_id;
