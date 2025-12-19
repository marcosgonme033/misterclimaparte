// BeeSoftware/backend/src/repositories/partes.repository.js
// Repositorio para gestionar operaciones CRUD de partes

const { pool } = require('../config/db');
const { ESTADO_LEGACY_MAP, normalizarEstadoParte, normalizarEstadosPartes } = require('../utils/estado-normalizer');

/**
 * Obtiene todos los partes (para admin)
 * @returns {Promise<Array>} - Lista de todos los partes
 */
async function getAllPartes() {
  try {
    // Intentar con campo 'calle', si falla, usar consulta sin 'calle'
    let query = `SELECT id, numero_parte, aparato, poblacion, nombre_tecnico, observaciones, 
              nota_parte, instrucciones_recibidas, instrucciones_tecnico, informe_tecnico, 
              fotos_json, firma_base64, cliente_email, cliente_telefono, dni_cliente, acepta_proteccion_datos, 
              estado, orden, created_at, updated_at
       FROM partes
       ORDER BY 
         CASE estado
           WHEN 'inicial' THEN 1
           WHEN 'revisando' THEN 2
           WHEN 'revisado' THEN 2
           WHEN 'visitas_realizadas' THEN 3
           WHEN 'visitado' THEN 3
           WHEN 'ausentes' THEN 4
           WHEN 'reparado' THEN 4
           ELSE 5
         END,
         orden ASC,
         created_at DESC`;
    
    try {
      // Intentar primero con el campo 'calle'
      const queryWithCalle = query.replace('poblacion, nombre_tecnico', 'poblacion, calle, nombre_tecnico');
      const [rows] = await pool.query(queryWithCalle);
      return normalizarEstadosPartes(rows);
    } catch (error) {
      // Si falla (columna no existe), usar query sin 'calle'
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        console.warn('⚠️ Campo "calle" no existe aún. Ejecuta la migración add_calle_field.sql');
        const [rows] = await pool.query(query);
        return normalizarEstadosPartes(rows);
      }
      throw error;
    }
    
    // Normalizar estados antes de devolver
    return normalizarEstadosPartes(rows);
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
    let query = `SELECT id, numero_parte, aparato, poblacion, nombre_tecnico, observaciones, 
              nota_parte, instrucciones_recibidas, instrucciones_tecnico, informe_tecnico, 
              fotos_json, firma_base64, cliente_email, cliente_telefono, dni_cliente, acepta_proteccion_datos, 
              estado, orden, created_at, updated_at
       FROM partes
       WHERE LOWER(TRIM(nombre_tecnico)) = LOWER(TRIM(?))
       ORDER BY 
         CASE estado
           WHEN 'inicial' THEN 1
           WHEN 'revisando' THEN 2
           WHEN 'revisado' THEN 2
           WHEN 'visitas_realizadas' THEN 3
           WHEN 'visitado' THEN 3
           WHEN 'ausentes' THEN 4
           WHEN 'reparado' THEN 4
           ELSE 5
         END,
         orden ASC,
         created_at DESC`;
    
    try {
      // Intentar primero con el campo 'calle'
      const queryWithCalle = query.replace('poblacion, nombre_tecnico', 'poblacion, calle, nombre_tecnico');
      const [rows] = await pool.query(queryWithCalle, [nombreTecnico]);
      return normalizarEstadosPartes(rows);
    } catch (error) {
      // Si falla (columna no existe), usar query sin 'calle'
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        const [rows] = await pool.query(query, [nombreTecnico]);
        return normalizarEstadosPartes(rows);
      }
      throw error;
    }
    
    // Normalizar estados antes de devolver
    return normalizarEstadosPartes(rows);
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
    let query = `SELECT id, numero_parte, aparato, poblacion, nombre_tecnico, observaciones, 
              nota_parte, instrucciones_recibidas, instrucciones_tecnico, informe_tecnico, 
              fotos_json, firma_base64, cliente_email, cliente_telefono, dni_cliente, acepta_proteccion_datos, 
              estado, orden, created_at, updated_at
       FROM partes
       WHERE id = ?
       LIMIT 1`;
    
    try {
      // Intentar primero con el campo 'calle'
      const queryWithCalle = query.replace('poblacion, nombre_tecnico', 'poblacion, calle, nombre_tecnico');
      const [rows] = await pool.query(queryWithCalle, [id]);
      const parte = rows.length > 0 ? rows[0] : null;
      return parte ? normalizarEstadoParte(parte) : null;
    } catch (error) {
      // Si falla (columna no existe), usar query sin 'calle'
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        const [rows] = await pool.query(query, [id]);
        const parte = rows.length > 0 ? rows[0] : null;
        return parte ? normalizarEstadoParte(parte) : null;
      }
      throw error;
    }
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
    calle = null,
    nombre_tecnico,
    observaciones = null,
    nota_parte = null,
    instrucciones_recibidas = null,
    instrucciones_tecnico = null,
    informe_tecnico = null,
    fotos_json = null,
    firma_base64 = null,
    cliente_email = null,
    cliente_telefono = null,
    dni_cliente = null,
    acepta_proteccion_datos = false,
    estado = 'inicial',
  } = data;

  try {
    // Obtener el máximo orden para el estado inicial
    const [maxOrdenResult] = await pool.query(
      'SELECT COALESCE(MAX(orden), 0) as maxOrden FROM partes WHERE estado = ?',
      [estado]
    );
    const nuevoOrden = maxOrdenResult[0].maxOrden + 1;

    // Intentar INSERT con campo 'calle'
    try {
      const [result] = await pool.query(
        `INSERT INTO partes 
         (numero_parte, aparato, poblacion, calle, nombre_tecnico, observaciones, nota_parte, 
          instrucciones_recibidas, instrucciones_tecnico, informe_tecnico, fotos_json, 
          firma_base64, cliente_email, cliente_telefono, dni_cliente, acepta_proteccion_datos, estado, orden)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          numero_parte,
          aparato,
          poblacion,
          calle,
          nombre_tecnico,
          observaciones,
          nota_parte,
          instrucciones_recibidas,
          instrucciones_tecnico,
          informe_tecnico,
          fotos_json,
          firma_base64,
          cliente_email,
          cliente_telefono,
          dni_cliente,
          acepta_proteccion_datos,
          estado,
          nuevoOrden,
        ]
      );

      return await getParteById(result.insertId);
    } catch (error) {
      // Si falla por campo no existente, intentar sin 'calle'
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        const [result] = await pool.query(
          `INSERT INTO partes 
           (numero_parte, aparato, poblacion, nombre_tecnico, observaciones, nota_parte, 
            instrucciones_recibidas, instrucciones_tecnico, informe_tecnico, fotos_json, 
            firma_base64, cliente_email, cliente_telefono, dni_cliente, acepta_proteccion_datos, estado, orden)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            cliente_telefono,
            dni_cliente,
            acepta_proteccion_datos,
            estado,
            nuevoOrden,
          ]
        );

        return await getParteById(result.insertId);
      }
      throw error;
    }
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
    calle,
    nombre_tecnico,
    observaciones,
    nota_parte,
    instrucciones_recibidas,
    instrucciones_tecnico,
    informe_tecnico,
    fotos_json,
    firma_base64,
    cliente_email,
    cliente_telefono,
    dni_cliente,
    acepta_proteccion_datos,
    estado,
    orden,
  } = data;

  try {
    // Intentar actualizar con campo 'calle'
    try {
      const [result] = await pool.query(
        `UPDATE partes SET
           numero_parte = COALESCE(?, numero_parte),
           aparato = COALESCE(?, aparato),
           poblacion = COALESCE(?, poblacion),
           calle = ?,
           nombre_tecnico = COALESCE(?, nombre_tecnico),
           observaciones = ?,
           nota_parte = ?,
           instrucciones_recibidas = ?,
           instrucciones_tecnico = ?,
           informe_tecnico = ?,
           fotos_json = ?,
           firma_base64 = ?,
           cliente_email = ?,
           cliente_telefono = ?,
           dni_cliente = ?,
           acepta_proteccion_datos = ?,
           estado = COALESCE(?, estado),
           orden = COALESCE(?, orden)
         WHERE id = ?`,
        [
          numero_parte,
          aparato,
          poblacion,
          calle,
          nombre_tecnico,
          observaciones,
          nota_parte,
          instrucciones_recibidas,
          instrucciones_tecnico,
          informe_tecnico,
          fotos_json,
          firma_base64,
          cliente_email,
          cliente_telefono,
          dni_cliente,
          acepta_proteccion_datos,
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
      // Si falla por campo no existente, intentar sin 'calle'
      if (error.code === 'ER_BAD_FIELD_ERROR') {
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
             cliente_telefono = ?,
             dni_cliente = ?,
             acepta_proteccion_datos = ?,
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
            cliente_telefono,
            dni_cliente,
            acepta_proteccion_datos,
            estado,
            orden,
            id,
          ]
        );

        if (result.affectedRows === 0) {
          return null;
        }

        return await getParteById(id);
      }
      throw error;
    }
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
 * También puede actualizar el estado si viene en los updates
 * @param {Array} updates - Array de objetos {id, orden, estado (opcional)}
 * @returns {Promise<boolean>} - true si se actualizó correctamente
 */
async function updatePartesOrden(updates) {
  if (!updates || updates.length === 0) return true;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const update of updates) {
      // Si viene estado, actualizar estado y orden
      if (update.estado !== undefined) {
        await connection.query(
          'UPDATE partes SET orden = ?, estado = ? WHERE id = ?',
          [update.orden, update.estado, update.id]
        );
      } else {
        // Solo actualizar orden
        await connection.query(
          'UPDATE partes SET orden = ? WHERE id = ?',
          [update.orden, update.id]
        );
      }
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

/**
 * Obtiene un resumen de diagnóstico de la base de datos
 * @returns {Promise<Object>} - Resumen con totales por estado y técnico
 */
async function getDebugSummary() {
  try {
    // Total de partes
    const [totalResult] = await pool.query('SELECT COUNT(*) as total FROM partes');
    const total = totalResult[0].total;

    // Total por estado (SIN normalización para ver estados reales en BD)
    const [estadosRaw] = await pool.query(
      `SELECT estado, COUNT(*) as count 
       FROM partes 
       GROUP BY estado 
       ORDER BY count DESC`
    );

    // Total por técnico
    const [tecnicos] = await pool.query(
      `SELECT nombre_tecnico, COUNT(*) as count 
       FROM partes 
       GROUP BY nombre_tecnico 
       ORDER BY count DESC`
    );

    return {
      total,
      porEstadoRaw: estadosRaw,
      porTecnico: tecnicos,
    };
  } catch (error) {
    console.error('❌ Error en getDebugSummary:', error.message);
    throw new Error('Error al obtener resumen de diagnóstico');
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
  getDebugSummary,
};
