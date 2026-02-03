// BeeSoftware/frontend/src/config/api.js
// Configuración centralizada de la API

/**
 * URL base de la API del backend
 * Se obtiene de las variables de entorno de Vite
 * @type {string}
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL;

// Validación en tiempo de desarrollo
if (!API_BASE_URL) {
  console.error(
    '❌ ERROR DE CONFIGURACIÓN: VITE_API_URL no está definida.\n' +
    'Por favor, verifica que exista el archivo .env.development o .env.production\n' +
    'con la variable VITE_API_URL configurada correctamente.'
  );
  throw new Error('Missing VITE_API_URL environment variable');
}

// Advertencia si se detecta localhost en producción
if (import.meta.env.PROD && API_BASE_URL.includes('localhost')) {
  console.error(
    '⚠️ ADVERTENCIA: El build de producción está usando localhost.\n' +
    'Esto causará errores en dispositivos remotos.\n' +
    'Actualiza .env.production con la URL correcta del backend.'
  );
}

// Log de configuración (solo en desarrollo)
if (import.meta.env.DEV) {
  console.log('🔧 Configuración de API:', {
    API_BASE_URL,
    mode: import.meta.env.MODE,
    isDev: import.meta.env.DEV,
    isProd: import.meta.env.PROD,
  });
}

/**
 * Obtiene los headers de autenticación
 * @param {Object} user - Objeto de usuario con información de sesión
 * @returns {Object} Headers con autenticación
 */
export const getAuthHeaders = (user) => {
  if (user) {
    // Si hay usuario, usar el sistema de autenticación actual
    return {
      'Authorization': `Bearer fake-jwt-token-beesoftware`,
      'x-user': JSON.stringify(user),
      'Content-Type': 'application/json'
    };
  }
  
  // Fallback: buscar token en localStorage
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

/**
 * Realiza una petición fetch con configuración estandarizada
 * @param {string} endpoint - Endpoint relativo (ej: '/api/partes')
 * @param {Object} options - Opciones de fetch
 * @returns {Promise<Response>}
 */
export const apiFetch = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config = {
    headers: getAuthHeaders(),
    ...options,
  };

  try {
    const response = await fetch(url, config);
    return response;
  } catch (error) {
    console.error(`❌ Error en petición a ${url}:`, error);
    throw error;
  }
};

export default {
  API_BASE_URL,
  getAuthHeaders,
  apiFetch,
};
