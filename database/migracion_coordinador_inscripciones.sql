-- =========================================================
-- MIGRACION: COORDINADOR INSCRIPCIONES
-- Agrega tablas para cupos, observaciones detalladas
-- y columnas de trazabilidad para coordinadores
-- Compatible con MySQL 5.7+ y MariaDB 10.x+
-- =========================================================

DELIMITER //
DROP PROCEDURE IF EXISTS migrate_coordinador_inscripciones//
CREATE PROCEDURE migrate_coordinador_inscripciones()
BEGIN
  DECLARE _exists INT;

  -- 1. Crear tabla cupos_grupos si no existe
  SELECT COUNT(*) INTO _exists FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'cupos_grupos';
  IF _exists = 0 THEN
    CREATE TABLE cupos_grupos (
        id_cupo INT AUTO_INCREMENT PRIMARY KEY,
        id_grupo INT NOT NULL,
        id_periodo INT NOT NULL,
        cupo_maximo INT NOT NULL DEFAULT 30,
        cupo_actual INT NOT NULL DEFAULT 0,
        fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        actualizado_por INT NULL,
        UNIQUE KEY uq_cupo_grupo_periodo (id_grupo, id_periodo),
        CONSTRAINT fk_cupo_grupo FOREIGN KEY (id_grupo) REFERENCES grupos(id_grupo) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_cupo_periodo FOREIGN KEY (id_periodo) REFERENCES periodos(id_periodo) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT fk_cupo_actualizado_por FOREIGN KEY (actualizado_por) REFERENCES usuarios(id_usuario) ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  END IF;

  -- 2. Agregar columna motivo_rechazo a inscripciones
  SELECT COUNT(*) INTO _exists FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'inscripciones' AND column_name = 'motivo_rechazo';
  IF _exists = 0 THEN
    ALTER TABLE inscripciones ADD COLUMN motivo_rechazo VARCHAR(500) NULL AFTER observaciones;
  END IF;

  -- 3. Agregar columna validada_por a inscripciones
  SELECT COUNT(*) INTO _exists FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'inscripciones' AND column_name = 'validada_por';
  IF _exists = 0 THEN
    ALTER TABLE inscripciones ADD COLUMN validada_por INT NULL AFTER actualizado_por;
  END IF;

  -- 4. Agregar columna fecha_validacion a inscripciones
  SELECT COUNT(*) INTO _exists FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'inscripciones' AND column_name = 'fecha_validacion';
  IF _exists = 0 THEN
    ALTER TABLE inscripciones ADD COLUMN fecha_validacion DATETIME NULL AFTER validada_por;
  END IF;

  -- 5. Agregar foreign key para validada_por
  SELECT COUNT(*) INTO _exists FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'inscripciones' AND constraint_name = 'fk_insc_validada_por' AND constraint_type = 'FOREIGN KEY';
  IF _exists = 0 THEN
    ALTER TABLE inscripciones ADD CONSTRAINT fk_insc_validada_por FOREIGN KEY (validada_por) REFERENCES usuarios(id_usuario) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  -- 6. Agregar indices
  SELECT COUNT(*) INTO _exists FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'inscripciones' AND index_name = 'idx_insc_estado';
  IF _exists = 0 THEN
    ALTER TABLE inscripciones ADD INDEX idx_insc_estado (estado);
  END IF;

  SELECT COUNT(*) INTO _exists FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'inscripciones' AND index_name = 'idx_insc_tipo';
  IF _exists = 0 THEN
    ALTER TABLE inscripciones ADD INDEX idx_insc_tipo (tipo_inscripcion);
  END IF;

  -- 7. Poblar cupos iniciales para grupos existentes si estan vacios
  SELECT COUNT(*) INTO _exists FROM cupos_grupos;
  IF _exists = 0 THEN
    INSERT INTO cupos_grupos (id_grupo, id_periodo, cupo_maximo, cupo_actual)
    SELECT g.id_grupo, g.id_periodo, 30,
      (SELECT COUNT(*) FROM inscripciones i WHERE i.id_grupo = g.id_grupo AND i.estado = 'Validada')
    FROM grupos g;
  END IF;
END//
DELIMITER ;

CALL migrate_coordinador_inscripciones();
DROP PROCEDURE IF EXISTS migrate_coordinador_inscripciones;
