USE sivacad_isc;

START TRANSACTION;

CREATE TABLE IF NOT EXISTS asistente_sesiones (
    id_sesion BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    rol_usuario VARCHAR(30) NOT NULL,
    tema_actual VARCHAR(80) NOT NULL DEFAULT 'GENERAL',
    estado ENUM('ACTIVA','PAUSADA','CERRADA') NOT NULL DEFAULT 'ACTIVA',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_asistente_sesion_usuario (id_usuario),
    CONSTRAINT fk_asistente_sesiones_usuario
      FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
      ON DELETE CASCADE
      ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS asistente_mensajes (
    id_mensaje BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_sesion BIGINT NOT NULL,
    rol_mensaje ENUM('user','assistant','system') NOT NULL,
    contenido LONGTEXT NOT NULL,
    tipo_intencion VARCHAR(60) NOT NULL DEFAULT 'GENERAL',
    herramienta_usada VARCHAR(80) NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_asistente_mensajes_sesion (id_sesion),
    CONSTRAINT fk_asistente_mensajes_sesion
      FOREIGN KEY (id_sesion) REFERENCES asistente_sesiones(id_sesion)
      ON DELETE CASCADE
      ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS asistente_auditoria (
    id_auditoria BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NULL,
    rol_usuario VARCHAR(30) NOT NULL,
    intencion VARCHAR(80) NOT NULL,
    herramienta VARCHAR(80) NULL,
    pregunta TEXT NOT NULL,
    respuesta_resumen TEXT NULL,
    permitido TINYINT(1) NOT NULL DEFAULT 1,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_asistente_auditoria_usuario (id_usuario),
    KEY idx_asistente_auditoria_intencion (intencion),
    CONSTRAINT fk_asistente_auditoria_usuario
      FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
      ON DELETE SET NULL
      ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS asistente_contenidos (
    id_contenido BIGINT AUTO_INCREMENT PRIMARY KEY,
    codigo_contenido VARCHAR(60) NOT NULL UNIQUE,
    categoria VARCHAR(40) NOT NULL,
    titulo VARCHAR(180) NOT NULL,
    contenido LONGTEXT NOT NULL,
    rol_objetivo ENUM('TODOS','ALUMNO','DOCENTE','COORDINADOR','ADMINISTRADOR','SOPORTE') NOT NULL DEFAULT 'TODOS',
    fuente VARCHAR(120) NULL,
    etiquetas VARCHAR(255) NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    orden_visual INT NOT NULL DEFAULT 1,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_asistente_contenidos_categoria (categoria),
    KEY idx_asistente_contenidos_rol (rol_objetivo),
    KEY idx_asistente_contenidos_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO asistente_contenidos
(codigo_contenido, categoria, titulo, contenido, rol_objetivo, fuente, etiquetas, activo, orden_visual)
VALUES
('WELCOME_GENERAL', 'GENERAL', 'Bienvenida institucional',
 'Hola, soy el asistente académico unificado de SIVACAD. Puedo orientarte según tu rol, ayudarte con becas, kardex, acompañamiento, soporte y tutoría académica.',
 'TODOS', 'SIVACAD', 'bienvenida,asistente,global', 1, 1),

('WELCOME_ALUMNO', 'ROL', 'Ayuda para alumno',
 'Como alumno, puedo ayudarte con horarios, kardex, materias, becas, reinscripción, inscripción, estado académico, acompañamiento y orientación de carrera.',
 'ALUMNO', 'SIVACAD', 'alumno,kardex,becas,bienestar', 1, 2),

('WELCOME_DOCENTE', 'ROL', 'Ayuda para docente',
 'Como docente, puedo apoyar con grupos asignados, evaluaciones, listas, incidencias, reportes, faltas grupales, faltas por alumno y seguimiento académico.',
 'DOCENTE', 'SIVACAD', 'docente,grupos,evaluaciones,incidencias', 1, 3),

('WELCOME_COORDINADOR', 'ROL', 'Ayuda para coordinador',
 'Como coordinador, puedo mostrar alertas, deserción, mapas de riesgo, desempeño por materia, indicadores, gráficas y seguimiento de juntas o comisiones.',
 'COORDINADOR', 'SIVACAD', 'coordinador,desercion,indicadores,graficas', 1, 4),

('WELCOME_ADMIN', 'ROL', 'Ayuda para administrador',
 'Como administrador, puedo apoyar con control de usuarios, periodos, validaciones, estadísticas, inscripciones, reinscripciones y administración general.',
 'ADMINISTRADOR', 'SIVACAD', 'administrador,usuarios,periodos,validaciones', 1, 5),

('WELCOME_SOPORTE', 'ROL', 'Ayuda para soporte',
 'Como soporte, puedo ayudarte a diagnosticar errores, revisar trazas, registrar tickets, revisar fallas y dar mantenimiento al sistema.',
 'SOPORTE', 'SIVACAD', 'soporte,errores,trazas,tickets', 1, 6),

('BECA_EDOMEX', 'BECAS', 'Becas disponibles',
 'Puedo orientar sobre becas institucionales y convocatorias del Estado de México. Si lo deseas, puedo buscar requisitos, fechas y documentos vigentes.',
 'ALUMNO', 'Gaceta / SIVACAD', 'becas,edomex,convocatoria', 1, 7),

('BIENESTAR_APOYO', 'BIENESTAR', 'Acompañamiento Estudiantil',
 'Puedo ofrecer orientación general de acompañamiento emocional, académico y laboral. Si hay un riesgo inmediato o una crisis, es importante pedir apoyo humano inmediato.',
 'TODOS', 'SIVACAD', 'bienestar,salud mental,apoyo', 1, 8),

('TUTOR_PROGRAMACION', 'TUTOR', 'Tutor de programación',
 'Puedo ayudarte con lógica de programación, estructuras de control, funciones, arrays, POO, depuración y buenas prácticas de código.',
 'ALUMNO', 'SIVACAD', 'programacion,logica,poo,debug', 1, 9);

COMMIT;