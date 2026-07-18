-- =========================================================
-- MIGRACIÓN COMPLETA DEL SISTEMA SIVACAD
-- Corrige tablas, columnas y relaciones faltantes
-- Ejecución segura (idempotente) con IF NOT EXISTS / IF EXISTS
-- =========================================================

USE sivacad_isc;
START TRANSACTION;

-- =========================================================
-- 1. COLUMNAS FALTANTES EN inscripciones
-- =========================================================
ALTER TABLE inscripciones
  ADD COLUMN IF NOT EXISTS motivo_rechazo VARCHAR(500) NULL AFTER observaciones,
  ADD COLUMN IF NOT EXISTS comprobante_pago VARCHAR(500) NULL AFTER motivo_rechazo,
  ADD COLUMN IF NOT EXISTS fecha_comprobante DATETIME NULL AFTER comprobante_pago,
  ADD COLUMN IF NOT EXISTS id_carrera INT NULL AFTER id_periodo,
  ADD COLUMN IF NOT EXISTS id_grupo INT NULL AFTER id_carrera,
  ADD COLUMN IF NOT EXISTS actualizado_en DATETIME NULL AFTER observaciones,
  ADD COLUMN IF NOT EXISTS actualizado_por INT NULL AFTER actualizado_en,
  ADD COLUMN IF NOT EXISTS validada_por INT NULL AFTER actualizado_por,
  ADD COLUMN IF NOT EXISTS fecha_validacion DATETIME NULL AFTER validada_por,
  ADD COLUMN IF NOT EXISTS comprobante_reinscripcion VARCHAR(255) NULL AFTER comprobante_pago,
  ADD COLUMN IF NOT EXISTS fecha_comprobante_reinscripcion DATETIME NULL AFTER fecha_comprobante;

-- Llaves foráneas de inscripciones
ALTER TABLE inscripciones
  ADD INDEX IF NOT EXISTS idx_insc_carrera (id_carrera),
  ADD INDEX IF NOT EXISTS idx_insc_grupo (id_grupo),
  ADD INDEX IF NOT EXISTS idx_insc_actualizado (actualizado_por),
  ADD INDEX IF NOT EXISTS idx_insc_estado (estado),
  ADD INDEX IF NOT EXISTS idx_insc_tipo (tipo_inscripcion);

-- =========================================================
-- 2. COLUMNAS FALTANTES EN reinscripciones
-- =========================================================
ALTER TABLE reinscripciones
  ADD COLUMN IF NOT EXISTS fecha_solicitud DATETIME DEFAULT CURRENT_TIMESTAMP AFTER motivo,
  ADD COLUMN IF NOT EXISTS observaciones_alumno TEXT NULL AFTER fecha_validacion;

-- =========================================================
-- 3. TABLAS FALTANTES DE REINSCRIPCIONES
-- =========================================================
CREATE TABLE IF NOT EXISTS reinscripcion_requisitos (
    id_requisito BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_reinscripcion BIGINT NOT NULL,
    requisito VARCHAR(100) NOT NULL,
    cumplido TINYINT(1) DEFAULT 0,
    observaciones TEXT NULL,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_rreq_reinscripcion (id_reinscripcion),
    CONSTRAINT fk_rreq_reinscripcion
      FOREIGN KEY (id_reinscripcion) REFERENCES reinscripciones(id_reinscripcion)
      ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reinscripcion_auditoria (
    id_auditoria BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_reinscripcion BIGINT NULL,
    id_inscripcion BIGINT NULL,
    accion VARCHAR(50) NOT NULL,
    estado_anterior VARCHAR(50) NULL,
    estado_nuevo VARCHAR(50) NULL,
    detalle TEXT NULL,
    id_usuario INT NULL,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_raudit_reinscripcion (id_reinscripcion),
    KEY idx_raudit_inscripcion (id_inscripcion),
    CONSTRAINT fk_raudit_usuario
      FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
      ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 4. COLUMNAS FALTANTES EN ia_bienestar_sesiones
-- =========================================================
ALTER TABLE ia_bienestar_sesiones
  ADD COLUMN IF NOT EXISTS bienestar_score TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER nivel_riesgo_actual,
  ADD COLUMN IF NOT EXISTS indice_riesgo DECIMAL(4,2) NOT NULL DEFAULT 1.00 AFTER bienestar_score;

ALTER TABLE ia_bienestar_alertas
  MODIFY COLUMN tipo_alerta ENUM('RIESGO_BIENESTAR','CRISIS','ESCALAMIENTO_MANUAL','CRISIS_CHAT') NOT NULL DEFAULT 'RIESGO_BIENESTAR';

-- =========================================================
-- 5. TABLAS DE IA BIENESTAR (si no existen)
-- =========================================================
CREATE TABLE IF NOT EXISTS ia_bienestar_plantillas (
    id_plantilla BIGINT AUTO_INCREMENT PRIMARY KEY,
    codigo_plantilla VARCHAR(60) NOT NULL UNIQUE,
    nombre_plantilla VARCHAR(160) NOT NULL,
    descripcion TEXT NOT NULL,
    tipo_instrumento VARCHAR(80) NOT NULL DEFAULT 'BIENESTAR_GENERAL',
    publico_objetivo VARCHAR(80) NOT NULL DEFAULT 'ALUMNOS',
    escala VARCHAR(30) NOT NULL DEFAULT '1-5',
    ponderacion_total DECIMAL(6,2) NOT NULL DEFAULT 100.00,
    regla_oro TEXT NULL,
    prompt_base LONGTEXT NULL,
    estado ENUM('ACTIVA','INACTIVA') NOT NULL DEFAULT 'ACTIVA',
    orden_visual INT NOT NULL DEFAULT 1,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ia_bienestar_plantilla_preguntas (
    id_pregunta BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_plantilla BIGINT NOT NULL,
    codigo_pregunta VARCHAR(80) NOT NULL,
    criterio VARCHAR(180) NOT NULL,
    descripcion TEXT NULL,
    peso DECIMAL(6,2) NOT NULL DEFAULT 0,
    tipo_respuesta ENUM('NUMERICA','TEXTO') NOT NULL DEFAULT 'NUMERICA',
    min_valor TINYINT UNSIGNED NOT NULL DEFAULT 1,
    max_valor TINYINT UNSIGNED NOT NULL DEFAULT 5,
    orden_pregunta INT NOT NULL DEFAULT 1,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_bienestar_plantilla_pregunta (id_plantilla, codigo_pregunta),
    UNIQUE KEY uq_bienestar_plantilla_orden (id_plantilla, orden_pregunta),
    CONSTRAINT fk_bienestar_preguntas_plantilla
      FOREIGN KEY (id_plantilla) REFERENCES ia_bienestar_plantillas(id_plantilla)
      ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ia_bienestar_recursos (
    id_recurso BIGINT AUTO_INCREMENT PRIMARY KEY,
    codigo_recurso VARCHAR(80) NOT NULL UNIQUE,
    categoria VARCHAR(80) NOT NULL,
    tipo_recurso VARCHAR(60) NOT NULL DEFAULT 'TUTORIAL',
    titulo VARCHAR(180) NOT NULL,
    descripcion TEXT NOT NULL,
    telefono VARCHAR(40) NULL,
    url VARCHAR(255) NULL,
    orden_visual INT NOT NULL DEFAULT 1,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ia_bienestar_sesiones (
    id_sesion BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    perfil_usuario VARCHAR(80) NOT NULL,
    titulo VARCHAR(180) NOT NULL,
    objetivo VARCHAR(255) NOT NULL,
    estado ENUM('ACTIVA','CERRADA') NOT NULL DEFAULT 'ACTIVA',
    nivel_riesgo_actual ENUM('Bajo','Medio','Alto','Crítico') NOT NULL DEFAULT 'Bajo',
    bienestar_score TINYINT UNSIGNED NOT NULL DEFAULT 0,
    indice_riesgo DECIMAL(4,2) NOT NULL DEFAULT 1.00,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_bienestar_sesion_usuario (id_usuario, estado),
    CONSTRAINT fk_bienestar_sesiones_usuario
      FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
      ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ia_bienestar_checkins (
    id_checkin BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_sesion BIGINT NOT NULL,
    codigo_plantilla VARCHAR(60) NOT NULL,
    bienestar_score TINYINT UNSIGNED NOT NULL DEFAULT 0,
    indice_riesgo DECIMAL(4,2) NOT NULL DEFAULT 1.00,
    nivel_riesgo ENUM('Bajo','Medio','Alto','Crítico') NOT NULL DEFAULT 'Bajo',
    animo TINYINT UNSIGNED NULL,
    energia TINYINT UNSIGNED NULL,
    sueno TINYINT UNSIGNED NULL,
    estres TINYINT UNSIGNED NULL,
    apoyo TINYINT UNSIGNED NULL,
    ambiente TINYINT UNSIGNED NULL,
    carga_academica TINYINT UNSIGNED NULL,
    carga_laboral TINYINT UNSIGNED NULL,
    enfoque TINYINT UNSIGNED NULL,
    observaciones TEXT NULL,
    analisis_json JSON NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_bienestar_checkin_usuario (id_usuario, creado_en),
    INDEX idx_bienestar_checkin_sesion (id_sesion, creado_en),
    CONSTRAINT fk_bienestar_checkins_usuario
      FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
      ON DELETE CASCADE,
    CONSTRAINT fk_bienestar_checkins_sesion
      FOREIGN KEY (id_sesion) REFERENCES ia_bienestar_sesiones(id_sesion)
      ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ia_bienestar_mensajes (
    id_mensaje BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_sesion BIGINT NOT NULL,
    id_usuario INT NOT NULL,
    rol_mensaje ENUM('user','assistant','system') NOT NULL DEFAULT 'user',
    mensaje TEXT NOT NULL,
    nivel_riesgo ENUM('Bajo','Medio','Alto','Crítico') NOT NULL DEFAULT 'Bajo',
    metadata_json JSON NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_bienestar_mensaje_sesion (id_sesion, creado_en),
    CONSTRAINT fk_bienestar_mensajes_sesion
      FOREIGN KEY (id_sesion) REFERENCES ia_bienestar_sesiones(id_sesion)
      ON DELETE CASCADE,
    CONSTRAINT fk_bienestar_mensajes_usuario
      FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
      ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ia_bienestar_alertas (
    id_alerta BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_sesion BIGINT NULL,
    codigo_plantilla VARCHAR(60) NOT NULL,
    tipo_alerta ENUM('RIESGO_BIENESTAR','CRISIS','ESCALAMIENTO_MANUAL','CRISIS_CHAT') NOT NULL DEFAULT 'RIESGO_BIENESTAR',
    nivel_riesgo ENUM('Bajo','Medio','Alto','Crítico') NOT NULL DEFAULT 'Medio',
    descripcion TEXT NOT NULL,
    accion_sugerida TEXT NOT NULL,
    requiere_derivacion TINYINT(1) NOT NULL DEFAULT 0,
    estado ENUM('PENDIENTE','EN_REVISION','ATENDIDA','CERRADA') NOT NULL DEFAULT 'PENDIENTE',
    metadata_json JSON NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_bienestar_alerta_usuario (id_usuario, estado, creado_en),
    CONSTRAINT fk_bienestar_alertas_usuario
      FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
      ON DELETE CASCADE,
    CONSTRAINT fk_bienestar_alertas_sesion
      FOREIGN KEY (id_sesion) REFERENCES ia_bienestar_sesiones(id_sesion)
      ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ia_bienestar_derivaciones (
    id_derivacion BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_alerta BIGINT NOT NULL,
    id_usuario INT NOT NULL,
    destino VARCHAR(180) NOT NULL,
    motivo TEXT NOT NULL,
    estado ENUM('PENDIENTE','EN_CURSO','CERRADA') NOT NULL DEFAULT 'PENDIENTE',
    observaciones TEXT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_bienestar_derivacion_alerta (id_alerta, estado),
    CONSTRAINT fk_bienestar_derivaciones_alerta
      FOREIGN KEY (id_alerta) REFERENCES ia_bienestar_alertas(id_alerta)
      ON DELETE CASCADE,
    CONSTRAINT fk_bienestar_derivaciones_usuario
      FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
      ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 6. SEED DATA - Plantillas de bienestar (solo si están vacías)
-- =========================================================
INSERT IGNORE INTO ia_bienestar_plantillas
(codigo_plantilla, nombre_plantilla, descripcion, tipo_instrumento, publico_objetivo, escala, ponderacion_total, regla_oro, prompt_base, estado, orden_visual)
VALUES
('BIENESTAR_GENERAL', 'Bienestar general diario', 'Chequeo breve para revisar estado emocional, energía, sueño, apoyo y ambiente.', 'BIENESTAR_GENERAL', 'ALUMNOS', '1-5', 100.00, 'Este espacio acompaña, no diagnostica y no reemplaza atención profesional.', 'Actúa como un asistente de acompañamiento institucional, breve, cálido, motivador y práctico.', 'ACTIVA', 1),
('ACOMPAÑAMIENTO_ACADEMICO', 'Acompañamiento académico', 'Evalúa concentración, organización, motivación y carga académica para prevenir saturación.', 'ACOMPAÑAMIENTO_ACADEMICO', 'ALUMNOS', '1-5', 100.00, 'Este espacio acompaña, no diagnostica y no reemplaza atención profesional.', 'Actúa como un asistente de acompañamiento académico, práctico, claro y no clínico.', 'ACTIVA', 2),
('BIENESTAR_LABORAL', 'Bienestar laboral', 'Revisa carga laboral, límites de horario, pausas activas y clima de trabajo.', 'BIENESTAR_LABORAL', 'DOCENTES', '1-5', 100.00, 'Este espacio acompaña, no diagnostica y no reemplaza atención profesional.', 'Actúa como un asistente de acompañamiento laboral, breve, claro y orientado a acciones pequeñas.', 'ACTIVA', 3);

-- =========================================================
-- 7. SEED DATA - Preguntas por plantilla
-- =========================================================
INSERT IGNORE INTO ia_bienestar_plantilla_preguntas
(id_plantilla, codigo_pregunta, criterio, descripcion, peso, tipo_respuesta, min_valor, max_valor, orden_pregunta)
SELECT p.id_plantilla, q.codigo_pregunta, q.criterio, q.descripcion, q.peso, q.tipo_respuesta, q.min_valor, q.max_valor, q.orden_pregunta
FROM ia_bienestar_plantillas p
JOIN (
  SELECT 'BIENESTAR_GENERAL' AS codigo_plantilla, 'ANIMO_GENERAL' AS codigo_pregunta, 'Estado de ánimo' AS criterio, '¿Cómo te sientes emocionalmente hoy?' AS descripcion, 20 AS peso, 'NUMERICA' AS tipo_respuesta, 1 AS min_valor, 5 AS max_valor, 1 AS orden_pregunta
  UNION ALL SELECT 'BIENESTAR_GENERAL', 'ENERGIA_DIARIA', 'Energía diaria', '¿Qué nivel de energía tienes para tu día?', 20, 'NUMERICA', 1, 5, 2
  UNION ALL SELECT 'BIENESTAR_GENERAL', 'SUENO_QUALIDAD', 'Calidad del sueño', '¿Cómo fue tu descanso reciente?', 15, 'NUMERICA', 1, 5, 3
  UNION ALL SELECT 'BIENESTAR_GENERAL', 'ESTRES_GENERAL', 'Nivel de estrés', '¿Qué tan estresado/a te has sentido?', 15, 'NUMERICA', 1, 5, 4
  UNION ALL SELECT 'BIENESTAR_GENERAL', 'APOYO_RED', 'Apoyo cercano', '¿Sientes acompañamiento o apoyo de alguien de confianza?', 15, 'NUMERICA', 1, 5, 5
  UNION ALL SELECT 'BIENESTAR_GENERAL', 'ENTORNO_SEGURIDAD', 'Ambiente', '¿Tu entorno actual te ayuda a sentirte seguro/a y tranquilo/a?', 10, 'NUMERICA', 1, 5, 6
  UNION ALL SELECT 'BIENESTAR_GENERAL', 'OBSERVACION_GENERAL', 'Observación general', 'Escribe cualquier comentario adicional sobre tu estado de hoy.', 5, 'TEXTO', 1, 5, 7
  UNION ALL SELECT 'ACOMPAÑAMIENTO_ACADEMICO', 'CONCENTRACION', 'Concentración', '¿Qué tan bien te concentras en tus actividades académicas?', 20, 'NUMERICA', 1, 5, 1
  UNION ALL SELECT 'ACOMPAÑAMIENTO_ACADEMICO', 'ORGANIZACION', 'Organización', '¿Qué tan ordenado/a te sientes para estudiar o entregar tareas?', 20, 'NUMERICA', 1, 5, 2
  UNION ALL SELECT 'ACOMPAÑAMIENTO_ACADEMICO', 'MOTIVACION', 'Motivación', '¿Qué nivel de motivación tienes para seguir avanzando?', 20, 'NUMERICA', 1, 5, 3
  UNION ALL SELECT 'ACOMPAÑAMIENTO_ACADEMICO', 'CARGA_ACADEMICA', 'Carga académica', '¿Qué tan pesada sientes tu carga académica?', 15, 'NUMERICA', 1, 5, 4
  UNION ALL SELECT 'ACOMPAÑAMIENTO_ACADEMICO', 'RETROALIMENTACION', 'Retroalimentación', '¿Sientes que recibes retroalimentación útil para mejorar?', 15, 'NUMERICA', 1, 5, 5
  UNION ALL SELECT 'ACOMPAÑAMIENTO_ACADEMICO', 'OBSERVACION_GENERAL', 'Observación general', 'Describe una dificultad o apoyo que te ayudaría hoy.', 10, 'TEXTO', 1, 5, 6
  UNION ALL SELECT 'BIENESTAR_LABORAL', 'PAUSAS_ACTIVAS', 'Pausas activas', '¿Qué tan presentes están tus pausas y descansos durante la jornada?', 20, 'NUMERICA', 1, 5, 1
  UNION ALL SELECT 'BIENESTAR_LABORAL', 'CLIMA_LABORAL', 'Clima laboral', '¿Cómo percibes el ambiente de trabajo?', 20, 'NUMERICA', 1, 5, 2
  UNION ALL SELECT 'BIENESTAR_LABORAL', 'BALANCE_VIDA', 'Balance vida-trabajo', '¿Qué tan balanceada sientes tu jornada?', 20, 'NUMERICA', 1, 5, 3
  UNION ALL SELECT 'BIENESTAR_LABORAL', 'LIMITES_HORARIO', 'Límites de horario', '¿Qué tan claros están tus límites de tiempo y descanso?', 15, 'NUMERICA', 1, 5, 4
  UNION ALL SELECT 'BIENESTAR_LABORAL', 'CARGA_LABORAL', 'Carga laboral', '¿Qué tan pesada sientes tu carga laboral?', 15, 'NUMERICA', 1, 5, 5
  UNION ALL SELECT 'BIENESTAR_LABORAL', 'OBSERVACION_GENERAL', 'Observación general', 'Escribe un comentario breve sobre tu acompañamiento laboral.', 10, 'TEXTO', 1, 5, 6
) q ON q.codigo_plantilla = p.codigo_plantilla
WHERE NOT EXISTS (
  SELECT 1 FROM ia_bienestar_plantilla_preguntas ep
  WHERE ep.id_plantilla = p.id_plantilla AND ep.codigo_pregunta = q.codigo_pregunta
);

-- =========================================================
-- 8. SEED DATA - Recursos de apoyo
-- =========================================================
INSERT IGNORE INTO ia_bienestar_recursos
(codigo_recurso, categoria, tipo_recurso, titulo, descripcion, telefono, url, orden_visual, activo)
VALUES
('TUTORIAL_RESPIRACION', 'emocional', 'TUTORIAL', 'Respiración 4-4-6', 'Inhala 4 segundos, sostén 4 y exhala 6. Repite 6 veces.', NULL, NULL, 1, 1),
('TUTORIAL_PAUSA', 'emocional', 'EJERCICIO', 'Pausa de reconexión', 'Bebe agua, estira el cuerpo y vuelve con una meta pequeña.', NULL, NULL, 2, 1),
('TUTORIAL_ESTUDIO', 'academico', 'TUTORIAL', 'Plan en bloques', 'Trabaja 25 minutos y descansa 5. Divide tareas en pasos concretos.', NULL, NULL, 3, 1),
('TUTORIAL_PRIORIDAD', 'academico', 'EJERCICIO', 'Prioridad académica', 'Atiende primero lo urgente y lo que desbloquea tu avance.', NULL, NULL, 4, 1),
('TUTORIAL_LABORAL', 'laboral', 'TUTORIAL', 'Límites de horario', 'Cierra la jornada con una hora de corte y pendientes realistas.', NULL, NULL, 5, 1),
('TUTORIAL_PAUSA_ACTIVA', 'laboral', 'EJERCICIO', 'Pausa activa', 'Camina 3 minutos, respira lento y retoma con foco renovado.', NULL, NULL, 6, 1),
('CONTACTO_LV', 'crisis', 'CONTACTO', 'Línea de la Vida', 'Apoyo emocional 24/7, gratuito y confidencial para crisis y pensamientos suicidas.', '800 911 2000', NULL, 7, 1),
('CONTACTO_EMERGENCIA', 'crisis', 'CONTACTO', 'Emergencia inmediata', 'Si hay peligro inmediato, llama a emergencias de tu zona.', '911', NULL, 8, 1);

-- =========================================================
-- 9. SESIONES INICIALES para usuarios sin sesión
-- =========================================================
INSERT IGNORE INTO ia_bienestar_sesiones
(id_usuario, perfil_usuario, titulo, objetivo, estado, nivel_riesgo_actual)
SELECT u.id_usuario, 'Institucional', 'Sesión inicial de acompañamiento', 'Acompañamiento preventivo y seguimiento', 'ACTIVA', 'Bajo'
FROM usuarios u
WHERE NOT EXISTS (
  SELECT 1 FROM ia_bienestar_sesiones s WHERE s.id_usuario = u.id_usuario
);

COMMIT;
