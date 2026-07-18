-- ============================================================
-- MIGRACIÓN: IA de Becas - Módulo Coordinador
-- Tablas para gestión operativa: bandeja, observaciones,
-- canalización, dictamen preliminar y seguimiento de casos.
-- ============================================================

-- 1. Agregar columnas de grupo a solicitudes existentes
ALTER TABLE ia_becas_solicitudes
  ADD COLUMN IF NOT EXISTS id_grupo BIGINT DEFAULT NULL AFTER id_carrera,
  ADD COLUMN IF NOT EXISTS nombre_grupo VARCHAR(60) DEFAULT NULL AFTER id_grupo,
  ADD COLUMN IF NOT EXISTS turno VARCHAR(20) DEFAULT NULL AFTER nombre_grupo,
  ADD COLUMN IF NOT EXISTS id_coordinador_asignado BIGINT DEFAULT NULL AFTER id_usuario_revisor,
  ADD COLUMN IF NOT EXISTS nombre_coordinador_asignado VARCHAR(255) DEFAULT NULL AFTER id_coordinador_asignado,
  ADD COLUMN IF NOT EXISTS prioridad VARCHAR(20) DEFAULT 'NORMAL' AFTER estatus_solicitud,
  ADD COLUMN IF NOT EXISTS fecha_asignacion TIMESTAMP NULL DEFAULT NULL AFTER fecha_resolucion,
  ADD COLUMN IF NOT EXISTS canalizado_a VARCHAR(60) DEFAULT NULL AFTER nombre_coordinador_asignado,
  ADD COLUMN IF NOT EXISTS fecha_canalizacion TIMESTAMP NULL DEFAULT NULL AFTER canalizado_a,
  ADD INDEX IF NOT EXISTS idx_becas_sol_grupo (id_grupo),
  ADD INDEX IF NOT EXISTS idx_becas_sol_prioridad (prioridad);

-- 2. OBSERVACIONES (comentarios del coordinador sobre solicitudes)
CREATE TABLE IF NOT EXISTS ia_becas_observaciones (
  id_observacion BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_solicitud BIGINT NOT NULL,
  id_usuario BIGINT NOT NULL,
  nombre_usuario VARCHAR(255) DEFAULT NULL,
  rol_usuario VARCHAR(60) DEFAULT NULL,
  tipo_observacion VARCHAR(40) NOT NULL DEFAULT 'GENERAL',
  -- Tipos: GENERAL, ACADEMICA, DOCUMENTAL, CANALIZACION, DICTAMEN_PRELIMINAR
  observacion TEXT NOT NULL,
  es_interna TINYINT(1) DEFAULT 0,
  fecha_observacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_becas_obs_solicitud (id_solicitud),
  INDEX idx_becas_obs_usuario (id_usuario),
  INDEX idx_becas_obs_tipo (tipo_observacion),
  CONSTRAINT fk_becas_obs_solicitud FOREIGN KEY (id_solicitud) REFERENCES ia_becas_solicitudes(id_solicitud) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. CANALIZACIONES (registro de casos canalizados)
CREATE TABLE IF NOT EXISTS ia_becas_canalizaciones (
  id_canalizacion BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_solicitud BIGINT NOT NULL,
  id_usuario_origen BIGINT NOT NULL,
  nombre_usuario_origen VARCHAR(255) DEFAULT NULL,
  id_usuario_destino BIGINT DEFAULT NULL,
  nombre_usuario_destino VARCHAR(255) DEFAULT NULL,
  area_destino VARCHAR(100) NOT NULL DEFAULT '',
  -- Áreas: COORDINACION_ACADEMICA, SERVICIOS_ESCOLARES, FINANZAS, DIRECCION, COMITE_BECAS
  motivo TEXT DEFAULT NULL,
  estatus_canalizacion VARCHAR(30) DEFAULT 'PENDIENTE',
  -- Estatus: PENDIENTE, ACEPTADA, RECHAZADA, FINALIZADA
  fecha_canalizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_respuesta TIMESTAMP NULL DEFAULT NULL,
  respuesta TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_becas_canal_solicitud (id_solicitud),
  INDEX idx_becas_canal_origen (id_usuario_origen),
  INDEX idx_becas_canal_destino (id_usuario_destino),
  INDEX idx_becas_canal_estatus (estatus_canalizacion),
  CONSTRAINT fk_becas_canal_solicitud FOREIGN KEY (id_solicitud) REFERENCES ia_becas_solicitudes(id_solicitud) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. VISTA: Bandeja del coordinador
CREATE OR REPLACE VIEW ia_becas_bandeja_coordinador_view AS
SELECT
  s.id_solicitud,
  s.codigo_solicitud,
  s.id_alumno,
  s.matricula,
  s.nombre_alumno,
  s.correo_alumno,
  s.id_carrera,
  s.nombre_carrera,
  s.id_grupo,
  s.nombre_grupo,
  s.turno,
  s.id_periodo,
  s.periodo_nombre,
  s.semestre_actual,
  s.promedio_actual,
  s.creditos_acumulados,
  s.estatus_academico,
  s.estatus_solicitud,
  s.prioridad,
  s.monto_solicitado,
  s.criterios_validados,
  s.nota_solicitante,
  s.nota_revisor,
  s.fecha_solicitud,
  s.fecha_revision,
  s.fecha_resolucion,
  s.id_coordinador_asignado,
  s.nombre_coordinador_asignado,
  s.canalizado_a,
  s.fecha_canalizacion,
  c.id_convocatoria,
  c.titulo AS convocatoria_titulo,
  c.institucion AS convocatoria_institucion,
  c.categoria AS convocatoria_categoria,
  (SELECT COUNT(*) FROM ia_becas_observaciones o WHERE o.id_solicitud = s.id_solicitud) AS total_observaciones,
  (SELECT COUNT(*) FROM ia_becas_canalizaciones ca WHERE ca.id_solicitud = s.id_solicitud) AS total_canalizaciones,
  d.id_dictamen,
  d.tipo_dictamen,
  d.observaciones AS dictamen_observaciones
FROM ia_becas_solicitudes s
LEFT JOIN ia_becas_convocatorias c ON c.id_convocatoria = s.id_convocatoria
LEFT JOIN ia_becas_dictamenes d ON d.id_solicitud = s.id_solicitud;

-- 5. VISTA: Candidatos (alumnos potenciales para becas)
CREATE OR REPLACE VIEW ia_becas_candidatos_view AS
SELECT
  a.id_alumno,
  a.matricula,
  CONCAT(a.nombres, ' ', a.apellido_paterno, ' ', a.apellido_materno) AS nombre_completo,
  a.correo,
  a.id_carrera,
  c.nombre_carrera,
  a.semestre_actual,
  a.creditos_acumulados,
  g.id_grupo,
  g.nombre_grupo,
  g.turno,
  p.id_periodo,
  p.nombre_periodo,
  (SELECT AVG(k.promedio_final) FROM kardex_alumno k WHERE k.id_alumno = a.id_alumno AND k.promedio_final > 0) AS promedio_general,
  a.estatus AS estatus_alumno,
  (SELECT COUNT(*) FROM ia_becas_solicitudes s WHERE s.id_alumno = a.id_alumno) AS solicitudes_previas,
  (SELECT COUNT(*) FROM ia_becas_solicitudes s WHERE s.id_alumno = a.id_alumno AND s.estatus_solicitud = 'APROBADA') AS becas_aprobadas
FROM alumnos a
LEFT JOIN carreras c ON c.id_carrera = a.id_carrera
LEFT JOIN grupos_alumnos ga ON ga.id_alumno = a.id_alumno AND ga.estado = 'ACTIVO'
LEFT JOIN grupos g ON g.id_grupo = ga.id_grupo
LEFT JOIN periodos p ON p.id_periodo = ga.id_periodo
WHERE a.estatus = 'ACTIVO'
GROUP BY a.id_alumno;
