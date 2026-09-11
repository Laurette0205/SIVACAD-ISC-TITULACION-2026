# Manual de Instalación y Despliegue — SIVACAD

**Sistema de Valoración y Calificación del Desempeño de Docentes y Alumnos**

**Autoras:** Bárcenas González Laura Casandra & Morales Ibarra Sandivel  
**Institución:** TESI Ixtapaluca — Ingeniería en Sistemas Computacionales  
**Versión:** 3.0 — Septiembre 2026

---

## Índice

1. [Introducción](#1-introducción)
2. [Requisitos del Sistema](#2-requisitos-del-sistema)
3. [Estructura de Archivos](#3-estructura-de-archivos)
4. [Instalación de la Base de Datos](#4-instalación-de-la-base-de-datos)
5. [Configuración del Backend](#5-configuración-del-backend)
6. [Configuración del Frontend](#6-configuración-del-frontend)
7. [Configuración del Módulo ML (Python/Flask)](#7-configuración-del-módulo-ml-pythonflask)
8. [Configuración del Módulo PHP](#8-configuración-del-módulo-php)
9. [Levantamiento de Servidores](#9-levantamiento-de-servidores)
10. [Primer Acceso y Pruebas Iniciales](#10-primer-acceso-y-pruebas-iniciales)
11. [Despliegue en Producción](#11-despliegue-en-producción)
12. [Solución de Problemas Comunes](#12-solución-de-problemas-comunes)
13. [Configuración de Backup Automatizado](#13-configuración-de-backup-automatizado)

---

## 1. Introducción

Este manual describe paso a paso cómo instalar, configurar y poner en funcionamiento el Sistema de Valoración y Calificación del Desempeño de Docentes y Alumnos (SIVACAD). Está dirigido al personal técnico, desarrolladores y soporte responsables de la implementación.

---

## 2. Requisitos del Sistema

### 2.1 Hardware mínimo recomendado

| Componente | Desarrollo | Producción |
|------------|-----------|------------|
| CPU        | 2 núcleos  | 4 núcleos   |
| RAM        | 4 GB       | 8 GB        |
| Disco      | 20 GB SSD  | 50 GB SSD   |
| Red        | Conexión básica | 100 Mbps |

### 2.2 Software requerido

| Software          | Versión mínima | Propósito                     |
|-------------------|----------------|-------------------------------|
| Node.js           | 18.0.0         | Backend + Frontend            |
| npm               | 9.0.0          | Gestor de paquetes            |
| MySQL             | 8.0.0          | Base de datos                 |
| Python            | 3.10.0         | Módulo de Machine Learning    |
| pip               | 22.0.0         | Gestor paquetes Python        |
| PHP               | 8.0.0          | Generación documentos PDF/Excel |
| Composer          | 2.0.0          | Gestor dependencias PHP       |
| Git               | 2.30.0         | Control de versiones          |

### 2.3 Software opcional

| Software    | Propósito                             |
|-------------|---------------------------------------|
| Chrome/Chromium | Pruebas de frontend, Puppeteer   |
| Postman     | Pruebas de API                        |
| MySQL Workbench | Administración visual de BD       |
| Nginx o Apache  | Proxy inverso en producción        |

### 2.4 Cuentas de servicio requeridas

- **Google Gemini API:** Obtener API Key en https://ai.google.dev/
- **SMTP Office 365:** Cuenta de correo institucional para envío de notificaciones

---

## 3. Estructura de Archivos

### 3.1 Clonar el repositorio

```bash
git clone <url-del-repositorio> SIVACAD-ISC
cd SIVACAD-ISC
```

### 3.2 Árbol de directorios principal

```
SIVACAD-ISC/
├── backend/          # API REST (Node.js + Express)
│   ├── src/          # Código fuente del backend
│   ├── ml/           # Módulo de ML (Python/Flask)
│   ├── php-kardex/   # Módulo PHP (Dompdf/PhpSpreadsheet)
│   └── uploads/      # Archivos subidos (actas OCR, fotos)
├── frontend/         # Cliente SPA (React + Vite)
├── shared/           # Código compartido entre capas
│   └── security/     # Política centralizada de contraseñas
├── database/         # Esquemas SQL y migraciones
└── docs/             # Documentación y manuales
```

---

## 4. Instalación de la Base de Datos

### 4.1 Crear la base de datos

Acceda a MySQL:

```bash
mysql -u root -p
```

Ejecute:

```sql
CREATE DATABASE sivacad_isc CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

### 4.2 Importar el esquema

```bash
mysql -u root -p sivacad_isc < database/sivacad_isc.sql
```

### 4.3 Ejecutar migraciones (si existen)

```bash
for file in database/migrations/*.sql; do
  mysql -u root -p sivacad_isc < "$file"
done
```

### 4.4 Verificar la instalación

```bash
mysql -u root -p -e "USE sivacad_isc; SHOW TABLES;"
```

Deberían aparecer las 67 tablas del sistema.

---

## 5. Configuración del Backend

### 5.1 Instalar dependencias

```bash
cd backend
npm install
```

### 5.2 Configurar variables de entorno

```bash
cp .env.example .env
```

Edite el archivo `.env` con los valores correctos:

```env
# Puerto del servidor
PORT=3000

# Base de datos
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_contraseña_mysql
DB_NAME=sivacad_isc

# JWT — Access Token (8 horas)
JWT_SECRET=generar_un_secreto_aleatorio_seguro_128bit
JWT_EXPIRES_IN=8h

# JWT — Refresh Token (DEBE ser diferente a JWT_SECRET)
JWT_REFRESH_SECRET=generar_otro_secreto_aleatorio_diferente

# Gemini API
GEMINI_API_KEY=tu_api_key_de_gemini

# SMTP Office 365
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=correo@tesi.edu.mx
SMTP_PASS=contraseña_del_correo

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Flask ML
FLASK_ML_URL=http://localhost:5001
```

> **IMPORTANTE:** Genere valores aleatorios únicos para `JWT_SECRET` y `JWT_REFRESH_SECRET` usando:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

### 5.3 Verificar configuración

```bash
node -e "require('./src/app.js'); console.log('Configuración OK');"
```

---

## 6. Configuración del Frontend

### 6.1 Instalar dependencias

```bash
cd frontend
npm install
```

### 6.2 Configurar variables de entorno

```bash
cp .env.example .env
```

Edite `.env`:

```env
VITE_API_URL=http://localhost:3000/api
```

### 6.3 Verificar compilación

```bash
npm run build
```

La compilación debe completarse sin errores (1754+ módulos).

---

## 7. Configuración del Módulo ML (Python/Flask)

### 7.1 Crear entorno virtual

```bash
cd backend/ml
python -m venv venv
```

### 7.2 Activar el entorno virtual

- Windows: `venv\Scripts\activate`
- Linux/Mac: `source venv/bin/activate`

### 7.3 Instalar dependencias

```bash
pip install -r requirements.txt
```

### 7.4 Entrenar modelos (opcional, incluye modelos pre-entrenados)

```bash
python train_model.py
```

### 7.5 Verificar instalación

```bash
python app.py
# Servidor Flask iniciado en http://localhost:5001
```

---

## 8. Configuración del Módulo PHP

### 8.1 Instalar dependencias con Composer

```bash
cd backend/php-kardex
composer install
```

### 8.2 Verificar PHP

```bash
php -v
# Debe ser PHP 8.0 o superior
```

### 8.3 Probar generación de PDF

```bash
php test_pdf.php
```

---

## 9. Levantamiento de Servidores

Para desarrollo, los servidores se ejecutan en terminales separadas.

### 9.1 Iniciar backend (Express.js)

```bash
cd backend
npm run dev
# Servidor en http://localhost:3000
```

### 9.2 Iniciar frontend (Vite)

```bash
cd frontend
npm run dev
# Servidor en http://localhost:5173
```

### 9.3 Iniciar Flask ML (Python)

```bash
cd backend/ml
venv\Scripts\activate  # Windows
# o: source venv/bin/activate  # Linux/Mac
python app.py
# Servidor en http://localhost:5001
```

### 9.4 Verificar que todos los servidores están funcionando

```bash
# Terminal 1: Backend
curl http://localhost:3000/api/dashboard

# Terminal 2: Frontend
curl http://localhost:5173

# Terminal 3: Flask ML
curl http://localhost:5001/health
```

---

## 10. Primer Acceso y Pruebas Iniciales

### 10.1 Sembrar datos de prueba

```bash
mysql -u root -p sivacad_isc < database/seed_usuarios_iniciales.sql
```

### 10.2 Acceder al sistema

1. Abra http://localhost:5173 en su navegador.
2. Inicie sesión con las credenciales por defecto:
   - **Correo:** `admin@tesi.edu.mx`
   - **Contraseña:** `Testing123!`

> **Nota sobre contraseñas:** La política de contraseñas requiere 12-20 caracteres con mayúscula, minúscula, número y símbolo. La contraseña por defecto cumple con estos requisitos. Al crear nuevos usuarios, asegúrese de que sus contraseñas cumplan la política.

### 10.3 Pruebas iniciales recomendadas

| # | Prueba | Resultado esperado |
|---|--------|-------------------|
| 1 | Iniciar sesión como administrador | Redirige al dashboard de admin |
| 2 | Crear un nuevo periodo | Periodo visible en listado |
| 3 | Registrar un alumno | Alumno aparece en listado |
| 4 | Crear una inscripción | Inscripción registrada exitosamente |
| 5 | Consultar kardex | Historial académico visible |
| 6 | Generar reporte PDF | PDF descargable con formato institucional |
| 7 | Probar chatbot | Respuesta de Gemini |
| 8 | Cerrar sesión | Redirige a pantalla de login |

### 10.4 Probar acceso desde dispositivo móvil

1. Ejecute `start-lan.bat` en la raíz del proyecto (muestra la IP automáticamente).
2. Conecte su dispositivo móvil o tableta a la **misma red WiFi** que el servidor.
3. Abra el navegador del dispositivo y acceda a `http://<IP_DEL_SERVIDOR>:5173`.
4. Verifique que el login funcione correctamente.
5. El CORS del backend acepta IPs LAN (192.168.x.x, 10.x.x.x, 172.16-31.x.x).

### 10.5 Instalar como aplicación (PWA)

1. En **Chrome Android**: toque el menú (⋮) → "Agregar a pantalla de inicio".
2. En **Safari iPhone**: toque el botón de compartir (⬆) → "Agregar a pantalla de inicio".
3. La app se abrirá en modo standalone (sin barra de direcciones del navegador).
4. Para dispositivos **iOS/iPad**: La función "Agregar a pantalla de inicio" está en el menú de compartir de Safari.

### 10.6 Dispositivos compatibles

| Dispositivo | Sistema | Navegador | Notas |
|-------------|---------|-----------|-------|
| iPhone | iOS 15+ | Safari | PWA completa, safe-area support |
| iPad | iPadOS 15+ | Safari | Layout responsive optimizado |
| Samsung Galaxy | Android 12+ | Chrome | PWA completa |
| Tablet Android | Android 10+ | Chrome | PWA completa |
| MacBook | macOS | Chrome/Safari | Acceso web normal |
| Laptop Windows | Windows 10+ | Chrome/Edge | Acceso web normal |

---

## 11. Despliegue en Producción

### 11.1 Compilar frontend para producción

```bash
cd frontend
npm run build
# Los archivos estáticos se generan en frontend/dist/
```

### 11.2 Configurar servidor web (Nginx)

```nginx
server {
    listen 80;
    server_name sivacad.tesi.edu.mx;

    # Frontend estático
    root /var/www/sivacad/frontend/dist;
    index index.html;

    # Redirigir peticiones API al backend
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # SPA: redirigir todas las rutas no-API al index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 11.3 Configurar backend para producción

```env
# En backend/.env (producción)
PORT=3000
FRONTEND_URL=https://sivacad.tesi.edu.mx
NODE_ENV=production
```

### 11.4 Usar PM2 para gestión de procesos

```bash
npm install -g pm2

# Iniciar backend con configuración ecosystem.config.js
cd backend
pm2 start ecosystem.config.js

# Guardar configuración
pm2 save
pm2 startup
```

El archivo `ecosystem.config.js` incluye:
- Configuración de memoria (512MB para backend, 256MB para ML).
- Reinicio automático en caso de caída.
- Logs separados para cada proceso.
- Variables de entorno de producción.

### 11.5 Configurar SSL/TLS (HTTPS)

```bash
# Con Certbot (Let's Encrypt)
sudo certbot --nginx -d sivacad.tesi.edu.mx
```

---

## 12. Solución de Problemas Comunes

### 12.1 Error: "ECONNREFUSED" al conectar a MySQL

**Causa:** MySQL no está corriendo o las credenciales son incorrectas.

**Solución:**
```bash
# Verificar que MySQL está corriendo
sudo systemctl status mysql  # Linux
# o: net start MySQL  # Windows

# Verificar credenciales en .env
# DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
```

### 12.2 Error: "Module not found" en backend

**Causa:** Faltan dependencias de npm.

**Solución:**
```bash
cd backend
npm install
```

### 12.3 Error: "CORS" al hacer peticiones desde móvil

**Causa:** La IP del dispositivo no está en la lista blanca de CORS.

**Solución:** Verifique que la IP del dispositivo esté en el rango LAN:
- 192.168.x.x
- 10.x.x.x
- 172.16.x.x – 172.31.x.x

### 12.4 Error: "Gemini API Key not found"

**Causa:** `GEMINI_API_KEY` no está configurada en `.env`.

**Solución:** Obtenga una API Key en https://ai.google.dev/ y agréguela al archivo `.env`.

### 12.5 Error: "PHP not found"

**Causa:** PHP no está instalado o no está en el PATH.

**Solución:**
```bash
# Verificar instalación
php -v

# En Windows, agregar PHP al PATH del sistema
```

### 12.6 Error: "Port already in use"

**Causa:** Otro proceso está usando el puerto.

**Solución:**
```bash
# Linux/Mac
lsof -i :3000
kill -9 <PID>

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### 12.7 Error: Build de frontend falla

**Causa:** Problema con dependencias o sintaxis.

**Solución:**
```bash
cd frontend
rm -rf node_modules
npm install
npm run build
```

---

## 13. Configuración de Backup Automatizado

### 13.1 Script de backup incluido

SIVACAD incluye un script de backup automático en `backend/scripts/backup.sh`:

```bash
# Ejecutar backup manualmente
bash backend/scripts/backup.sh
```

El script:
- Crea un dump comprimido de la base de datos `sivacad_isc`.
- Lo guarda en `backend/backups/` con nombre `sivacad_isc_YYYYMMDD_HHMMSS.sql.gz`.
- Elimina backups con más de 30 días de antigüedad automáticamente.

### 13.2 Programar backup con CRON (Linux/Mac)

```bash
# Editar crontab
crontab -e

# Agregar línea para backup diario a las 2:00 AM
0 2 * * * /bin/bash /ruta/a/SIVACAD-ISC/backend/scripts/backup.sh >> /var/log/sivacad_backup.log 2>&1
```

### 13.3 Programar backup en Windows (Tarea Programada)

```powershell
# Crear tarea programada para ejecutar backup diariamente
schtasks /create /tn "SIVACAD-Backup" /tr "bash C:\Xampp\htdocs\SIVACAD-ISC\backend\scripts\backup.sh" /sc daily /st 02:00
```

### 13.4 Restaurar desde backup

```bash
# Descomprimir el archivo
gunzip backups/sivacad_isc_20260909_020000.sql.gz

# Restaurar en MySQL
mysql -u root -p sivacad_isc < backups/sivacad_isc_20260909_020000.sql
```

### 13.5 Verificar backups existentes

```bash
# Listar backups con tamaño y fecha
ls -lh backend/backups/

# Contar backups
ls backend/backups/*.sql.gz 2>/dev/null | wc -l
```

### 13.6 Migraciones SQL Nuevas (v3.0)

Las siguientes migraciones se agregaron en la versión 3.0:

| Archivo | Propósito | Tablas afectadas |
|---------|-----------|------------------|
| `008_alumno_info_medica_laboral.sql` | Tablas de información personal del alumno | `informacion_medica`, `informacion_laboral`, `documentos_sensibles` |

**Ejecución de migraciones:**

```bash
# Ejecutar la migración
"C:/xampp/mysql/bin/mysql.exe" -u root sivacad_isc < database/008_alumno_info_medica_laboral.sql

# Verificar tablas creadas
"C:/xampp/mysql/bin/mysql.exe" -u root -e "SHOW TABLES FROM sivacad_isc LIKE 'informacion_%';"
"C:/xampp/mysql/bin/mysql.exe" -u root -e "SHOW TABLES FROM sivacad_isc LIKE 'documentos_%';"
```

**Tablas nuevas (v3.0):**

| Tabla | Descripción | Constraint principal |
|-------|-------------|---------------------|
| `informacion_medica` | Tipo de sangre, alergias, medicamentos, info psicológica | `uk_medico_alumno (id_alumno, id_institucion)` |
| `informacion_laboral` | Empresa, puesto, teléfono, horario laboral | `uk_laboral_alumno (id_alumno, id_institucion)` |
| `documentos_sensibles` | Archivos subidos por el alumno (PDF, imágenes, docs) | FK a `alumnos` |

**Rutas backend nuevas (v3.0):**

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/alumno-info-medica` | GET | Obtener información médica |
| `/api/alumno-info-medica` | PUT | Crear/actualizar información médica |
| `/api/alumno-info-laboral` | GET | Obtener información laboral |
| `/api/alumno-info-laboral` | PUT | Crear/actualizar información laboral |
| `/api/alumno-documentos` | GET | Listar documentos del alumno |
| `/api/alumno-documentos` | POST | Subir documento (multipart/form-data) |
| `/api/alumno-documentos/:id` | DELETE | Eliminar documento |

**Notas importantes:**
- Todas las rutas nuevas requieren rol `ALUMNO` (bloqueo RBAC).
- Las uploads se almacenan en `uploads/sensibles/`.
- Se valida tipo de archivo (PDF, JPG, PNG, DOC, DOCX) y tamaño máximo (10MB).
- Todas las operaciones generan registros de auditoría.

---

*Fin del Manual de Instalación y Despliegue — SIVACAD v3.0*
