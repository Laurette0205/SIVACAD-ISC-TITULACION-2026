-- =========================================================
-- SEED COMPLETO: SIVACAD-ISC
-- =========================================================
-- Ejecutar después de sivacad_isc.sql si se reinicia la BD
-- =========================================================
USE sivacad_isc;
START TRANSACTION;

-- =========================================================
-- 1. PERIODOS (Ciclos escolares 2021-2030)
-- =========================================================
INSERT IGNORE INTO periodos (nombre_periodo, fecha_inicio, fecha_fin, estado) VALUES
('2021-2022/1', '2021-01-01', '2021-06-30', 'Cerrado'),
('2021-2022/2', '2021-07-01', '2021-12-31', 'Cerrado'),
('2022-2023/1', '2022-01-01', '2022-06-30', 'Cerrado'),
('2022-2023/2', '2022-07-01', '2022-12-31', 'Cerrado'),
('2023-2024/1', '2023-01-01', '2023-06-30', 'Cerrado'),
('2023-2024/2', '2023-07-01', '2023-12-31', 'Cerrado'),
('2024-2025/1', '2024-01-01', '2024-06-30', 'Cerrado'),
('2024-2025/2', '2024-07-01', '2024-12-31', 'Cerrado'),
('2025-2026/1', '2025-01-01', '2025-06-30', 'Cerrado'),
('2025-2026/2', '2025-07-01', '2025-12-31', 'Activo'),
('2026-2027/1', '2026-01-01', '2026-06-30', 'Planeado'),
('2026-2027/2', '2026-07-01', '2026-12-31', 'Planeado'),
('2027-2028/1', '2027-01-01', '2027-06-30', 'Planeado'),
('2027-2028/2', '2027-07-01', '2027-12-31', 'Planeado'),
('2028-2029/1', '2028-01-01', '2028-06-30', 'Planeado'),
('2028-2029/2', '2028-07-01', '2028-12-31', 'Planeado'),
('2029-2030/1', '2029-01-01', '2029-06-30', 'Planeado'),
('2029-2030/2', '2029-07-01', '2029-12-31', 'Planeado');

-- =========================================================
-- 2. MATERIAS POR SEMESTRE
-- =========================================================
INSERT IGNORE INTO materias (clave_materia, nombre_materia, creditos, semestre_sugerido) VALUES
-- 1° Semestre
('ACF-0901', 'Cálculo Diferencial', 5, 1),
('AED-1285', 'Fundamentos de Programación', 5, 1),
('ACA-0907', 'Taller de Ética', 4, 1),
('AEF-1041', 'Matemáticas Discretas', 5, 1),
('SCH-1024', 'Taller de Administración', 4, 1),
('ACC-0906', 'Fundamentos de Investigación', 4, 1),
-- 2° Semestre
('ACF-0902', 'Cálculo Integral', 5, 2),
('AED-1286', 'Programación Orientada a Objetos', 5, 2),
('AEC-1008', 'Contabilidad Financiera', 4, 2),
('AEC-1058', 'Química', 4, 2),
('ACF-0903', 'Álgebra Lineal', 5, 2),
('AEF-1052', 'Probabilidad y Estadística', 5, 2),
-- 3° Semestre
('ACF-0904', 'Cálculo Vectorial', 5, 3),
('AED-1026', 'Estructura de Datos', 5, 3),
('SCC-1005', 'Cultura Empresarial', 4, 3),
('SCC-1013', 'Investigación de Operaciones', 4, 3),
('ACD-0908', 'Desarrollo Sustentable', 5, 3),
('SFC-1006', 'Física General', 5, 3),
-- 4° Semestre
('ACF-0905', 'Ecuaciones Diferenciales', 5, 4),
('SCC-1017', 'Métodos Numéricos', 4, 4),
('SCD-1027', 'Tópicos Avanzados de Programación', 5, 4),
('AEF-1031', 'Fundamentos de Base de Datos', 5, 4),
('SCD-1022', 'Simulación', 5, 4),
('SCD-1018', 'Principios Eléctricos y Aplicaciones Digitales', 5, 4),
('SCC-1010', 'Graficación', 4, 4),
('AEC-1034', 'Fundamentos de Telecomunicaciones', 4, 4),
('AEC-1061', 'Sistemas Operativos', 4, 4),
('SCA-1025', 'Taller de Base de Datos', 4, 4),
('SCC-1007', 'Fundamentos de Ingeniería de Software', 4, 4),
('SCD-1003', 'Arquitectura de Computadoras', 5, 4),
-- 6° Semestre
('SCD-1015', 'Lenguajes y Autómatas I', 5, 6),
('SCD-1021', 'Redes de Computadoras', 5, 6),
('SCA-1026', 'Taller de Sistemas Operativos', 4, 6),
('SCB-1001', 'Administración de Base de Datos', 5, 6),
('SCD-1011', 'Ingeniería de Software', 5, 6),
('SCC-1014', 'Lenguajes de Interfaz', 4, 6),
-- 7° Semestre
('SCD-1016', 'Lenguajes y Autómatas II', 5, 7),
('SCD-1004', 'Conmutación y Enrutamiento en Redes de Datos', 5, 7),
('ACA-0909', 'Taller de Investigación I', 4, 7),
('IAD-2301', 'CiberSeguridad', 5, 7),
('SCG-1009', 'Gestión de Proyectos de Software', 6, 7),
('SCC-1023', 'Sistemas Programables', 4, 7),
-- 8° Semestre
('SCC-1019', 'Programación Lógica y Funcional', 4, 8),
('SCA-1002', 'Administración de Redes', 4, 8),
('ACA-0910', 'Taller de Investigación II', 4, 8),
('IAD-2302', 'Análisis y Modelado de Datos', 5, 8),
('AEB-1055', 'Programación Web', 5, 8),
('IAD-2303', 'Sistemas Autónomos', 5, 8),
-- 9° Semestre
('SCC-1012', 'Inteligencia Artificial', 4, 9),
('IAD-2304', 'Redes Neuronales Artificiales', 5, 9),
('IAD-2305', 'Algoritmos Evolutivos', 5, 9);

-- =========================================================
-- 3. ADMINISTRADOR
-- =========================================================
INSERT IGNORE INTO usuarios
  (nombres, apellido_paterno, apellido_materno, correo_institucional, contrasena_hash, estado, id_rol)
VALUES
  ('Gabriel', 'Moreno', 'Marantes', 'div.ing.sistemas@tesi.edu.mx',
   '$2a$12$BFreDFeo.pNZWgvHySMPGO3bP5U83WdNa14n2zp8iji5wsUo2Y3GK',
   'Activo', 1);

-- =========================================================
-- 4. ALUMNO: Laura Casandra Bárcenas González
--    Email: laura202118450@ixtapaluca.tecnm.mx
--    Password: 202118450*
--    Matrícula: 202118450 | Grupo: 1801 (8° Matutino)
-- =========================================================
INSERT IGNORE INTO usuarios
  (nombres, apellido_paterno, apellido_materno, correo_institucional, contrasena_hash, estado, id_rol)
VALUES
  ('Laura Casandra', 'Bárcenas', 'González', 'laura202118450@ixtapaluca.tecnm.mx',
   '$2a$12$ke2x41c9PuJhKLgwVvUVv.oosB/Q1iuNS73nBV7.dH1c0h5NphvT.',
   'Activo', 4);

SET @id_alumno_laura = (SELECT id_usuario FROM usuarios WHERE correo_institucional = 'laura202118450@ixtapaluca.tecnm.mx');

INSERT IGNORE INTO alumnos
  (id_usuario, apellido_paterno, apellido_materno, nombres, matricula, curp, id_carrera, id_plan, semestre_actual, estatus_academico)
VALUES
  (@id_alumno_laura, 'Bárcenas', 'González', 'Laura Casandra', '202118450', 'LAUR010101HDFLRL09', 1, 1, 8, 'Regular');

INSERT IGNORE INTO kardex_alumno
  (id_alumno, numero_control, foto_alumno, promedio_general, creditos_acumulados, estatus, qr_token)
SELECT id_alumno, '202118450', NULL, 0.00, 0, 'Vigente', UUID()
FROM alumnos WHERE id_usuario = @id_alumno_laura;

-- =========================================================
-- 5. GRUPOS POR SEMESTRE
--    Convención: 01/02 = Matutino | 51 = Vespertino
-- =========================================================
INSERT IGNORE INTO grupos (id_periodo, id_carrera, nombre_grupo, semestre, turno, estado)
SELECT p.id_periodo, 1, g.nombre, g.semestre, g.turno, 'Abierto'
FROM (SELECT '1101' AS nombre, 1 AS semestre, 'Matutino' AS turno
      UNION ALL SELECT '1102', 1, 'Matutino'
      UNION ALL SELECT '1151', 1, 'Vespertino'
      UNION ALL SELECT '1201', 2, 'Matutino'
      UNION ALL SELECT '1202', 2, 'Matutino'
      UNION ALL SELECT '1251', 2, 'Vespertino'
      UNION ALL SELECT '1301', 3, 'Matutino'
      UNION ALL SELECT '1302', 3, 'Matutino'
      UNION ALL SELECT '1351', 3, 'Vespertino'
      UNION ALL SELECT '1401', 4, 'Matutino'
      UNION ALL SELECT '1402', 4, 'Matutino'
      UNION ALL SELECT '1451', 4, 'Vespertino'
      UNION ALL SELECT '1501', 5, 'Matutino'
      UNION ALL SELECT '1502', 5, 'Matutino'
      UNION ALL SELECT '1551', 5, 'Vespertino'
      UNION ALL SELECT '1601', 6, 'Matutino'
      UNION ALL SELECT '1602', 6, 'Matutino'
      UNION ALL SELECT '1651', 6, 'Vespertino'
      UNION ALL SELECT '1701', 7, 'Matutino'
      UNION ALL SELECT '1702', 7, 'Matutino'
      UNION ALL SELECT '1751', 7, 'Vespertino'
      UNION ALL SELECT '1801', 8, 'Matutino'
      UNION ALL SELECT '1802', 8, 'Matutino'
      UNION ALL SELECT '1851', 8, 'Vespertino'
      UNION ALL SELECT '1951', 9, 'Vespertino'
      UNION ALL SELECT '1952', 9, 'Vespertino') g
CROSS JOIN (SELECT id_periodo FROM periodos WHERE estado = 'Activo' LIMIT 1) p;

-- Asignar Laura al grupo 1801
INSERT IGNORE INTO grupos_alumnos (id_periodo, id_grupo, id_alumno, estado)
SELECT p.id_periodo, g.id_grupo, a.id_alumno, 'ACTIVO'
FROM periodos p, grupos g, alumnos a
WHERE g.nombre_grupo = '1801' AND g.turno = 'Matutino'
  AND a.id_usuario = @id_alumno_laura
LIMIT 1;

-- =========================================================
-- 6. LISTA DE ALUMNOS DEL GRUPO 1801
--    (los demás se registrarán con sus correos)
-- =========================================================
--  1. Aguilar Aguilar Daniela Guadalupe
--  2. Alcantar Melo Steven Yoskar
--  3. Alvarado Durán Irvin
--  4. Ávalos Hernández Juan Manuel
--  5. Bárcenas González Laura Casandra ✓
--  6. Barragán Guzmán Brandon Kaleth
--  7. Borja Bustamante Enrique
--  8. Dorantes Espinoza Ricardo
--  9. Fosado Galindo Hannia Joaliv
-- 10. Gallardo Hernández Evelyn Aline
-- 11. Gonzáles Gonzáles Brandon Yahir
-- 12. González Contreras Daniel Michelle
-- 13. Gonzáles Hernández Edgar Emmanuel
-- 14. Guzmán Arguello Yael de Jesús
-- 15. Hernández García Axel
-- 16. Jarero Alonso Teres Guadalupe
-- 17. López Gómez Alejandro
-- 18. López Jaimes Edgar Felipe
-- 19. Martínez Barajas Francisco Manuel
-- 20. Morales Ibarra Sandivel
-- 21. Pérez Garduño Ricado
-- 22. Pérez González Ángel Jesús
-- 23. Ramírez Islas Jesús Xiuhtekuhtli
-- 24. Rodríguez de la Rosa Nicoll Sherell
-- 25. Rosas Mendoza Bryan Raúl
-- 26. Simiano Andrade Arturo
-- 27. Solares Flores Joan
-- 28. Sosa Granados David

-- =========================================================
-- 7. DOCENTES DE INGENIERÍA EN SISTEMAS COMPUTACIONALES
--    (orden alfabético por apellido paterno)
--    Se registrarán con sus correos institucionales
-- =========================================================
INSERT IGNORE INTO usuarios (nombres, apellido_paterno, apellido_materno, correo_institucional, contrasena_hash, estado, id_rol) VALUES
  ('Paloma', 'Álvarez', 'Martínez', 'paloma.alvarez@tesi.edu.mx', '$2a$12$QmJsmAYvQ7MBobq5kRmlNe7HZPj4BHi4A/MiCqzUYgSgGFkRGM1e', 'Inactivo', 3),
  ('Juan Carlos', 'Cisneros', 'Rasgado', 'juan.cisneros@tesi.edu.mx', '$2a$12$QmJsmAYvQ7MBobq5kRmlNe7HZPj4BHi4A/MiCqzUYgSgGFkRGM1e', 'Inactivo', 3),
  ('Alfonso Javier', 'Espinoza', 'Navarro', 'alfonso.espinoza@tesi.edu.mx', '$2a$12$QmJsmAYvQ7MBobq5kRmlNe7HZPj4BHi4A/MiCqzUYgSgGFkRGM1e', 'Inactivo', 3),
  ('Maribel', 'García', 'de la Rosa', 'maribel.garcia@tesi.edu.mx', '$2a$12$QmJsmAYvQ7MBobq5kRmlNe7HZPj4BHi4A/MiCqzUYgSgGFkRGM1e', 'Inactivo', 3),
  ('Yahilt', 'Hernández', 'Hernández', 'yahilt.hernandez@tesi.edu.mx', '$2a$12$QmJsmAYvQ7MBobq5kRmlNe7HZPj4BHi4A/MiCqzUYgSgGFkRGM1e', 'Inactivo', 3),
  ('Roberto Carlos', 'Huerta', 'López', 'roberto.huerta@tesi.edu.mx', '$2a$12$QmJsmAYvQ7MBobq5kRmlNe7HZPj4BHi4A/MiCqzUYgSgGFkRGM1e', 'Inactivo', 3),
  ('Ezau', 'Jiménez', 'Valdez', 'ezau.jimenez@tesi.edu.mx', '$2a$12$QmJsmAYvQ7MBobq5kRmlNe7HZPj4BHi4A/MiCqzUYgSgGFkRGM1e', 'Inactivo', 3),
  ('Ebner', 'Juárez', 'Elías', 'ebner.juarez@tesi.edu.mx', '$2a$12$QmJsmAYvQ7MBobq5kRmlNe7HZPj4BHi4A/MiCqzUYgSgGFkRGM1e', 'Inactivo', 3),
  ('María del Carmen', 'Magaña', 'González', 'maria.magana@tesi.edu.mx', '$2a$12$QmJsmAYvQ7MBobq5kRmlNe7HZPj4BHi4A/MiCqzUYgSgGFkRGM1e', 'Inactivo', 3),
  ('Inés América', 'Mecalco', 'Castillo', 'ines.mecalco@tesi.edu.mx', '$2a$12$QmJsmAYvQ7MBobq5kRmlNe7HZPj4BHi4A/MiCqzUYgSgGFkRGM1e', 'Inactivo', 3),
  ('Elsa', 'Palma', 'López', 'elsa.palma@tesi.edu.mx', '$2a$12$QmJsmAYvQ7MBobq5kRmlNe7HZPj4BHi4A/MiCqzUYgSgGFkRGM1e', 'Inactivo', 3),
  ('Victor', 'Porcayo', 'Altamirano', 'victor.porcayo@tesi.edu.mx', '$2a$12$QmJsmAYvQ7MBobq5kRmlNe7HZPj4BHi4A/MiCqzUYgSgGFkRGM1e', 'Inactivo', 3),
  ('Esteban', 'Ramírez', 'de la Rosa', 'esteban.ramirez@tesi.edu.mx', '$2a$12$QmJsmAYvQ7MBobq5kRmlNe7HZPj4BHi4A/MiCqzUYgSgGFkRGM1e', 'Inactivo', 3),
  ('Francisco', 'Rivero', 'Briseño', 'francisco.rivero@tesi.edu.mx', '$2a$12$QmJsmAYvQ7MBobq5kRmlNe7HZPj4BHi4A/MiCqzUYgSgGFkRGM1e', 'Inactivo', 3),
  ('Bernardo', 'Romero', 'Medina', 'bernardo.romero@tesi.edu.mx', '$2a$12$QmJsmAYvQ7MBobq5kRmlNe7HZPj4BHi4A/MiCqzUYgSgGFkRGM1e', 'Inactivo', 3),
  ('Pablo', 'Vera', 'González', 'pablo.vera@tesi.edu.mx', '$2a$12$QmJsmAYvQ7MBobq5kRmlNe7HZPj4BHi4A/MiCqzUYgSgGFkRGM1e', 'Inactivo', 3);

INSERT IGNORE INTO docentes (id_usuario, clave_docente, numero_empleado, especialidad, estatus)
SELECT u.id_usuario,
  CONCAT('DOC-', UPPER(SUBSTRING(u.apellido_paterno, 1, 4))),
  CONCAT('EMP-', UPPER(SUBSTRING(u.apellido_paterno, 1, 4))),
  'Ingeniería en Sistemas Computacionales',
  'Activo'
FROM usuarios u
WHERE u.id_rol = 3 AND u.estado = 'Inactivo'
ORDER BY u.apellido_paterno;

COMMIT;
