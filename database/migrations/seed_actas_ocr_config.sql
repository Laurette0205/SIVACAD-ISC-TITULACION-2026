USE sivacad_isc;
START TRANSACTION;

CREATE TABLE IF NOT EXISTS actas_ocr_configuracion (
  id_configuracion BIGINT AUTO_INCREMENT PRIMARY KEY,
  clave VARCHAR(120) NOT NULL UNIQUE,
  valor TEXT NOT NULL,
  actualizado_por INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO actas_ocr_configuracion (clave, valor) VALUES
  ('confianza_minima', '70'),
  ('proveedor_ocr', 'GEMINI'),
  ('validacion_automatica', 'false'),
  ('notificar_errores', 'true'),
  ('max_alumnos_por_acta', '50'),
  ('requerir_firma', 'true');

ALTER TABLE actas_ocr_cargas
  ADD COLUMN IF NOT EXISTS revisado_por INT NULL AFTER reviewed_at,
  ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT NULL AFTER observaciones_revision,
  ADD INDEX IF NOT EXISTS idx_ocr_revisado (revisado_por) USING BTREE;

COMMIT;
