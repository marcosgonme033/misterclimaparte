// BeeSoftware/backend/src/middleware/auth.middleware.js
// Middleware para autenticación y autorización

const FAKE_TOKEN = 'fake-jwt-token-beesoftware';

/**
 * Middleware simplificado que confía en el user enviado desde el frontend
 * En producción, esto debería validar un JWT real
 */
async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        ok: false,
        message: 'No se proporcionó token de autenticación',
      });
    }

    const token = authHeader.replace('Bearer ', '');

    if (token !== FAKE_TOKEN) {
      return res.status(401).json({
        ok: false,
        message: 'Token inválido',
      });
    }

    // Extraer información del usuario desde headers (enviado por el frontend)
    const userHeader = req.headers['x-user'];
    
    if (!userHeader) {
      return res.status(401).json({
        ok: false,
        message: 'No se pudo identificar al usuario',
      });
    }

    try {
      const user = JSON.parse(userHeader);
      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({
        ok: false,
        message: 'Datos de usuario inválidos',
      });
    }
  } catch (error) {
    console.error('❌ Error en authMiddleware:', error.message);
    return res.status(500).json({
      ok: false,
      message: 'Error en la autenticación',
    });
  }
}

/**
 * Middleware para verificar que el usuario sea admin
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      ok: false,
      message: 'Se requieren permisos de administrador',
    });
  }
  next();
}

module.exports = {
  authMiddleware,
  requireAdmin,
};
