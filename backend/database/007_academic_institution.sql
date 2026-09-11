-- =====================================================
-- MIGRACIÓN 007: INSTITUCIÓN EN TABLAS ACADÉMICAS
-- Fecha: 2026-09-09
-- Descripción: Agregar id_institucion a tablas académicas
--              para soporte multi-institución
-- =====================================================

-- Nota: Se usa DEFAULT 1 para compatibilidad con datos existentes de TESI
-- Las tablas que ya tienen id_institucion (usuarios) se omiten

-- =====================================================
-- 1. CATÁLOGOS ACADÉMICOS
-- =====================================================
ALTER TABLE carreras
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_carrera,
  ADD CONSTRAINT fk_carrera_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE planes_estudio
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_plan,
  ADD CONSTRAINT fk_plan_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE periodos
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_periodo,
  ADD CONSTRAINT fk_periodo_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE materias
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_materia,
  ADD CONSTRAINT fk_materia_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

-- =====================================================
-- 2. ALUMNOS Y DOCENTES
-- =====================================================
ALTER TABLE alumnos
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_alumno,
  ADD CONSTRAINT fk_alumno_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE docentes
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_docente,
  ADD CONSTRAINT fk_docente_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

-- =====================================================
-- 3. GRUPOS Y CARGAS
-- =====================================================
ALTER TABLE grupos
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_grupo,
  ADD CONSTRAINT fk_grupo_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE grupos_alumnos
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id,
  ADD CONSTRAINT fk_grupo_alumno_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE cargas_academicas
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_carga,
  ADD CONSTRAINT fk_carga_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

-- =====================================================
-- 4. INSCRIPCIONES Y REINSCRIPCIONES
-- =====================================================
ALTER TABLE inscripciones
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_inscripcion,
  ADD CONSTRAINT fk_inscripcion_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE reinscripciones
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_reinscripcion,
  ADD CONSTRAINT fk_reinscripcion_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

-- =====================================================
-- 5. KARDEX
-- =====================================================
ALTER TABLE kardex_alumno
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_kardex,
  ADD CONSTRAINT fk_kardex_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE kardex_historial_academico
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_historial,
  ADD CONSTRAINT fk_kardex_hist_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE kardex_auditoria
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_auditoria,
  ADD CONSTRAINT fk_kardex_aud_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE kardex_sellos
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_sello,
  ADD CONSTRAINT fk_kardex_sello_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE kardex_grupo_qr
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id,
  ADD CONSTRAINT fk_kardex_qr_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

-- =====================================================
-- 6. EVALUACIONES
-- =====================================================
ALTER TABLE evaluaciones
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_evaluacion,
  ADD CONSTRAINT fk_evaluacion_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE evaluacion_plantillas
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_plantilla,
  ADD CONSTRAINT fk_eval_plantilla_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE evaluacion_plantilla_preguntas
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_pregunta,
  ADD CONSTRAINT fk_eval_pregunta_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE evaluacion_resultados
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_resultado,
  ADD CONSTRAINT fk_eval_resultado_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE respuestas_evaluacion
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_respuesta,
  ADD CONSTRAINT fk_eval_respuesta_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE evaluacion_auditoria
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_auditoria,
  ADD CONSTRAINT fk_eval_aud_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE evaluacion_preguntas
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_pregunta,
  ADD CONSTRAINT fk_eval_preg_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE evaluacion_log_errores
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_log,
  ADD CONSTRAINT fk_eval_log_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE evaluacion_exportaciones
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_exportacion,
  ADD CONSTRAINT fk_eval_export_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE evaluacion_alertas
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_alerta,
  ADD CONSTRAINT fk_eval_alerta_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

-- =====================================================
-- 7. TRÁMITES
-- =====================================================
ALTER TABLE tramites
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_tramite,
  ADD CONSTRAINT fk_tramite_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE tramites_tipos
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_tipo,
  ADD CONSTRAINT fk_tramite_tipo_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE tramites_configuracion
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_configuracion,
  ADD CONSTRAINT fk_tramite_config_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE tramites_documentos
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_documento,
  ADD CONSTRAINT fk_tramite_doc_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE tramites_historial_estados
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_historial,
  ADD CONSTRAINT fk_tramite_hist_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE tramites_observaciones
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_observacion,
  ADD CONSTRAINT FK_tramite_obs_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE tramites_auditoria
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_auditoria,
  ADD CONSTRAINT fk_tramite_aud_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

-- =====================================================
-- 8. CHATBOT E IA
-- =====================================================
ALTER TABLE chatbot_configuracion
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_configuracion,
  ADD CONSTRAINT fk_chatbot_config_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE chatbot_mensajes
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_mensaje,
  ADD CONSTRAINT fk_chatbot_msg_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE chatbot_auditoria
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_auditoria,
  ADD CONSTRAINT fk_chatbot_aud_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE chatbot_incidencias
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_incidencia,
  ADD CONSTRAINT fk_chatbot_inc_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

-- IA Deserción
ALTER TABLE ia_alertas_desercion
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_alerta,
  ADD CONSTRAINT fk_ia_desercion_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE ia_desercion_parciales
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_parcial,
  ADD CONSTRAINT fk_ia_desercion_parc_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE ia_auditoria_desercion
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_auditoria,
  ADD CONSTRAINT fk_ia_desercion_aud_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE ia_seguimientos_desercion
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_seguimiento,
  ADD CONSTRAINT fk_ia_desercion_seg_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

-- IA Bienestar
ALTER TABLE ia_bienestar_sesiones
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_sesion,
  ADD CONSTRAINT fk_ia_bienestar_ses_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE ia_bienestar_checkins
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_checkin,
  ADD CONSTRAINT fk_ia_bienestar_chk_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE ia_bienestar_mensajes
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_mensaje,
  ADD CONSTRAINT fk_ia_bienestar_msg_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE ia_bienestar_alertas
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_alerta,
  ADD CONSTRAINT fk_ia_bienestar_alerta_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE ia_bienestar_derivaciones
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_derivacion,
  ADD CONSTRAINT fk_ia_bienestar_deriv_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE ia_bienestar_plantillas
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_plantilla,
  ADD CONSTRAINT fk_ia_bienestar_plant_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE ia_bienestar_plantilla_preguntas
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_pregunta,
  ADD CONSTRAINT fk_ia_bienestar_preg_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE ia_bienestar_recursos
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_recurso,
  ADD CONSTRAINT fk_ia_bienestar_recur_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

-- IA Becas
ALTER TABLE ia_becas_convocatorias
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_convocatoria,
  ADD CONSTRAINT fk_ia_becas_conv_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE ia_becas_solicitudes
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_solicitud,
  ADD CONSTRAINT fk_ia_becas_sol_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE ia_becas_auditoria
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_auditoria,
  ADD CONSTRAINT fk_ia_becas_aud_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE ia_becas_canalizaciones
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_canalizacion,
  ADD CONSTRAINT fk_ia_becas_can_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE ia_becas_dictamenes
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_dictamen,
  ADD CONSTRAINT fk_ia_becas_dic_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE ia_becas_documentos
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_documento,
  ADD CONSTRAINT fk_ia_becas_doc_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE ia_becas_exportaciones
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_exportacion,
  ADD CONSTRAINT fk_ia_becas_exp_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE ia_becas_observaciones
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_observacion,
  ADD CONSTRAINT fk_ia_becas_obs_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

-- =====================================================
-- 9. ACTAS OCR
-- =====================================================
ALTER TABLE actas_ocr_configuracion
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_configuracion,
  ADD CONSTRAINT fk_actas_config_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE actas_ocr_cargas
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_carga,
  ADD CONSTRAINT fk_actas_carga_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE actas_ocr_detalles
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_detalle,
  ADD CONSTRAINT fk_actas_det_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE actas_ocr_plantillas
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_plantilla,
  ADD CONSTRAINT fk_actas_plant_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE actas_ocr_validaciones
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_validacion,
  ADD CONSTRAINT fk_actas_val_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE actas_ocr_auditoria
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_auditoria,
  ADD CONSTRAINT fk_actas_aud_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE actas_calificaciones
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_calificacion,
  ADD CONSTRAINT fk_actas_cal_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE actas_calificaciones_detalle
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_detalle,
  ADD CONSTRAINT fk_actas_cal_det_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

-- =====================================================
-- 10. ASISTENTE
-- =====================================================
ALTER TABLE asistente_sesiones
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_sesion,
  ADD CONSTRAINT fk_asistente_ses_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE asistente_mensajes
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_mensaje,
  ADD CONSTRAINT fk_asistente_msg_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE asistente_contenidos
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_contenido,
  ADD CONSTRAINT fk_asistente_cont_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE asistente_auditoria
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_auditoria,
  ADD CONSTRAINT fk_asistente_aud_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

-- =====================================================
-- 11. DOCENTE (tablas específicas)
-- =====================================================
ALTER TABLE docente_actividades_extracurriculares
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_actividad,
  ADD CONSTRAINT fk_docente_act_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE docente_asistencias
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_asistencia,
  ADD CONSTRAINT fk_docente_asist_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE docente_beca_extranjero
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_beca,
  ADD CONSTRAINT fk_docente_beca_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE docente_convenios_empresariales
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_convenio,
  ADD CONSTRAINT fk_docente_conv_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE docente_creditos_complementarios
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_credito,
  ADD CONSTRAINT fk_docente_cred_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE docente_idiomas
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_idioma,
  ADD CONSTRAINT fk_docente_idioma_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE docente_notificaciones_reinscripcion
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_notificacion,
  ADD CONSTRAINT fk_docente_notif_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE docente_query_log
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_log,
  ADD CONSTRAINT fk_docente_log_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE docente_reinscripcion_resumen
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_resumen,
  ADD CONSTRAINT fk_docente_reins_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE docente_residencia_profesional
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_residencia,
  ADD CONSTRAINT fk_docente_resid_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE docente_salud_estudiantil
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_registro,
  ADD CONSTRAINT fk_docente_salud_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE docente_segundas_oportunidades
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_oportunidad,
  ADD CONSTRAINT fk_docente_2da_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE docente_servicio_social
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_servicio,
  ADD CONSTRAINT fk_docente_ss_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE docente_titulacion
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_titulacion,
  ADD CONSTRAINT fk_docente_tit_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE docentes_firmas_registradas
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_firma,
  ADD CONSTRAINT fk_docente_firma_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

-- =====================================================
-- 12. SOPORTE
-- =====================================================
ALTER TABLE soporte_kardex_incidencias
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_incidencia,
  ADD CONSTRAINT fk_soporte_kardex_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE soporte_tramites_archivos
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_archivo,
  ADD CONSTRAINT fk_soporte_tram_arch_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE soporte_tramites_incidencias
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_incidencia,
  ADD CONSTRAINT fk_soporte_tram_inc_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE soporte_tramites_logs
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_log,
  ADD CONSTRAINT fk_soporte_tram_log_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE soporte_tramites_monitoreo
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_monitoreo,
  ADD CONSTRAINT fk_soporte_tram_mon_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE soporte_tramites_recuperacion
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_recuperacion,
  ADD CONSTRAINT fk_soporte_tram_rec_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE soporte_reinscripciones_incidencias
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_incidencia,
  ADD CONSTRAINT fk_soporte_reins_inc_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE soporte_reinscripciones_logs
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_log,
  ADD CONSTRAINT fk_soporte_reins_log_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE soporte_reinscripciones_monitoreo
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_monitoreo,
  ADD CONSTRAINT fk_soporte_reins_mon_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE incidencias_soporte
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_incidencia,
  ADD CONSTRAINT fk_incidencias_soporte_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE logs_soporte_inscripciones
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_log,
  ADD CONSTRAINT fk_logs_soporte_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

-- =====================================================
-- 13. AUDITORÍA Y OTROS
-- =====================================================
ALTER TABLE bitacora_auditoria
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_auditoria,
  ADD CONSTRAINT fk_bitacora_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE inscripciones_auditoria
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_auditoria,
  ADD CONSTRAINT fk_inscrip_aud_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE reinscripcion_auditoria
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_auditoria,
  ADD CONSTRAINT fk_reins_aud_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE reinscripcion_requisitos
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_requisito,
  ADD CONSTRAINT fk_reins_req_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE notificaciones_docente
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_notificacion,
  ADD CONSTRAINT fk_notif_docente_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE cadena_documental
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_documento,
  ADD CONSTRAINT fk_cadena_doc_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE aceptaciones_legales
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_aceptacion,
  ADD CONSTRAINT fk_acept_legales_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

ALTER TABLE auditoria_global
  ADD COLUMN id_institucion INT DEFAULT 1 AFTER id_auditoria,
  ADD CONSTRAINT fk_aud_global_institucion FOREIGN KEY (id_institucion) REFERENCES instituciones(id_institucion);

-- =====================================================
-- 14. ÍNDICES PARA PERFORMANCE
-- =====================================================
CREATE INDEX idx_alumno_institucion ON alumnos(id_institucion);
CREATE INDEX idx_docente_institucion ON docentes(id_institucion);
CREATE INDEX idx_grupo_institucion ON grupos(id_institucion);
CREATE INDEX idx_inscripcion_institucion ON inscripciones(id_institucion);
CREATE INDEX idx_reinscripcion_institucion ON reinscripciones(id_institucion);
CREATE INDEX idx_kardex_institucion ON kardex_alumno(id_institucion);
CREATE INDEX idx_evaluacion_institucion ON evaluaciones(id_institucion);
CREATE INDEX idx_tramite_institucion ON tramites(id_institucion);
CREATE INDEX idx_chatbot_msg_institucion ON chatbot_mensajes(id_institucion);
CREATE INDEX idx_ia_desercion_institucion ON ia_alertas_desercion(id_institucion);
CREATE INDEX idx_ia_bienestar_institucion ON ia_bienestar_sesiones(id_institucion);
CREATE INDEX idx_ia_becas_institucion ON ia_becas_solicitudes(id_institucion);
CREATE INDEX idx_bitacora_institucion ON bitacora_auditoria(id_institucion);
