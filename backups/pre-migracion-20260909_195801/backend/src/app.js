'use strict';

// backend/src/app.js

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const compression = require('compression');

const { rateLimiter, xssSanitizer, securityHeaders, ipBlockCheck } = require('./middleware/seguridad');
const { auth } = require('./middleware/auth');
const pool = require('./config/db');

const app = express();

app.set('trust proxy', 1);

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  process.env.FRONTEND_URL_PROD,
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
  'http://localhost:8080'
].filter(Boolean);

const originRegexPatterns = process.env.CORS_ALLOW_PRIVATE_IPS !== 'false' ? [
  /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:\d+$/,
  /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/,
  /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}:\d+$/
] : [];

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (originRegexPatterns.some(re => re.test(origin))) return callback(null, true);
    return callback(new Error(`Origen no permitido por CORS: ${origin}`), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
};

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-site' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.GEMINI_API_URL || "https://generativelanguage.googleapis.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"]
    }
  }
}));
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ==============================
// SEGURIDAD GLOBAL
// ==============================
app.use(securityHeaders);
app.use(ipBlockCheck);
app.use(xssSanitizer);
app.use(rateLimiter({ windowMs: 15 * 60 * 1000, max: 200 }));

// Archivos estaticos con cache - requieren autenticacion
app.use('/uploads', auth, express.static(path.join(__dirname, '..', 'uploads'), {
  maxAge: '1d',
  etag: true
}));

// Rutas base
app.get('/', (req, res) => {
  res.json({
    ok: true,
    message: 'SIVACAD backend funcionando correctamente'
  });
});

// Health check profundo
app.get('/api/health', async (req, res) => {
  const health = {
    ok: true,
    status: 'up',
    service: 'sivacad-api',
    timestamp: new Date().toISOString(),
    checks: {}
  };

  // Database check
  try {
    const start = Date.now();
    await pool.execute('SELECT 1');
    health.checks.database = { status: 'ok', latency: Date.now() - start };
  } catch (err) {
    health.checks.database = { status: 'error', message: err.message };
    health.ok = false;
    health.status = 'degraded';
  }

  // Memory usage
  const mem = process.memoryUsage();
  health.checks.memory = {
    rss: Math.round(mem.rss / 1024 / 1024) + 'MB',
    heap: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + 'MB'
  };

  // Gemini API
  if (process.env.GEMINI_API_KEY) {
    health.checks.gemini = { status: 'configured' };
  }

  // Uptime
  health.uptime = Math.round(process.uptime()) + 's';

  const statusCode = health.ok ? 200 : 503;
  return res.status(statusCode).json(health);
});

// Unico punto de montaje de rutas
const routesIndex = require('./routes');
app.use('/api', routesIndex);

// 404
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
  });
});

// Manejo global de errores
app.use((err, req, res, next) => {
  console.error('Error global:', err);
  const isProd = process.env.NODE_ENV === 'production';
  return res.status(err.status || 500).json({
    ok: false,
    message: isProd ? 'Error interno del servidor' : (err.message || 'Error interno del servidor')
  });
});

module.exports = app;
