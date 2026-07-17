-- =========================================================
-- MIGRACION: ADMIN INSCRIPCIONES
-- Agrega columnas para trazabilidad, carrera, grupo
-- y crea tablas de auditoria y catalogo de estados
-- Compatible con MySQL 5.7+ y MariaDB 10.x+
-- =========================================================

DELIMITER //
DROP PROCEDURE IF EXISTS migrate_inscripciones_admin//
CREATE PROCEDURE migrate_inscripciones_admin()
BEGIN
  DECLARE _exists INT;

  -- 1. Agregar columna id_carrera si no existe
  SELECT COUNT(*) INTO _exists FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'inscripciones' AND column_name = 'id_carrera';
  IF _exists = 0 THEN
    ALTER TABLE inscripciones ADD COLUMN id_carrera INT NULL AFTER id_periodo;
  END IF;

  -- 2. Agregar columna id_grupo si no existe
  SELECT COUNT(*) INTO _exists FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'inscripciones' AND column_name = 'id_grupo';
  IF _exists = 0 THEN
    ALTER TABLE inscripciones ADD COLUMN id_grupo INT NULL AFTER id_carrera;
  END IF;

  -- 3. Agregar columna actualizado_en si no existe
  SELECT COUNT(*) INTO _exists FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'inscripciones' AND column_name = 'actualizado_en';
  IF _exists = 0 THEN
    ALTER TABLE inscripciones ADD COLUMN actualizado_en DATETIME NULL AFTER observaciones;
  END IF;

  -- 4. Agregar columna actualizado_por si no existe
  SELECT COUNT(*) INTO _exists FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'inscripciones' AND column_name = 'actualizado_por';
  IF _exists = 0 THEN
    ALTER TABLE inscripciones ADD COLUMN actualizado_por INT NULL AFTER actualizado_en;
  END IF;

  -- 5. Agregar indices si no existen
  SELECT COUNT(*) INTO _exists FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'inscripciones' AND index_name = 'idx_insc_carrera';
  IF _exists = 0 THEN
    ALTER TABLE inscripciones ADD KEY idx_insc_carrera (id_carrera);
  END IF;

  SELECT COUNT(*) INTO _exists FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'inscripciones' AND index_name = 'idx_insc_grupo';
  IF _exists = 0 THEN
    ALTER TABLE inscripciones ADD KEY idx_insc_grupo (id_grupo);
  END IF;

  SELECT COUNT(*) INTO _exists FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'inscripciones' AND index_name = 'idx_insc_actualizado';
  IF _exists = 0 THEN
    ALTER TABLE inscripciones ADD KEY idx_insc_actualizado (actualizado_por);
  END IF;

  -- 6. Agregar foreign keys si no existen
  SELECT COUNT(*) INTO _exists FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'inscripciones' AND constraint_name = 'fk_insc_carrera' AND constraint_type = 'FOREIGN KEY';
  IF _exists = 0 THEN
    ALTER TABLE inscripciones ADD CONSTRAINT fk_insc_carrera FOREIGN KEY (id_carrera) REFERENCES carreras(id_carrera) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  SELECT COUNT(*) INTO _exists FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'inscripciones' AND constraint_name = 'fk_insc_grupo' AND constraint_type = 'FOREIGN KEY';
  IF _exists = 0 THEN
    ALTER TABLE inscripciones ADD CONSTRAINT fk_insc_grupo FOREIGN KEY (id_grupo) REFERENCES grupos(id_grupo) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  SELECT COUNT(*) INTO _exists FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'inscripciones' AND constraint_name = 'fk_insc_actualizado_por' AND constraint_type = 'FOREIGN KEY';
  IF _exists = 0 THEN
    ALTER TABLE inscripciones ADD CONSTRAINT fk_insc_actualizado_por FOREIGN KEY (actualizado_por) REFERENCES usuarios(id_usuario) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END//
DELIMITER ;

CALL migrate_inscripciones_admin();
DROP PROCEDURE IF EXISTS migrate_inscripciones_admin;

-- =========================================================
-- Crear tabla de auditoria de inscripciones
-- =========================================================
CREATE TABLE IF NOT EXISTS inscripciones_auditoria (
    id_auditoria BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_inscripcion BIGINT NULL,
    id_usuario INT NOT NULL,
    accion VARCHAR(80) NOT NULL COMMENT 'CREAR, VALIDAR, RECHAZAR, CANCELAR, EDITAR, EXPORTAR',
    detalle TEXT NULL,
    estado_anterior VARCHAR(30) NULL,
    estado_nuevo VARCHAR(30) NULL,
    ip VARCHAR(45),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_insc_audit_inscripcion (id_inscripcion),
    KEY idx_insc_audit_usuario (id_usuario),
    KEY idx_insc_audit_accion (accion),
    CONSTRAINT fk_insc_audit_inscripcion FOREIGN KEY (id_inscripcion) REFERENCES inscripciones(id_inscripcion) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_insc_audit_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- Crear catalogo de estados de inscripcion
-- =========================================================
CREATE TABLE IF NOT EXISTS inscripciones_catalogos_estados (
    id_estado INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    color VARCHAR(20) DEFAULT '#6b7280',
    orden INT DEFAULT 0,
    activo TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO inscripciones_catalogos_estados (codigo, nombre, descripcion, color, orden) VALUES
('Pendiente', 'Pendiente', 'Inscripcion registrada, en espera de revision', '#f59e0b', 1),
('Validada', 'Validada', 'Inscripcion aprobada y confirmada', '#10b981', 2),
('Rechazada', 'Rechazada', 'Inscripcion no aprobada por la autoridad', '#ef4444', 3),
('Cancelada', 'Cancelada', 'Inscripcion cancelada por el alumno o sistema', '#6b7280', 4);
