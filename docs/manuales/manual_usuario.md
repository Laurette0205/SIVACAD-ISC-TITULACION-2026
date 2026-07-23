# Manual de Usuario — SIVACAD

**Sistema de Valoración y Calificación del Desempeño de Docentes y Alumnos**

**Autoras:** Bárcenas González Laura Casandra & Morales Ibarra Sandivel  
**Institución:** TESI Ixtapaluca — Ingeniería en Sistemas Computacionales  
**Versión:** 1.0 — Julio 2026

---

## Índice

1. [Introducción](#1-introducción)
2. [Acceso al Sistema](#2-acceso-al-sistema)
3. [Inicio de Sesión](#3-inicio-de-sesión)
4. [Navegación General](#4-navegación-general)
5. [Panel del Administrador](#5-panel-del-administrador)
6. [Panel del Coordinador](#6-panel-del-coordinador)
7. [Panel del Docente](#7-panel-del-docente)
8. [Panel del Alumno](#8-panel-del-alumno)
9. [Panel de Soporte](#9-panel-de-soporte)
10. [Exportación de Reportes](#10-exportación-de-reportes)
11. [Cierre de Sesión](#11-cierre-de-sesión)

---

## 1. Introducción

El Sistema de Valoración y Calificación del Desempeño de Docentes y Alumnos (SIVACAD) es una plataforma web integral diseñada para la gestión académica del TESI Ixtapaluca. Permite administrar inscripciones, reinscripciones, evaluaciones, kardex, trámites escolares, detección de deserción, bienestar estudiantil, consulta de becas y generación de reportes institucionales.

Este manual describe el uso del sistema para cada uno de los cinco roles que interactúan en la plataforma.

---

## 2. Acceso al Sistema

### 2.1 Requisitos técnicos

- Navegador web moderno: Chrome 90+, Firefox 88+, Edge 90+, Safari 14+
- Conexión a internet o red local institucional
- Resolución mínima: 720 × 1024 píxeles (responsive hasta 320 px)

### 2.2 Dirección de acceso

```
Entorno desarrollo: http://localhost:5173
Entorno producción: https://sivacad.tesi.edu.mx (ejemplo)
```

---

## 3. Inicio de Sesión

### 3.1 Pantalla de login

1. Abra la URL del sistema en su navegador.
2. Ingrese su **correo institucional** (dominio `@tesi.edu.mx` o `@ixtapaluca.tecnm.mx`).
3. Ingrese su **contraseña**.
4. Haga clic en **Iniciar Sesión**.

### 3.2 Recuperación de contraseña

1. En la pantalla de login, haga clic en **¿Olvidaste tu contraseña?**
2. Ingrese su correo institucional.
3. Recibirá un enlace de restablecimiento en su bandeja de entrada.
4. Siga el enlace y establezca una nueva contraseña (mínimo 8 caracteres).

### 3.3 Registro de nuevo usuario

1. En la pantalla de login, haga clic en **Registrarse**.
2. Complete el formulario con: nombres, apellidos, correo institucional, contraseña y seleccione su rol.
3. Si es alumno, proporcione matrícula, CURP y carrera.
4. Si es docente, proporcione número de empleado y especialidad.
5. Acepte los términos y condiciones.
6. Haga clic en **Registrar**.

---

## 4. Navegación General

### 4.1 Estructura de la interfaz

- **Barra superior:** Muestra el nombre del sistema, el rol del usuario activo y el botón de menú (en móvil) o cierre de sesión.
- **Barra lateral (sidebar):** Menú de navegación con los módulos disponibles según el rol. En dispositivos móviles se oculta detrás de un botón de hamburguesa.
- **Área principal:** Contenido del módulo seleccionado.
- **Modo oscuro:** Dispone de un selector de tema (claro/oscuro) en la barra superior.

### 4.2 Navegación en dispositivos móviles

- Pulse el ícono de hamburguesa (☰) en la esquina superior izquierda para abrir el menú lateral.
- Pulse fuera del menú o seleccione una opción para cerrarlo.
- Las tablas se desplazan horizontalmente con el dedo.

---

## 5. Panel del Administrador

El Administrador tiene acceso completo a todos los módulos del sistema.

### 5.1 Dashboard

- Visualiza tarjetas de resumen: total de alumnos, docentes, periodos activos, inscripciones del periodo, trámites pendientes, alertas de deserción activas y check-ins de bienestar recientes.
- Acceso rápido a los módulos más utilizados.

### 5.2 Gestión de Usuarios

1. Navegue a **Usuarios** en el menú lateral.
2. Visualice el listado completo de usuarios del sistema.
3. Use los botones **Editar** para modificar datos o **Eliminar** para desactivar cuentas.
4. Haga clic en **+ Nuevo Usuario** para registrar manualmente.

### 5.3 Alumnos

1. Navegue a **Alumnos**.
2. Consulte, registre, edite o elimine alumnos.
3. Use los filtros de búsqueda por matrícula, nombre o carrera.

### 5.4 Docentes

1. Navegue a **Docentes**.
2. Gestione el listado de docentes: alta, modificación y baja.

### 5.5 Periodos Académicos

1. Navegue a **Periodos**.
2. Cree nuevos periodos (clave, nombre, fecha inicio, fecha fin, estado).
3. Active o cierre periodos según el calendario institucional.

### 5.6 Grupos

1. Navegue a **Grupos**.
2. Asigne materia, docente, periodo, carrera y semestre.
3. Edite o elimine grupos existentes.

### 5.7 Inscripciones y Reinscripciones

1. Navegue a **Inscripciones**.
2. Visualice todas las inscripciones con filtros por periodo y estado.
3. Cree inscripciones manuales o valide solicitudes de alumnos.
4. Gestione reinscripciones desde la misma sección.

### 5.8 Kardex

1. Navegue a **Kardex**.
2. Consulte el historial académico de cualquier alumno.
3. Suba fotografías, genere códigos QR individuales o por grupo.
4. Descargue PDF o Excel del kardex.

### 5.9 Evaluaciones

1. Navegue a **Evaluaciones**.
2. Cree plantillas de evaluación con preguntas y pesos.
3. Cree evaluaciones (Formativa, Sumativa, Objetivos, Ipsativa, Alumno-Docente).
4. Cambie el estado: BORRADOR → ACTIVA → CERRADA → CANCELADA.
5. Consulte resultados y promedios.

### 5.10 Actas OCR

1. Navegue a **Actas OCR**.
2. Suba un acta de calificaciones escaneada (PDF, JPG, PNG).
3. El sistema procesa el documento con Gemini API.
4. Revise la vista previa de datos extraídos.
5. Valide la carga para importar calificaciones automáticamente.

### 5.11 Trámites Escolares

1. Navegue a **Trámites**.
2. Revise las solicitudes de baja, cambio de escuela, cambio de carrera.
3. Emita dictamen de aprobación o rechazo.

### 5.12 IA Deserción

1. Navegue a **IA Deserción**.
2. Cree alertas de deserción para alumnos en riesgo.
3. Ejecute predicción heurística o vía Flask ML.
4. Cree y dé seguimiento a planes de acción.

### 5.13 IA Bienestar (Supervisión)

1. Navegue a **Bienestar Admin**.
2. Consulte: resumen ejecutivo, indicadores de riesgo, catálogo de alertas, historial de seguimientos y auditoría.
3. Exporte datos a TXT o CSV.

### 5.14 IA Becas

1. Navegue a **IA Becas**.
2. Consulte el catálogo de 14 becas oficiales.
3. Realice preguntas sobre becas al asistente.
4. Verifique elegibilidad de alumnos.

### 5.15 Reportes

1. Navegue a **Reportes**.
2. Seleccione **Generar PDF** o **Generar Excel**.
3. Espere la generación y descargue el archivo.

### 5.16 Auditoría

1. Navegue a **Auditoría**.
2. Consulte la bitácora de operaciones con hash SHA-256.
3. Filtre por usuario, acción o fecha.

---

## 6. Panel del Coordinador

El Coordinador tiene acceso a la gestión académica completa, similar al Administrador, pero sin acceso a la gestión de usuarios del sistema ni a la auditoría global.

### Módulos disponibles

- Dashboard
- Alumnos, Docentes, Periodos, Grupos
- Inscripciones y Reinscripciones
- Kardex (consulta, fotos, QR, descargas)
- Evaluaciones (crear, activar, cerrar, ver resultados)
- Trámites (analizar procedencia, emitir observaciones)
- Actas OCR (subir y validar)
- IA Deserción (alertas, predicciones, seguimientos)
- IA Bienestar Admin (supervisión)
- IA Becas
- Asistente Académico y Chatbot
- Reportes PDF/Excel

---

## 7. Panel del Docente

### 7.1 Dashboard

- Visualiza resumen de sus grupos, evaluaciones activas y alertas de deserción de sus alumnos.

### 7.2 Inscripciones

- Consulta alumnos inscritos en sus grupos.
- No puede crear ni modificar inscripciones.

### 7.3 Kardex

- Consulta el kardex de alumnos de sus grupos.
- Descarga PDF/Excel.

### 7.4 Evaluaciones

1. Consulte evaluaciones activas asignadas a sus grupos.
2. Responda evaluaciones (si es alumno-docente).
3. Consulte resultados de evaluaciones aplicadas.

### 7.5 Trámites

- Emite opinión sobre trámites de alumnos (baja, cambio de escuela, cambio de carrera).

### 7.6 IA Deserción Docente

- Visualiza alertas de deserción de alumnos en sus grupos.

### 7.7 IA Bienestar

- Consulta indicadores de bienestar de sus alumnos (solo lectura).

### 7.8 IA Becas

- Consulta el catálogo de becas.

### 7.9 Asistente Académico y Chatbot

- Realiza consultas académicas generales.

### 7.10 Reportes

- Genera reportes PDF y Excel.

---

## 8. Panel del Alumno

### 8.1 Dashboard

- Visualiza su resumen académico: promedio general, créditos acumulados, inscripciones activas y check-in de bienestar del día.

### 8.2 Inscripciones

1. Navegue a **Inscripciones**.
2. Visualice sus inscripciones activas e históricas.
3. Realice solicitud de reinscripción a nuevo periodo.

### 8.3 Kardex

1. Navegue a **Kardex**.
2. Consulte su historial académico completo.
3. Descargue su kardex en PDF o Excel.
4. Visualice su código QR y fotografía.

### 8.4 Evaluaciones

1. Navegue a **Evaluaciones**.
2. Consulte evaluaciones activas pendientes de responder.
3. Responda evaluaciones.
4. Consulte sus resultados.

### 8.5 Trámites

1. Navegue a **Trámites**.
2. Solicite: baja de carrera, cambio de escuela o cambio de carrera.
3. Dé seguimiento al estado de sus solicitudes.

### 8.6 IA Bienestar (Estudiante)

1. Navegue a **Bienestar**.
2. Realice su **check-in emocional diario**: seleccione su estado en 9 dimensiones (ánimo, energía, sueño, estrés, apoyo, ambiente, carga académica, carga laboral, enfoque).
3. Chatee con el asistente de bienestar impulsado por Gemini.
4. Si necesita ayuda inmediata, use la opción **Escalar** para solicitar derivación a recursos de apoyo.

### 8.7 IA Deserción

1. Navegue a **IA Deserción**.
2. Consulte su nivel de riesgo de deserción.
3. Revise recomendaciones personalizadas.

### 8.8 IA Becas

1. Navegue a **Becas**.
2. Consulte el catálogo de becas disponibles.
3. Realice preguntas sobre becas.
4. Verifique su elegibilidad.

### 8.9 Asistente Académico y Chatbot

- Realice consultas sobre su situación académica, becas, estadísticas del sistema o dudas generales.

### 8.10 Reportes

- Genere reportes PDF y Excel.

---

## 9. Panel de Soporte

### 9.1 Dashboard

- Visualiza resumen de incidencias, logs recientes y estado de conectividad.

### 9.2 Módulos de consulta

- Acceso de solo lectura a: Alumnos, Docentes, Periodos, Grupos, Inscripciones, Kardex, Evaluaciones, Actas OCR, Trámites.

### 9.3 IA Deserción Soporte

- Consulte logs de errores, registros de conectividad con Flask ML y reportes de incidencias del módulo de deserción.

### 9.4 IA Bienestar

- Consulta indicadores de bienestar (solo lectura).

### 9.5 IA Becas

- Consulta el catálogo de becas.

### 9.6 Asistente Académico y Chatbot

-Realice consultas de soporte técnico.

### 9.7 Reportes

- Genere reportes PDF y Excel.

### 9.8 Auditoría

- Consulte la bitácora de operaciones (solo lectura) y sesiones activas.

---

## 10. Exportación de Reportes

### 10.1 Reporte PDF

1. En el módulo **Reportes** o en **Kardex**, haga clic en **Generar PDF**.
2. Espere la generación del documento (2-5 segundos).
3. El PDF se descargará automáticamente con el formato institucional (encabezado TESI, métricas, gráficos).

### 10.2 Reporte Excel

1. Haga clic en **Generar Excel**.
2. El archivo XLSX se descargará con múltiples hojas (portada, resumen, detalle).

### 10.3 Exportación de datos (Bienestar Admin)

1. En el panel de Bienestar Admin, use los botones **Exportar TXT** o **Exportar CSV** para descargar los datos visibles.

---

## 11. Cierre de Sesión

1. Haga clic en su nombre o avatar en la esquina superior derecha.
2. Seleccione **Cerrar Sesión**.
3. Será redirigido a la pantalla de login.
4. Para seguridad, cierre también el navegador si usa un equipo compartido.

---

*Fin del Manual de Usuario — SIVACAD v1.0*
