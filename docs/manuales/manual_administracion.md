# Manual de Administración — SIVACAD

**Sistema de Valoración y Calificación del Desempeño de Docentes y Alumnos**

**Autoras:** Bárcenas González Laura Casandra & Morales Ibarra Sandivel  
**Institución:** TESI Ixtapaluca — Ingeniería en Sistemas Computacionales  
**Versión:** 1.0 — Julio 2026

---

## Índice

1. [Introducción](#1-introducción)
2. [Gestión de Usuarios](#2-gestión-de-usuarios)
3. [Roles y Permisos](#3-roles-y-permisos)
4. [Gestión de Módulos](#4-gestión-de-módulos)
5. [Gestión de Periodos Académicos](#5-gestión-de-periodos-académicos)
6. [Reportes Institucionales](#6-reportes-institucionales)
7. [Auditoría y Bitácora](#7-auditoría-y-bitácora)
8. [Sesiones Activas](#8-sesiones-activas)
9. [Parámetros del Sistema](#9-parámetros-del-sistema)
10. [Supervisión General](#10-supervisión-general)
11. [Buenas Prácticas](#11-buenas-prácticas)

---

## 1. Introducción

Este manual está dirigido al **Administrador del sistema SIVACAD**. Describe las tareas de gestión general de la plataforma: administración de usuarios, asignación de roles, configuración de módulos, generación de reportes institucionales, supervisión de auditoría y monitoreo del sistema.

El administrador tiene el nivel más alto de privilegios en el sistema y es responsable de garantizar su correcto funcionamiento, seguridad y disponibilidad.

---

## 2. Gestión de Usuarios

### 2.1 Acceso al módulo

1. Inicie sesión con una cuenta con rol **Administrador**.
2. En el menú lateral, seleccione **Usuarios**.

### 2.2 Listado de usuarios

- Visualiza una tabla con todos los usuarios registrados: nombre, correo, rol, estado (Activo/Inactivo), fecha de registro.
- Use los campos de búsqueda para filtrar por nombre, correo o rol.

### 2.3 Crear un nuevo usuario

1. Haga clic en **+ Nuevo Usuario**.
2. Complete los campos obligatorios:
   - Nombres y apellidos
   - Correo institucional (debe ser @tesi.edu.mx o @ixtapaluca.tecnm.mx)
   - Contraseña (mínimo 8 caracteres)
   - Rol (Administrador, Coordinador, Docente, Alumno, Soporte)
   - Datos adicionales según el rol (matrícula, número de empleado, carrera)
3. Haga clic en **Guardar**.
4. El sistema enviará un correo de confirmación al nuevo usuario (opcional).

### 2.4 Editar un usuario

1. Localice al usuario en el listado.
2. Haga clic en el ícono **Editar** (lápiz).
3. Modifique los campos necesarios.
4. Haga clic en **Guardar cambios**.

### 2.5 Desactivar / Activar un usuario

1. Localice al usuario en el listado.
2. Haga clic en el ícono de **estado** (toggle Activo/Inactivo).
3. Confirme la operación.

> **Nota:** Un usuario inactivo no puede iniciar sesión. Sus datos históricos se conservan.

### 2.6 Eliminar un usuario

1. Localice al usuario en el listado.
2. Haga clic en el ícono **Eliminar** (papelera).
3. Confirme la eliminación.

> **Advertencia:** Esta operación es irreversible. Considere desactivar en lugar de eliminar.

---

## 3. Roles y Permisos

### 3.1 Roles del sistema

SIVACAD implementa **RBAC (Role-Based Access Control)** con 5 roles:

| Rol           | Nivel de acceso | Módulos disponibles                          |
|---------------|-----------------|----------------------------------------------|
| Administrador | Total           | Todos los módulos (crear, leer, actualizar, eliminar) |
| Coordinador   | Alto            | Gestión académica completa, sin usuarios ni auditoría global |
| Docente       | Medio           | Sus grupos, evaluaciones, trámites (opinar)  |
| Alumno        | Bajo            | Autogestión: inscripciones, kardex, trámites, bienestar |
| Soporte       | Consulta+       | Lectura de la mayoría de módulos, logs, conectividad |

### 3.2 Matriz de permisos (resumen)

| Módulo                | Admin | Coord | Docente | Alumno | Soporte |
|-----------------------|-------|-------|---------|--------|---------|
| Dashboard             | CRUD  | CRUD  | CRUD    | CRUD   | CRUD    |
| Usuarios              | CRUD  | —     | —       | —      | —       |
| Alumnos               | CRUD  | CRUD  | R       | R      | R       |
| Docentes              | CRUD  | CRUD  | R       | —      | R       |
| Periodos              | CRUD  | CRUD  | R       | R      | R       |
| Grupos                | CRUD  | CRUD  | R       | R      | R       |
| Inscripciones         | CRUD  | CRUD  | R       | CR     | R       |
| Kardex                | CRUD  | CRUD  | R       | R      | R       |
| Evaluaciones (crear)  | CRUD  | CRUD  | —       | —      | —       |
| Evaluaciones (responder)| —   | —     | CRUD    | CRUD   | —       |
| Trámites (gestionar)  | CRUD  | CRUD  | R       | CR     | R       |
| Actas OCR             | CRUD  | CRUD  | R       | R      | R       |
| IA Deserción          | CRUD  | CRUD  | R       | R      | R       |
| IA Bienestar (admin)  | CRUD  | CRUD  | R       | —      | R       |
| IA Bienestar (alumno) | —     | —     | —       | CRUD   | —       |
| IA Becas              | CRUD  | CRUD  | R       | CR     | R       |
| Asistente/Chatbot     | CRUD  | CRUD  | CRUD    | CRUD   | CRUD    |
| Reportes              | CRUD  | CRUD  | CRUD    | CRUD   | CRUD    |
| Auditoría             | CRUD  | R     | —       | —      | CRUD    |

> **Leyenda:** CRUD = Crear, Leer, Actualizar, Eliminar. R = Solo lectura. — = Sin acceso.

### 3.3 Cambiar el rol de un usuario

1. Vaya a **Usuarios**.
2. Edite el usuario deseado.
3. En el campo **Rol**, seleccione el nuevo rol.
4. Guarde los cambios.

> **Precaución:** Cambiar el rol de un usuario puede afectar su acceso a datos y funcionalidades.

---

## 4. Gestión de Módulos

### 4.1 Habilitar / Deshabilitar módulos

El backend usa un sistema de montaje dinámico (`mountIfAvailable` en `routes/index.js`):

- **Para deshabilitar un módulo:** Elimine o renombre el archivo de ruta correspondiente en `backend/src/routes/`.
- **Para habilitar un módulo:** Asegúrese de que el archivo de ruta exista en `backend/src/routes/`. El sistema lo montará automáticamente al iniciar.

### 4.2 Módulos disponibles

1. **Autenticación:** Login, Register, Forgot/Reset Password.
2. **Dashboard:** Resumen por rol con tarjetas de métricas.
3. **Alumnos:** CRUD de alumnos con filtros.
4. **Docentes:** CRUD de docentes.
5. **Periodos:** Gestión de periodos académicos.
6. **Grupos:** Asignación de materia-docente-grupo.
7. **Inscripciones:** Inscripción y reinscripción de alumnos.
8. **Kardex:** Historial académico, fotos, QR, PDF, Excel.
9. **Evaluaciones:** 5 tipos de instrumento, 4 estados.
10. **Actas OCR:** Subida y validación de actas escaneadas.
11. **Trámites:** Baja, cambio de escuela, cambio de carrera.
12. **IA Deserción:** Predicción y alertas (4 sub-paneles).
13. **IA Bienestar:** Check-in emocional, chat, supervisión.
14. **IA Becas:** Catálogo de 14 becas, elegibilidad.
15. **Asistente Académico:** Clasificador de intenciones + RAG.
16. **Chatbot:** Conversación con Gemini.
17. **Reportes:** PDF (PDFKit/Dompdf) y Excel (ExcelJS).
18. **Auditoría:** Bitácora con hash SHA-256.

---

## 5. Gestión de Periodos Académicos

1. Navegue a **Periodos**.
2. Para **crear** un nuevo periodo:
   - Capture la clave única del periodo (ej. `2026-1`).
   - Nombre descriptivo (ej. `Enero-Junio 2026`).
   - Fecha de inicio y fecha de fin.
   - Estado inicial: **Activo** o **Inactivo**.
3. Para **cerrar** un periodo:
   - Cambie el estado a **Inactivo** o **Finalizado**.
   - Un periodo finalizado no permite nuevas inscripciones.
4. Visualice totales: grupos registrados, inscripciones activas por periodo.

---

## 6. Reportes Institucionales

### 6.1 Reporte PDF

1. Navegue a **Reportes**.
2. Haga clic en **Generar PDF**.
3. El sistema genera un documento con:
   - Encabezado institucional (TESI).
   - Tarjetas de métricas (alumnos, docentes, periodos, grupos).
   - Gráfico de barras comparativo.
   - Fecha de generación.

### 6.2 Reporte Excel

1. Haga clic en **Generar Excel**.
2. El archivo contendrá:
   - **Hoja 1 — Portada:** Título del sistema, fecha, autor.
   - **Hoja 2 — Resumen:** Tarjetas de métricas con colores institucionales.
   - **Hoja 3 — Detalle:** Datos completos del dashboard.

### 6.3 Exportación de datos de Bienestar

1. Navegue a **Bienestar Admin**.
2. Use los botones **Exportar TXT** o **Exportar CSV**.
3. Seleccione el rango de fechas si es necesario.

---

## 7. Auditoría y Bitácora

### 7.1 Bitácora de auditoría

Cada operación importante queda registrada en `bitacora_auditoria` con:

- **id_usuario:** Quién realizó la operación.
- **accion:** Qué se hizo (INSERT, UPDATE, DELETE, LOGIN, etc.).
- **tabla:** En qué tabla.
- **id_registro:** Identificador del registro afectado.
- **valores_anteriores:** Estado previo (para modificaciones).
- **valores_nuevos:** Estado posterior.
- **ip_origen:** Dirección IP desde donde se realizó.
- **fecha_hora:** Marca de tiempo.

### 7.2 Auditoría global con integridad

La tabla `auditoria_global` utiliza un hash SHA-256 encadenado:

- Cada registro contiene un hash del registro anterior (`hash_anterior`).
- Esto garantiza la **integridad y no-repudio** de la cadena de auditoría.
- Si alguien modifica un registro histórico, el hash ya no coincidirá.

### 7.3 Consultar auditoría

1. Navegue a **Auditoría**.
2. Filtre por:
   - **Usuario:** Seleccione un usuario específico.
   - **Acción:** Tipo de operación.
   - **Fecha:** Rango de fechas.
   - **Tabla:** Módulo específico.
3. Los resultados muestran: fecha, usuario, acción, tabla, detalles.

---

## 8. Sesiones Activas

### 8.1 Consultar sesiones activas

1. Navegue a **Auditoría** → pestaña **Sesiones Activas**.
2. Visualiza una tabla con:
   - Usuario y rol.
   - Fecha de inicio de sesión.
   - Última actividad.
   - Dirección IP.
   - Estado (activa/expirada).

### 8.2 Cerrar sesión de un usuario

1. Localice la sesión en el listado.
2. Haga clic en **Cerrar Sesión**.
3. Confirme la operación.
4. El usuario será forzado a salir del sistema en su próximo request.

---

## 9. Parámetros del Sistema

### 9.1 Configuración de correo institucional

Los dominios de correo aceptados se definen en el middleware `validateInstitutionalEmail`:

```javascript
const WHITELIST_DOMAINS = [
  'tesi.edu.mx',
  'ixtapaluca.tecnm.mx'
];
```

### 9.2 Configuración CORS

En `backend/src/app.js` se definen los orígenes permitidos:

```javascript
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  // ... más orígenes
];

const originRegexPatterns = [
  /^https?:\/\/192\.168\..*/,
  /^https?:\/\/10\..*/,
  /^https?:\/\/172\.(1[6-9]|2[0-9]|3[01])\..*/
];
```

### 9.3 Rate limiting

```javascript
// Límite en forgot-password: 5 solicitudes cada 15 minutos
app.use('/api/auth/forgot-password', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { ok: false, message: 'Demasiadas solicitudes. Intente más tarde.' }
}));
```

---

## 10. Supervisión General

### 10.1 Dashboard ejecutivo

El dashboard del administrador muestra:

| Indicador               | Descripción                              |
|-------------------------|------------------------------------------|
| Total de alumnos        | Conteo de alumnos activos                |
| Total de docentes       | Conteo de docentes activos               |
| Periodos activos        | Periodos académicos en curso             |
| Inscripciones activas   | Inscripciones del periodo actual         |
| Trámites pendientes     | Solicitudes de trámite sin resolver      |
| Alertas de deserción    | Alertas activas de riesgo de deserción   |
| Check-ins de bienestar  | Check-ins registrados en las últimas 24h |

### 10.2 Supervisión de Bienestar (Admin)

1. Navegue a **Bienestar Admin**.
2. Pestañas disponibles:
   - **Resumen Ejecutivo:** 7 consultas agregadas (total alumnos en check-in, riesgo promedio, alertas activas, etc.).
   - **Indicadores de Riesgo:** Distribución de niveles de riesgo (bajo, medio, alto, crítico).
   - **Catálogo de Alertas:** Listado de alertas generadas con opciones de seguimiento.
   - **Historial Seguimientos:** Registro de intervenciones realizadas.
   - **Auditoría:** Registro de accesos y modificaciones en el módulo.

### 10.3 Supervisión de Deserción

1. Navegue a **IA Deserción**.
2. Acciones disponibles:
   - Ver alertas activas por alumno.
   - Ejecutar predicción heurística o ML.
   - Crear planes de seguimiento.
   - Consultar historial de alertas resueltas.

---

## 11. Buenas Prácticas

### 11.1 Seguridad

- Cambie la contraseña por defecto del administrador inmediatamente después de la instalación.
- No comparta cuentas de administrador.
- Revise la bitácora de auditoría periódicamente.
- Mantenga actualizadas las dependencias del proyecto.

### 11.2 Gestión de usuarios

- Desactive (no elimine) usuarios que ya no pertenezcan a la institución.
- Asigne el rol **Soporte** solo a personal técnico de confianza.
- Revise periódicamente usuarios inactivos para mantener la BD limpia.

### 11.3 Periodos académicos

- Cree el nuevo periodo antes de que termine el anterior para evitar interrupciones.
- No elimine periodos con datos históricos; márquelos como finalizados.

### 11.4 Respaldo de datos

- Realice respaldos periódicos de la base de datos.
- Guarde los archivos subidos (uploads/) en almacenamiento externo.
- Documente los cambios de configuración en el .env.

### 11.5 Monitoreo

- Revise el dashboard diariamente para detectar anomalías.
- Configure alertas de errores del servidor (logs).
- Supervise el consumo de recursos (RAM, CPU, disco).

---

*Fin del Manual de Administración — SIVACAD v1.0*
