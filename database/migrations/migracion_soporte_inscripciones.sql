USE sivacad_isc;

START TRANSACTION;

-- =========================================================
-- TABLA DE INCIDENCIAS TÉCNICAS DE SOPORTE
-- =========================================================
CREATE TABLE IF NOT EXISTS incidencias_soporte (
  id_incidencia BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  tipo ENUM('tecnica', 'acceso', 'datos', 'conectividad', 'otro') NOT NULL DEFAULT 'tecnica',
  gravedad ENUM('baja', 'media', 'alta', 'critica') NOT NULL DEFAULT 'media',
  titulo VARCHAR(200) NOT NULL,
  descripcion TEXT NOT NULL,
  modulo_afectado VARCHAR(100) NULL,
  estado ENUM('abierta', 'en_proceso', 'resuelta', 'cerrada') NOT NULL DEFAULT 'abierta',
  solucion TEXT NULL,
  cerrada_por INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_incidencia_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_incidencia_cerrada_por FOREIGN KEY (cerrada_por) REFERENCES usuarios(id_usuario) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- TABLA DE LOGS TÉCNICOS DE INSCRIPCIONES
-- =========================================================
CREATE TABLE IF NOT EXISTS logs_soporte_inscripciones (
  id_log BIGINT AUTO_INCREMENT PRIMARY KEY,
  nivel ENUM('info', 'warning', 'error', 'debug') NOT NULL DEFAULT 'info',
  modulo VARCHAR(60) NOT NULL,
  accion VARCHAR(80) NOT NULL,
  mensaje TEXT NOT NULL,
  detalle_tecnico TEXT NULL,
  id_usuario INT NULL,
  ip VARCHAR(45) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_logs_nivel (nivel),
  KEY idx_logs_modulo (modulo),
  KEY idx_logs_created (created_at),
  CONSTRAINT fk_logs_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- INSERTAR LOGS INICIALES DE DIAGNÓSTICO
-- =========================================================
INSERT INTO logs_soporte_inscripciones (nivel, modulo, accion, mensaje)
SELECT 'info', 'sistema', 'MIGRACION_INICIAL',
       'Migración de soporte inscripciones ejecutada correctamente.'
WHERE NOT EXISTS (
  SELECT 1 FROM logs_soporte_inscripciones WHERE accion = 'MIGRACION_INICIAL'
);

COMMIT;
