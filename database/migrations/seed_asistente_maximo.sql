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

('BECA_INSTITUCIONAL', 'BECAS', 'Becas institucionales',
 'Puedo resumir convocatorias, requisitos, promedios mínimos, fechas de entrega y documentos para becas internas o externas.',
 'ALUMNO', 'SIVACAD', 'becas,requisitos,convocatoria', 1, 8),

('BIENESTAR_APOYO', 'BIENESTAR', 'Acompañamiento Estudiantil',
 'Puedo ofrecer orientación general de acompañamiento emocional, académico y laboral. Si hay un riesgo inmediato o una crisis, es importante pedir apoyo humano inmediato.',
 'TODOS', 'SIVACAD', 'bienestar,salud mental,apoyo', 1, 9),

('SALUD_Y_ESPACIO', 'BIENESTAR', 'Salud y entorno',
 'Puedo ayudar a registrar señales de estrés, cansancio, desmotivación, sobrecarga académica o condiciones del entorno que afecten el desempeño.',
 'TODOS', 'SIVACAD', 'salud,estrés,entorno,acompañamiento', 1, 10),

('ADMIN_CONTROL', 'ROL', 'Control administrativo',
 'Puedo ayudar al administrador a revisar usuarios, periodos, validaciones, estadísticas, inscripciones y reinscripciones.',
 'ADMINISTRADOR', 'SIVACAD', 'admin,usuarios,periodos', 1, 11),

('COORD_ALERTAS', 'ROL', 'Alertas de coordinación',
 'Puedo mostrar alertas, deserción, desempeño académico, mapas de riesgo y seguimiento de estudiantes en atención.',
 'COORDINADOR', 'SIVACAD', 'coordinacion,alertas,riesgo', 1, 12),

('SOPORTE_DIAGNOSTICO', 'SOPORTE', 'Diagnóstico de errores',
 'Puedo guiarte para identificar errores de frontend, backend, rutas, sesiones, permisos, SQL y consumo de APIs.',
 'SOPORTE', 'SIVACAD', 'soporte,diagnostico,errores', 1, 13),

('SOPORTE_TRAZAS', 'SOPORTE', 'Revisión de trazas',
 'Puedo ayudarte a interpretar logs, stack traces, códigos de error, validaciones y respuestas del servidor.',
 'SOPORTE', 'SIVACAD', 'logs,trazas,debug', 1, 14),

('SOPORTE_MANTENIMIENTO', 'SOPORTE', 'Mantenimiento',
 'Puedo orientar en backups, limpieza de sesiones, migraciones SQL, despliegue y revisión de integridad del sistema.',
 'SOPORTE', 'SIVACAD', 'mantenimiento,backup,migracion', 1, 15),

('TUTOR_PROGRAMACION', 'TUTOR', 'Tutor de programación',
 'Puedo ayudarte con lógica de programación, estructuras de control, funciones, arrays, POO, depuración y buenas prácticas de código.',
 'ALUMNO', 'SIVACAD', 'programacion,logica,poo,debug', 1, 16),

('TUTOR_TALLER_DE_ETICA', 'TUTOR', 'Taller de ética',
 'Puedo ayudar a reflexionar sobre dilemas éticos, responsabilidad profesional, toma de decisiones y valores en la práctica profesional.',
 'ALUMNO', 'SIVACAD', 'etica,dilemas,responsabilidad', 1, 17),

('TUTOR_TALLER_DE_ADMINISTRACION', 'TUTOR', 'Taller de administración',
 'Puedo explicar planificación, organización, dirección, control, liderazgo y gestión de recursos en entornos empresariales.',
 'ALUMNO', 'SIVACAD', 'administracion,gestion,liderazgo', 1, 18),

('TUTOR_FUNDAMENTOS_DE_INVESTIGACION', 'TUTOR', 'Fundamentos de investigación',
 'Puedo ayudar con diseño experimental, recolección de datos, análisis estadístico, interpretación de resultados y redacción científica.',
 'ALUMNO', 'SIVACAD', 'investigacion,estadistica,analisis', 1, 19),

('TUTOR_LOGICA', 'TUTOR', 'Lógica y matemáticas',
 'Puedo ayudar con álgebra lineal, matemáticas discretas, ecuaciones diferenciales, cálculo diferencial, cálculo integral, cálculo vectorial, probabilidad y estadística, métodos numéricos, álgebra y lógica formal.',
 'ALUMNO', 'SIVACAD', 'matematicas,logica,algebra', 1, 20),

('TUTOR_PROGRAMACION_ORIENTADA_A_OBJETOS', 'TUTOR', 'Programación orientada a objetos',
 'Puedo explicar conceptos de POO, clases, objetos, herencia, polimorfismo, encapsulamiento y patrones de diseño.',
 'ALUMNO', 'SIVACAD', 'poo,objetos,clases,herencia', 1, 21),

('TUTOR_ESTRUCTURAS_DATOS', 'TUTOR', 'Estructuras de datos',
 'Puedo explicar pilas, colas, listas, árboles, grafos, búsqueda, ordenamiento y complejidad algorítmica.',
 'ALUMNO', 'SIVACAD', 'estructuras de datos,algoritmos', 1, 22),

('TUTOR_BASES_DATOS', 'TUTOR', 'Bases de datos',
 'Puedo explicar modelado relacional, llaves, normalización, consultas SQL, integridad referencial y diseño de tablas.',
 'ALUMNO', 'SIVACAD', 'bd,sql,normalizacion', 1, 23),

('TUTOR_FUNDAMENTOS_DE_BASE_DE_DATOS', 'TUTOR', 'Fundamentos de base de datos',
 'Puedo explicar conceptos de base de datos, modelos entidad-relación, lenguaje SQL, normalización, transacciones y seguridad.',
 'ALUMNO', 'SIVACAD', 'base de datos,sql,normalizacion', 1, 24),

('TUTOR_TALLER_DE_BASE_DE_DATOS', 'TUTOR', 'Taller de base de datos',
 'Puedo orientar sobre diseño de bases de datos, consultas SQL, integridad referencial, índices y optimización de consultas.',
 'ALUMNO', 'SIVACAD', 'base de datos,taller,sql', 1, 25),

('TUTOR_ADMINISTRACION_DE_BASE_DE_DATOS', 'TUTOR', 'Administración de bases de datos',
 'Puedo explicar administración de bases de datos, usuarios, permisos, backups, replicación y monitoreo de rendimiento.',
 'ALUMNO', 'SIVACAD', 'base de datos,administracion,backups', 1, 26),

('TUTOR_REDES', 'TUTOR', 'Redes de computadoras',
 'Puedo ayudarte con direccionamiento IP, subredes, capas OSI/TCP-IP, protocolos, routing y troubleshooting básico.',
 'ALUMNO', 'SIVACAD', 'redes,ip,tcpip', 1, 27),

('TUTOR_PRINCIPIOS_ELECTRICOS_Y_APLICACIONES_DIGITALES', 'TUTOR', 'Principios eléctricos y aplicaciones digitales',
 'Puedo explicar circuitos, leyes de Ohm y Kirchhoff, componentes electrónicos, semiconductores y análisis de señales.',
 'ALUMNO', 'SIVACAD', 'electricidad,electronica,circuitos', 1, 28),

('TUTOR_ELECTRONICA', 'TUTOR', 'Electrónica y circuitos',
 'Puedo ayudar con circuitos eléctricos, electrónica digital, electrónica analógica, microcontroladores, sensores y actuadores.',
 'ALUMNO', 'SIVACAD', 'electronica,circuitos,microcontroladores', 1, 29),

('TUTOR_QUIMICA', 'TUTOR', 'Química y física',
 'Puedo explicar conceptos de química general, química orgánica, química inorgánica, física mecánica, física electromagnética y física moderna.',
 'ALUMNO', 'SIVACAD', 'quimica,fisica,ciencia', 1, 30),

('TUTOR_CONTABILIDAD', 'TUTOR', 'Contabilidad Financiera y finanzas',
 'Puedo explicar conceptos de contabilidad, estados financieros, análisis financiero, presupuestos y gestión de recursos.',
 'ALUMNO', 'SIVACAD', 'contabilidad,finanzas,recursos', 1, 31),

('TUTOR_CULTURA_EMPRESARIAL', 'TUTOR', 'Cultura empresarial y ética profesional',
 'Puedo orientar sobre ética profesional, responsabilidad social, liderazgo, trabajo en equipo y cultura organizacional.',
 'ALUMNO', 'SIVACAD', 'cultura empresarial,etica,liderazgo', 1, 32),

('TUTOR_FUNDAMENTOS_DE_INGENIERIA_DE_SOFTWARE', 'TUTOR', 'Fundamentos de ingeniería de software',
 'Puedo explicar principios de ingeniería de software, ciclo de vida, metodologías, pruebas y documentación.',
 'ALUMNO', 'SIVACAD', 'software,ingenieria,pruebas', 1, 33),

('TUTOR_ING_SOFTWARE', 'TUTOR', 'Ingeniería de software',
 'Puedo orientar sobre requisitos, UML, pruebas, documentación, patrones de diseño, mantenimiento y control de versiones.',
 'ALUMNO', 'SIVACAD', 'software,uml,pruebas', 1, 34),

('TUTOR_GESTION_DE_PROYECTOS_DE_SOFTWARE', 'TUTOR', 'Gestión de proyectos de software',
 'Puedo ayudar con gestión de proyectos de software, planificación, seguimiento, control de calidad y metodologías de desarrollo.',
 'ALUMNO', 'SIVACAD', 'gestion proyectos,software,metodologias', 1, 35),

('TUTOR_DOCUMENTACION', 'TUTOR', 'Documentación técnica',
 'Puedo apoyar con reportes, bitácoras, memorias técnicas, diagramas, redacción formal y estructura de proyectos.',
 'ALUMNO', 'SIVACAD', 'documentacion,redaccion,reportes', 1, 36),

('TUTOR_PROGRAMACION_WEB', 'TUTOR', 'Programación web',
 'Puedo ayudar con HTML, CSS, JavaScript, React, APIs, formularios, validaciones y arquitectura frontend-backend.',
 'ALUMNO', 'SIVACAD', 'web,react,frontend,backend', 1, 37),

('TUTOR_TALLER_DE_PROGRAMACION_AVANZADA', 'TUTOR', 'Taller de programación avanzada',
 'Puedo orientar sobre técnicas avanzadas de programación, optimización de código, patrones de diseño y desarrollo de aplicaciones complejas.',
 'ALUMNO', 'SIVACAD', 'programacion,avanzado,taller', 1, 38),

('TUTOR_LENGUAJES_DE_INTERFAZ', 'TUTOR', 'Lenguajes de interfaz',
 'Puedo ayudar con lenguajes de programación, estructuras de datos, algoritmos, diseño de software y desarrollo de aplicaciones.',
 'ALUMNO', 'SIVACAD', 'lenguajes interfaz,programacion,algoritmos', 1, 39),

('TUTOR_LENGUAJES_Y_AUTOMATAS_1', 'TUTOR', 'Lenguajes y autómatas I',
 'Puedo explicar teoría de lenguajes formales, autómatas finitos, gramáticas, expresiones regulares y análisis léxico.',
 'ALUMNO', 'SIVACAD', 'lenguajes,automatas,gramaticas', 1, 40),

('TUTOR_LENGUAJES_Y_AUTOMATAS_2', 'TUTOR', 'Lenguajes y autómatas II',
 'Puedo ayudar con autómatas a pila, gramáticas libres de contexto, análisis sintáctico y teoría de la computación.',
 'ALUMNO', 'SIVACAD', 'lenguajes,automatas,sintaxis', 1, 41),

('TUTOR_INVESTIGACION_DE_OPERACIONES', 'TUTOR', 'Investigación de operaciones',
 'Puedo explicar programación lineal, optimización, teoría de colas, simulación y análisis de decisiones.',
 'ALUMNO', 'SIVACAD', 'investigacion operaciones,optimización', 1, 42),

('TUTOR_ANALISIS_Y_MODELADO_DE_DATOS', 'TUTOR', 'Análisis y modelado de datos',
 'Puedo ayudar con estadística, visualización de datos, minería de datos, análisis predictivo y toma de decisiones basada en datos.',
 'ALUMNO', 'SIVACAD', 'analisis datos,estadistica,visualizacion', 1, 43),

('TUTOR_FUNDAMENTOS_DE_TELECOMUNICACIONES', 'TUTOR', 'Fundamentos de telecomunicaciones',
 'Puedo explicar conceptos de comunicación de datos, redes, protocolos, señales y sistemas de transmisión.',
 'ALUMNO', 'SIVACAD', 'telecomunicaciones,redes,protocolos', 1, 44),

('TUTOR_REDES_DE_COMPUTADORAS', 'TUTOR', 'Redes de computadoras',
 'Puedo explicar conceptos de redes, protocolos, topologías, seguridad en redes y administración de redes.',
 'ALUMNO', 'SIVACAD', 'redes,protocolos,seguridad', 1, 45),

('TUTOR_CONMUTACION_Y_ENRUTAMIENTO_EN_REDES_DE_DATOS', 'TUTOR', 'Conmutación y enrutamiento en redes de datos',
 'Puedo ayudar con conmutadores, routers, protocolos de enrutamiento, VLANs y configuración de redes.',
 'ALUMNO', 'SIVACAD', 'conmutacion,enrutamiento,redes', 1, 46),

('TUTOR_SEGURIDAD_EN_REDES_DE_DATOS', 'TUTOR', 'Seguridad en redes de datos',
 'Puedo explicar firewalls, VPNs, cifrado, autenticación, detección de intrusos y buenas prácticas de seguridad en redes.',
 'ALUMNO', 'SIVACAD', 'seguridad,redes,cifrado', 1, 47),

('TUTOR_TALLER_DE_REDES_DE_COMPUTADORAS', 'TUTOR', 'Taller de redes de computadoras',
 'Puedo orientar sobre configuración de dispositivos de red, pruebas de conectividad, monitoreo y resolución de problemas en redes.',
 'ALUMNO', 'SIVACAD', 'taller,redes,configuracion', 1, 48),

('TUTOR_ADMINISTRACION_DE_REDES', 'TUTOR', 'Administración de redes',
 'Puedo ayudar con administración de redes, monitoreo de tráfico, gestión de usuarios, políticas de seguridad y optimización del rendimiento.',
 'ALUMNO', 'SIVACAD', 'administracion,redes,monitoreo', 1, 49),

('TUTOR_TALLER_DE_SEGURIDAD_EN_REDES', 'TUTOR', 'Taller de seguridad en redes',
 'Puedo explicar técnicas de seguridad en redes, pruebas de penetración, auditorías de seguridad y mitigación de vulnerabilidades.',
 'ALUMNO', 'SIVACAD', 'taller,seguridad,redes', 1, 50),

('TUTOR_TOPICOS_AVANZADOS_DE_PROGRAMACION', 'TUTOR', 'Tópicos avanzados de programación',
 'Puedo ayudar con concurrencia, paralelismo, programación funcional, patrones de diseño y optimización de código.',
 'ALUMNO', 'SIVACAD', 'programacion,avanzado,concurrencia', 1, 51),

('TUTOR_FUNDAMENTOS_DE_INTELIGENCIA_ARTIFICIAL', 'TUTOR', 'Fundamentos de inteligencia artificial',
 'Puedo ayudar con conceptos básicos de IA, aprendizaje supervisado y no supervisado, algoritmos y aplicaciones prácticas.',
 'ALUMNO', 'SIVACAD', 'ia,inteligencia artificial,aprendizaje automatico', 1, 52),

('TUTOR_TALLER_DE_INTELIGENCIA_ARTIFICIAL', 'TUTOR', 'Taller de inteligencia artificial',
 'Puedo orientar sobre implementación de modelos de IA, procesamiento de datos, entrenamiento y evaluación de algoritmos.',
 'ALUMNO', 'SIVACAD', 'taller,inteligencia artificial,modelos ia', 1, 53),

('TUTOR_IA', 'TUTOR', 'Inteligencia Artificial',
 'Puedo explicar conceptos de IA, ML, prompting, modelos, clasificación, predicción, RAG y function calling.',
 'ALUMNO', 'SIVACAD', 'ia,ml,rag,prompting', 1, 54),

('TUTOR_REDES_NEURONALES_ARTIFICIALES', 'TUTOR', 'Redes neuronales artificiales',
 'Puedo explicar perceptrones, redes multicapa, backpropagation, funciones de activación y aplicaciones de aprendizaje profundo.',
 'ALUMNO', 'SIVACAD', 'redes neuronales,aprendizaje profundo,backpropagation', 1, 55),

('TUTOR_ALGORITMOS_EVOLUTIVOS', 'TUTOR', 'Algoritmos evolutivos',
 'Puedo ayudar con algoritmos genéticos, optimización, selección natural, mutación, cruce y aplicaciones en problemas complejos.',
 'ALUMNO', 'SIVACAD', 'algoritmos evolutivos,geneticos,optimizacion', 1, 56),

('TUTOR_SISTEMAS_PROGRAMABLES', 'TUTOR', 'Sistemas programables',
 'Puedo ayudar con lenguajes de programación, estructuras de datos, algoritmos, diseño de software y desarrollo de aplicaciones.',
 'ALUMNO', 'SIVACAD', 'sistemas programables,programacion,algoritmos', 1, 57),

('TUTOR_SISTEMAS_AUTONOMOS', 'TUTOR', 'Sistemas autónomos',
 'Puedo ayudar con conceptos de sistemas autónomos, inteligencia artificial, robótica y control de procesos.',
 'ALUMNO', 'SIVACAD', 'sistemas autonos,robotica,inteligencia artificial', 1, 58),

('TUTOR_DESARROLLO_JUEGOS', 'TUTOR', 'Desarrollo de videojuegos',
 'Puedo orientar sobre motores de juego, diseño de niveles, programación de juegos, gráficos 2D/3D y optimización de rendimiento.',
 'ALUMNO', 'SIVACAD', 'videojuegos,desarrollo,juegos 2D/3D', 1, 59),

('TUTOR_DESARROLLO_MOVIL', 'TUTOR', 'Desarrollo móvil',
 'Puedo orientar sobre desarrollo de aplicaciones móviles, Android, iOS, Flutter, React Native y buenas prácticas de diseño móvil.',
 'ALUMNO', 'SIVACAD', 'movil,android,ios,flutter', 1, 60),

('TUTOR_CLOUD_COMPUTING', 'TUTOR', 'Computación en la nube',
 'Puedo explicar conceptos de cloud computing, servicios en la nube, AWS, Azure, Google Cloud y arquitecturas escalables.',
 'ALUMNO', 'SIVACAD', 'cloud computing,AWS,Azure,GCP', 1, 61),

('TUTOR_INTELIGENCIA_ARTIFICIAL', 'TUTOR', 'Inteligencia Artificial y aprendizaje automático',
 'Puedo explicar conceptos de IA, ML, redes neuronales, aprendizaje profundo, procesamiento de lenguaje natural y visión por computadora.',
 'ALUMNO', 'SIVACAD', 'ia,ml,aprendizaje profundo,redes neuronales', 1, 62),

('TUTOR_REALIDAD_VIRTUAL_AUMENTADA', 'TUTOR', 'Realidad virtual y aumentada',
 'Puedo explicar conceptos de VR/AR, desarrollo de aplicaciones inmersivas, interacción usuario-entorno y hardware especializado.',
 'ALUMNO', 'SIVACAD', 'vr,ar,realidad virtual,aumentada', 1, 63),

('TUTOR_ROBOTICA_AUTOMATIZACION', 'TUTOR', 'Robótica y automatización',
 'Puedo ayudar con conceptos de robótica, control de sistemas, sensores, actuadores y programación de robots.',
 'ALUMNO', 'SIVACAD', 'robotica,automatizacion,sensores', 1, 64),

('TUTOR_INTERNET_COSAS_IOT', 'TUTOR', 'Internet de las cosas (IoT)',
 'Puedo explicar conceptos de IoT, dispositivos conectados, protocolos de comunicación y aplicaciones en la vida diaria.',
 'ALUMNO', 'SIVACAD', 'iot,internet cosas,sensores conectados', 1, 65),

('TUTOR_DESARROLLO_SOFTWARE_AGIL', 'TUTOR', 'Desarrollo de software ágil',
 'Puedo explicar metodologías ágiles, Scrum, Kanban, gestión de proyectos y entrega continua.',
 'ALUMNO', 'SIVACAD', 'desarrollo software,agil,scrum,kanban', 1, 66),

('TUTOR_ANALISIS_DATOS_BIGDATA', 'TUTOR', 'Análisis de datos y Big Data',
 'Puedo ayudar con análisis de datos, herramientas de Big Data, visualización y toma de decisiones basada en datos.',
 'ALUMNO', 'SIVACAD', 'analisis datos,big data,visualizacion', 1, 67),

('TUTOR_INTELIGENCIA_NEGOCIOS_BI', 'TUTOR', 'Inteligencia de negocios (BI)',
 'Puedo explicar conceptos de BI, dashboards, KPIs, herramientas de análisis y toma de decisiones estratégicas.',
 'ALUMNO', 'SIVACAD', 'inteligencia negocios,bi,dashboards,kpis', 1, 68),

('TUTOR_GRAFICACION_Y_VISUALIZACION', 'TUTOR', 'Graficación y visualización',
 'Puedo ayudar con gráficos 2D/3D, visualización de datos, OpenGL, WebGL, shaders y técnicas de renderizado.',
 'ALUMNO', 'SIVACAD', 'graficacion,visualizacion,opengl', 1, 69),

('TUTOR_SIMULACION_Y_MODELADO', 'TUTOR', 'Simulación y modelado',
 'Puedo ayudar con simulación de sistemas, modelado matemático, análisis de resultados y optimización de procesos.',
 'ALUMNO', 'SIVACAD', 'simulacion,modelado,analisis', 1, 70),

('TUTOR_ARQUITECTURA_DE_COMPUTADORAS', 'TUTOR', 'Arquitectura de computadoras',
 'Puedo ayudar con CPU, memoria, buses, instrucciones, ensamblador y diseño de sistemas digitales.',
 'ALUMNO', 'SIVACAD', 'arquitectura,computadoras,cpu', 1, 71),

('TUTOR_CIBERSEGURIDAD', 'TUTOR', 'Ciberseguridad',
 'Puedo explicar autenticación, autorización, amenazas comunes, buenas prácticas, cifrado básico y protección de datos.',
 'ALUMNO', 'SIVACAD', 'ciberseguridad,seguridad,datos', 1, 72),

('TUTOR_DESARROLLO_SUSTENTABLE', 'TUTOR', 'Desarrollo sustentable',
 'Puedo explicar conceptos de sostenibilidad, impacto ambiental, responsabilidad social y estrategias para un desarrollo equilibrado.',
 'ALUMNO', 'SIVACAD', 'sustentable,sostenibilidad,impacto ambiental', 1, 73),

('TUTOR_PROGRAMACION_LOGICA_Y_FUNCIONAL', 'TUTOR', 'Programación lógica y funcional',
 'Puedo explicar programación declarativa, lógica de predicados, recursión, funciones puras y evaluación perezosa.',
 'ALUMNO', 'SIVACAD', 'programacion logica,funcional,declarativa', 1, 74),

('TUTOR_SISTEMAS_OPERATIVOS', 'TUTOR', 'Sistemas operativos',
 'Puedo explicar conceptos de sistemas operativos, procesos, hilos, memoria, archivos, seguridad y administración de sistemas.',
 'ALUMNO', 'SIVACAD', 'sistemas operativos,procesos,memoria', 1, 75),

('TUTOR_TALLER_DE_INVESTIGACION_1', 'TUTOR', 'Taller de investigación I',
 'Puedo orientar sobre metodología de investigación, planteamiento de problemas, hipótesis, diseño experimental y análisis de datos.',
 'ALUMNO', 'SIVACAD', 'investigacion,taller,metodologia', 1, 76),

('TUTOR_TALLER_DE_INVESTIGACION_2', 'TUTOR', 'Taller de investigación II',
 'Puedo ayudar con redacción científica, presentación de resultados, discusión de hallazgos y elaboración de conclusiones.',
 'ALUMNO', 'SIVACAD', 'investigacion,taller,redaccion', 1, 77),

('TUTOR_TALLER_DE_SISTEMAS_OPERATIVOS', 'TUTOR', 'Taller de Sistemas Operativos',
 'Puedo explicar conceptos de sistemas operativos, procesos, hilos, memoria, archivos, seguridad y administración de sistemas.',
 'ALUMNO', 'SIVACAD', 'sistemas operativos,procesos,memoria', 1, 78);
COMMIT;
