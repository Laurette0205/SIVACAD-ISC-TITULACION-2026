'use strict';

const pool = require('../config/db');

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getNivel(value) {
  if (value >= 75) return 'Crítico';
  if (value >= 50) return 'Alto';
  if (value >= 25) return 'Medio';
  return 'Bajo';
}

class DesercionService {

  async getReportData(filters = {}) {
    const resumen = await this.getResumenEjecutivo();
    const distribucion = await this.getDistribucionRiesgo();
    const parciales = await this.getAnalisisParciales();
    const ciclos = await this.getComparativaCiclos();
    const progresion = await this.getProgresionTemporal();
    const porCarrera = await this.getAnalisisPorCarrera();
    const porMateria = await this.getMateriasCriticas();
    const alertasRecientes = await this.getAlertasRecientes();
    const detalleAlumnos = await this.getDetalleAlumnos();
    const detalleParciales = await this.getDetalleParciales();
    const insights = this.generarInsights(resumen, distribucion, parciales, ciclos, progresion, porCarrera, porMateria);

    return {
      periodo_activo: resumen.periodo_activo,
      generado_en: new Date().toISOString(),
      resumen,
      distribucion_riesgo: distribucion,
      parciales,
      ciclos,
      progresion,
      por_carrera: porCarrera,
      por_materia: porMateria,
      alertas_recientes: alertasRecientes,
      detalle_alumnos: detalleAlumnos,
      detalle_parciales: detalleParciales,
      insights
    };
  }

  async getResumenEjecutivo() {
    const [[row]] = await pool.execute(`
      SELECT
        (SELECT COUNT(*) FROM alumnos) AS alumnos,
        (SELECT COUNT(*) FROM docentes) AS docentes,
        (SELECT COUNT(*) FROM grupos) AS grupos,
        (SELECT COUNT(*) FROM evaluaciones WHERE LOWER(estado) = 'activa') AS evaluaciones,
        (SELECT COUNT(*) FROM ia_alertas_desercion WHERE atendida = 0) AS alertas_pendientes,
        (SELECT COUNT(*) FROM ia_alertas_desercion WHERE atendida = 1) AS alertas_atendidas,
        (SELECT COUNT(*) FROM ia_alertas_desercion) AS alertas_total,
        (SELECT nombre_periodo FROM periodos WHERE LOWER(estado) = 'activo' ORDER BY id_periodo DESC LIMIT 1) AS periodo_activo
    `);
    const total = toNum(row?.alertas_total);
    const atendidas = toNum(row?.alertas_atendidas);
    return {
      alumnos: toNum(row?.alumnos),
      docentes: toNum(row?.docentes),
      grupos: toNum(row?.grupos),
      evaluaciones: toNum(row?.evaluaciones),
      alertas_total: total,
      alertas_pendientes: toNum(row?.alertas_pendientes),
      alertas_atendidas: atendidas,
      tasa_atencion: total > 0 ? Math.round((atendidas / total) * 100) : 0,
      periodo_activo: row?.periodo_activo || 'N/D'
    };
  }

  async getDistribucionRiesgo() {
    const [rows] = await pool.execute(`
      SELECT nivel_riesgo AS nivel, COUNT(*) AS total
      FROM ia_alertas_desercion
      GROUP BY nivel_riesgo
      ORDER BY FIELD(nivel_riesgo,'Bajo','Medio','Alto','Crítico')
    `);
    return rows.map(r => ({ nivel: r.nivel, total: toNum(r.total) }));
  }

  async getAnalisisParciales() {
    const [rows] = await pool.execute(`
      SELECT
        p.numero_parcial,
        ROUND(AVG(p.calificacion_promedio), 1) AS promedio_general,
        SUM(p.riesgos_detectados) AS total_riesgos,
        SUM(p.materias_reprobadas) AS total_reprobadas,
        COUNT(DISTINCT p.id_alumno) AS alumnos_afectados,
        SUM(p.alumnos_activos) AS total_activos,
        SUM(p.alumnos_desertores) AS total_desertores
      FROM ia_desercion_parciales p
      GROUP BY p.numero_parcial
      ORDER BY p.numero_parcial ASC
    `);
    return rows.map(p => {
      const activos = toNum(p.total_activos);
      const desertores = toNum(p.total_desertores);
      const totalAlumnos = activos + desertores;
      const tasa = totalAlumnos > 0 ? Math.round((desertores / totalAlumnos) * 100) : 0;
      return {
        parcial: 'Parcial ' + p.numero_parcial,
        numero: p.numero_parcial,
        promedio_general: toNum(p.promedio_general),
        total_riesgos: toNum(p.total_riesgos),
        total_reprobadas: toNum(p.total_reprobadas),
        alumnos_afectados: toNum(p.alumnos_afectados),
        total_activos: activos,
        total_desertores: desertores,
        total_alumnos: totalAlumnos,
        tasa_desercion: tasa,
        nivel_riesgo: getNivel(tasa)
      };
    });
  }

  async getComparativaCiclos() {
    const [rows] = await pool.execute(`
      SELECT
        p.nombre_periodo AS ciclo,
        COUNT(ia.id_alerta) AS alertas,
        SUM(CASE WHEN ia.nivel_riesgo IN ('Alto','Crítico') THEN 1 ELSE 0 END) AS alto_riesgo,
        ROUND(AVG(ia.puntaje_riesgo), 1) AS riesgo_promedio,
        (SELECT COUNT(*) FROM alumnos WHERE id_carrera IS NOT NULL) AS total_alumnos
      FROM periodos p
      LEFT JOIN ia_alertas_desercion ia ON ia.id_periodo = p.id_periodo
      GROUP BY p.id_periodo, p.nombre_periodo
      ORDER BY p.id_periodo ASC
      LIMIT 10
    `);
    return rows.map(c => {
      const alumnos = toNum(c.total_alumnos);
      const alertas = toNum(c.alertas);
      return {
        ciclo: c.ciclo,
        alertas,
        alto_riesgo: toNum(c.alto_riesgo),
        riesgo_promedio: toNum(c.riesgo_promedio),
        total_alumnos: alumnos,
        tasa_desercion: alumnos > 0 ? Math.round((alertas / alumnos) * 100) : 0
      };
    });
  }

  async getProgresionTemporal() {
    const [rows] = await pool.execute(`
      SELECT
        DATE_FORMAT(COALESCE(ia.revisado_en, ia.id_alerta), '%Y-%m') AS mes,
        SUM(CASE WHEN ia.nivel_riesgo = 'Bajo' THEN 1 ELSE 0 END) AS bajo,
        SUM(CASE WHEN ia.nivel_riesgo = 'Medio' THEN 1 ELSE 0 END) AS medio,
        SUM(CASE WHEN ia.nivel_riesgo = 'Alto' THEN 1 ELSE 0 END) AS alto,
        SUM(CASE WHEN ia.nivel_riesgo = 'Crítico' THEN 1 ELSE 0 END) AS critico,
        COUNT(*) AS total
      FROM ia_alertas_desercion ia
      GROUP BY DATE_FORMAT(COALESCE(ia.revisado_en, ia.id_alerta), '%Y-%m')
      ORDER BY mes ASC
      LIMIT 24
    `);
    return rows.map(r => ({
      mes: r.mes,
      bajo: toNum(r.bajo),
      medio: toNum(r.medio),
      alto: toNum(r.alto),
      critico: toNum(r.critico),
      total: toNum(r.total)
    }));
  }

  async getAnalisisPorCarrera() {
    const [rows] = await pool.execute(`
      SELECT
        c.nombre_carrera,
        COUNT(ia.id_alerta) AS total_alertas,
        SUM(CASE WHEN ia.nivel_riesgo IN ('Alto','Crítico') THEN 1 ELSE 0 END) AS alto_riesgo,
        SUM(CASE WHEN ia.atendida = 0 THEN 1 ELSE 0 END) AS pendientes
      FROM carreras c
      LEFT JOIN alumnos al ON al.id_carrera = c.id_carrera
      LEFT JOIN ia_alertas_desercion ia ON ia.id_alumno = al.id_alumno
      GROUP BY c.id_carrera, c.nombre_carrera
      HAVING total_alertas > 0
      ORDER BY total_alertas DESC
    `);
    return rows.map(r => ({
      carrera: r.nombre_carrera,
      total_alertas: toNum(r.total_alertas),
      alto_riesgo: toNum(r.alto_riesgo),
      pendientes: toNum(r.pendientes)
    }));
  }

  async getMateriasCriticas() {
    const [rows] = await pool.execute(`
      SELECT
        m.nombre_materia,
        COUNT(DISTINCT kh.id_alumno) AS alumnos_evaluados,
        ROUND(AVG(kh.calificacion), 1) AS promedio_materia,
        SUM(CASE WHEN kh.calificacion < 70 THEN 1 ELSE 0 END) AS reprobados
      FROM materias m
      INNER JOIN kardex_historial_academico kh ON kh.id_materia = m.id_materia
      GROUP BY m.id_materia, m.nombre_materia
      HAVING alumnos_evaluados > 0
      ORDER BY reprobados DESC, promedio_materia ASC
      LIMIT 15
    `);
    return rows.map(r => ({
      materia: r.nombre_materia,
      alumnos_evaluados: toNum(r.alumnos_evaluados),
      promedio: toNum(r.promedio_materia),
      reprobados: toNum(r.reprobados),
      nivel: r.promedio_materia < 70 ? 'Crítico' : r.promedio_materia < 80 ? 'Atención' : 'Estable'
    }));
  }

  async getAlertasRecientes() {
    const [rows] = await pool.execute(`
      SELECT
        ia.id_alerta, a.matricula,
        CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS alumno,
        u.nombres, u.apellido_paterno, u.apellido_materno,
        ia.nivel_riesgo, ia.puntaje_riesgo, ia.atendida, ia.estado_seguimiento,
        c.nombre_carrera, p.nombre_periodo
      FROM ia_alertas_desercion ia
      INNER JOIN alumnos a ON ia.id_alumno = a.id_alumno
      INNER JOIN usuarios u ON a.id_usuario = u.id_usuario
      LEFT JOIN carreras c ON a.id_carrera = c.id_carrera
      LEFT JOIN periodos p ON ia.id_periodo = p.id_periodo
      ORDER BY ia.id_alerta DESC
      LIMIT 15
    `);
    return rows;
  }

  async getDetalleAlumnos() {
    const [rows] = await pool.execute(`
      SELECT
        a.matricula,
        CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS alumno,
        c.nombre_carrera, p.nombre_periodo,
        ia.nivel_riesgo, ia.puntaje_riesgo,
        ia.atendida, ia.estado_seguimiento
      FROM ia_alertas_desercion ia
      INNER JOIN alumnos a ON ia.id_alumno = a.id_alumno
      INNER JOIN usuarios u ON a.id_usuario = u.id_usuario
      LEFT JOIN carreras c ON a.id_carrera = c.id_carrera
      LEFT JOIN periodos p ON ia.id_periodo = p.id_periodo
      ORDER BY ia.puntaje_riesgo DESC
    `);
    return rows;
  }

  async getDetalleParciales() {
    const [rows] = await pool.execute(`
      SELECT
        a.matricula,
        CONCAT(u.nombres, ' ', u.apellido_paterno) AS alumno,
        p.numero_parcial, p.calificacion_promedio,
        p.riesgos_detectados, p.materias_reprobadas,
        p.tendencia, p.alumnos_activos, p.alumnos_desertores
      FROM ia_desercion_parciales p
      INNER JOIN alumnos a ON p.id_alumno = a.id_alumno
      INNER JOIN usuarios u ON a.id_usuario = u.id_usuario
      ORDER BY a.matricula, p.numero_parcial
    `);
    return rows.map(r => ({
      ...r,
      numero_parcial: 'Parcial ' + r.numero_parcial
    }));
  }

  generarInsights(resumen, distribucion, parciales, ciclos, progresion, porCarrera, porMateria) {
    const totalDist = distribucion.reduce((s, d) => s + d.total, 0);
    const criticos = distribucion.find(d => d.nivel === 'Crítico')?.total || 0;
    const alto = distribucion.find(d => d.nivel === 'Alto')?.total || 0;
    const tasaAtencion = resumen.tasa_atencion;
    const materiasCriticas = porMateria.filter(m => m.reprobados > 0).slice(0, 3);
    const tendenciaParciales = parciales.length >= 2
      ? (parciales[parciales.length - 1].promedio_general < parciales[0].promedio_general ? 'declive' : 'mejora')
      : 'estable';

    const lista = [];

    lista.push('RESUMEN INSTITUCIONAL: El sistema SIVACAD registra un total de ' + resumen.alumnos + ' alumnos activos distribuidos en ' + resumen.grupos + ' grupos academicos, con la participacion de ' + resumen.docentes + ' docentes. Durante el periodo ' + resumen.periodo_activo + ' se han generado ' + resumen.alertas_total + ' alertas de desercion, de las cuales ' + resumen.alertas_pendientes + ' se encuentran pendientes de atencion y ' + resumen.alertas_atendidas + ' han sido atendidas, lo que representa una tasa de atencion del ' + tasaAtencion + '%.');

    if (criticos > 0) {
      lista.push('RIESGO CRITICO: Se identificaron ' + criticos + ' casos clasificados como riesgo critico, los cuales requieren intervencion institucional inmediata. Estos alumnos presentan una probabilidad de desercion superior al 75% segun el modelo predictivo basado en promedio general, creditos acumulados, estatus academico y alertas previas. Se recomienda activar el protocolo de acompanamiento intensivo y canalizar a los estudiantes al departamento de tutoria academica dentro de las proximas 24 a 48 horas.');
    }

    if (alto > 0) {
      lista.push('RIESGO ALTO: Un total de ' + alto + ' alumnos se encuentran en nivel de riesgo alto (puntaje entre 50 y 74 puntos). Se recomienda priorizar su canalizacion a tutoria academica dentro de las proximas 48 horas habiles, con un plan de acompanamiento personalizado que incluya evaluacion de factores socioeconomicos y academicos.');
    }

    lista.push('ATENCION INSTITUCIONAL: La tasa de atencion institucional es del ' + tasaAtencion + '%. ' + (tasaAtencion >= 50 ? 'Este indicador refleja un nivel adecuado de seguimiento de casos. Se sugiere mantener la capacidad de respuesta actual y fortalecer las acciones preventivas.' : 'Este indicador senala que mas de la mitad de las alertas generadas no han sido atendidas aun. Se recomienda reforzar la capacidad de respuesta del equipo de seguimiento academico y establecer metas mensuales de atencion.'));

    if (materiasCriticas.length > 0) {
      const materiasStr = materiasCriticas.map(function(m) { return m.materia + ' (promedio ' + m.promedio + ', ' + m.reprobados + ' reprobados)'; }).join('; ');
      lista.push('MATERIAS CRITICAS: Las materias con mayor incidencia en el riesgo de desercion son: ' + materiasStr + '. Estas asignaturas concentran la mayor cantidad de reprobaciones y representan un factor critico en la prediccion de abandono escolar. Se recomienda reforzar los programas de tutoria academica y establecer sesiones de regularizacion intensiva en estas materias.');
    }

    if (porCarrera.length > 0) {
      const maxC = porCarrera[0];
      lista.push('ANALISIS POR CARRERA: La carrera de ' + maxC.carrera + ' concentra la mayor cantidad de alertas (' + maxC.total_alertas + '), de las cuales ' + maxC.alto_riesgo + ' corresponden a niveles Alto o Critico. Se recomienda realizar un analisis cualitativo particular de esta poblacion para identificar factores institucionales, pedagogicos o socioeconomicos que puedan estar contribuyendo al riesgo de desercion.');
    }

    if (parciales.length >= 2) {
      const primero = parciales[0];
      const ultimo = parciales[parciales.length - 1];
      lista.push('TENDENCIA POR PARCIALES: En ' + primero.parcial + ' se registro un promedio general de ' + primero.promedio_general + ' con una tasa de desercion del ' + primero.tasa_desercion + '%. Para ' + ultimo.parcial + ', el promedio fue de ' + ultimo.promedio_general + ' con una tasa de desercion del ' + ultimo.tasa_desercion + '%. La tendencia general es de ' + (tendenciaParciales === 'declive' ? 'declive academico, lo que sugiere un aumento progresivo del riesgo a medida que avanza el ciclo escolar. Se recomienda implementar intervenciones tempranas desde el primer parcial y reforzar el acompanamiento en los periodos intermedios.' : 'mejora progresiva, lo que indica que las intervenciones tempranas estan teniendo un efecto positivo en la retencion escolar. Se sugiere mantener y fortalecer las estrategias actuales.'));
    }

    if (progresion.length > 2) {
      const first = progresion[0];
      const last = progresion[progresion.length - 1];
      const trend = toNum(last.total) > toNum(first.total) ? 'incremento' : 'disminucion';
      lista.push('PROGRESION TEMPORAL: La evolucion mensual de alertas muestra un ' + trend + ' en la generacion de alertas: de ' + first.total + ' (' + first.mes + ') a ' + last.total + ' (' + last.mes + ') casos reportados. Esta tendencia permite evaluar el impacto de las intervenciones implementadas y ajustar la estrategia institucional de retencion de manera oportuna.');
    }

    if (ciclos.length >= 2) {
      const primero = ciclos[0];
      const ultimo = ciclos[ciclos.length - 1];
      lista.push('COMPARATIVA ENTRE CICLOS: ' + primero.ciclo + ' reporto ' + primero.alertas + ' alertas con una tasa de desercion del ' + primero.tasa_desercion + '%, mientras que ' + ultimo.ciclo + ' reporto ' + ultimo.alertas + ' alertas con una tasa del ' + ultimo.tasa_desercion + '%. ' + (toNum(ultimo.alertas) < toNum(primero.alertas) ? 'Se observa una disminucion de alertas entre ciclos, lo que podria indicar una mejora en las condiciones institucionales y la efectividad de las estrategias de retencion implementadas.' : 'El incremento de alertas entre ciclos sugiere la necesidad de reforzar las estrategias de prevencion y realizar un analisis profundo de los factores institucionales que pudieran estar incidiendo en el aumento del riesgo de desercion.'));
    }

    return lista;
  }
}

module.exports = new DesercionService();
