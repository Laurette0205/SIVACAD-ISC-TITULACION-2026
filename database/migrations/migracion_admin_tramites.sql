-- =========================================================
-- MIGRACIÓN: MÓDULO DE TRÁMITES ADMINISTRATIVOS (ADMIN)
-- =========================================================
-- Sistema: SIVACAD-ISC
-- Descripción: Tablas para la gestión centralizada de
-- trámites académicos: Baja, Traslado, Cambio de Carrera,
-- Equivalencia, Revalidación, Certificado Parcial,
-- Historial Académico y Constancias.
-- =========================================================

USE sivacad_isc;

-- =========================================================
-- PROCEDIMIENTO AUXILIAR para agregar constraints FK
-- sólo si no existen (MySQL no tiene ADD CONSTRAINT IF NOT EXISTS)
-- =========================================================
DROP PROCEDURE IF EXISTS sp_add_fk_if_not_exists;
DELIMITER $$
CREATE PROCEDURE sp_add_fk_if_not_exists(
  IN p_constraint_name VARCHAR(128),
  IN p_alter_sql TEXT
)
BEGIN
  DECLARE exists_count INT DEFAULT 0;
  SELECT COUNT(*) INTO exists_count
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND CONSTRAINT_NAME = p_constraint_name;
  IF exists_count = 0 THEN
    SET @sql = p_alter_sql;
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

-- =========================================================
-- PROCEDIMIENTO AUXILIAR para agregar índices
-- sólo si no existen
-- =========================================================
DROP PROCEDURE IF EXISTS sp_add_index_if_not_exists;
DELIMITER $$
CREATE PROCEDURE sp_add_index_if_not_exists(
  IN p_table_name VARCHAR(128),
  IN p_index_name VARCHAR(128),
  IN p_index_sql TEXT
)
BEGIN
  DECLARE exists_count INT DEFAULT 0;
  SELECT COUNT(*) INTO exists_count
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = p_table_name
    AND INDEX_NAME = p_index_name;
  IF exists_count = 0 THEN
    SET @sql = p_index_sql;
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

-- =========================================================
-- 1. TIPOS DE TRÁMITE
-- =========================================================
CREATE TABLE IF NOT EXISTS tramites_tipos (
    id_tipo INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL UNIQUE,
    nombre VARCHAR(120) NOT NULL,
    descripcion TEXT,
    activo TINYINT(1) DEFAULT 1,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO tramites_tipos (codigo, nombre, descripcion) VALUES
('BAJA', 'Baja', 'Trámite de baja definitiva o temporal del alumno'),
('TRASLADO', 'Traslado', 'Cambio de escuela o institución educativa'),
('CAMBIO_CARRERA', 'Cambio de Carrera', 'Movimiento interno entre programas educativos'),
('EQUIVALENCIA', 'Equivalencia', 'Reconocimiento de estudios equivalentes'),
('REVALIDACION', 'Revalidación', 'Revalidación de estudios previos'),
('CERTIFICADO_PARCIAL', 'Certificado Parcial', 'Expedición de certificado parcial de estudios'),
('HISTORIAL_ACADEMICO', 'Historial Académico', 'Expedición de historial académico oficial'),
('CONSTANCIA', 'Constancia', 'Expedición de constancia de estudios o situación académica');

-- =========================================================
-- 2. ESTADOS DE TRÁMITE
-- =========================================================
CREATE TABLE IF NOT EXISTS tramites_estados (
    id_estado INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL UNIQUE,
    nombre VARCHAR(80) NOT NULL,
    orden INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO tramites_estados (codigo, nombre, orden) VALUES
('SOLICITADO', 'Solicitado', 1),
('EN_REVISION', 'En Revisión', 2),
('APROBADO', 'Aprobado', 3),
('RECHAZADO', 'Rechazado', 4),
('EMITIDO', 'Emitido', 5),
('CERRADO', 'Cerrado', 6);

-- =========================================================
-- 3. TRÁMITES (TABLA PRINCIPAL)
-- =========================================================
CREATE TABLE IF NOT EXISTS tramites (
    id_tramite BIGINT AUTO_INCREMENT PRIMARY KEY,
    folio VARCHAR(50) NOT NULL UNIQUE,
    id_tipo INT NOT NULL,
    id_alumno INT NOT NULL,
    id_usuario_solicitante INT NOT NULL,
    id_periodo INT DEFAULT NULL,
    estado_actual VARCHAR(30) NOT NULL DEFAULT 'SOLICITADO',
    motivo TEXT,
    observaciones TEXT,
    solicitud_validada TINYINT(1) DEFAULT 0,
    solicitud_validada_por INT DEFAULT NULL,
    solicitud_validada_en DATETIME DEFAULT NULL,
    id_coordinador_dictamen INT DEFAULT NULL,
    dictamen TEXT,
    dictamen_en DATETIME DEFAULT NULL,
    dictamen_tipo ENUM('FAVORABLE','DESFAVORABLE') DEFAULT NULL,
    documento_oficial_emitido TINYINT(1) DEFAULT 0,
    emitido_en DATETIME DEFAULT NULL,
    emitido_por INT DEFAULT NULL,
    folio_documento_oficial VARCHAR(80) DEFAULT NULL,
    autorizacion_control_escolar TINYINT(1) DEFAULT 0,
    autorizacion_control_escolar_por INT DEFAULT NULL,
    autorizacion_control_escolar_en DATETIME DEFAULT NULL,
    autorizacion_division_isc TINYINT(1) DEFAULT 0,
    autorizacion_division_isc_por INT DEFAULT NULL,
    autorizacion_division_isc_en DATETIME DEFAULT NULL,
    cerrado TINYINT(1) DEFAULT 0,
    cerrado_en DATETIME DEFAULT NULL,
    cerrado_por INT DEFAULT NULL,
    firma_institucional TEXT DEFAULT NULL,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_tramites_folio (folio),
    KEY idx_tramites_alumno (id_alumno),
    KEY idx_tramites_tipo (id_tipo),
    KEY idx_tramites_estado (estado_actual),
    KEY idx_tramites_periodo (id_periodo),
    CONSTRAINT fk_tramites_tipo
        FOREIGN KEY (id_tipo) REFERENCES tramites_tipos(id_tipo)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_tramites_alumno
        FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_tramites_solicitante
        FOREIGN KEY (id_usuario_solicitante) REFERENCES usuarios(id_usuario)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_tramites_periodo
        FOREIGN KEY (id_periodo) REFERENCES periodos(id_periodo)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_tramites_coordinador
        FOREIGN KEY (id_coordinador_dictamen) REFERENCES usuarios(id_usuario)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_tramites_emitido_por
        FOREIGN KEY (emitido_por) REFERENCES usuarios(id_usuario)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_tramites_cerrado_por
        FOREIGN KEY (cerrado_por) REFERENCES usuarios(id_usuario)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_tramites_solicitud_validada
        FOREIGN KEY (solicitud_validada_por) REFERENCES usuarios(id_usuario)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_tramites_control_escolar
        FOREIGN KEY (autorizacion_control_escolar_por) REFERENCES usuarios(id_usuario)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_tramites_division_isc
        FOREIGN KEY (autorizacion_division_isc_por) REFERENCES usuarios(id_usuario)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 4. DOCUMENTOS DEL TRÁMITE
-- =========================================================
CREATE TABLE IF NOT EXISTS tramites_documentos (
    id_documento BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_tramite BIGINT NOT NULL,
    tipo_documento VARCHAR(100) NOT NULL,
    nombre_original VARCHAR(255) NOT NULL,
    ruta_archivo VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) DEFAULT NULL,
    peso_bytes BIGINT DEFAULT 0,
    subido_por INT DEFAULT NULL,
    subido_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    validado TINYINT(1) DEFAULT 0,
    validado_por INT DEFAULT NULL,
    validado_en DATETIME DEFAULT NULL,
    observaciones TEXT,
    KEY idx_td_tramite (id_tramite),
    KEY idx_td_tipo (tipo_documento),
    CONSTRAINT fk_td_tramite
        FOREIGN KEY (id_tramite) REFERENCES tramites(id_tramite)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_td_subido_por
        FOREIGN KEY (subido_por) REFERENCES usuarios(id_usuario)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_td_validado_por
        FOREIGN KEY (validado_por) REFERENCES usuarios(id_usuario)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 5. HISTORIAL DE CAMBIOS DE ESTADO
-- =========================================================
CREATE TABLE IF NOT EXISTS tramites_historial_estados (
    id_historial BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_tramite BIGINT NOT NULL,
    estado_anterior VARCHAR(30) DEFAULT NULL,
    estado_nuevo VARCHAR(30) NOT NULL,
    cambiado_por INT DEFAULT NULL,
    observaciones TEXT,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_the_tramite (id_tramite),
    CONSTRAINT fk_the_tramite
        FOREIGN KEY (id_tramite) REFERENCES tramites(id_tramite)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_the_usuario
        FOREIGN KEY (cambiado_por) REFERENCES usuarios(id_usuario)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 6. CONFIGURACIÓN DEL MÓDULO DE TRÁMITES
-- =========================================================
CREATE TABLE IF NOT EXISTS tramites_configuracion (
    id_config INT AUTO_INCREMENT PRIMARY KEY,
    clave VARCHAR(80) NOT NULL UNIQUE,
    valor TEXT,
    descripcion TEXT,
    actualizado_por INT DEFAULT NULL,
    actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_tc_usuario
        FOREIGN KEY (actualizado_por) REFERENCES usuarios(id_usuario)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO tramites_configuracion (clave, valor, descripcion) VALUES
('folio_formato', 'TRM-{YYYY}-{NNNNNN}', 'Formato de folio para trámites'),
('folio_contador', '0', 'Contador secuencial para folios'),
('requiere_dictamen_coordinador', '1', 'Indica si se requiere dictamen del coordinador'),
('requiere_autorizacion_control_escolar', '1', 'Indica si se requiere autorización de Control Escolar'),
('requiere_autorizacion_division_isc', '1', 'Indica si se requiere autorización de la División ISC'),
('dias_maximos_resolucion', '30', 'Días máximos para resolver un trámite'),
('notificar_alumno_cambio_estado', '1', 'Notificar al alumno cuando cambie el estado del trámite');

-- =========================================================
-- 7. AUDITORÍA DEL MÓDULO DE TRÁMITES
-- =========================================================
CREATE TABLE IF NOT EXISTS tramites_auditoria (
    id_auditoria BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_tramite BIGINT DEFAULT NULL,
    id_usuario INT DEFAULT NULL,
    accion VARCHAR(80) NOT NULL,
    detalle TEXT,
    ip VARCHAR(45) DEFAULT NULL,
    user_agent VARCHAR(255) DEFAULT NULL,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_ta_tramite (id_tramite),
    KEY idx_ta_usuario (id_usuario),
    KEY idx_ta_accion (accion),
    KEY idx_ta_creado (creado_en),
    CONSTRAINT fk_ta_tramite
        FOREIGN KEY (id_tramite) REFERENCES tramites(id_tramite)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_ta_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
