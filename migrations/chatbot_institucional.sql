USE sivacad_isc;

START TRANSACTION;

CREATE TABLE IF NOT EXISTS chatbot_mensajes (
    id_mensaje BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    rol_usuario VARCHAR(40) NOT NULL,
    mensaje TEXT NOT NULL,
    respuesta TEXT NOT NULL,
    modo_respuesta VARCHAR(20) NOT NULL DEFAULT 'GEMINI',
    proveedor VARCHAR(20) NOT NULL DEFAULT 'gemini',
    confianza DECIMAL(5,4) DEFAULT NULL,
    tiempo_respuesta_ms INT DEFAULT NULL,
    ip_origen VARCHAR(60) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_chatbot_usuario (id_usuario),
    INDEX idx_chatbot_created (created_at),
    INDEX idx_chatbot_rol (rol_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chatbot_auditoria (
    id_auditoria BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    rol_usuario VARCHAR(40) NOT NULL,
    accion VARCHAR(80) NOT NULL,
    detalle TEXT,
    ip_origen VARCHAR(60) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_auditoria_usuario (id_usuario),
    INDEX idx_auditoria_accion (accion),
    INDEX idx_auditoria_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chatbot_incidencias (
    id_incidencia BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    rol_usuario VARCHAR(40) NOT NULL,
    categoria VARCHAR(60) NOT NULL DEFAULT 'GENERAL',
    descripcion TEXT NOT NULL,
    mensaje_original TEXT,
    respuesta_dada TEXT,
    estado ENUM('ABIERTA','EN_REVISION','RESUELTA','CERRADA') NOT NULL DEFAULT 'ABIERTA',
    prioridad ENUM('BAJA','MEDIA','ALTA','CRITICA') NOT NULL DEFAULT 'MEDIA',
    resuelto_por INT DEFAULT NULL,
    solucion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resuelto_en TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_incidencias_estado (estado),
    INDEX idx_incidencias_prioridad (prioridad),
    INDEX idx_incidencias_usuario (id_usuario),
    INDEX idx_incidencias_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chatbot_configuracion (
    id_config BIGINT AUTO_INCREMENT PRIMARY KEY,
    clave VARCHAR(80) NOT NULL UNIQUE,
    valor TEXT NOT NULL,
    descripcion VARCHAR(255) DEFAULT NULL,
    tipo_dato VARCHAR(30) NOT NULL DEFAULT 'TEXTO',
    editable TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO chatbot_configuracion (clave, valor, descripcion, tipo_dato, editable) VALUES
('SISTEMA_ACTIVO', 'true', 'Activa o desactiva el chatbot institucional', 'BOOLEAN', 1),
('MODO_MANTENIMIENTO', 'false', 'Pone el chatbot en modo mantenimiento', 'BOOLEAN', 1),
('TIEMPO_RESPUESTA_MAX', '15000', 'Tiempo máximo de espera de la IA (ms)', 'NUMERO', 1),
('MAX_HISTORIAL_POR_USUARIO', '50', 'Máximo de mensajes guardados por usuario', 'NUMERO', 1),
('PROVEEDOR_IA', 'gemini', 'Proveedor de IA activo: gemini, local', 'TEXTO', 1),
('MODELO_IA', 'gemini-2.5-flash', 'Modelo del proveedor IA', 'TEXTO', 1),
('MENSAJE_BIENVENIDA', 'Hola, soy el asistente institucional de SIVACAD. Puedo ayudarte con módulos, usuarios, reportes, seguridad y actividad general del sistema.', 'Mensaje de bienvenida del chatbot', 'TEXTO', 1),
('PERMITIR_EXPORTACION', 'true', 'Permite exportar conversaciones y auditoría', 'BOOLEAN', 1),
('AUDITORIA_ACTIVA', 'true', 'Registra todas las interacciones en auditoría', 'BOOLEAN', 1),
('MODO_SUPERVISION', 'true', 'Activa respuestas ejecutivas con sugerencias de acción', 'BOOLEAN', 1);

COMMIT;
