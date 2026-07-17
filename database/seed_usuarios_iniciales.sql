USE sivacad_isc;

START TRANSACTION;

-- =========================================================
-- USUARIOS INICIALES PARA PRUEBAS DEL SISTEMA
-- =========================================================
-- Contraseña para TODOS: Testing123!
-- Hash generado con bcrypt (coste 12)
-- =========================================================

INSERT IGNORE INTO usuarios
  (nombres, apellido_paterno, apellido_materno, correo_institucional, contrasena_hash, estado, id_rol)
VALUES
  ('Admin', 'Sistema', 'TESI', 'admin@tesi.edu.mx',
   '$2a$12$MfW/QOZpsCdc59k/5cJ6E.HgA6yUHcvGjW/28mVR6hce5mi9eVAQC',
   'Activo', 1),
  ('Coordi', 'Nador', 'Academico', 'coordinador@tesi.edu.mx',
   '$2a$12$MfW/QOZpsCdc59k/5cJ6E.HgA6yUHcvGjW/28mVR6hce5mi9eVAQC',
   'Activo', 2),
  ('Docente', 'Plantel', 'Base', 'docente@tesi.edu.mx',
   '$2a$12$MfW/QOZpsCdc59k/5cJ6E.HgA6yUHcvGjW/28mVR6hce5mi9eVAQC',
   'Activo', 3),
  ('Alumno', 'Prueba', 'ISC', 'alumno@tesi.edu.mx',
   '$2a$12$MfW/QOZpsCdc59k/5cJ6E.HgA6yUHcvGjW/28mVR6hce5mi9eVAQC',
   'Activo', 4),
  ('Soporte', 'Tecnico', 'SIVACAD', 'soporte@tesi.edu.mx',
   '$2a$12$MfW/QOZpsCdc59k/5cJ6E.HgA6yUHcvGjW/28mVR6hce5mi9eVAQC',
   'Activo', 5);

INSERT IGNORE INTO docentes (id_usuario, clave_docente, numero_empleado, especialidad, estatus)
SELECT id_usuario, 'DOC-ADMIN-001', 'EMP-ADMIN-001', 'Ingeniería en Sistemas', 'Activo'
FROM usuarios WHERE correo_institucional = 'docente@tesi.edu.mx';

INSERT IGNORE INTO alumnos (id_usuario, apellido_paterno, apellido_materno, nombres, matricula, curp, id_carrera, id_plan, semestre_actual, estatus_academico)
SELECT id_usuario, apellido_paterno, apellido_materno, nombres, 'ISC-20240001', 'AEPI010101HDFLRL09', 1, 1, 6, 'Regular'
FROM usuarios WHERE correo_institucional = 'alumno@tesi.edu.mx';

INSERT IGNORE INTO kardex_alumno (id_alumno, numero_control, foto_alumno, promedio_general, creditos_acumulados, estatus, qr_token, url_qr)
SELECT a.id_alumno, a.matricula, NULL, 0.00, 0, 'Vigente', UUID(), NULL
FROM alumnos a
INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
WHERE u.correo_institucional = 'alumno@tesi.edu.mx';

COMMIT;
