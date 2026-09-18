-- =========================================================
-- MIGRACIÓN: MÓDULO DE PREBOLETAS, BOLETAS Y SEGUIMIENTO
-- SIVACAD-ISC — Septiembre 2026
-- =========================================================
-- Ejecutar: mysql -u root -p sivacad_isc < migracion_calificaciones_preboletas.sql
-- =========================================================

-- =========================================================
-- 1. ASEGURAR COLUMNAS EN kardex_historial_academico
-- =========================================================

-- parcial_1
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'kardex_historial_academico' AND COLUMN_NAME = 'parcial_1');
SET @sql = IF(@exists = 0,
  'ALTER TABLE kardex_historial_academico ADD COLUMN parcial_1 DECIMAL(5,2) NULL AFTER calificacion',
  'SELECT "parcial_1 ya existe" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- parcial_2
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'kardex_historial_academico' AND COLUMN_NAME = 'parcial_2');
SET @sql = IF(@exists = 0,
  'ALTER TABLE kardex_historial_academico ADD COLUMN parcial_2 DECIMAL(5,2) NULL AFTER parcial_1',
  'SELECT "parcial_2 ya existe" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- parcial_3
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'kardex_historial_academico' AND COLUMN_NAME = 'parcial_3');
SET @sql = IF(@exists = 0,
  'ALTER TABLE kardex_historial_academico ADD COLUMN parcial_3 DECIMAL(5,2) NULL AFTER parcial_2',
  'SELECT "parcial_3 ya existe" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- promedio_parciales
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'kardex_historial_academico' AND COLUMN_NAME = 'promedio_parciales');
SET @sql = IF(@exists = 0,
  'ALTER TABLE kardex_historial_academico ADD COLUMN promedio_parciales DECIMAL(5,2) NULL AFTER parcial_3',
  'SELECT "promedio_parciales ya existe" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- calificacion_final
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'kardex_historial_academico' AND COLUMN_NAME = 'calificacion_final');
SET @sql = IF(@exists = 0,
  'ALTER TABLE kardex_historial_academico ADD COLUMN calificacion_final DECIMAL(5,2) NULL AFTER promedio_parciales',
  'SELECT "calificacion_final ya existe" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- estado_calificacion
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'kardex_historial_academico' AND COLUMN_NAME = 'estado_calificacion');
SET @sql = IF(@exists = 0,
  "ALTER TABLE kardex_historial_academico ADD COLUMN estado_calificacion ENUM('BORRADOR','VALIDADA','PUBLICADA','CERRADA') DEFAULT 'BORRADOR' AFTER calificacion_final",
  'SELECT "estado_calificacion ya existe" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- version
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'kardex_historial_academico' AND COLUMN_NAME = 'version');
SET @sql = IF(@exists = 0,
  'ALTER TABLE kardex_historial_academico ADD COLUMN version INT DEFAULT 1 AFTER estado_calificacion',
  'SELECT "version ya existe" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- publicado_por
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'kardex_historial_academico' AND COLUMN_NAME = 'publicado_por');
SET @sql = IF(@exists = 0,
  'ALTER TABLE kardex_historial_academico ADD COLUMN publicado_por INT NULL AFTER version',
  'SELECT "publicado_por ya existe" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- fecha_publicacion
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'kardex_historial_academico' AND COLUMN_NAME = 'fecha_publicacion');
SET @sql = IF(@exists = 0,
  'ALTER TABLE kardex_historial_academico ADD COLUMN fecha_publicacion DATETIME NULL AFTER publicado_por',
  'SELECT "fecha_publicacion ya existe" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- cerrado_por
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'kardex_historial_academico' AND COLUMN_NAME = 'cerrado_por');
SET @sql = IF(@exists = 0,
  'ALTER TABLE kardex_historial_academico ADD COLUMN cerrado_por INT NULL AFTER fecha_publicacion',
  'SELECT "cerrado_por ya existe" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- fecha_cierre
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'kardex_historial_academico' AND COLUMN_NAME = 'fecha_cierre');
SET @sql = IF(@exists = 0,
  'ALTER TABLE kardex_historial_academico ADD COLUMN fecha_cierre DATETIME NULL AFTER cerrado_por',
  'SELECT "fecha_cierre ya existe" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =========================================================
-- 2. TABLA: calificaciones_config
-- =========================================================
CREATE TABLE IF NOT EXISTS calificaciones_config (
  id_config INT AUTO_INCREMENT PRIMARY KEY,
  id_institucion INT DEFAULT 1,
  max_cambios_por_calificacion INT DEFAULT 3,
  requiere_aprobacion_coordinador TINYINT(1) DEFAULT 1,
  ponderacion_p1 DECIMAL(5,2) DEFAULT 33.33,
  ponderacion_p2 DECIMAL(5,2) DEFAULT 33.33,
  ponderacion_p3 DECIMAL(5,2) DEFAULT 33.34,
  calificacion_minima DECIMAL(5,2) DEFAULT 6.00,
  calificacion_maxima DECIMAL(5,2) DEFAULT 10.00,
  permitir_preboleta_visual TINYINT(1) DEFAULT 1,
  cerrado_por INT DEFAULT NULL,
  actualizado_por INT DEFAULT NULL,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_config_inst (id_institucion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Agregar columnas faltantes si la tabla ya existía sin ellas
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'calificaciones_config' AND COLUMN_NAME = 'formula_calculo');
SET @sql = IF(@exists = 0,
  "ALTER TABLE calificaciones_config ADD COLUMN formula_calculo ENUM('PROMEDIO','SUMA','PONDERADA') DEFAULT 'PROMEDIO' AFTER requiere_aprobacion_coordinador",
  'SELECT "formula_calculo ya existe" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'calificaciones_config' AND COLUMN_NAME = 'ponderacion_p1');
SET @sql = IF(@exists = 0,
  'ALTER TABLE calificaciones_config ADD COLUMN ponderacion_p1 DECIMAL(5,2) DEFAULT 33.33 AFTER formula_calculo',
  'SELECT "ponderacion_p1 ya existe" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'calificaciones_config' AND COLUMN_NAME = 'ponderacion_p2');
SET @sql = IF(@exists = 0,
  'ALTER TABLE calificaciones_config ADD COLUMN ponderacion_p2 DECIMAL(5,2) DEFAULT 33.33 AFTER ponderacion_p1',
  'SELECT "ponderacion_p2 ya existe" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'calificaciones_config' AND COLUMN_NAME = 'ponderacion_p3');
SET @sql = IF(@exists = 0,
  'ALTER TABLE calificaciones_config ADD COLUMN ponderacion_p3 DECIMAL(5,2) DEFAULT 33.34 AFTER ponderacion_p2',
  'SELECT "ponderacion_p3 ya existe" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'calificaciones_config' AND COLUMN_NAME = 'calificacion_minima');
SET @sql = IF(@exists = 0,
  'ALTER TABLE calificaciones_config ADD COLUMN calificacion_minima DECIMAL(5,2) DEFAULT 6.00 AFTER ponderacion_p3',
  'SELECT "calificacion_minima ya existe" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'calificaciones_config' AND COLUMN_NAME = 'calificacion_maxima');
SET @sql = IF(@exists = 0,
  'ALTER TABLE calificaciones_config ADD COLUMN calificacion_maxima DECIMAL(5,2) DEFAULT 10.00 AFTER calificacion_minima',
  'SELECT "calificacion_maxima ya existe" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'calificaciones_config' AND COLUMN_NAME = 'permitir_preboleta_visual');
SET @sql = IF(@exists = 0,
  'ALTER TABLE calificaciones_config ADD COLUMN permitir_preboleta_visual TINYINT(1) DEFAULT 1 AFTER calificacion_maxima',
  'SELECT "permitir_preboleta_visual ya existe" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'calificaciones_config' AND COLUMN_NAME = 'cerrado_por');
SET @sql = IF(@exists = 0,
  'ALTER TABLE calificaciones_config ADD COLUMN cerrado_por INT DEFAULT NULL AFTER permitir_preboleta_visual',
  'SELECT "cerrado_por ya existe" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'calificaciones_config' AND COLUMN_NAME = 'actualizado_por');
SET @sql = IF(@exists = 0,
  'ALTER TABLE calificaciones_config ADD COLUMN actualizado_por INT DEFAULT NULL AFTER cerrado_por',
  'SELECT "actualizado_por ya existe" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'calificaciones_config' AND COLUMN_NAME = 'creado_en');
SET @sql = IF(@exists = 0,
  'ALTER TABLE calificaciones_config ADD COLUMN creado_en DATETIME DEFAULT CURRENT_TIMESTAMP AFTER actualizado_por',
  'SELECT "creado_en ya existe" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'calificaciones_config' AND COLUMN_NAME = 'actualizado_en');
SET @sql = IF(@exists = 0,
  'ALTER TABLE calificaciones_config ADD COLUMN actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER creado_en',
  'SELECT "actualizado_en ya existe" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Insertar configuración por defecto (solo si la tabla está vacía)
INSERT IGNORE INTO calificaciones_config (id_institucion, max_cambios_por_calificacion)
VALUES (1, 3);

-- =========================================================
-- 3. TABLA: calificaciones_historial_cambios
-- =========================================================
CREATE TABLE IF NOT EXISTS calificaciones_historial_cambios (
  id_cambio BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_historial BIGINT NOT NULL,
  id_usuario INT NOT NULL,
  id_alumno INT NOT NULL,
  version_anterior INT DEFAULT NULL,
  version_nueva INT DEFAULT NULL,
  campo_modificado VARCHAR(50) NOT NULL,
  valor_anterior DECIMAL(5,2) DEFAULT NULL,
  valor_nuevo DECIMAL(5,2) DEFAULT NULL,
  motivo VARCHAR(500) DEFAULT NULL,
  ip_origen VARCHAR(45) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_chc_historial (id_historial),
  KEY idx_chc_usuario (id_usuario),
  KEY idx_chc_alumno (id_alumno)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 4. TABLA: calificaciones_seguimiento_coord
-- =========================================================
CREATE TABLE IF NOT EXISTS calificaciones_seguimiento_coord (
  id_seguimiento BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_grupo INT NOT NULL,
  id_materia INT NOT NULL,
  id_periodo INT NOT NULL,
  id_docente INT DEFAULT NULL,
  total_alumnos INT DEFAULT 0,
  parciales_capturados INT DEFAULT 0,
  parciales_pendientes INT DEFAULT 0,
  total_parciales_esperados INT DEFAULT 0,
  porcentaje_captura DECIMAL(5,2) DEFAULT 0.00,
  porcentaje_validacion DECIMAL(5,2) DEFAULT 0.00,
  porcentaje_publicacion DECIMAL(5,2) DEFAULT 0.00,
  alumnos_con_pendientes INT DEFAULT 0,
  alumnos_aprobados INT DEFAULT 0,
  alumnos_no_acreditados INT DEFAULT 0,
  promedio_grupal DECIMAL(5,2) DEFAULT 0.00,
  coordinador_reviso TINYINT(1) DEFAULT 0,
  fecha_ultima_revision DATETIME DEFAULT NULL,
  observaciones TEXT DEFAULT NULL,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_seguimiento (id_grupo, id_materia, id_periodo),
  KEY idx_ss_grupo (id_grupo),
  KEY idx_ss_materia (id_materia),
  KEY idx_ss_periodo (id_periodo),
  KEY idx_ss_docente (id_docente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 5. TABLA: preboletas
-- =========================================================
CREATE TABLE IF NOT EXISTS preboletas (
  id_preboleta BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_alumno INT NOT NULL,
  id_grupo INT NOT NULL,
  id_periodo INT NOT NULL,
  id_materia INT DEFAULT NULL,
  estado ENUM('GENERADA','EXPORTADA','IMPRESA') DEFAULT 'GENERADA',
  calificacion_parcial_1 DECIMAL(5,2) DEFAULT NULL,
  calificacion_parcial_2 DECIMAL(5,2) DEFAULT NULL,
  calificacion_parcial_3 DECIMAL(5,2) DEFAULT NULL,
  promedio DECIMAL(5,2) DEFAULT NULL,
  calificacion_final DECIMAL(5,2) DEFAULT NULL,
  faltas INT DEFAULT 0,
  snapshot JSON DEFAULT NULL,
  generado_por INT NOT NULL,
  generado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  exportado_en DATETIME DEFAULT NULL,
  impreso_en DATETIME DEFAULT NULL,
  KEY idx_pb_alumno (id_alumno),
  KEY idx_pb_grupo (id_grupo),
  KEY idx_pb_periodo (id_periodo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 6. VERIFICACIÓN FINAL
-- =========================================================
SELECT '=== MIGRACIÓN CALIFICACIONES PREBOLETAS COMPLETA ===' AS resultado;

SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('kardex_historial_academico', 'calificaciones_config',
                      'calificaciones_historial_cambios', 'calificaciones_seguimiento_coord',
                      'preboletas')
ORDER BY TABLE_NAME, ORDINAL_POSITION;
