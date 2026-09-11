-- =====================================================
-- MIGRACIÓN 006: PRIVACIDAD
-- Fecha: 2026-09-09
-- Descripción: Consentimientos, derechos ARCO,
--              retención de datos
-- =====================================================

-- =====================================================
-- 1. TABLA consentimientos
-- =====================================================
CREATE TABLE IF NOT EXISTS consentimientos (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  id_usuario INT NOT NULL,
  tipo_consentimiento VARCHAR(100) NOT NULL COMMENT 'datos_psicologicos, datos_salud, ubicacion, marketing, sharing, terceros',
  version_documento VARCHAR(20) NOT NULL,
  aceptado TINYINT NOT NULL,
  ip_origen VARCHAR(45),
  aceptado_en DATETIME NOT NULL,
  revocado_en DATETIME,
  motivo_revocacion TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
  INDEX idx_usuario_tipo (id_usuario, tipo_consentimiento),
  INDEX idx_tipo (tipo_consentimiento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 2. TABLA derechos_arco (Acceso, Rectificación, Cancelación, Oposición)
-- =====================================================
CREATE TABLE IF NOT EXISTS derechos_arco (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  id_usuario INT NOT NULL,
  tipo_solicitud ENUM('acceso', 'rectificacion', 'cancelacion', 'oposicion') NOT NULL,
  datos_solicitados JSON COMMENT 'Qué datos específicos se solicitan',
  motivo TEXT NOT NULL,
  estado ENUM('pendiente', 'en_proceso', 'completada', 'rechazada') DEFAULT 'pendiente',
  respuesta TEXT,
  respondido_por INT,
  respondido_en DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
  INDEX idx_usuario_solicitud (id_usuario, tipo_solicitud),
  INDEX idx_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 3. TABLA politica_retencion (configuración de retención)
-- =====================================================
CREATE TABLE IF NOT EXISTS politica_retencion (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  id_institucion INT NOT NULL DEFAULT 1,
  tabla VARCHAR(100) NOT NULL,
  columna VARCHAR(100),
  tipo_dato ENUM('identificacion', 'contacto', 'academico', 'laboral', 'salud', 'psicologico', 'penal', 'financiero', 'otro') NOT NULL,
  nivel_sensibilidad ENUM('bajo', 'medio', 'alto', 'critico') NOT NULL DEFAULT 'bajo',
  retencion_dias INT NOT NULL COMMENT 'Días antes de eliminación/anonimización',
  accion_fin_vida ENUM('eliminar', 'anonimizar', 'archivar') DEFAULT 'anonimizar',
  activa TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion),
  UNIQUE KEY uk_tabla_columna (id_institucion, tabla, columna)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 4. SEED: Políticas de retención para TESI
-- =====================================================
INSERT INTO politica_retencion (id_institucion, tabla, columna, tipo_dato, nivel_sensibilidad, retencion_dias, accion_fin_vida)
VALUES
  -- Identificación: duración relación + 5 años
  (1, 'usuarios', 'nombres', 'identificacion', 'bajo', 1825, 'anonimizar'),
  (1, 'usuarios', 'correo_institucional', 'contacto', 'bajo', 1825, 'eliminar'),
  (1, 'alumnos', 'curp', 'identificacion', 'medio', 1825, 'anonimizar'),
  (1, 'alumnos', 'matricula', 'identificacion', 'bajo', 1825, 'archivar'),
  -- Académico: permanente (historial)
  (1, 'kardex_historial_academico', 'calificacion', 'academico', 'bajo', 3650, 'anonimizar'),
  (1, 'evaluaciones', 'calificacion', 'academico', 'bajo', 3650, 'anonimizar'),
  -- Salud: 1 año después de graduación
  (1, 'docente_salud_estudiantil', NULL, 'salud', 'critico', 365, 'eliminar'),
  -- Bienestar emocional: 2 años
  (1, 'ia_bienestar_checkins', NULL, 'psicologico', 'alto', 730, 'eliminar'),
  (1, 'ia_bienestar_mensajes', NULL, 'psicologico', 'alto', 730, 'eliminar'),
  (1, 'ia_bienestar_alertas', NULL, 'psicologico', 'alto', 1095, 'anonimizar'),
  -- Deserción: 3 años
  (1, 'ia_desercion_parciales', NULL, 'academico', 'medio', 1095, 'anonimizar'),
  -- Consentimientos: 5 años después de revocación
  (1, 'consentimientos', NULL, 'otro', 'medio', 1825, 'archivar'),
  -- Auditoría: 5 años
  (1, 'bitacora_auditoria', NULL, 'otro', 'bajo', 1825, 'archivar')
ON DUPLICATE KEY UPDATE retencion_dias = VALUES(retencion_dias);
