'use strict';

// ==============================
// ⚙️ CARGAR VARIABLES DE ENTORNO
// ==============================
require('dotenv').config();

// ==============================
// 📦 IMPORTAR APLICACIÓN EXPRESS
// ==============================
const app = require('./app');

// ==============================
// 🔧 CONFIGURACIÓN DEL PUERTO
// ==============================
const PORT = Number(process.env.PORT || 3000);

// ==============================
// 🚀 LEVANTAR SERVIDOR
// ==============================
const server = app.listen(PORT, () => {
  const geminiKeyStatus = process.env.GEMINI_API_KEY ? 'OK' : 'FALTA';
  const geminiModelStatus = process.env.GEMINI_MODEL ? 'OK' : 'FALTA';

  console.log(`
=========================================
🚀 SIVACAD Backend iniciado correctamente
=========================================
🌐 URL: http://localhost:${PORT}
⚙️ Entorno: ${process.env.NODE_ENV || 'development'}
🔑 GEMINI_API_KEY: ${geminiKeyStatus}
🧠 GEMINI_MODEL: ${geminiModelStatus}
=========================================
  `);
});

// ==============================
// 🛑 MANEJO DE ERRORES DEL PUERTO
// ==============================
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ El puerto ${PORT} ya está en uso.`);
    console.error('Cierra el proceso que lo ocupa o cambia el valor de PORT en el archivo .env.');
    process.exit(1);
  } else {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
});