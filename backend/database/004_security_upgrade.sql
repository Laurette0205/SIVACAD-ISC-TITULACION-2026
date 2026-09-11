-- =====================================================
-- MIGRACIÓN 004: SEGURIDAD
-- Fecha: 2026-09-09
-- Descripción: Token blacklist, bloqueo de cuenta, MFA
-- =====================================================

-- =====================================================
-- 1. TABLA token_blacklist
-- =====================================================
CREATE TABLE IF NOT EXISTS token_blacklist (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  token_hash VARCHAR(64) NOT NULL COMMENT 'SHA-256 del token',
  tipo ENUM('access','refresh') NOT NULL,
  id_usuario INT NOT NULL,
  razon VARCHAR(100) NOT NULL COMMENT 'logout, revocado, cambio_password, cambio_rol, suspicious',
  expira_en DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_token_hash (token_hash),
  INDEX idx_usuario_tipo (id_usuario, tipo),
  INDEX idx_expira_en (expira_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 2. TABLA bloqueos_cuenta
-- =====================================================
CREATE TABLE IF NOT EXISTS bloqueos_cuenta (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  id_usuario INT NOT NULL,
  intentos_fallidos INT DEFAULT 0,
  ultimo_intento_fallido DATETIME,
  bloqueado_hasta DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_bloqueo_usuario (id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 3. TABLA mfa_config
-- =====================================================
CREATE TABLE IF NOT EXISTS mfa_config (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  id_usuario INT NOT NULL,
  secret_hash VARCHAR(255) NOT NULL COMMENT 'TOTP secret (cifrado)',
  activo TINYINT DEFAULT 0,
  recovery_codes JSON COMMENT 'Códigos de recuperación hasheados',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_mfa_usuario (id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 4. TABLA sesiones_activas (si no existe de migraciones previas)
-- =====================================================
CREATE TABLE IF NOT EXISTS sesiones_activas (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  id_usuario INT NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  dispositivo_hash VARCHAR(64),
  ip_origen VARCHAR(45),
  user_agent TEXT,
  activa TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ultimo_acceso DATETIME DEFAULT CURRENT_TIMESTAMP,
  expira_en DATETIME NOT NULL,
  INDEX idx_usuario_sesion (id_usuario),
  INDEX idx_token_hash_sesion (token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
