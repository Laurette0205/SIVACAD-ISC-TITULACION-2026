-- Migración: Tablas de información médica y laboral del alumno
-- SIVACAD-ISC — FASE 6-8

-- Tabla de información médica y psicológica
CREATE TABLE IF NOT EXISTS informacion_medica (
  id_informacion BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_alumno INT NOT NULL,
  id_institucion INT NOT NULL DEFAULT 1,
  tipo_sangre VARCHAR(5) NULL,
  alergias TEXT NULL,
  restricciones_fisicas TEXT NULL,
  medicamentos TEXT NULL,
  condiciones_cronicas TEXT NULL,
  informacion_psicologica TEXT NULL,
  notas_autorizadas TEXT NULL,
  autorizado_por INT NULL,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_medico_alumno (id_alumno, id_institucion),
  CONSTRAINT fk_medico_alumno FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_medico_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_medico_autoriza FOREIGN KEY (autorizado_por) REFERENCES usuarios(id_usuario) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de información laboral
CREATE TABLE IF NOT EXISTS informacion_laboral (
  id_informacion BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_alumno INT NOT NULL,
  id_institucion INT NOT NULL DEFAULT 1,
  trabaja_actualmente TINYINT(1) DEFAULT 0,
  empresa VARCHAR(200) NULL,
  puesto VARCHAR(150) NULL,
  telefono_laboral VARCHAR(10) NULL,
  direccion_laboral VARCHAR(500) NULL,
  municipio VARCHAR(100) NULL,
  horario VARCHAR(100) NULL,
  contacto_laboral_autorizado VARCHAR(200) NULL,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_laboral_alumno (id_alumno, id_institucion),
  CONSTRAINT fk_laboral_alumno FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_laboral_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de documentos sensibles
CREATE TABLE IF NOT EXISTS documentos_sensibles (
  id_documento BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_alumno INT NOT NULL,
  id_institucion INT NOT NULL DEFAULT 1,
  tipo_documento VARCHAR(100) NOT NULL,
  nombre_original VARCHAR(255) NOT NULL,
  nombre_seguro VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NULL,
  peso_bytes BIGINT DEFAULT 0,
  fecha_documento DATE NULL,
  fecha_carga DATETIME DEFAULT CURRENT_TIMESTAMP,
  usuario_cargador INT NOT NULL,
  descripcion TEXT NULL,
  estado VARCHAR(30) DEFAULT 'Activo',
  ruta_segura VARCHAR(500) NOT NULL,
  CONSTRAINT fk_doc_alumno FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_doc_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_doc_usuario FOREIGN KEY (usuario_cargador) REFERENCES usuarios(id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_doc_alumno (id_alumno),
  INDEX idx_doc_tipo (tipo_documento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
