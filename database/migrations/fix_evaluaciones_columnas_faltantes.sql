-- =========================================================
-- MIGRACIÓN: Agregar columnas faltantes a evaluaciones y
-- evaluacion_resultados para evitar errores 500
-- =========================================================

USE sivacad_isc;

DROP PROCEDURE IF EXISTS migrar_evaluaciones_columnas;
DELIMITER $$
CREATE PROCEDURE migrar_evaluaciones_columnas()
BEGIN
  -- Agregar cerrado_por a evaluaciones
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluaciones' AND COLUMN_NAME = 'cerrado_por'
  ) THEN
    ALTER TABLE evaluaciones ADD COLUMN cerrado_por INT NULL AFTER ponderacion_total;
    ALTER TABLE evaluaciones ADD KEY idx_eval_cerrado_por (cerrado_por);
  END IF;

  -- Agregar cerrado_en a evaluaciones
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluaciones' AND COLUMN_NAME = 'cerrado_en'
  ) THEN
    ALTER TABLE evaluaciones ADD COLUMN cerrado_en DATETIME NULL AFTER cerrado_por;
  END IF;

  -- Agregar cerrado_observaciones a evaluaciones
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluaciones' AND COLUMN_NAME = 'cerrado_observaciones'
  ) THEN
    ALTER TABLE evaluaciones ADD COLUMN cerrado_observaciones TEXT NULL AFTER cerrado_en;
  END IF;

  -- Agregar actualizado_por a evaluaciones
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluaciones' AND COLUMN_NAME = 'actualizado_por'
  ) THEN
    ALTER TABLE evaluaciones ADD COLUMN actualizado_por INT NULL AFTER cerrado_observaciones;
    ALTER TABLE evaluaciones ADD KEY idx_eval_actualizado_por (actualizado_por);
  END IF;

  -- Agregar foreign keys para cerrado_por y actualizado_por si no existen
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluaciones' AND CONSTRAINT_NAME = 'fk_eval_cerrado_por'
  ) THEN
    ALTER TABLE evaluaciones ADD CONSTRAINT fk_eval_cerrado_por
      FOREIGN KEY (cerrado_por) REFERENCES usuarios(id_usuario) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluaciones' AND CONSTRAINT_NAME = 'fk_eval_actualizado_por'
  ) THEN
    ALTER TABLE evaluaciones ADD CONSTRAINT fk_eval_actualizado_por
      FOREIGN KEY (actualizado_por) REFERENCES usuarios(id_usuario) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  -- Agregar validado_por a evaluacion_resultados
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluacion_resultados' AND COLUMN_NAME = 'validado_por'
  ) THEN
    ALTER TABLE evaluacion_resultados ADD COLUMN validado_por INT NULL AFTER observacion_general;
    ALTER TABLE evaluacion_resultados ADD KEY idx_resultado_validado_por (validado_por);
  END IF;

  -- Agregar validado_en a evaluacion_resultados
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluacion_resultados' AND COLUMN_NAME = 'validado_en'
  ) THEN
    ALTER TABLE evaluacion_resultados ADD COLUMN validado_en DATETIME NULL AFTER validado_por;
  END IF;

  -- Agregar estado_validacion a evaluacion_resultados
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluacion_resultados' AND COLUMN_NAME = 'estado_validacion'
  ) THEN
    ALTER TABLE evaluacion_resultados ADD COLUMN estado_validacion ENUM('NO_VALIDADO','VALIDADO','RECHAZADO') DEFAULT 'NO_VALIDADO' AFTER validado_en;
  END IF;

  -- Agregar foreign key para validado_por si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluacion_resultados' AND CONSTRAINT_NAME = 'fk_resultado_validado_por'
  ) THEN
    ALTER TABLE evaluacion_resultados ADD CONSTRAINT fk_resultado_validado_por
      FOREIGN KEY (validado_por) REFERENCES usuarios(id_usuario) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$
DELIMITER ;

CALL migrar_evaluaciones_columnas();
DROP PROCEDURE IF EXISTS migrar_evaluaciones_columnas;
