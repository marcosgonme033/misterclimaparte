// BeeSoftware/backend/src/index.js
// API de autenticación + conexión a BD para BeeSoftware - VERSIÓN PRODUCCIÓN

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const config = require('./config/env');                  // Config centralizada (.env)
const { pool, testConnection, isMysqlAvailable } = require('./config/db'); // Conexión MySQL desde config

// Rutas
const partesRoutes = require('./routes/partes.routes');

const app = express();
const PORT = config.port || 5000;
const HOST = '0.0.0.0';

// CORS configurado para desarrollo y producción
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sin origin (como Postman, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Lista de orígenes permitidos
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://misterclima.es',
      'https://www.misterclima.es'
    ];
    
    // Permitir el origen si está en la lista
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`⚠️  CORS: Origen no permitido: ${origin}`);
      callback(null, true); // Por ahora permitir todos (cambiar a false en producción final)
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Total-Count'],
  maxAge: 86400, // 24 horas de caché para preflight
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Handler explícito para OPTIONS (preflight)
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ==========================
// DEMO AUTH EN MEMORIA
// ==========================
let USERS = [
  {
    id: '1',
    username: 'marcos',
    password: '1234',
    name: 'Marcos - BeeSoftware',
    role: 'admin',
  },
];

const FAKE_TOKEN = 'fake-jwt-token-beesoftware';

// In-memory store for recovery codes: { [email]: { code, expiresAt } }
const RECOVERY_CODES = {};

// Configure mail transporter (uses env vars). If not configured, we'll create a test account.
let mailTransporter = null;
async function initMailer() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    mailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log('✉️ Mailer configurado con SMTP personalizado');
    return;
  }

  // fallback to test account
  try {
    const testAccount = await nodemailer.createTestAccount();
    mailTransporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('✉️ Mailer configurado con cuenta de prueba (Ethereal)');
  } catch (err) {
    console.error('❌ Could not initialize mailer:', err.message);
  }
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

async function sendRecoveryEmail(to, code) {
  if (!mailTransporter) {
    console.warn('No mail transporter configured — skipping send (server logs only).');
    return { previewUrl: null };
  }

  const from = process.env.FROM_EMAIL || 'no-reply@beesoftware.local';
  const subject = 'BeeSoftware - Código de recuperación de contraseña';
  const text = `Tu código de recuperación es: ${code}`;
  const html = `<p>Tu código de recuperación es: <strong>${code}</strong></p><p>Si no has solicitado este código, ignora este email.</p>`;

  const info = await mailTransporter.sendMail({ from, to, subject, text, html });
  let previewUrl = null;
  if (nodemailer.getTestMessageUrl) {
    previewUrl = nodemailer.getTestMessageUrl(info) || null;
  }
  return { info, previewUrl };
}

function findUserByUsername(username) {
  return USERS.find(
    (u) => u.username.toLowerCase() === String(username).toLowerCase()
  );
}

// ==========================
// RUTA SIMPLE: BACKEND VIVO
// ==========================
app.get('/', (req, res) => {
  res.json({
    ok: true,
    message: 'API BeeSoftware funcionando correctamente ✅',
    environment: config.env,
    version: '1.0.0'
  });
});

// Health check endpoint para monitoreo
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env
  });
});

// Version endpoint (sin autenticación para verificar deployment)
app.get('/api/version', (req, res) => {
  res.status(200).json({
    ok: true,
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || config.env || 'development',
    buildDate: process.env.BUILD_DATE || new Date().toISOString(),
    gitCommit: process.env.GIT_SHA || 'unknown',
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
  });
});

// ==========================
// HEALTH CHECK DE BASE DE DATOS
// ==========================
app.get('/health/db', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Test de conexión
    const [rows] = await pool.query('SELECT VERSION() as version, DATABASE() as db, NOW() as server_time');
    const responseTime = Date.now() - startTime;
    
    // Test de consulta a tabla real
    let tablesCount = 0;
    try {
      const [tables] = await pool.query('SHOW TABLES');
      tablesCount = tables.length;
    } catch (err) {
      // Si falla, no es crítico
    }
    
    return res.status(200).json({
      status: 'connected',
      message: '✅ Conexión a MySQL exitosa',
      database: {
        host: config.db.host,
        port: config.db.port,
        name: rows[0].db,
        version: rows[0].version,
        serverTime: rows[0].server_time,
        tablesCount: tablesCount,
      },
      performance: {
        responseTime: `${responseTime}ms`
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [Health Check DB] Error:', error.message);
    return res.status(503).json({
      status: 'disconnected',
      message: '❌ Error de conexión a MySQL',
      error: {
        message: error.message,
        code: error.code,
        sqlState: error.sqlState
      },
      config: {
        host: config.db.host,
        port: config.db.port,
        database: config.db.name,
        user: config.db.user
      },
      timestamp: new Date().toISOString()
    });
  }
});

// ==========================
// RUTAS DE PARTES
// ==========================
app.use('/api/partes', partesRoutes);

// =====================================
// RUTA PARA PROBAR CONEXIÓN A LA BD
// =====================================
app.get('/api/db-test', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS result');
    return res.json({
      ok: true,
      message: 'Conexión a base de datos OK',
      data: rows[0],
    });
  } catch (error) {
    console.error('❌ Error en /api/db-test:', error.message);
    return res.status(500).json({
      ok: false,
      message: 'Error al conectar con la base de datos',
      error: error.message,
    });
  }
});

// =====================================
// INICIALIZACIÓN DE TABLA DEMO
// =====================================
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const [rows] = await pool.query(
      'SELECT id FROM usuarios WHERE username = ? LIMIT 1',
      ['marcos']
    );

    if (rows.length === 0) {
      await pool.query(
        `INSERT INTO usuarios (username, password, name, role)
         VALUES (?, ?, ?, ?)`,
        ['marcos', '1234', 'Marcos - BeeSoftware (BD)', 'admin']
      );
    }
  } catch (error) {
    console.error('❌ Error inicializando la base de datos:', error.message);
  }
}

// =====================================
// ENDPOINTS DEMO BD REAL
// =====================================
app.get('/api/usuarios', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, name, role, created_at FROM usuarios ORDER BY id DESC'
    );

    return res.status(200).json({
      ok: true,
      data: rows,
    });
  } catch (error) {
    console.error('❌ Error en GET /api/usuarios:', error.message);
    return res.status(500).json({
      ok: false,
      message: 'Error al obtener usuarios desde la BD',
      error: error.message,
    });
  }
});

app.post('/api/usuarios', async (req, res) => {
  try {
    const { username, password, name, role } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        ok: false,
        message: 'Usuario y contraseña son obligatorios',
      });
    }

    if (String(username).length < 3) {
      return res.status(400).json({
        ok: false,
        message: 'El usuario debe tener al menos 3 caracteres',
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        ok: false,
        message: 'La contraseña debe tener al menos 6 caracteres',
      });
    }

    const [existing] = await pool.query(
      'SELECT id FROM usuarios WHERE username = ? LIMIT 1',
      [username]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        ok: false,
        message: 'Ese usuario ya existe en la base de datos',
      });
    }

    const finalName =
      name && String(name).trim() ? String(name).trim() : String(username);

    const finalRole =
      role && String(role).trim() ? String(role).trim() : 'user';

    const [result] = await pool.query(
      `INSERT INTO usuarios (username, password, name, role)
       VALUES (?, ?, ?, ?)`,
      [username, password, finalName, finalRole]
    );

    return res.status(201).json({
      ok: true,
      message: 'Usuario creado correctamente en la base de datos',
      data: {
        id: result.insertId,
        username,
        name: finalName,
        role: finalRole,
      },
    });
  } catch (error) {
    console.error('❌ Error en POST /api/usuarios:', error.message);
    return res.status(500).json({
      ok: false,
      message: 'Error al crear usuario en la base de datos',
      error: error.message,
    });
  }
});

// =====================================
// AUTH CON BASE DE DATOS
// =====================================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        ok: false,
        message: 'Usuario y contraseña son obligatorios',
      });
    }

    // Si MySQL no está disponible, usar usuarios en memoria
    if (!isMysqlAvailable()) {
      const memUser = USERS.find(
        u => u.username === username && u.password === password
      );
      
      if (!memUser) {
        return res.status(401).json({
          ok: false,
          message: 'Credenciales incorrectas',
        });
      }

      return res.status(200).json({
        ok: true,
        message: 'Login correcto (modo desarrollo - sin MySQL)',
        data: {
          user: {
            id: memUser.id,
            username: memUser.username,
            name: memUser.name,
            role: memUser.role,
          },
          token: FAKE_TOKEN,
        },
      });
    }

    // Intentar con MySQL si está disponible
    const [rows] = await pool.query(
      'SELECT id, username, password, name, role FROM usuarios WHERE username = ? LIMIT 1',
      [username]
    );
    
    if (rows.length === 0) {
      return res.status(401).json({
        ok: false,
        message: 'Credenciales incorrectas',
      });
    }

    const user = rows[0];

    if (user.password !== password) {
      return res.status(401).json({
        ok: false,
        message: 'Credenciales incorrectas',
      });
    }

    return res.status(200).json({
      ok: true,
      message: 'Login correcto',
      data: {
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
        },
        token: FAKE_TOKEN,
      },
    });
  } catch (error) {
    console.error('❌ Error en /api/auth/login:', error);
    
    // Si hay error de MySQL, intentar con usuarios en memoria como fallback
    const memUser = USERS.find(
      u => u.username === req.body.username && u.password === req.body.password
    );
    
    if (memUser) {
      return res.status(200).json({
        ok: true,
        message: 'Login correcto (fallback a usuarios en memoria)',
        data: {
          user: {
            id: memUser.id,
            username: memUser.username,
            name: memUser.name,
            role: memUser.role,
          },
          token: FAKE_TOKEN,
        },
      });
    }
    
    return res.status(500).json({
      ok: false,
      message: 'Error de conexión con la base de datos',
    });
  }
});

// ==========================
// PASSWORD RECOVERY API
// ==========================
app.post('/api/auth/recover/request', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email)
      return res.status(400).json({ ok: false, message: 'Email requerido' });

    const code = generateCode();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes
    RECOVERY_CODES[email.toLowerCase()] = { code, expiresAt };

    const result = await sendRecoveryEmail(email, code);

    return res.status(200).json({
      ok: true,
      message: 'Código enviado (si la dirección existe)',
      previewUrl: result.previewUrl || null,
    });
  } catch (err) {
    console.error('Error in recover/request:', err.message);
    return res
      .status(500)
      .json({ ok: false, message: 'Error interno enviando el código' });
  }
});

app.post('/api/auth/recover/verify', (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code)
      return res
        .status(400)
        .json({ ok: false, message: 'Email y código son requeridos' });

    const entry = RECOVERY_CODES[email.toLowerCase()];
    if (!entry)
      return res
        .status(404)
        .json({ ok: false, message: 'Código no encontrado o expirado' });
    if (Date.now() > entry.expiresAt)
      return res
        .status(410)
        .json({ ok: false, message: 'Código expirado' });
    if (String(entry.code) !== String(code).trim())
      return res
        .status(400)
        .json({ ok: false, message: 'Código incorrecto' });

    return res.status(200).json({ ok: true, message: 'Código verificado' });
  } catch (err) {
    console.error('Error in recover/verify:', err.message);
    return res
      .status(500)
      .json({ ok: false, message: 'Error interno verificando el código' });
  }
});

app.post('/api/auth/recover/reset', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body || {};
    if (!email || !code || !newPassword)
      return res.status(400).json({
        ok: false,
        message: 'Email, código y nueva contraseña son requeridos',
      });
    if (String(newPassword).length < 6)
      return res.status(400).json({
        ok: false,
        message: 'La contraseña debe tener al menos 6 caracteres',
      });

    const entry = RECOVERY_CODES[email.toLowerCase()];
    if (!entry)
      return res
        .status(404)
        .json({ ok: false, message: 'Código no encontrado o expirado' });
    if (Date.now() > entry.expiresAt)
      return res
        .status(410)
        .json({ ok: false, message: 'Código expirado' });
    if (String(entry.code) !== String(code).trim())
      return res
        .status(400)
        .json({ ok: false, message: 'Código incorrecto' });

    // Update password in memory if user exists
    const user = findUserByUsername(email);
    if (user) {
      user.password = String(newPassword);
      delete RECOVERY_CODES[email.toLowerCase()];
      return res
        .status(200)
        .json({ ok: true, message: 'Contraseña actualizada (memoria)' });
    }

    // Otherwise attempt to update in DB (usuarios.username)
    try {
      const [rows] = await pool.query(
        'SELECT id FROM usuarios WHERE username = ? LIMIT 1',
        [email]
      );
      if (rows.length === 0)
        return res
          .status(404)
          .json({ ok: false, message: 'Usuario no encontrado' });
      await pool.query('UPDATE usuarios SET password = ? WHERE username = ?', [
        String(newPassword),
        email,
      ]);
      delete RECOVERY_CODES[email.toLowerCase()];
      return res
        .status(200)
        .json({ ok: true, message: 'Contraseña actualizada (BD)' });
    } catch (dbErr) {
      console.error('DB error updating password:', dbErr.message);
      return res.status(500).json({
        ok: false,
        message: 'Error actualizando la contraseña en la BD',
      });
    }
  } catch (err) {
    console.error('Error in recover/reset:', err.message);
    return res
      .status(500)
      .json({ ok: false, message: 'Error interno al resetear la contraseña' });
  }
});

app.post('/api/auth/register', (req, res) => {
  try {
    const { name, username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        ok: false,
        message: 'Usuario y contraseña son obligatorios',
      });
    }

    if (String(username).length < 3) {
      return res.status(400).json({
        ok: false,
        message: 'El usuario debe tener al menos 3 caracteres',
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        ok: false,
        message: 'La contraseña debe tener al menos 6 caracteres',
      });
    }

    const existing = findUserByUsername(username);
    if (existing) {
      return res.status(409).json({
        ok: false,
        message: 'Ese usuario ya existe (memoria)',
      });
    }

    const newUser = {
      id: String(USERS.length + 1),
      username: String(username),
      password: String(password),
      name:
        name && String(name).trim()
          ? String(name).trim()
          : String(username),
      role: 'user',
    };

    USERS.push(newUser);

    return res.status(201).json({
      ok: true,
      message: 'Usuario creado correctamente (en memoria)',
      data: {
        user: {
          id: newUser.id,
          username: newUser.username,
          name: newUser.name,
          role: newUser.role,
        },
        token: FAKE_TOKEN,
      },
    });
  } catch (error) {
    console.error('❌ Error en /api/auth/register:', error.message);
    return res.status(500).json({
      ok: false,
      message: 'Error interno en el servidor',
    });
  }
});

app.get('/api/auth/me', (req, res) => {
  try {
    const authHeader = req.headers['authorization'] || '';
    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        ok: false,
        message: 'No autorizado: token ausente o mal formado',
      });
    }

    const token = parts[1];

    if (token !== FAKE_TOKEN) {
      return res.status(401).json({
        ok: false,
        message: 'No autorizado: token no válido',
      });
    }

    const user = USERS[0];

    return res.status(200).json({
      ok: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error('❌ Error en /api/auth/me:', error.message);
    return res.status(500).json({
      ok: false,
      message: 'Error interno en el servidor',
    });
  }
});

// ==========================
// MIDDLEWARE DE ERROR GLOBAL
// ==========================
app.use((err, req, res, next) => {
  console.error('💥 [ERROR NO CAPTURADO]:', err);
  console.error('Stack:', err.stack);
  res.status(500).json({
    ok: false,
    message: 'Error interno del servidor',
    error: config.env === 'production' ? 'Internal Server Error' : err.message
  });
});

// Capturar errores no manejados
process.on('uncaughtException', (err) => {
  console.error('💥 [UNCAUGHT EXCEPTION]:', err);
  console.error('Stack:', err.stack);
  // En producción podrías querer reiniciar el proceso
  if (config.env === 'production') {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 [UNHANDLED REJECTION]:', reason);
  console.error('Promise:', promise);
});

// ==========================
// ARRANQUE DEL SERVIDOR
// ==========================
const server = app.listen(PORT, HOST, () => {
  const addr = server.address();
  console.log('============================================');
  console.log('🚀 BeeSoftware API - Desarrollo Local');
  console.log('============================================');
  console.log(`✅ Servidor corriendo en ${HOST}:${PORT}`);
  console.log(`🌍 Entorno: ${config.env}`);
  console.log(`🔗 CORS: Permitiendo todos los orígenes (desarrollo)`);
  console.log('============================================');
  console.log('🔍 Inicializando subsistemas...');

  // Inicialización asíncrona NO bloqueante
  (async () => {
    try {
      await testConnection();
      await initDatabase();
    } catch (err) {
      console.warn('⚠️ Advertencia: fallo al inicializar la BD.');
      console.warn(err && err.message ? err.message : err);
    }

    try {
      await initMailer();
      console.log('✅ initMailer() completado');
    } catch (err) {
      console.warn('⚠️ Advertencia: fallo al inicializar el mailer.');
      console.warn(err && err.message ? err.message : err);
    }

    console.log('============================================');
    console.log('🎉 Servidor completamente inicializado');
    console.log('============================================');
  })();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM recibido, cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT recibido, cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

server.on('error', (err) => {
  console.error('💥 Error en el servidor HTTP:', err);
  console.error('Stack completo:', err.stack);
  process.exit(1);
});

server.on('listening', () => {
  console.log('✅ Evento "listening" confirmado - servidor está activo');
});