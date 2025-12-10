// backend/src/config/env.js
require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',

  // Puerto donde arranca tu API (Render/VPS usarán su propio PORT)
  port: Number(process.env.PORT) || 5000,

  // URL del frontend (para CORS)
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Configuración de la base de datos (MySQL remoto)
  db: {
    host: process.env.DB_HOST || '204.93.189.82',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'ysqytyxn_usrMarcos',
    password: process.env.DB_PASSWORD || 'c2GU[1oKC+%oY8$B',
    name: process.env.DB_NAME || 'ysqytyxn_ddbbMrClimaPartes',
  },

  // Config JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'BeeSoftwareSuperSecreto123!',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  },
};

module.exports = config;
