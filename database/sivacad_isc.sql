DROP DATABASE IF EXISTS sivacad_isc;
CREATE DATABASE IF NOT EXISTS sivacad_isc CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sivacad_isc;

-- =========================================================
-- 1. ROLES
-- =========================================================
CREATE TABLE IF NOT EXISTS roles (
    id_rol INT AUTO_INCREMENT PRIMARY KEY,
    nombre_rol VARCHAR(50) NOT NULL UNIQUE,
    descripcion VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO roles (nombre_rol, descripcion) VALUES
('administrador', 'Control total'),
('coordinador', 'Consulta y seguimiento'),
('docente', 'Gestión académica'),
('alumno', 'Consulta y evaluación'),
('soporte', 'Mantenimiento técnico');

-- =========================================================
-- 2. CARRERAS
-- =========================================================
CREATE TABLE IF NOT EXISTS carreras (
    id_carrera INT AUTO_INCREMENT PRIMARY KEY,
    nombre_carrera VARCHAR(180) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO carreras (nombre_carrera)
VALUES ('Ingeniería en Sistemas Computacionales');

-- =========================================================
-- 3. PLANES DE ESTUDIO
-- =========================================================
CREATE TABLE IF NOT EXISTS planes_estudio (
    id_plan INT AUTO_INCREMENT PRIMARY KEY,
    id_carrera INT NOT NULL,
    nombre_plan VARCHAR(180) NOT NULL,
    version_plan VARCHAR(30) NOT NULL,
    UNIQUE KEY uq_plan_estudio (id_carrera, nombre_plan, version_plan),
    CONSTRAINT fk_planes_carrera
      FOREIGN KEY (id_carrera) REFERENCES carreras(id_carrera)
      ON DELETE RESTRICT
      ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO planes_estudio (id_carrera, nombre_plan, version_plan)
SELECT c.id_carrera, 'Plan ISC 2026', '2026-A'
FROM carreras c
WHERE c.nombre_carrera = 'Ingeniería en Sistemas Computacionales';

-- =========================================================
-- 4. PERIODOS
-- =========================================================
CREATE TABLE IF NOT EXISTS periodos (
    id_periodo INT AUTO_INCREMENT PRIMARY KEY,
    nombre_periodo VARCHAR(100) NOT NULL UNIQUE,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    estado ENUM('Planeado','Activo','Cerrado') DEFAULT 'Planeado'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO periodos (nombre_periodo, fecha_inicio, fecha_fin, estado)
VALUES ('2026-1', '2026-01-01', '2026-06-30', 'Activo');

-- =========================================================
-- 5. USUARIOS
-- =========================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nombres VARCHAR(120) NOT NULL,
    apellido_paterno VARCHAR(160) NOT NULL,
    apellido_materno VARCHAR(160) NOT NULL,
    correo_institucional VARCHAR(150) NOT NULL UNIQUE,
    contrasena_hash VARCHAR(255) NOT NULL,
    estado ENUM('Activo','Inactivo','Bloqueado') DEFAULT 'Activo',
    ultimo_acceso DATETIME NULL,
    id_rol INT NOT NULL,
    CONSTRAINT fk_usuarios_roles
      FOREIGN KEY (id_rol) REFERENCES roles(id_rol)
      ON DELETE RESTRICT
      ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 6. ALUMNOS
-- =========================================================
CREATE TABLE IF NOT EXISTS alumnos (
    id_alumno INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL UNIQUE,
    apellido_paterno VARCHAR(160) NOT NULL,
    apellido_materno VARCHAR(160) NOT NULL,
    nombres VARCHAR(120) NOT NULL,
    matricula VARCHAR(30) NOT NULL UNIQUE,
    curp VARCHAR(18),
    id_carrera INT NOT NULL,
    id_plan INT NOT NULL,
    semestre_actual TINYINT UNSIGNED DEFAULT 1,
    fotografia VARCHAR(255),
    estatus_academico ENUM('Regular','Irregular','Egresado','Baja_Temporal','Baja_Definitiva') DEFAULT 'Regular',
    KEY idx_alumnos_matricula (matricula),
    CONSTRAINT fk_alumnos_usuario
      FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
      ON DELETE CASCADE
      ON UPDATE CASCADE,
    CONSTRAINT fk_alumnos_carrera
      FOREIGN KEY (id_carrera) REFERENCES carreras(id_carrera)
      ON DELETE RESTRICT
      ON UPDATE CASCADE,
    CONSTRAINT fk_alumnos_plan
      FOREIGN KEY (id_plan) REFERENCES planes_estudio(id_plan)
      ON DELETE RESTRICT
      ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 7. DOCENTES
-- =========================================================
CREATE TABLE IF NOT EXISTS docentes (
    id_docente INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL UNIQUE,
    clave_docente VARCHAR(30) NOT NULL UNIQUE,
    numero_empleado VARCHAR(40),
    especialidad VARCHAR(180),
    fotografia VARCHAR(255),
    estatus ENUM('Activo','Inactivo') DEFAULT 'Activo',
    CONSTRAINT fk_docentes_usuario
      FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
      ON DELETE CASCADE
      ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 8. GRUPOS
-- =========================================================
CREATE TABLE IF NOT EXISTS grupos (
    id_grupo INT AUTO_INCREMENT PRIMARY KEY,
    id_periodo INT NOT NULL,
    id_carrera INT NOT NULL,
    nombre_grupo VARCHAR(30) NOT NULL,
    semestre TINYINT UNSIGNED NOT NULL,
    turno ENUM('Matutino','Vespertino','Discontinuo') DEFAULT 'Matutino',
    estado ENUM('Abierto','Cerrado','Cancelado') DEFAULT 'Abierto',
    UNIQUE KEY uq_grupo_seed (id_periodo, id_carrera, nombre_grupo, semestre, turno),
    CONSTRAINT fk_grupos_periodo
      FOREIGN KEY (id_periodo) REFERENCES periodos(id_periodo)
      ON DELETE RESTRICT
      ON UPDATE CASCADE,
    CONSTRAINT fk_grupos_carrera
      FOREIGN KEY (id_carrera) REFERENCES carreras(id_carrera)
      ON DELETE RESTRICT
      ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO grupos (id_periodo, id_carrera, nombre_grupo, semestre, turno, estado)
SELECT pe.id_periodo, c.id_carrera, 'A', 1, 'Matutino', 'Abierto'
FROM periodos pe
JOIN carreras c ON c.nombre_carrera = 'Ingeniería en Sistemas Computacionales'
WHERE pe.nombre_periodo = '2026-1';

-- =========================================================
-- 9. MATERIAS
-- =========================================================
CREATE TABLE IF NOT EXISTS materias (
    id_materia INT AUTO_INCREMENT PRIMARY KEY,
    clave_materia VARCHAR(30) NOT NULL UNIQUE,
    nombre_materia VARCHAR(180) NOT NULL,
    creditos TINYINT UNSIGNED DEFAULT 0,
    semestre_sugerido TINYINT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO materias (clave_materia, nombre_materia, creditos, semestre_sugerido) VALUES
('ISC-101', 'Fundamentos de Programación', 6, 1),
('ISC-102', 'Matemáticas para Computación', 6, 1),
('ISC-103', 'Desarrollo Web', 6, 2);

-- =========================================================
-- 10. INSCRIPCIONES
-- =========================================================
CREATE TABLE IF NOT EXISTS inscripciones (
    id_inscripcion BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_alumno INT NOT NULL,
    id_periodo INT NOT NULL,
    fecha_inscripcion DATETIME DEFAULT CURRENT_TIMESTAMP,
    tipo_inscripcion ENUM('Primera_Vez','Reinscripcion') DEFAULT 'Primera_Vez',
    estado ENUM('Pendiente','Validada','Rechazada','Cancelada') DEFAULT 'Pendiente',
    observaciones TEXT,
    KEY idx_inscripciones_alumno_periodo (id_alumno, id_periodo),
    CONSTRAINT fk_inscripciones_alumno
      FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno)
      ON DELETE CASCADE
      ON UPDATE CASCADE,
    CONSTRAINT fk_inscripciones_periodo
      FOREIGN KEY (id_periodo) REFERENCES periodos(id_periodo)
      ON DELETE RESTRICT
      ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 11. REINSCRIPCIONES
-- =========================================================
CREATE TABLE IF NOT EXISTS reinscripciones (
    id_reinscripcion BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_inscripcion BIGINT NOT NULL UNIQUE,
    motivo VARCHAR(255),
    validada_por INT NULL,
    fecha_validacion DATETIME NULL,
    KEY idx_reinscripciones_inscripcion (id_inscripcion),
    CONSTRAINT fk_reinscripciones_inscripcion
      FOREIGN KEY (id_inscripcion) REFERENCES inscripciones(id_inscripcion)
      ON DELETE CASCADE
      ON UPDATE CASCADE,
    CONSTRAINT fk_reinscripciones_validada_por
      FOREIGN KEY (validada_por) REFERENCES usuarios(id_usuario)
      ON DELETE SET NULL
      ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 12. KARDEX ALUMNO
-- =========================================================
CREATE TABLE IF NOT EXISTS kardex_alumno (
    id_kardex BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_alumno INT NOT NULL UNIQUE,
    numero_control VARCHAR(30),
    foto_alumno VARCHAR(255),
    foto_institucional VARCHAR(255) NULL,
    foto_autorizada_por INT NULL,
    foto_autorizada_en DATETIME NULL,
    promedio_general DECIMAL(5,2) DEFAULT 0.00,
    creditos_acumulados SMALLINT UNSIGNED DEFAULT 0,
    estatus ENUM('Vigente','Egresado','Baja') DEFAULT 'Vigente',
    qr_token VARCHAR(255) NOT NULL UNIQUE,
    url_qr VARCHAR(255),
    firma_electronica TEXT NULL,
    folio_kardex VARCHAR(50) NULL UNIQUE,
    ultima_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    actualizado_por INT NULL,
    CONSTRAINT fk_kardex_alumno
      FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno)
      ON DELETE CASCADE
      ON UPDATE CASCADE,
    CONSTRAINT fk_kardex_foto_autorizada
      FOREIGN KEY (foto_autorizada_por) REFERENCES usuarios(id_usuario)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_kardex_actualizado_por
      FOREIGN KEY (actualizado_por) REFERENCES usuarios(id_usuario)
      ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 13. KARDEX GRUPO QR
-- =========================================================
CREATE TABLE IF NOT EXISTS kardex_grupo_qr (
    id_kardex_grupo BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_grupo INT NOT NULL,
    id_periodo INT NOT NULL,
    qr_token VARCHAR(255) NOT NULL UNIQUE,
    url_qr VARCHAR(255),
    generado_por INT NOT NULL,
    UNIQUE KEY uq_grupo_periodo (id_grupo, id_periodo),
    CONSTRAINT fk_kardex_grupo_grupo
      FOREIGN KEY (id_grupo) REFERENCES grupos(id_grupo)
      ON DELETE CASCADE
      ON UPDATE CASCADE,
    CONSTRAINT fk_kardex_grupo_periodo
      FOREIGN KEY (id_periodo) REFERENCES periodos(id_periodo)
      ON DELETE RESTRICT
      ON UPDATE CASCADE,
    CONSTRAINT fk_kardex_grupo_usuario
      FOREIGN KEY (generado_por) REFERENCES usuarios(id_usuario)
      ON DELETE RESTRICT
      ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 14. CARGAS ACADÉMICAS (docentes asignados a grupos)
-- =========================================================
CREATE TABLE IF NOT EXISTS cargas_academicas (
  id_carga_academica BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_periodo INT NOT NULL,
  id_grupo INT NOT NULL,
  id_materia INT NOT NULL,
  id_docente INT NOT NULL,
  estado ENUM('ACTIVA', 'CERRADA', 'CANCELADA') NOT NULL DEFAULT 'ACTIVA',
  observaciones TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_carga_academica (id_periodo, id_grupo, id_materia, id_docente),
  CONSTRAINT fk_ca_periodo FOREIGN KEY (id_periodo) REFERENCES periodos(id_periodo),
  CONSTRAINT fk_ca_grupo FOREIGN KEY (id_grupo) REFERENCES grupos(id_grupo),
  CONSTRAINT fk_ca_materia FOREIGN KEY (id_materia) REFERENCES materias(id_materia),
  CONSTRAINT fk_ca_docente FOREIGN KEY (id_docente) REFERENCES docentes(id_docente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 15. GRUPOS ALUMNOS (alumnos inscritos en grupos)
-- =========================================================
CREATE TABLE IF NOT EXISTS grupos_alumnos (
  id_grupo_alumno BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_periodo INT NOT NULL,
  id_grupo INT NOT NULL,
  id_alumno INT NOT NULL,
  estado ENUM('ACTIVO', 'BAJA', 'TRANSFERIDO') NOT NULL DEFAULT 'ACTIVO',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_grupo_alumno (id_periodo, id_grupo, id_alumno),
  CONSTRAINT fk_ga_periodo FOREIGN KEY (id_periodo) REFERENCES periodos(id_periodo),
  CONSTRAINT fk_ga_grupo FOREIGN KEY (id_grupo) REFERENCES grupos(id_grupo),
  CONSTRAINT fk_ga_alumno FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 16. KARDEX HISTORIAL ACADÉMICO
-- =========================================================
CREATE TABLE IF NOT EXISTS kardex_historial_academico (
    id_historial BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_alumno INT NOT NULL,
    id_periodo INT NOT NULL,
    id_materia INT DEFAULT NULL,
    id_grupo INT DEFAULT NULL,
    calificacion DECIMAL(5,2) DEFAULT NULL,
    creditos DECIMAL(5,2) DEFAULT 0.00,
    tipo_materia ENUM('Ordinaria','Repeticion','Extraordinario','Especial') DEFAULT 'Ordinaria',
    estado ENUM('Cursando','Acreditada','No Acreditada','Exento') DEFAULT 'Cursando',
    observaciones TEXT DEFAULT NULL,
    registrado_por INT DEFAULT NULL,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_kha_alumno (id_alumno),
    KEY idx_kha_periodo (id_periodo),
    KEY fk_kha_materia (id_materia),
    KEY fk_kha_grupo (id_grupo),
    KEY fk_kha_registrado (registrado_por),
    CONSTRAINT fk_kha_alumno
      FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_kha_periodo
      FOREIGN KEY (id_periodo) REFERENCES periodos(id_periodo)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_kha_materia
      FOREIGN KEY (id_materia) REFERENCES materias(id_materia)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_kha_grupo
      FOREIGN KEY (id_grupo) REFERENCES grupos(id_grupo)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_kha_registrado
      FOREIGN KEY (registrado_por) REFERENCES usuarios(id_usuario)
      ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 17. KARDEX AUDITORÍA
-- =========================================================
CREATE TABLE IF NOT EXISTS kardex_auditoria (
    id_auditoria BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_kardex BIGINT DEFAULT NULL,
    id_alumno INT DEFAULT NULL,
    accion VARCHAR(50) NOT NULL,
    campo_modificado VARCHAR(100) DEFAULT NULL,
    valor_anterior TEXT DEFAULT NULL,
    valor_nuevo TEXT DEFAULT NULL,
    detalle TEXT DEFAULT NULL,
    id_usuario INT DEFAULT NULL,
    ip_origen VARCHAR(45) DEFAULT NULL,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_ka_kardex (id_kardex),
    KEY idx_ka_alumno (id_alumno),
    KEY idx_ka_accion (accion),
    KEY idx_ka_creado (creado_en),
    KEY fk_ka_usuario (id_usuario),
    CONSTRAINT fk_ka_kardex
      FOREIGN KEY (id_kardex) REFERENCES kardex_alumno(id_kardex)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_ka_alumno
      FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_ka_usuario
      FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
      ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 18. KARDEX SELLOS
-- =========================================================
CREATE TABLE IF NOT EXISTS kardex_sellos (
    id_sello BIGINT AUTO_INCREMENT PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL COMMENT 'sivacad,division_isc,control_escolar',
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT DEFAULT NULL,
    imagen_sello VARCHAR(255) DEFAULT NULL,
    activo TINYINT(1) DEFAULT 1,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY tipo (tipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO kardex_sellos (tipo, titulo, descripcion, activo) VALUES
('sivacad', 'SIVACAD', 'Sistema Integral de Validación y Control Académico', 1),
('division_isc', 'División de Ingeniería en Sistemas Computacionales', 'División ISC - TESI', 1),
('control_escolar', 'Control Escolar', 'Departamento de Control Escolar - TESI', 1);

-- =========================================================
-- 19. KARDEX SOPORTE - INCIDENCIAS TÉCNICAS
-- =========================================================
CREATE TABLE IF NOT EXISTS soporte_kardex_incidencias (
    id_incidencia BIGINT AUTO_INCREMENT PRIMARY KEY,
    tipo VARCHAR(100) NOT NULL,
    descripcion TEXT NOT NULL,
    modulo VARCHAR(50) DEFAULT 'KARDEX',
    nivel ENUM('BAJA', 'MEDIA', 'ALTA', 'CRITICA') DEFAULT 'MEDIA',
    estado ENUM('ABIERTA', 'EN_PROCESO', 'ATENDIDA', 'CERRADA') DEFAULT 'ABIERTA',
    solucion TEXT DEFAULT NULL,
    reportado_por INT DEFAULT NULL,
    atendido_por INT DEFAULT NULL,
    atendido_en DATETIME DEFAULT NULL,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_ski_estado (estado),
    KEY idx_ski_tipo (tipo),
    KEY idx_ski_modulo (modulo),
    CONSTRAINT fk_ski_reportado
      FOREIGN KEY (reportado_por) REFERENCES usuarios(id_usuario)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_ski_atendido
      FOREIGN KEY (atendido_por) REFERENCES usuarios(id_usuario)
      ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 20. TIPOS DE EVALUACIÓN
-- =========================================================
CREATE TABLE IF NOT EXISTS tipos_evaluacion (
    id_tipo_evaluacion INT AUTO_INCREMENT PRIMARY KEY,
    nombre_tipo VARCHAR(120) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO tipos_evaluacion (nombre_tipo) VALUES
('Alumno a Docente'),
('Docente a Alumno'),
('Alumno a Docente Retroalimentación'),
('Docente a Alumno Retroalimentación');

-- =========================================================
-- 20. PLANTILLAS DE EVALUACIÓN
-- =========================================================
CREATE TABLE IF NOT EXISTS evaluacion_plantillas (
    id_plantilla BIGINT AUTO_INCREMENT PRIMARY KEY,
    codigo_plantilla VARCHAR(50) NOT NULL UNIQUE,
    nombre_plantilla VARCHAR(180) NOT NULL,
    descripcion TEXT,
    tipo_instrumento ENUM(
      'DOCENTE_POR_ALUMNOS',
      'ALUMNO_POR_DOCENTES',
      'POR_GRUPO',
      'POR_PERIODO',
      'POR_MATERIA'
    ) NOT NULL DEFAULT 'POR_PERIODO',
    publico_objetivo ENUM(
      'ALUMNOS',
      'DOCENTES',
      'GRUPOS',
      'PERIODOS',
      'MATERIAS'
    ) NOT NULL DEFAULT 'PERIODOS',
    escala VARCHAR(30) NOT NULL DEFAULT '1-5',
    ponderacion_total DECIMAL(6,2) NOT NULL DEFAULT 100.00,
    regla_convivencia TEXT NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    orden_visual INT NOT NULL DEFAULT 1,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_plantillas_orden (orden_visual),
    KEY idx_plantillas_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO evaluacion_plantillas
(codigo_plantilla, nombre_plantilla, descripcion, tipo_instrumento, publico_objetivo, escala, ponderacion_total, regla_convivencia, activo, orden_visual)
VALUES
(
  'FORMATIVA',
  'Evaluación Formativa',
  'Instrumento de seguimiento continuo para identificar avances, áreas de oportunidad y ajustes oportunos durante el periodo.',
  'POR_PERIODO',
  'PERIODOS',
  '1-5',
  100.00,
  NULL,
  1,
  1
),
(
  'SUMATIVA',
  'Evaluación Sumativa',
  'Instrumento para valorar resultados finales, desempeño global y logro de metas al cierre del ciclo.',
  'POR_MATERIA',
  'MATERIAS',
  '1-5',
  100.00,
  NULL,
  1,
  2
),
(
  'OBJETIVOS',
  'Evaluación basada en objetivos',
  'Instrumento orientado al cumplimiento de metas, indicadores y evidencias verificables.',
  'POR_GRUPO',
  'GRUPOS',
  '1-5',
  100.00,
  NULL,
  1,
  3
),
(
  'IPSATIVA',
  'Evaluación Ipsativa',
  'Instrumento que compara el progreso actual con el desempeño previo para observar crecimiento personal o académico.',
  'POR_PERIODO',
  'ALUMNOS',
  '1-5',
  100.00,
  NULL,
  1,
  4
),
(
  'ALUMNO_DOCENTE',
  'Alumno a Docente',
  'Instrumento específico para valorar la práctica docente desde la experiencia del alumno con escala de 1 a 5 y retroalimentación académica neutral.',
  'ALUMNO_POR_DOCENTES',
  'DOCENTES',
  '1-5',
  100.00,
  'Aquél alumno(a) que discrimine, juzgue, critique y ofenda a cualquier profesor sin distinción será sancionado por el jefe de carrera de la división y la subdirección académica y su evaluación será eliminada temporalmente hasta que se resuelva su caso.',
  1,
  5
);

-- =========================================================
-- 21. PREGUNTAS DE PLANTILLAS
-- =========================================================
CREATE TABLE IF NOT EXISTS evaluacion_plantilla_preguntas (
    id_pregunta BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_plantilla BIGINT NOT NULL,
    criterio VARCHAR(180) NOT NULL,
    descripcion TEXT,
    peso DECIMAL(6,2) DEFAULT 0,
    tipo_respuesta ENUM('NUMERICA','TEXTO','SELECT','SI_NO') DEFAULT 'NUMERICA',
    orden_pregunta INT DEFAULT 1,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_plantilla_orden (id_plantilla, orden_pregunta),
    KEY idx_preguntas_plantilla (id_plantilla),
    CONSTRAINT fk_preguntas_plantilla
      FOREIGN KEY (id_plantilla) REFERENCES evaluacion_plantillas(id_plantilla)
      ON DELETE CASCADE
      ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO evaluacion_plantilla_preguntas
(id_plantilla, criterio, descripcion, peso, tipo_respuesta, orden_pregunta, activo)
SELECT p.id_plantilla, q.criterio, q.descripcion, q.peso, q.tipo_respuesta, q.orden_pregunta, 1
FROM evaluacion_plantillas p
JOIN (
  SELECT 'FORMATIVA' AS codigo_plantilla, 'Participación y seguimiento' AS criterio, 'Valora la constancia, participación y atención durante el proceso.' AS descripcion, 20 AS peso, 'NUMERICA' AS tipo_respuesta, 1 AS orden_pregunta
  UNION ALL SELECT 'FORMATIVA', 'Comprensión progresiva', 'Evalúa el avance gradual en la comprensión de contenidos.', 20, 'NUMERICA', 2
  UNION ALL SELECT 'FORMATIVA', 'Aplicación práctica', 'Mide la capacidad de aplicar lo aprendido en actividades concretas.', 20, 'NUMERICA', 3
  UNION ALL SELECT 'FORMATIVA', 'Trabajo colaborativo', 'Considera la interacción y colaboración con pares.', 20, 'NUMERICA', 4
  UNION ALL SELECT 'FORMATIVA', 'Mejora continua', 'Revisa la evolución y disposición para mejorar.', 20, 'NUMERICA', 5

  UNION ALL SELECT 'SUMATIVA', 'Cumplimiento de objetivos', 'Valora el cumplimiento de metas establecidas al inicio.', 25, 'NUMERICA', 1
  UNION ALL SELECT 'SUMATIVA', 'Calidad del resultado final', 'Evalúa la calidad del trabajo o producto entregado.', 25, 'NUMERICA', 2
  UNION ALL SELECT 'SUMATIVA', 'Dominio conceptual', 'Mide el conocimiento acumulado al cierre.', 25, 'NUMERICA', 3
  UNION ALL SELECT 'SUMATIVA', 'Desempeño integral', 'Considera rendimiento general durante el periodo.', 25, 'NUMERICA', 4

  UNION ALL SELECT 'OBJETIVOS', 'Objetivo 1: logro esperado', 'Grado de cumplimiento del primer objetivo.', 25, 'NUMERICA', 1
  UNION ALL SELECT 'OBJETIVOS', 'Objetivo 2: evidencia de aprendizaje', 'Verifica la evidencia presentada respecto al segundo objetivo.', 25, 'NUMERICA', 2
  UNION ALL SELECT 'OBJETIVOS', 'Objetivo 3: impacto académico', 'Mide el efecto del trabajo realizado.', 25, 'NUMERICA', 3
  UNION ALL SELECT 'OBJETIVOS', 'Objetivo 4: consistencia', 'Revisa coherencia entre lo planeado y lo obtenido.', 25, 'NUMERICA', 4

  UNION ALL SELECT 'IPSATIVA', 'Progreso respecto al periodo anterior', 'Compara la mejora observada con tu propio historial.', 20, 'NUMERICA', 1
  UNION ALL SELECT 'IPSATIVA', 'Hábitos de estudio', 'Evalúa el cambio en disciplina y constancia.', 20, 'NUMERICA', 2
  UNION ALL SELECT 'IPSATIVA', 'Autonomía', 'Valora el crecimiento en independencia y toma de decisiones.', 20, 'NUMERICA', 3
  UNION ALL SELECT 'IPSATIVA', 'Autorregulación', 'Revisa la capacidad para organizar el esfuerzo propio.', 20, 'NUMERICA', 4
  UNION ALL SELECT 'IPSATIVA', 'Mejora comparativa', 'Observa el avance general frente a ciclos previos.', 20, 'NUMERICA', 5

  UNION ALL SELECT 'ALUMNO_DOCENTE', 'Dominio de la Materia', 'Explica con claridad los contenidos y demuestra conocimiento actualizado.', 10, 'NUMERICA', 1
  UNION ALL SELECT 'ALUMNO_DOCENTE', 'Puntualidad y cumplimiento', 'Llega a tiempo, cubre el programa y cumple con lo planeado.', 10, 'NUMERICA', 2
  UNION ALL SELECT 'ALUMNO_DOCENTE', 'Metodología y didáctica', 'Utiliza estrategias de enseñanza comprensibles y útiles.', 10, 'NUMERICA', 3
  UNION ALL SELECT 'ALUMNO_DOCENTE', 'Claridad y comunicación', 'Comunica ideas, instrucciones y objetivos de forma comprensible.', 10, 'NUMERICA', 4
  UNION ALL SELECT 'ALUMNO_DOCENTE', 'Evaluación justa y transparente', 'Evalúa con criterios claros, equilibrados y previamente informados.', 10, 'NUMERICA', 5
  UNION ALL SELECT 'ALUMNO_DOCENTE', 'Calidad humana y trato', 'Mantiene una relación respetuosa, empática y profesional.', 10, 'NUMERICA', 6
  UNION ALL SELECT 'ALUMNO_DOCENTE', 'Retroalimentación formativa', 'Brinda observaciones útiles para mejorar el aprendizaje.', 10, 'NUMERICA', 7
  UNION ALL SELECT 'ALUMNO_DOCENTE', 'Uso de tecnologías', 'Integra recursos digitales de forma adecuada al proceso educativo.', 10, 'NUMERICA', 8
  UNION ALL SELECT 'ALUMNO_DOCENTE', 'Fomento de pensamiento crítico', 'Promueve análisis, reflexión y argumentación académica.', 10, 'NUMERICA', 9
  UNION ALL SELECT 'ALUMNO_DOCENTE', 'Innovación y actualización', 'Demuestra actualización disciplinar e innovación pedagógica.', 10, 'NUMERICA', 10
  UNION ALL SELECT 'ALUMNO_DOCENTE', 'Retroalimentación general', 'Escribe una retroalimentación completa, académica, neutral y motivadora sobre tu experiencia con el docente.', 0, 'TEXTO', 11
) q
ON q.codigo_plantilla = p.codigo_plantilla
WHERE p.activo = 1;

-- =========================================================
-- 22. EVALUACIONES
-- =========================================================
CREATE TABLE IF NOT EXISTS evaluaciones (
    id_evaluacion BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_periodo INT NOT NULL,
    id_plantilla BIGINT NOT NULL,
    titulo VARCHAR(180) NOT NULL,
    descripcion TEXT,
    fecha_inicio DATETIME NOT NULL,
    fecha_fin DATETIME NOT NULL,
    estado ENUM('BORRADOR','ACTIVA','CERRADA','CANCELADA') DEFAULT 'BORRADOR',
    creado_por INT NOT NULL,
    tipo_instrumento ENUM(
      'DOCENTE_POR_ALUMNOS',
      'ALUMNO_POR_DOCENTES',
      'POR_GRUPO',
      'POR_PERIODO',
      'POR_MATERIA'
    ) NOT NULL DEFAULT 'POR_PERIODO',
    publico_objetivo ENUM(
      'ALUMNOS',
      'DOCENTES',
      'GRUPOS',
      'PERIODOS',
      'MATERIAS'
    ) NOT NULL DEFAULT 'PERIODOS',
    escala VARCHAR(30) NOT NULL DEFAULT '1-5',
    ponderacion_total DECIMAL(6,2) NOT NULL DEFAULT 100.00,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_eval_periodo_plantilla_titulo (id_periodo, id_plantilla, titulo),
    KEY idx_eval_periodo_plantilla_estado (id_periodo, id_plantilla, estado),
    CONSTRAINT fk_eval_periodo
      FOREIGN KEY (id_periodo) REFERENCES periodos(id_periodo)
      ON DELETE RESTRICT
      ON UPDATE CASCADE,
    CONSTRAINT fk_eval_plantilla
      FOREIGN KEY (id_plantilla) REFERENCES evaluacion_plantillas(id_plantilla)
      ON DELETE RESTRICT
      ON UPDATE CASCADE,
    CONSTRAINT fk_eval_creado_por
      FOREIGN KEY (creado_por) REFERENCES usuarios(id_usuario)
      ON DELETE RESTRICT
      ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Inserción base opcional, solo si ya existe al menos un usuario
INSERT IGNORE INTO evaluaciones
(id_periodo, id_plantilla, titulo, descripcion, fecha_inicio, fecha_fin, estado, creado_por, tipo_instrumento, publico_objetivo, escala, ponderacion_total)
SELECT
  p.id_periodo,
  pl.id_plantilla,
  'Evaluación diagnóstica',
  'Evaluación inicial del periodo.',
  '2026-01-10 08:00:00',
  '2026-01-15 20:00:00',
  'ACTIVA',
  u.id_usuario,
  'POR_PERIODO',
  'PERIODOS',
  '1-5',
  100.00
FROM periodos p
JOIN evaluacion_plantillas pl ON pl.codigo_plantilla = 'FORMATIVA'
JOIN (
  SELECT id_usuario
  FROM usuarios
  ORDER BY id_usuario ASC
  LIMIT 1
) u
WHERE p.nombre_periodo = '2026-1'
  AND EXISTS (SELECT 1 FROM usuarios LIMIT 1)
  AND NOT EXISTS (
    SELECT 1
    FROM evaluaciones e
    WHERE e.id_periodo = p.id_periodo
      AND e.id_plantilla = pl.id_plantilla
      AND e.titulo = 'Evaluación diagnóstica'
  );

-- =========================================================
-- 23. RESULTADOS DE EVALUACIÓN
-- =========================================================
CREATE TABLE IF NOT EXISTS evaluacion_resultados (
  id_resultado BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_evaluacion BIGINT NOT NULL,
  id_evaluado INT NOT NULL,
  tipo_evaluado ENUM('DOCENTE','ALUMNO','GRUPO','PERIODO','MATERIA') NOT NULL,
  promedio_final DECIMAL(6,2) DEFAULT 0,
  observacion_general TEXT,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_resultado_eval
    FOREIGN KEY (id_evaluacion) REFERENCES evaluaciones(id_evaluacion)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 24. RESTABLECIMIENTO DE CONTRASEÑA
-- =========================================================
CREATE TABLE IF NOT EXISTS password_resets (
    id_reseteo BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_password_resets_usuario
      FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
      ON DELETE CASCADE
      ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 25. RESPUESTAS DE EVALUACIÓN
-- =========================================================
CREATE TABLE IF NOT EXISTS respuestas_evaluacion (
    id_respuesta BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_evaluacion BIGINT NOT NULL,
    id_pregunta BIGINT NOT NULL,
    id_alumno INT NULL,
    id_docente INT NULL,
    valor_numero DECIMAL(6,2),
    valor_texto TEXT,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_respuesta_eval
      FOREIGN KEY (id_evaluacion) REFERENCES evaluaciones(id_evaluacion)
      ON DELETE CASCADE
      ON UPDATE CASCADE,
    CONSTRAINT fk_respuesta_pregunta
      FOREIGN KEY (id_pregunta) REFERENCES evaluacion_plantilla_preguntas(id_pregunta)
      ON DELETE CASCADE
      ON UPDATE CASCADE,
    CONSTRAINT fk_respuesta_alumno
      FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno)
      ON DELETE SET NULL
      ON UPDATE CASCADE,
    CONSTRAINT fk_respuesta_docente
      FOREIGN KEY (id_docente) REFERENCES docentes(id_docente)
      ON DELETE SET NULL
      ON UPDATE CASCADE,
    UNIQUE KEY uq_respuesta_eval_pregunta_alumno (id_evaluacion, id_pregunta, id_alumno),
    UNIQUE KEY uq_respuesta_eval_pregunta_docente (id_evaluacion, id_pregunta, id_docente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 26. EVALUACIÓN - LOG DE ERRORES TÉCNICOS
-- =========================================================
CREATE TABLE IF NOT EXISTS evaluacion_log_errores (
    id_log BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NULL,
    id_evaluacion BIGINT NULL,
    tipo_error ENUM('CONEXION','VALIDACION','PERMISO','CARGA','PROCESAMIENTO','OTRO') DEFAULT 'OTRO',
    mensaje TEXT NOT NULL,
    detalle_tecnico TEXT NULL,
    ip VARCHAR(45) NULL,
    user_agent TEXT NULL,
    url_origen VARCHAR(500) NULL,
    metodo_http VARCHAR(10) NULL,
    resuelto TINYINT(1) NOT NULL DEFAULT 0,
    resuelto_por INT NULL,
    resuelto_en DATETIME NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_log_error_usuario (id_usuario),
    KEY idx_log_error_evaluacion (id_evaluacion),
    KEY idx_log_error_tipo (tipo_error),
    KEY idx_log_error_resuelto (resuelto),
    CONSTRAINT fk_log_error_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_log_error_evaluacion
        FOREIGN KEY (id_evaluacion) REFERENCES evaluaciones(id_evaluacion)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_log_error_resuelto_por
        FOREIGN KEY (resuelto_por) REFERENCES usuarios(id_usuario)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 27. IA DE DESERCIÓN
-- =========================================================
CREATE TABLE IF NOT EXISTS ia_alertas_desercion (
    id_alerta BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_alumno INT NOT NULL,
    id_periodo INT NOT NULL,
    nivel_riesgo ENUM('Bajo','Medio','Alto','Crítico') DEFAULT 'Medio',
    puntaje_riesgo DECIMAL(6,2) DEFAULT 50,
    descripcion TEXT NOT NULL,
    recomendacion TEXT,
    atendida TINYINT(1) DEFAULT 0,
    modelo_version VARCHAR(40) NULL,
    factores_json JSON NULL,
    explicacion TEXT NULL,
    estado_seguimiento ENUM('Pendiente','En_proceso','Atendida','Cerrada') DEFAULT 'Pendiente',
    responsable_id INT NULL,
    revisado_en DATETIME NULL,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_ia_alertas_alumno_periodo (id_alumno, id_periodo),
    CONSTRAINT fk_ia_alertas_alumno
      FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno)
      ON DELETE CASCADE
      ON UPDATE CASCADE,
    CONSTRAINT fk_ia_alertas_periodo
      FOREIGN KEY (id_periodo) REFERENCES periodos(id_periodo)
      ON DELETE RESTRICT
      ON UPDATE CASCADE,
    CONSTRAINT fk_ia_responsable
      FOREIGN KEY (responsable_id) REFERENCES usuarios(id_usuario)
      ON DELETE SET NULL
      ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ia_seguimientos_desercion (
  id_seguimiento BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_alerta BIGINT NOT NULL,
  id_usuario INT NOT NULL,
  accion VARCHAR(150) NOT NULL,
  observaciones TEXT,
  estado ENUM('Pendiente','En_proceso','Atendida','Cerrada') DEFAULT 'Pendiente',
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ia_seguimiento_alerta
    FOREIGN KEY (id_alerta) REFERENCES ia_alertas_desercion(id_alerta)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_ia_seguimiento_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ia_desercion_parciales (
    id_parcial BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_alumno INT NOT NULL,
    id_periodo INT NOT NULL,
    numero_parcial TINYINT NOT NULL COMMENT '1, 2 o 3',
    calificacion_promedio DECIMAL(5,2) DEFAULT 0,
    riesgos_detectados INT DEFAULT 0,
    materias_reprobadas INT DEFAULT 0,
    alumnos_activos INT DEFAULT 0 COMMENT 'Número de alumnos activos en el parcial',
    alumnos_desertores INT DEFAULT 0 COMMENT 'Número de alumnos desertores en el parcial',
    tendencia ENUM('Mejora','Estable','Declive') DEFAULT 'Estable',
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_parcial_alumno_periodo (id_alumno, id_periodo, numero_parcial),
    CONSTRAINT fk_parcial_alumno
      FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_parcial_periodo
      FOREIGN KEY (id_periodo) REFERENCES periodos(id_periodo)
      ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ia_auditoria_desercion (
    id_auditoria BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NULL,
    accion VARCHAR(60) NOT NULL,
    detalle TEXT NULL,
    id_alerta BIGINT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_auditoria_accion (accion),
    KEY idx_auditoria_creado (creado_en),
    CONSTRAINT fk_auditoria_usuario
      FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_auditoria_alerta
      FOREIGN KEY (id_alerta) REFERENCES ia_alertas_desercion(id_alerta)
      ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 28. BITÁCORA
-- =========================================================
CREATE TABLE IF NOT EXISTS bitacora_auditoria (
    id_bitacora BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NULL,
    modulo VARCHAR(80) NOT NULL,
    accion VARCHAR(120) NOT NULL,
    detalle TEXT NULL,
    ip VARCHAR(45),
    user_agent VARCHAR(255),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bitacora_usuario
      FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
      ON DELETE SET NULL
      ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 29. EVALUACIÓN - AUDITORÍA
-- =========================================================
CREATE TABLE IF NOT EXISTS evaluacion_auditoria (
    id_auditoria BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_evaluacion BIGINT NULL,
    id_usuario INT NOT NULL,
    accion VARCHAR(80) NOT NULL COMMENT 'CREAR, ACTIVAR, CERRAR, CANCELAR, VALIDAR, EDITAR, EXPORTAR, ELIMINAR',
    detalle TEXT NULL,
    observaciones VARCHAR(255) NULL,
    ip VARCHAR(45),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_auditoria_evaluacion (id_evaluacion),
    KEY idx_auditoria_usuario (id_usuario),
    KEY idx_auditoria_accion (accion),
    KEY idx_auditoria_creado (creado_en),
    CONSTRAINT fk_auditoria_evaluacion
      FOREIGN KEY (id_evaluacion) REFERENCES evaluaciones(id_evaluacion)
      ON DELETE SET NULL
      ON UPDATE CASCADE,
    CONSTRAINT fk_auditoria_usuario
      FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
      ON DELETE CASCADE
      ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 30. EVALUACIÓN - EXPORTACIONES
-- =========================================================
CREATE TABLE IF NOT EXISTS evaluacion_exportaciones (
    id_exportacion BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_evaluacion BIGINT NOT NULL,
    id_usuario INT NOT NULL,
    formato ENUM('JSON','CSV','PDF','XLSX') DEFAULT 'JSON',
    archivo_generado VARCHAR(255) NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_exportacion_evaluacion (id_evaluacion),
    CONSTRAINT fk_exportacion_evaluacion
      FOREIGN KEY (id_evaluacion) REFERENCES evaluaciones(id_evaluacion)
      ON DELETE CASCADE
      ON UPDATE CASCADE,
    CONSTRAINT fk_exportacion_usuario
      FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
      ON DELETE CASCADE
      ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- MIGRACIÓN: AGREGAR COLUMNAS FALTANTES A evaluaciones
-- =========================================================
ALTER TABLE evaluaciones
  ADD COLUMN IF NOT EXISTS cerrado_por INT NULL AFTER ponderacion_total,
  ADD COLUMN IF NOT EXISTS cerrado_en DATETIME NULL AFTER cerrado_por,
  ADD COLUMN IF NOT EXISTS cerrado_observaciones TEXT NULL AFTER cerrado_en,
  ADD COLUMN IF NOT EXISTS actualizado_por INT NULL AFTER cerrado_observaciones,
  ADD KEY IF NOT EXISTS idx_eval_cerrado_por (cerrado_por),
  ADD KEY IF NOT EXISTS idx_eval_actualizado_por (actualizado_por),
  ADD CONSTRAINT IF NOT EXISTS fk_eval_cerrado_por
    FOREIGN KEY (cerrado_por) REFERENCES usuarios(id_usuario)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT IF NOT EXISTS fk_eval_actualizado_por
    FOREIGN KEY (actualizado_por) REFERENCES usuarios(id_usuario)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- =========================================================
-- MIGRACIÓN: AGREGAR COLUMNAS FALTANTES A evaluacion_resultados
-- =========================================================
ALTER TABLE evaluacion_resultados
  ADD COLUMN IF NOT EXISTS validado_por INT NULL AFTER observacion_general,
  ADD COLUMN IF NOT EXISTS validado_en DATETIME NULL AFTER validado_por,
  ADD COLUMN IF NOT EXISTS estado_validacion ENUM('NO_VALIDADO','VALIDADO','RECHAZADO') DEFAULT 'NO_VALIDADO' AFTER validado_en,
  ADD KEY IF NOT EXISTS idx_resultado_validado_por (validado_por),
  ADD CONSTRAINT IF NOT EXISTS fk_resultado_validado_por
    FOREIGN KEY (validado_por) REFERENCES usuarios(id_usuario)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- =========================================================
-- 31. EVALUACIÓN - ALERTAS DE AVANCE
-- =========================================================
CREATE TABLE IF NOT EXISTS evaluacion_alertas (
    id_alerta BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_evaluacion BIGINT NOT NULL,
    id_grupo INT NULL,
    tipo_alerta ENUM('BAJA_PARTICIPACION','RETRASO_INICIO','PROXIMO_CIERRE','SIN_RESPUESTAS','SIN_RESULTADOS','AVANCE_INSUFICIENTE','OTRO') DEFAULT 'OTRO',
    descripcion TEXT NOT NULL,
    nivel ENUM('BAJO','MEDIO','ALTO') DEFAULT 'MEDIO',
    atendida TINYINT(1) NOT NULL DEFAULT 0,
    atendida_por INT NULL,
    atendida_en DATETIME NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_alerta_evaluacion (id_evaluacion),
    KEY idx_alerta_grupo (id_grupo),
    KEY idx_alerta_nivel (nivel),
    KEY idx_alerta_atendida (atendida),
    CONSTRAINT fk_alerta_evaluacion
      FOREIGN KEY (id_evaluacion) REFERENCES evaluaciones(id_evaluacion)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_alerta_grupo
      FOREIGN KEY (id_grupo) REFERENCES grupos(id_grupo)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_alerta_atendida_por
      FOREIGN KEY (atendida_por) REFERENCES usuarios(id_usuario)
      ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;