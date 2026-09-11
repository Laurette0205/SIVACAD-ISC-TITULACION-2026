-- =====================================================
-- MIGRACIÓN 003: MULTI-INSTITUCIÓN
-- Fecha: 2026-09-09
-- Descripción: Tablas de instituciones, configuración
--              y seeds para TESI (id=1)
-- =====================================================

-- =====================================================
-- 1. TABLA instituciones
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

-- =====================================================
-- 2. TABLA ia_prompts (prompts de IA por institución)
-- =====================================================
CREATE TABLE IF NOT EXISTS ia_prompts (
  id_prompt BIGINT PRIMARY KEY AUTO_INCREMENT,
  id_institucion INT NOT NULL,
  modulo VARCHAR(50) NOT NULL COMMENT 'chatbot, asistente, becas, bienestar, desercion, actas_ocr',
  rol VARCHAR(50) COMMENT 'alumno, docente, coordinador, admin, soporte, NULL=global',
  system_prompt LONGTEXT NOT NULL,
  sufijo_rol TEXT,
  idioma VARCHAR(10) DEFAULT 'es',
  activo TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion) ON DELETE CASCADE,
  UNIQUE KEY uk_ia_prompt_inst_modulo_rol (id_institucion, modulo, rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 3. TABLA instituciones_features (habilitar/deshabilitar módulos)
-- =====================================================
CREATE TABLE IF NOT EXISTS instituciones_features (
  id_feature BIGINT PRIMARY KEY AUTO_INCREMENT,
  id_institucion INT NOT NULL,
  feature_key VARCHAR(100) NOT NULL COMMENT 'inscripciones, kardex, tramites, evaluaciones, ia_chatbot, ia_bienestar, ia_becas, ia_desercion, actas_ocr',
  habilitado TINYINT DEFAULT 1,
  config JSON COMMENT 'Configuración extra del feature',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion) ON DELETE CASCADE,
  UNIQUE KEY uk_feature_inst (id_institucion, feature_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 4. AGREGAR id_institucion A usuarios
-- =====================================================
ALTER TABLE usuarios
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_rol;

ALTER TABLE usuarios
  ADD CONSTRAINT fk_usuario_institucion
  FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

-- =====================================================
-- 5. SEED: TESI (id=1)
-- =====================================================
INSERT INTO instituciones
  (id_institucion, nombre_corto, nombre_completo, nombre_legal, dominios_email, logo_url, color_primario, color_secundario, telefono_crisis, frontend_url, formato_matricula, formato_folio_tramite)
VALUES
  (1,
   'TESI',
   'Tecnológico de Estudios Superiores de Ixtapaluca',
   'Tecnológico de Estudios Superiores de Ixtapaluca (TESI)',
   '["tesi.edu.mx", "ixtapaluca.tecnm.mx", "ixtapaluca.tecnm.edu.mx", "outlook.com", "outlook.es"]',
   NULL,
   '#1a56db',
   '#1e40af',
   NULL,
   'http://localhost:5173',
   'ISC-{YYYY}-{NNN}',
   'TRM-{YYYY}-{NNN}')
ON DUPLICATE KEY UPDATE nombre_corto = VALUES(nombre_corto);

-- =====================================================
-- 6. SEED: Features de TESI (todos habilitados)
-- =====================================================
INSERT INTO instituciones_features (id_institucion, feature_key, habilitado)
VALUES
  (1, 'inscripciones', 1),
  (1, 'kardex', 1),
  (1, 'tramites', 1),
  (1, 'evaluaciones', 1),
  (1, 'ia_chatbot', 1),
  (1, 'ia_bienestar', 1),
  (1, 'ia_becas', 1),
  (1, 'ia_desercion', 1),
  (1, 'actas_ocr', 1),
  (1, 'reportes', 1),
  (1, 'bajas', 1),
  (1, 'derechos_autor', 1)
ON DUPLICATE KEY UPDATE habilitado = VALUES(habilitado);

-- =====================================================
-- 7. SEED: Prompts de IA de TESI (chatbot global)
-- =====================================================
INSERT INTO ia_prompts (id_institucion, modulo, rol, system_prompt, sufijo_rol)
VALUES
  (1, 'chatbot', NULL,
   'Eres el asistente virtual del Tecnológico de Estudios Superiores de Ixtapaluca (TESI). Tu función es ayudar a alumnos, docentes y personal con consultas sobre trámites académicos, inscripciones, kardex, evaluaciones y servicios del instituto. Responde de forma clara, amable y profesional. Si no conoces la respuesta, indica que debe contactar al departamento correspondiente.',
   'Responde siempre de forma profesional y utiliza un tono cordial. Si el usuario consulta sobre un trámite específico, indica los pasos generales y sugiere acudir al departamento responsable.'),
  (1, 'chatbot', 'alumno',
   'Eres el asistente virtual del TESI orientado a alumnos. Ayuda con consultas sobre inscripciones, kardex, trámites, evaluaciones, becas y servicios estudiantiles. Sé amable y usa lenguaje accesible.',
   'Utiliza un tono cercano y amigable. Si el alumno pregunta por su kardex o calificaciones, sugiere verificar su estatus en el sistema.'),
  (1, 'chatbot', 'docente',
   'Eres el asistente virtual del TESI orientado a docentes. Ayuda con consultas sobre evaluaciones, grupos, actas, trámites docentes y herramientas del sistema. Sé profesional y conciso.',
   'Utiliza un tono profesional y técnico. Si el docente necesita funciones avanzadas, sugiere contactar a soporte técnico.'),
  (1, 'chatbot', 'coordinador',
   'Eres el asistente virtual del TESI orientado a coordinadores. Ayuda con supervisión de inscripciones, reportes, kardex grupal, evaluaciones y gestión académica.',
   'Proporciona información detallada sobre reportes y herramientas de supervisión disponibles para coordinadores.'),
  (1, 'chatbot', 'soporte',
   'Eres el asistente virtual del TESI orientado a soporte técnico. Ayuda con incidencias del sistema, configuración, resolución de problemas técnicos y gestión de usuarios.',
   'Proporciona pasos específicos de resolución y, si es necesario, escala a ingeniería de soporte.')
ON DUPLICATE KEY UPDATE system_prompt = VALUES(system_prompt);
