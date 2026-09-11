const pool = require('../config/db');

exports.getDashboard = async (req, res) => {
  try {
    const idInstitucion = req.user?.id_institucion || 1;

    const [alumnos] = await pool.execute(
      `SELECT COUNT(*) AS total FROM alumnos WHERE id_institucion = ?`,
      [idInstitucion]
    );

    const [docentes] = await pool.execute(
      `SELECT COUNT(*) AS total FROM docentes WHERE id_institucion = ?`,
      [idInstitucion]
    );

    const [inscripciones] = await pool.execute(
      `SELECT COUNT(*) AS total FROM inscripciones WHERE id_institucion = ?`,
      [idInstitucion]
    );

    const [evaluaciones] = await pool.execute(
      `SELECT COUNT(*) AS total FROM evaluaciones WHERE id_institucion = ?`,
      [idInstitucion]
    );

    const [periodos] = await pool.execute(
      `SELECT COUNT(*) AS total FROM periodos`
    );

    const [grupos] = await pool.execute(
      `SELECT COUNT(*) AS total FROM grupos WHERE id_institucion = ?`,
      [idInstitucion]
    );

    return res.json({
      ok: true,
      data: {
        alumnos: alumnos[0]?.total || 0,
        docentes: docentes[0]?.total || 0,
        inscripciones: inscripciones[0]?.total || 0,
        evaluaciones: evaluaciones[0]?.total || 0,
        periodos: periodos[0]?.total || 0,
        grupos: grupos[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('ERROR EN DASHBOARD:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al cargar dashboard'
    });
  }
};