-- ============================================================
-- MIGRACIÓN: DERECHOS DE AUTOR — CAPA LEGAL
-- SIVACAD-ISC
-- Copyright (c) 2026 Bárcenas González Laura Casandra &
--                    Morales Ibarra Sandivel
-- TESI — Ingeniería en Sistemas Computacionales
-- ============================================================

-- 1. ACEPTACIONES LEGALES (Términos, Privacidad, Propiedad Intelectual)
CREATE TABLE IF NOT EXISTS aceptaciones_legales (
    id_aceptacion BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    tipo_aceptacion VARCHAR(50) NOT NULL COMMENT 'terminos, privacidad, propiedad_intelectual',
    version_documento VARCHAR(20) NOT NULL,
    ip_origen VARCHAR(45),
    user_agent VARCHAR(255),
    aceptado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_al_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    INDEX idx_al_usuario (id_usuario),
    INDEX idx_al_tipo (tipo_aceptacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. SESIONES ACTIVAS (Trazabilidad de identidad)
CREATE TABLE IF NOT EXISTS sesiones_activas (
    id_sesion BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    token_jwt VARCHAR(500) NOT NULL,
    ip_origen VARCHAR(45) NOT NULL,
    user_agent VARCHAR(255),
    fecha_inicio DATETIME DEFAULT CURRENT_TIMESTAMP,
    ultimo_acceso DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre DATETIME DEFAULT NULL,
    cerrada_por VARCHAR(30) DEFAULT NULL COMMENT 'usuario, timeout, admin',
    dispositivo_hash VARCHAR(64),
    CONSTRAINT fk_sa_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    INDEX idx_sa_usuario (id_usuario),
    INDEX idx_sa_token (token_jwt(255)),
    INDEX idx_sa_activa (fecha_cierre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. AUDITORÍA GLOBAL UNIFICADA
CREATE TABLE IF NOT EXISTS auditoria_global (
    id_auditoria BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT DEFAULT NULL,
    id_sesion BIGINT DEFAULT NULL,
    modulo VARCHAR(50) NOT NULL,
    accion VARCHAR(80) NOT NULL,
    descripcion TEXT,
    entidad_afectada VARCHAR(80),
    id_entidad BIGINT DEFAULT NULL,
    valor_anterior JSON,
    valor_nuevo JSON,
    ip_origen VARCHAR(45),
    user_agent VARCHAR(255),
    nivel VARCHAR(20) DEFAULT 'INFO' COMMENT 'INFO, WARNING, ERROR, CRITICAL',
    hash_integridad VARCHAR(64),
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_ag_usuario (id_usuario),
    KEY idx_ag_modulo (modulo),
    KEY idx_ag_accion (accion),
    KEY idx_ag_creado (creado_en),
    KEY idx_ag_nivel (nivel),
    CONSTRAINT fk_ag_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    CONSTRAINT fk_ag_sesion FOREIGN KEY (id_sesion)
        REFERENCES sesiones_activas(id_sesion) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. CADENA DOCUMENTAL (Custodia de documentos oficiales)
CREATE TABLE IF NOT EXISTS cadena_documental (
    id_eslabon BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_tramite BIGINT DEFAULT NULL,
    tipo_documento VARCHAR(50) NOT NULL,
    folio VARCHAR(50) NOT NULL,
    hash_documento VARCHAR(64) NOT NULL,
    hash_anterior VARCHAR(64) DEFAULT NULL,
    firma_autores VARCHAR(128),
    emitido_por INT,
    emitido_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY idx_cd_hash (hash_documento),
    INDEX idx_cd_folio (folio),
    INDEX idx_cd_tipo (tipo_documento),
    CONSTRAINT fk_cd_usuario FOREIGN KEY (emitido_por)
        REFERENCES usuarios(id_usuario) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
