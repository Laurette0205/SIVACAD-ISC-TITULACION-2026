-- =========================================================
-- MIGRACIÓN: MÓDULO DE TRÁMITES - ALUMNO SOLICITANTE
-- =========================================================
-- Sistema: SIVACAD-ISC
-- Descripción: Estados y columnas para la participación
-- del alumno en el flujo de trámites.
-- Requiere ejecutar primero migracion_admin_tramites.sql.
-- =========================================================

USE sivacad_isc;

-- =========================================================
-- 1. AGREGAR ESTADO ENTREGADO
-- =========================================================
INSERT IGNORE INTO tramites_estados (codigo, nombre, orden) VALUES
('ENTREGADO', 'Entregado', 8);

-- =========================================================
-- 2. ACTUALIZAR TABLA TRAMITES CON CAMPOS DE ENTREGA
-- =========================================================
ALTER TABLE tramites
  ADD COLUMN IF NOT EXISTS entregado TINYINT(1) DEFAULT 0
    AFTER firma_institucional,
  ADD COLUMN IF NOT EXISTS entregado_en DATETIME DEFAULT NULL
    AFTER entregado,
  ADD COLUMN IF NOT EXISTS entregado_por INT DEFAULT NULL
    AFTER entregado_en;

CALL sp_add_fk_if_not_exists('fk_tramites_entregado_por',
  'ALTER TABLE tramites ADD CONSTRAINT fk_tramites_entregado_por
   FOREIGN KEY (entregado_por) REFERENCES usuarios(id_usuario)
   ON DELETE SET NULL ON UPDATE CASCADE');

CALL sp_add_index_if_not_exists('tramites', 'idx_tramites_entregado',
  'ALTER TABLE tramites ADD INDEX idx_tramites_entregado (entregado)');
