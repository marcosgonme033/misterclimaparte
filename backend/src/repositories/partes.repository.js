// BeeSoftware/backend/src/repositories/partes.repository.js
// Repositorio para gestionar operaciones CRUD de partes

const { pool } = require('../config/db');

/**
 * Obtiene todos los partes (para admin)
 * @returns {Promise<Array>} - Lista de todos los partes
 */
async function getAllPartes() {
  try {
    const [rows] = await pool.query(
      `SELECT id, numero_parte, aparato, poblacion, nombre_tecnico, observaciones, 
              nota_parte, instrucciones_recibidas, instrucciones_tecnico, informe_tecnico, 
              fotos_json, firma_base64, cliente_email, estado, orden, created_at, updated_at
       FROM partes
       ORDER BY 
         CASE estado
           WHEN 'inicial' THEN 1
           WHEN 'revisado' THEN 2
           WHEN 'visitado' THEN 3
           WHEN 'reparado' THEN 4
           ELSE 5
         END,
         orden ASC,
         created_at DESC`
    );
    return rows;
  } catch (error) {
    console.error('❌ Error en getAllPartes:', error.message);
    throw new Error('Error al obtener todos los partes');
  }
}

/**
 * Obtiene todos los partes de un técnico específico
 * @param {string} nombreTecnico - Nombre del técnico
 * @returns {Promise<Array>} - Lista de partes
 */
async function getPartesByTecnico(nombreTecnico) {
  try {
    const [rows] = await pool.query(
      `SELECT id, numero_parte, aparato, poblacion, nombre_tecnico, observaciones, 
              nota_parte, instrucciones_recibidas, instrucciones_tecnico, informe_tecnico, 
              fotos_json, firma_base64, cliente_email, estado, orden, created_at, updated_at
       FROM partes
       WHERE nombre_tecnico = ?
       ORDER BY 
         CASE estado
           WHEN 'inicial' THEN 1
           WHEN 'revisado' THEN 2
           WHEN 'visitado' THEN 3
           WHEN 'reparado' THEN 4
           ELSE 5
         END,
         orden ASC,
         created_at DESC`,
      [nombreTecnico]
    );
    return rows;
  } catch (error) {
    console.error('❌ Error en getPartesByTecnico:', error.message);
    throw new Error('Error al obtener partes del técnico');
  }
}

/**
 * Obtiene un parte por su ID
 * @param {number} id - ID del parte
 * @returns {Promise<Object|null>} - Parte encontrado o null
 */
async function getParteById(id) {
  try {
    const [rows] = await pool.query(
      `SELECT id, numero_parte, aparato, poblacion, nombre_tecnico, observaciones, 
              nota_parte, instrucciones_recibidas, instrucciones_tecnico, informe_tecnico, 
              fotos_json, firma_base64, cliente_email, estado, orden, created_at, updated_at
       FROM partes
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('❌ Error en getParteById:', error.message);
    throw new Error('Error al obtener el parte');
  }
}

/**
 * Crea un nuevo parte
 * @param {Object} data - Datos del parte
 * @returns {Promise<Object>} - Parte creado con su ID
 */
async function createParte(data) {
  const {
    numero_parte,
    aparato,
    poblacion,
    nombre_tecnico,
    observaciones = null,
    nota_parte = null,
    instrucciones_recibidas = null,
    instrucciones_tecnico = null,
    informe_tecnico = null,
    fotos_json = null,
    firma_base64 = null,
    cliente_email = null,
    estado = 'pendiente',
  } = data;

  try {
    // Obtener el máximo orden para el estado inicial
    const [maxOrdenResult] = await pool.query(
      'SELECT COALESCE(MAX(orden), 0) as maxOrden FROM partes WHERE estado = ?',
      [estado]
    );
    const nuevoOrden = maxOrdenResult[0].maxOrden + 1;

    const [result] = await pool.query(
      `INSERT INTO partes 
       (numero_parte, aparato, poblacion, nombre_tecnico, observaciones, nota_parte, 
        instrucciones_recibidas, instrucciones_tecnico, informe_tecnico, fotos_json, 
        firma_base64, cliente_email, estado, orden)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        numero_parte,
        aparato,
        poblacion,
        nombre_tecnico,
        observaciones,
        nota_parte,
        instrucciones_recibidas,
        instrucciones_tecnico,
        informe_tecnico,
        fotos_json,
        firma_base64,
        cliente_email,
        estado,
        nuevoOrden,
      ]
    );

    // Devolver el parte creado
    return await getParteById(result.insertId);
  } catch (error) {
    console.error('❌ Error en createParte:', error.message);
    throw new Error('Error al crear el parte');
  }
}

/**
 * Actualiza un parte existente
 * @param {number} id - ID del parte
 * @param {Object} data - Datos a actualizar
 * @returns {Promise<Object|null>} - Parte actualizado o null
 */
async function updateParte(id, data) {
  const {
    numero_parte,
    aparato,
    poblacion,
    nombre_tecnico,
    observaciones,
    nota_parte,
    instrucciones_recibidas,
    instrucciones_tecnico,
    informe_tecnico,
    fotos_json,
    firma_base64,
    cliente_email,
    estado,
    orden,
  } = data;

  try {
    const [result] = await pool.query(
      `UPDATE partes SET
         numero_parte = COALESCE(?, numero_parte),
         aparato = COALESCE(?, aparato),
         poblacion = COALESCE(?, poblacion),
         nombre_tecnico = COALESCE(?, nombre_tecnico),
         observaciones = ?,
         nota_parte = ?,
         instrucciones_recibidas = ?,
         instrucciones_tecnico = ?,
         informe_tecnico = ?,
         fotos_json = ?,
         firma_base64 = ?,
         cliente_email = ?,
         estado = COALESCE(?, estado),
         orden = COALESCE(?, orden)
       WHERE id = ?`,
      [
        numero_parte,
        aparato,
        poblacion,
        nombre_tecnico,
        observaciones,
        nota_parte,
        instrucciones_recibidas,
        instrucciones_tecnico,
        informe_tecnico,
        fotos_json,
        firma_base64,
        cliente_email,
        estado,
        orden,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return null;
    }

    return await getParteById(id);
  } catch (error) {
    console.error('❌ Error en updateParte:', error.message);
    throw new Error('Error al actualizar el parte');
  }
}

/**
 * Elimina un parte por su ID
 * @param {number} id - ID del parte
 * @returns {Promise<boolean>} - true si se eliminó, false si no existía
 */
async function deleteParte(id) {
  try {
    const [result] = await pool.query('DELETE FROM partes WHERE id = ?', [id]);
    return result.affectedRows > 0;
  } catch (error) {
    console.error('❌ Error en deleteParte:', error.message);
    throw new Error('Error al eliminar el parte');
  }
}

/**
 * Actualiza el orden de múltiples partes en una columna (batch update)
 * @param {Array} updates - Array de objetos {id, orden}
 * @returns {Promise<boolean>} - true si se actualizó correctamente
 */
async function updatePartesOrden(updates) {
  if (!updates || updates.length === 0) return true;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const update of updates) {
      await connection.query(
        'UPDATE partes SET orden = ? WHERE id = ?',
        [update.orden, update.id]
      );
    }

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error en updatePartesOrden:', error.message);
    throw new Error('Error al actualizar el orden de los partes');
  } finally {
    connection.release();
  }
}

/**
 * Reorganiza el orden de partes cuando uno cambia de estado
 * @param {number} parteId - ID del parte que cambió
 * @param {string} estadoAnterior - Estado anterior
 * @param {string} estadoNuevo - Nuevo estado
 * @returns {Promise<void>}
 */
async function reorganizarOrden(parteId, estadoAnterior, estadoNuevo) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Si el estado cambió, asignar el máximo orden + 1 en el nuevo estado
    if (estadoAnterior !== estadoNuevo) {
      const [maxOrdenResult] = await connection.query(
        'SELECT COALESCE(MAX(orden), 0) as maxOrden FROM partes WHERE estado = ?',
        [estadoNuevo]
      );
      const nuevoOrden = maxOrdenResult[0].maxOrden + 1;

      await connection.query(
        'UPDATE partes SET orden = ? WHERE id = ?',
        [nuevoOrden, parteId]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error en reorganizarOrden:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  getAllPartes,
  getPartesByTecnico,
  getParteById,
  createParte,
  updateParte,
  deleteParte,
  updatePartesOrden,
  reorganizarOrden,
};
