-- =============================================================
-- MÓDULO 5: SEGURIDAD CONTRA SUPLANTACIÓN Y ESCALAMIENTO
-- Tabla de alertas de seguridad
-- =============================================================

-- alertas_seguridad: Registro centralizado de alertas de seguridad
CREATE TABLE IF NOT EXISTS alertas_seguridad (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario_afectado INT NOT NULL,
  tipo_alerta VARCHAR(60) NOT NULL,
  titulo VARCHAR(200) NOT NULL,
  descripcion TEXT,
  severidad ENUM('BAJA','MEDIA','ALTA','CRITICA') DEFAULT 'MEDIA',
  ip_origen VARCHAR(45) DEFAULT NULL,
  dispositivo_hash VARCHAR(64) DEFAULT NULL,
  user_agent VARCHAR(500) DEFAULT NULL,
  metadatos_json TEXT,
  estado ENUM('PENDIENTE','REVISADA','RESUELTA','DESCARTADA') DEFAULT 'PENDIENTE',
  revisada_por INT DEFAULT NULL,
  revisada_en DATETIME DEFAULT NULL,
  notas_revision TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_alertas_usuario (id_usuario_afectado),
  INDEX idx_alertas_tipo (tipo_alerta),
  INDEX idx_alertas_severidad (severidad),
  INDEX idx_alertas_estado (estado),
  INDEX idx_alertas_created (created_at)
) ENGINE=InnoDB;

-- dispositivos_sesion: Registro de sesiones con datos completos del dispositivo
-- (Complementa dispositivos_conocidos con info de sesión para análisis forense)
CREATE TABLE IF NOT EXISTS dispositivos_sesion (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  dispositivo_hash VARCHAR(64) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  pais VARCHAR(100) DEFAULT NULL,
  ciudad VARCHAR(100) DEFAULT NULL,
  user_agent VARCHAR(500) DEFAULT NULL,
  accept_language VARCHAR(200) DEFAULT NULL,
  accept_encoding VARCHAR(200) DEFAULT NULL,
  screen_res VARCHAR(20) DEFAULT NULL,
  timezone VARCHAR(100) DEFAULT NULL,
  es_confiable TINYINT(1) DEFAULT 0,
  sesion_token_hash VARCHAR(64) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ultimo_visto DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sesion_dispositivo (id_usuario, dispositivo_hash),
  INDEX idx_sesion_ip (ip_address),
  INDEX idx_sesion_created (created_at)
) ENGINE=InnoDB;

-- log_cambios_criticos: Registro de cambios sensibles en cuentas
CREATE TABLE IF NOT EXISTS log_cambios_criticos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  id_responsable INT DEFAULT NULL,
  tipo_cambio VARCHAR(60) NOT NULL,
  campo VARCHAR(100) DEFAULT NULL,
  valor_anterior TEXT,
  valor_nuevo TEXT,
  ip_origen VARCHAR(45) DEFAULT NULL,
  motivo TEXT,
  requiere_reauth TINYINT(1) DEFAULT 0,
  reauth_verificado TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cambios_usuario (id_usuario),
  INDEX idx_cambios_tipo (tipo_cambio),
  INDEX idx_cambios_created (created_at)
) ENGINE=InnoDB;
