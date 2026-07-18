'use strict';

const pool = require('../config/db');

async function getIncidenciasAbiertas() {
  const [rows] = await pool.execute(
    "SELECT COUNT(*) AS total FROM chatbot_incidencias WHERE estado IN ('ABIERTA','EN_REVISION')"
  );
  return rows[0]?.total || 0;
}

async function getSesionesActivas() {
  const [rows] = await pool.execute(
    "SELECT COUNT(*) AS total FROM asistente_sesiones WHERE estado = 'ACTIVA'"
  );
  return rows[0]?.total || 0;
}

async function getPasswordResetsPendientes() {
  const [rows] = await pool.execute(
    'SELECT COUNT(*) AS total FROM password_resets WHERE used = 0 AND expires_at > NOW()'
  );
  return rows[0]?.total || 0;
}

async function getBitacoraReciente(limite = 10) {
  const [rows] = await pool.execute(
    `SELECT b.*, u.nombres, u.apellido_paterno, u.apellido_materno
     FROM bitacora_auditoria b
     LEFT JOIN usuarios u ON b.id_usuario = u.id_usuario
     ORDER BY b.creado_en DESC LIMIT ?`,
    [limite]
  );
  return rows;
}

async function getSesionesDetalle(limite = 20) {
  const [rows] = await pool.execute(
    `SELECT s.*, u.nombres, u.apellido_paterno, u.apellido_materno, u.correo_institucional
     FROM asistente_sesiones s
     JOIN usuarios u ON s.id_usuario = u.id_usuario
     ORDER BY s.actualizado_en DESC LIMIT ?`,
    [limite]
  );
  return rows;
}

async function getErroresBackendRecientes(limite = 10) {
  const [rows] = await pool.execute(
    `SELECT modulo, accion, COUNT(*) AS total, MAX(creado_en) AS ultimo
     FROM bitacora_auditoria
     WHERE accion LIKE '%error%' OR accion LIKE '%fallo%' OR accion LIKE '%fail%'
     GROUP BY modulo, accion
     ORDER BY ultimo DESC LIMIT ?`,
    [limite]
  );
  return rows;
}

function nombreCompleto(row) {
  const parts = [row.apellido_paterno || '', row.apellido_materno || '', row.nombres || ''];
  return parts.filter(Boolean).join(' ').trim();
}

async function detectarTipoConsulta(texto) {
  const t = String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  // Fallas tecnicas / diagnosticos
  if ((t.includes('falla') || t.includes('fallo') || t.includes('error') || t.includes('problema') || t.includes('diagnostico') || t.includes('diagnosticar')) && (t.includes('sistema') || t.includes('tecnico') || t.includes('backend') || t.includes('servidor') || t.includes('login') || t.includes('acceso') || t.includes('modulo'))) {
    return { tipo: 'DIAGNOSTICO_FALLAS' };
  }

  // Incidencias del sistema
  if (t.includes('incidencia') || (t.includes('reporte') && t.includes('tecnico'))) {
    if (t.includes('abierta') || t.includes('pendiente') || t.includes('cuantas')) return { tipo: 'INCIDENCIAS_RESUMEN' };
    return { tipo: 'INCIDENCIAS_GENERAL' };
  }

  // Sesiones de usuarios
  if (t.includes('sesion') || t.includes('sesiones')) {
    if (t.includes('activa') || t.includes('cuantas') || t.includes('cuantos')) return { tipo: 'SESIONES_ACTIVAS' };
    if (t.includes('detalle') || t.includes('quien') || t.includes('lista') || t.includes('cuales')) return { tipo: 'SESIONES_DETALLE' };
    return { tipo: 'SESIONES_GENERAL' };
  }

  // Recuperacion de acceso / password
  if ((t.includes('recuper') || t.includes('olvido') || t.includes('password') || t.includes('contrasena') || t.includes('acceso')) && (t.includes('recuper') || t.includes('reset') || t.includes('restablecer') || t.includes('cambiar') || t.includes('solicitud'))) {
    return { tipo: 'RECUPERACION_ACCESO' };
  }

  // Bitacora de actividad
  if (t.includes('bitacora') || t.includes('actividad') || t.includes('historial')) {
    return { tipo: 'BITACORA' };
  }

  // Errores en el backend
  if ((t.includes('error') || t.includes('excepcion') || t.includes('exception')) && (t.includes('backend') || t.includes('servidor') || t.includes('api') || t.includes('500') || t.includes('400') || t.includes('reciente'))) {
    return { tipo: 'ERRORES_BACKEND' };
  }

  // Validacion de rutas
  if ((t.includes('ruta') || t.includes('rout') || t.includes('navegacion') || t.includes('pagina') || t.includes('validar')) && (t.includes('no funciona') || t.includes('error') || t.includes('falla') || t.includes('blanco') || t.includes('404') || t.includes('carga') || t.includes('dashboard') || t.includes('modulo'))) {
    return { tipo: 'VALIDACION_RUTAS' };
  }

  // Ayuda general de soporte
  if (t.includes('ayuda') || t.includes('soporte') || t.includes('ayudar') || t.includes('tutorial') || t.includes('como')) {
    return { tipo: 'AYUDA_SOPORTE' };
  }

  return { tipo: 'GENERAL' };
}

async function ejecutarConsulta(tipoConsulta, params) {
  switch (tipoConsulta.tipo) {
    case 'DIAGNOSTICO_FALLAS': {
      const incidencias = await getIncidenciasAbiertas();
      const sesiones = await getSesionesActivas();
      const errores = await getErroresBackendRecientes(5);
      let respuesta = `DIAGNOSTICO DEL SISTEMA:\n\n- Incidencias abiertas: ${incidencias}\n- Sesiones activas de usuarios: ${sesiones}\n`;
      if (errores.length > 0) {
        respuesta += '\nErrores recientes en el sistema:\n';
        errores.forEach(e => {
          respuesta += `  [${e.modulo}] ${e.accion} - ${e.total} ocurrencia(s) - Ultimo: ${new Date(e.ultimo).toLocaleString('es-MX')}\n`;
        });
      } else {
        respuesta += '\nNo se detectaron errores recientes en el bitacora del sistema.\n';
      }
      respuesta += '\n* Diagnostico registrado en la bitacora de soporte. Si persisten las fallas, revise la seccion de incidencias.';
      return { respuesta, count: incidencias, tipo: 'DIAGNOSTICO_FALLAS' };
    }

    case 'INCIDENCIAS_RESUMEN': {
      const total = await getIncidenciasAbiertas();
      return {
        respuesta: total === 0
          ? 'No hay incidencias abiertas en este momento. El sistema se encuentra estable.'
          : `Actualmente hay ${total} incidencia(s) abierta(s) o en revision. Revise la seccion de incidencias para ver el detalle completo y darles seguimiento.\n\n* Informacion registrada en la bitacora de soporte.`,
        count: total,
        tipo: 'INCIDENCIAS_RESUMEN'
      };
    }

    case 'INCIDENCIAS_GENERAL': {
      return {
        respuesta: 'Puedo ayudarle con las incidencias del sistema. Puede consultar: resumen de incidencias abiertas, detalle por estado o prioridad, o revisar el historial completo en la seccion de Incidencias del panel.\n\n* Informacion registrada.',
        count: 0,
        tipo: 'INCIDENCIAS_GENERAL'
      };
    }

    case 'SESIONES_ACTIVAS': {
      const total = await getSesionesActivas();
      return {
        respuesta: total === 0
          ? 'No hay sesiones activas de usuarios en este momento.'
          : `Actualmente hay ${total} sesion(es) activa(s) de usuarios en el sistema.\n\n* Informacion registrada en la bitacora de soporte.`,
        count: total,
        tipo: 'SESIONES_ACTIVAS'
      };
    }

    case 'SESIONES_DETALLE': {
      const rows = await getSesionesDetalle(15);
      if (rows.length === 0) {
        return { respuesta: 'No hay sesiones activas registradas.', count: 0, tipo: 'SESIONES_DETALLE' };
      }
      const detalles = rows.map(r =>
        `  - ${nombreCompleto(r)} (${r.correo_institucional}) - Rol: ${r.rol_usuario} - ${r.estado} - Ultima actividad: ${new Date(r.actualizado_en).toLocaleString('es-MX')}`
      ).join('\n');
      return {
        respuesta: `Sesiones de usuarios en el sistema:\n${detalles}\n\n* Informacion registrada en la bitacora de soporte.`,
        count: rows.length,
        tipo: 'SESIONES_DETALLE'
      };
    }

    case 'SESIONES_GENERAL': {
      const total = await getSesionesActivas();
      return {
        respuesta: `Puedo ayudarle con las sesiones de usuarios. Actualmente hay ${total} sesion(es) activa(s). Puedo mostrarle el detalle completo si lo solicita.\n\n* Informacion registrada.`,
        count: total,
        tipo: 'SESIONES_GENERAL'
      };
    }

    case 'RECUPERACION_ACCESO': {
      const resets = await getPasswordResetsPendientes();
      return {
        respuesta: `Solicitudes de recuperacion de acceso:\n\n- Solicitudes de restablecimiento de contrasena pendientes: ${resets}\n\nPROCEDIMIENTO PARA RECUPERACION DE ACCESO:\n1. El usuario debe solicitar el restablecimiento desde la pagina de login.\n2. Se envia un enlace de recuperacion al correo institucional registrado.\n3. El enlace expira en 24 horas.\n4. Si el usuario no recibe el correo, verifique que el correo institucional este registrado correctamente.\n5. Para restablecimiento manual, acuda al panel de administracion de usuarios.\n\n* Informacion registrada en la bitacora de soporte.`,
        count: resets,
        tipo: 'RECUPERACION_ACCESO'
      };
    }

    case 'BITACORA': {
      const rows = await getBitacoraReciente(10);
      if (rows.length === 0) {
        return { respuesta: 'No hay registros en la bitacora de actividad.', count: 0, tipo: 'BITACORA' };
      }
      const detalles = rows.map(r =>
        `  [${new Date(r.creado_en).toLocaleString('es-MX')}] ${r.modulo} - ${r.accion}${r.id_usuario ? ' (Usuario: ' + nombreCompleto(r) + ')' : ''}`
      ).join('\n');
      return {
        respuesta: `Ultimos registros de la bitacora de actividad:\n${detalles}\n\n* Informacion registrada. Para ver la bitacora completa, use la seccion de Bitacora del panel.`,
        count: rows.length,
        tipo: 'BITACORA'
      };
    }

    case 'ERRORES_BACKEND': {
      const rows = await getErroresBackendRecientes(10);
      if (rows.length === 0) {
        return { respuesta: 'No se encontraron errores de backend recientes en la bitacora del sistema.', count: 0, tipo: 'ERRORES_BACKEND' };
      }
      const detalles = rows.map(r =>
        `  Modulo: ${r.modulo}\n    Accion: ${r.accion}\n    Ocurrencias: ${r.total}\n    Ultima vez: ${new Date(r.ultimo).toLocaleString('es-MX')}`
      ).join('\n\n');
      return {
        respuesta: `Errores de backend detectados:\n\n${detalles}\n\n* Se recomienda revisar los logs del servidor y la seccion de incidencias para dar seguimiento. Informacion registrada.`,
        count: rows.length,
        tipo: 'ERRORES_BACKEND'
      };
    }

    case 'VALIDACION_RUTAS': {
      return {
        respuesta: `VALIDACION DE RUTAS Y NAVEGACION:\n\nSi una pagina no carga correctamente, siga estos pasos:\n1. Verifique que la URL sea correcta.\n2. Compruebe que tenga una sesion activa (token valido).\n3. Revise la consola del navegador (F12 > Console) para ver errores de JavaScript.\n4. Verifique la pestana Network para errores HTTP (404, 500, 401).\n5. Limpie la cache del navegador e intente de nuevo.\n\nRutas comunes del sistema:\n- Login: /login\n- Dashboard: /app/dashboard\n- Alumno: /app/alumno/*\n- Docente: /app/docente/*\n- Coordinador: /app/coordinador/*\n- ChatBot: /app/chatbot\n\nSi el problema persiste, reporte una incidencia con los detalles del error.\n\n* Informacion registrada.`,
        count: 0,
        tipo: 'VALIDACION_RUTAS'
      };
    }

    case 'AYUDA_SOPORTE': {
      return {
        respuesta: `SOPORTE TECNICO SIVACAD:\n\nPuedo ayudarle con las siguientes areas:\n- Diagnosticar fallas tecnicas del sistema\n- Revisar y atender incidencias\n- Validar sesiones de usuarios activos\n- Orientar recuperacion de acceso y contrasenas\n- Consultar la bitacora de actividad\n- Validar rutas y problemas de navegacion\n- Identificar errores del backend\n\n¿Que necesita consultar? Solo pregunteme directamente.\n\n* Informacion registrada.`,
        count: 0,
        tipo: 'AYUDA_SOPORTE'
      };
    }

    default:
      return null;
  }
}

async function logQuery(idSoporte, pregunta, respuesta, tipoConsulta) {
  if (!idSoporte) return;
  try {
    await pool.execute(
      `INSERT INTO docente_query_log (id_docente, pregunta, respuesta, tipo_consulta) VALUES (?, ?, ?, ?)`,
      [idSoporte, pregunta.substring(0, 500), (respuesta || '').substring(0, 2000), tipoConsulta]
    );
  } catch (err) {
    console.error('Error logging soporte query:', err.message);
  }
}

module.exports = {
  detectarTipoConsulta,
  ejecutarConsulta,
  logQuery
};
