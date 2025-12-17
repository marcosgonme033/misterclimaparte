// BeeSoftware/backend/src/controllers/partes.controller.js
// Controlador para gestionar las operaciones de partes con control de roles y permisos

const partesRepository = require('../repositories/partes.repository');
const { pool } = require('../config/db');
const nodemailer = require('nodemailer');

// Estados válidos para el tablero Kanban (NUEVOS)
const ESTADOS_VALIDOS = ['inicial', 'revisando', 'visitas_realizadas', 'ausentes'];

// Mapeo de compatibilidad para estados antiguos
const ESTADO_LEGACY_MAP = {
  'revisado': 'revisando',
  'visitado': 'visitas_realizadas',
  'reparado': 'ausentes'
};

/**
 * Mapea un estado antiguo al nuevo (si es necesario)
 * @param {string} estado - Estado recibido (puede ser antiguo o nuevo)
 * @returns {string} - Estado normalizado al nuevo formato
 */
function normalizarEstado(estado) {
  if (!estado) return 'inicial';
  return ESTADO_LEGACY_MAP[estado] || estado;
}

// Configurar el transporter de email (reutilizar config del index.js)
let mailTransporter = null;

async function initMailTransporter() {
  if (mailTransporter) return mailTransporter;

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
    return mailTransporter;
  }

  // Fallback a cuenta de prueba
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
    return mailTransporter;
  } catch (err) {
    console.error('❌ No se pudo inicializar el transporter de email:', err.message);
    return null;
  }
}

/**
 * Obtiene partes según el rol del usuario
 * - Admin: todos los partes
 * - User: solo sus partes asignados
 */
async function getPartes(req, res) {
  try {
    const { role, name, username } = req.user || {};
    const { nombre_tecnico } = req.query;
    
    // LOGGING PARA DIAGNÓSTICO (controlado por env)
    const DEBUG_MODE = process.env.DEBUG_PARTES === 'true';
    
    if (DEBUG_MODE) {
      console.log('🔍 [DIAGNÓSTICO getPartes]');
      console.log('  Usuario logueado:', { username, name, role });
      console.log('  Filtro técnico:', nombre_tecnico || 'ninguno');
    }

    let partes = [];

    // Si es admin y no se especifica técnico, devolver todos
    if (role === 'admin' && !nombre_tecnico) {
      partes = await partesRepository.getAllPartes();
      
      if (DEBUG_MODE) {
        const tecnicosEnPartes = [...new Set(partes.map(p => p.nombre_tecnico))];
        console.log('  📋 Técnicos en BD:', tecnicosEnPartes);
      }
    }
    // Si es admin y especifica técnico, devolver los de ese técnico
    else if (role === 'admin' && nombre_tecnico) {
      partes = await partesRepository.getPartesByTecnico(nombre_tecnico);
    }
    // Si es user, solo devolver sus propios partes
    else {
      const tecnicoName = name || username;
      partes = await partesRepository.getPartesByTecnico(tecnicoName);
    }

    // LOGGING: conteo total y por estado
    if (DEBUG_MODE) {
      const countByEstado = partes.reduce((acc, p) => {
        acc[p.estado] = (acc[p.estado] || 0) + 1;
        return acc;
      }, {});
      
      console.log('  📊 Total partes devueltos:', partes.length);
      console.log('  📊 Por estado:', countByEstado);
      console.log('  Estados presentes:', Object.keys(countByEstado));
    }

    return res.status(200).json({
      ok: true,
      data: partes,
    });
  } catch (error) {
    console.error('❌ Error en getPartes:', error.message);
    return res.status(500).json({
      ok: false,
      message: 'Error al obtener los partes',
      error: error.message,
    });
  }
}

/**
 * Obtiene un parte específico por ID
 * - Admin: puede ver cualquier parte
 * - User: solo puede ver sus propios partes
 */
async function getParteById(req, res) {
  try {
    const { id } = req.params;
    const { role, name, username } = req.user || {};

    if (!id || isNaN(id)) {
      return res.status(400).json({
        ok: false,
        message: 'ID de parte inválido',
      });
    }

    const parte = await partesRepository.getParteById(parseInt(id));

    if (!parte) {
      return res.status(404).json({
        ok: false,
        message: 'Parte no encontrado',
      });
    }

    // Si es user, verificar que sea su parte
    if (role !== 'admin') {
      const tecnicoName = name || username;
      if (parte.nombre_tecnico !== tecnicoName) {
        return res.status(403).json({
          ok: false,
          message: 'No tienes permiso para ver este parte',
        });
      }
    }

    return res.status(200).json({
      ok: true,
      data: parte,
    });
  } catch (error) {
    console.error('❌ Error en getParteById:', error.message);
    return res.status(500).json({
      ok: false,
      message: 'Error al obtener el parte',
      error: error.message,
    });
  }
}

/**
 * Crea un nuevo parte
 * SOLO ADMIN puede crear partes
 */
async function createParte(req, res) {
  try {
    const { role } = req.user || {};

    // Verificar que sea admin
    if (role !== 'admin') {
      return res.status(403).json({
        ok: false,
        message: 'Solo los administradores pueden crear partes',
      });
    }

    const {
      numero_parte,
      aparato,
      poblacion,
      nombre_tecnico,
      observaciones,
      cliente_email,
    } = req.body;

    // Validaciones obligatorias
    if (!numero_parte || !/^\d{6}$/.test(numero_parte)) {
      return res.status(400).json({
        ok: false,
        message: 'El número de parte debe tener exactamente 6 dígitos',
      });
    }

    // Verificar que el número de parte no existe ya (evitar duplicados)
    const [existingParte] = await pool.query(
      'SELECT id FROM partes WHERE numero_parte = ?',
      [numero_parte]
    );

    if (existingParte.length > 0) {
      return res.status(409).json({
        ok: false,
        message: 'Ya existe un parte con ese número. Elige otro número de parte.',
        field: 'numero_parte',
      });
    }

    if (!aparato || !aparato.trim()) {
      return res.status(400).json({
        ok: false,
        message: 'El aparato es obligatorio',
      });
    }

    if (!poblacion || !poblacion.trim()) {
      return res.status(400).json({
        ok: false,
        message: 'La población es obligatoria',
      });
    }

    if (!nombre_tecnico || !nombre_tecnico.trim()) {
      return res.status(400).json({
        ok: false,
        message: 'Debe asignar un técnico al parte',
      });
    }

    // Verificar que el técnico existe y no es admin
    const [tecnicoRows] = await pool.query(
      'SELECT role FROM usuarios WHERE name = ? OR username = ?',
      [nombre_tecnico, nombre_tecnico]
    );

    if (tecnicoRows.length === 0) {
      return res.status(400).json({
        ok: false,
        message: 'El técnico asignado no existe',
      });
    }

    if (tecnicoRows[0].role === 'admin') {
      return res.status(400).json({
        ok: false,
        message: 'No se puede asignar un parte a un administrador',
      });
    }

    // Crear el parte con estado inicial (solo campos permitidos en estado inicial)
    const parteData = {
      numero_parte,
      aparato: aparato.trim(),
      poblacion: poblacion.trim(),
      nombre_tecnico: nombre_tecnico.trim(),
      observaciones: observaciones || null,
      cliente_email: cliente_email || null,
      estado: normalizarEstado('inicial'), // SIEMPRE inicial al crear (normalizado por consistencia)
    };

    const nuevoParte = await partesRepository.createParte(parteData);

    return res.status(201).json({
      ok: true,
      message: 'Parte creado exitosamente',
      data: nuevoParte,
    });
  } catch (error) {
    console.error('❌ Error en createParte:', error.message);
    
    // Capturar error de clave duplicada de MySQL
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
      return res.status(409).json({
        ok: false,
        message: 'Ya existe un parte con ese número. Elige otro número de parte.',
        field: 'numero_parte',
      });
    }
    
    return res.status(500).json({
      ok: false,
      message: 'Error al crear el parte',
      error: error.message,
    });
  }
}

/**
 * Actualiza un parte existente
 * - Admin: puede actualizar cualquier parte
 * - User: solo puede actualizar sus propios partes
 * - Validación de campos según el estado
 */
async function updateParte(req, res) {
  try {
    const { id } = req.params;
    const { role, name, username } = req.user || {};
    const DEBUG_MODE = process.env.DEBUG_PARTES === 'true';

    if (!id || isNaN(id)) {
      return res.status(400).json({
        ok: false,
        message: 'ID de parte inválido',
      });
    }

    const parteExistente = await partesRepository.getParteById(parseInt(id));

    if (!parteExistente) {
      return res.status(404).json({
        ok: false,
        message: 'Parte no encontrado',
      });
    }

    // Si es user, verificar que sea su parte
    if (role !== 'admin') {
      const tecnicoName = name || username;
      if (parteExistente.nombre_tecnico !== tecnicoName) {
        return res.status(403).json({
          ok: false,
          message: 'No tienes permiso para editar este parte',
        });
      }
    }

    const {
      numero_parte,
      aparato,
      poblacion,
      observaciones,
      cliente_email,
      instrucciones_tecnico,
      informe_tecnico,
      fotos_json,
      estado,
    } = req.body;

    // Normalizar estado (mapeo de compatibilidad con estados antiguos)
    const estadoNormalizado = estado ? normalizarEstado(estado) : null;
    
    if (DEBUG_MODE) {
      console.log('🔄 [DRAG&DROP updateParte]');
      console.log('  ParteId:', id);
      console.log('  Usuario:', { username, name, role });
      console.log('  Estado recibido:', estado);
      console.log('  Estado normalizado:', estadoNormalizado);
      console.log('  Estado anterior:', parteExistente.estado);
    }

    // Si se cambia el estado, validar que sea válido
    if (estadoNormalizado && !ESTADOS_VALIDOS.includes(estadoNormalizado)) {
      console.error('❌ Estado inválido rechazado:', {
        estadoRecibido: estado,
        estadoNormalizado,
        estadosValidos: ESTADOS_VALIDOS
      });
      return res.status(400).json({
        ok: false,
        message: `Estado inválido: "${estado}". Debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}`,
        estadoRecibido: estado,
        estadoNormalizado: estadoNormalizado,
        estadosValidos: ESTADOS_VALIDOS
      });
    }

    // El estado a validar es el nuevo o el actual
    const estadoFinal = estadoNormalizado || parteExistente.estado;

    // Log de depuración para cambios de estado
    if (estadoNormalizado !== undefined && estadoNormalizado !== parteExistente.estado) {
      const isDragDrop = !req.body.numero_parte; // Si solo viene estado, probablemente es drag&drop
      console.log(`${isDragDrop ? '🔄 [DRAG&DROP]' : '📝 [EDICIÓN]'} Cambio de estado:`, {
        parteId: id,
        estadoAnterior: parteExistente.estado,
        estadoNuevo: estadoNormalizado,
        direccion: ESTADOS_VALIDOS.indexOf(estadoNormalizado) < ESTADOS_VALIDOS.indexOf(parteExistente.estado) ? '⬅️ Hacia atrás' : '➡️ Hacia adelante'
      });
    }

    // ✅ PERMITIDO: Movimiento bidireccional entre TODOS los estados

    // Validar numero_parte si se proporciona
    if (numero_parte && !/^\d{6}$/.test(numero_parte)) {
      return res.status(400).json({
        ok: false,
        message: 'El número de parte debe tener exactamente 6 dígitos',
      });
    }

    // Construir objeto de actualización con validación por estado
    // IMPORTANTE: Preservar campos existentes del parteExistente si no vienen en el body
    const updateData = {
      numero_parte: numero_parte !== undefined ? numero_parte : parteExistente.numero_parte,
      aparato: aparato !== undefined ? aparato : parteExistente.aparato,
      poblacion: poblacion !== undefined ? poblacion : parteExistente.poblacion,
      observaciones: observaciones !== undefined ? observaciones : parteExistente.observaciones,
      cliente_email: cliente_email !== undefined ? cliente_email : parteExistente.cliente_email,
    };

    // Campos permitidos según estado (preservar valores existentes)
    if (estadoFinal === 'revisando' || estadoFinal === 'visitas_realizadas' || estadoFinal === 'ausentes') {
      updateData.instrucciones_tecnico = instrucciones_tecnico !== undefined ? instrucciones_tecnico : parteExistente.instrucciones_tecnico;
    }

    if (estadoFinal === 'visitas_realizadas' || estadoFinal === 'ausentes') {
      updateData.informe_tecnico = informe_tecnico !== undefined ? informe_tecnico : parteExistente.informe_tecnico;
      updateData.fotos_json = fotos_json !== undefined ? fotos_json : parteExistente.fotos_json;
    }

    // Siempre permitir cambio de estado (usar el normalizado)
    if (estadoNormalizado !== undefined) updateData.estado = estadoNormalizado;

    // COMENTADO: Reorganizar orden si cambia el estado (campo 'orden' aún no existe en BD)
    // if (estado !== undefined && estado !== parteExistente.estado) {
    //   await partesRepository.reorganizarOrden(parseInt(id), parteExistente.estado, estado);
    // }

    const parteActualizado = await partesRepository.updateParte(parseInt(id), updateData);

    if (!parteActualizado) {
      return res.status(404).json({
        ok: false,
        message: 'No se pudo actualizar el parte',
      });
    }

    if (DEBUG_MODE) {
      console.log('  ✅ Parte actualizado correctamente');
      console.log('  📊 Estado final:', parteActualizado.estado);
    }

    return res.status(200).json({
      ok: true,
      message: 'Parte actualizado exitosamente',
      data: parteActualizado,
    });
  } catch (error) {
    console.error('❌ Error en updateParte:', error.message);
    console.error('   Stack:', error.stack);
    return res.status(500).json({
      ok: false,
      message: 'Error al actualizar el parte',
      error: error.message,
    });
  }
}

/**
 * Elimina un parte
 * SOLO ADMIN puede eliminar partes
 */
async function deleteParte(req, res) {
  try {
    const { id } = req.params;
    const { role } = req.user || {};

    // Verificar que sea admin
    if (role !== 'admin') {
      return res.status(403).json({
        ok: false,
        message: 'Solo los administradores pueden eliminar partes',
      });
    }

    if (!id || isNaN(id)) {
      return res.status(400).json({
        ok: false,
        message: 'ID de parte inválido',
      });
    }

    const eliminado = await partesRepository.deleteParte(parseInt(id));

    if (!eliminado) {
      return res.status(404).json({
        ok: false,
        message: 'Parte no encontrado',
      });
    }

    return res.status(200).json({
      ok: true,
      message: 'Parte eliminado exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en deleteParte:', error.message);
    return res.status(500).json({
      ok: false,
      message: 'Error al eliminar el parte',
      error: error.message,
    });
  }
}

/**
 * Obtiene lista de técnicos disponibles (usuarios con rol "user")
 * SOLO ADMIN puede ver esta lista
 * Devuelve ÚNICAMENTE los 4 técnicos válidos: José, Tadas, Enrique, Deve
 */
async function getTecnicos(req, res) {
  try {
    const { role } = req.user || {};

    // Verificar que sea admin
    if (role !== 'admin') {
      return res.status(403).json({
        ok: false,
        message: 'Solo los administradores pueden ver la lista de técnicos',
      });
    }

    // Obtener técnicos de la BD
    // Excluir admins (marcos, rafaelaadmin) y técnicos no válidos (antonio)
    const [tecnicos] = await pool.query(
      `SELECT id, username, name FROM usuarios 
       WHERE role = 'user' 
       AND username NOT IN ('marcos', 'rafaelaadmin', 'antonio')
       AND name IN ('José', 'Tadas', 'Enrique', 'Deve')
       ORDER BY name ASC`
    );

    console.log('👥 Técnicos válidos devueltos desde BD:', tecnicos.map(t => ({
      id: t.id,
      username: t.username,
      name: t.name
    })));

    // Verificación: asegurar que solo hay 4 técnicos
    if (tecnicos.length !== 4) {
      console.warn(`⚠️ ADVERTENCIA: Se esperaban 4 técnicos pero se encontraron ${tecnicos.length}`);
      console.warn('⚠️ Ejecuta el script NORMALIZAR_TECNICOS.sql para corregir la BD');
    }

    return res.status(200).json({
      ok: true,
      data: tecnicos,
    });
  } catch (error) {
    console.error('❌ Error en getTecnicos:', error.message);
    return res.status(500).json({
      ok: false,
      message: 'Error al obtener la lista de técnicos',
      error: error.message,
    });
  }
}

/**
 * Actualiza el orden de múltiples partes (reordenamiento manual)
 * Permite reorganizar partes dentro de una misma columna
 */
async function updatePartesOrden(req, res) {
  try {
    const { role, name, username } = req.user || {};
    const { updates } = req.body; // Array de {id, orden, estado}
    const DEBUG_MODE = process.env.DEBUG_PARTES === 'true';

    if (DEBUG_MODE) {
      console.log('🔄 [DRAG&DROP updatePartesOrden]');
      console.log('  Usuario:', { username, name, role });
      console.log('  Updates recibidos:', updates);
    }

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        ok: false,
        message: 'Se requiere un array de actualizaciones',
      });
    }

    // Normalizar estados si vienen en los updates
    const updatesNormalizados = updates.map(update => {
      if (update.estado) {
        const estadoNormalizado = normalizarEstado(update.estado);
        
        // Validar que el estado normalizado sea válido
        if (!ESTADOS_VALIDOS.includes(estadoNormalizado)) {
          throw new Error(`Estado inválido: ${update.estado}`);
        }
        
        if (DEBUG_MODE && update.estado !== estadoNormalizado) {
          console.log(`  📝 Estado normalizado: ${update.estado} → ${estadoNormalizado}`);
        }
        
        return { ...update, estado: estadoNormalizado };
      }
      return update;
    });

    // Si es user, verificar que solo reordena sus propios partes
    if (role !== 'admin') {
      const tecnicoName = name || username;
      const parteIds = updatesNormalizados.map(u => u.id);
      
      // Verificar que todos los partes pertenecen al técnico
      const partes = await Promise.all(
        parteIds.map(id => partesRepository.getParteById(id))
      );
      
      const todosSonPropios = partes.every(
        parte => parte && parte.nombre_tecnico === tecnicoName
      );
      
      if (!todosSonPropios) {
        return res.status(403).json({
          ok: false,
          message: 'No tienes permiso para reordenar estos partes',
        });
      }
    }

    // Actualizar orden
    await partesRepository.updatePartesOrden(updatesNormalizados);

    if (DEBUG_MODE) {
      console.log('  ✅ Orden actualizado correctamente');
      console.log(`  📊 ${updatesNormalizados.length} partes actualizados`);
    }

    return res.status(200).json({
      ok: true,
      message: 'Orden actualizado correctamente',
    });
  } catch (error) {
    console.error('❌ Error en updatePartesOrden:', error.message);
    return res.status(500).json({
      ok: false,
      message: 'Error al actualizar el orden',
      error: error.message,
    });
  }
}

/**
 * Envía un email al cliente con los datos del parte
 * Solo disponible para partes en estado 'visitado' o 'reparado'
 * Requiere que el parte tenga un email de cliente válido
 */
async function enviarEmailCliente(req, res) {
  try {
    const { id } = req.params;
    const { role, name, username } = req.user || {};

    if (!id || isNaN(id)) {
      return res.status(400).json({
        ok: false,
        message: 'ID de parte inválido',
      });
    }

    // Obtener el parte
    const parte = await partesRepository.getParteById(parseInt(id));

    if (!parte) {
      return res.status(404).json({
        ok: false,
        message: 'Parte no encontrado',
      });
    }

    // Verificar permisos (admin puede enviar cualquier email, user solo sus partes)
    if (role !== 'admin') {
      const tecnicoName = name || username;
      if (parte.nombre_tecnico !== tecnicoName) {
        return res.status(403).json({
          ok: false,
          message: 'No tienes permiso para enviar email de este parte',
        });
      }
    }

    // Validar que el parte esté en estado 'revisando', 'visitas_realizadas' o 'ausentes'
    if (!['revisando', 'visitas_realizadas', 'ausentes'].includes(parte.estado)) {
      return res.status(400).json({
        ok: false,
        message: 'Solo se puede enviar email para partes en estado "Revisando", "Visitas realizadas" o "Ausentes"',
      });
    }

    // Validar que el parte tenga email de cliente
    if (!parte.cliente_email || !parte.cliente_email.trim()) {
      return res.status(400).json({
        ok: false,
        message: 'El parte no tiene email de cliente configurado',
      });
    }

    // Inicializar el transporter si no existe
    const transporter = await initMailTransporter();
    
    if (!transporter) {
      return res.status(500).json({
        ok: false,
        message: 'Servicio de email no disponible',
      });
    }

    // Preparar contenido del email
    const estadoTextos = {
      'revisando': 'Revisando',
      'visitas_realizadas': 'Visitas realizadas',
      'ausentes': 'Ausente'
    };
    const estadoTexto = estadoTextos[parte.estado] || parte.estado;
    const subject = `Parte #${parte.numero_parte} - ${estadoTexto}`;
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #facc15; color: #1f2937; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .field { margin-bottom: 15px; }
          .label { font-weight: bold; color: #1f2937; }
          .value { color: #4b5563; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 2px solid #e5e7eb; font-size: 0.9em; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>BeeSoftware - Resumen de Parte</h1>
            <h2>Parte #${parte.numero_parte}</h2>
          </div>
          <div class="content">
            <div class="field">
              <span class="label">Estado:</span>
              <span class="value">${estadoTexto}</span>
            </div>
            <div class="field">
              <span class="label">Aparato:</span>
              <span class="value">${parte.aparato || 'N/A'}</span>
            </div>
            <div class="field">
              <span class="label">Población:</span>
              <span class="value">${parte.poblacion || 'N/A'}</span>
            </div>
            <div class="field">
              <span class="label">Técnico asignado:</span>
              <span class="value">${parte.nombre_tecnico || 'N/A'}</span>
            </div>
            ${parte.observaciones ? `
            <div class="field">
              <span class="label">Observaciones:</span>
              <span class="value">${parte.observaciones}</span>
            </div>
            ` : ''}
            ${parte.instrucciones_tecnico ? `
            <div class="field">
              <span class="label">Observaciones del técnico:</span>
              <span class="value">${parte.instrucciones_tecnico}</span>
            </div>
            ` : ''}
            ${parte.informe_tecnico ? `
            <div class="field">
              <span class="label">Informe técnico:</span>
              <span class="value">${parte.informe_tecnico}</span>
            </div>
            ` : ''}
            ${parte.dni_cliente ? `
            <div class="field">
              <span class="label">DNI del cliente:</span>
              <span class="value">${parte.dni_cliente}</span>
            </div>
            ` : ''}
            <div class="footer">
              <p>Este es un resumen automático del parte de trabajo realizado.</p>
              <p>Si tiene alguna duda, por favor contacte con nosotros.</p>
              <p><strong>BeeSoftware</strong> - Sistema de gestión de partes</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const textBody = `
BeeSoftware - Resumen de Parte

Parte #${parte.numero_parte}
Estado: ${estadoTexto}

Detalles del servicio:
- Aparato: ${parte.aparato || 'N/A'}
- Población: ${parte.poblacion || 'N/A'}
- Técnico asignado: ${parte.nombre_tecnico || 'N/A'}
${parte.observaciones ? `- Observaciones: ${parte.observaciones}` : ''}
${parte.instrucciones_tecnico ? `- Observaciones del técnico: ${parte.instrucciones_tecnico}` : ''}
${parte.informe_tecnico ? `- Informe técnico: ${parte.informe_tecnico}` : ''}
${parte.dni_cliente ? `- DNI del cliente: ${parte.dni_cliente}` : ''}

---
Este es un resumen automático del parte de trabajo realizado.
Si tiene alguna duda, por favor contacte con nosotros.

BeeSoftware - Sistema de gestión de partes
    `.trim();

    // Enviar el email
    const from = process.env.FROM_EMAIL || 'no-reply@beesoftware.local';
    const info = await transporter.sendMail({
      from,
      to: parte.cliente_email,
      subject,
      text: textBody,
      html: htmlBody,
    });

    console.log('✅ Email enviado:', info.messageId);
    
    // Si es cuenta de prueba, obtener URL de vista previa
    let previewUrl = null;
    if (nodemailer.getTestMessageUrl) {
      previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log('📧 Vista previa del email:', previewUrl);
      }
    }

    return res.status(200).json({
      ok: true,
      message: 'Email enviado exitosamente',
      messageId: info.messageId,
      previewUrl: previewUrl,
    });
  } catch (error) {
    console.error('❌ Error en enviarEmailCliente:', error.message);
    return res.status(500).json({
      ok: false,
      message: 'Error al enviar el email',
      error: error.message,
    });
  }
}

/**
 * Endpoint de diagnóstico - obtiene resumen de partes por estado y técnico
 * SOLO para admin o si DEBUG_PARTES=true
 */
async function getDebugSummary(req, res) {
  try {
    const { role } = req.user || {};
    const DEBUG_MODE = process.env.DEBUG_PARTES === 'true';

    // Solo admin o modo debug
    if (role !== 'admin' && !DEBUG_MODE) {
      return res.status(403).json({
        ok: false,
        message: 'No autorizado',
      });
    }

    const summary = await partesRepository.getDebugSummary();

    return res.status(200).json({
      ok: true,
      data: summary,
    });
  } catch (error) {
    console.error('❌ Error en getDebugSummary:', error.message);
    return res.status(500).json({
      ok: false,
      message: 'Error al obtener resumen de diagnóstico',
      error: error.message,
    });
  }
}

/**
 * Endpoint de versión - devuelve información de la versión del backend
 */
async function getVersion(req, res) {
  try {
    const version = {
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      buildDate: process.env.BUILD_DATE || new Date().toISOString(),
      gitCommit: process.env.GIT_SHA || 'unknown',
      nodeVersion: process.version,
    };

    return res.status(200).json({
      ok: true,
      data: version,
    });
  } catch (error) {
    console.error('❌ Error en getVersion:', error.message);
    return res.status(500).json({
      ok: false,
      message: 'Error al obtener versión',
      error: error.message,
    });
  }
}

module.exports = {
  getPartes,
  getParteById,
  createParte,
  updateParte,
  deleteParte,
  getTecnicos,
  updatePartesOrden,
  enviarEmailCliente,
  getDebugSummary,
  getVersion,
};
