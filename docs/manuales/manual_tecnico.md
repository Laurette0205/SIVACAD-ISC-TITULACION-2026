# Manual Técnico — SIVACAD

**Sistema de Valoración y Calificación del Desempeño de Docentes y Alumnos**

**Autoras:** Bárcenas González Laura Casandra & Morales Ibarra Sandivel  
**Institución:** TESI Ixtapaluca — Ingeniería en Sistemas Computacionales  
**Versión:** 1.0 — Julio 2026

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
12. [Dependencias y Librerías](#12-dependencias-y-librerías)

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
| BD             | MySQL              | 8.0     | Base de datos relacional (67 tablas)|
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
│   │   │   ├── auth.js            # JWT + RBAC + dominio email
│   │   │   ├── auditoria.js       # Log de operaciones
│   │   │   └── upload.js          # Multer config
│   │   ├── routes/
│   │   │   ├── index.js           # mountIfAvailable() central
│   │   │   ├── auth.js            # Login, Register, Forgot/Reset
│   │   │   ├── alumnos.js         # CRUD alumnos
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
│   │   │   ├── reportes.js        # PDF/Excel
│   │   │   ├── dashboard.js       # Resumen por rol
│   │   │   ├── usuarios.js        # CRUD usuarios (solo admin)
│   │   │   └── otros.js           # Utilidades
│   │   ├── controllers/           # Lógica de negocio
│   │   ├── services/              # mailer.js, jwt.js, mlBridge.js
│   │   └── templates/             # Handlebars para PDF
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
- Provee funciones: `login()`, `logout()`, `isAuthenticated()`.
- Al iniciar sesión, redirige según el rol del usuario.
- Al recibir 401, dispara evento `sivacad:auth-error` y limpia sesión.

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

- **authenticateToken:** Verifica JWT, extrae `id_usuario`, `correo`, `rol`.
- **validateInstitutionalEmail:** Valida dominio del correo contra lista blanca.
- **checkRole('admin', 'coordinador'):** Middleware de autorización RBAC.
- **auditLog:** Registra operaciones en `bitacora_auditoria`.

### 6.5 Seguridad

- Contraseñas hasheadas con bcrypt (12 rounds).
- Tokens JWT firmados con HMAC-SHA256.
- Consultas parametrizadas con mysql2 (previene inyección SQL).
- Transacciones ACID con COMMIT/ROLLBACK.
- Headers de seguridad via Helmet.
- CORS con origen único + regex para IPs LAN.
- Rate limiting por ruta.

---

## 7. Base de Datos — MySQL 8.0

### 7.1 Esquema general

- **Motor:** InnoDB (transaccional, integridad referencial).
- **Charset:** utf8mb4_unicode_ci.
- **Total de tablas:** 67.
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
JWT_EXPIRES_IN=24h

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

## 12. Dependencias y Librerías

### 12.1 Backend (package.json)

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

### 12.2 Frontend (package.json)

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

### 12.3 Python ML (requirements.txt)

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

*Fin del Manual Técnico — SIVACAD v1.0*
