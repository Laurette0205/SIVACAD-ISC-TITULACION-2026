-- =========================================================
-- MIGRACIÓN: MÓDULO DE SOPORTE TÉCNICO - TRÁMITES
-- =========================================================
-- Sistema: SIVACAD-ISC
-- Descripción: Tablas para la gestión de soporte técnico
-- del módulo de trámites (bajas, traslados, cambio de
-- carrera, equivalentes, revalidaciones, etc.)
-- =========================================================

CREATE TABLE IF NOT EXISTS soporte_tramites_incidencias (
    id_incidencia BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_tramite BIGINT DEFAULT NULL,
    folio_tramite VARCHAR(50) DEFAULT NULL,
    id_tipo_tramite INT DEFAULT NULL,
    tipo_incidencia VARCHAR(50) NOT NULL DEFAULT 'FALLA_GENERACION',
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    estado VARCHAR(30) NOT NULL DEFAULT 'EN_PROCESO',
    nivel VARCHAR(20) DEFAULT 'MEDIA',
    modulo_afectado VARCHAR(50) DEFAULT 'TRAMITES',
    id_tramite_asociado BIGINT DEFAULT NULL,
    evidencia TEXT,
    reportado_por INT DEFAULT NULL,
    atendido_por INT DEFAULT NULL,
    atendido_en DATETIME DEFAULT NULL,
    solucion TEXT,
    requiere_reintento TINYINT(1) DEFAULT 0,
    reintentos INT DEFAULT 0,
    ultimo_reintento_en DATETIME DEFAULT NULL,
    cerrado_por INT DEFAULT NULL,
    cerrado_en DATETIME DEFAULT NULL,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_sti_estado (estado),
    KEY idx_sti_tramite (id_tramite),
    KEY idx_sti_tipo (tipo_incidencia),
    KEY idx_sti_creado (creado_en),
    CONSTRAINT fk_sti_tramite FOREIGN KEY (id_tramite) REFERENCES tramites(id_tramite) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_sti_tipo_tramite FOREIGN KEY (id_tipo_tramite) REFERENCES tramites_tipos(id_tipo) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_sti_reportado FOREIGN KEY (reportado_por) REFERENCES usuarios(id_usuario) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_sti_atendido FOREIGN KEY (atendido_por) REFERENCES usuarios(id_usuario) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_sti_cerrado FOREIGN KEY (cerrado_por) REFERENCES usuarios(id_usuario) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS soporte_tramites_archivos (
    id_archivo BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_incidencia BIGINT DEFAULT NULL,
    id_tramite BIGINT DEFAULT NULL,
    tipo_documento VARCHAR(100) NOT NULL,
    nombre_original VARCHAR(255) NOT NULL,
    ruta_archivo VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) DEFAULT NULL,
    peso_bytes BIGINT DEFAULT 0,
    accion VARCHAR(30) NOT NULL DEFAULT 'CARGA',
    estado_archivo VARCHAR(30) DEFAULT 'RECIBIDO',
    subido_por INT DEFAULT NULL,
    subido_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    validado TINYINT(1) DEFAULT 0,
    validado_por INT DEFAULT NULL,
    validado_en DATETIME DEFAULT NULL,
    observaciones TEXT,
    KEY idx_sta_incidencia (id_incidencia),
    KEY idx_sta_tramite (id_tramite),
    KEY idx_sta_accion (accion),
    CONSTRAINT fk_sta_incidencia FOREIGN KEY (id_incidencia) REFERENCES soporte_tramites_incidencias(id_incidencia) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_sta_tramite FOREIGN KEY (id_tramite) REFERENCES tramites(id_tramite) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_sta_subido FOREIGN KEY (subido_por) REFERENCES usuarios(id_usuario) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_sta_validado FOREIGN KEY (validado_por) REFERENCES usuarios(id_usuario) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS soporte_tramites_recuperacion (
    id_recuperacion BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_incidencia BIGINT DEFAULT NULL,
    id_tramite BIGINT DEFAULT NULL,
    id_tramite_documento BIGINT DEFAULT NULL,
    tipo_recuperacion VARCHAR(50) NOT NULL DEFAULT 'ARCHIVO',
    estado VARCHAR(30) NOT NULL DEFAULT 'EN_PROCESO',
    documento_original VARCHAR(500) DEFAULT NULL,
    documento_recuperado VARCHAR(500) DEFAULT NULL,
    peso_original_bytes BIGINT DEFAULT 0,
    peso_recuperado_bytes BIGINT DEFAULT 0,
    integridad_ok TINYINT(1) DEFAULT 0,
    realizado_por INT DEFAULT NULL,
    realizado_en DATETIME DEFAULT NULL,
    observaciones TEXT,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_str_incidencia (id_incidencia),
    KEY idx_str_tramite (id_tramite),
    KEY idx_str_estado (estado),
    CONSTRAINT fk_str_incidencia FOREIGN KEY (id_incidencia) REFERENCES soporte_tramites_incidencias(id_incidencia) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_str_tramite FOREIGN KEY (id_tramite) REFERENCES tramites(id_tramite) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_str_documento FOREIGN KEY (id_tramite_documento) REFERENCES tramites_documentos(id_documento) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_str_realizado FOREIGN KEY (realizado_por) REFERENCES usuarios(id_usuario) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS soporte_tramites_logs (
    id_log BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_incidencia BIGINT DEFAULT NULL,
    id_tramite BIGINT DEFAULT NULL,
    accion VARCHAR(80) NOT NULL,
    descripcion TEXT,
    nivel VARCHAR(20) DEFAULT 'INFO',
    modulo VARCHAR(50) DEFAULT 'TRAMITES',
    detalle_tecnico TEXT,
    id_usuario INT DEFAULT NULL,
    ip_origen VARCHAR(45) DEFAULT NULL,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_stl_incidencia (id_incidencia),
    KEY idx_stl_tramite (id_tramite),
    KEY idx_stl_accion (accion),
    KEY idx_stl_creado (creado_en),
    CONSTRAINT fk_stl_incidencia FOREIGN KEY (id_incidencia) REFERENCES soporte_tramites_incidencias(id_incidencia) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_stl_tramite FOREIGN KEY (id_tramite) REFERENCES tramites(id_tramite) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_stl_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS soporte_tramites_monitoreo (
    id_monitoreo BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_periodo INT DEFAULT NULL,
    tipo_monitoreo VARCHAR(30) NOT NULL DEFAULT 'GENERAL',
    estado VARCHAR(30) NOT NULL DEFAULT 'EN_PROCESO',
    total_tramites INT DEFAULT 0,
    con_incidencias INT DEFAULT 0,
    resueltos INT DEFAULT 0,
    pendientes INT DEFAULT 0,
    detalle JSON DEFAULT NULL,
    iniciado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    completado_en DATETIME DEFAULT NULL,
    ejecutado_por INT DEFAULT NULL,
    KEY idx_stm_periodo (id_periodo),
    KEY idx_stm_estado (estado),
    CONSTRAINT fk_stm_periodo FOREIGN KEY (id_periodo) REFERENCES periodos(id_periodo) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_stm_ejecutado FOREIGN KEY (ejecutado_por) REFERENCES usuarios(id_usuario) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
