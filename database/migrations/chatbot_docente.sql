USE sivacad_isc;

START TRANSACTION;

CREATE TABLE IF NOT EXISTS docente_actividades_extracurriculares (
    id_actividad BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_alumno INT NOT NULL,
    actividad VARCHAR(120) NOT NULL,
    tipo VARCHAR(60) NOT NULL COMMENT 'HACKATON, INNOVATECNM, TESICHALLENGE, OTRO',
    estatus ENUM('INSCRITO','PARTICIPANDO','FINALIZADO','CANCELADO') NOT NULL DEFAULT 'INSCRITO',
    fecha_inscripcion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    observaciones TEXT,
    FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno) ON DELETE CASCADE,
    INDEX idx_actividad_tipo (tipo),
    INDEX idx_actividad_alumno (id_alumno)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS docente_convenios_empresariales (
    id_convenio BIGINT AUTO_INCREMENT PRIMARY KEY,
    nombre_empresa VARCHAR(200) NOT NULL,
    rfc VARCHAR(20),
    giro VARCHAR(120),
    tipo_convenio ENUM('SERVICIO_SOCIAL','RESIDENCIA_PROFESIONAL','AMBOS') NOT NULL DEFAULT 'AMBOS',
    fecha_inicio DATE,
    fecha_fin DATE,
    estatus ENUM('VIGENTE','VENCIDO','CANCELADO') NOT NULL DEFAULT 'VIGENTE',
    contacto_nombre VARCHAR(160),
    contacto_telefono VARCHAR(30),
    contacto_correo VARCHAR(120),
    observaciones TEXT,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_convenio_tipo (tipo_convenio),
    INDEX idx_convenio_estatus (estatus)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS docente_servicio_social (
    id_servicio BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_alumno INT NOT NULL,
    id_convenio BIGINT,
    empresa VARCHAR(200) NOT NULL,
    programa VARCHAR(200),
    horas_totales INT NOT NULL DEFAULT 0,
    horas_cumplidas INT NOT NULL DEFAULT 0,
    estatus ENUM('ASIGNADO','EN_CURSO','FINALIZADO','CANCELADO') NOT NULL DEFAULT 'ASIGNADO',
    fecha_inicio DATE,
    fecha_fin DATE,
    calificacion DECIMAL(3,1),
    FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno) ON DELETE CASCADE,
    FOREIGN KEY (id_convenio) REFERENCES docente_convenios_empresariales(id_convenio) ON DELETE SET NULL,
    INDEX idx_ss_alumno (id_alumno),
    INDEX idx_ss_estatus (estatus)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS docente_residencia_profesional (
    id_residencia BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_alumno INT NOT NULL,
    id_convenio BIGINT,
    empresa VARCHAR(200) NOT NULL,
    proyecto VARCHAR(300),
    asesor_externo VARCHAR(160),
    asesor_interno VARCHAR(160),
    periodo_inicio DATE,
    periodo_fin DATE,
    estatus ENUM('ASIGNADO','EN_CURSO','FINALIZADO','CANCELADO') NOT NULL DEFAULT 'ASIGNADO',
    calificacion DECIMAL(3,1),
    FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno) ON DELETE CASCADE,
    FOREIGN KEY (id_convenio) REFERENCES docente_convenios_empresariales(id_convenio) ON DELETE SET NULL,
    INDEX idx_rp_alumno (id_alumno),
    INDEX idx_rp_estatus (estatus)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS docente_titulacion (
    id_titulacion BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_alumno INT NOT NULL,
    id_periodo INT NOT NULL,
    modalidad ENUM('PROMEDIO','MEMORIA_RESIDENCIA','TESIS','PROYECTO_INVESTIGACION','CENEVAL') NOT NULL,
    estatus ENUM('APTO','EN_PROCESO','CONCLUIDO','RECHAZADO') NOT NULL DEFAULT 'APTO',
    promedio_general DECIMAL(5,2),
    observaciones TEXT,
    fecha_dictamen DATE,
    FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno) ON DELETE CASCADE,
    FOREIGN KEY (id_periodo) REFERENCES periodos(id_periodo) ON DELETE CASCADE,
    INDEX idx_titulacion_modalidad (modalidad),
    INDEX idx_titulacion_estatus (estatus),
    INDEX idx_titulacion_alumno (id_alumno)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS docente_idiomas (
    id_idioma BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_alumno INT NOT NULL,
    idioma VARCHAR(60) NOT NULL DEFAULT 'INGLES',
    nivel VARCHAR(30) NOT NULL,
    niveles_completados TINYINT UNSIGNED NOT NULL DEFAULT 0,
    certificacion VARCHAR(100),
    fecha_certificacion DATE,
    FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno) ON DELETE CASCADE,
    INDEX idx_idioma_alumno (id_alumno),
    INDEX idx_idioma_nivel (nivel)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS docente_creditos_complementarios (
    id_credito BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_alumno INT NOT NULL,
    tipo ENUM('ACADEMICO','CULTURAL','DEPORTIVO') NOT NULL,
    descripcion VARCHAR(300) NOT NULL,
    horas INT NOT NULL DEFAULT 0,
    fecha_obtencion DATE,
    estatus ENUM('CUBIERTO','PENDIENTE','NO_CUBIERTO') NOT NULL DEFAULT 'PENDIENTE',
    FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno) ON DELETE CASCADE,
    INDEX idx_credito_alumno (id_alumno),
    INDEX idx_credito_tipo (tipo),
    INDEX idx_credito_estatus (estatus)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS docente_segundas_oportunidades (
    id_segunda_op BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_alumno INT NOT NULL,
    id_materia INT NOT NULL,
    tipo ENUM('SEGUNDA_OPORTUNIDAD','MATERIA_ESPECIAL','RECURSE','OTRO') NOT NULL DEFAULT 'SEGUNDA_OPORTUNIDAD',
    calificacion_anterior DECIMAL(4,2),
    calificacion_actual DECIMAL(4,2),
    periodo_aplicacion INT,
    estatus ENUM('PENDIENTE','EN_CURSO','APROBADO','REPROBADO') NOT NULL DEFAULT 'PENDIENTE',
    FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno) ON DELETE CASCADE,
    FOREIGN KEY (id_materia) REFERENCES materias(id_materia) ON DELETE CASCADE,
    INDEX idx_segunda_alumno (id_alumno),
    INDEX idx_segunda_tipo (tipo),
    INDEX idx_segunda_estatus (estatus)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS docente_beca_extranjero (
    id_beca_ext BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_alumno INT NOT NULL,
    pais VARCHAR(100) NOT NULL,
    universidad VARCHAR(200),
    programa VARCHAR(200),
    niveles_ingles TINYINT UNSIGNED NOT NULL DEFAULT 0,
    promedio_minimo DECIMAL(4,2) NOT NULL DEFAULT 8.0,
    estatus ENUM('APTO','POSTULADO','ACEPTADO','RECHAZADO','CONCLUIDO') NOT NULL DEFAULT 'APTO',
    observaciones TEXT,
    FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno) ON DELETE CASCADE,
    INDEX idx_beca_ext_alumno (id_alumno),
    INDEX idx_beca_ext_estatus (estatus)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS docente_asistencias (
    id_asistencia BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_alumno INT NOT NULL,
    id_grupo INT NOT NULL,
    id_materia INT,
    id_periodo INT NOT NULL,
    fecha DATE NOT NULL,
    asistio TINYINT(1) NOT NULL DEFAULT 1,
    justificante TEXT,
    notifico_coordinador TINYINT(1) NOT NULL DEFAULT 0,
    motivo_ausencia VARCHAR(300),
    registrado_por INT,
    FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno) ON DELETE CASCADE,
    FOREIGN KEY (id_grupo) REFERENCES grupos(id_grupo) ON DELETE CASCADE,
    FOREIGN KEY (id_periodo) REFERENCES periodos(id_periodo) ON DELETE CASCADE,
    INDEX idx_asistencia_alumno (id_alumno),
    INDEX idx_asistencia_grupo (id_grupo),
    INDEX idx_asistencia_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS docente_salud_estudiantil (
    id_salud BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_alumno INT NOT NULL,
    condicion VARCHAR(200) NOT NULL,
    tipo ENUM('EMBARAZO','ENFERMEDAD','DISCAPACIDAD','OTRO') NOT NULL,
    requiere_atencion TINYINT(1) NOT NULL DEFAULT 0,
    observaciones TEXT,
    fecha_registro DATE,
    confidencial TINYINT(1) NOT NULL DEFAULT 0,
    FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno) ON DELETE CASCADE,
    INDEX idx_salud_alumno (id_alumno),
    INDEX idx_salud_tipo (tipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS docente_query_log (
    id_query BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_docente INT NOT NULL,
    pregunta TEXT NOT NULL,
    respuesta TEXT,
    tipo_consulta VARCHAR(80) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_query_docente (id_docente),
    INDEX idx_query_tipo (tipo_consulta),
    INDEX idx_query_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

COMMIT;
