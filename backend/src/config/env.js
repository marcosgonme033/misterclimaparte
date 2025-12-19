// backend/src/config/env.js
// Config centralizada - Lee variables de entorno
// NOTA: dotenv.config() se ejecuta en index.js antes de importar este módulo

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

  // Configuración SMTP
  smtp: {
    host: process.env.SMTP_HOST || null,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    requireTLS: process.env.SMTP_REQUIRE_TLS === 'true',
    user: process.env.SMTP_USER || null,
    pass: process.env.SMTP_PASS || null,
    from: process.env.SMTP_FROM || 'no-reply@beesoftware.local',
  },
};

module.exports = config;
