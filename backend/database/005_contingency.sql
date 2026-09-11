-- =====================================================
-- MIGRACIÓN 005: CONTINGENCIA
-- Fecha: 2026-09-09
-- Descripción: Break-glass access, sync offline,
--              contactos de emergencia
-- =====================================================

-- =====================================================
-- 1. TABLA break_glass_credentials
-- =====================================================
CREATE TABLE IF NOT EXISTS break_glass_credentials (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  id_usuario_emisor INT NOT NULL,
  id_usuario_receptor INT NOT NULL,
  pin_hash VARCHAR(255) NOT NULL COMMENT 'SHA-256 del PIN',
  permisos JSON NOT NULL COMMENT 'Lista de permisos autorizados',
  fecha_emision DATETIME NOT NULL,
  fecha_expiracion DATETIME NOT NULL,
  motivo TEXT NOT NULL,
  activo TINYINT DEFAULT 1,
  usado_en DATETIME,
  sincronizado TINYINT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_usuario_emisor) REFERENCES usuarios(id_usuario),
  FOREIGN KEY (id_usuario_receptor) REFERENCES usuarios(id_usuario),
  INDEX idx_receptor (id_usuario_receptor),
  INDEX idx_expiracion (fecha_expiracion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 2. TABLA emergency_access_log
-- =====================================================
CREATE TABLE IF NOT EXISTS emergency_access_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  id_usuario INT NOT NULL,
  id_credencial BIGINT,
  fecha_acceso DATETIME NOT NULL,
  datos_consultados JSON NOT NULL,
  ip_origen VARCHAR(45),
  dispositivo_info TEXT,
  sincronizado TINYINT DEFAULT 0,
  sincronizado_en DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
  INDEX idx_usuario (id_usuario),
  INDEX idx_sincronizado (sincronizado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 3. TABLA contactos_emergencia
-- =====================================================
CREATE TABLE IF NOT EXISTS contactos_emergencia (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  id_usuario INT NOT NULL,
  nombre VARCHAR(200) NOT NULL,
  parentesco VARCHAR(50) NOT NULL,
  telefono VARCHAR(20) NOT NULL,
  telefono_alt VARCHAR(20),
  correo VARCHAR(200),
  principal TINYINT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
  INDEX idx_usuario_contacto (id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 4. TABLA offline_sync_queue
-- =====================================================
CREATE TABLE IF NOT EXISTS offline_sync_queue (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  id_usuario INT NOT NULL,
  id_institucion INT NOT NULL DEFAULT 1,
  accion VARCHAR(50) NOT NULL COMMENT 'create, update, delete',
  entidad VARCHAR(50) NOT NULL COMMENT 'nombre de la tabla',
  entidad_id BIGINT,
  datos JSON NOT NULL,
  timestamp_dispositivo DATETIME NOT NULL,
  sincronizado TINYINT DEFAULT 0,
  sincronizado_en DATETIME,
  error_mensaje TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
  FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion),
  INDEX idx_usuario_sync (id_usuario, sincronizado),
  INDEX idx_sincronizado (sincronizado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
