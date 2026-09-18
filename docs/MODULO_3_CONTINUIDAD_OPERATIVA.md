# MÓDULO 3 — CONTINUIDAD OPERATIVA Y CONECTIVIDAD

**SIVACAD-ISC — Septiembre 2026**

---

## 1. AUDITORÍA DE ARQUITECTURA ACTUAL

### 1.1 Stack Tecnológico

| Componente | Tecnología | Puerto | Dependencia Internet |
|---|---|---|---|
| Frontend | React 18 + Vite | 5173 (dev) | Sí (primera carga) |
| Backend | Node.js + Express 4 | 3000 | No |
| Base de datos | MySQL 8 (XAMPP) | 3306 | No |
| Service Worker | Cache API + IndexedDB | — | No |
| IA | Google Gemini API | Externo | Sí |
| PDF/Excel | PHP | 80 | No |
| Storage | /uploads (disco local) | — | No |

### 1.2 Infraestructura Actual

```
┌─────────────────────────────────────────────────┐
│                    INTERNET                       │
└──────────────────────┬──────────────────────────┘
                       │
              ┌────────┴────────┐
              │   Router/WAN    │
              │  (1 conexión)   │
              └────────┬────────┘
                       │
              ┌────────┴────────┐
              │  Switch LAN     │
              │  192.168.x.x    │
              └────────┬────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
    ┌────┴────┐  ┌────┴────┐  ┌────┴────┐
    │ Servidor│  │PC Admin │  │PC Alumno│
    │ XAMPP   │  │         │  │         │
    │ :3000   │  │         │  │         │
    │ :3306   │  │         │  │         │
    └─────────┘  └─────────┘  └─────────┘
```

### 1.3 Componentes Existentes

| Componente | Estado | Archivo |
|---|---|---|
| Service Worker | ✅ Registrado | `frontend/public/sw.js` |
| IndexedDB | ✅ 5 stores | `frontend/src/services/offlineDB.js` |
| Cola offline frontend | ✅ Implementada | `frontend/src/services/offlineQueue.js` |
| Cola offline backend | ✅ Implementada | `backend/src/services/offlineSync.js` |
| Hook online/offline | ✅ Implementado | `frontend/src/hooks/useOnlineStatus.js` |
| Banner offline | ✅ Implementado | `frontend/src/components/OfflineBanner.jsx` |
| Health check | ✅ Endpoint `/api/health` | `backend/src/app.js` |
| Graceful shutdown | ✅ SIGTERM/SIGINT | `backend/src/server.js` |
| CORS LAN | ✅ Patrones RFC1918 | `backend/src/app.js` |
| Pool connections | ✅ 20 conexiones | `backend/src/config/db.js` |

---

## 2. ANÁLISIS: QUÉ FUNCIONA SIN INTERNET

### 2.1 Backend (servidor local)

| Función | Sin Internet | Notas |
|---|---|---|
| Express sirve rutas | ✅ | Solo necesita电力 |
| MySQL responde queries | ✅ | Base de datos local |
| Autenticación JWT | ✅ | Clave local |
| RBAC / permisos | ✅ | Tablas locales |
| CRUD inscripciones | ✅ | Tablas locales |
| CRUD contactos emergencia | ✅ | Tablas locales |
| Break-glass access | ✅ | Tablas locales |
| Auditoría | ✅ | Tabla local |
| Health check | ✅ | Endpoint local |
| Gemini AI | ❌ | Requiere internet |
| Correo electrónico | ❌ | Requiere internet |
| Actualizaciones npm | ❌ | Requiere internet |

### 2.2 Frontend (navegador)

| Función | Sin Internet | Notas |
|---|---|---|
| Páginas cacheadas (SW) | ✅ | Primera carga requiere internet |
| Datos en IndexedDB | ✅ | Borradores, archivos, cola |
| Navegación SPA | ✅ | Si el SW cachó los assets |
| Formularios offline | ✅ | Se guardan en cola |
| Lectura de datos cacheados | ✅ | TTL limitado |
| Login | ❌ | Requiere backend |
| APIs dinámicas | ❌ | Requiere backend |
| Gemini AI | ❌ | Requiere internet |

### 2.3 Capacidad por Rol sin Internet

| Rol | Puede hacer | No puede hacer |
|---|---|---|
| **ALUMNO** | Ver datos cacheados, llenar formularios (offline), ver contactos emergencia (cache), ver kardex (cache) | Login, subir archivos, inscribirse, enviar trámites, chatbot |
| **DOCENTE** | Ver datos cacheados, ver kardex (cache) | Login, calificar, chatbot, predicción deserción |
| **COORDINADOR** | Ver datos cacheados | Login, aprobar inscripciones, ver reportes |
| **ADMINISTRADOR** | Ver datos cacheados | Login, gestionar usuarios, ver monitoreo |
| **SOPORTE** | Ver datos cacheados | Login, gestionar tickets |

---

## 3. DISEÑO DE 4 CAPAS DE CONECTIVIDAD

### CAPA 1: Internet Principal (WAN primaria)

```
Proveedor ISP → Router → Switch LAN → Servidor
```

- **Uso**: Acceso completo a todas las funcionalidades
- **Ancho de banda**: según contrato institucional
- **Failover**: Si falla, se activa Capa 2
- **DNS**: ISP o Google (8.8.8.8)

### CAPA 2: Internet Secundario (Backup)

```
Proveedor ISP secundario → Router backup → Switch LAN → Servidor
```

- **Uso**: Mismo acceso que Capa 1
- **Activación**: Automática (failover) o manual
- **Recomendación**: Mismo ISP o diferente para redundancia
- **Costo**: Mínimo (solo datos de respaldo)

### CAPA 3: Red LAN Institucional

```
Servidor local (XAMPP) → Switch LAN → Navegadores
```

- **Uso**: Acceso completo al sistema SIN internet
- **URL**: `http://192.168.x.x:3000` (IP del servidor)
- **Servicios disponibles**:
  - Backend Express (API completa)
  - MySQL (base de datos completa)
  - Frontend servido por Vite/Express
  - PDF/Excel generation (PHP)
  - Todas las operaciones CRUD
  - Autenticación y RBAC
  - Auditoría
- **Limitaciones**:
  - Gemini AI no disponible
  - Correo no disponible
  - Navegadores remotos no accesibles

### CAPA 4: Modo Offline (Cliente)

```
Navegador → Service Worker → IndexedDB → Cola de sync
```

- **Uso**: Operaciones limitadas sin servidor
- **Almacenamiento**: IndexedDB (~5 stores, ~857KB)
- **Duración**: Mientras el navegador mantenga los datos
- **Sincronización**: Automática al reconectar
- **Operaciones disponibles**:
  - Ver datos cacheados (TTL 10 min)
  - Llenar formularios (offline)
  - Subir archivos a cola (base64)
  - Ver contactos de emergencia (cache)

---

## 4. CONECTIVIDAD SATELITAL

### 4.1 Análisis como Enlace Secundario

| Proveedor | Latencia | Ancho de banda | Costo aprox. |
|---|---|---|---|
| Starlink Business | 20-40ms | 150-300 Mbps | $1,100 MXN/mes |
| Starlink Standard | 25-60ms | 50-150 Mbps | $600 MXN/mes |
| HughesNet | 600-800ms | 25-50 Mbps | $500 MXN/mes |
| Viasat | 600-800ms | 25-100 Mbps | $600 MXN/mes |

### 4.2 Limitaciones de Satélite

| Problema | Impacto | Mitigación |
|---|---|---|
| Latencia alta (600ms+) | APIs lentas, timeouts | Timeouts extendidos, retry |
| Degradación con clima | Velocidad variable | Capa 3 LAN como fallback |
| No resuelve caída de servidor | Backend inaccesible | Servidor local siempre activo |
| No resuelve falla eléctrica | Todo apagado | UPS / generador |
| No resuelve caída de LAN | Dispositivos sin red | Switch backup, WiFi |
| No resuelve error de DNS | No resuelve nombres | DNS local (Pi-hole) |
| No resuelve error de aplicación | Bugs en código | Testing, monitoreo |

### 4.3 Failover de Red (Diseño)

```
                    ┌──────────────┐
                    │   MONITOR    │
                    │   (health    │
                    │    check)    │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         ┌────┴────┐ ┌────┴────┐ ┌────┴────┐
         │  WAN 1  │ │  WAN 2  │ │SATÉLITE │
         │ (prim.) │ │(secund.)│ │(backup) │
         └────┬────┘ └────┬────┘ └────┬────┘
              │            │            │
              └────────────┼────────────┘
                           │
                    ┌──────┴───────┐
                    │  Router con  │
                    │  failover    │
                    │  automático  │
                    └──────┬───────┘
                           │
                    ┌──────┴───────┐
                    │  Switch LAN  │
                    └──────────────┘
```

**Mecanismo de failover:**
1. Router monitorea conectividad WAN1 (ping a 8.8.8.8)
2. Si WAN1 falla > 30s → activa WAN2 automáticamente
3. Si WAN2 falla → activa satélite (si disponible)
4. Si todas fallan → LAN sigue funcionando (Capa 3)
5. Health check del backend reporta estado de RED

---

## 5. DEFINICIONES DE CONTINUIDAD

### 5.1 RPO (Recovery Point Objective)

> **¿Cuánto datos podemos perder como máximo?**

| Escenario | RPO | Estrategia |
|---|---|---|
| Caída de MySQL | 24 horas | Backup diario a las 02:00 |
| Caída del servidor | 24 horas | Backup + replicación |
| Pérdida de disco | 24 horas | Backup offsite |
| Error humano | 0 (ninguno) | Auditoría + rollback manual |
| Cola offline | 0 (ninguno) | Sync automático al reconectar |

### 5.2 RTO (Recovery Time Objective)

> **¿Cuánto tiempo máximo de inactividad aceptamos?**

| Escenario | RTO | Estrategia |
|---|---|---|
| Caída de MySQL | 5 minutos | Restart automático + pool |
| Caída de Express | 2 minutos | PM2 restart + health check |
| Caída del servidor | 30 minutos | Restore desde backup |
| Caída de red | 0 (offline) | Capa 4 mantiene al alumno |
| Caída de disco | 1 hora | Restore + verificación |

### 5.3 Backup

| Tipo | Frecuencia | Retención | Ubicación |
|---|---|---|---|
| MySQL dump completo | Diario 02:00 | 30 días | `/backups/` |
| MySQL dump incremental | Cada 6 horas | 7 días | `/backups/incremental/` |
| Archivos /uploads | Diario | 30 días | `/backups/uploads/` |
| Configuración .env | Al cambiar | Permanente | Git (privado) |
| Frontend build | Al deploy | 5 versiones | `/backups/frontend/` |

### 5.4 Restore

```bash
# Restore completo de MySQL
C:\xampp\mysql\bin\mysql.exe -u root sivacad_isc < backups/pre-migracion-YYYYMMDD_HHMMSS/full_dump.sql

# Restore incremental
C:\xampp\mysql\bin\mysql.exe -u root sivacad_isc < backups/incremental/dump_YYYYMMDD_HH.sql

# Restore de archivos
xcopy /E /Y backups\uploads\*.* backend\uploads\
```

### 5.5 Monitoreo

| Métrica | Endpoint | Frecuencia | Alerta |
|---|---|---|---|
| Health check | `GET /api/health` | Cada 30s | Si status != 'up' |
| Ping ligero | `GET /api/health/ping` | Cada 5s | Si falla > 3 intentos |
| Memoria | `GET /api/health` → checks.memory | Cada 30s | Si heap > 512MB |
| Pool DB | `GET /api/health` → checks.pool | Cada 30s | Si active > 18 |
| Cola offline | `GET /api/health` → checks.offlineSync | Cada 60s | Si pending > 50 |
| Sesiones emergencia | `GET /api/health` → checks.emergencySessions | Cada 60s | Si active > 5 |

### 5.6 Health Checks

```
GET /api/health/ping     → { ok: true, ts: ... }         (ligero, sin DB)
GET /api/health           → { ok, status, checks, ... }   (profundo, con DB)
```

**Checks incluidos:**
- Database: latencia de query `SELECT 1`
- Pool: conexiones activas/idle/waiting
- Memory: RSS, heap, heapTotal
- Gemini API: configurado/no
- Uptime: segundos desde start
- Offline sync: eventos pendientes
- Emergency sessions: sesiones activas

### 5.7 Failover

| Nivel | Mecanismo | Tiempo |
|---|---|---|
| App → DB | Pool reconnect (enableKeepAlive) | < 5s |
| Express crash | PM2 / nodemon restart | < 10s |
| WAN1 → WAN2 | Router failover automático | 30-60s |
| WAN → Satélite | Router manual/auto | 1-5 min |
| Servidor → Backup | Restore manual | 30-60 min |

### 5.8 Reintentos

| Componente | Max retries | Backoff | Strategy |
|---|---|---|---|
| Cola offline frontend | 5 | Exponencial (1s, 2s, 4s, 8s, 16s) | Reintento con estado |
| Backend pool | ∞ | 0 (keepAlive) | Reconexión automática |
| API fetch (frontend) | 3 | 1s, 2s | Retry en capa de presentación |
| Break-glass verify | 1 | Inmediato | Sin retry (seguridad) |

### 5.9 Offline Queue

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Usuario      │────▶│  IndexedDB   │────▶│  Sync Queue  │
│  envía form   │     │  (offline)   │     │  (pendiente) │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                          ┌───────┴───────┐
                                          │  Reconexión    │
                                          │  detectada     │
                                          └───────┬───────┘
                                                  │
                                          ┌───────┴───────┐
                                          │  POST /api/    │
                                          │  sync/upload   │
                                          └───────┬───────┘
                                                  │
                                          ┌───────┴───────┐
                                          │  ¿OK?         │
                                          │  SÍ → eliminar │
                                          │  NO → retry   │
                                          └───────────────┘
```

### 5.10 Sincronización

**Flujo completo:**
1. Usuario realiza acción offline → se guarda en IndexedDB
2. Se genera `idempotencyKey` único por item
3. Al reconectar → `syncPendingItems()` procesa la cola
4. Cada item se envía al servidor con `X-Idempotency-Key`
5. Servidor verifica si ya procesó esa key (deduplicación)
6. Si OK → se elimina de la cola
7. Si falla → retry con backoff exponencial
8. Si falla 5 veces → estado `ERROR`, usuario notificado

---

## 6. CAPACIDADES POR ROL SIN INTERNET

### ALUMNO (Modo Offline - Capa 4)

| Operación | Estado | Cómo |
|---|---|---|
| Ver perfil | ✅ Cache | IndexedDB TTL 10min |
| Ver contactos emergencia | ✅ Cache | IndexedDB TTL 10min |
| Ver kardex | ✅ Cache | IndexedDB TTL 10min |
| Llenar formulario inscripción | ✅ Cola | Se envía al reconectar |
| Llenar formulario reinscripción | ✅ Cola | Se envía al reconectar |
| Subir documento | ✅ Cola | Base64 en IndexedDB |
| Ver información médica | ✅ Cache | IndexedDB TTL 10min |
| Enviar solicitud trámite | ✅ Cola | Se envía al reconectar |
| Login | ❌ | Requiere backend |
| Chatbot IA | ❌ | Requiere Gemini API |
| Compartir ubicación | ❌ | Requiere backend |

### DOCENTE (Modo Offline - Capa 4)

| Operación | Estado | Cómo |
|---|---|---|
| Ver dashboard | ✅ Cache | IndexedDB TTL 10min |
| Ver kardex alumnos | ✅ Cache | IndexedDB TTL 10min |
| Calificar | ✅ Cola | Se envía al reconectar |
| Chatbot IA | ❌ | Requiere Gemini API |
| Predicción deserción | ❌ | Requiere Gemini API |

### COORDINADOR / ADMINISTRADOR (Capa 3 - LAN)

| Operación | Estado | Cómo |
|---|---|---|
| Todas las operaciones CRUD | ✅ | Backend local |
| Aprobar inscripciones | ✅ | Backend local |
| Gestionar usuarios | ✅ | Backend local |
| Ver reportes | ✅ | Backend local |
| Generar PDF/Excel | ✅ | PHP local |
| Break-glass access | ✅ | Backend local |
| Monitoreo sistema | ✅ | Backend local |
| Chatbot IA | ❌ | Requiere internet |
| Correo | ❌ | Requiere internet |

---

## 7. RECUPERACIÓN DE INFORMACIÓN Y SERVICIO

### 7.1 Detección de Duplicidad

| Mecanismo | Ubicación | Funcionamiento |
|---|---|---|
| `idempotencyKey` | Cola offline | Clave única por operación, el servidor la verifica |
| `hash SHA-256` | Archivos | Si el hash ya existe en pendingFiles, no se duplica |
| `id_usuario + matricula` | Inscripciones | El servidor rechaza si ya existe inscripción activa |
| `created_at` timestamp | Sync queue | Ordena por timestamp, procesa en orden |

### 7.2 Recuperación de Información

| Escenario | Recuperación | Tiempo estimado |
|---|---|---|
| Datos en IndexedDB | Se mantienen mientras el navegador exista | Inmediato |
| Cola offline no sincronizada | Se sincroniza al reconectar | < 1 min |
| Cola offline con ERROR | Usuario debe reenviar manualmente | Variable |
| MySQL corrupto | Restore desde backup | 5-30 min |
| Servidor caído | Restart + pool reconnect | < 1 min |
| Disco lleno | Limpiar /uploads + logs | 5-15 min |

### 7.3 Recuperación de Servicio

| Escenario | Procedimiento | RTO |
|---|---|---|
| Express no responde | `pm2 restart sivacad` o `node src/server.js` | < 10s |
| MySQL no responde | `net start mysql` o restart XAMPP | < 2 min |
| Puerto 3000 ocupado | `taskkill /PID <pid> /F` | < 1 min |
| DNS falla | Usar IP directa `192.168.x.x:3000` | Inmediato |
| WAN1 cae | Router failover a WAN2 | 30-60s |
| WAN completa cae | Acceso LAN local | Inmediato |
| Servidor destruido | Restore completo desde backup | 30-60 min |

---

## 8. VERIFICACIÓN DE IMPLEMENTACIÓN

### Checklist MÓDULO 3

- [x] Health check endpoint mejorado (`/api/health` + `/api/health/ping`)
- [x] Health check incluye: DB, pool, memory, uptime, offline sync, emergency sessions
- [x] Service Worker registrado y funcional
- [x] IndexedDB con 5 stores
- [x] Cola offline con deduplicación por idempotencyKey
- [x] Hook `useOnlineStatus` para detección de red
- [x] Hook `useHealthCheck` para monitoreo continuo
- [x] Banner offline con estado y sync
- [x] Página de monitoreo de conectividad para admins
- [x] CORS configurado para LAN (RFC1918)
- [x] Graceful shutdown con cierre de pool
- [x] Pool de conexiones con keepAlive
- [x] Documentación completa de 4 capas
- [x] Análisis de conectividad satelital
- [x] Definiciones RPO/RTO/backup/restore
- [x] Tabla de capacidades por rol sin internet
- [x] Flujo de recuperación documentado

---

## 9. RESPUESTAS A PREGUNTAS CLAVE

### ¿Qué puede hacer cada rol sin internet?

**ALUMNO**: Ver datos cacheados, llenar formularios (offline), ver contactos emergencia (cache). NO puede: login, subir archivos, inscribirse, chatbot.

**DOCENTE**: Ver datos cacheados, calificar (offline). NO puede: login, chatbot, predicción deserción.

**COORDINADOR/ADMIN**: Todo funciona por LAN (Capa 3). Solo falla: Gemini AI, correo.

### ¿Qué operaciones quedan pendientes?

Las que se encolaron en `syncQueue` (IndexedDB) con estado `PENDIENTE_SYNC`. Se sincronizan automáticamente al reconectar.

### ¿Cómo se sincronizan?

`syncPendingItems()` en `offlineQueue.js` procesa la cola, enviando cada item al servidor con `X-Idempotency-Key`. El servidor verifica duplicidad.

### ¿Cómo se detecta duplicidad?

- `idempotencyKey` por operación
- `hash SHA-256` por archivo
- Validación en BD (inscripción activa, etc.)

### ¿Cómo se recupera información?

- IndexedDB: se mantiene en el navegador
- MySQL: restore desde backup diario
- Archivos: restore desde backup de `/uploads/`

### ¿Cómo se recupera el servicio?

- Express: restart con PM2
- MySQL: restart con XAMPP
- WAN: failover automático a WAN2/satélite
- LAN: siempre disponible (Capa 3)
