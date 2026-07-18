// ==============================
// 📦 IMPORTACIONES
// ==============================
const pool = require('../config/db');

// ==============================
// 🔧 UTILIDADES
// ==============================
function normalizeTipoInscripcion(value) {
  const raw = String(value || '').trim().toLowerCase();

  if (
    raw === 'primera_vez' ||
    raw === 'primera vez' ||
    raw === 'primera-vez' ||
    raw === 'primera' ||
    raw === 'nuevo'
  ) {
    return 'Primera_Vez';
  }

  if (
    raw === 'reinscripcion' ||
    raw === 'reinscripción' ||
    raw === 'reinscribir' ||
    raw === 'reinscripcion'
  ) {
    return 'Reinscripcion';
  }

  return 'Primera_Vez';
}

async function getPeriodoActivo(conn) {
  const [rows] = await conn.execute(
    `SELECT id_periodo
     FROM periodos
     WHERE estado = 'Activo'
     ORDER BY id_periodo DESC
     LIMIT 1`
  );

  return rows[0] || null;
}

async function getAlumnoExiste(conn, id_alumno) {
  const [rows] = await conn.execute(
    `SELECT id_alumno
     FROM alumnos
     WHERE id_alumno = ?
     LIMIT 1`,
    [id_alumno]
  );

  return rows[0] || null;
}

async function getPeriodoExiste(conn, id_periodo) {
  const [rows] = await conn.execute(
    `SELECT id_periodo
     FROM periodos
     WHERE id_periodo = ?
     LIMIT 1`,
    [id_periodo]
  );

  return rows[0] || null;
}

function getUserRoleName(user) {
  return String(user?.rol || user?.rol_nombre || user?.role || '')
    .trim()
    .toUpperCase();
}

function isAlumno(user) {
  return getUserRoleName(user) === 'ALUMNO' || Number(user?.rol_id || user?.id_rol || 0) === 4;
}

// ==============================
// 📥 LISTAR INSCRIPCIONES
// ==============================
exports.listarInscripciones = async (req, res) => {
  let conn;

  try {
    conn = await pool.getConnection();
    const params = [];
    const where = [];

    if (isAlumno(req.user)) {
      where.push('a.id_usuario = ?');
      params.push(req.user.id_usuario);
    }

    const [rows] = await conn.execute(
      `SELECT
        i.id_inscripcion,
        i.id_alumno,
        a.matricula,
        CONCAT(a.apellido_paterno, ' ', a.apellido_materno, ' ', a.nombres) AS alumno,
        CONCAT(a.nombres, ' ', a.apellido_paterno, ' ', a.apellido_materno) AS nombre_completo,
        i.id_periodo,
        p.nombre_periodo,
        i.tipo_inscripcion,
        i.estado,
        i.observaciones,
        i.fecha_inscripcion
      FROM inscripciones i
      INNER JOIN alumnos a
        ON a.id_alumno = i.id_alumno
      INNER JOIN periodos p
        ON p.id_periodo = i.id_periodo
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY i.id_inscripcion DESC`
      ,
      params
    );

    return res.json({
      ok: true,
      data: rows
    });
  } catch (error) {
    console.error('Error al listar inscripciones:', error);

    return res.status(500).json({
      ok: false,
      message: 'Error al obtener inscripciones'
    });
  } finally {
    if (conn) conn.release();
  }
};

// ==============================
// ➕ CREAR INSCRIPCIÓN
// ==============================
exports.crearInscripcion = async (req, res) => {
  let conn;

  try {
    const {
      id_alumno,
      id_periodo,
      tipo_inscripcion,
      observaciones = ''
    } = req.body;

    const tipoFinal = normalizeTipoInscripcion(tipo_inscripcion);

    if (!id_alumno) {
      return res.status(400).json({
        ok: false,
        message: 'El ID del alumno es obligatorio'
      });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const alumno = await getAlumnoExiste(conn, id_alumno);

    if (!alumno) {
      await conn.rollback();
      return res.status(404).json({
        ok: false,
        message: 'El alumno no existe'
      });
    }

    let periodoFinal = id_periodo;

    if (!periodoFinal) {
      const periodoActivo = await getPeriodoActivo(conn);

      if (!periodoActivo) {
        await conn.rollback();
        return res.status(400).json({
          ok: false,
          message: 'No existe un periodo activo para registrar la inscripción'
        });
      }

      periodoFinal = periodoActivo.id_periodo;
    } else {
      const periodoExiste = await getPeriodoExiste(conn, periodoFinal);

      if (!periodoExiste) {
        await conn.rollback();
        return res.status(404).json({
          ok: false,
          message: 'El periodo no existe'
        });
      }
    }

    const [duplicado] = await conn.execute(
      `SELECT id_inscripcion
       FROM inscripciones
       WHERE id_alumno = ?
         AND id_periodo = ?
         AND tipo_inscripcion = ?
       LIMIT 1`,
      [id_alumno, periodoFinal, tipoFinal]
    );

    if (duplicado.length) {
      await conn.rollback();
      return res.status(409).json({
        ok: false,
        message: 'Ya existe una inscripción registrada para este alumno en este periodo'
      });
    }

    const estadoInicial = tipoFinal === 'Reinscripcion' ? 'Validada' : 'Validada';

    const [result] = await conn.execute(
      `INSERT INTO inscripciones
        (id_alumno, id_periodo, fecha_inscripcion, tipo_inscripcion, estado, observaciones)
       VALUES
        (?, ?, NOW(), ?, ?, ?)`,
      [
        id_alumno,
        periodoFinal,
        tipoFinal,
        estadoInicial,
        observaciones?.trim() || null
      ]
    );

    const id_inscripcion = result.insertId;

    if (tipoFinal === 'Reinscripcion') {
      const id_usuario = req.user?.id_usuario || null;

      await conn.execute(
        `INSERT INTO reinscripciones
          (id_inscripcion, motivo, validada_por, fecha_validacion)
         VALUES
          (?, ?, ?, NOW())`,
        [
          id_inscripcion,
          observaciones?.trim() || null,
          id_usuario
        ]
      );
    }

    await conn.commit();

    return res.status(201).json({
      ok: true,
      message: 'Inscripción registrada correctamente',
      data: {
        id_inscripcion,
        id_alumno,
        id_periodo: periodoFinal,
        tipo_inscripcion: tipoFinal,
        estado: estadoInicial,
        observaciones: observaciones?.trim() || null
      }
    });
  } catch (error) {
    if (conn) await conn.rollback();

    console.error('Error al crear inscripción:', error);

    return res.status(500).json({
      ok: false,
      message: 'Error al registrar inscripción'
    });
  } finally {
    if (conn) conn.release();
  }
};


