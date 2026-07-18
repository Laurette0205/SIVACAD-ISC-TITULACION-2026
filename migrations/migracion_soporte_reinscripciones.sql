-- =========================================================
-- MIGRACIÓN: SOPORTE REINSCRIPCIONES
-- Tablas técnicas para diagnóstico y monitoreo de
-- reinscripciones
-- =========================================================

CREATE TABLE IF NOT EXISTS soporte_reinscripciones_incidencias (
    id_incidencia BIGINT AUTO_INCREMENT PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL COMMENT 'sistema,carga,sincronizacion,integridad,conectividad,otro',
    gravedad ENUM('baja','media','alta','critica') DEFAULT 'media',
    estado ENUM('abierta','en_proceso','resuelta','cerrada') DEFAULT 'abierta',
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    modulo VARCHAR(50) DEFAULT 'reinscripciones',
    id_reinscripcion BIGINT NULL,
    id_inscripcion BIGINT NULL,
    evidencia TEXT COMMENT 'Stack trace, JSON, URL, etc.',
    reportado_por INT NULL,
    asignado_a INT NULL,
    solucion TEXT,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    resuelto_en DATETIME NULL,
    KEY idx_sri_estado (estado),
    KEY idx_sri_gravedad (gravedad),
    KEY idx_sri_modulo (modulo),
    CONSTRAINT fk_sri_reportado
      FOREIGN KEY (reportado_por) REFERENCES usuarios(id_usuario)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_sri_asignado
      FOREIGN KEY (asignado_a) REFERENCES usuarios(id_usuario)
      ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS soporte_reinscripciones_logs (
    id_log BIGINT AUTO_INCREMENT PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL COMMENT 'info,warning,error,critical',
    accion VARCHAR(100) NOT NULL,
    descripcion TEXT,
    modulo VARCHAR(50) DEFAULT 'reinscripciones',
    id_reinscripcion BIGINT NULL,
    id_inscripcion BIGINT NULL,
    ip_origen VARCHAR(45) NULL,
    usuario_id INT NULL,
    metadata JSON NULL,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_srl_tipo (tipo),
    KEY idx_srl_accion (accion),
    KEY idx_srl_creado (creado_en),
    CONSTRAINT fk_srl_usuario
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id_usuario)
      ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS soporte_reinscripciones_monitoreo (
    id_monitoreo BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_periodo INT NOT NULL,
    tipo VARCHAR(50) NOT NULL COMMENT 'sincronizacion, carga_masiva, validacion, integridad',
    estado ENUM('en_curso','completado','fallido','pendiente') DEFAULT 'pendiente',
    total_registros INT DEFAULT 0,
    procesados INT DEFAULT 0,
    errores INT DEFAULT 0,
    detalle JSON NULL,
    iniciado_en DATETIME NULL,
    completado_en DATETIME NULL,
    ejecutado_por INT NULL,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_srm_periodo (id_periodo, tipo),
    CONSTRAINT fk_srm_periodo
      FOREIGN KEY (id_periodo) REFERENCES periodos(id_periodo)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_srm_ejecutor
      FOREIGN KEY (ejecutado_por) REFERENCES usuarios(id_usuario)
      ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Registrar incidencias existentes de reinscripcion en la nueva tabla si hay datos
INSERT IGNORE INTO soporte_reinscripciones_incidencias (tipo, gravedad, estado, titulo, descripcion, modulo)
VALUES ('sistema', 'baja', 'abierta', 'Módulo de reinscripciones activado', 'El módulo de soporte técnico para reinscripciones ha sido inicializado correctamente.', 'reinscripciones');
