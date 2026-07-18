'use strict';

// backend/src/app.js

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const app = express();

app.set('trust proxy', 1);

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
  'http://localhost:8080'
].filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origen no permitido por CORS: ${origin}`), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Archivos públicos
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Rutas base
app.get('/', (req, res) => {
  res.json({
    ok: true,
    message: 'SIVACAD backend funcionando correctamente'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    status: 'up',
    service: 'sivacad-api',
    timestamp: new Date().toISOString()
  });
});

// Único punto de montaje de rutas
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
  console.error('❌ Error global:', err);
  res.status(err.status || 500).json({
    ok: false,
    message: err.message || 'Error interno del servidor'
  });
});

module.exports = app;