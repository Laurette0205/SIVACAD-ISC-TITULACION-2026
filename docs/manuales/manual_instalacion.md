# Manual de Instalación y Despliegue — SIVACAD

**Sistema de Valoración y Calificación del Desempeño de Docentes y Alumnos**

**Autoras:** Bárcenas González Laura Casandra & Morales Ibarra Sandivel  
**Institución:** TESI Ixtapaluca — Ingeniería en Sistemas Computacionales  
**Versión:** 1.0 — Julio 2026

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

# JWT
JWT_SECRET=generar_un_secreto_aleatorio_seguro
JWT_EXPIRES_IN=24h

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

1. Conecte su dispositivo móvil a la misma red WiFi que el servidor.
2. Obtenga la IP local del servidor: `ipconfig` (Windows) o `ifconfig` (Linux/Mac).
3. Acceda desde el móvil: `http://<IP_DEL_SERVIDOR>:5173`.
4. El CORS del backend acepta IPs LAN (192.168.x.x, 10.x.x.x, 172.16-31.x.x).

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

# Iniciar backend
cd backend
pm2 start src/server.js --name sivacad-backend

# Iniciar ML
cd backend/ml
pm2 start app.py --interpreter python --name sivacad-ml

# Guardar configuración
pm2 save
pm2 startup
```

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

*Fin del Manual de Instalación y Despliegue — SIVACAD v1.0*
