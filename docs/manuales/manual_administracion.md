# Manual de Administración — SIVACAD

**Sistema de Valoración y Calificación del Desempeño de Docentes y Alumnos**

**Autoras:** Bárcenas González Laura Casandra & Morales Ibarra Sandivel  
**Institución:** TESI Ixtapaluca — Ingeniería en Sistemas Computacionales  
**Versión:** 3.0 — Septiembre 2026

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
12. [Autenticación Multi-Factor (MFA)](#12-autenticación-multi-factor-mfa)
13. [Reautenticación para Operaciones Sensibles](#13-reautenticación-para-operaciones-sensibles)

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
   - Contraseña (debe cumplir la política: 12-20 caracteres, mayúscula, minúscula, número, símbolo)
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

### 7.3 Eventos de seguridad

Además de las operaciones CRUD estándar, el sistema registra eventos de seguridad específicos:

| Evento | Módulo | Descripción |
|--------|--------|-------------|
| `MFA_ENABLED` | SEGURIDAD | MFA activado exitosamente por el usuario |
| `MFA_DISABLED` | SEGURIDAD | MFA deshabilitado por el usuario |
| `MFA_ENABLE_FAILED` | SEGURIDAD | Error al intentar activar MFA (código TOTP inválido) |
| `MFA_LOGIN_SUCCESS` | SEGURIDAD | Login completado con verificación MFA exitosa |
| `MFA_LOGIN_FAILED` | SEGURIDAD | Código MFA inválido durante intento de login |
| `REAUTH_SUCCESS` | SEGURIDAD | Reautenticación exitosa (token temporal emitido) |
| `REAUTH_FAILED` | SEGURIDAD | Reautenticación fallida (contraseña incorrecta) |
| `PROFILE_CHANGED` | USUARIOS | Perfil de alumno o docente actualizado por un administrador |
| `NEW_DEVICE_LOGIN` | SEGURADOR | Login desde un dispositivo no registrado previamente |

### 7.4 Almacenamiento seguro de tokens

Los tokens JWT de sesión se almacenan como **hash SHA-256** en la tabla `sesiones_activas` (campo `token_jwt`). Esto garantiza que, incluso si un atacante accede a la base de datos, los tokens sean inutilizables sin el secreto de firma.

### 7.5 Consultar auditoría

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
   - Dispositivo (user-agent).
   - Estado (activa/expirada).

> **Nota de seguridad:** El campo `token_jwt` muestra un hash SHA-256 del token, no el JWT crudo. Esto protege las sesiones en caso de acceso no autorizado a la base de datos.

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
const ALLOWED_INSTITUTION_EMAIL_DOMAINS = [
  'tesi.edu.mx',
  'ixtapaluca.tecnm.mx',
  'ixtapaluca.tecnm.edu.mx',
  'outlook.com',
  'outlook.es'
];
```

### 9.2 Variables de entorno de seguridad

En el archivo `.env` del backend, las variables de seguridad crítica son:

```env
# JWT — Access token secret
JWT_SECRET=secreto_aleatorio_seguro_128bit

# JWT — Refresh token secret (DEBE ser diferente a JWT_SECRET)
JWT_REFRESH_SECRET=otro_secreto_aleatorio_diferente

# JWT — Expiración del access token
JWT_EXPIRES_IN=8h
```

> **Importante:** `JWT_SECRET` y `JWT_REFRESH_SECRET` deben ser valores **distintos**. Si ambos son iguales, un atacante podría usar un token de acceso para generar tokens de refresco válidos.

### 9.3 Configuración CORS

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

### 9.4 Rate limiting

```javascript
// Límite en login: 10 solicitudes cada 15 minutos
router.post('/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }));

// Límite en forgot-password: 5 solicitudes cada 15 minutos
router.post('/forgot-password', rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }));

// Límite en register: 5 solicitudes cada hora
router.post('/register', rateLimit({ windowMs: 60 * 60 * 1000, max: 5 }));
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
- Las contraseñas deben cumplir la política: **12-20 caracteres**, mayúscula, minúscula, número y símbolo.
- **Active MFA (Multi-Factor Authentication)** en la cuenta de administrador. Vaya a Configuración de Seguridad → Activar MFA.
- No comparta cuentas de administrador.
- Revise la bitácora de auditoría periódicamente, especialmente los eventos de seguridad (MFA, reautenticación, dispositivos nuevos).
- Mantenga actualizadas las dependencias del proyecto.
- Verifique que `JWT_SECRET` y `JWT_REFRESH_SECRET` sean valores diferentes en el `.env`.
- Ejecute el script de backup periódicamente: `bash backend/scripts/backup.sh`.

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

## 12. Autenticación Multi-Factor (MFA)

### 12.1 ¿Qué es MFA?

MFA (Multi-Factor Authentication) agrega una segunda capa de seguridad al inicio de sesión. Además de la contraseña, el usuario debe ingresar un código de 6 dígitos generado por una aplicación de autenticación en su teléfono (Google Authenticator, Authy, etc.).

### 12.2 Configurar MFA

1. Inicie sesión en el sistema.
2. Navegue a **Configuración de Seguridad** o solicite al endpoint `POST /api/mfa/setup`.
3. El sistema genera un código QR y una clave secreta.
4. Escanee el código QR con Google Authenticator o Authy.
5. Ingrese el código de 6 dígitos para verificar la configuración.
6. **Guarde los códigos de recuperación** en un lugar seguro (se muestran solo una vez).

### 12.3 Activar MFA

1. Después de configurar, envíe el código TOTP al endpoint `POST /api/mfa/enable`.
2. Si el código es válido, MFA se activa para su cuenta.
3. A partir de ese momento, cada login requerirá el código de 6 dígitos.

### 12.4 Login con MFA

1. Ingrese correo y contraseña normalmente.
2. Si MFA está activado, el sistema retorna `mfaRequired: true`.
3. El frontend muestra un campo para ingresar el código de 6 dígitos.
4. El código se envía al endpoint `POST /api/auth/login-mfa` junto con el token temporal.
5. Si el código es válido, se completa el login con el JWT completo.

### 12.5 Códigos de Recuperación

- Se generan 10 códigos de un solo uso al activar MFA.
- Si no tiene acceso a su aplicación de autenticación, use un código de recuperación.
- Cada código solo se puede usar una vez.
- Si se agotan los códigos, contacte al administrador para deshabilitar MFA.

### 12.6 Deshabilitar MFA

1. Envíe el código TOTP actual al endpoint `POST /api/mfa/disable`.
2. MFA se desactivará para su cuenta.
3. Se recomienda mantener MFA activado para mayor seguridad.

### 12.7 Auditoría MFA

Todos los eventos de MFA quedan registrados en la auditoría:
- `MFA_ENABLED`: cuando un usuario activa MFA.
- `MFA_DISABLED`: cuando un usuario desactiva MFA.
- `MFA_LOGIN_SUCCESS`: login exitoso con código MFA.
- `MFA_LOGIN_FAILED`: código MFA inválido durante login.

---

## 13. Reautenticación para Operaciones Sensibles

### 13.1 ¿Qué es la reautenticación?

La reautenticación es el proceso de revalidar las credenciales del usuario antes de realizar operaciones sensibles como cambio de email, cambio de contraseña o eliminación de cuenta. Esto previene que un atacante con acceso a una sesión activa realice cambios críticos.

### 13.2 ¿Cuándo se requiere?

- Cambio de correo institucional
- Cambio de contraseña
- Eliminación de cuenta
- Asignación o cambio de rol
- Deshabilitación de MFA
- Configuración de acceso de emergencia (break-glass)

### 13.3 ¿Cómo funciona?

1. El sistema solicita la contraseña actual del usuario.
2. Se envía al endpoint `POST /api/auth/reauthenticate` con la contraseña.
3. Si la contraseña es válida, se retorna un `reauthToken` con expiración de 10 minutos.
4. Las operaciones sensibles incluyen el header `X-Reauth-Token` con este token.
5. El middleware `requireReauthentication` verifica el token antes de procesar la operación.

### 13.4 Auditoría de reautenticación

- `REAUTH_SUCCESS`: reautenticación exitosa, token temporal emitido.
- `REAUTH_FAILED`: contraseña incorrecta durante reautenticación.

---

## 14. Panel del Alumno — Datos Personales

### 14.1 Estructura del Panel

El panel del alumno permite gestionar la información personal, contactos de emergencia, información médica, información laboral y documentos sensibles.

### 14.2 Subsecciones disponibles

| Subsección | Ruta | Descripción |
|------------|------|-------------|
| Perfil y configuración | `/app/alumno/perfil` | Nombres, apellidos, CURP, estadísticas |
| Contactos de emergencia | `/app/contactos-emergencia` | Contactos para situaciones urgentes |
| Información médica | `/app/alumno-info-medica` | Tipo de sangre, alergias, medicamentos, info psicológica |
| Información laboral | `/app/alumno-info-laboral` | Empresa, puesto, teléfono, horario |
| Documentos personales | `/app/alumno-documentos` | Subida y gestión de documentos oficiales |

### 14.3 Restricciones por rol

- Solo el rol **ALUMNO** puede acceder a estas secciones.
- Un administrador o coordinador que intente acceder recibirá error **403 Forbidden**.
- Todas las operaciones generan registros de auditoría.

### 14.4 Auditoría del panel

| Evento | Módulo | Descripción |
|--------|--------|-------------|
| `PROFILE_CHANGED` | ALUMNO | Actualización de nombres, apellidos o CURP |
| `CONTACTO_CREADO` | EMERGENCIA | Nuevo contacto de emergencia |
| `CONTACTO_ACTUALIZADO` | EMERGENCIA | Edición de contacto existente |
| `CONTACTO_ELIMINADO` | EMERGENCIA | Eliminación de contacto |
| `INFORMACION_MEDICA_CREADA` | SALUD | Primera carga de información médica |
| `INFORMACION_MEDICA_ACTUALIZADA` | SALUD | Edición de información médica |
| `INFORMACION_LABORAL_CREADA` | LABORAL | Primera carga de información laboral |
| `INFORMACION_LABORAL_ACTUALIZADA` | LABORAL | Edición de información laboral |
| `DOCUMENTO_SUBIDO` | DOCUMENTOS | Subida de archivo sensible |
| `DOCUMENTO_ELIMINADO` | DOCUMENTOS | Eliminación de archivo sensible |

### 14.5 Tablas involucradas

| Tabla | Propósito |
|-------|-----------|
| `alumnos` | Datos académicos del alumno (nombres, apellidos, CURP) |
| `usuarios` | Datos de usuario (nombres, apellidos, correo, rol) |
| `contactos_emergencia` | Contactos de emergencia del alumno |
| `informacion_medica` | Datos médicos y psicológicos |
| `informacion_laboral` | Datos de empleo actual |
| `documentos_sensibles` | Archivos subidos (PDF, imágenes, documentos) |

---

*Fin del Manual de Administración — SIVACAD v3.0*
