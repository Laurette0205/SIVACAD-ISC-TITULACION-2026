const db = require('../config/db'); // ajusta esta ruta a tu conexión real

const listBajas = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        a.id_alumno,
        a.nombres,
        a.apellido_paterno,
        a.apellido_materno,
        CONCAT(a.nombres, ' ', a.apellido_paterno, ' ', a.apellido_materno) AS nombre_completo,
        a.matricula,
        a.curp,
        a.semestre_actual,
        a.estatus_academico,
        a.fotografia,
        a.id_carrera,
        c.nombre_carrera,
        COALESCE(ia.nivel_riesgo, 'Bajo') AS nivel_riesgo,
        COALESCE(ia.descripcion, '') AS alerta,
        COALESCE(ia.recomendacion, '') AS observaciones,
        NULL AS id_grupo,
        NULL AS nombre_grupo,
        0 AS cambio_carrera,
        0 AS cambio_de_carrera,
        0 AS transferido,
        0 AS movimiento_carrera,
        0 AS cambio_programa
      FROM alumnos a
      LEFT JOIN carreras c ON c.id_carrera = a.id_carrera
      LEFT JOIN (
        SELECT t1.*
        FROM ia_alertas_desercion t1
        INNER JOIN (
          SELECT id_alumno, MAX(id_alerta) AS id_alerta
          FROM ia_alertas_desercion
          GROUP BY id_alumno
        ) t2 ON t1.id_alerta = t2.id_alerta
      ) ia ON ia.id_alumno = a.id_alumno
      ORDER BY a.apellido_paterno, a.apellido_materno, a.nombres
    `);

    return res.json({
      ok: true,
      data: rows
    });
  } catch (error) {
    console.error('Error al obtener bajas:', error);

    return res.status(500).json({
      ok: false,
      message: 'Error al obtener bajas'
    });
  }
};

module.exports = {
  listBajas
};