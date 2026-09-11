# Manual Técnico — SIVACAD

**Sistema de Valoración y Calificación del Desempeño de Docentes y Alumnos**

**Autoras:** Bárcenas González Laura Casandra & Morales Ibarra Sandivel  
**Institución:** TESI Ixtapaluca — Ingeniería en Sistemas Computacionales  
**Versión:** 3.0 — Septiembre 2026

---

## Índice

1. [Introducción](#1-introducción)
2. [Arquitectura General](#2-arquitectura-general)
3. [Stack Tecnológico](#3-stack-tecnológico)
4. [Estructura del Proyecto](#4-estructura-del-proyecto)
5. [Frontend — React + Vite](#5-frontend--react--vite)
6. [Backend — Node.js + Express](#6-backend--nodejs--express)
7. [Base de Datos — MySQL 8.0](#7-base-de-datos--mysql-80)
8. [Servicios Externos](#8-servicios-externos)
9. [Rutas y Endpoints](#9-rutas-y-endpoints)
10. [Configuración y Variables de Entorno](#10-configuración-y-variables-de-entorno)
11. [Relación Frontend-Backend](#11-relación-frontend-backend)
12. [Política Centralizada de Contraseñas](#12-política-centralizada-de-contraseñas)
13. [Dependencias y Librerías](#13-dependencias-y-librerías)
14. [Arquitectura de Seguridad Detallada](#14-arquitectura-de-seguridad-detallada)

---

## 1. Introducción

Este manual describe la arquitectura interna, el stack tecnológico y el funcionamiento técnico del Sistema de Valoración y Calificación del Desempeño de Docentes y Alumnos (SIVACAD). Está dirigido a desarrolladores, analistas técnicos y personal de soporte que requiera comprender, mantener o extender el sistema.

---

## 2. Arquitectura General

SIVACAD sigue una **arquitectura de tres capas** (presentación, lógica de negocio, datos) más servicios externos:

```
┌──────────────┐     HTTP/JSON     ┌──────────────┐     SQL     ┌──────────────┐
│  Frontend    │ ────────────────→ │   Backend    │ ──────────→ │    MySQL     │
│  React/Vite  │ ←─────────────── │  Express.js  │ ←───────── │    8.0.0     │
│  Puerto 5173 │                  │  Puerto 3000 │             │  Puerto 3306 │
└──────────────┘                  └──────┬───────┘             └──────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
                    ▼                    ▼                    ▼
            ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
            │  Gemini API  │    │  Flask ML    │    │  PHP CLI     │
            │  (Google AI) │    │  Python      │    │  Dompdf/Php  │
            │  OCR/Chat    │    │  Puerto 5001 │    │  Spreadsheet │
            └──────────────┘    └──────────────┘    └──────────────┘
                                         │
                                    ┌──────────────┐
                                    │  SMTP O365   │
                                    │  Nodemailer  │
                                    └──────────────┘
```

### Principios arquitectónicos

- **Modularidad:** Cada módulo es independiente y se monta dinámicamente via `mountIfAvailable()`.
- **Seguridad por capas:** JWT + bcrypt + Helmet + CORS + rate limiting + consultas parametrizadas + auditoría SHA-256.
- **Multi-lenguaje:** JavaScript (frontend/backend), Python (ML), PHP (documentos).
- **Responsive:** CSS vanilla con 3 breakpoints, off-canvas drawer en móvil.

---

## 3. Stack Tecnológico

| Capa           | Tecnología         | Versión | Propósito                          |
|----------------|--------------------|---------|------------------------------------|
| Frontend       | React              | 18.x    | Interfaz de usuario SPA            |
| Frontend       | Vite               | 5.x     | Bundler y dev server               |
| Frontend       | React Router       | 6.x     | Enrutamiento del lado del cliente  |
| Frontend       | CSS vanilla        | —       | Estilos responsive (~2870 líneas)  |
| Backend        | Node.js            | 18+     | Lógica de negocio                  |
| Backend        | Express.js         | 4.x     | Framework HTTP                      |
| Backend        | MySQL2             | —       | Conexión a base de datos           |
| Backend        | JWT (jsonwebtoken) | —       | Autenticación por tokens           |
| Backend        | bcrypt             | —       | Hash de contraseñas (12 rounds)    |
| Backend        | Helmet             | —       | Seguridad HTTP headers             |
| Backend        | Nodemailer         | —       | Envío de correos SMTP              |
| ML             | Python 3           | 3.10+   | Predicción de deserción/bienestar  |
| ML             | Flask              | —       | API REST para modelos ML           |
| ML             | scikit-learn       | —       | Algoritmos de ML (Random Forest)   |
| Documentos     | PHP 8              | 8.x     | Generación PDF/Excel vía Dompdf    |
| Documentos     | PDFKit             | —       | PDF alternativo desde Node.js      |
| Documentos     | ExcelJS            | —       | Excel desde Node.js                |
| IA             | Gemini API         | —       | OCR, chatbot, bienestar, asistente |
| BD             | MySQL              | 8.0     | Base de datos relacional (70 tablas)|
| Otros          | QRCode (qrcode)    | —       | Generación de códigos QR           |
| Otros          | Puppeteer          | —       | PDF avanzado desde HTML             |

---

## 4. Estructura del Proyecto

```
SIVACAD-ISC/
├── backend/
│   ├── src/
│   │   ├── server.js              # Punto de entrada
│   │   ├── app.js                 # Configuración Express
│   │   ├── config/db.js           # Pool de conexiones MySQL2
│   │   ├── middleware/
│   │   │   ├── auth.js            # JWT + RBAC + verifyRoleAgainstDB + requireReauthentication
│   │   │   ├── auditoria.js       # Log de operaciones + hash SHA-256 de tokens
│   │   │   ├── seguridad.js       # Rate limiter, XSS, IP block, device tracking
│   │   │   ├── institution.js     # Multi-institución, resolveInstitution
│   │   │   └── upload.js          # Multer config
│   │   ├── routes/
│   │   │   ├── index.js           # mountIfAvailable() central
│   │   │   ├── auth.js            # Login, Register, Forgot/Reset, LoginMFA, Reauthenticate
│   │   │   ├── mfa.js             # MFA: setup, enable, disable, verify, status
│   │   │   ├── alumnos.js         # CRUD alumnos
│   │   │   ├── alumnoPerfil.js    # Perfil, kardex, estadísticas del alumno
│   │   │   ├── docentes.js        # CRUD docentes
│   │   │   ├── periodos.js        # CRUD periodos
│   │   │   ├── grupos.js          # CRUD grupos
│   │   │   ├── inscripciones.js   # Inscripciones + reinscripciones
│   │   │   ├── kardex.js          # Kardex, fotos, QR, PDF/Excel
│   │   │   ├── evaluaciones.js    # 5 tipos, 4 estados
│   │   │   ├── actasOCR.js        # OCR con Gemini
│   │   │   ├── tramites.js        # Baja, cambio escuela/carrera
│   │   │   ├── chatbot.js         # Chatbot Gemini
│   │   │   ├── asistente.js       # Asistente con tools + RAG
│   │   │   ├── iaDesercion*.js    # 4 sub-routers por rol
│   │   │   ├── iaBienestar.js     # Check-in, chat, escalación
│   │   │   ├── bienestarAdmin.js  # Supervisión admin
│   │   │   ├── iaBecas.js         # Becas, búsqueda, elegibilidad
│   │   │   ├── reportes.js        # PDF/Excel + reportes seguridad
│   │   │   ├── dashboard.js       # Resumen por rol
│   │   │   ├── usuarios.js        # CRUD usuarios (solo admin)
│   │   │   ├── instituciones.js   # Gestión multi-institución
│   │   │   ├── breakGlass.js      # Acceso de emergencia
│   │   │   └── otros.js           # Utilidades
│   │   ├── controllers/           # Lógica de negocio
│   │   ├── services/              # mailer.js, jwt.js, mlBridge.js, mfa.js, breakGlass.js, privacyManager.js
│   │   └── templates/             # Handlebars para PDF
│   ├── scripts/
│   │   └── backup.sh              # Script de backup automático
│   ├── ml/                        # Flask ML + modelos .pkl
│   ├── php-kardex/                # PHP Dompdf/PhpSpreadsheet
│   └── uploads/                   # Archivos subidos
├── frontend/
│   ├── src/
│   │   ├── main.jsx               # Punto de entrada React
│   │   ├── App.jsx                # Router + providers
│   │   ├── context/
│   │   │   ├── AuthContext.jsx     # Sesión, login, logout
│   │   │   └── ThemeContext.jsx    # Tema claro/oscuro
│   │   ├── services/
│   │   │   └── api.js             # 80+ métodos HTTP
│   │   ├── components/            # 15+ componentes reutilizables
│   │   ├── pages/                 # 40+ páginas
│   │   └── styles/
│   │       └── global.css         # ~2870 líneas CSS vanilla
│   └── vite.config.js
├── database/
│   ├── sivacad_isc.sql            # Esquema completo
│   └── migrations/                # Migraciones incrementales
├── docs/
│   ├── diagrams/
│   │   ├── index.html             # 39 secciones con diagramas
│   │   └── images/                # 76 capturas de diagramas
│   └── manuales/                  # Manuales del sistema
│       ├── manual_usuario.md
│       ├── manual_tecnico.md
│       ├── manual_administracion.md
│       ├── manual_instalacion.md
│       └── manual_mantenimiento.md
└── README.md
```

---

## 5. Frontend — React + Vite

### 5.1 Enrutamiento

Definido en `App.jsx` usando React Router v6:

```jsx
<BrowserRouter>
  <Routes>
    <Route path="/" element={<Navigate to="/login" />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
    <Route path="/terminos" element={<TerminosPage />} />
    <Route path="/aviso-privacidad" element={<AvisoPrivacidadPage />} />
    <Route path="/app/*" element={<ProtectedRoute><AppShell /></ProtectedRoute>} />
  </Routes>
</BrowserRouter>
```

### 5.2 Autenticación (AuthContext.jsx)

- Almacena `token` JWT y datos del `user` en React state + localStorage.
- Provee funciones: `login()`, `logout()`, `isAuthenticated()`, `validarContrasena()`.
- Al iniciar sesión, redirige según el rol del usuario.
- Al recibir 401, dispara evento `sivacad:auth-error` y limpia sesión.
- `validarContrasena()` valida contra la política centralizada definida en `shared/security/password-policy.json`.

### 5.3 Peticiones HTTP (api.js)

- Función central `request(path, { token, method, body })`.
- Inyecta header `Authorization: Bearer <token>` automáticamente.
- Timeout default de 15 segundos.
- Manejo centralizado de errores HTTP.

### 5.4 Componentes reutilizables

- **AppShell:** Layout principal con sidebar colapsable, topbar y área de contenido. Implementa menú off-canvas en móvil.
- **ProtectedRoute:** Verifica sesión activa antes de renderizar.
- **SectionCard, DataTable, Modal:** Componentes de UI genéricos.
- **LoadingSpinner, StatusBadge, MetricCard:** Indicadores visuales.
- **KardexPreview, DesercionPreview:** Vistas previas de módulos.

### 5.5 Estilos (global.css)

- Aproximadamente 2870 líneas de CSS vanilla organizadas por sección.
- Sin framework CSS (no Tailwind, no Bootstrap).
- Breakpoints: 1200px (escritorio), 820px (tablet), 720px (móvil).
- Modo oscuro con variables CSS (`--bg-dark`, `--text-dark`, etc.).
- Drawer off-canvas para navegación móvil.

---

## 6. Backend — Node.js + Express

### 6.1 Punto de entrada (server.js)

```javascript
const app = require('./app');
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
```

### 6.2 Configuración Express (app.js)

- Middleware global: `express.json()`, `helmet()`, `cors()` con lista blanca + regex LAN.
- Montaje de rutas: `app.use('/api', routesIndex)`.
- Manejo de errores 404 genérico.
- Rate limiting en rutas sensibles (5 req/15 min en forgot-password).

### 6.3 Sistema de montaje dinámico (routes/index.js)

```javascript
function mountIfAvailable(routePath, modulePath) {
  try {
    const mod = require(modulePath);
    router.use(routePath, mod);
  } catch (e) {
    // Silently skip if module file doesn't exist
  }
}
```

Esto permite habilitar/deshabilitar módulos agregando o quitando archivos.

### 6.4 Middleware de autenticación (middleware/auth.js)

- **auth (authenticateToken):** Verifica JWT con HS256, extrae `id_usuario`, `correo`, `rol`, `id_institucion`. Verifica que el token no esté en la blacklist.
- **validateInstitutionalEmail:** Valida dominio del correo contra lista blanca (tesi.edu.mx, ixtapaluca.tecnm.mx, outlook.com, outlook.es).
- **role(...roles):** Middleware de autorización RBAC con coincidencia case-insensitive.
- **verifyRoleAgainstDB:** Verifica que el rol del token aún coincida con la BD (protege contra cuentas cuyo rol cambió después de emitir el token). Se aplica a rutas críticas: break-glass, instituciones, kardex admin. Falla seguro: deniega acceso si la BD no responde.
- **requireReauthentication:** Requiere header `X-Reauth-Token` con JWT temporal de 10 minutos. Usado antes de operaciones sensibles (cambio de email, eliminación de cuenta, cambio de rol).
- **auditLog:** Registra operaciones en `bitacora_auditoria`.

### 6.5 Seguridad

Los controles de seguridad implementados en SIVACAD se organizan en capas:

**Autenticación y Sesión:**
- Contraseñas hasheadas con bcrypt (12 rounds de salt).
- Tokens JWT firmados con HMAC-SHA256, algoritmo forzado (rechaza RS256, none).
- Secretos JWT separados: `JWT_SECRET` para tokens de acceso (8h) y `JWT_REFRESH_SECRET` para tokens de refresco (30d). Cada secret es independiente y no comparten valor.
- Tokens de sesión hasheados con SHA-256 antes de almacenarlos en `sesiones_activas` (nunca se almacena el JWT crudo).
- Blacklist de tokens: al cerrar sesión, el token se agrega a una blacklist invalidándolo inmediatamente.
- Bloqueo de cuenta: 5 intentos fallidos → bloqueo de 30 minutos.
- Autenticación Multi-Factor (MFA): TOTP (RFC 6238) con secretos cifrados AES-256-CBC, códigos de recuperación, verificación en login.

**Autorización:**
- RBAC con 5 roles: ADMINISTRADOR, COORDINADOR, DOCENTE, SOPORTE, ALUMNO.
- `verifyRoleAgainstDB`: verifica que el rol del token coincida con la BD en rutas críticas.
- Registro público restringido a rol ALUMNO (previene escalación de privilegios).
- Reautenticación antes de operaciones sensibles (token temporal de 10 min).

**Protección de Transporte:**
- Headers de seguridad via Helmet: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy.
- Content Security Policy (CSP): scriptSrc sin `unsafe-inline`, sin `unsafe-eval`.
- CORS con lista blanca de orígenes + regex para IPs LAN.
- HTTPS forzado en producción (Nginx + Certbot).

**Protección de Datos:**
- Consultas parametrizadas con mysql2 (previene inyección SQL).
- Transacciones ACID con COMMIT/ROLLBACK.
- XSS sanitizer: escape de HTML en body, query y params antes de procesar.
- Rate limiting por ruta: login (10/15min), forgot-password (5/15min), register (5/1h), refresh (30/15min).

**Monitoreo y Auditoría:**
- Auditoría global con hash SHA-256 encadenado (integridad y no-repudio).
- 9 eventos de auditoría de seguridad: MFA_ENABLED, MFA_DISABLED, MFA_ENABLE_FAILED, MFA_LOGIN_SUCCESS, MFA_LOGIN_FAILED, REAUTH_SUCCESS, REAUTH_FAILED, PROFILE_CHANGED, NEW_DEVICE_LOGIN.
- Detección de dispositivo nuevo: al hacer login desde un dispositivo no registrado, se genera un evento de auditoría WARNING.
- Registro de intentos sospechosos con IP, user-agent y fingerprint del dispositivo.

**Acceso de Emergencia:**
- Break-glass access: PIN numérico de 8 dígitos con expiración máxima de 24 horas.
- Registro completo de emisión, uso y revocación de credenciales de emergencia.

**Privacidad:**
- Anonimización de datos personales con identificador aleatorio (random hex), sin exponer el ID real del usuario.
- Eliminación de datos sensibles de bienestar y chatbot durante la anonimización.

---

## 7. Base de Datos — MySQL 8.0

### 7.1 Esquema general

- **Motor:** InnoDB (transaccional, integridad referencial).
- **Charset:** utf8mb4_unicode_ci.
- **Total de tablas:** 70.
- **Convención de nombres:** snake_case con prefijos modulares (`kardex_*`, `evaluacion_*`, `ia_*`, `reinscripcion_*`).

### 7.2 Grupos de tablas

| Grupo               | Tablas clave                                      | Propósito                           |
|---------------------|---------------------------------------------------|-------------------------------------|
| Núcleo              | `usuarios`, `roles`, `alumnos`, `docentes`        | Identidad y perfiles                |
| Académico           | `carreras`, `periodos`, `grupos`, `materias`      | Estructura académica                |
| Inscripciones       | `inscripciones`, `reinscripciones`                | Control escolar                     |
| Kardex              | `kardex_alumno`, `kardex_historial_academico`     | Historial académico                 |
| Evaluaciones        | `evaluacion_plantillas`, `evaluaciones`, `respuestas_evaluacion` | Evaluación |
| OCR                 | `actas_ocr_cargas`, `actas_ocr_datos`             | Procesamiento de actas              |
| Trámites            | `tramites`, `tramites_documentos`                 | Gestión de trámites                 |
| IA Deserción        | `ia_alertas_desercion`, `ia_seguimientos_desercion` | Predicción deserción |
| IA Bienestar        | 8 tablas (sesiones, checkins, mensajes, alertas, derivaciones) | Bienestar estudiantil |
| IA Becas            | `becas_fuentes`, `becas_chunks`                   | Catálogo de becas                   |
| Auditoría           | `bitacora_auditoria`, `auditoria_global`, `sesiones_activas` | Trazabilidad |
| Seguridad           | `mfa_config`, `dispositivos_conocidos`, `tokens_blacklist`, `intentos_sospechosos`, `break_glass_credentials` | Control de acceso, MFA, sesiones |
| Datos Personales    | `informacion_medica`, `informacion_laboral`, `documentos_sensibles`, `contactos_emergencia` | Panel del alumno |

### 7.3 Conexión (config/db.js)

```javascript
const pool = mysql2.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sivacad_isc',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
```

---

## 8. Servicios Externos

### 8.1 Gemini API (Google AI)

- **Uso:** OCR de actas, chatbot general, asistente académico, chat de bienestar.
- **Autenticación:** API Key en variable de entorno `GEMINI_API_KEY`.
- **Modelo:** `gemini-2.0-flash` (o versión disponible).
- **Prompt:** Prompt institucional con reglas (solo temas académicos, no inventar datos).

### 8.2 Flask ML (Python)

- **Uso:** Predicción de deserción (binaria y multiclase).
- **Puerto:** 5001.
- **Comunicación:** Backend Node.js → HTTP POST → Flask API.
- **Modelos:** Random Forest, XGBoost (archivos .pkl).
- **Rutas:** `/predict/desercion`, `/health`.

### 8.3 PHP CLI (Dompdf / PhpSpreadsheet)

- **Uso:** Generación de PDF con formato institucional y Excel con múltiples hojas.
- **Comunicación:** Backend ejecuta PHP via `exec()` o `child_process.spawn()`.
- **Ruta:** `backend/php-kardex/`.

### 8.4 SMTP Office 365 (Nodemailer)

- **Uso:** Envío de correos de recuperación de contraseña.
- **Configuración:** Host, puerto, usuario, contraseña en .env.

### 8.5 Puppeteer

- **Uso:** Generación alternativa de PDF desde HTML renderizado.
- **Alternativa a:** PHP Dompdf (cuando se necesita mayor fidelidad visual).

---

## 9. Rutas y Endpoints

### 9.1 Prefijos de rutas montados en /api

| Ruta                  | Módulo                | Roles con acceso               |
|-----------------------|-----------------------|--------------------------------|
| `/auth/*`             | Autenticación          | Público                        |
| `/dashboard/*`        | Dashboard              | Todos                          |
| `/alumnos/*`          | Alumnos                | Admin, Coord                   |
| `/docentes/*`         | Docentes               | Admin, Coord                   |
| `/periodos/*`         | Periodos               | Admin, Coord                   |
| `/grupos/*`           | Grupos                 | Admin, Coord                   |
| `/inscripciones/*`    | Inscripciones          | Todos (según acción)           |
| `/kardex/*`           | Kardex                 | Todos (según acción)           |
| `/evaluaciones/*`     | Evaluaciones           | Todos (según acción)           |
| `/actas-ocr/*`        | Actas OCR              | Admin, Coord                   |
| `/tramites/*`         | Trámites               | Todos (según acción)           |
| `/chatbot/*`          | Chatbot                | Todos                          |
| `/asistente/*`        | Asistente Académico    | Todos                          |
| `/ia/desercion/*`     | IA Deserción           | Todos (4 sub-routers por rol)  |
| `/ia/bienestar/*`     | IA Bienestar           | Alumno                         |
| `/bienestar-admin/*`  | Bienestar Admin        | Admin, Coord, Soporte          |
| `/ia/becas/*`         | IA Becas               | Todos                          |
| `/reportes/*`         | Reportes               | Todos                          |
| `/usuarios/*`         | Usuarios               | Admin                          |
| `/auditoria/*`        | Auditoría              | Admin, Soporte                 |
| `/mfa/*`              | MFA (setup, enable, disable, verify, status) | Todos autenticados |
| `/alumno-perfil/*`    | Perfil del alumno      | Alumno                         |
| `/instituciones/*`    | Gestión multi-institución | Admin                        |
| `/break-glass/*`      | Acceso de emergencia   | Admin, Coord                   |
| `/contactos/*`        | Contactos de crisis    | Todos                          |
| `/alumno-info-medica/*` | Info médica del alumno | Alumno                         |
| `/alumno-info-laboral/*` | Info laboral del alumno | Alumno                       |
| `/alumno-documentos/*` | Documentos sensibles del alumno | Alumno                     |
| `/contactos-emergencia/*` | Contactos de emergencia | Todos autenticados          |

---

## 10. Configuración y Variables de Entorno

### 10.1 Archivo .env (backend)

```env
# Puerto del servidor
PORT=3000

# Base de datos
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=sivacad_isc

# JWT
JWT_SECRET=tu_secreto_jwt_aqui
JWT_REFRESH_SECRET=otro_secreto_diferente_a_jwt_secret
JWT_EXPIRES_IN=8h

# Gemini API
GEMINI_API_KEY=tu_api_key_gemini

# SMTP Office 365
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=correo@tesi.edu.mx
SMTP_PASS=contraseña_correo

# Frontend URL (para enlaces en correos)
FRONTEND_URL=http://localhost:5173

# Flask ML
FLASK_ML_URL=http://localhost:5001
```

### 10.2 Archivo .env (frontend)

```env
VITE_API_URL=http://localhost:3000/api
```

---

## 11. Relación Frontend-Backend

### 11.1 Flujo de petición típico

```
1. Usuario interactúa con componente React
2. Componente llama a api.js → request('/alumnos', { token })
3. api.js inyecta header Authorization: Bearer <token>
4. Petición HTTP a VITE_API_URL + '/alumnos'
5. Backend recibe en Express Router
6. Middleware auth.js verifica JWT y rol
7. Controlador ejecuta lógica de negocio + consulta MySQL
8. Backend responde JSON { ok: true, data: [...] }
9. api.js retorna response.data al componente
10. Componente actualiza estado y renderiza
```

### 11.2 Manejo de errores

| Código | Significado              | Acción del frontend                     |
|--------|--------------------------|-----------------------------------------|
| 200    | Éxito                    | Procesa datos normalmente               |
| 201    | Creado exitosamente      | Muestra notificación de éxito           |
| 400    | Error de validación      | Muestra mensaje de error del servidor   |
| 401    | No autorizado / Token expirado | Limpia sesión, redirige a /login  |
| 403    | Sin permisos             | Muestra "Acceso denegado"               |
| 404    | Recurso no encontrado    | Muestra "No encontrado"                 |
| 429    | Demasiadas solicitudes   | Muestra "Intente más tarde"             |
| 500    | Error del servidor       | Muestra "Error interno"                 |

---

## 12. Política Centralizada de Contraseñas

### 12.1 Arquitectura

Desde la versión 1.1, SIVACAD implementa una política de contraseñas centralizada. La fuente de verdad es un archivo JSON compartido que define las reglas de validación:

```
shared/security/password-policy.json
```

Tanto el backend como el frontend leen esta configuración para garantizar consistencia en todos los puntos de entrada.

### 12.2 Configuración

```json
{
  "minLength": 12,
  "maxLength": 20,
  "requireUppercase": true,
  "requireLowercase": true,
  "requireNumber": true,
  "requireSymbol": true
}
```

### 12.3 Archivos de implementación

| Archivo | Capa | Función |
|---------|------|---------|
| `shared/security/password-policy.json` | Compartido | Fuente única de verdad |
| `backend/src/security/passwordPolicy.js` | Backend | `getPasswordPolicy()`, `validatePassword()` |
| `frontend/src/security/passwordPolicy.js` | Frontend | `getPasswordPolicy()`, `validatePassword()`, `getPasswordRequirementsText()` |
| `backend/src/controllers/auth.js` | Backend | Validación en registro y reset-password |
| `backend/src/middleware/validate.js` | Backend | Middleware de validación |
| `frontend/src/pages/RegisterPage.jsx` | Frontend | Validación en tiempo real en registro |
| `frontend/src/pages/ResetPasswordPage.jsx` | Frontend | Validación en restablecimiento |
| `frontend/src/context/AuthContext.jsx` | Frontend | `validarContrasena()` global |

### 12.4 Flujo de validación

1. El usuario escribe una contraseña en el formulario de Registro o Reset.
2. El frontend valida en tiempo real con `validatePassword()` y muestra requisitos cumplidos/pendientes.
3. Al enviar, el backend re-valida con `validatePassword()`.
4. Si es válida: `bcrypt.hash(contrasena, 12)` → almacenar en BD.
5. Si no es válida: retorna error 400 con mensaje descriptivo.

---

## 13. Dependencias y Librerías

### 13.1 Backend (package.json)

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "mysql2": "^3.6.0",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.1.4",
    "nodemailer": "^6.9.7",
    "multer": "^1.4.5-lts.1",
    "qrcode": "^1.5.3",
    "pdfkit": "^0.13.0",
    "exceljs": "^4.4.0",
    "@google/generative-ai": "^0.21.0",
    "dotenv": "^16.3.1",
    "morgan": "^1.10.0",
    "handlebars": "^4.7.8",
    "puppeteer": "^21.6.0"
  }
}
```

### 13.2 Frontend (package.json)

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "react-scripts": "5.0.1",
    "axios": "^1.6.2"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0"
  }
}
```

### 13.3 Python ML (requirements.txt)

```
flask==3.0.0
flask-cors==4.0.0
scikit-learn==1.3.2
pandas==2.1.4
numpy==1.26.2
joblib==1.3.2
xgboost==2.0.1
imbalanced-learn==0.11.0
```

---

## 14. Arquitectura de Seguridad Detallada

### 14.1 Flujo de Autenticación Completo

```
┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌──────────────┐
│ Usuario  │───→│ Frontend │───→│ Backend      │───→│ MySQL        │
│ (login)  │    │ (React)  │    │ (Express)    │    │ (8.0)        │
└──────────┘    └──────────┘    └──────────────┘    └──────────────┘
                                     │
                   ┌─────────────────┼─────────────────┐
                   ▼                 ▼                  ▼
            ┌────────────┐  ┌──────────────┐  ┌──────────────┐
            │ 1. Validar │  │ 4. Verificar │  │ 7. Almacenar │
            │ email inst.│  │ MFA (si      │  │ sesión con   │
            │ 2. Buscar  │  │ activo)      │  │ hash SHA-256 │
            │ usuario    │  │ 5. Generar   │  │              │
            │ 3. Verificar│  │ JWT + Refresh│  │              │
            │ password   │  │ 6. Verificar │  │              │
            │ bcrypt     │  │ dispositivo  │  │              │
            │            │  │ nuevo        │  │              │
            └────────────┘  └──────────────┘  └──────────────┘
```

**Pasos detallados:**

1. **Validación de email institucional:** El middleware `validateInstitutionalEmail` verifica que el dominio del correo esté en la lista blanca (tesi.edu.mx, ixtapaluca.tecnm.mx, outlook.com, outlook.es).

2. **Búsqueda de usuario:** Se consulta la tabla `usuarios` con `correo_institucional` normalizado (lowercase, trim).

3. **Verificación de password:** `bcrypt.compare(contrasena, hash)` con los 12 rounds de salt. Si falla, se registra intento fallido en `intentos_login` y se verifica si alcanza el umbral de bloqueo (5 intentos → 30 min).

4. **Verificación MFA (si está activo):** Si el usuario tiene `mfa_config.activo = 1`, se retorna `mfaRequired: true` con un token temporal de 5 minutos (`type: 'mfa_pending'`). El frontend muestra el formulario de código de 6 dígitos.

5. **Generación de tokens:** `signToken()` genera el JWT de acceso (expiración 8h, payload: id_usuario, correo, rol, rol_id, id_institucion). `signRefreshToken()` genera el token de refresco (expiración 30d, payload: id_usuario, type: 'refresh') con `JWT_REFRESH_SECRET` separado.

6. **Verificación de dispositivo:** `trackDevice()` compara el fingerprint del dispositivo (UA + IP + Accept-Language hasheado con SHA-256) contra la tabla `dispositivos_conocidos`. Si es nuevo, registra evento `NEW_DEVICE_LOGIN` en auditoría.

7. **Almacenamiento de sesión:** El token JWT se hashea con SHA-256 antes de insertarlo en `sesiones_activas`. Nunca se almacena el JWT crudo.

### 14.2 Flujo MFA (Multi-Factor Authentication)

```
SETUP:  POST /api/mfa/setup → genera secreto TOTP + QR code + recovery codes
ENABLE: POST /api/mfa/enable { token } → verifica TOTP, activa MFA
LOGIN:  POST /api/auth/login → retorna { mfaRequired: true, mfaToken }
        POST /api/auth/login-mfa { mfaToken, codigo } → verifica TOTP, retorna JWT completo
STATUS: GET /api/mfa/status → { configured, active, recoveryCodesRemaining }
DISABLE: POST /api/mfa/disable { token } → desactiva MFA
```

**Detalles técnicos:**
- El secreto TOTP se genera con `speakeasy.generateSecret()` y se cifra con AES-256-CBC antes de almacenarlo en `mfa_config.secret_encrypted`.
- Los códigos de recuperación se generan como hashes SHA-256 (nunca se almacenan en texto plano).
- La verificación usa `speakeasy.totp.verify()` con ventana de ±1 шаг (30 segundos).
- Los secretos se cifran usando una clave derivada de `JWT_SECRET` + `JWT_REFRESH_SECRET` via PBKDF2.

### 14.3 Separación de Secretos JWT

**¿Por qué?** Si un atacante obtiene acceso al JWT de un usuario, y ambos tokens (acceso y refresco) usan el mismo secreto, podría generar tokens de refresco válidos. Con secretos separados, comprometer uno no afecta al otro.

**Implementación:**
```javascript
// jwt.js
const accessSecret = process.env.JWT_SECRET;        // Para tokens de acceso (8h)
const refreshSecret = process.env.JWT_REFRESH_SECRET; // Para tokens de refresco (30d)

exports.signToken = (payload, expiresIn) => 
  jwt.sign(payload, accessSecret, { algorithm: 'HS256', expiresIn });

exports.signRefreshToken = (payload) => 
  jwt.sign({ ...payload, type: 'refresh' }, refreshSecret, { algorithm: 'HS256', expiresIn: '30d' });

exports.verifyRefreshToken = (token) => 
  jwt.verify(token, refreshSecret, { algorithms: ['HS256'] });
```

### 14.4 Hash de Tokens en BD

**¿Por qué no almacenar el JWT crudo?** Si un atacante obtiene acceso a la base de datos, ver todos los tokens JWT activos le permitiría impersonar a cualquier usuario. Con hashes SHA-256, los tokens son inutilizables sin el secreto de firma.

**Implementación:**
```javascript
// auditoria.js
const tokenHash = crypto.createHash('sha256')
  .update(req.headers.authorization?.replace('Bearer ', '') || '')
  .digest('hex');

await pool.execute(
  'INSERT INTO sesiones_activas (id_usuario, token_jwt, ...) VALUES (?, ?, ...)',
  [userId, tokenHash, ...]  // Se almacena el hash, no el JWT
);
```

### 14.5 Break-Glass Access

**Caso de uso:** Cuando todos los administradores están bloqueados o incapacitados, un COORDINADOR puede generar un PIN de emergencia para acceder.

**Flujo:**
1. Admin/Coord genera PIN: `POST /api/break-glass/grant`
2. Se genera PIN numérico de 8 dígitos (ej: `48291037`)
3. Se almacena como hash SHA-256 en `break_glass_credentials`
4. El PIN expira en máximo 24 horas
5. Para usar: `POST /api/break-glass/verify { pin }` → retorna permisos temporales
6. Admin puede revocar: `POST /api/break-glass/revoke/:id`

### 14.6 Privacidad y Anonimización

**Cumplimiento ARCO:** Cuando un usuario solicita eliminación de sus datos, el sistema:
1. **Anonimiza** nombres, apellidos, CURP y fotografía
2. **Genera** un identificador aleatorio (random hex de 8 bytes) para el email (nunca expone el ID real)
3. **Elimina** datos sensibles de bienestar (check-ins, mensajes) y chatbot
4. **Conserva** registros académicos anonimizados para integridad estadística

### 14.7 Tabla Resumen de Controles de Seguridad

| # | Control | Capa | Implementación |
|---|---------|------|----------------|
| 1 | Bcrypt 12 rounds | Autenticación | `bcrypt.hash(pw, 12)` |
| 2 | JWT HS256 | Autenticación | `jwt.sign(payload, secret, { algorithm: 'HS256' })` |
| 3 | Secretos separados | Autenticación | `JWT_SECRET` ≠ `JWT_REFRESH_SECRET` |
| 4 | Token hash SHA-256 | Sesiones | `crypto.createHash('sha256').update(token)` |
| 5 | Blacklist tokens | Sesiones | `tokens_blacklist` tabla + verificación middleware |
| 6 | Bloqueo de cuenta | Autenticación | 5 intentos → 30 min lockout |
| 7 | MFA TOTP | Autenticación | `speakeasy` + AES-256-CBC encrypted secrets |
| 8 | RBAC por rol | Autorización | `role('ADMIN', 'COORD')` middleware |
| 9 | Verificación rol BD | Autorización | `verifyRoleAgainstDB` en rutas críticas |
| 10 | Reautenticación | Autorización | `requireReauthentication` + token temporal 10min |
| 11 | Helmet headers | Transporte | X-Frame-Options, CSP, XSS-Protection |
| 12 | CSP sin unsafe-inline | Transporte | `scriptSrc: ["'self'"]` |
| 13 | Rate limiting | Disponibilidad | 10 login/15min, 5 forgot/15min |
| 14 | XSS sanitizer | Datos | Escape de HTML en body, query, params |
| 15 | Consultas parametrizadas | Datos | `pool.execute(sql, [params])` |
| 16 | Auditoría SHA-256 | Monitoreo | Hash encadenado en `auditoria_global` |
| 17 | Eventos seguridad | Monitoreo | 9 tipos de eventos de seguridad |
| 18 | Device tracking | Monitoreo | Fingerprint + alerta dispositivo nuevo |
| 19 | Break-glass PIN | Emergencia | 8 dígitos numéricos, expiración 24h |
| 20 | Anonimización ARCO | Privacidad | random hex, no expone ID real |
| 21 | RBAC Panel Alumno | Autorización | `role('ALUMNO')` en medical/laboral/docs |
| 22 | IDOR Protection | Autorización | Queries por `id_usuario` del JWT |
| 23 | Auditoría panel | Monitoreo | `PROFILE_CHANGED`, `CONTACTO_*`, `INFORMACION_*`, `DOCUMENTO_*` |

---

*Fin del Manual Técnico — SIVACAD v3.0*
