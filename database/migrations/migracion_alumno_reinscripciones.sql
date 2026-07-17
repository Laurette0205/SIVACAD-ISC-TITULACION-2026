-- =========================================================
-- MIGRACIÓN: ALUMNO REINSCRIPCIONES
-- Soporte: requisitos, comprobante, historial
-- =========================================================

ALTER TABLE inscripciones
  ADD COLUMN IF NOT EXISTS comprobante_reinscripcion VARCHAR(255) NULL AFTER comprobante_pago,
  ADD COLUMN IF NOT EXISTS fecha_comprobante_reinscripcion DATETIME NULL AFTER fecha_comprobante;

ALTER TABLE reinscripciones
  ADD COLUMN IF NOT EXISTS fecha_solicitud DATETIME DEFAULT CURRENT_TIMESTAMP AFTER motivo,
  ADD COLUMN IF NOT EXISTS observaciones_alumno TEXT NULL AFTER fecha_validacion;

CREATE TABLE IF NOT EXISTS reinscripcion_requisitos (
    id_requisito BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_reinscripcion BIGINT NOT NULL,
    requisito VARCHAR(100) NOT NULL,
    cumplido TINYINT(1) DEFAULT 0,
    observaciones TEXT NULL,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_rreq_reinscripcion (id_reinscripcion),
    CONSTRAINT fk_rreq_reinscripcion
      FOREIGN KEY (id_reinscripcion) REFERENCES reinscripciones(id_reinscripcion)
      ON DELETE CASCADE
      ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reinscripcion_auditoria (
    id_auditoria BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_reinscripcion BIGINT NULL,
    id_inscripcion BIGINT NULL,
    accion VARCHAR(50) NOT NULL,
    estado_anterior VARCHAR(50) NULL,
    estado_nuevo VARCHAR(50) NULL,
    detalle TEXT NULL,
    id_usuario INT NULL,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_raudit_reinscripcion (id_reinscripcion),
    KEY idx_raudit_inscripcion (id_inscripcion),
    CONSTRAINT fk_raudit_usuario
      FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
      ON DELETE SET NULL
      ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
