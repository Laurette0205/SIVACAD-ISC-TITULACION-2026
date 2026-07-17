USE sivacad_isc;

START TRANSACTION;

-- =========================================================
-- PLANTILLAS OCR
-- =========================================================
CREATE TABLE IF NOT EXISTS actas_ocr_plantillas (
  id_plantilla_ocr BIGINT AUTO_INCREMENT PRIMARY KEY,
  codigo_plantilla VARCHAR(60) NOT NULL UNIQUE,
  nombre_plantilla VARCHAR(180) NOT NULL,
  descripcion TEXT NULL,
  proveedor_ocr ENUM('GEMINI', 'DOCUMENT_AI', 'HIBRIDO') NOT NULL DEFAULT 'GEMINI',
  formato_archivo ENUM('IMAGEN', 'PDF', 'AMBOS') NOT NULL DEFAULT 'AMBOS',
  regla_convivencia TEXT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  orden_visual INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO actas_ocr_plantillas
  (codigo_plantilla, nombre_plantilla, descripcion, proveedor_ocr, formato_archivo, regla_convivencia, activo, orden_visual)
SELECT
  'ACTA_CALIFICACIONES',
  'Acta OCR de Calificaciones',
  'Digitaliza actas firmadas y extrae matrícula, nombre y calificación para revisión institucional.',
  'GEMINI',
  'AMBOS',
  'La captura OCR solo se aprueba tras validación institucional y revisión de inconsistencias.',
  1,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM actas_ocr_plantillas WHERE codigo_plantilla = 'ACTA_CALIFICACIONES'
);

-- =========================================================
-- GRUPOS / CARGAS ACADÉMICAS
-- =========================================================
CREATE TABLE IF NOT EXISTS cargas_academicas (
  id_carga_academica BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_periodo INT NOT NULL,
  id_grupo INT NOT NULL,
  id_materia INT NOT NULL,
  id_docente INT NOT NULL,
  estado ENUM('ACTIVA', 'CERRADA', 'CANCELADA') NOT NULL DEFAULT 'ACTIVA',
  observaciones TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_carga_academica (id_periodo, id_grupo, id_materia, id_docente),
  CONSTRAINT fk_ca_periodo FOREIGN KEY (id_periodo) REFERENCES periodos(id_periodo),
  CONSTRAINT fk_ca_grupo FOREIGN KEY (id_grupo) REFERENCES grupos(id_grupo),
  CONSTRAINT fk_ca_materia FOREIGN KEY (id_materia) REFERENCES materias(id_materia),
  CONSTRAINT fk_ca_docente FOREIGN KEY (id_docente) REFERENCES docentes(id_docente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS grupos_alumnos (
  id_grupo_alumno BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_periodo INT NOT NULL,
  id_grupo INT NOT NULL,
  id_alumno INT NOT NULL,
  estado ENUM('ACTIVO', 'BAJA', 'TRANSFERIDO') NOT NULL DEFAULT 'ACTIVO',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_grupo_alumno (id_periodo, id_grupo, id_alumno),
  CONSTRAINT fk_ga_periodo FOREIGN KEY (id_periodo) REFERENCES periodos(id_periodo),
  CONSTRAINT fk_ga_grupo FOREIGN KEY (id_grupo) REFERENCES grupos(id_grupo),
  CONSTRAINT fk_ga_alumno FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS docentes_firmas_registradas (
  id_firma BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_docente INT NOT NULL UNIQUE,
  metodo_firma ENUM('MANUAL', 'DIGITAL', 'OCR') NOT NULL DEFAULT 'OCR',
  firma_hash VARCHAR(255) NULL,
  archivo_referencia VARCHAR(255) NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_firma_docente FOREIGN KEY (id_docente) REFERENCES docentes(id_docente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- CARGAS OCR
-- =========================================================
CREATE TABLE IF NOT EXISTS actas_ocr_cargas (
  id_carga_ocr BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_plantilla_ocr BIGINT NOT NULL,
  id_periodo INT NOT NULL,
  id_grupo INT NULL,
  id_materia INT NULL,
  id_docente INT NULL,
  id_usuario_carga INT NOT NULL,
  nombre_archivo VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  storage_path VARCHAR(255) NOT NULL,
  estado ENUM(
    'RECIBIDA',
    'EXTRACCION_PENDIENTE',
    'VALIDACION_PENDIENTE',
    'VALIDADA',
    'RECHAZADA'
  ) NOT NULL DEFAULT 'RECIBIDA',
  confianza_global DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  firma_detectada TINYINT(1) NOT NULL DEFAULT 0,
  firma_coincide TINYINT(1) NOT NULL DEFAULT 0,
  json_resultado JSON NULL,
  texto_extraido LONGTEXT NULL,
  observaciones_revision TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  reviewed_at DATETIME NULL,
  CONSTRAINT fk_ocr_plantilla FOREIGN KEY (id_plantilla_ocr) REFERENCES actas_ocr_plantillas(id_plantilla_ocr),
  CONSTRAINT fk_ocr_periodo FOREIGN KEY (id_periodo) REFERENCES periodos(id_periodo),
  CONSTRAINT fk_ocr_grupo FOREIGN KEY (id_grupo) REFERENCES grupos(id_grupo),
  CONSTRAINT fk_ocr_materia FOREIGN KEY (id_materia) REFERENCES materias(id_materia),
  CONSTRAINT fk_ocr_docente FOREIGN KEY (id_docente) REFERENCES docentes(id_docente),
  CONSTRAINT fk_ocr_usuario FOREIGN KEY (id_usuario_carga) REFERENCES usuarios(id_usuario),
  INDEX idx_ocr_estado (estado),
  INDEX idx_ocr_periodo (id_periodo),
  INDEX idx_ocr_grupo (id_grupo),
  INDEX idx_ocr_docente (id_docente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS actas_ocr_detalles (
  id_detalle_ocr BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_carga_ocr BIGINT NOT NULL,
  matricula VARCHAR(30) NOT NULL,
  id_alumno INT NULL,
  nombre_completo VARCHAR(220) NOT NULL,
  calificacion DECIMAL(5,2) NOT NULL,
  observaciones TEXT NULL,
  validado TINYINT(1) NOT NULL DEFAULT 0,
  error_validacion TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ocr_detalle_carga FOREIGN KEY (id_carga_ocr) REFERENCES actas_ocr_cargas(id_carga_ocr) ON DELETE CASCADE,
  CONSTRAINT fk_ocr_detalle_alumno FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno),
  UNIQUE KEY uq_detalle_carga_matricula (id_carga_ocr, matricula),
  INDEX idx_ocr_detalle_matricula (matricula)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS actas_ocr_validaciones (
  id_validacion_ocr BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_carga_ocr BIGINT NOT NULL,
  id_usuario INT NOT NULL,
  resultado ENUM('APROBADA', 'RECHAZADA', 'AJUSTADA') NOT NULL,
  comentario TEXT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ocr_validacion_carga FOREIGN KEY (id_carga_ocr) REFERENCES actas_ocr_cargas(id_carga_ocr) ON DELETE CASCADE,
  CONSTRAINT fk_ocr_validacion_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
  INDEX idx_ocr_validacion_carga (id_carga_ocr)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS actas_ocr_auditoria (
  id_auditoria_ocr BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_carga_ocr BIGINT NOT NULL,
  id_usuario INT NOT NULL,
  accion VARCHAR(120) NOT NULL,
  detalle JSON NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ocr_auditoria_carga FOREIGN KEY (id_carga_ocr) REFERENCES actas_ocr_cargas(id_carga_ocr) ON DELETE CASCADE,
  CONSTRAINT fk_ocr_auditoria_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
  INDEX idx_ocr_auditoria_carga (id_carga_ocr)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- TABLAS FINALES DE IMPORTACIÓN
-- =========================================================
CREATE TABLE IF NOT EXISTS actas_calificaciones (
  id_acta_calificacion BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_carga_ocr BIGINT NOT NULL UNIQUE,
  id_plantilla_ocr BIGINT NOT NULL,
  id_periodo INT NOT NULL,
  id_grupo INT NULL,
  id_materia INT NULL,
  id_docente INT NULL,
  id_usuario_registro INT NOT NULL,
  estado ENUM('BORRADOR', 'VALIDADA', 'IMPORTADA', 'CANCELADA') NOT NULL DEFAULT 'BORRADOR',
  total_alumnos INT NOT NULL DEFAULT 0,
  promedio_grupal DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  archivo_origen VARCHAR(255) NULL,
  observaciones LONGTEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT fk_acta_carga FOREIGN KEY (id_carga_ocr) REFERENCES actas_ocr_cargas(id_carga_ocr),
  CONSTRAINT fk_acta_plantilla FOREIGN KEY (id_plantilla_ocr) REFERENCES actas_ocr_plantillas(id_plantilla_ocr),
  CONSTRAINT fk_acta_periodo FOREIGN KEY (id_periodo) REFERENCES periodos(id_periodo),
  CONSTRAINT fk_acta_grupo FOREIGN KEY (id_grupo) REFERENCES grupos(id_grupo),
  CONSTRAINT fk_acta_materia FOREIGN KEY (id_materia) REFERENCES materias(id_materia),
  CONSTRAINT fk_acta_docente FOREIGN KEY (id_docente) REFERENCES docentes(id_docente),
  CONSTRAINT fk_acta_usuario FOREIGN KEY (id_usuario_registro) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS actas_calificaciones_detalle (
  id_detalle_acta BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_acta_calificacion BIGINT NOT NULL,
  id_alumno INT NOT NULL,
  matricula VARCHAR(30) NOT NULL,
  nombre_completo VARCHAR(220) NOT NULL,
  calificacion DECIMAL(5,2) NOT NULL,
  observaciones TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_det_acta FOREIGN KEY (id_acta_calificacion) REFERENCES actas_calificaciones(id_acta_calificacion) ON DELETE CASCADE,
  CONSTRAINT fk_det_acta_alumno FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno),
  UNIQUE KEY uq_acta_alumno (id_acta_calificacion, id_alumno),
  INDEX idx_acta_matricula (matricula)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- SEED SEGUR0
-- =========================================================
INSERT IGNORE INTO actas_ocr_plantillas
  (codigo_plantilla, nombre_plantilla, descripcion, proveedor_ocr, formato_archivo, regla_convivencia, activo, orden_visual)
VALUES
  (
    'ACTA_CALIFICACIONES',
    'Acta OCR de Calificaciones',
    'Digitaliza actas firmadas y extrae matrícula, nombre y calificación para revisión institucional.',
    'GEMINI',
    'AMBOS',
    'La captura OCR solo se aprueba tras validación institucional y revisión de inconsistencias.',
    1,
    1
  );

COMMIT;