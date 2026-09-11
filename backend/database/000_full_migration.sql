-- =====================================================
-- MIGRACIÓN COMPLETA: SIVACAD MULTI-INSTITUCIÓN
-- Fecha: 2026-09-09
-- Descripción: Migración unificada y segura
-- Ejecutar este archivo ÚNICAMENTE si las migraciones
-- individuales 003-007 NO fueron ejecutadas.
-- =====================================================

SET @db = (SELECT DATABASE());

-- =====================================================
-- PASO 1: TABLA instituciones (DEBE existir primero)
-- =====================================================
CREATE TABLE IF NOT EXISTS instituciones (
  id_institucion INT PRIMARY KEY AUTO_INCREMENT,
  nombre_corto VARCHAR(50) NOT NULL,
  nombre_completo VARCHAR(200) NOT NULL,
  nombre_legal VARCHAR(300),
  dominios_email JSON NOT NULL,
  logo_url VARCHAR(500),
  color_primario VARCHAR(7) DEFAULT '#1a56db',
  color_secundario VARCHAR(7) DEFAULT '#1e40af',
  telefono_crisis VARCHAR(50),
  frontend_url VARCHAR(500),
  formato_matricula VARCHAR(50) DEFAULT 'ISC-{YYYY}-{NNN}',
  formato_folio_tramite VARCHAR(50) DEFAULT 'TRM-{YYYY}-{NNN}',
  activa TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_institucion_nombre (nombre_corto)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed TESI
INSERT IGNORE INTO instituciones
  (id_institucion, nombre_corto, nombre_completo, nombre_legal, dominios_email, color_primario, color_secundario, frontend_url)
VALUES
  (1, 'TESI', 'Tecnológico de Estudios Superiores de Ixtapaluca',
   'Tecnológico de Estudios Superiores de Ixtapaluca (TESI)',
   '["tesi.edu.mx", "ixtapaluca.tecnm.mx", "ixtapaluca.tecnm.edu.mx", "outlook.com", "outlook.es"]',
   '#1a56db', '#1e40af', 'http://localhost:5173');

-- =====================================================
-- PASO 2: AGREGAR id_institucion A usuarios (si no existe)
-- =====================================================
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'id_institucion');

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE usuarios ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_rol',
  'SELECT "Column id_institucion already exists in usuarios"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- PASO 3: TABLAS DE SEGURIDAD
-- =====================================================
CREATE TABLE IF NOT EXISTS token_blacklist (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  token_hash VARCHAR(64) NOT NULL,
  tipo ENUM('access','refresh') NOT NULL,
  id_usuario INT NOT NULL,
  razon VARCHAR(100) NOT NULL,
  expira_en DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_token_hash (token_hash),
  INDEX idx_usuario_tipo (id_usuario, tipo),
  INDEX idx_expira_en (expira_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS mfa_config (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  id_usuario INT NOT NULL,
  secret_hash VARCHAR(255) NOT NULL,
  activo TINYINT DEFAULT 0,
  recovery_codes JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_mfa_usuario (id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

-- =====================================================
-- PASO 4: TABLAS DE CONTINGENCIA
-- =====================================================
CREATE TABLE IF NOT EXISTS break_glass_credentials (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  id_usuario_emisor INT NOT NULL,
  id_usuario_receptor INT NOT NULL,
  pin_hash VARCHAR(255) NOT NULL,
  permisos JSON NOT NULL,
  fecha_emision DATETIME NOT NULL,
  fecha_expiracion DATETIME NOT NULL,
  motivo TEXT NOT NULL,
  activo TINYINT DEFAULT 1,
  usado_en DATETIME,
  sincronizado TINYINT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_receptor (id_usuario_receptor),
  INDEX idx_expiracion (fecha_expiracion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  INDEX idx_usuario (id_usuario),
  INDEX idx_sincronizado (sincronizado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  INDEX idx_usuario_contacto (id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS offline_sync_queue (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  id_usuario INT NOT NULL,
  id_institucion INT NOT NULL DEFAULT 1,
  accion VARCHAR(50) NOT NULL,
  entidad VARCHAR(50) NOT NULL,
  entidad_id BIGINT,
  datos JSON NOT NULL,
  timestamp_dispositivo DATETIME NOT NULL,
  sincronizado TINYINT DEFAULT 0,
  sincronizado_en DATETIME,
  error_mensaje TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_usuario_sync (id_usuario, sincronizado),
  INDEX idx_sincronizado (sincronizado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- PASO 5: TABLAS DE PRIVACIDAD
-- =====================================================
CREATE TABLE IF NOT EXISTS consentimientos (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  id_usuario INT NOT NULL,
  tipo_consentimiento VARCHAR(100) NOT NULL,
  version_documento VARCHAR(20) NOT NULL,
  aceptado TINYINT NOT NULL,
  ip_origen VARCHAR(45),
  aceptado_en DATETIME NOT NULL,
  revocado_en DATETIME,
  motivo_revocacion TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_usuario_tipo (id_usuario, tipo_consentimiento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS derechos_arco (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  id_usuario INT NOT NULL,
  tipo_solicitud ENUM('acceso', 'rectificacion', 'cancelacion', 'oposicion') NOT NULL,
  datos_solicitados JSON,
  motivo TEXT NOT NULL,
  estado ENUM('pendiente', 'en_proceso', 'completada', 'rechazada') DEFAULT 'pendiente',
  respuesta TEXT,
  respondido_por INT,
  respondido_en DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_usuario_solicitud (id_usuario, tipo_solicitud),
  INDEX idx_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS politica_retencion (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  id_institucion INT NOT NULL DEFAULT 1,
  tabla VARCHAR(100) NOT NULL,
  columna VARCHAR(100),
  tipo_dato ENUM('identificacion', 'contacto', 'academico', 'laboral', 'salud', 'psicologico', 'penal', 'financiero', 'otro') NOT NULL,
  nivel_sensibilidad ENUM('bajo', 'medio', 'alto', 'critico') NOT NULL DEFAULT 'bajo',
  retencion_dias INT NOT NULL,
  accion_fin_vida ENUM('eliminar', 'anonimizar', 'archivar') DEFAULT 'anonimizar',
  activa TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed políticas retención TESI (sin FK a instituciones para evitar constraint issues)
INSERT IGNORE INTO politica_retencion (id_institucion, tabla, columna, tipo_dato, nivel_sensibilidad, retencion_dias, accion_fin_vida)
VALUES
  (1, 'usuarios', 'nombres', 'identificacion', 'bajo', 1825, 'anonimizar'),
  (1, 'usuarios', 'correo_institucional', 'contacto', 'bajo', 1825, 'eliminar'),
  (1, 'alumnos', 'curp', 'identificacion', 'medio', 1825, 'anonimizar'),
  (1, 'alumnos', 'matricula', 'identificacion', 'bajo', 1825, 'archivar'),
  (1, 'kardex_historial_academico', 'calificacion', 'academico', 'bajo', 3650, 'anonimizar'),
  (1, 'evaluaciones', 'calificacion', 'academico', 'bajo', 3650, 'anonimizar'),
  (1, 'docente_salud_estudiantil', NULL, 'salud', 'critico', 365, 'eliminar'),
  (1, 'ia_bienestar_checkins', NULL, 'psicologico', 'alto', 730, 'eliminar'),
  (1, 'ia_bienestar_mensajes', NULL, 'psicologico', 'alto', 730, 'eliminar'),
  (1, 'ia_bienestar_alertas', NULL, 'psicologico', 'alto', 1095, 'anonimizar'),
  (1, 'ia_desercion_parciales', NULL, 'academico', 'medio', 1095, 'anonimizar'),
  (1, 'consentimientos', NULL, 'otro', 'medio', 1825, 'archivar'),
  (1, 'bitacora_auditoria', NULL, 'otro', 'bajo', 1825, 'archivar');

-- =====================================================
-- PASO 6: TABLAS DE IA
-- =====================================================
CREATE TABLE IF NOT EXISTS ia_prompts (
  id_prompt BIGINT PRIMARY KEY AUTO_INCREMENT,
  id_institucion INT NOT NULL,
  modulo VARCHAR(50) NOT NULL,
  rol VARCHAR(50),
  system_prompt LONGTEXT NOT NULL,
  sufijo_rol TEXT,
  idioma VARCHAR(10) DEFAULT 'es',
  activo TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_ia_prompt_inst_modulo_rol (id_institucion, modulo, rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS instituciones_features (
  id_feature BIGINT PRIMARY KEY AUTO_INCREMENT,
  id_institucion INT NOT NULL,
  feature_key VARCHAR(100) NOT NULL,
  habilitado TINYINT DEFAULT 1,
  config JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_feature_inst (id_institucion, feature_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seeds
INSERT IGNORE INTO instituciones_features (id_institucion, feature_key, habilitado)
VALUES
  (1, 'inscripciones', 1), (1, 'kardex', 1), (1, 'tramites', 1),
  (1, 'evaluaciones', 1), (1, 'ia_chatbot', 1), (1, 'ia_bienestar', 1),
  (1, 'ia_becas', 1), (1, 'ia_desercion', 1), (1, 'actas_ocr', 1),
  (1, 'reportes', 1), (1, 'bajas', 1), (1, 'derechos_autor', 1);

INSERT IGNORE INTO ia_prompts (id_institucion, modulo, rol, system_prompt, sufijo_rol)
VALUES
  (1, 'chatbot', NULL,
   'Eres el asistente virtual del Tecnológico de Estudios Superiores de Ixtapaluca (TESI). Ayuda con trámites académicos, inscripciones, kardex, evaluaciones y servicios.',
   'Responde de forma profesional y cordial.'),
  (1, 'chatbot', 'alumno',
   'Eres el asistente del TESI para alumnos. Ayuda con inscripciones, kardex, trámites, evaluaciones, becas.',
   'Usa un tono cercano y amigable.'),
  (1, 'chatbot', 'docente',
   'Eres el asistente del TESI para docentes. Ayuda con evaluaciones, grupos, actas, trámites.',
   'Usa un tono profesional.');

-- =====================================================
-- PASO 7: AGREGAR id_institucion A TABLAS ACADÉMICAS
-- Solo si la columna no existe (seguro para ejecutar múltiples veces)
-- =====================================================

-- Función auxiliar para agregar columna de forma segura
DELIMITER //

CREATE PROCEDURE IF NOT EXISTS add_institution_column(IN tableName VARCHAR(100), IN colPosition VARCHAR(100))
BEGIN
  SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tableName AND COLUMN_NAME = 'id_institucion');
  IF @col_exists = 0 THEN
    SET @sql = CONCAT('ALTER TABLE `', tableName, '` ADD COLUMN id_institucion INT DEFAULT 1');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //

DELIMITER ;

-- Catálogos académicos
CALL add_institution_column('carreras', 'id_carrera');
CALL add_institution_column('planes_estudio', 'id_plan');
CALL add_institution_column('periodos', 'id_periodo');
CALL add_institution_column('materias', 'id_materia');

-- Alumnos y docentes
CALL add_institution_column('alumnos', 'id_alumno');
CALL add_institution_column('docentes', 'id_docente');

-- Grupos y cargas
CALL add_institution_column('grupos', 'id_grupo');
CALL add_institution_column('grupos_alumnos', 'id');
CALL add_institution_column('cargas_academicas', 'id_carga');

-- Inscripciones y reinscripciones
CALL add_institution_column('inscripciones', 'id_inscripcion');
CALL add_institution_column('reinscripciones', 'id_reinscripcion');

-- Kardex
CALL add_institution_column('kardex_alumno', 'id_kardex');
CALL add_institution_column('kardex_historial_academico', 'id_historial');
CALL add_institution_column('kardex_auditoria', 'id_auditoria');
CALL add_institution_column('kardex_sellos', 'id_sello');
CALL add_institution_column('kardex_grupo_qr', 'id');

-- Evaluaciones
CALL add_institution_column('evaluaciones', 'id_evaluacion');
CALL add_institution_column('evaluacion_plantillas', 'id_plantilla');
CALL add_institution_column('evaluacion_plantilla_preguntas', 'id_pregunta');
CALL add_institution_column('evaluacion_resultados', 'id_resultado');
CALL add_institution_column('respuestas_evaluacion', 'id_respuesta');
CALL add_institution_column('evaluacion_auditoria', 'id_auditoria');
CALL add_institution_column('evaluacion_preguntas', 'id_pregunta');
CALL add_institution_column('evaluacion_log_errores', 'id_log');
CALL add_institution_column('evaluacion_exportaciones', 'id_exportacion');
CALL add_institution_column('evaluacion_alertas', 'id_alerta');

-- Trámites
CALL add_institution_column('tramites', 'id_tramite');
CALL add_institution_column('tramites_tipos', 'id_tipo');
CALL add_institution_column('tramites_configuracion', 'id_configuracion');
CALL add_institution_column('tramites_documentos', 'id_documento');
CALL add_institution_column('tramites_historial_estados', 'id_historial');
CALL add_institution_column('tramites_observaciones', 'id_observacion');
CALL add_institution_column('tramites_auditoria', 'id_auditoria');

-- Chatbot e IA
CALL add_institution_column('chatbot_configuracion', 'id_configuracion');
CALL add_institution_column('chatbot_mensajes', 'id_mensaje');
CALL add_institution_column('chatbot_auditoria', 'id_auditoria');
CALL add_institution_column('chatbot_incidencias', 'id_incidencia');

-- IA Deserción
CALL add_institution_column('ia_alertas_desercion', 'id_alerta');
CALL add_institution_column('ia_desercion_parciales', 'id_parcial');
CALL add_institution_column('ia_auditoria_desercion', 'id_auditoria');
CALL add_institution_column('ia_seguimientos_desercion', 'id_seguimiento');

-- IA Bienestar
CALL add_institution_column('ia_bienestar_sesiones', 'id_sesion');
CALL add_institution_column('ia_bienestar_checkins', 'id_checkin');
CALL add_institution_column('ia_bienestar_mensajes', 'id_mensaje');
CALL add_institution_column('ia_bienestar_alertas', 'id_alerta');
CALL add_institution_column('ia_bienestar_derivaciones', 'id_derivacion');
CALL add_institution_column('ia_bienestar_plantillas', 'id_plantilla');
CALL add_institution_column('ia_bienestar_plantilla_preguntas', 'id_pregunta');
CALL add_institution_column('ia_bienestar_recursos', 'id_recurso');

-- IA Becas
CALL add_institution_column('ia_becas_convocatorias', 'id_convocatoria');
CALL add_institution_column('ia_becas_solicitudes', 'id_solicitud');
CALL add_institution_column('ia_becas_auditoria', 'id_auditoria');
CALL add_institution_column('ia_becas_canalizaciones', 'id_canalizacion');
CALL add_institution_column('ia_becas_dictamenes', 'id_dictamen');
CALL add_institution_column('ia_becas_documentos', 'id_documento');
CALL add_institution_column('ia_becas_exportaciones', 'id_exportacion');
CALL add_institution_column('ia_becas_observaciones', 'id_observacion');

-- Actas OCR
CALL add_institution_column('actas_ocr_configuracion', 'id_configuracion');
CALL add_institution_column('actas_ocr_cargas', 'id_carga');
CALL add_institution_column('actas_ocr_detalles', 'id_detalle');
CALL add_institution_column('actas_ocr_plantillas', 'id_plantilla');
CALL add_institution_column('actas_ocr_validaciones', 'id_validacion');
CALL add_institution_column('actas_ocr_auditoria', 'id_auditoria');
CALL add_institution_column('actas_calificaciones', 'id_calificacion');
CALL add_institution_column('actas_calificaciones_detalle', 'id_detalle');

-- Asistente
CALL add_institution_column('asistente_sesiones', 'id_sesion');
CALL add_institution_column('asistente_mensajes', 'id_mensaje');
CALL add_institution_column('asistente_contenidos', 'id_contenido');
CALL add_institution_column('asistente_auditoria', 'id_auditoria');

-- Docente específico
CALL add_institution_column('docente_actividades_extracurriculares', 'id_actividad');
CALL add_institution_column('docente_asistencias', 'id_asistencia');
CALL add_institution_column('docente_beca_extranjero', 'id_beca');
CALL add_institution_column('docente_convenios_empresariales', 'id_convenio');
CALL add_institution_column('docente_creditos_complementarios', 'id_credito');
CALL add_institution_column('docente_idiomas', 'id_idioma');
CALL add_institution_column('docente_notificaciones_reinscripcion', 'id_notificacion');
CALL add_institution_column('docente_query_log', 'id_log');
CALL add_institution_column('docente_reinscripcion_resumen', 'id_resumen');
CALL add_institution_column('docente_residencia_profesional', 'id_residencia');
CALL add_institution_column('docente_salud_estudiantil', 'id_registro');
CALL add_institution_column('docente_segundas_oportunidades', 'id_oportunidad');
CALL add_institution_column('docente_servicio_social', 'id_servicio');
CALL add_institution_column('docente_titulacion', 'id_titulacion');
CALL add_institution_column('docentes_firmas_registradas', 'id_firma');

-- Soporte
CALL add_institution_column('soporte_kardex_incidencias', 'id_incidencia');
CALL add_institution_column('soporte_tramites_archivos', 'id_archivo');
CALL add_institution_column('soporte_tramites_incidencias', 'id_incidencia');
CALL add_institution_column('soporte_tramites_logs', 'id_log');
CALL add_institution_column('soporte_tramites_monitoreo', 'id_monitoreo');
CALL add_institution_column('soporte_tramites_recuperacion', 'id_recuperacion');
CALL add_institution_column('soporte_reinscripciones_incidencias', 'id_incidencia');
CALL add_institution_column('soporte_reinscripciones_logs', 'id_log');
CALL add_institution_column('soporte_reinscripciones_monitoreo', 'id_monitoreo');
CALL add_institution_column('incidencias_soporte', 'id_incidencia');
CALL add_institution_column('logs_soporte_inscripciones', 'id_log');

-- Auditoría y otros
CALL add_institution_column('bitacora_auditoria', 'id_auditoria');
CALL add_institution_column('inscripciones_auditoria', 'id_auditoria');
CALL add_institution_column('reinscripcion_auditoria', 'id_auditoria');
CALL add_institution_column('reinscripcion_requisitos', 'id_requisito');
CALL add_institution_column('notificaciones_docente', 'id_notificacion');
CALL add_institution_column('cadena_documental', 'id_documento');
CALL add_institution_column('aceptaciones_legales', 'id_aceptacion');
CALL add_institution_column('auditoria_global', 'id_auditoria');

-- Limpiar procedimiento
DROP PROCEDURE IF EXISTS add_institution_column;

-- =====================================================
-- PASO 8: ÍNDICES PARA PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_alumno_institucion ON alumnos(id_institucion);
CREATE INDEX IF NOT EXISTS idx_docente_institucion ON docentes(id_institucion);
CREATE INDEX IF NOT EXISTS idx_grupo_institucion ON grupos(id_institucion);
CREATE INDEX IF NOT EXISTS idx_inscripcion_institucion ON inscripciones(id_institucion);
CREATE INDEX IF NOT EXISTS idx_reinscripcion_institucion ON reinscripciones(id_institucion);
CREATE INDEX IF NOT EXISTS idx_kardex_institucion ON kardex_alumno(id_institucion);
CREATE INDEX IF NOT EXISTS idx_evaluacion_institucion ON evaluaciones(id_institucion);
CREATE INDEX IF NOT EXISTS idx_tramite_institucion ON tramites(id_institucion);
CREATE INDEX IF NOT EXISTS idx_chatbot_msg_institucion ON chatbot_mensajes(id_institucion);
CREATE INDEX IF NOT EXISTS idx_ia_desercion_institucion ON ia_alertas_desercion(id_institucion);
CREATE INDEX IF NOT EXISTS idx_ia_bienestar_institucion ON ia_bienestar_sesiones(id_institucion);
CREATE INDEX IF NOT EXISTS idx_ia_becas_institucion ON ia_becas_solicitudes(id_institucion);
CREATE INDEX IF NOT EXISTS idx_bitacora_institucion ON bitacora_auditoria(id_institucion);
