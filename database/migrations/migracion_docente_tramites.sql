-- =========================================================
-- MIGRACIÓN: MÓDULO DE TRÁMITES - DOCENTE ACADÉMICO
-- =========================================================
-- Sistema: SIVACAD-ISC
-- Descripción: Estados, columnas y tipos de observación
-- para la participación del docente en el flujo de
-- trámites académicos.
-- Requiere ejecutar primero migracion_admin_tramites.sql
-- y migracion_coordinador_tramites.sql.
-- =========================================================

USE sivacad_isc;

-- =========================================================
-- 1. AGREGAR ESTADO OBSERVADO
-- =========================================================
INSERT IGNORE INTO tramites_estados (codigo, nombre, orden) VALUES
('OBSERVADO', 'Observado', 7);

-- =========================================================
-- 2. AGREGAR TIPO DE OBSERVACIÓN PARA DOCENTE
-- =========================================================
-- MySQL no tiene ALTER ENUM IF NOT EXISTS; se ejecuta
-- siempre pero es idempotente si ya existe la definición.
ALTER TABLE tramites_observaciones
MODIFY COLUMN tipo ENUM(
  'REVISION_DOCUMENTAL','ANALISIS_CURRICULAR',
  'OBSERVACION_GRAL','VALIDACION','DICTAMEN_PREVIO',
  'OPINION_DOCENTE','VALIDACION_MATERIAS'
) NOT NULL DEFAULT 'OBSERVACION_GRAL';

-- =========================================================
-- 3. ACTUALIZAR TABLA TRAMITES CON CAMPOS DE DOCENTE
-- =========================================================
ALTER TABLE tramites
  ADD COLUMN IF NOT EXISTS docente_opinion TEXT DEFAULT NULL
    AFTER validado_coordinador_en,
  ADD COLUMN IF NOT EXISTS docente_opinion_emitida TINYINT(1) DEFAULT 0
    AFTER docente_opinion,
  ADD COLUMN IF NOT EXISTS docente_opinion_por INT DEFAULT NULL
    AFTER docente_opinion_emitida,
  ADD COLUMN IF NOT EXISTS docente_opinion_en DATETIME DEFAULT NULL
    AFTER docente_opinion_por,
  ADD COLUMN IF NOT EXISTS docente_validacion_materias TEXT DEFAULT NULL
    AFTER docente_opinion_en,
  ADD COLUMN IF NOT EXISTS docente_observaciones_desempeno TEXT DEFAULT NULL
    AFTER docente_validacion_materias;

-- =========================================================
-- 4. FK e índices para columnas nuevas
-- =========================================================
CALL sp_add_fk_if_not_exists('fk_tramites_docente_opinion_por',
  'ALTER TABLE tramites ADD CONSTRAINT fk_tramites_docente_opinion_por
   FOREIGN KEY (docente_opinion_por) REFERENCES usuarios(id_usuario)
   ON DELETE SET NULL ON UPDATE CASCADE');

CALL sp_add_index_if_not_exists('tramites', 'idx_tramites_docente_opinion',
  'ALTER TABLE tramites ADD INDEX idx_tramites_docente_opinion (docente_opinion_emitida)');
