// BeeSoftware/backend/src/utils/estado-normalizer.js
// Módulo centralizado para normalización de estados (DRY principle)

/**
 * Estados válidos en el sistema actual
 */
const ESTADOS_VALIDOS = ['inicial', 'revisando', 'visitas_realizadas', 'ausentes'];

/**
 * Mapeo de estados legacy a nuevos (para compatibilidad con BD antigua)
 * NO eliminar - necesario para compatibilidad con datos existentes
 */
const ESTADO_LEGACY_MAP = {
  'revisado': 'revisando',
  'visitado': 'visitas_realizadas',
  'reparado': 'ausentes'
};

/**
 * Normaliza un estado (mapea estados legacy a nuevos)
 * @param {string} estado - Estado a normalizar
 * @returns {string} - Estado normalizado
 */
function normalizarEstado(estado) {
  if (!estado) return estado;
  return ESTADO_LEGACY_MAP[estado] || estado;
}

/**
 * Normaliza el estado de un objeto parte
 * @param {Object} parte - Parte a normalizar
 * @returns {Object} - Parte con estado normalizado
 */
function normalizarEstadoParte(parte) {
  if (parte && parte.estado && ESTADO_LEGACY_MAP[parte.estado]) {
    return {
      ...parte,
      estado: ESTADO_LEGACY_MAP[parte.estado]
    };
  }
  return parte;
}

/**
 * Normaliza los estados de un array de partes
 * @param {Array} partes - Array de partes
 * @returns {Array} - Array de partes con estados normalizados
 */
function normalizarEstadosPartes(partes) {
  return partes.map(normalizarEstadoParte);
}

module.exports = {
  ESTADOS_VALIDOS,
  ESTADO_LEGACY_MAP,
  normalizarEstado,
  normalizarEstadoParte,
  normalizarEstadosPartes,
};
