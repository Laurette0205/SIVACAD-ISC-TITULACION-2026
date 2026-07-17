USE sivacad_isc;

START TRANSACTION;

-- =========================================================
-- 0. CREACIÓN DE TABLA EVALUACION_PREGUNTAS SI NO EXISTE
-- =========================================================

CREATE TABLE IF NOT EXISTS evaluacion_preguntas (
  id_pregunta BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_evaluacion BIGINT NOT NULL,
  id_pregunta_plantilla BIGINT NULL,
  criterio VARCHAR(180) NOT NULL,
  descripcion TEXT NULL,
  peso DECIMAL(6,2) DEFAULT 0,
  tipo_respuesta ENUM('NUMERICA','TEXTO','SELECT','SI_NO') DEFAULT 'NUMERICA',
  orden_pregunta INT DEFAULT 1,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_evaluacion_orden (id_evaluacion, orden_pregunta),
  KEY idx_evaluacion_preguntas_eval (id_evaluacion),
  KEY idx_evaluacion_preguntas_plantilla (id_pregunta_plantilla),
  CONSTRAINT fk_eval_preguntas_eval
    FOREIGN KEY (id_evaluacion) REFERENCES evaluaciones(id_evaluacion)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_eval_preguntas_plantilla
    FOREIGN KEY (id_pregunta_plantilla) REFERENCES evaluacion_plantilla_preguntas(id_pregunta)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 1. ROLES BASE
-- =========================================================
INSERT IGNORE INTO roles (nombre_rol, descripcion) VALUES
('administrador', 'Control total'),
('coordinador', 'Consulta y seguimiento'),
('docente', 'Gestión académica'),
('alumno', 'Consulta y evaluación'),
('soporte', 'Mantenimiento técnico');

-- =========================================================
-- 2. CARRERA BASE
-- =========================================================
INSERT IGNORE INTO carreras (nombre_carrera)
VALUES ('Ingeniería en Sistemas Computacionales');

-- =========================================================
-- 3. PLAN DE ESTUDIOS BASE
-- =========================================================
INSERT INTO planes_estudio (id_carrera, nombre_plan, version_plan)
SELECT c.id_carrera, 'Plan ISC 2026', '2026-A'
FROM carreras c
WHERE c.nombre_carrera = 'Ingeniería en Sistemas Computacionales'
  AND NOT EXISTS (
    SELECT 1
    FROM planes_estudio pe
    WHERE pe.id_carrera = c.id_carrera
      AND pe.nombre_plan = 'Plan ISC 2026'
      AND pe.version_plan = '2026-A'
  );

-- =========================================================
-- 4. PERIODO BASE
-- =========================================================
INSERT IGNORE INTO periodos (nombre_periodo, fecha_inicio, fecha_fin, estado)
VALUES ('2026-1', '2026-01-01', '2026-06-30', 'Activo');

-- =========================================================
-- 5. TIPOS DE EVALUACIÓN
-- =========================================================
INSERT IGNORE INTO tipos_evaluacion (nombre_tipo) VALUES
('Alumno a Docente'),
('Docente a Alumno'),
('Alumno a Docente Retroalimentación'),
('Docente a Alumno Retroalimentación');

-- =========================================================
-- 6. PLANTILLAS INSTITUCIONALES
-- =========================================================
INSERT INTO evaluacion_plantillas
(
  codigo_plantilla,
  nombre_plantilla,
  descripcion,
  tipo_instrumento,
  publico_objetivo,
  escala,
  ponderacion_total,
  regla_convivencia,
  activo,
  orden_visual
)
SELECT
  'FORMATIVA',
  'Evaluación Formativa',
  'Instrumento de seguimiento continuo para identificar avances y áreas de oportunidad durante el periodo.',
  'POR_PERIODO',
  'PERIODOS',
  '1-5',
  100.00,
  NULL,
  1,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM evaluacion_plantillas WHERE codigo_plantilla = 'FORMATIVA'
);

INSERT INTO evaluacion_plantillas
(
  codigo_plantilla,
  nombre_plantilla,
  descripcion,
  tipo_instrumento,
  publico_objetivo,
  escala,
  ponderacion_total,
  regla_convivencia,
  activo,
  orden_visual
)
SELECT
  'SUMATIVA',
  'Evaluación Sumativa',
  'Instrumento para valorar resultados finales y desempeño global.',
  'POR_MATERIA',
  'MATERIAS',
  '1-5',
  100.00,
  NULL,
  1,
  2
WHERE NOT EXISTS (
  SELECT 1 FROM evaluacion_plantillas WHERE codigo_plantilla = 'SUMATIVA'
);

INSERT INTO evaluacion_plantillas
(
  codigo_plantilla,
  nombre_plantilla,
  descripcion,
  tipo_instrumento,
  publico_objetivo,
  escala,
  ponderacion_total,
  regla_convivencia,
  activo,
  orden_visual
)
SELECT
  'OBJETIVOS',
  'Evaluación basada en objetivos',
  'Instrumento orientado al cumplimiento de metas e indicadores.',
  'POR_GRUPO',
  'GRUPOS',
  '1-5',
  100.00,
  NULL,
  1,
  3
WHERE NOT EXISTS (
  SELECT 1 FROM evaluacion_plantillas WHERE codigo_plantilla = 'OBJETIVOS'
);

INSERT INTO evaluacion_plantillas
(
  codigo_plantilla,
  nombre_plantilla,
  descripcion,
  tipo_instrumento,
  publico_objetivo,
  escala,
  ponderacion_total,
  regla_convivencia,
  activo,
  orden_visual
)
SELECT
  'IPSATIVA',
  'Evaluación Ipsativa',
  'Instrumento que compara el progreso actual con el desempeño previo.',
  'POR_PERIODO',
  'ALUMNOS',
  '1-5',
  100.00,
  NULL,
  1,
  4
WHERE NOT EXISTS (
  SELECT 1 FROM evaluacion_plantillas WHERE codigo_plantilla = 'IPSATIVA'
);

INSERT INTO evaluacion_plantillas
(
  codigo_plantilla,
  nombre_plantilla,
  descripcion,
  tipo_instrumento,
  publico_objetivo,
  escala,
  ponderacion_total,
  regla_convivencia,
  activo,
  orden_visual
)
SELECT
  'ALUMNO_DOCENTE',
  'Alumno a Docente',
  'Instrumento para valorar la práctica docente desde la experiencia del alumno.',
  'ALUMNO_POR_DOCENTES',
  'DOCENTES',
  '1-5',
  100.00,
  'La retroalimentación debe ser académica, respetuosa y objetiva.',
  1,
  5
WHERE NOT EXISTS (
  SELECT 1 FROM evaluacion_plantillas WHERE codigo_plantilla = 'ALUMNO_DOCENTE'
);

-- =========================================================
-- 7. PREGUNTAS BASE DE LAS PLANTILLAS
-- =========================================================
INSERT INTO evaluacion_plantilla_preguntas
(
  id_plantilla,
  criterio,
  descripcion,
  peso,
  tipo_respuesta,
  orden_pregunta,
  activo
)
SELECT
  p.id_plantilla,
  q.criterio,
  q.descripcion,
  q.peso,
  q.tipo_respuesta,
  q.orden_pregunta,
  1
FROM evaluacion_plantillas p
JOIN (
  SELECT 'FORMATIVA' AS codigo_plantilla, 'Participación y seguimiento' AS criterio, 'Valora constancia, participación y atención.' AS descripcion, 20 AS peso, 'NUMERICA' AS tipo_respuesta, 1 AS orden_pregunta
  UNION ALL SELECT 'FORMATIVA', 'Comprensión progresiva', 'Evalúa el avance gradual en la comprensión.', 20, 'NUMERICA', 2
  UNION ALL SELECT 'FORMATIVA', 'Aplicación práctica', 'Mide la capacidad de aplicar lo aprendido.', 20, 'NUMERICA', 3
  UNION ALL SELECT 'FORMATIVA', 'Trabajo colaborativo', 'Considera la interacción con pares.', 20, 'NUMERICA', 4
  UNION ALL SELECT 'FORMATIVA', 'Mejora continua', 'Revisa evolución y disposición para mejorar.', 20, 'NUMERICA', 5

  UNION ALL SELECT 'SUMATIVA', 'Cumplimiento de objetivos', 'Valora el cumplimiento de metas.', 25, 'NUMERICA', 1
  UNION ALL SELECT 'SUMATIVA', 'Calidad del resultado final', 'Evalúa la calidad del trabajo o producto.', 25, 'NUMERICA', 2
  UNION ALL SELECT 'SUMATIVA', 'Dominio conceptual', 'Mide el conocimiento acumulado.', 25, 'NUMERICA', 3
  UNION ALL SELECT 'SUMATIVA', 'Desempeño integral', 'Considera el rendimiento general.', 25, 'NUMERICA', 4

  UNION ALL SELECT 'OBJETIVOS', 'Objetivo 1: logro esperado', 'Grado de cumplimiento del primer objetivo.', 25, 'NUMERICA', 1
  UNION ALL SELECT 'OBJETIVOS', 'Objetivo 2: evidencia de aprendizaje', 'Verifica la evidencia del segundo objetivo.', 25, 'NUMERICA', 2
  UNION ALL SELECT 'OBJETIVOS', 'Objetivo 3: impacto académico', 'Mide el efecto del trabajo realizado.', 25, 'NUMERICA', 3
  UNION ALL SELECT 'OBJETIVOS', 'Objetivo 4: consistencia', 'Revisa coherencia entre lo planeado y lo obtenido.', 25, 'NUMERICA', 4

  UNION ALL SELECT 'IPSATIVA', 'Progreso respecto al periodo anterior', 'Compara la mejora con el historial del estudiante.', 20, 'NUMERICA', 1
  UNION ALL SELECT 'IPSATIVA', 'Hábitos de estudio', 'Evalúa disciplina y constancia.', 20, 'NUMERICA', 2
  UNION ALL SELECT 'IPSATIVA', 'Autonomía', 'Valora independencia y toma de decisiones.', 20, 'NUMERICA', 3
  UNION ALL SELECT 'IPSATIVA', 'Autorregulación', 'Revisa la capacidad para organizar el esfuerzo propio.', 20, 'NUMERICA', 4
  UNION ALL SELECT 'IPSATIVA', 'Mejora comparativa', 'Observa el avance frente a ciclos previos.', 20, 'NUMERICA', 5

  UNION ALL SELECT 'ALUMNO_DOCENTE', 'Dominio de la materia', 'Explica con claridad los contenidos.', 10, 'NUMERICA', 1
  UNION ALL SELECT 'ALUMNO_DOCENTE', 'Puntualidad y cumplimiento', 'Llega a tiempo y cumple con lo planeado.', 10, 'NUMERICA', 2
  UNION ALL SELECT 'ALUMNO_DOCENTE', 'Metodología y didáctica', 'Utiliza estrategias comprensibles y útiles.', 10, 'NUMERICA', 3
  UNION ALL SELECT 'ALUMNO_DOCENTE', 'Claridad y comunicación', 'Comunica instrucciones y objetivos con claridad.', 10, 'NUMERICA', 4
  UNION ALL SELECT 'ALUMNO_DOCENTE', 'Evaluación justa y transparente', 'Evalúa con criterios claros y equilibrados.', 10, 'NUMERICA', 5
  UNION ALL SELECT 'ALUMNO_DOCENTE', 'Calidad humana y trato', 'Mantiene una relación respetuosa y profesional.', 10, 'NUMERICA', 6
  UNION ALL SELECT 'ALUMNO_DOCENTE', 'Retroalimentación formativa', 'Brinda observaciones útiles para mejorar.', 10, 'NUMERICA', 7
  UNION ALL SELECT 'ALUMNO_DOCENTE', 'Uso de tecnologías', 'Integra recursos digitales adecuadamente.', 10, 'NUMERICA', 8
  UNION ALL SELECT 'ALUMNO_DOCENTE', 'Pensamiento crítico', 'Promueve análisis y argumentación académica.', 10, 'NUMERICA', 9
  UNION ALL SELECT 'ALUMNO_DOCENTE', 'Innovación y actualización', 'Demuestra actualización disciplinar.', 10, 'NUMERICA', 10
  UNION ALL SELECT 'ALUMNO_DOCENTE', 'Retroalimentación general', 'Comentario final académico y motivador.', 0, 'TEXTO', 11
) q
  ON q.codigo_plantilla = p.codigo_plantilla
WHERE NOT EXISTS (
  SELECT 1
  FROM evaluacion_plantilla_preguntas ep
  WHERE ep.id_plantilla = p.id_plantilla
    AND ep.orden_pregunta = q.orden_pregunta
);

-- =========================================================
-- 8. EVALUACIÓN BASE SOLO SI NO EXISTE
-- =========================================================
INSERT INTO evaluaciones
(
  id_periodo,
  id_plantilla,
  titulo,
  descripcion,
  fecha_inicio,
  fecha_fin,
  estado,
  creado_por,
  tipo_instrumento,
  publico_objetivo,
  escala,
  ponderacion_total
)
SELECT
  pe.id_periodo,
  p.id_plantilla,
  'Evaluación diagnóstica',
  'Evaluación inicial del periodo.',
  '2026-01-10 08:00:00',
  '2026-01-15 20:00:00',
  'BORRADOR',
  COALESCE(
    (SELECT u.id_usuario FROM usuarios u ORDER BY u.id_usuario ASC LIMIT 1),
    1
  ),
  'POR_PERIODO',
  'PERIODOS',
  '1-5',
  100.00
FROM periodos pe
JOIN evaluacion_plantillas p
  ON p.codigo_plantilla = 'FORMATIVA'
WHERE pe.nombre_periodo = '2026-1'
  AND NOT EXISTS (
    SELECT 1
    FROM evaluaciones e
    WHERE e.titulo = 'Evaluación diagnóstica'
      AND e.id_periodo = pe.id_periodo
  );

-- =========================================================
-- 8.1. PREGUNTAS DE LA EVALUACIÓN BASE SOLO SI NO EXISTE
-- =========================================================

INSERT INTO evaluacion_preguntas
(
  id_evaluacion,
  id_pregunta_plantilla,
  criterio,
  descripcion,
  peso,
  tipo_respuesta,
  orden_pregunta,
  activo
)
SELECT
  e.id_evaluacion,
  pp.id_pregunta,
  pp.criterio,
  pp.descripcion,
  pp.peso,
  pp.tipo_respuesta,
  pp.orden_pregunta,
  1
FROM evaluaciones e
JOIN evaluacion_plantillas p
  ON p.id_plantilla = e.id_plantilla
JOIN evaluacion_plantilla_preguntas pp
  ON pp.id_plantilla = p.id_plantilla
WHERE e.titulo = 'Evaluación diagnóstica'
  AND NOT EXISTS (
    SELECT 1
    FROM evaluacion_preguntas ep
    WHERE ep.id_evaluacion = e.id_evaluacion
  );

-- =========================================================
-- 9. SEMILLA DE MATERIAS Y GRUPOS SI FALTAN
-- =========================================================
INSERT INTO materias (clave_materia, nombre_materia, creditos, semestre_sugerido) VALUES
('ACF-0901', 'Cálculo Diferencial', 5, 1),
('AED-1285*', 'Fundamentos de Programación', 5, 1),
('ACA-0907', 'Taller de Ética', 4, 1),
('AEF-1041', 'Matemáticas Discretas', 5, 1),
('SCH-1024', 'Taller de Administración', 4, 1),
('ACC-0906', 'Fundamentos de Investigación', 4, 1),
('ACF-0902', 'Cálculo Integral', 5, 2),
('AED-1288*', 'Programación Orientada a Objetos', 5, 2),
('AEC-1008', 'Contabilidad Financiera', 4, 2),
('AEC-1058', 'Química', 4, 2),
('ACF-0903', 'Álgebra Lineal', 5, 2),
('AEF-1052', 'Probabilidad y Estadística', 5, 2),
('ACF-0904', 'Cálculo Vectorial', 5, 3),
('AED-1026', 'Estructura de Datos', 5, 3),
('SCC-1005', 'Cultura Empresarial', 4, 3),
('SCC-1013', 'Investigación de Operaciones', 4, 3),
('ACD-0908', 'Desarrollo Sustentable', 5, 3),
('SCF-1006', 'Física General', 5, 3),
('ACF-0905', 'Ecuaciones Diferenciales', 5, 4),
('SCC-1017', 'Métodos Numéricos', 4, 4),
('SCD-1027', 'Tópicos Avanzados de Programación', 5, 4),
('AEF-1031', 'Fundamentos de Base de Datos', 5, 4),
('SCD-1022', 'Simulación', 5, 4),
('SCD-1018', 'Principios Electrónicos y Aplicaciones Digitales', 5, 4),
('SCC-1010', 'Graficación', 4, 5),
('AEC-1034', 'Fundamentos de Telecomunicaciones', 4, 5),
('AEC-1061', 'Sistemas Operativos', 4, 5),
('SCA-1025', 'Taller de Base de Datos', 4, 5),
('SCC-1007', 'Fundamentos de Ingeniería de Software', 4, 5),
('SCD-1003', 'Arquitectura de Computadoras', 5, 5),
('SCD-1015', 'Lenguajes y Autómatas I', 5, 6),
('SCD-1021', 'Redes de Computadoras', 5, 6),
('SCA-1026', 'Taller de Sistemas Operativos', 4, 6),
('SCB-1001', 'Administración de Base de Datos', 5, 6),
('SCD-1011', 'Ingeniería de Software', 5, 6),
('SCC-1014', 'Lenguajes de Interfaz', 4, 6),
('SCD-1016', 'Lenguajes y Autómatas II', 5, 7),
('SCD-1004', 'Conmutación y Enrutamiento en Redes de Datos', 5, 7),
('ACA-0909', 'Taller de Investigación I', 4, 7),
('IAD-2301', 'CiberSeguridad', 5, 7),
('SCG-1009', 'Gestión de Proyectos de Software', 6, 7),
('SCC-1023', 'Sistemas Programables', 4, 7),
('SCD-1019', 'Programacióm Lógica y Funcional', 4, 8),
('SCA-1002', 'Administración de Redes', 4, 8),
('ACA-0910', 'Taller de Investigación II', 4, 8),
('IAD-2302', 'Análisis y Modelado de Datos', 5, 8),
('AEB-1055', 'Programación Web', 5, 8),
('IAD-2303', 'Sistemas Autónomos', 5, 8),
('SCC-1012', 'Inteligencia Artificial', 4, 9),
('IAD-2304', 'Redes Neuronales Artificiales', 5, 9),
('IAD-2305', 'Algoritmos Evolutivos', 5, 9);

INSERT INTO grupos (id_periodo, id_carrera, nombre_grupo, semestre, turno, estado)
SELECT
  pe.id_periodo,
  c.id_carrera,
  g.nombre_grupo,
  g.semestre,
  'Matutino',
  'Abierto'
FROM periodos pe
JOIN carreras c
  ON c.nombre_carrera = 'Ingeniería en Sistemas Computacionales'
JOIN (
  SELECT '1101' AS nombre_grupo, 1 AS semestre, 1 AS orden_visual
  UNION ALL SELECT '1102', 1, 2
  UNION ALL SELECT '1151', 1, 3
  UNION ALL SELECT '1201', 2, 4
  UNION ALL SELECT '1202', 2, 5
  UNION ALL SELECT '1251', 2, 6
  UNION ALL SELECT '1301', 3, 7
  UNION ALL SELECT '1302', 3, 8
  UNION ALL SELECT '1351', 3, 9
  UNION ALL SELECT '1401', 4, 10
  UNION ALL SELECT '1402', 4, 11
  UNION ALL SELECT '1451', 4, 12
  UNION ALL SELECT '1501', 5, 13
  UNION ALL SELECT '1502', 5, 14
  UNION ALL SELECT '1551', 5, 15
  UNION ALL SELECT '1601', 6, 16
  UNION ALL SELECT '1602', 6, 17
  UNION ALL SELECT '1651', 6, 18
  UNION ALL SELECT '1701', 7, 19
  UNION ALL SELECT '1702', 7, 20
  UNION ALL SELECT '1751', 7, 21
  UNION ALL SELECT '1801', 8, 22
  UNION ALL SELECT '1802', 8, 23
  UNION ALL SELECT '1851', 8, 24
  UNION ALL SELECT '1951', 9, 25
  UNION ALL SELECT '1952', 9, 26
) g ON 1=1
WHERE pe.nombre_periodo = '2026-1'
  AND NOT EXISTS (
    SELECT 1
    FROM grupos gx
    WHERE gx.id_periodo = pe.id_periodo
      AND gx.id_carrera = c.id_carrera
      AND gx.nombre_grupo = g.nombre_grupo
      AND gx.semestre = g.semestre
      AND gx.turno = 'Matutino'
  )
ORDER BY g.orden_visual;

-- =========================================================
-- 10. ASEGURAR NUEVAS COLUMNAS EN evaluaciones
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
-- 11. ASEGURAR NUEVAS COLUMNAS EN evaluacion_resultados
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
-- 12. TABLA DE AUDITORÍA DE EVALUACIONES
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
-- 13. TABLA DE EXPORTACIONES
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
-- 14. TABLA DE ALERTAS DE AVANCE
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

-- =========================================================
-- 15. TABLA DE LOG DE ERRORES TÉCNICOS
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

COMMIT;