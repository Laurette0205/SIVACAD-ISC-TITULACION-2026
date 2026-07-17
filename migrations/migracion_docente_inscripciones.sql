USE sivacad_isc;

START TRANSACTION;

-- =========================================================
-- NOTIFICACIONES DOCENTE
-- =========================================================
CREATE TABLE IF NOT EXISTS notificaciones_docente (
  id_notificacion BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_docente INT NOT NULL,
  id_grupo INT NULL,
  id_periodo INT NULL,
  tipo ENUM(
    'cambio_inscripcion',
    'alta',
    'baja',
    'inconsistencia',
    'actualizacion_lista'
  ) NOT NULL,
  mensaje TEXT NOT NULL,
  leida TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_docente FOREIGN KEY (id_docente) REFERENCES docentes(id_docente),
  CONSTRAINT fk_notif_grupo FOREIGN KEY (id_grupo) REFERENCES grupos(id_grupo),
  CONSTRAINT fk_notif_periodo FOREIGN KEY (id_periodo) REFERENCES periodos(id_periodo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- INSERTAR NOTIFICACIONES DE PRUEBA (opcional)
-- =========================================================
INSERT INTO notificaciones_docente (id_docente, id_grupo, id_periodo, tipo, mensaje)
SELECT
  ca.id_docente,
  ca.id_grupo,
  ca.id_periodo,
  'actualizacion_lista',
  'La lista oficial de alumnos ha sido actualizada. Revisa los cambios en tu grupo.'
FROM cargas_academicas ca
WHERE ca.estado = 'ACTIVA'
  AND NOT EXISTS (
    SELECT 1 FROM notificaciones_docente nd
    WHERE nd.id_docente = ca.id_docente
      AND nd.id_grupo = ca.id_grupo
      AND nd.id_periodo = ca.id_periodo
      AND nd.tipo = 'actualizacion_lista'
  )
LIMIT 50;

COMMIT;
