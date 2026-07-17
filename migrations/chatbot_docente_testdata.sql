USE sivacad_isc;
START TRANSACTION;

-- ============================================================
-- DATOS DE PRUEBA PARA EL CHATBOT DOCENTE
-- Periodo activo: 12 (2025-2026/2)
-- ============================================================

-- 1. GRUPOS_ALUMNOS: Asignar alumnos a grupos del periodo 12
-- Grupo 1101 (id=3, sem1), 1102 (id=4, sem1), 1151 (id=5, sem1 Vesp.)
-- 1201 (id=6, sem2), 1301 (id=9, sem3), 1401 (id=12, sem4), 1501 (id=15, sem5)

DELETE FROM grupos_alumnos WHERE id_periodo = 12;
INSERT INTO grupos_alumnos (id_periodo, id_grupo, id_alumno, estado) VALUES
-- Grupo 1101 (alumnos 4-17, 14 alumnos)
(12, 3, 4, 'ACTIVO'), (12, 3, 5, 'ACTIVO'), (12, 3, 6, 'ACTIVO'),
(12, 3, 7, 'ACTIVO'), (12, 3, 8, 'ACTIVO'), (12, 3, 9, 'ACTIVO'),
(12, 3, 10, 'ACTIVO'), (12, 3, 11, 'ACTIVO'), (12, 3, 12, 'ACTIVO'),
(12, 3, 13, 'ACTIVO'), (12, 3, 14, 'ACTIVO'), (12, 3, 15, 'ACTIVO'),
(12, 3, 16, 'ACTIVO'), (12, 3, 17, 'ACTIVO'),
-- Grupo 1102 (alumnos 18-31)
(12, 4, 18, 'ACTIVO'), (12, 4, 19, 'ACTIVO'), (12, 4, 20, 'ACTIVO'),
(12, 4, 21, 'ACTIVO'), (12, 4, 22, 'ACTIVO'), (12, 4, 23, 'ACTIVO'),
(12, 4, 24, 'ACTIVO'), (12, 4, 25, 'ACTIVO'), (12, 4, 26, 'ACTIVO'),
(12, 4, 27, 'ACTIVO'), (12, 4, 28, 'ACTIVO'), (12, 4, 29, 'ACTIVO'),
(12, 4, 30, 'ACTIVO'), (12, 4, 31, 'ACTIVO'),
-- Grupo 1151 Vespertino (alumnos 32-45)
(12, 5, 32, 'ACTIVO'), (12, 5, 33, 'ACTIVO'), (12, 5, 34, 'ACTIVO'),
(12, 5, 35, 'ACTIVO'), (12, 5, 36, 'ACTIVO'), (12, 5, 37, 'ACTIVO'),
(12, 5, 38, 'ACTIVO'), (12, 5, 39, 'ACTIVO'), (12, 5, 40, 'ACTIVO'),
(12, 5, 41, 'ACTIVO'), (12, 5, 42, 'ACTIVO'), (12, 5, 43, 'ACTIVO'),
(12, 5, 44, 'ACTIVO'), (12, 5, 45, 'ACTIVO'),
-- Grupo 1201 (alumnos 46-59)
(12, 6, 46, 'ACTIVO'), (12, 6, 47, 'ACTIVO'), (12, 6, 48, 'ACTIVO'),
(12, 6, 49, 'ACTIVO'), (12, 6, 50, 'ACTIVO'), (12, 6, 51, 'ACTIVO'),
(12, 6, 52, 'ACTIVO'), (12, 6, 53, 'ACTIVO'), (12, 6, 54, 'ACTIVO'),
(12, 6, 55, 'ACTIVO'), (12, 6, 56, 'ACTIVO'), (12, 6, 57, 'ACTIVO'),
(12, 6, 58, 'ACTIVO'), (12, 6, 59, 'ACTIVO'),
-- Grupo 1301 (alumnos 60-73)
(12, 9, 60, 'ACTIVO'), (12, 9, 61, 'ACTIVO'), (12, 9, 62, 'ACTIVO'),
(12, 9, 63, 'ACTIVO'), (12, 9, 64, 'ACTIVO'), (12, 9, 65, 'ACTIVO'),
(12, 9, 66, 'ACTIVO'), (12, 9, 67, 'ACTIVO'), (12, 9, 68, 'ACTIVO'),
(12, 9, 69, 'ACTIVO'), (12, 9, 70, 'ACTIVO'), (12, 9, 71, 'ACTIVO'),
(12, 9, 72, 'ACTIVO'), (12, 9, 73, 'ACTIVO'),
-- Grupo 1401 (alumnos 74-87)
(12, 12, 74, 'ACTIVO'), (12, 12, 75, 'ACTIVO'), (12, 12, 76, 'ACTIVO'),
(12, 12, 77, 'ACTIVO'), (12, 12, 78, 'ACTIVO'), (12, 12, 79, 'ACTIVO'),
(12, 12, 80, 'ACTIVO'), (12, 12, 81, 'ACTIVO'), (12, 12, 82, 'ACTIVO'),
(12, 12, 83, 'ACTIVO'), (12, 12, 84, 'ACTIVO'), (12, 12, 85, 'ACTIVO'),
(12, 12, 86, 'ACTIVO'), (12, 12, 87, 'ACTIVO'),
-- Grupo 1501 (alumnos 88-101)
(12, 15, 88, 'ACTIVO'), (12, 15, 89, 'ACTIVO'), (12, 15, 90, 'ACTIVO'),
(12, 15, 91, 'ACTIVO'), (12, 15, 92, 'ACTIVO'), (12, 15, 93, 'ACTIVO'),
(12, 15, 94, 'ACTIVO'), (12, 15, 95, 'ACTIVO'), (12, 15, 96, 'ACTIVO'),
(12, 15, 97, 'ACTIVO'), (12, 15, 98, 'ACTIVO'), (12, 15, 99, 'ACTIVO'),
(12, 15, 100, 'ACTIVO'), (12, 15, 101, 'ACTIVO');

-- 2. CARGAS_ACADEMICAS: Asignar docentes a grupos
-- id_docente references docentes.id_docente
-- Docente 2 (Paloma Álvarez, id_usuario=9) -> 1101 y 1102
-- Docente 3 (Juan Carlos Cisneros, id_usuario=10) -> 1151
-- Docente 4 (Alfonso Espinoza, id_usuario=11) -> 1201
-- Docente 5 (Maribel García, id_usuario=12) -> 1301
-- Docente 6 (Yahilt Hernández, id_usuario=13) -> 1401
-- Docente 7 (Roberto Huerta, id_usuario=14) -> 1501

DELETE FROM cargas_academicas WHERE id_periodo = 12;
INSERT INTO cargas_academicas (id_periodo, id_grupo, id_materia, id_docente, estado) VALUES
(12, 3, 4, 2, 'ACTIVA'),  -- 1101 - Cálculo Diferencial
(12, 3, 5, 2, 'ACTIVA'),  -- 1101 - Fundamentos de Programación
(12, 4, 6, 2, 'ACTIVA'),  -- 1102
(12, 5, 7, 3, 'ACTIVA'),  -- 1151
(12, 6, 8, 4, 'ACTIVA'),  -- 1201
(12, 9, 9, 5, 'ACTIVA'),  -- 1301
(12, 12, 10, 6, 'ACTIVA'), -- 1401
(12, 15, 11, 7, 'ACTIVA'); -- 1501

-- 3. DOCENTE_ACTIVIDADES_EXTRACURRICULARES
DELETE FROM docente_actividades_extracurriculares;
INSERT INTO docente_actividades_extracurriculares (id_alumno, actividad, tipo, estatus) VALUES
(4, 'Hackaton Nacional 2026', 'HACKATON', 'INSCRITO'),
(5, 'Hackaton Nacional 2026', 'HACKATON', 'INSCRITO'),
(6, 'Hackaton Nacional 2026', 'HACKATON', 'PARTICIPANDO'),
(7, 'Hackaton Nacional 2026', 'HACKATON', 'PARTICIPANDO'),
(8, 'Hackaton Nacional 2026', 'HACKATON', 'INSCRITO'),
(46, 'InnovaTecNM 2026', 'INNOVATECNM', 'INSCRITO'),
(47, 'InnovaTecNM 2026', 'INNOVATECNM', 'INSCRITO'),
(48, 'InnovaTecNM 2026', 'INNOVATECNM', 'PARTICIPANDO'),
(60, 'TesiChallenge 2026', 'TESICHALLENGE', 'INSCRITO'),
(61, 'TesiChallenge 2026', 'TESICHALLENGE', 'INSCRITO'),
(62, 'TesiChallenge 2026', 'TESICHALLENGE', 'PARTICIPANDO'),
(63, 'TesiChallenge 2026', 'TESICHALLENGE', 'FINALIZADO');

-- 4. DOCENTE_CONVENIOS_EMPRESARIALES
DELETE FROM docente_convenios_empresariales;
INSERT INTO docente_convenios_empresariales (nombre_empresa, rfc, giro, tipo_convenio, estatus) VALUES
('Microsoft Mexico', 'MME-123456-XYZ', 'Tecnologia', 'AMBOS', 'VIGENTE'),
('Google Mexico', 'GME-789012-ABC', 'Tecnologia', 'AMBOS', 'VIGENTE'),
('Oracle de Mexico', 'OME-345678-DEF', 'Tecnologia', 'RESIDENCIA_PROFESIONAL', 'VIGENTE'),
('Amazon Web Services Mexico', 'AWS-901234-GHI', 'Tecnologia', 'RESIDENCIA_PROFESIONAL', 'VIGENTE'),
('Grupo Salinas', 'GSA-567890-JKL', 'Servicios', 'SERVICIO_SOCIAL', 'VIGENTE'),
('Bancomer BBVA', 'BBV-123456-MNO', 'Financiero', 'SERVICIO_SOCIAL', 'VIGENTE'),
('Softtek Mexico', 'STM-789012-PQR', 'Tecnologia', 'AMBOS', 'VIGENTE'),
('Infosys Mexico', 'IMX-345678-STU', 'Tecnologia', 'AMBOS', 'VIGENTE');

-- 5. DOCENTE_SERVICIO_SOCIAL
DELETE FROM docente_servicio_social;
INSERT INTO docente_servicio_social (id_alumno, id_convenio, empresa, programa, horas_totales, horas_cumplidas, estatus) VALUES
(74, 5, 'Grupo Salinas', 'Desarrollo Web', 480, 320, 'EN_CURSO'),
(75, 5, 'Grupo Salinas', 'Soporte Tecnico', 480, 480, 'FINALIZADO'),
(76, 6, 'Bancomer BBVA', 'Analisis de Datos', 480, 150, 'EN_CURSO'),
(77, 6, 'Bancomer BBVA', 'Seguridad Informatica', 480, 80, 'EN_CURSO'),
(78, 7, 'Softtek Mexico', 'QA Testing', 480, 200, 'EN_CURSO'),
(79, 8, 'Infosys Mexico', 'Desarrollo Backend', 480, 0, 'ASIGNADO');

-- 6. DOCENTE_RESIDENCIA_PROFESIONAL
DELETE FROM docente_residencia_profesional;
INSERT INTO docente_residencia_profesional (id_alumno, id_convenio, empresa, proyecto, estatus) VALUES
(88, 1, 'Microsoft Mexico', 'Sistema de Gestion de Incidencias con IA', 'EN_CURSO'),
(89, 1, 'Microsoft Mexico', 'Optimizacion de Base de Datos', 'EN_CURSO'),
(90, 2, 'Google Mexico', 'Plataforma de Analitica Educativa', 'ASIGNADO'),
(91, 3, 'Oracle de Mexico', 'Migracion a Nube Oracle', 'EN_CURSO'),
(92, 4, 'Amazon Web Services Mexico', 'Arquitectura Serverless', 'EN_CURSO'),
(93, 4, 'Amazon Web Services Mexico', 'Procesamiento de Datos en Tiempo Real', 'FINALIZADO');

-- 7. DOCENTE_TITULACION
DELETE FROM docente_titulacion;
INSERT INTO docente_titulacion (id_alumno, id_periodo, modalidad, estatus, promedio_general) VALUES
(101, 12, 'PROMEDIO', 'APTO', 95.50),
(102, 12, 'PROMEDIO', 'APTO', 93.20),
(103, 12, 'PROMEDIO', 'APTO', 91.00),
(104, 12, 'MEMORIA_RESIDENCIA', 'APTO', 88.50),
(105, 12, 'MEMORIA_RESIDENCIA', 'APTO', 87.30),
(106, 12, 'TESIS', 'APTO', 85.00),
(107, 12, 'TESIS', 'APTO', 90.10),
(108, 12, 'PROYECTO_INVESTIGACION', 'APTO', 84.50),
(109, 12, 'CENEVAL', 'APTO', 82.00),
(110, 12, 'CENEVAL', 'APTO', 80.50),
(111, 12, 'PROMEDIO', 'EN_PROCESO', 92.00),
(112, 12, 'MEMORIA_RESIDENCIA', 'EN_PROCESO', 86.00);

-- 8. DOCENTE_IDIOMAS
DELETE FROM docente_idiomas;
INSERT INTO docente_idiomas (id_alumno, idioma, nivel, niveles_completados, certificacion) VALUES
(46, 'INGLES', 'AVANZADO', 6, 'Cambridge C1'),
(47, 'INGLES', 'AVANZADO', 5, 'Cambridge B2'),
(48, 'INGLES', 'INTERMEDIO', 5, 'Cambridge B2'),
(49, 'INGLES', 'INTERMEDIO', 4, 'Cambridge B1'),
(50, 'INGLES', 'AVANZADO', 6, 'TOEFL 95'),
(60, 'INGLES', 'AVANZADO', 5, 'Cambridge C1'),
(61, 'INGLES', 'INTERMEDIO', 3, NULL),
(62, 'INGLES', 'BASICO', 2, NULL);

-- 9. DOCENTE_CREDITOS_COMPLEMENTARIOS
DELETE FROM docente_creditos_complementarios;
INSERT INTO docente_creditos_complementarios (id_alumno, tipo, descripcion, horas, estatus) VALUES
(4, 'ACADEMICO', 'Curso de Python Avanzado', 40, 'CUBIERTO'),
(4, 'CULTURAL', 'Taller de Fotografia', 20, 'CUBIERTO'),
(4, 'DEPORTIVO', 'Torneo de Futbol InterTecNM', 30, 'CUBIERTO'),
(5, 'ACADEMICO', 'Diplomado en Ciberseguridad', 60, 'CUBIERTO'),
(5, 'CULTURAL', 'Curso de Musica', 20, 'CUBIERTO'),
(5, 'DEPORTIVO', 'Basquetbol', 25, 'CUBIERTO'),
(6, 'ACADEMICO', 'Taller de Machine Learning', 40, 'CUBIERTO'),
(6, 'CULTURAL', 'Teatro', 20, 'CUBIERTO'),
(6, 'DEPORTIVO', 'Voleibol', 25, 'CUBIERTO'),
(7, 'ACADEMICO', 'Curso de Docker', 30, 'CUBIERTO'),
(7, 'CULTURAL', 'Pintura', 20, 'PENDIENTE'),
(8, 'ACADEMICO', 'Curso de Git', 20, 'CUBIERTO'),
(8, 'DEPORTIVO', 'Atletismo', 30, 'CUBIERTO');

-- 10. DOCENTE_SEGUNDAS_OPORTUNIDADES
DELETE FROM docente_segundas_oportunidades;
INSERT INTO docente_segundas_oportunidades (id_alumno, id_materia, tipo, calificacion_anterior, calificacion_actual, estatus) VALUES
(20, 4, 'SEGUNDA_OPORTUNIDAD', 5.0, 8.0, 'APROBADO'),
(21, 5, 'SEGUNDA_OPORTUNIDAD', 4.5, NULL, 'EN_CURSO'),
(22, 6, 'MATERIA_ESPECIAL', 6.0, 7.5, 'APROBADO'),
(23, 7, 'RECURSE', 5.5, NULL, 'PENDIENTE'),
(24, 8, 'SEGUNDA_OPORTUNIDAD', 3.0, NULL, 'PENDIENTE'),
(25, 9, 'RECURSE', 4.0, 6.5, 'APROBADO'),
(26, 10, 'SEGUNDA_OPORTUNIDAD', 5.5, NULL, 'EN_CURSO');

-- 11. DOCENTE_BECA_EXTRANJERO
DELETE FROM docente_beca_extranjero;
INSERT INTO docente_beca_extranjero (id_alumno, pais, universidad, programa, niveles_ingles, promedio_minimo, estatus) VALUES
(46, 'Canada', 'University of Toronto', 'Exchange Semester', 6, 9.0, 'APTO'),
(47, 'España', 'Universidad Politecnica de Madrid', 'Summer Course', 5, 8.5, 'APTO'),
(48, 'Alemania', 'TU Munich', 'Research Internship', 5, 8.0, 'APTO'),
(49, 'Francia', 'Sorbonne University', 'Exchange Semester', 4, 8.0, 'RECHAZADO'),
(50, 'Inglaterra', 'University of Oxford', 'English Immersion', 6, 9.5, 'APTO'),
(60, 'Estados Unidos', 'MIT', 'Research Program', 5, 9.2, 'APTO'),
(61, 'Australia', 'University of Sydney', 'Exchange Semester', 3, 8.0, 'POSTULADO');

-- 12. DOCENTE_ASISTENCIAS (ausencias justificadas con notificacion al coordinador)
DELETE FROM docente_asistencias;
INSERT INTO docente_asistencias (id_alumno, id_grupo, id_materia, id_periodo, fecha, asistio, justificante, notifico_coordinador, motivo_ausencia) VALUES
(4, 3, 4, 12, '2026-02-10', 0, 'Justificante medico', 1, 'Enfermedad'),
(5, 3, 4, 12, '2026-02-10', 0, 'Justificante familiar', 1, 'Asunto familiar'),
(6, 3, 5, 12, '2026-02-11', 0, 'Justificante medico', 1, 'Cita medica'),
(7, 3, 5, 12, '2026-02-12', 0, 'Justificante por tramite', 1, 'Tramite escolar'),
(18, 4, 6, 12, '2026-02-13', 0, 'Justificante laboral', 1, 'Trabajo'),
(19, 4, 6, 12, '2026-02-14', 0, 'Justificante medico', 1, 'Enfermedad'),
(20, 4, 6, 12, '2026-02-15', 0, 'Justificante familiar', 1, 'Fallecimiento familiar'),
(32, 5, 7, 12, '2026-02-16', 0, 'Justificante medico', 1, 'Cirugia'),
(33, 5, 7, 12, '2026-02-17', 0, 'Justificante por tramite', 1, 'Tramite beca');

-- 13. DOCENTE_SALUD_ESTUDIANTIL (embarazos y condiciones de salud)
DELETE FROM docente_salud_estudiantil;
INSERT INTO docente_salud_estudiantil (id_alumno, condicion, tipo, requiere_atencion, confidencial) VALUES
(10, 'Embarazo de 3 meses', 'EMBARAZO', 1, 1),
(14, 'Embarazo de 5 meses', 'EMBARAZO', 1, 0),
(27, 'Embarazo de 2 meses', 'EMBARAZO', 1, 1),
(34, 'Embarazo de 4 meses', 'EMBARAZO', 1, 0),
(41, 'Embarazo de 1 mes', 'EMBARAZO', 0, 0),
(52, 'Embarazo de 6 meses', 'EMBARAZO', 1, 0),
(65, 'Embarazo de 3 meses', 'EMBARAZO', 1, 1),
(80, 'Embarazo de 2 meses', 'EMBARAZO', 1, 0),
(95, 'Embarazo de 5 meses', 'EMBARAZO', 1, 1);

-- 14. IA_ALERTAS_DESERCION (alumnos con riesgo de desercion)
DELETE FROM ia_alertas_desercion WHERE id_periodo = 12;
INSERT INTO ia_alertas_desercion (id_alumno, id_periodo, nivel_riesgo, puntaje_riesgo, descripcion, estado_seguimiento, factores_json) VALUES
(22, 12, 'Alto', 85.00, 'Bajo rendimiento academico y ausencias frecuentes', 'Pendiente', '["Bajo promedio","Ausencias recurrentes","Problemas economicos"]'),
(23, 12, 'Alto', 82.00, 'Reprobacion de materias y desmotivacion', 'Pendiente', '["Materias reprobadas","Falta de motivacion"]'),
(33, 12, 'Medio', 65.00, 'Inasistencias sin justificar', 'En_revision', '["Inasistencias","Problemas familiares"]'),
(50, 12, 'Critico', 95.00, 'Riesgo inminente de baja definitiva', 'Pendiente', '["Bajo rendimiento","Problemas economicos severos","Desmotivacion"]'),
(55, 12, 'Medio', 60.00, 'Problemas de conexion en clases virtuales', 'Pendiente', '["Problemas tecnologicos","Falta de equipo"]'),
(67, 12, 'Alto', 78.00, 'Reprobacion de 3 materias en el periodo', 'Pendiente', '["Materias reprobadas","Problemas de aprendizaje"]'),
(82, 12, 'Medio', 55.00, 'Dificultades economicas reportadas', 'En_revision', '["Problemas economicos"]'),
(94, 12, 'Alto', 80.00, 'Ausencias reiteradas y bajo promedio', 'Pendiente', '["Ausencias","Bajo promedio","Problemas familiares"]'),
(99, 12, 'Critico', 92.00, 'No ha presentado evaluaciones del periodo', 'Pendiente', '["No presenta evaluaciones","Riesgo de baja"]'),
(100, 12, 'Medio', 58.00, 'Cambio de carrera solicitado', 'En_revision', '["Cambio de carrera"]');

COMMIT;
