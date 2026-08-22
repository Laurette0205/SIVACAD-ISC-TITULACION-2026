const mysql = require('mysql2/promise');
require('dotenv').config();
module.exports = mysql.createPool({
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
