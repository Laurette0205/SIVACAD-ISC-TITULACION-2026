-- ============================================================
-- MIGRACIÓN: IA de Becas - Módulo Administrativo
-- Tablas para administración integral de becas con trazabilidad,
-- control, dictámenes, auditoría y exportaciones.
-- ============================================================

-- 1. CONVOCATORIAS DE BECAS (publicadas desde fuentes oficiales)
CREATE TABLE IF NOT EXISTS ia_becas_convocatorias (
  id_convocatoria BIGINT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(80) NOT NULL UNIQUE,
  titulo VARCHAR(255) NOT NULL,
  institucion VARCHAR(180) NOT NULL DEFAULT '',
  categoria VARCHAR(100) NOT NULL DEFAULT 'Gobierno del Estado de México',
  tipo VARCHAR(60) NOT NULL DEFAULT 'OFICIAL',
  url_oficial VARCHAR(700) NOT NULL DEFAULT '',
  descripcion TEXT,
  resumen TEXT,
  requisitos JSON DEFAULT NULL,
  beneficios JSON DEFAULT NULL,
  nivel JSON DEFAULT NULL,
  alcance VARCHAR(100) DEFAULT 'Estado de México',
  vigencia_inicio DATE DEFAULT NULL,
  vigencia_fin DATE DEFAULT NULL,
  vigencia_texto VARCHAR(255) DEFAULT 'Consultar convocatoria vigente',
  monto DECIMAL(12,2) DEFAULT NULL,
  activo TINYINT(1) DEFAULT 1,
  destacada TINYINT(1) DEFAULT 0,
  fecha_publicacion DATE DEFAULT NULL,
  metadata_json JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_becas_conv_activo (activo),
  INDEX idx_becas_conv_categoria (categoria),
  INDEX idx_becas_conv_institucion (institucion),
  INDEX idx_becas_conv_fecha (fecha_publicacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. SOLICITUDES DE BECAS (alumnos que aplican)
CREATE TABLE IF NOT EXISTS ia_becas_solicitudes (
  id_solicitud BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_convocatoria BIGINT DEFAULT NULL,
  codigo_solicitud VARCHAR(40) NOT NULL UNIQUE,
  id_usuario_solicitante BIGINT NOT NULL,
  id_alumno BIGINT DEFAULT NULL,
  matricula VARCHAR(40) DEFAULT NULL,
  nombre_alumno VARCHAR(255) NOT NULL DEFAULT '',
  correo_alumno VARCHAR(180) DEFAULT NULL,
  id_carrera BIGINT DEFAULT NULL,
  nombre_carrera VARCHAR(255) DEFAULT NULL,
  id_periodo BIGINT DEFAULT NULL,
  periodo_nombre VARCHAR(60) DEFAULT NULL,
  semestre_actual INT DEFAULT NULL,
  promedio_actual DECIMAL(5,2) DEFAULT NULL,
  creditos_acumulados INT DEFAULT 0,
  estatus_academico VARCHAR(60) DEFAULT 'Regular',
  estatus_solicitud VARCHAR(40) NOT NULL DEFAULT 'PENDIENTE',
  -- Estatus posibles: PENDIENTE, EN_REVISION, VALIDADA, RECHAZADA, APROBADA, CANCELADA
  monto_solicitado DECIMAL(12,2) DEFAULT NULL,
  monto_aprobado DECIMAL(12,2) DEFAULT NULL,
  criterios_validados JSON DEFAULT NULL,
  documentos_adjuntos JSON DEFAULT NULL,
  nota_solicitante TEXT DEFAULT NULL,
  nota_revisor TEXT DEFAULT NULL,
  fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_revision TIMESTAMP NULL DEFAULT NULL,
  fecha_resolucion TIMESTAMP NULL DEFAULT NULL,
  id_usuario_revisor BIGINT DEFAULT NULL,
  nombre_revisor VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_becas_sol_estatus (estatus_solicitud),
  INDEX idx_becas_sol_alumno (id_alumno),
  INDEX idx_becas_sol_periodo (id_periodo),
  INDEX idx_becas_sol_carrera (id_carrera),
  INDEX idx_becas_sol_convocatoria (id_convocatoria),
  INDEX idx_becas_sol_fecha (fecha_solicitud),
  CONSTRAINT fk_becas_sol_convocatoria FOREIGN KEY (id_convocatoria) REFERENCES ia_becas_convocatorias(id_convocatoria) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. DICTÁMENES DE BECAS (resoluciones de aprobación/rechazo)
CREATE TABLE IF NOT EXISTS ia_becas_dictamenes (
  id_dictamen BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_solicitud BIGINT NOT NULL,
  id_convocatoria BIGINT DEFAULT NULL,
  id_alumno BIGINT DEFAULT NULL,
  tipo_dictamen VARCHAR(30) NOT NULL DEFAULT 'APROBADA',
  -- Tipos: APROBADA, RECHAZADA, CONDICIONADA
  fundamento TEXT DEFAULT NULL,
  observaciones TEXT DEFAULT NULL,
  monto_asignado DECIMAL(12,2) DEFAULT NULL,
  periodo_beneficio VARCHAR(60) DEFAULT NULL,
  fecha_inicio_beneficio DATE DEFAULT NULL,
  fecha_fin_beneficio DATE DEFAULT NULL,
  validado_por_ia TINYINT(1) DEFAULT 0,
  resultado_ia JSON DEFAULT NULL,
  id_usuario_dictamina BIGINT NOT NULL,
  nombre_dictamina VARCHAR(255) DEFAULT NULL,
  fecha_dictamen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_becas_dictamen_solicitud (id_solicitud),
  INDEX idx_becas_dict_tipo (tipo_dictamen),
  INDEX idx_becas_dict_alumno (id_alumno),
  INDEX idx_becas_dict_fecha (fecha_dictamen),
  CONSTRAINT fk_becas_dict_solicitud FOREIGN KEY (id_solicitud) REFERENCES ia_becas_solicitudes(id_solicitud) ON DELETE CASCADE,
  CONSTRAINT fk_becas_dict_convocatoria FOREIGN KEY (id_convocatoria) REFERENCES ia_becas_convocatorias(id_convocatoria) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. DOCUMENTOS ADJUNTOS DE BECAS
CREATE TABLE IF NOT EXISTS ia_becas_documentos (
  id_documento BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_solicitud BIGINT DEFAULT NULL,
  id_dictamen BIGINT DEFAULT NULL,
  id_alumno BIGINT DEFAULT NULL,
  tipo_documento VARCHAR(60) NOT NULL DEFAULT '',
  nombre_archivo VARCHAR(255) NOT NULL,
  ruta_archivo VARCHAR(700) NOT NULL,
  tamano_bytes BIGINT DEFAULT 0,
  mime_type VARCHAR(100) DEFAULT 'application/pdf',
  hash_documento VARCHAR(64) DEFAULT NULL,
  notas TEXT DEFAULT NULL,
  subido_por BIGINT DEFAULT NULL,
  fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_becas_doc_solicitud (id_solicitud),
  INDEX idx_becas_doc_dictamen (id_dictamen),
  INDEX idx_becas_doc_alumno (id_alumno),
  CONSTRAINT fk_becas_doc_solicitud FOREIGN KEY (id_solicitud) REFERENCES ia_becas_solicitudes(id_solicitud) ON DELETE CASCADE,
  CONSTRAINT fk_becas_doc_dictamen FOREIGN KEY (id_dictamen) REFERENCES ia_becas_dictamenes(id_dictamen) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. AUDITORÍA DE BECAS (trazabilidad de acciones)
CREATE TABLE IF NOT EXISTS ia_becas_auditoria (
  id_auditoria BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_usuario BIGINT DEFAULT NULL,
  nombre_usuario VARCHAR(255) DEFAULT NULL,
  rol_usuario VARCHAR(60) DEFAULT NULL,
  accion VARCHAR(100) NOT NULL,
  entidad_tipo VARCHAR(60) NOT NULL DEFAULT '',
  entidad_id BIGINT DEFAULT NULL,
  descripcion TEXT DEFAULT NULL,
  detalle_json JSON DEFAULT NULL,
  ip_origen VARCHAR(45) DEFAULT NULL,
  user_agent VARCHAR(500) DEFAULT NULL,
  nivel VARCHAR(30) DEFAULT 'INFO',
  -- Niveles: INFO, WARNING, ERROR, CRITICAL
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_becas_audit_usuario (id_usuario),
  INDEX idx_becas_audit_accion (accion),
  INDEX idx_becas_audit_entidad (entidad_tipo, entidad_id),
  INDEX idx_becas_audit_fecha (created_at),
  INDEX idx_becas_audit_nivel (nivel)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. EXPORTACIONES DE BECAS (registro de reportes generados)
CREATE TABLE IF NOT EXISTS ia_becas_exportaciones (
  id_exportacion BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_usuario BIGINT NOT NULL,
  nombre_usuario VARCHAR(255) DEFAULT NULL,
  tipo_reporte VARCHAR(60) NOT NULL DEFAULT '',
  -- Tipos: SOLICITUDES, DICTAMENES, CONVOCATORIAS, AUDITORIA, METRICAS, GENERAL
  formato VARCHAR(20) NOT NULL DEFAULT 'PDF',
  -- Formatos: PDF, XLSX, CSV
  filtros_aplicados JSON DEFAULT NULL,
  total_registros INT DEFAULT 0,
  ruta_archivo VARCHAR(700) DEFAULT NULL,
  tamano_bytes BIGINT DEFAULT 0,
  fecha_generacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_becas_exp_usuario (id_usuario),
  INDEX idx_becas_exp_tipo (tipo_reporte),
  INDEX idx_becas_exp_fecha (fecha_generacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- VISTA: Métricas generales del módulo IA de Becas
-- ============================================================
CREATE OR REPLACE VIEW ia_becas_metricas_view AS
SELECT
  (SELECT COUNT(*) FROM ia_becas_convocatorias WHERE activo = 1) AS total_convocatorias_activas,
  (SELECT COUNT(*) FROM ia_becas_convocatorias) AS total_convocatorias,
  (SELECT COUNT(*) FROM ia_becas_solicitudes) AS total_solicitudes,
  (SELECT COUNT(*) FROM ia_becas_solicitudes WHERE estatus_solicitud = 'PENDIENTE') AS solicitudes_pendientes,
  (SELECT COUNT(*) FROM ia_becas_solicitudes WHERE estatus_solicitud = 'EN_REVISION') AS solicitudes_en_revision,
  (SELECT COUNT(*) FROM ia_becas_solicitudes WHERE estatus_solicitud = 'VALIDADA') AS solicitudes_validadas,
  (SELECT COUNT(*) FROM ia_becas_solicitudes WHERE estatus_solicitud = 'APROBADA') AS solicitudes_aprobadas,
  (SELECT COUNT(*) FROM ia_becas_solicitudes WHERE estatus_solicitud = 'RECHAZADA') AS solicitudes_rechazadas,
  (SELECT COUNT(*) FROM ia_becas_solicitudes WHERE estatus_solicitud = 'CANCELADA') AS solicitudes_canceladas,
  (SELECT COUNT(*) FROM ia_becas_dictamenes WHERE tipo_dictamen = 'APROBADA') AS dictamenes_aprobados,
  (SELECT COUNT(*) FROM ia_becas_dictamenes WHERE tipo_dictamen = 'RECHAZADA') AS dictamenes_rechazados,
  (SELECT COUNT(*) FROM ia_becas_dictamenes WHERE tipo_dictamen = 'CONDICIONADA') AS dictamenes_condicionados,
  (SELECT COUNT(*) FROM ia_becas_dictamenes) AS total_dictamenes,
  (SELECT COUNT(*) FROM ia_becas_auditoria) AS total_eventos_auditoria,
  (SELECT COALESCE(SUM(monto_asignado), 0) FROM ia_becas_dictamenes WHERE tipo_dictamen = 'APROBADA') AS monto_total_asignado,
  (SELECT COUNT(DISTINCT id_alumno) FROM ia_becas_solicitudes) AS alumnos_beneficiados,
  (SELECT COUNT(DISTINCT id_carrera) FROM ia_becas_solicitudes) AS carreras_participantes,
  (SELECT COUNT(*) FROM ia_becas_exportaciones) AS total_exportaciones;

-- ============================================================
-- VISTA: Historial de solicitudes con información de alumno y dictamen
-- ============================================================
CREATE OR REPLACE VIEW ia_becas_historial_view AS
SELECT
  s.id_solicitud,
  s.codigo_solicitud,
  s.id_alumno,
  s.matricula,
  s.nombre_alumno,
  s.correo_alumno,
  s.id_carrera,
  s.nombre_carrera,
  s.id_periodo,
  s.periodo_nombre,
  s.semestre_actual,
  s.promedio_actual,
  s.creditos_acumulados,
  s.estatus_academico,
  s.estatus_solicitud,
  s.monto_solicitado,
  s.monto_aprobado,
  s.fecha_solicitud,
  s.fecha_revision,
  s.fecha_resolucion,
  s.id_usuario_revisor,
  s.nombre_revisor,
  c.id_convocatoria,
  c.titulo AS convocatoria_titulo,
  c.institucion AS convocatoria_institucion,
  c.categoria AS convocatoria_categoria,
  d.id_dictamen,
  d.tipo_dictamen,
  d.fundamento,
  d.observaciones AS dictamen_observaciones,
  d.monto_asignado,
  d.validado_por_ia,
  d.fecha_dictamen,
  d.id_usuario_dictamina,
  d.nombre_dictamina
FROM ia_becas_solicitudes s
LEFT JOIN ia_becas_convocatorias c ON c.id_convocatoria = s.id_convocatoria
LEFT JOIN ia_becas_dictamenes d ON d.id_solicitud = s.id_solicitud;

-- ============================================================
-- INSERTAR CONVOCATORIAS INICIALES DESDE EL CATÁLOGO OFICIAL
-- ============================================================
INSERT IGNORE INTO ia_becas_convocatorias
  (codigo, titulo, institucion, categoria, tipo, url_oficial, descripcion, resumen, requisitos, beneficios, nivel, alcance, vigencia_texto, activo, destacada, fecha_publicacion)
VALUES
  ('SECTI_SUPERIOR_APROVECHAMIENTO_2025', 'Becas para el Bienestar por Aprovechamiento Académico para Educación Superior', 'SECTI / Gobierno del Estado de México', 'Gobierno del Estado de México', 'OFICIAL', 'https://secti.edomex.gob.mx/beca-bienestar-educacion-superior', 'Apoyo para permanencia y conclusión de estudios en universidades y tecnológicos escolarizados del Estado de México.', 'Apoyo mensual de $2,000 hasta en 10 ocasiones durante el ciclo escolar 2025-2026.', '["Ser estudiante regular de una institución pública de educación superior del Estado de México.", "Contar con promedio mínimo de 8.5 en el periodo inmediato anterior.", "Residir en el Estado de México.", "Registrar la solicitud en el portal oficial."]', '["$2,000 mensuales", "Hasta 10 ministraciones"]', '["Licenciatura", "Ingeniería", "TSU"]', 'Estatal', 'Consultar convocatoria vigente en el portal oficial.', 1, 1, NULL),
  ('SECTI_MEXIQUENSES_EXTRANJERO_2025', 'Becas para el Bienestar Mexiquenses en el Extranjero', 'SECTI / Gobierno del Estado de México', 'Gobierno del Estado de México', 'OFICIAL', 'https://secti.edomex.gob.mx/beca-bienestar-extranjero', 'Apoyo para estancias académicas en el extranjero para estudiantes de educación superior y docentes activos del Estado de México.', 'Cubre inscripción, colegiatura, materiales, hospedaje, alimentación, seguro médico y boleto de avión, según convocatoria.', '["Ser mayor de edad.", "Residir en el Estado de México.", "Ser estudiante regular de educación superior o docente activo.", "Contar con promedio mínimo de 8.5.", "Registrar la solicitud en tiempo y forma según convocatoria."]', '["Inscripción y colegiatura del curso", "Materiales del curso", "Hospedaje y alimentación", "Seguro internacional de gastos médicos", "Boleto de avión redondo", "Gastos personales"]', '["Licenciatura", "Ingeniería", "TSU", "Docentes activos"]', 'Estatal', 'Consultar convocatoria vigente en el portal oficial.', 1, 1, NULL),
  ('SECTI_EXENCION_EDOMEX', 'Programa Becas de Exención Edomex para Escuelas Particulares', 'SECTI / Gobierno del Estado de México', 'Gobierno del Estado de México', 'OFICIAL', 'https://secti.edomex.gob.mx/becas_escuelas_particulares', 'Becas de exención total o parcial de colegiatura para escuelas particulares incorporadas al sistema estatal.', 'Exención total o parcial de colegiatura; puede ser completa o parcial, no menor al 25% del costo.', '["Ser originario o acreditar vecindad en el Estado de México.", "No estar becado por organismo público o privado al momento de solicitar la beca.", "Ser alumno regular con promedio mínimo de 8.5.", "Registrar la solicitud y entregar documentos según convocatoria."]', '["Exención total o parcial de colegiatura", "Apoyo no menor al 25%"]', '["Preescolar", "Primaria", "Secundaria", "Bachillerato", "TSU", "Licenciatura", "Especialidad", "Maestría", "Doctorado"]', 'Estatal', 'Ver convocatoria por nivel educativo en el portal oficial.', 1, 0, NULL),
  ('COMECYT_CIENCIA_INCIDENCIA_BIENESTAR', 'Beca Ciencia con Incidencia para el Bienestar COMECYT', 'COMECYT / Gobierno del Estado de México', 'COMECYT', 'OFICIAL', 'https://comecyt.edomex.gob.mx/ciencias-edmex', 'Apoyo a estudiantes de educación superior con proyectos de incidencia orientados a su programa de estudios.', 'Requiere residencia en Edomex, promedio mínimo de 8.0 y programa de actividades de incidencia.', '["Habitar en el Estado de México.", "Tener hasta 25 años cumplidos.", "Estar inscrito en educación superior.", "Contar con promedio mínimo de 8.0.", "Presentar programa de actividades de incidencia."]', '["Apoyo monetario según convocatoria"]', '["Licenciatura", "TSU"]', 'Estatal', 'Consultar convocatoria vigente en el portal COMECYT.', 1, 0, NULL),
  ('COMECYT_POSGRADO_MAESTRIA', 'Becas COMECYT - Estudios de Maestría', 'COMECYT / Gobierno del Estado de México', 'COMECYT', 'OFICIAL', 'https://comecyt.edomex.gob.mx/becas-estudiantes', 'Programa estatal para apoyar estudios de posgrado en modalidad maestría.', 'Convocatoria oficial de COMECYT para estudios de maestría.', '["Consultar convocatoria vigente.", "Cumplir los criterios académicos del programa."]', '["Apoyo económico según reglas de operación"]', '["Maestría"]', 'Estatal', 'Consultar convocatoria vigente en el portal oficial de COMECYT.', 1, 0, NULL),
  ('COMECYT_POSGRADO_SALUD', 'Becas COMECYT - Ciencias de la Salud', 'COMECYT / Gobierno del Estado de México', 'COMECYT', 'OFICIAL', 'https://comecyt.edomex.gob.mx/becas-estudiantes', 'Convocatoria estatal para posgrado en ciencias de la salud.', 'Convocatoria oficial de COMECYT para posgrado en ciencias de la salud.', '["Consultar convocatoria vigente.", "Cumplir los criterios del programa."]', '["Apoyo económico según convocatoria"]', '["Posgrado", "Salud"]', 'Estatal', 'Consultar convocatoria vigente en el portal oficial de COMECYT.', 1, 0, NULL),
  ('COMECYT_EDUCACION_DUAL', 'Beca de Educación Dual COMECYT', 'COMECYT / Gobierno del Estado de México', 'COMECYT', 'OFICIAL', 'https://comecyt.edomex.gob.mx/educacion-dual', 'Apoyo para estudiantes incorporados a educación dual.', 'Convocatoria oficial para educación dual en el Estado de México.', '["Consultar convocatoria vigente en el portal oficial."]', '["Apoyo económico según convocatoria"]', '["Superior", "Educación dual"]', 'Estatal', 'Consultar convocatoria vigente en el portal oficial de COMECYT.', 1, 0, NULL),
  ('COMECYT_MUJERES_INDIGENAS_RURALES', 'Beca Mujeres Indígenas y Rurales Mexiquenses para Maestría', 'COMECYT / Gobierno del Estado de México', 'COMECYT', 'OFICIAL', 'https://comecyt.edomex.gob.mx/mujeres-indigenas-mexiquenses', 'Apoyo a mujeres mexiquenses pertenecientes a pueblos originarios o municipios con alta población rural para cursar maestría.', 'Programa de formación de recursos humanos para mujeres indígenas y rurales mexiquenses.', '["Pertenecer a pueblos originarios o habitar en municipios con alta población rural.", "Estar cursando maestría en una institución de educación superior del Estado de México."]', '["Apoyo monetario según convocatoria"]', '["Maestría"]', 'Estatal', 'Consultar convocatoria vigente en el portal oficial de COMECYT.', 1, 0, NULL),
  ('COMECYT_INTERNACIONAL', 'Beca Internacional COMECYT (Máster, Maestría y Doctorado)', 'COMECYT / Gobierno del Estado de México', 'COMECYT', 'OFICIAL', 'https://comecyt.edomex.gob.mx/beca-internacional-edomex', 'Beca internacional para programas de maestría o doctorado.', 'Programa COMECYT para movilidad y formación internacional.', '["Consultar convocatoria vigente.", "Cumplir con el área de conocimiento y reglas del programa."]', '["Apoyo económico según convocatoria"]', '["Maestría", "Doctorado"]', 'Estatal', 'Consultar convocatoria vigente en el portal oficial de COMECYT.', 1, 0, NULL),
  ('COMECYT_ESTANCIAS_INVESTIGACION', 'Apoyo para Estancias de Investigación COMECYT', 'COMECYT / Gobierno del Estado de México', 'COMECYT', 'OFICIAL', 'https://comecyt.edomex.gob.mx/programa-estancias', 'Programa para fortalecer capacidades de investigación científica y tecnológica.', 'Apoyo para estancias de investigación COMECYT.', '["Consultar convocatoria vigente.", "Cumplir con los requisitos de investigación del programa."]', '["Apoyo económico según convocatoria"]', '["Posgrado", "Investigación"]', 'Estatal', 'Consultar convocatoria vigente en el portal oficial de COMECYT.', 1, 0, NULL),
  ('SANTANDER_EXCELENCIA_2025', 'Beca Santander - Excelencia Académica 2025', 'Santander Open Academy', 'Santander', 'EXTERNA', 'https://app.santanderopenacademy.com/es/program/de-excelencia-academica-2025', 'Beca de Santander dirigida a estudiantes regulares con avance curricular y excelente promedio.', 'Requiere mínimo 30% de créditos y promedio mínimo de 8.8.', '["Ser estudiante con mínimo 30% de créditos en su plan de estudios.", "Ser estudiante regular con promedio mínimo de 8.8."]', '["Apoyo según convocatoria Santander"]', '["Superior"]', 'Nacional', 'Consultar convocatoria vigente en Santander Open Academy.', 1, 1, NULL),
  ('SANTANDER_MANUTENCION_2025', 'Beca Santander - Apoyo a la manutención 2025', 'Santander Open Academy', 'Santander', 'EXTERNA', 'https://app.santanderopenacademy.com/es/program/apoyo-a-la-manutencion-2025', 'Apoyo económico para manutención de estudiantes universitarios.', 'Monto único de $9,000 MXN, 300 becas disponibles.', '["Consultar convocatoria vigente en Santander Open Academy."]', '["$9,000 MXN en un solo apoyo"]', '["Superior"]', 'Nacional', 'Consultar convocatoria vigente en Santander Open Academy.', 1, 1, NULL),
  ('BBVA_FUNDACION_CHAVOS_INSPIRAN', 'Fundación BBVA - Chavos que Inspiran', 'Fundación BBVA', 'BBVA', 'EXTERNA', 'https://portal.bbva.mx/fundacion/', 'Programa de Fundación BBVA con becas económicas, asesoría académica, vocacional y psicológica.', 'Becas económicas desde secundaria hasta universidad con acompañamiento integral.', '["Consultar convocatoria vigente de Fundación BBVA.", "Mantener promedio mínimo y compromisos del programa."]', '["Beca económica", "Seguro médico de becarios", "Asesorías académicas, vocacionales y psicológicas"]', '["Secundaria", "Bachillerato", "Universidad"]', 'Nacional', 'Consultar convocatoria vigente en Fundación BBVA.', 1, 1, NULL),
  ('BBVA_FUNDACION_DISCAPACIDAD', 'Fundación BBVA - Chavos con Discapacidad que Inspiran', 'Fundación BBVA', 'BBVA', 'EXTERNA', 'https://portal.bbva.mx/fundacion/', 'Programa de inclusión educativa con apoyo económico y continuidad escolar.', 'Programa de beca e inclusión educativa para estudiantes con discapacidad.', '["Consultar convocatoria vigente de Fundación BBVA."]', '["Beca económica", "Continuidad escolar", "Acompañamiento"]', '["Secundaria", "Bachillerato", "Universidad"]', 'Nacional', 'Consultar convocatoria vigente en Fundación BBVA.', 1, 0, NULL),
  ('FEDERAL_BECAS_BENITO_JUAREZ_SUPERIOR', 'Beca Federal Benito Juárez - Educación Superior', 'Gobierno Federal del Estado de México / Coordinación Nacional de Becas', 'Gobierno Federal del Estado de México', 'FEDERAL', 'https://www.gob.mx/becasbenitojuarez', 'Apoyo económico del Gobierno Federal para estudiantes de educación superior en situación de vulnerabilidad.', 'Apoyo bimestral de $2,800 MXN durante el ciclo escolar para estudiantes de licenciatura.', '["Estar inscrito en una institución pública de educación superior.", "No contar con otro apoyo educativo federal.", "Estar en situación de vulnerabilidad económica.", "Ser alumno regular."]', '["$2,800 MXN bimestrales", "Hasta 6 bimestres por ciclo escolar"]', '["Licenciatura", "Ingeniería", "TSU"]', 'Nacional', 'Consultar convocatoria vigente en la página oficial.', 1, 1, NULL),
  ('FEDERAL_JOVENES_ESCRIBIENDO_FUTURO', 'Beca Federal Jóvenes Escribiendo el Futuro', 'Gobierno Federal del Estado de México / Coordinación Nacional de Becas', 'Gobierno Federal del Estado de México', 'FEDERAL', 'https://www.gob.mx/becasjovenes', 'Apoyo del Gobierno Federal para estudiantes de educación superior en modalidad escolarizada.', 'Apoyo bimestral de $2,800 MXN para estudiantes de licenciatura, ingeniería y TSU.', '["Estar inscrito en una IES pública prioritaria.", "Ser alumno regular.", "No recibir otra beca federal."]', '["$2,800 MXN bimestrales", "Acompañamiento académico"]', '["Licenciatura", "Ingeniería", "TSU"]', 'Nacional', 'Consultar convocatoria vigente en la página oficial.', 1, 1, NULL);
