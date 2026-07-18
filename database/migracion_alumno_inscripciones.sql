-- =========================================================
-- MIGRACION: ALUMNO INSCRIPCIONES
-- Agrega tabla de documentos para inscripciones
-- y columna de comprobante en inscripciones
-- Compatible con MySQL 5.7+ y MariaDB 10.x+
-- =========================================================

DELIMITER //
DROP PROCEDURE IF EXISTS migrate_alumno_inscripciones//
CREATE PROCEDURE migrate_alumno_inscripciones()
BEGIN
  DECLARE _exists INT;

  -- 1. Crear tabla documentos_inscripcion si no existe
  SELECT COUNT(*) INTO _exists FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'documentos_inscripcion';
  IF _exists = 0 THEN
    CREATE TABLE documentos_inscripcion (
        id_documento BIGINT AUTO_INCREMENT PRIMARY KEY,
        id_inscripcion BIGINT NULL,
        id_alumno INT NOT NULL,
        id_periodo INT NOT NULL,
        tipo_documento VARCHAR(50) NOT NULL COMMENT 'Acta_Nacimiento, CURP, Comprobante_Domicilio, Certificado, Foto, Otro',
        nombre_archivo VARCHAR(255) NOT NULL,
        ruta_archivo VARCHAR(500) NOT NULL,
        mime_type VARCHAR(100),
        tamano_bytes INT,
        subido_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        estado ENUM('Pendiente','Aprobado','Rechazado') DEFAULT 'Pendiente',
        observaciones TEXT,
        KEY idx_doc_inscripcion (id_inscripcion),
        KEY idx_doc_alumno (id_alumno),
        CONSTRAINT fk_doc_inscripcion FOREIGN KEY (id_inscripcion) REFERENCES inscripciones(id_inscripcion) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_doc_alumno FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  END IF;

  -- 2. Agregar columna comprobante_pago a inscripciones
  SELECT COUNT(*) INTO _exists FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'inscripciones' AND column_name = 'comprobante_pago';
  IF _exists = 0 THEN
    ALTER TABLE inscripciones ADD COLUMN comprobante_pago VARCHAR(500) NULL AFTER motivo_rechazo;
  END IF;

  -- 3. Agregar columna fecha_comprobante a inscripciones
  SELECT COUNT(*) INTO _exists FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'inscripciones' AND column_name = 'fecha_comprobante';
  IF _exists = 0 THEN
    ALTER TABLE inscripciones ADD COLUMN fecha_comprobante DATETIME NULL AFTER comprobante_pago;
  END IF;

  -- 4. Insertar tipos de documento requeridos en tabla de catalogos si existe
  SELECT COUNT(*) INTO _exists FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'inscripciones_catalogos_estados';
  IF _exists = 1 THEN
    SELECT COUNT(*) INTO _exists FROM inscripciones_catalogos_estados WHERE codigo = 'Documentacion_Completa';
    IF _exists = 0 THEN
      INSERT IGNORE INTO inscripciones_catalogos_estados (codigo, nombre, descripcion, color, orden) VALUES
      ('Documentacion_Completa', 'Documentacion Completa', 'El alumno ha subido todos los documentos requeridos', '#8b5cf6', 5);
    END IF;
  END IF;
END//
DELIMITER ;

CALL migrate_alumno_inscripciones();
DROP PROCEDURE IF EXISTS migrate_alumno_inscripciones;
