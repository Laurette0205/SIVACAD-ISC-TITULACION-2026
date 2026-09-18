-- =====================================================
-- MÓDULO 2: EMERGENCIAS, CONTACTOS Y LOCALIZACIÓN
-- Migración: tablas nuevas + alter contactos_emergencia
-- =====================================================

-- 1. Agregar campos faltantes a contactos_emergencia
ALTER TABLE contactos_emergencia
  ADD COLUMN IF NOT EXISTS prioridad ENUM('BAJA', 'MEDIA', 'ALTA', 'CRITICA') DEFAULT 'MEDIA' AFTER correo,
  ADD COLUMN IF NOT EXISTS direccion VARCHAR(500) AFTER prioridad;

-- 2. Tabla de ubicación de emergencia (compartir ubicación)
CREATE TABLE IF NOT EXISTS ubicacion_emergencia (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  id_usuario INT NOT NULL,
  activa TINYINT DEFAULT 0,
  latitud DECIMAL(10, 8),
  longitud DECIMAL(11, 8),
  precision_metros INT,
  motivo VARCHAR(500),
  duracion_minutos INT DEFAULT 60,
  fecha_activacion DATETIME,
  fecha_expiracion DATETIME,
  fecha_desactivacion DATETIME,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_usuario_ubicacion (id_usuario),
  INDEX idx_activa (activa),
  INDEX idx_expiracion (fecha_expiracion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabla de log de ubicación (quién consultó, cuándo)
CREATE TABLE IF NOT EXISTS ubicacion_emergencia_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  id_ubicacion BIGINT NOT NULL,
  id_usuario_consulta INT NOT NULL,
  fecha_consulta DATETIME NOT NULL,
  ip_origen VARCHAR(45),
  motivo_consulta VARCHAR(500),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ubicacion_log (id_ubicacion),
  INDEX idx_usuario_consulta (id_usuario_consulta)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabla de sesiones de emergencia (modo emergencia activo)
CREATE TABLE IF NOT EXISTS sesiones_emergencia (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  id_alumno INT NOT NULL,
  id_solicitante INT NOT NULL,
  justificacion TEXT NOT NULL,
  permisos JSON NOT NULL,
  estado ENUM('ACTIVA', 'CERRADA', 'EXPIRADA') DEFAULT 'ACTIVA',
  fecha_apertura DATETIME NOT NULL,
  fecha_cierre DATETIME,
  fecha_expiracion DATETIME NOT NULL,
  ip_origen VARCHAR(45),
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_alumno_sesion (id_alumno),
  INDEX idx_solicitante (id_solicitante),
  INDEX idx_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabla de log de acceso en sesión de emergencia (qué datos se consultaron)
CREATE TABLE IF NOT EXISTS sesiones_emergencia_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  id_sesion BIGINT NOT NULL,
  id_usuario_consulta INT NOT NULL,
  tipo_dato VARCHAR(100) NOT NULL,
  descripcion VARCHAR(500),
  fecha_consulta DATETIME NOT NULL,
  ip_origen VARCHAR(45),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sesion_log (id_sesion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
