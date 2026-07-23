# Manual de Mantenimiento y Soporte — SIVACAD

**Sistema de Valoración y Calificación del Desempeño de Docentes y Alumnos**

**Autoras:** Bárcenas González Laura Casandra & Morales Ibarra Sandivel  
**Institución:** TESI Ixtapaluca — Ingeniería en Sistemas Computacionales  
**Versión:** 1.0 — Julio 2026

---

## Índice

1. [Introducción](#1-introducción)
2. [Arquitectura de Logs](#2-arquitectura-de-logs)
3. [Validación de Rutas y Endpoints](#3-validación-de-rutas-y-endpoints)
4. [Revisión de Sesiones](#4-revisión-de-sesiones)
5. [Recuperación de Acceso](#5-recuperación-de-acceso)
6. [Solución a Fallas Comunes](#6-solución-a-fallas-comunes)
7. [Verificación de Exportaciones](#7-verificación-de-exportaciones)
8. [Diagnóstico General del Sistema](#8-diagnóstico-general-del-sistema)
9. [Mantenimiento Preventivo](#9-mantenimiento-preventivo)
10. [Procedimientos de Recuperación](#10-procedimientos-de-recuperación)

---

## 1. Introducción

Este manual describe los procedimientos de mantenimiento y soporte técnico para el Sistema de Valoración y Calificación del Desempeño de Docentes y Alumnos (SIVACAD). Está dirigido al personal de soporte técnico y a las desarrolladoras del sistema responsables de atender incidencias, diagnosticar fallas y garantizar la estabilidad operativa de la plataforma.

---

## 2. Arquitectura de Logs

### 2.1 Logs del Backend (Node.js)

El servidor Express utiliza Morgan para logging de peticiones HTTP:

```javascript
// app.js
app.use(morgan('combined'));
```

Los logs incluyen:

```
::1 - - [23/Jul/2026:10:30:45 +0000] "GET /api/alumnos HTTP/1.1" 200 4562
::1 - - [23/Jul/2026:10:31:02 +0000] "POST /api/auth/login HTTP/1.1" 401 45
```

**Ubicación:** Los logs se imprimen en la consola del servidor. En producción, se pueden redirigir a un archivo:

```bash
node src/server.js > logs/backend.log 2>&1
```

### 2.2 Logs de la Base de Datos (MySQL)

Para habilitar logs de consultas lentas:

```sql
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2;  -- segundos
```

**Ubicación:** `C:\ProgramData\MySQL\MySQL Server 8.0\Data\hostname-slow.log` (Windows) o `/var/log/mysql/mysql-slow.log` (Linux).

### 2.3 Logs de Flask ML (Python)

Flask imprime logs en la consola. Para redirigir:

```bash
python app.py > logs/flask.log 2>&1
```

### 2.4 Logs de PHP

Los errores de PHP se registran en el log de errores de PHP:

```ini
; php.ini
error_log = C:\xampp\php\logs\php_error_log
```

### 2.5 Logs de Auditoría del Sistema

La tabla `bitacora_auditoria` registra automáticamente:

| Campo               | Descripción                                    |
|---------------------|------------------------------------------------|
| `id_bitacora`       | Identificador único                            |
| `id_usuario`        | Usuario que realizó la acción                  |
| `accion`            | Tipo: INSERT, UPDATE, DELETE, LOGIN, LOGOUT    |
| `tabla`             | Tabla afectada                                 |
| `id_registro`       | ID del registro afectado                       |
| `valores_anteriores`| JSON con valores previos (en modificaciones)   |
| `valores_nuevos`    | JSON con valores nuevos                        |
| `ip_origen`         | Dirección IP desde donde se realizó la acción  |
| `fecha_hora`        | Marca de tiempo                                |

**Consulta de ejemplo:**

```sql
SELECT * FROM bitacora_auditoria 
WHERE id_usuario = 1 
AND fecha_hora >= NOW() - INTERVAL 7 DAY 
ORDER BY fecha_hora DESC;
```

---

## 3. Validación de Rutas y Endpoints

### 3.1 Verificar rutas montadas

El backend mountea rutas dinámicamente. Para ver qué rutas están activas:

```bash
# Desde la terminal del backend
node -e "
const app = require('./src/app');
console.log('Rutas registradas:');
app._router.stack.forEach(r => {
  if (r.route) console.log(r.route.path);
  else if (r.name === 'router') {
    r.handle.stack.forEach(rr => {
      if (rr.route) console.log(rr.route.path);
    });
  }
});
"
```

### 3.2 Probar endpoint individual

```bash
# Probar login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"correo":"admin@tesi.edu.mx","contrasena":"Testing123!"}'

# Probar endpoint protegido (reemplazar TOKEN)
curl http://localhost:3000/api/alumnos \
  -H "Authorization: Bearer TOKEN_AQUI"
```

### 3.3 Verificar conectividad con Flask ML

```bash
curl http://localhost:5001/health
# Respuesta esperada: {"status": "ok", "modelos": ["desercion"]}
```

### 3.4 Verificar conectividad con PHP CLI

```bash
cd backend/php-kardex
php test_pdf.php
# Debe generar un PDF de prueba sin errores
```

---

## 4. Revisión de Sesiones

### 4.1 Sesiones activas en el sistema

```sql
-- Consultar sesiones activas
SELECT u.nombres, u.apellidos, r.nombre_rol, s.fecha_inicio, s.ultima_actividad, s.ip_origen, s.estado
FROM sesiones_activas s
JOIN usuarios u ON s.id_usuario = u.id_usuario
JOIN roles r ON u.id_rol = r.id_rol
WHERE s.estado = 'activa'
ORDER BY s.ultima_actividad DESC;
```

### 4.2 Cerrar sesión forzadamente

Si un usuario reporta problemas de sesión o se sospecha de acceso no autorizado:

```sql
-- Marcar sesión como expirada
UPDATE sesiones_activas 
SET estado = 'expirada', fecha_fin = NOW() 
WHERE id_sesion = ?;
```

O desde el panel de administración: **Auditoría → Sesiones Activas → Cerrar Sesión**.

### 4.3 Limpiar sesiones expiradas

Ejecutar periódicamente (puede ser un CRON):

```sql
DELETE FROM sesiones_activas 
WHERE estado = 'expirada' 
AND fecha_fin < NOW() - INTERVAL 30 DAY;
```

---

## 5. Recuperación de Acceso

### 5.1 Usuario olvidó su contraseña

El usuario debe usar la opción **¿Olvidaste tu contraseña?** en la pantalla de login. Si el correo SMTP no está configurado:

**Opción 1:** Usar modo desarrollo (el sistema muestra el enlace en la respuesta):
```json
{ "ok": true, "devMode": true, "resetUrl": "http://localhost:5173/reset-password/TOKEN" }
```

**Opción 2:** Restablecer directamente en BD:
```sql
-- Generar hash de nueva contraseña (ejemplo: "NuevaPass123!")
-- El hash debe generarse con bcrypt, no directamente en SQL
-- Use el script reset_password.js
```

### 5.2 Token JWT expirado

El token JWT expira según `JWT_EXPIRES_IN` (default: 24h). El usuario debe iniciar sesión nuevamente. Si el problema persiste:

1. Verifique que la fecha/hora del servidor sea correcta.
2. Verifique que `JWT_SECRET` en `.env` no haya cambiado.
3. Si cambió el `JWT_SECRET`, todos los tokens existentes serán inválidos.

### 5.3 Cuenta bloqueada / desactivada

1. El administrador debe ir a **Usuarios**, localizar al usuario y cambiar su estado a **Activo**.
2. Si no hay administradores activos, restaure desde la BD:
   ```sql
   UPDATE usuarios SET estado = 'Activo' WHERE correo_institucional = 'admin@tesi.edu.mx';
   ```

---

## 6. Solución a Fallas Comunes

### 6.1 Error 401 en cada petición

**Síntoma:** El usuario inicia sesión correctamente pero recibe 401 en todas las peticiones.

**Causa probable:** token undefined en el frontend.

**Diagnóstico:**
1. Abra las herramientas de desarrollador del navegador (F12).
2. Vaya a **Application → Local Storage**.
3. Verifique que exista la clave `token`.
4. Si no existe, el usuario debe cerrar sesión y volver a iniciar.

**Solución:** En `AuthContext.jsx`, el token se guarda como variable separada del objeto user:
```javascript
// Correcto
localStorage.setItem('token', token);
localStorage.setItem('user', JSON.stringify(usuario));
```

### 6.2 Error 404 en una ruta

**Síntoma:** Al navegar a una sección, aparece "404 Not Found".

**Diagnóstico:**
1. Verifique que el archivo de ruta exista en `backend/src/routes/`.
2. Verifique que `mountIfAvailable` en `routes/index.js` incluya la ruta.
3. Verifique que el frontend tenga la ruta configurada en `App.jsx`.

**Solución:**
```javascript
// En backend/src/routes/index.js
mountIfAvailable('/alumnos', './alumnos');
```

### 6.3 Error 500 en el servidor

**Síntoma:** El servidor responde con error 500 sin mensaje claro.

**Diagnóstico:**
1. Revise la consola del backend donde se ejecuta `npm run dev`.
2. Busque errores de JavaScript (stack trace).
3. Revise que la BD esté conectada.

**Causas comunes:**
- Error de sintaxis en JavaScript.
- Consulta SQL mal formada.
- Variable de entorno faltante.
- Puerto ocupado.

### 6.4 El chatbot no responde

**Síntoma:** El chatbot responde con error o no responde.

**Diagnóstico:**
1. Verifique que `GEMINI_API_KEY` esté configurada.
2. Verifique conectividad con la API de Google.
3. Revise los logs del backend en busca de errores de Gemini.

**Solución temporal:** Si la API de Gemini no está disponible, el sistema debe tener un fallback con respuestas predefinidas.

### 6.5 La predicción de deserción falla

**Síntoma:** Error al ejecutar predicción de deserción.

**Diagnóstico:**
1. Verifique que Flask ML esté corriendo: `curl http://localhost:5001/health`.
2. Verifique que `FLASK_ML_URL` esté correcta en `.env`.
3. Revise los logs de Flask ML.

**Solución:**
```bash
# Reiniciar Flask ML
cd backend/ml
venv\Scripts\activate  # Windows
python app.py
```

### 6.6 Error al generar PDF/Excel

**Síntoma:** La descarga de reportes falla o genera archivo corrupto.

**Diagnóstico:**
1. Verifique que PHP esté instalado: `php -v`.
2. Verifique que las dependencias PHP estén instaladas: `composer install`.
3. Revise los permisos de escritura en `backend/php-kardex/`.

### 6.7 Error "No se puede conectar a la base de datos"

**Síntoma:** El backend no inicia y muestra error de conexión MySQL.

**Diagnóstico:**
1. Verifique que MySQL esté corriendo.
2. Verifique las credenciales en `.env`.
3. Pruebe la conexión manualmente:
   ```bash
   mysql -u root -p -e "SELECT 1"
   ```
4. Verifique que la base de datos `sivacad_isc` exista.

---

## 7. Verificación de Exportaciones

### 7.1 Verificar generación de PDF

```bash
# Probar exportación vía API
curl -X GET http://localhost:3000/api/reportes/pdf \
  -H "Authorization: Bearer TOKEN" \
  -o reporte_prueba.pdf

# Verificar que el archivo se descargó correctamente
ls -la reporte_prueba.pdf
```

### 7.2 Verificar generación de Excel

```bash
curl -X GET http://localhost:3000/api/reportes/excel \
  -H "Authorization: Bearer TOKEN" \
  -o reporte_prueba.xlsx

# Verificar que el archivo se descargó correctamente
ls -la reporte_prueba.xlsx
```

### 7.3 Verificar exportación de Kardex PDF

```bash
curl -X GET http://localhost:3000/api/kardex/alumno/1/pdf \
  -H "Authorization: Bearer TOKEN" \
  -o kardex_prueba.pdf
```

### 7.4 Verificar exportación de datos (Bienestar)

1. Inicie sesión como administrador.
2. Navegue a **Bienestar Admin**.
3. Seleccione **Exportar TXT** o **Exportar CSV**.
4. Verifique que el archivo descargado contenga datos y formato correctos.

---

## 8. Diagnóstico General del Sistema

### 8.1 Script de diagnóstico rápido

```bash
#!/bin/bash
# diagnostico.sh — Verificar estado del sistema SIVACAD

echo "=== SIVACAD - Diagnóstico del Sistema ==="
echo "Fecha: $(date)"
echo ""

# 1. Verificar Node.js
echo "[1] Node.js: $(node --version)"

# 2. Verificar MySQL
echo "[2] MySQL: $(mysql --version)"

# 3. Verificar Backend
echo "[3] Backend (puerto 3000):"
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/dashboard
echo ""

# 4. Verificar Frontend
echo "[4] Frontend (puerto 5173):"
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
echo ""

# 5. Verificar Flask ML
echo "[5] Flask ML (puerto 5001):"
curl -s http://localhost:5001/health
echo ""

# 6. Verificar PHP
echo "[6] PHP: $(php --version | head -1)"

# 7. Verificar espacio en disco
echo "[7] Disco:"
df -h / | tail -1

echo "=== Diagnóstico completado ==="
```

### 8.2 Puntos de verificación

| Componente     | Puerto | Comando de verificación                |
|----------------|--------|----------------------------------------|
| Backend        | 3000   | `curl http://localhost:3000/api/dashboard` |
| Frontend       | 5173   | `curl http://localhost:5173`            |
| Flask ML       | 5001   | `curl http://localhost:5001/health`     |
| MySQL          | 3306   | `mysql -u root -p -e "SELECT 1"`       |
| PHP            | CLI    | `php -v`                               |

### 8.3 Verificar integridad de la base de datos

```sql
-- Verificar tablas
SELECT table_name, table_rows, engine 
FROM information_schema.tables 
WHERE table_schema = 'sivacad_isc';

-- Verificar integridad referencial
SELECT 
  TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'sivacad_isc'
  AND REFERENCED_TABLE_NAME IS NOT NULL;
```

---

## 9. Mantenimiento Preventivo

### 9.1 Tareas diarias

- [ ] Revisar logs del backend en busca de errores.
- [ ] Verificar que los 3 servidores (backend, frontend, ML) estén funcionando.
- [ ] Revisar el dashboard de auditoría.
- [ ] Atender incidencias reportadas por usuarios.

### 9.2 Tareas semanales

- [ ] Respaldar la base de datos.
- [ ] Revisar la tabla `sesiones_activas` y limpiar sesiones expiradas.
- [ ] Verificar el espacio en disco.
- [ ] Revisar el rendimiento de consultas lentas en MySQL.

### 9.3 Tareas mensuales

- [ ] Actualizar dependencias npm (backend y frontend).
- [ ] Verificar que los modelos ML estén generando predicciones correctas.
- [ ] Revisar la integridad de la cadena de auditoría SHA-256.
- [ ] Realizar pruebas de carga ligeras.
- [ ] Actualizar este manual si se agregaron nuevos módulos.

### 9.4 Comandos de mantenimiento

```bash
# Respaldar base de datos
mysqldump -u root -p sivacad_isc > backups/sivacad_isc_$(date +%Y%m%d).sql

# Limpiar archivos temporales
find backend/uploads/actas-ocr/ -type f -mtime +30 -delete
find backend/uploads/fotos/ -type f -mtime +365 -delete

# Actualizar dependencias backend
cd backend && npm update

# Actualizar dependencias frontend
cd frontend && npm update

# Verificar vulnerabilidades
cd backend && npm audit
cd frontend && npm audit
```

---

## 10. Procedimientos de Recuperación

### 10.1 Recuperación de base de datos

```bash
# Restaurar desde respaldo
mysql -u root -p sivacad_isc < backups/sivacad_isc_20260722.sql
```

### 10.2 Recuperación de archivos de uploads

Los archivos subidos (actas OCR, fotografías) se almacenan en `backend/uploads/`. Si se pierden:

1. Verifique si existe respaldo en almacenamiento externo.
2. Si no hay respaldo, los usuarios deberán subir los archivos nuevamente.
3. Los datos de la BD (rutas de archivos) se conservan aunque los archivos físicos falten.

### 10.3 Recuperación tras caída del servidor

1. Reiniciar servicios en orden:
   ```bash
   # 1. MySQL
   sudo systemctl start mysql  # Linux
   # o: net start MySQL  # Windows
   
   # 2. Backend
   cd backend && npm run dev
   
   # 3. Frontend (si es desarrollo)
   cd frontend && npm run dev
   
   # 4. Flask ML
   cd backend/ml && python app.py
   ```

2. Verificar que todos los servicios respondan.
3. Ejecutar script de diagnóstico.
4. Notificar a los usuarios que el sistema está operativo.

### 10.4 Recuperación de acceso de administrador

Si no hay ningún administrador con acceso al sistema:

```sql
-- 1. Conectar a MySQL como root
mysql -u root -p

-- 2. Buscar usuarios administradores
SELECT id_usuario, nombres, correo_institucional, estado FROM usuarios WHERE id_rol = 1;

-- 3. Reactivar un administrador existente
UPDATE usuarios SET estado = 'Activo' WHERE id_rol = 1 LIMIT 1;

-- 4. Si no hay administradores, crear uno directamente
-- (requiere generar hash bcrypt primero)
-- Use el script reset_password.js o node -e "console.log(require('bcryptjs').hashSync('NuevaPass123!', 12))"
INSERT INTO usuarios (nombres, apellidos, correo_institucional, contrasena_hash, estado, id_rol)
VALUES ('Admin', 'Recuperado', 'admin@tesi.edu.mx', '$2a$12$...hash_aqui...', 'Activo', 1);
```

### 10.5 Rollback de una actualización

Si una actualización del sistema causa fallas:

```bash
# 1. Revertir cambios en el código
git log --oneline -5
git checkout <hash_del_commit_anterior>

# 2. Restaurar base de datos
mysql -u root -p sivacad_isc < backups/sivacad_isc_anterior.sql

# 3. Reiniciar servidores
# (ver sección 10.3)
```

---

*Fin del Manual de Mantenimiento y Soporte — SIVACAD v1.0*
