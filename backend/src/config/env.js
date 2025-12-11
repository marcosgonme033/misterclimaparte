// backend/src/config/env.js
require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',

  // Puerto del servidor API
  port: Number(process.env.PORT) || 5000,

  // URL del frontend (para CORS)
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Configuración de la base de datos MySQL
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'beesoftware',
  },

  // Config JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'BeeSoftwareSuperSecreto123!',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  },
};

module.exports = config;
