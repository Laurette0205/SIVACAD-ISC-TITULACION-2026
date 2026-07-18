-- =========================================================
-- MIGRACIÓN: MÓDULO DE TRÁMITES - COORDINADOR ACADÉMICO
-- =========================================================
-- Sistema: SIVACAD-ISC
-- Descripción: Estados del flujo de revisión del coordinador
-- y tabla de observaciones académicas para trámites.
-- Requiere ejecutar primero migracion_admin_tramites.sql
-- para que existan los procedimientos sp_add_*.
-- =========================================================

USE sivacad_isc;

-- =========================================================
-- PROCEDIMIENTO AUXILIAR para agregar constraints FK
-- sólo si no existen (MySQL no tiene ADD CONSTRAINT IF NOT EXISTS)
-- =========================================================
DROP PROCEDURE IF EXISTS sp_add_fk_if_not_exists;
DELIMITER $$
CREATE PROCEDURE sp_add_fk_if_not_exists(
  IN p_constraint_name VARCHAR(128),
  IN p_alter_sql TEXT
)
BEGIN
  DECLARE exists_count INT DEFAULT 0;
  SELECT COUNT(*) INTO exists_count
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND CONSTRAINT_NAME = p_constraint_name;
  IF exists_count = 0 THEN
    SET @sql = p_alter_sql;
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

-- =========================================================
-- PROCEDIMIENTO AUXILIAR para agregar índices
-- sólo si no existen
-- =========================================================
DROP PROCEDURE IF EXISTS sp_add_index_if_not_exists;
DELIMITER $$
CREATE PROCEDURE sp_add_index_if_not_exists(
  IN p_table_name VARCHAR(128),
  IN p_index_name VARCHAR(128),
  IN p_index_sql TEXT
)
BEGIN
  DECLARE exists_count INT DEFAULT 0;
  SELECT COUNT(*) INTO exists_count
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = p_table_name
    AND INDEX_NAME = p_index_name;
  IF exists_count = 0 THEN
    SET @sql = p_index_sql;
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

-- =========================================================
-- 1. AGREGAR ESTADOS DEL COORDINADOR
-- =========================================================
INSERT IGNORE INTO tramites_estados (codigo, nombre, orden) VALUES
('EN_ANALISIS', 'En Análisis', 3),
('DICTAMINADO', 'Dictaminado', 4),
('VALIDADO', 'Validado', 5);

-- =========================================================
-- 2. OBSERVACIONES ACADÉMICAS DEL COORDINADOR
-- =========================================================
CREATE TABLE IF NOT EXISTS tramites_observaciones (
    id_observacion BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_tramite BIGINT NOT NULL,
    id_usuario INT NOT NULL,
    tipo ENUM('REVISION_DOCUMENTAL','ANALISIS_CURRICULAR','OBSERVACION_GRAL','VALIDACION','DICTAMEN_PREVIO') NOT NULL DEFAULT 'OBSERVACION_GRAL',
    observacion TEXT NOT NULL,
    documento_referencia VARCHAR(255) DEFAULT NULL COMMENT 'Documento específico al que hace referencia',
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_to_tramite (id_tramite),
    KEY idx_to_usuario (id_usuario),
    KEY idx_to_tipo (tipo),
    CONSTRAINT fk_to_tramite
        FOREIGN KEY (id_tramite) REFERENCES tramites(id_tramite)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_to_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 3. ACTUALIZAR TABLA TRAMITES CON CAMPOS DE COORDINADOR
-- =========================================================
-- NOTA: Se usan los procedimientos sp_add_* para evitar
-- errores de sintaxis "ADD CONSTRAINT IF NOT EXISTS"
-- que MySQL NO soporta.
-- =========================================================

-- 3.1 Agregar columnas nuevas (soportado desde MySQL 8.0.16)
ALTER TABLE tramites
  ADD COLUMN IF NOT EXISTS analisis_curricular TEXT DEFAULT NULL AFTER dictamen,
  ADD COLUMN IF NOT EXISTS procedencia_academica TINYINT(1) DEFAULT NULL COMMENT 'NULL=sin definir, 1=procede, 0=no procede' AFTER analisis_curricular,
  ADD COLUMN IF NOT EXISTS procedencia_determinada_por INT DEFAULT NULL AFTER procedencia_academica,
  ADD COLUMN IF NOT EXISTS procedencia_determinada_en DATETIME DEFAULT NULL AFTER procedencia_determinada_por,
  ADD COLUMN IF NOT EXISTS validado_coordinador TINYINT(1) DEFAULT 0 AFTER procedencia_determinada_en,
  ADD COLUMN IF NOT EXISTS validado_coordinador_por INT DEFAULT NULL AFTER validado_coordinador,
  ADD COLUMN IF NOT EXISTS validado_coordinador_en DATETIME DEFAULT NULL AFTER validado_coordinador_por;

-- 3.2 Agregar índices usando procedimiento auxiliar
CALL sp_add_index_if_not_exists('tramites', 'idx_tramites_validado_coordinador',
  'ALTER TABLE tramites ADD INDEX idx_tramites_validado_coordinador (validado_coordinador)');

CALL sp_add_index_if_not_exists('tramites', 'idx_tramites_procedencia',
  'ALTER TABLE tramites ADD INDEX idx_tramites_procedencia (procedencia_academica)');

-- 3.3 Agregar foreign keys usando procedimiento auxiliar
CALL sp_add_fk_if_not_exists('fk_tramites_procedencia_por',
  'ALTER TABLE tramites ADD CONSTRAINT fk_tramites_procedencia_por FOREIGN KEY (procedencia_determinada_por) REFERENCES usuarios(id_usuario) ON DELETE SET NULL ON UPDATE CASCADE');

CALL sp_add_fk_if_not_exists('fk_tramites_validado_coordinador_por',
  'ALTER TABLE tramites ADD CONSTRAINT fk_tramites_validado_coordinador_por FOREIGN KEY (validado_coordinador_por) REFERENCES usuarios(id_usuario) ON DELETE SET NULL ON UPDATE CASCADE');
