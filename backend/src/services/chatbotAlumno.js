'use strict';

const pool = require('../config/db');

function nombreCompletoUsuario(row) {
  const parts = [row.apellido_paterno || '', row.apellido_materno || '', row.nombres || row.nombre || ''];
  return parts.filter(Boolean).join(' ').trim();
}

function nombreCompletoDocente(d) {
  const parts = [d.apellido_paterno || '', d.apellido_materno || '', d.nombres || ''];
  return parts.filter(Boolean).join(' ').trim();
}

async function getIdAlumno(idUsuario) {
  const [rows] = await pool.execute('SELECT id_alumno, semestre_actual FROM alumnos WHERE id_usuario = ? LIMIT 1', [idUsuario]);
  return rows.length > 0 ? { id_alumno: rows[0].id_alumno, semestre_actual: rows[0].semestre_actual } : null;
}

async function getGruposAlumno(idAlumno, idPeriodo) {
  const [rows] = await pool.execute(
    `SELECT g.id_grupo, g.nombre_grupo, g.semestre
     FROM grupos_alumnos ga
     JOIN grupos g ON ga.id_grupo = g.id_grupo
     WHERE ga.id_alumno = ? AND ga.id_periodo = ? AND ga.estado = 'ACTIVO'`,
    [idAlumno, idPeriodo]
  );
  return rows;
}

async function getDocenteMateria(nombreMateria, idPeriodo, idAlumno) {
  const sql = `
    SELECT DISTINCT u.apellido_paterno, u.apellido_materno, u.nombres, u.correo_institucional,
           ca.id_materia, m.nombre_materia, g.nombre_grupo
    FROM grupos_alumnos ga
    JOIN grupos g ON ga.id_grupo = g.id_grupo
    JOIN cargas_academicas ca ON g.id_grupo = ca.id_grupo AND ca.id_periodo = ?
    JOIN materias m ON ca.id_materia = m.id_materia
    JOIN docentes d ON ca.id_docente = d.id_docente
    JOIN usuarios u ON d.id_usuario = u.id_usuario
    WHERE ga.id_alumno = ? AND ga.id_periodo = ? AND ga.estado = 'ACTIVO'
      AND m.nombre_materia LIKE ? AND ca.estado = 'ACTIVA'
    ORDER BY u.apellido_paterno, u.apellido_materno, u.nombres`;
  const [rows] = await pool.execute(sql, [idPeriodo, idAlumno, idPeriodo, `%${nombreMateria}%`]);
  return rows;
}

async function getDocentesAlumno(idPeriodo, idAlumno) {
  const sql = `
    SELECT DISTINCT u.apellido_paterno, u.apellido_materno, u.nombres, u.correo_institucional,
           m.nombre_materia, g.nombre_grupo
    FROM grupos_alumnos ga
    JOIN grupos g ON ga.id_grupo = g.id_grupo
    JOIN cargas_academicas ca ON g.id_grupo = ca.id_grupo AND ca.id_periodo = ?
    JOIN materias m ON ca.id_materia = m.id_materia
    JOIN docentes d ON ca.id_docente = d.id_docente
    JOIN usuarios u ON d.id_usuario = u.id_usuario
    WHERE ga.id_alumno = ? AND ga.id_periodo = ? AND ga.estado = 'ACTIVO' AND ca.estado = 'ACTIVA'
    ORDER BY u.apellido_paterno, u.apellido_materno, u.nombres`;
  const [rows] = await pool.execute(sql, [idPeriodo, idAlumno, idPeriodo]);
  return rows;
}

async function getMateriasBajoPromedio(idAlumno) {
  const sql = `
    SELECT m.nombre_materia, COALESCE(kh.calificacion, 0) AS calificacion,
           CASE WHEN kh.estado IS NOT NULL THEN kh.estado ELSE 'Cursando' END AS estado_materia
    FROM materias m
    JOIN cargas_academicas ca ON m.id_materia = ca.id_materia
    JOIN grupos_alumnos ga ON ca.id_grupo = ga.id_grupo AND ga.id_alumno = ?
    LEFT JOIN kardex_historial_academico kh ON kh.id_alumno = ga.id_alumno AND kh.id_materia = m.id_materia
    WHERE ga.estado = 'ACTIVO' AND ca.estado = 'ACTIVA'
    HAVING calificacion < 70
    ORDER BY calificacion ASC`;
  const [rows] = await pool.execute(sql, [idAlumno]);
  return rows;
}

async function getCoordinador() {
  const sql = `
    SELECT u.apellido_paterno, u.apellido_materno, u.nombres, u.correo_institucional
    FROM usuarios u
    JOIN roles r ON u.id_rol = r.id_rol
    WHERE r.nombre_rol = 'coordinador'
    LIMIT 1`;
  const [rows] = await pool.execute(sql);
  return rows.length > 0 ? rows[0] : null;
}

async function getCantidadMateriasPeriodo(idPeriodo) {
  const [rows] = await pool.execute(
    'SELECT COUNT(DISTINCT id_materia) AS total FROM cargas_academicas WHERE id_periodo = ? AND estado = ?',
    [idPeriodo, 'ACTIVA']
  );
  return rows[0]?.total || 0;
}

async function getConveniosCount() {
  const [rows] = await pool.execute(
    "SELECT tipo_convenio, COUNT(*) AS total FROM docente_convenios_empresariales WHERE estatus = 'VIGENTE' GROUP BY tipo_convenio"
  );
  return rows;
}

async function getCreditosCompletosCount() {
  const sql = `
    SELECT COUNT(DISTINCT a.id_alumno) AS total
    FROM alumnos a
    WHERE EXISTS (SELECT 1 FROM docente_creditos_complementarios WHERE id_alumno = a.id_alumno AND tipo = 'ACADEMICO' AND estatus = 'CUBIERTO')
      AND EXISTS (SELECT 1 FROM docente_creditos_complementarios WHERE id_alumno = a.id_alumno AND tipo = 'CULTURAL' AND estatus = 'CUBIERTO')
      AND EXISTS (SELECT 1 FROM docente_creditos_complementarios WHERE id_alumno = a.id_alumno AND tipo = 'DEPORTIVO' AND estatus = 'CUBIERTO')`;
  const [rows] = await pool.execute(sql);
  return rows[0]?.total || 0;
}

async function getSegundasOportunidadesCount() {
  const [rows] = await pool.execute(
    "SELECT COUNT(DISTINCT id_alumno) AS total FROM docente_segundas_oportunidades WHERE estatus IN ('PENDIENTE','EN_CURSO','REPROBADO')"
  );
  return rows[0]?.total || 0;
}

async function getAptosTitulacionCount(modalidad) {
  const [rows] = await pool.execute(
    'SELECT COUNT(*) AS total FROM docente_titulacion WHERE modalidad = ? AND estatus = ?',
    [modalidad, 'APTO']
  );
  return rows[0]?.total || 0;
}

async function getAptosBecaExtranjeroCount() {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM docente_beca_extranjero dbe
     JOIN docente_idiomas die ON dbe.id_alumno = die.id_alumno AND die.idioma = 'INGLES'
     WHERE dbe.estatus = 'APTO' AND die.niveles_completados >= 5`
  );
  return rows[0]?.total || 0;
}

async function detectarTipoConsulta(texto) {
  const t = String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  // Docente que imparte una materia
  if ((t.includes('que docente') || t.includes('quien imparte') || t.includes('quien da') || t.includes('quien ensena')) && t.includes('materia')) {
    const match = t.match(/(?:materia|clase|curso)\s+(.+?)(?:\?|$)/);
    return { tipo: 'DOCENTE_MATERIA', materia: match ? match[1].trim() : null };
  }

  // Docentes del semestre
  if ((t.includes('que docente') || t.includes('quienes son') || t.includes('docente tendre') || t.includes('mis docentes') || t.includes('profesores')) && (t.includes('semestre') || t.includes('nuevo ciclo') || t.includes('este ano'))) {
    return { tipo: 'DOCENTES_SEMESTRE' };
  }

  // Docente en junta/comision
  if (t.includes('junta') || t.includes('comision') || t.includes('comision') || (t.includes('docente') && t.includes('no estara'))) {
    return { tipo: 'DOCENTE_COMISION' };
  }

  // Materias en bajo promedio
  if ((t.includes('materia') || t.includes('materias')) && (t.includes('bajo promedio') || t.includes('reprob') || t.includes('bajo') || t.includes('baja calificacion') || t.includes('menos de 70'))) {
    return { tipo: 'MATERIAS_BAJO_PROMEDIO' };
  }

  // Fechas de evaluaciones
  if ((t.includes('fecha') || t.includes('cuando')) && (t.includes('evaluacion') || t.includes('parcial') || t.includes('examen'))) {
    return { tipo: 'FECHAS_EVALUACIONES' };
  }

  // InnovaTecNM
  if ((t.includes('innovatecnm') || t.includes('innova')) && (t.includes('inscrib') || t.includes('convocatoria'))) {
    return { tipo: 'INSCRIPCION_INNOVATECNM' };
  }

  // Materias nuevo ciclo
  if ((t.includes('cuantas materia') || t.includes('cuantas materia')) && (t.includes('nuevo ciclo') || t.includes('este ciclo') || t.includes('nuevo semestre') || t.includes('este semestre'))) {
    return { tipo: 'MATERIAS_NUEVO_CICLO' };
  }

  // Servicio Social disponible
  if (t.includes('servicio social') && (t.includes('disponible') || t.includes('hay') || t.includes('convenio') || t.includes('empresa'))) {
    return { tipo: 'SERVICIO_SOCIAL_DISPONIBLE' };
  }

  // Residencias disponibles
  if ((t.includes('residencia') || t.includes('residencias')) && (t.includes('disponible') || t.includes('hay') || t.includes('convenio') || t.includes('empresa'))) {
    return { tipo: 'RESIDENCIAS_DISPONIBLES' };
  }

  // Requisitos inscripcion/reinscripcion
  if ((t.includes('requisito') || t.includes('documento')) && (t.includes('inscrib') || t.includes('reinscrib') || t.includes('inscripcion') || t.includes('reinscripcion'))) {
    return { tipo: 'REQUISITOS_INSCRIPCION' };
  }

  // Procedimiento titulacion
  if (t.includes('procedimiento') && (t.includes('titular') || t.includes('titulacion'))) {
    if (t.includes('promedio')) return { tipo: 'PROCEDIMIENTO_TITULACION', modalidad: 'PROMEDIO' };
    if (t.includes('memoria') || t.includes('residencia')) return { tipo: 'PROCEDIMIENTO_TITULACION', modalidad: 'MEMORIA_RESIDENCIA' };
    if (t.includes('ceneval')) return { tipo: 'PROCEDIMIENTO_TITULACION', modalidad: 'CENEVAL' };
    if (t.includes('tesis')) return { tipo: 'PROCEDIMIENTO_TITULACION', modalidad: 'TESIS' };
    if (t.includes('proyecto') || t.includes('investigacion')) return { tipo: 'PROCEDIMIENTO_TITULACION', modalidad: 'PROYECTO_INVESTIGACION' };
    return { tipo: 'PROCEDIMIENTO_TITULACION', modalidad: null };
  }

  // Horario Control Escolar
  if (t.includes('horario') || t.includes('control escolar')) {
    if (t.includes('tramitar') || t.includes('documento') || t.includes('papel') || t.includes('atender') || t.includes('atencion') || t.includes('horario de')) {
      return { tipo: 'HORARIO_CONTROL_ESCOLAR' };
    }
  }

  // Plataforma Control Escolar
  if ((t.includes('plataforma') || t.includes('pagina') || t.includes('sitio') || t.includes('portal') || t.includes('digital')) && (t.includes('control escolar') || t.includes('informacion') || t.includes('tramite'))) {
    return { tipo: 'PLATAFORMA_CONTROL_ESCOLAR' };
  }

  // Creditos completos (count)
  if ((t.includes('credito') || t.includes('creditos')) && (t.includes('completo') || t.includes('cubierto') || t.includes('academico') || t.includes('cultural') || t.includes('deportivo')) && (t.includes('cuantos alumno') || t.includes('cuantos existen') || t.includes('cuantos hay'))) {
    return { tipo: 'CREDITOS_COMPLETOS_ALUMNOS' };
  }

  // Segundas oportunidades (count)
  if ((t.includes('segunda') || t.includes('2das') || t.includes('2da') || t.includes('materia especial') || t.includes('recurse') || t.includes('recurses')) && (t.includes('cuantos') || t.includes('existen') || t.includes('deben'))) {
    return { tipo: 'SEGUNDAS_OPORTUNIDADES_ALUMNOS' };
  }

  // Aptos titulacion (count)
  if ((t.includes('apto') || t.includes('titular')) && (t.includes('cuantos') || t.includes('hay') || t.includes('existen'))) {
    if (t.includes('promedio')) return { tipo: 'APTOS_TITULACION_COUNT', modalidad: 'PROMEDIO' };
    if (t.includes('memoria') || t.includes('residencia')) return { tipo: 'APTOS_TITULACION_COUNT', modalidad: 'MEMORIA_RESIDENCIA' };
    if (t.includes('ceneval')) return { tipo: 'APTOS_TITULACION_COUNT', modalidad: 'CENEVAL' };
    if (t.includes('tesis')) return { tipo: 'APTOS_TITULACION_COUNT', modalidad: 'TESIS' };
    if (t.includes('proyecto') || t.includes('investigacion')) return { tipo: 'APTOS_TITULACION_COUNT', modalidad: 'PROYECTO_INVESTIGACION' };
  }

  // Beca extranjero (count)
  if (t.includes('beca') && (t.includes('extranjero') || t.includes('idioma') || t.includes('ingles')) && (t.includes('cuantos') || t.includes('apto'))) {
    return { tipo: 'APTOS_BECA_EXTRANJERO_COUNT' };
  }

  return { tipo: 'GENERAL' };
}

async function ejecutarConsulta(tipoConsulta, params, idUsuario, periodoActivo) {
  const alumnoInfo = await getIdAlumno(idUsuario);
  const idAlumno = alumnoInfo?.id_alumno;

  switch (tipoConsulta.tipo) {
    case 'DOCENTE_MATERIA': {
      const materia = tipoConsulta.materia || 'Programacion Orientada a Objetos';
      if (!idAlumno || !periodoActivo) {
        return { respuesta: 'No se pudo identificar su informacion academica o el periodo activo.', count: 0, tipo: 'DOCENTE_MATERIA' };
      }
      const rows = await getDocenteMateria(materia, periodoActivo, idAlumno);
      if (rows.length === 0) {
        return { respuesta: `No se encontro un docente asignado a la materia "${materia}" en su grupo para el periodo actual.`, count: 0, tipo: 'DOCENTE_MATERIA' };
      }
      const docentes = rows.map(r => `  - ${nombreCompletoDocente(r)} (${r.correo_institucional}) - ${r.nombre_materia} - Grupo ${r.nombre_grupo}`).join('\n');
      return {
        respuesta: `Los docentes que imparten "${materia}" son:\n${docentes}\n\n* Esta informacion se ha registrado. Para contacto directo, escriba al correo del docente correspondiente.`,
        count: rows.length,
        tipo: 'DOCENTE_MATERIA'
      };
    }

    case 'DOCENTES_SEMESTRE': {
      if (!idAlumno || !periodoActivo) {
        return { respuesta: 'No se pudo identificar su informacion academica o el periodo activo.', count: 0, tipo: 'DOCENTES_SEMESTRE' };
      }
      const rows = await getDocentesAlumno(periodoActivo, idAlumno);
      if (rows.length === 0) {
        return { respuesta: 'No se encontraron docentes asignados para el periodo actual.', count: 0, tipo: 'DOCENTES_SEMESTRE' };
      }
      const docentes = rows.map(r => `  - ${nombreCompletoDocente(r)} (${r.correo_institucional}) - ${r.nombre_materia} (Grupo ${r.nombre_grupo})`).join('\n');
      return {
        respuesta: `Estos son los docentes que imparten clase en sus grupos este semestre:\n${docentes}\n\n* Informacion registrada. Puede contactar a cada docente por correo institucional.`,
        count: rows.length,
        tipo: 'DOCENTES_SEMESTRE'
      };
    }

    case 'DOCENTE_COMISION': {
      const coord = await getCoordinador();
      const coordNombre = coord ? nombreCompletoUsuario(coord) : 'el Coordinador';
      const coordCorreo = coord?.correo_institucional || 'coordinacion@tesi.edu.mx';
      return {
        respuesta: `Para conocer que docentes estan en junta, comision o no estaran disponibles, favor de contactar directamente a ${coordNombre} al correo ${coordCorreo}. La Coordinacion de la carrera de Ingenieria en Sistemas Computacionales es la instancia que asigna las juntas academicas y comisiones del personal docente.\n\n* Informacion registrada. Se recomienda acudir a la coordinacion academica para mayor detalle.`,
        count: 0,
        tipo: 'DOCENTE_COMISION'
      };
    }

    case 'MATERIAS_BAJO_PROMEDIO': {
      if (!idAlumno) {
        return { respuesta: 'No se pudo identificar su informacion academica.', count: 0, tipo: 'MATERIAS_BAJO_PROMEDIO' };
      }
      const rows = await getMateriasBajoPromedio(idAlumno);
      if (rows.length === 0) {
        return { respuesta: 'No tiene materias con bajo promedio. Siga asi, buen trabajo.', count: 0, tipo: 'MATERIAS_BAJO_PROMEDIO' };
      }
      const materias = rows.map(r => `  - ${r.nombre_materia}: ${r.calificacion}`).join('\n');
      return {
        respuesta: `Estas son las materias en las que su calificacion esta por debajo de 70:\n${materias}\n\n* Se recomienda acudir con el docente titular de cada materia para solicitar asesoria academica y conocer las opciones de regularizacion.`,
        count: rows.length,
        tipo: 'MATERIAS_BAJO_PROMEDIO'
      };
    }

    case 'FECHAS_EVALUACIONES': {
      return {
        respuesta: `Las fechas de evaluaciones para el periodo actual son las establecidas por el calendario academico institucional del TESI. Generalmente:\n- Primer parcial: Semana 6-7 del periodo\n- Segundo parcial: Semana 12-13 del periodo\n- Tercer parcial: Semana 18-19 del periodo\n\nPara conocer las fechas exactas, consulte el calendario oficial en la plataforma de Control Escolar: https://sigaa.tesi.org.mx/index.php o acuda directamente a Control Escolar del TESI.\n\n* Informacion registrada.`,
        count: 0,
        tipo: 'FECHAS_EVALUACIONES'
      };
    }

    case 'INSCRIPCION_INNOVATECNM': {
      const coord = await getCoordinador();
      const coordNombre = coord ? nombreCompletoUsuario(coord) : 'el Coordinador';
      const coordCorreo = coord?.correo_institucional || 'coordinacion@tesi.edu.mx';
      return {
        respuesta: `Para inscribirse a la convocatoria de InnovaTecNM, debe acudir con ${coordNombre}, Coordinador de la carrera de Ingenieria en Sistemas Computacionales, al correo ${coordCorreo}. Tambien puede consultar la convocatoria vigente en la pagina oficial del TecNM o directamente en la division de estudios profesionales del TESI.\n\nDocumentacion tipica requerida: solicitud de inscripcion, carta de exposicion de motivos, curriculum vitae, historial academico (kardex), y comprobante de inscripcion vigente.\n\n* Informacion registrada.`,
        count: 0,
        tipo: 'INSCRIPCION_INNOVATECNM'
      };
    }

    case 'MATERIAS_NUEVO_CICLO': {
      if (!periodoActivo) {
        return { respuesta: 'No se pudo identificar el periodo activo.', count: 0, tipo: 'MATERIAS_NUEVO_CICLO' };
      }
      const total = await getCantidadMateriasPeriodo(periodoActivo);
      return {
        respuesta: `En el periodo actual (${periodoActivo}), se estan impartiendo ${total} materia(s) en todo el sistema academico de Ingenieria en Sistemas Computacionales. Las materias especificas de su semestre dependen del plan de estudios de la carrera.\n\n* Informacion registrada.`,
        count: total,
        tipo: 'MATERIAS_NUEVO_CICLO'
      };
    }

    case 'SERVICIO_SOCIAL_DISPONIBLE': {
      const convenios = await getConveniosCount();
      const ss = convenios.filter(c => c.tipo_convenio === 'SERVICIO_SOCIAL' || c.tipo_convenio === 'AMBOS');
      const ssCount = ss.reduce((sum, c) => sum + c.total, 0);
      return {
        respuesta: `Si, hay disponibilidad para realizar Servicio Social. Actualmente el TESI cuenta con ${ssCount} convenio(s) vigente(s) para Servicio Social con empresas como Microsoft, Google, Softtek, Infosys, Grupo Salinas, Bancomer BBVA, entre otras.\n\nPuede realizar su Servicio Social tanto en el TESI como en empresas particulares que tengan convenio vigente. Debe acudir con la Division de Estudios Profesionales o el Coordinador de la carrera para conocer los pasos a seguir.\n\nRequisitos generales: haber cubierto al menos el 70% de creditos de su plan de estudios, no contar con adeudos de materias y presentar solicitud formal.\n\n* Informacion registrada.`,
        count: ssCount,
        tipo: 'SERVICIO_SOCIAL_DISPONIBLE'
      };
    }

    case 'RESIDENCIAS_DISPONIBLES': {
      const convenios = await getConveniosCount();
      const rp = convenios.filter(c => c.tipo_convenio === 'RESIDENCIA_PROFESIONAL' || c.tipo_convenio === 'AMBOS');
      const rpCount = rp.reduce((sum, c) => sum + c.total, 0);
      return {
        respuesta: `Si, hay disponibilidad para realizar Residencias Profesionales. Actualmente el TESI cuenta con ${rpCount} convenio(s) vigente(s) para Residencias Profesionales con empresas tecnologias como Microsoft, Google, Oracle, Amazon Web Services, Softtek e Infosys.\n\nPuede realizar sus Residencias Profesionales en el TESI o en empresas con convenio. Acuda con la Division de Estudios Profesionales o el Coordinador de la carrera para iniciar el tramite.\n\nRequisitos: tener al menos el 80% de creditos cubiertos y estar cursando o haber cursado las materias de residencia.\n\n* Informacion registrada.`,
        count: rpCount,
        tipo: 'RESIDENCIAS_DISPONIBLES'
      };
    }

    case 'REQUISITOS_INSCRIPCION': {
      return {
        respuesta: `Requisitos y documentos para inscribirse/reinscribirse a la carrera de Ingenieria en Sistemas Computacionales en el Tecnologico de Estudios Superiores de Ixtapaluca (TESI):\n\nDOCUMENTACION PARA INSCRIPCION (nuevo ingreso):\n  1. Acta de nacimiento (original y copia)\n  2. Certificado de preparatoria o bachillerato (original y copia)\n  3. CURP (copia)\n  4. Comprobante de domicilio reciente\n  5. 6 fotografias tamano infantil blanco y negro\n  6. Identificacion oficial (INE o pasaporte)\n  7. Resultado del examen de admision\n  8. Solicitud de inscripcion llenada\n\nDOCUMENTACION PARA REINSCRIPCION:\n  1. Kardex o historial academico actualizado\n  2. Comprobante de pago de reinscripcion\n  3. Formato de reinscripcion debidamente llenado\n  4. Identificacion oficial vigente\n  5. Correo institucional activo\n\nImportante: Los tramites se realizan en Control Escolar del TESI, ubicado en las instalaciones del plantel. El horario de atencion es de 9:00 a 15:00 y de 16:00 a 18:00 horas.\n\n* Informacion registrada.`,
        count: 0,
        tipo: 'REQUISITOS_INSCRIPCION'
      };
    }

    case 'PROCEDIMIENTO_TITULACION': {
      const modalidad = tipoConsulta.modalidad || 'PROMEDIO';
      const procedimientos = {
        'PROMEDIO': `PROCEDIMIENTO PARA TITULACION POR PROMEDIO GENERAL:\n  1. Solicitar en Control Escolar su certificado de estudios con promedio general.\n  2. Verificar que su promedio sea igual o superior a 90 (o el minimo establecido por la institucion).\n  3. Entregar solicitud de titulacion por promedio en la Division de Estudios Profesionales.\n  4. Adjuntar: kardex certificado, acta de nacimiento, CURP, certificado de estudios, 6 fotografias, pago de derechos.\n  5. Esperar la resolucion del Comite Academico.\n  6. Una vez aprobado, realizar el tramite de caja para la expedicion del titulo.\n\n* Informacion registrada.`,

        'MEMORIA_RESIDENCIA': `PROCEDIMIENTO PARA TITULACION POR MEMORIAS DE RESIDENCIA PROFESIONAL:\n  1. Haber concluido satisfactoriamente la Residencia Profesional.\n  2. Elaborar la memoria o reporte tecnico de la residencia.\n  3. Presentar la memoria ante el asesor interno y externo para revision y dictamen.\n  4. Obtener la carta de liberacion de residencia firmada por el asesor interno y externo.\n  5. Solicitar en la Division de Estudios Profesionales la opcion de titulacion por memoria de residencia.\n  6. Presentar el documento final ante el Comite Academico para su evaluacion.\n  7. Aprobar el examen profesional o defensa de la memoria.\n  8. Realizar el pago de derechos de titulacion.\n\nDocumentos requeridos: memoria impresa y digital, carta de liberacion, acta de nacimiento, CURP, certificado de estudios, kardex.\n\n* Informacion registrada.`,

        'TESIS': `PROCEDIMIENTO PARA TITULACION POR TESIS:\n  1. Seleccionar un tema de investigacion con el apoyo de un director de tesis (docente del TESI).\n  2. Registrar el protocolo de tesis ante la Division de Estudios Profesionales.\n  3. Desarrollar la investigacion y redactar la tesis conforme a la guia institucional.\n  4. Obtener el visto bueno del director de tesis.\n  5. Solicitar la revision por parte de un revisor asignado.\n  6. Realizar las correcciones solicitadas.\n  7. Presentar el examen profesional o defensa de tesis ante el jurado.\n  8. Aprobar la defensa y realizar el pago de derechos de titulacion.\n\nDocumentos: tesis impresa y digital, carta de aprobacion del director, acta de nacimiento, CURP, certificado, kardex.\n\n* Informacion registrada.`,

        'CENEVAL': `PROCEDIMIENTO PARA TITULACION POR CENEVAL:\n  1. Registrarse en la pagina oficial de CENEVAL para el examen de Egreso (EGEL).\n  2. Presentar el examen en la fecha y sede asignada.\n  3. Obtener un resultado de Desempeno Satisfactorio o Sobresaliente.\n  4. Solicitar en Control Escolar del TESI la constancia de resultados.\n  5. Entregar en la Division de Estudios Profesionales: constancia CENEVAL, acta de nacimiento, CURP, certificado de estudios, kardex, 6 fotografias.\n  6. Llenar la solicitud de titulacion por CENEVAL.\n  7. Esperar la validacion del Comite Academico.\n  8. Realizar el pago de derechos de titulacion.\n\n* Informacion registrada.`,

        'PROYECTO_INVESTIGACION': `PROCEDIMIENTO PARA TITULACION POR PROYECTO DE INVESTIGACION:\n  1. Seleccionar un problema o tema de investigacion aplicada.\n  2. Registrar el proyecto con un docente asesor.\n  3. Desarrollar el proyecto segun la metodologia establecida.\n  4. Elaborar el informe final del proyecto.\n  5. Obtener la aprobacion del asesor.\n  6. Presentar el proyecto ante el Comite Academico.\n  7. Realizar la defensa oral del proyecto.\n  8. Aprobar la defensa y realizar el pago de derechos de titulacion.\n\nDocumentos: informe impreso y digital, carta de aprobacion del asesor, acta de nacimiento, CURP, certificado de estudios, kardex.\n\n* Informacion registrada.`
      };
      const respuesta = procedimientos[modalidad] || `La opcion de titulacion "${modalidad}" no esta disponible. Las modalidades vigentes son: PROMEDIO, MEMORIA_RESIDENCIA, TESIS, CENEVAL y PROYECTO_INVESTIGACION.\n\nAcuda a la Division de Estudios Profesionales para mayor informacion.`;
      return { respuesta, count: 0, tipo: 'PROCEDIMIENTO_TITULACION' };
    }

    case 'HORARIO_CONTROL_ESCOLAR': {
      return {
        respuesta: `El horario de atencion de Control Escolar del Tecnologico de Estudios Superiores de Ixtapaluca (TESI) es:\n\nLunes a Viernes:\n  - Matutino: 9:00 a 15:00 horas\n  - Vespertino: 16:00 a 18:00 horas\n\nUbicacion: Instalaciones del TESI, edificio de administracion, planta baja.\n\nPara tramites especificos (certificados, kardex, constancias, etc.) se recomienda acudir en horario matutino para mayor disponibilidad.\n\n* Informacion registrada.`,
        count: 0,
        tipo: 'HORARIO_CONTROL_ESCOLAR'
      };
    }

    case 'PLATAFORMA_CONTROL_ESCOLAR': {
      return {
        respuesta: `La plataforma oficial digital de Control Escolar del Tecnologico de Estudios Superiores de Ixtapaluca (TESI) es:\n\n  Plataforma SIGAA: https://sigaa.tesi.org.mx/index.php\n\nEn este sitio puede realizar consultas de su historial academico, horarios, calificaciones, solicitudes de tramites y mas servicios escolares en linea.\n\nPara tramites presenciales, acuda a las instalaciones de Control Escolar en el horario de atencion establecido.\n\n* Informacion registrada.`,
        count: 0,
        tipo: 'PLATAFORMA_CONTROL_ESCOLAR'
      };
    }

    case 'CREDITOS_COMPLETOS_ALUMNOS': {
      const total = await getCreditosCompletosCount();
      return {
        respuesta: total === 0
          ? 'No hay alumnos registrados con creditos academicos, culturales y deportivos completamente cubiertos.'
          : `Actualmente hay ${total} alumno(s) que tienen los creditos academicos, culturales y deportivos completamente cubiertos y al dia. Estos alumnos cumplen con el requisito de creditos complementarios establecido por el plan de estudios.\n\n* Esta informacion ha sido registrada y notificada a la division de Ingenieria en Sistemas Computacionales para conocimiento del Administrador y Coordinador.`,
        count: total,
        tipo: 'CREDITOS_COMPLETOS_ALUMNOS'
      };
    }

    case 'SEGUNDAS_OPORTUNIDADES_ALUMNOS': {
      const total = await getSegundasOportunidadesCount();
      return {
        respuesta: total === 0
          ? 'No hay alumnos con segundas oportunidades, materias especiales o recurses pendientes.'
          : `Actualmente hay ${total} alumno(s) que adeudan segundas oportunidades, materias especiales o recurses. Estos alumnos estan en proceso de regularizacion academica.\n\n* Esta informacion ha sido registrada y notificada a la division de Ingenieria en Sistemas Computacionales para conocimiento del Administrador y Coordinador.`,
        count: total,
        tipo: 'SEGUNDAS_OPORTUNIDADES_ALUMNOS'
      };
    }

    case 'APTOS_TITULACION_COUNT': {
      const modalidad = tipoConsulta.modalidad || 'PROMEDIO';
      const total = await getAptosTitulacionCount(modalidad);
      const nombresModalidad = {
        'PROMEDIO': 'promedio general',
        'MEMORIA_RESIDENCIA': 'memorias de residencia profesional',
        'TESIS': 'tesis',
        'CENEVAL': 'CENEVAL',
        'PROYECTO_INVESTIGACION': 'proyecto de investigacion'
      };
      return {
        respuesta: total === 0
          ? `No hay alumnos aptos para titularse por ${nombresModalidad[modalidad] || modalidad} en este momento.`
          : `Actualmente hay ${total} alumno(s) aptos para titularse por ${nombresModalidad[modalidad] || modalidad}. Estos alumnos cumplen con los requisitos academicos establecidos.\n\n* Esta informacion ha sido registrada y notificada a la division de Ingenieria en Sistemas Computacionales para conocimiento del Administrador y Coordinador.`,
        count: total,
        tipo: 'APTOS_TITULACION_COUNT'
      };
    }

    case 'APTOS_BECA_EXTRANJERO_COUNT': {
      const total = await getAptosBecaExtranjeroCount();
      return {
        respuesta: total === 0
          ? 'No hay alumnos aptos para obtener una beca al extranjero en este momento (requisitos: 5 niveles de ingles completados y promedio minimo de 8.0).'
          : `Actualmente hay ${total} alumno(s) aptos para obtener una beca al extranjero. Estos alumnos han completado al menos 5 niveles de ingles y cumplen con el promedio minimo requerido.\n\n* Esta informacion ha sido registrada y notificada a la division de Ingenieria en Sistemas Computacionales para conocimiento del Administrador y Coordinador.`,
        count: total,
        tipo: 'APTOS_BECA_EXTRANJERO_COUNT'
      };
    }

    default:
      return null;
  }
}

async function logQuery(idAlumno, pregunta, respuesta, tipoConsulta) {
  if (!idAlumno) return;
  try {
    await pool.execute(
      `INSERT INTO docente_query_log (id_docente, pregunta, respuesta, tipo_consulta) VALUES (?, ?, ?, ?)`,
      [idAlumno, pregunta.substring(0, 500), (respuesta || '').substring(0, 2000), tipoConsulta]
    );
  } catch (err) {
    console.error('Error logging alumno query:', err.message);
  }
}

async function getPeriodoActivo() {
  try {
    const [rows] = await pool.execute("SELECT id_periodo FROM periodos WHERE estado = 'Activo' LIMIT 1");
    return rows.length > 0 ? rows[0].id_periodo : null;
  } catch { return null; }
}

module.exports = {
  detectarTipoConsulta,
  ejecutarConsulta,
  logQuery,
  getPeriodoActivo,
  getIdAlumno,
  getDocenteMateria,
  getDocentesAlumno,
  getMateriasBajoPromedio,
  getCoordinador,
  getCantidadMateriasPeriodo,
  getConveniosCount,
  getCreditosCompletosCount,
  getSegundasOportunidadesCount,
  getAptosTitulacionCount,
  getAptosBecaExtranjeroCount
};
