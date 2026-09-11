-- =====================================================
-- EJECUTAR EN phpMyAdmin → SQL
-- Copiar y pegar este script completo
-- =====================================================

-- 1. Tabla instituciones
CREATE TABLE IF NOT EXISTS `instituciones` (
  `id_institucion` INT PRIMARY KEY AUTO_INCREMENT,
  `nombre_corto` VARCHAR(50) NOT NULL,
  `nombre_completo` VARCHAR(200) NOT NULL,
  `nombre_legal` VARCHAR(300),
  `dominios_email` JSON NOT NULL,
  `logo_url` VARCHAR(500),
  `color_primario` VARCHAR(7) DEFAULT '#1a56db',
  `color_secundario` VARCHAR(7) DEFAULT '#1e40af',
  `telefono_crisis` VARCHAR(50),
  `frontend_url` VARCHAR(500),
  `formato_matricula` VARCHAR(50) DEFAULT 'ISC-{YYYY}-{NNN}',
  `formato_folio_tramite` VARCHAR(50) DEFAULT 'TRM-{YYYY}-{NNN}',
  `activa` TINYINT DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_institucion_nombre` (`nombre_corto`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Seed TESI
INSERT IGNORE INTO `instituciones`
  (`id_institucion`, `nombre_corto`, `nombre_completo`, `nombre_legal`, `dominios_email`, `color_primario`, `color_secundario`, `frontend_url`)
VALUES
  (1, 'TESI', 'Tecnológico de Estudios Superiores de Ixtapaluca',
   'Tecnológico de Estudios Superiores de Ixtapaluca (TESI)',
   '["tesi.edu.mx", "ixtapaluca.tecnm.mx", "ixtapaluca.tecnm.edu.mx", "outlook.com", "outlook.es"]',
   '#1a56db', '#1e40af', 'http://localhost:5173');

-- 3. Agregar id_institucion a usuarios (solo si no existe)
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'id_institucion');
SET @sql = IF(@col = 0, 'ALTER TABLE `usuarios` ADD COLUMN `id_institucion` INT DEFAULT 1 AFTER `id_rol`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. Tabla token_blacklist
CREATE TABLE IF NOT EXISTS `token_blacklist` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `token_hash` VARCHAR(64) NOT NULL,
  `tipo` ENUM('access','refresh') NOT NULL,
  `id_usuario` INT NOT NULL,
  `razon` VARCHAR(100) NOT NULL,
  `expira_en` DATETIME NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_token_hash` (`token_hash`),
  INDEX `idx_usuario_tipo` (`id_usuario`, `tipo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabla bloqueos_cuenta
CREATE TABLE IF NOT EXISTS `bloqueos_cuenta` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `id_usuario` INT NOT NULL,
  `intentos_fallidos` INT DEFAULT 0,
  `ultimo_intento_fallido` DATETIME,
  `bloqueado_hasta` DATETIME,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_bloqueo_usuario` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Tabla sesiones_activas
CREATE TABLE IF NOT EXISTS `sesiones_activas` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `id_usuario` INT NOT NULL,
  `token_hash` VARCHAR(64) NOT NULL,
  `dispositivo_hash` VARCHAR(64),
  `ip_origen` VARCHAR(45),
  `user_agent` TEXT,
  `activa` TINYINT DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `ultimo_acceso` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `expira_en` DATETIME NOT NULL,
  INDEX `idx_usuario_sesion` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Tabla mfa_config
CREATE TABLE IF NOT EXISTS `mfa_config` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `id_usuario` INT NOT NULL,
  `secret_hash` VARCHAR(255) NOT NULL,
  `activo` TINYINT DEFAULT 0,
  `recovery_codes` JSON,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_mfa_usuario` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Tabla break_glass_credentials
CREATE TABLE IF NOT EXISTS `break_glass_credentials` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `id_usuario_emisor` INT NOT NULL,
  `id_usuario_receptor` INT NOT NULL,
  `pin_hash` VARCHAR(255) NOT NULL,
  `permisos` JSON NOT NULL,
  `fecha_emision` DATETIME NOT NULL,
  `fecha_expiracion` DATETIME NOT NULL,
  `motivo` TEXT NOT NULL,
  `activo` TINYINT DEFAULT 1,
  `usado_en` DATETIME,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_receptor` (`id_usuario_receptor`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Tabla emergency_access_log
CREATE TABLE IF NOT EXISTS `emergency_access_log` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `id_usuario` INT NOT NULL,
  `id_credencial` BIGINT,
  `fecha_acceso` DATETIME NOT NULL,
  `datos_consultados` JSON NOT NULL,
  `ip_origen` VARCHAR(45),
  `dispositivo_info` TEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_usuario` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Tabla contactos_emergencia
CREATE TABLE IF NOT EXISTS `contactos_emergencia` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `id_usuario` INT NOT NULL,
  `nombre` VARCHAR(200) NOT NULL,
  `parentesco` VARCHAR(50) NOT NULL,
  `telefono` VARCHAR(20) NOT NULL,
  `telefono_alt` VARCHAR(20),
  `correo` VARCHAR(200),
  `principal` TINYINT DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_usuario_contacto` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Tabla consentimientos
CREATE TABLE IF NOT EXISTS `consentimientos` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `id_usuario` INT NOT NULL,
  `tipo_consentimiento` VARCHAR(100) NOT NULL,
  `version_documento` VARCHAR(20) NOT NULL,
  `aceptado` TINYINT NOT NULL,
  `ip_origen` VARCHAR(45),
  `aceptado_en` DATETIME NOT NULL,
  `revocado_en` DATETIME,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_usuario_tipo` (`id_usuario`, `tipo_consentimiento`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Tabla ia_prompts
CREATE TABLE IF NOT EXISTS `ia_prompts` (
  `id_prompt` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `id_institucion` INT NOT NULL,
  `modulo` VARCHAR(50) NOT NULL,
  `rol` VARCHAR(50),
  `system_prompt` LONGTEXT NOT NULL,
  `sufijo_rol` TEXT,
  `idioma` VARCHAR(10) DEFAULT 'es',
  `activo` TINYINT DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_ia_prompt_inst_modulo_rol` (`id_institucion`, `modulo`, `rol`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Tabla instituciones_features
CREATE TABLE IF NOT EXISTS `instituciones_features` (
  `id_feature` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `id_institucion` INT NOT NULL,
  `feature_key` VARCHAR(100) NOT NULL,
  `habilitado` TINYINT DEFAULT 1,
  `config` JSON,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_feature_inst` (`id_institucion`, `feature_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Seed features
INSERT IGNORE INTO `instituciones_features` (`id_institucion`, `feature_key`, `habilitado`)
VALUES
  (1, 'inscripciones', 1), (1, 'kardex', 1), (1, 'tramites', 1),
  (1, 'evaluaciones', 1), (1, 'ia_chatbot', 1), (1, 'ia_bienestar', 1),
  (1, 'ia_becas', 1), (1, 'ia_desercion', 1), (1, 'actas_ocr', 1),
  (1, 'reportes', 1), (1, 'bajas', 1), (1, 'derechos_autor', 1);

-- 15. Seed prompts IA
INSERT IGNORE INTO `ia_prompts` (`id_institucion`, `modulo`, `rol`, `system_prompt`, `sufijo_rol`)
VALUES
  (1, 'chatbot', NULL, 'Eres el asistente virtual del TESI. Ayuda con trámites académicos.', 'Responde de forma profesional.'),
  (1, 'chatbot', 'alumno', 'Eres el asistente del TESI para alumnos.', 'Usa un tono cercano.'),
  (1, 'chatbot', 'docente', 'Eres el asistente del TESI para docentes.', 'Usa un tono profesional.');

-- 16. Agregar id_institucion a tablas académicas (solo si no existe)
-- Función helper
DROP PROCEDURE IF EXISTS add_inst_col;
DELIMITER //
CREATE PROCEDURE add_inst_col()
BEGIN
  DECLARE done INT DEFAULT FALSE;
  DECLARE tbl VARCHAR(100);
  DECLARE cur CURSOR FOR
    SELECT TABLE_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'id_institucion';
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

  -- Lista de tablas que necesitan id_institucion
  DROP TABLE IF EXISTS tmp_tables;
  CREATE TEMPORARY TABLE tmp_tables (tbl_name VARCHAR(100));
  INSERT INTO tmp_tables VALUES
    ('carreras'),('planes_estudio'),('periodos'),('materias'),
    ('alumnos'),('docentes'),('grupos'),('grupos_alumnos'),('cargas_academicas'),
    ('inscripciones'),('reinscripciones'),
    ('kardex_alumno'),('kardex_historial_academico'),('kardex_auditoria'),('kardex_sellos'),
    ('evaluaciones'),('evaluacion_plantillas'),('evaluacion_resultados'),('respuestas_evaluacion'),
    ('tramites'),('tramites_tipos'),('tramites_configuracion'),('tramites_documentos'),
    ('tramites_historial_estados'),('tramites_observaciones'),('tramites_auditoria'),
    ('chatbot_configuracion'),('chatbot_mensajes'),('chatbot_auditoria'),
    ('ia_alertas_desercion'),('ia_desercion_parciales'),
    ('ia_bienestar_sesiones'),('ia_bienestar_checkins'),('ia_bienestar_mensajes'),
    ('ia_bienestar_alertas'),('ia_bienestar_derivaciones'),
    ('ia_becas_convocatorias'),('ia_becas_solicitudes'),('ia_becas_auditoria'),
    ('actas_ocr_configuracion'),('actas_ocr_cargas'),('actas_ocr_detalles'),
    ('actas_calificaciones'),('actas_calificaciones_detalle'),
    ('asistente_sesiones'),('asistente_mensajes'),
    ('bitacora_auditoria'),('inscripciones_auditoria'),('reinscripcion_auditoria'),
    ('notificaciones_docente'),('cadena_documental'),('aceptaciones_legales'),
    ('soporte_kardex_incidencias'),('incidencias_soporte');

  -- Loop through and add column if missing
  BEGIN
    DECLARE done2 INT DEFAULT FALSE;
    DECLARE tname VARCHAR(100);
    DECLARE cur2 CURSOR FOR SELECT tbl_name FROM tmp_tables;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done2 = TRUE;
    OPEN cur2;
    read_loop: LOOP
      FETCH cur2 INTO tname;
      IF done2 THEN LEAVE read_loop; END IF;
      SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tname AND COLUMN_NAME = 'id_institucion');
      IF @exists = 0 THEN
        SET @sql2 = CONCAT('ALTER TABLE `', tname, '` ADD COLUMN `id_institucion` INT DEFAULT 1');
        PREPARE s2 FROM @sql2;
        EXECUTE s2;
        DEALLOCATE PREPARE s2;
      END IF;
    END LOOP;
    CLOSE cur2;
  END;

  DROP TEMPORARY TABLE IF EXISTS tmp_tables;
END //
DELIMITER ;

CALL add_inst_col();
DROP PROCEDURE IF EXISTS add_inst_col;

-- LISTO. Las tablas existen y el login debe funcionar.
SELECT 'Migración completada. Las tablas de seguridad ya existen.' AS resultado;
