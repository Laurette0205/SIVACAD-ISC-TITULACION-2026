const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sivacad_isc',
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 50,
  connectTimeout: 10000,
  idleTimeout: 60000,
  charset: 'utf8mb4',
  timezone: '+00:00',
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

const DB_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EPIPE',
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
  'PROTOCOL_ENQUEUE_AFTER_QUIT',
  'PROTOCOL_SEQUENCE_TIMEOUT',
  'ER_CON_COUNT_ERROR',
  'ER_SERVER_SHUTDOWN',
  'ER_ACCESS_DENIED_ERROR',
  'ER_BAD_DB_ERROR'
]);

const DB_ERROR_PATTERNS = [
  /can'?t reach mysql server/i,
  /connect\s+econnrefused/i,
  /connection lost/i,
  /too many connections/i,
  /database.*not.*exist/i
];

function isDbConnectionError(err) {
  if (!err) return false;
  const code = String(err.code || '');
  const message = String(err.message || '');
  if (DB_ERROR_CODES.has(code)) return true;
  return DB_ERROR_PATTERNS.some((re) => re.test(message));
}

const DB_UNAVAILABLE_MESSAGE =
  'No se pudo conectar con la base de datos. Verifica que MySQL (XAMPP) este activo en el puerto 3306 y vuelve a intentarlo.';

pool.on('error', (err) => {
  console.error('[MySQL] Error en conexion inactiva del pool:', err && err.message);
});

module.exports = pool;
module.exports.isDbConnectionError = isDbConnectionError;
module.exports.DB_UNAVAILABLE_MESSAGE = DB_UNAVAILABLE_MESSAGE;
