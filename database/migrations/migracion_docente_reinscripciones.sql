-- =========================================================
-- MIGRACIÓN: DOCENTE REINSCRIPCIONES
-- Soporte: notificaciones de continuidad, cambios de grupo,
--          incidencias de reinscripción, resumen por grupo
-- =========================================================

CREATE TABLE IF NOT EXISTS docente_notificaciones_reinscripcion (
    id_notificacion BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_docente INT NOT NULL,
    id_periodo INT NOT NULL,
    tipo VARCHAR(50) NOT NULL COMMENT 'reinscrito,baja,cambio_grupo,cambio_carrera,incidencia',
    mensaje TEXT NOT NULL,
    id_alumno INT NULL,
    id_grupo INT NULL,
    id_inscripcion BIGINT NULL,
    leida TINYINT(1) DEFAULT 0,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_dnr_docente (id_docente),
    KEY idx_dnr_periodo (id_periodo),
    KEY idx_dnr_leida (id_docente, leida),
    CONSTRAINT fk_dnr_docente
      FOREIGN KEY (id_docente) REFERENCES docentes(id_docente)
      ON DELETE CASCADE
      ON UPDATE CASCADE,
    CONSTRAINT fk_dnr_periodo
      FOREIGN KEY (id_periodo) REFERENCES periodos(id_periodo)
      ON DELETE CASCADE
      ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS docente_reinscripcion_resumen (
    id_resumen BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_docente INT NOT NULL,
    id_periodo INT NOT NULL,
    id_grupo INT NOT NULL,
    total_alumnos INT DEFAULT 0,
    reinscritos INT DEFAULT 0,
    bajas INT DEFAULT 0,
    cambios_grupo INT DEFAULT 0,
    cambios_carrera INT DEFAULT 0,
    incidencias INT DEFAULT 0,
    actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY idx_drr_grupo_periodo (id_docente, id_periodo, id_grupo),
    CONSTRAINT fk_drr_docente
      FOREIGN KEY (id_docente) REFERENCES docentes(id_docente)
      ON DELETE CASCADE
      ON UPDATE CASCADE,
    CONSTRAINT fk_drr_periodo
      FOREIGN KEY (id_periodo) REFERENCES periodos(id_periodo)
      ON DELETE CASCADE
      ON UPDATE CASCADE,
    CONSTRAINT fk_drr_grupo
      FOREIGN KEY (id_grupo) REFERENCES grupos(id_grupo)
      ON DELETE CASCADE
      ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
