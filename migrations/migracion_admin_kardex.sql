-- =========================================================
-- MIGRACIÓN: ADMIN KARDEX
-- Versión compatible con MySQL estándar
-- =========================================================

DELIMITER $$

DROP PROCEDURE IF EXISTS migrate_admin_kardex $$
CREATE PROCEDURE migrate_admin_kardex()
BEGIN
  DECLARE _count INT;

  -- Agregar columnas a kardex_alumno si no existen
  SELECT COUNT(*) INTO _count FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'kardex_alumno' AND COLUMN_NAME = 'foto_institucional';
  IF _count = 0 THEN
    ALTER TABLE kardex_alumno ADD COLUMN foto_institucional VARCHAR(255) NULL AFTER foto_alumno;
  END IF;

  SELECT COUNT(*) INTO _count FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'kardex_alumno' AND COLUMN_NAME = 'foto_autorizada_por';
  IF _count = 0 THEN
    ALTER TABLE kardex_alumno ADD COLUMN foto_autorizada_por INT NULL AFTER foto_institucional;
  END IF;

  SELECT COUNT(*) INTO _count FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'kardex_alumno' AND COLUMN_NAME = 'foto_autorizada_en';
  IF _count = 0 THEN
    ALTER TABLE kardex_alumno ADD COLUMN foto_autorizada_en DATETIME NULL AFTER foto_autorizada_por;
  END IF;

  SELECT COUNT(*) INTO _count FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'kardex_alumno' AND COLUMN_NAME = 'firma_electronica';
  IF _count = 0 THEN
    ALTER TABLE kardex_alumno ADD COLUMN firma_electronica TEXT NULL AFTER url_qr;
  END IF;

  SELECT COUNT(*) INTO _count FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'kardex_alumno' AND COLUMN_NAME = 'folio_kardex';
  IF _count = 0 THEN
    ALTER TABLE kardex_alumno ADD COLUMN folio_kardex VARCHAR(50) NULL UNIQUE AFTER firma_electronica;
  END IF;

  SELECT COUNT(*) INTO _count FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'kardex_alumno' AND COLUMN_NAME = 'ultima_actualizacion';
  IF _count = 0 THEN
    ALTER TABLE kardex_alumno ADD COLUMN ultima_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER folio_kardex;
  END IF;

  SELECT COUNT(*) INTO _count FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'kardex_alumno' AND COLUMN_NAME = 'actualizado_por';
  IF _count = 0 THEN
    ALTER TABLE kardex_alumno ADD COLUMN actualizado_por INT NULL AFTER ultima_actualizacion;
  END IF;

  -- Agregar foreign keys si no existen
  SELECT COUNT(*) INTO _count FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'kardex_alumno' AND CONSTRAINT_NAME = 'fk_kardex_foto_autorizada';
  IF _count = 0 THEN
    ALTER TABLE kardex_alumno ADD CONSTRAINT fk_kardex_foto_autorizada
      FOREIGN KEY (foto_autorizada_por) REFERENCES usuarios(id_usuario)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  SELECT COUNT(*) INTO _count FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'kardex_alumno' AND CONSTRAINT_NAME = 'fk_kardex_actualizado_por';
  IF _count = 0 THEN
    ALTER TABLE kardex_alumno ADD CONSTRAINT fk_kardex_actualizado_por
      FOREIGN KEY (actualizado_por) REFERENCES usuarios(id_usuario)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

END $$

DELIMITER ;

CALL migrate_admin_kardex();

DROP PROCEDURE IF EXISTS migrate_admin_kardex;

-- =========================================================
-- TABLA: KARDEX AUDITORÍA
-- =========================================================
CREATE TABLE IF NOT EXISTS kardex_auditoria (
    id_auditoria BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_kardex BIGINT NULL,
    id_alumno INT NULL,
    accion VARCHAR(50) NOT NULL,
    campo_modificado VARCHAR(100) NULL,
    valor_anterior TEXT NULL,
    valor_nuevo TEXT NULL,
    detalle TEXT NULL,
    id_usuario INT NULL,
    ip_origen VARCHAR(45) NULL,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_ka_kardex (id_kardex),
    KEY idx_ka_alumno (id_alumno),
    KEY idx_ka_accion (accion),
    KEY idx_ka_creado (creado_en),
    CONSTRAINT fk_ka_kardex
      FOREIGN KEY (id_kardex) REFERENCES kardex_alumno(id_kardex)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_ka_alumno
      FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_ka_usuario
      FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
      ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- TABLA: KARDEX HISTORIAL ACADÉMICO
-- =========================================================
CREATE TABLE IF NOT EXISTS kardex_historial_academico (
    id_historial BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_alumno INT NOT NULL,
    id_periodo INT NOT NULL,
    id_materia INT NULL,
    id_grupo INT NULL,
    calificacion DECIMAL(5,2) NULL,
    creditos DECIMAL(5,2) DEFAULT 0,
    tipo_materia ENUM('Ordinaria','Repeticion','Extraordinario','Especial') DEFAULT 'Ordinaria',
    estado ENUM('Cursando','Acreditada','No Acreditada','Exento') DEFAULT 'Cursando',
    observaciones TEXT NULL,
    registrado_por INT NULL,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_kha_alumno (id_alumno),
    KEY idx_kha_periodo (id_periodo),
    CONSTRAINT fk_kha_alumno
      FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_kha_periodo
      FOREIGN KEY (id_periodo) REFERENCES periodos(id_periodo)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_kha_materia
      FOREIGN KEY (id_materia) REFERENCES materias(id_materia)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_kha_grupo
      FOREIGN KEY (id_grupo) REFERENCES grupos(id_grupo)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_kha_registrado
      FOREIGN KEY (registrado_por) REFERENCES usuarios(id_usuario)
      ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- TABLA: KARDEX SELLOS
-- =========================================================
CREATE TABLE IF NOT EXISTS kardex_sellos (
    id_sello BIGINT AUTO_INCREMENT PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL UNIQUE COMMENT 'sivacad,division_isc,control_escolar',
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT NULL,
    imagen_sello VARCHAR(255) NULL,
    activo TINYINT(1) DEFAULT 1,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- DATOS INICIALES: SELLOS
-- =========================================================
INSERT IGNORE INTO kardex_sellos (tipo, titulo, descripcion) VALUES
('sivacad', 'Sello SIVACAD', 'Sello oficial del Sistema Integral de Validación y Control Académico'),
('division_isc', 'Sello División ISC', 'Sello de la División de Ingeniería en Sistemas Computacionales'),
('control_escolar', 'Sello Control Escolar', 'Sello oficial de Control Escolar');
