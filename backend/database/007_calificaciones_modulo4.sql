-- =====================================================
-- MÓDULO 4: CALIFICACIONES, PREBOLETAS Y BOLETAS
-- Extiende kardex_historial_academico + tablas nuevas
-- =====================================================

-- 1. Extender kardex_historial_academico con campos de calificación
ALTER TABLE kardex_historial_academico
  ADD COLUMN IF NOT EXISTS parcial_1 DECIMAL(5,2) DEFAULT NULL AFTER calificacion,
  ADD COLUMN IF NOT EXISTS parcial_2 DECIMAL(5,2) DEFAULT NULL AFTER parcial_1,
  ADD COLUMN IF NOT EXISTS parcial_3 DECIMAL(5,2) DEFAULT NULL AFTER parcial_2,
  ADD COLUMN IF NOT EXISTS promedio_parciales DECIMAL(5,2) DEFAULT NULL AFTER parcial_3,
  ADD COLUMN IF NOT EXISTS calificacion_final DECIMAL(5,2) DEFAULT NULL AFTER promedio_parciales,
  ADD COLUMN IF NOT EXISTS estado_calificacion ENUM('BORRADOR','VALIDADA','PUBLICADA','CERRADA') DEFAULT 'BORRADOR' AFTER estado,
  ADD COLUMN IF NOT EXISTS version INT DEFAULT 1 AFTER estado_calificacion,
  ADD COLUMN IF NOT EXISTS max_versiones INT DEFAULT 3 AFTER version,
  ADD COLUMN IF NOT EXISTS publicado_por INT DEFAULT NULL AFTER registrado_por,
  ADD COLUMN IF NOT EXISTS fecha_publicacion DATETIME DEFAULT NULL AFTER publicado_por,
  ADD COLUMN IF NOT EXISTS cerrado_por INT DEFAULT NULL AFTER fecha_publicacion,
  ADD COLUMN IF NOT EXISTS fecha_cierre DATETIME DEFAULT NULL AFTER cerrado_por;

-- 2. Tabla de historial de cambios en calificaciones (versionado completo)
CREATE TABLE IF NOT EXISTS calificaciones_historial_cambios (
  id_cambio BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_historial BIGINT NOT NULL,
  id_alumno INT NOT NULL,
  id_usuario INT NOT NULL,
  version_anterior INT NOT NULL,
  version_nueva INT NOT NULL,
  campo_modificado VARCHAR(50) NOT NULL COMMENT 'parcial_1, parcial_2, parcial_3, calificacion_final',
  valor_anterior DECIMAL(5,2) DEFAULT NULL,
  valor_nuevo DECIMAL(5,2) DEFAULT NULL,
  motivo VARCHAR(500) NOT NULL,
  estado ENUM('PENDIENTE','APROBADO','RECHAZADO') DEFAULT 'PENDIENTE',
  aprobado_por INT DEFAULT NULL,
  fecha_aprobacion DATETIME DEFAULT NULL,
  ip_origen VARCHAR(45),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cambio_historial (id_historial),
  INDEX idx_cambio_alumno (id_alumno),
  INDEX idx_cambio_usuario (id_usuario),
  INDEX idx_cambio_estado (estado),
  CONSTRAINT fk_cambio_historial
    FOREIGN KEY (id_historial) REFERENCES kardex_historial_academico(id_historial)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cambio_alumno
    FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cambio_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabla de configuración de límites de edición
CREATE TABLE IF NOT EXISTS calificaciones_config (
  id_config INT AUTO_INCREMENT PRIMARY KEY,
  id_institucion INT NOT NULL DEFAULT 1,
  max_cambios_por_calificacion INT DEFAULT 3,
  requiere_aprobacion_coordinador TINYINT DEFAULT 1,
  publicacion_automatica TINYINT DEFAULT 0,
  dias_para_cerrar INT DEFAULT 30,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_config_institucion (id_institucion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar configuración por defecto
INSERT IGNORE INTO calificaciones_config (id_institucion, max_cambios_por_calificacion, requiere_aprobacion_coordinador)
VALUES (1, 3, 1);
