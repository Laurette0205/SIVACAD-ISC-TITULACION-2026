-- =============================================
-- SIVACAD - Migración de Seguridad
-- Fecha: 2026-08-22
-- =============================================

-- Tabla: dispositivos_conocidos
-- Registra dispositivos desde los cuales inicia sesión cada usuario
CREATE TABLE IF NOT EXISTS dispositivos_conocidos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  dispositivo_hash VARCHAR(64) NOT NULL,
  user_agent VARCHAR(500) DEFAULT NULL,
  ip_primera_sesion VARCHAR(45) DEFAULT NULL,
  ip_ultima_sesion VARCHAR(45) DEFAULT NULL,
  es_confiable TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ultimo_visto DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_usuario (id_usuario),
  INDEX idx_hash (dispositivo_hash),
  UNIQUE KEY uq_usuario_dispositivo (id_usuario, dispositivo_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: intentos_sospechosos
-- Log de actividades sospechosas (login fallido, rate limit, IP bloqueada, etc.)
CREATE TABLE IF NOT EXISTS intentos_sospechosos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT DEFAULT NULL,
  tipo_evento VARCHAR(50) NOT NULL,
  ip_origen VARCHAR(45) DEFAULT NULL,
  user_agent VARCHAR(500) DEFAULT NULL,
  dispositivo_hash VARCHAR(64) DEFAULT NULL,
  detalle_json TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tipo_evento (tipo_evento),
  INDEX idx_ip (ip_origen),
  INDEX idx_usuario (id_usuario),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: ips_bloqueadas
-- IPs bloqueadas manualmente o por rate limiting automático
CREATE TABLE IF NOT EXISTS ips_bloqueadas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ip_address VARCHAR(45) NOT NULL,
  razon VARCHAR(255) DEFAULT NULL,
  activo TINYINT(1) DEFAULT 1,
  expires_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ip (ip_address),
  INDEX idx_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
