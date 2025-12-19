// BeeSoftware/backend/src/controllers/partes.controller.js
// Controlador para gestionar las operaciones de partes con control de roles y permisos

const partesRepository = require('../repositories/partes.repository');
const { pool } = require('../config/db');
const nodemailer = require('nodemailer');
const config = require('../config/env');
const { ESTADOS_VALIDOS, normalizarEstado } = require('../utils/estado-normalizer');

// Configurar el transporter de email
let mailTransporter = null;
let smtpMode = null; // 'real' | 'test' | null

async function initMailTransporter() {
  if (mailTransporter) return mailTransporter;

  // Logs de diagnóstico profesionales (sin contraseña)
  console.log('🔧 Configurando transporter de email...');
  console.log('  SMTP_HOST:', config.smtp.host || '(no configurado)');
  console.log('  SMTP_PORT:', config.smtp.port || '(no configurado)');
  console.log('  SMTP_SECURE:', config.smtp.secure);
  console.log('  SMTP_REQUIRE_TLS:', config.smtp.requireTLS);
  console.log('  SMTP_USER:', config.smtp.user || '(no configurado)');
  console.log('  SMTP_FROM:', config.smtp.from || '(no configurado)');
  console.log('  NODE_ENV:', config.env);
  console.log('  ALLOW_TEST_SMTP:', process.env.ALLOW_TEST_SMTP || 'false');

  const isProduction = config.env === 'production';
  const hasSmtpConfig = config.smtp.host && config.smtp.user && config.smtp.pass;
  const allowTestSmtp = process.env.ALLOW_TEST_SMTP === 'true';

  // Validación estricta en producción
  if (isProduction && !hasSmtpConfig) {
    console.error('❌ ERROR CRÍTICO: Producción requiere configuración SMTP completa');
    console.error('   Variables faltantes: SMTP_HOST, SMTP_USER y/o SMTP_PASS');
    return null;
  }

  // Si hay configuración SMTP, intentar usarla (producción o desarrollo)
  if (hasSmtpConfig) {
    try {
      const transportConfig = {
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure, // true para 465, false para otros puertos
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass,
        },
      };

      // Añadir configuración TLS adicional si está habilitada
      if (config.smtp.requireTLS) {
        transportConfig.tls = {
          // No rechazar certificados no autorizados en desarrollo (cuidado en producción)
          rejectUnauthorized: isProduction,
        };
      }

      mailTransporter = nodemailer.createTransport(transportConfig);
      
      // Verificar conexión SMTP
      console.log('🔄 Verificando conexión SMTP...');
      await mailTransporter.verify();
      smtpMode = 'real';
      console.log('✅ Transporter SMTP REAL configurado y verificado');
      console.log(`   Modo: PRODUCCIÓN (${config.smtp.host}:${config.smtp.port})`);
      console.log(`   Usuario: ${config.smtp.user}`);
      console.log(`   Secure (SSL/TLS): ${config.smtp.secure}`);
      return mailTransporter;
    } catch (err) {
      // Logs detallados según tipo de error
      console.error('❌ Error al verificar configuración SMTP');
      console.error('   Mensaje:', err.message);
      console.error('   Código:', err.code || 'N/A');
      
      // Errores específicos comunes
      if (err.responseCode === 535 || err.message.includes('535')) {
        console.error('   ⚠️  ERROR 535: Autenticación SMTP fallida');
        console.error('   Verifica SMTP_USER y SMTP_PASS en .env');
      } else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
        console.error('   ⚠️  ERROR DE CONEXIÓN:', err.code);
        console.error('   Verifica SMTP_HOST y SMTP_PORT, y que el servidor esté accesible');
      } else if (err.code === 'ESOCKET') {
        console.error('   ⚠️  ERROR DE SOCKET/TLS');
        console.error('   Verifica SMTP_SECURE y SMTP_PORT (465=secure:true, 587=secure:false)');
      }
      
      console.error('   Host:', config.smtp.host);
      console.error('   Puerto:', config.smtp.port);
      console.error('   Usuario:', config.smtp.user);
      console.error('   Secure:', config.smtp.secure);
      
      // Reset del transporter
      mailTransporter = null;
      smtpMode = null;
      
      // PRODUCCIÓN: NUNCA usar fallback
      if (isProduction) {
        console.error('   ❌ PRODUCCIÓN: NO se usará fallback - se debe corregir la configuración');
        return null;
      }
      
      // DESARROLLO con config SMTP: tampoco usar fallback (para detectar problemas)
      console.error('   ❌ Hay configuración SMTP pero falló - NO se usará fallback Ethereal');
      console.error('   Corrige la configuración SMTP o elimina las variables para desarrollo');
      return null;
    }
  }

  // Fallback a Ethereal SOLO si:
  // - No hay configuración SMTP definida
  // - Y (ALLOW_TEST_SMTP=true O no es producción)
  if (!hasSmtpConfig && (allowTestSmtp || !isProduction)) {
    try {
      console.log('⚠️  No hay configuración SMTP - intentando Ethereal para desarrollo...');
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
      smtpMode = 'test';
      console.log('✅ Usando cuenta de prueba ETHEREAL (desarrollo)');
      console.log('   ⚠️  Los emails NO llegarán a destinatarios reales');
      return mailTransporter;
    } catch (err) {
      console.error('❌ No se pudo inicializar Ethereal:', err.message);
      smtpMode = null;
      return null;
    }
  }

  // Si llegamos aquí: no hay transporter disponible
  console.error('❌ No hay servicio de email disponible');
  if (isProduction) {
    console.error('   Producción requiere configuración SMTP válida');
  }
  smtpMode = null;
  return null;
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
      calle,
      observaciones,
      cliente_email,
      cliente_telefono,
      dni_cliente,
      acepta_proteccion_datos,
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
      calle: calle !== undefined ? calle : parteExistente.calle,
      observaciones: observaciones !== undefined ? observaciones : parteExistente.observaciones,
      cliente_email: cliente_email !== undefined ? cliente_email : parteExistente.cliente_email,
      cliente_telefono: cliente_telefono !== undefined ? (cliente_telefono ? cliente_telefono.trim().replace(/\s+/g, ' ') : null) : parteExistente.cliente_telefono,
      dni_cliente: dni_cliente !== undefined ? dni_cliente : parteExistente.dni_cliente,
      acepta_proteccion_datos: acepta_proteccion_datos !== undefined ? acepta_proteccion_datos : parteExistente.acepta_proteccion_datos,
    };

    // ✅ Campos adicionales permitidos según estado (preservar valores existentes)
    // Instrucciones técnico: disponible en revisando, visitas_realizadas y ausentes
    if (estadoFinal === 'revisando' || estadoFinal === 'visitas_realizadas' || estadoFinal === 'ausentes') {
      updateData.instrucciones_tecnico = instrucciones_tecnico !== undefined ? instrucciones_tecnico : parteExistente.instrucciones_tecnico;
    }

    // ✅ Informe técnico e imágenes: disponible en revisando, visitas_realizadas y ausentes
    if (estadoFinal === 'revisando' || estadoFinal === 'visitas_realizadas' || estadoFinal === 'ausentes') {
      updateData.informe_tecnico = informe_tecnico !== undefined ? informe_tecnico : parteExistente.informe_tecnico;
      updateData.fotos_json = fotos_json !== undefined ? fotos_json : parteExistente.fotos_json;
    }

    // Siempre permitir cambio de estado (usar el normalizado)
    if (estadoNormalizado !== undefined) updateData.estado = estadoNormalizado;

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
 * Solo disponible para partes en estado 'visitas_realizadas' o 'ausentes'
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

    // ✅ VALIDACIONES OBLIGATORIAS PARA ENVIAR EMAIL (RGPD)
    // 1. Validar que existe email de cliente
    if (!parte.cliente_email || !parte.cliente_email.trim()) {
      return res.status(400).json({
        ok: false,
        message: 'El parte no tiene email de cliente configurado',
      });
    }

    // 2. Validar formato de email (simple)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(parte.cliente_email.trim())) {
      return res.status(400).json({
        ok: false,
        message: 'El email del cliente no tiene un formato válido',
      });
    }

    // 3. Validar que existe DNI del cliente
    if (!parte.dni_cliente || !parte.dni_cliente.trim()) {
      return res.status(400).json({
        ok: false,
        message: 'El parte no tiene DNI del cliente. El DNI es obligatorio para enviar emails (protección de datos).',
        campoFaltante: 'dni_cliente',
      });
    }

    // 4. Validar que el cliente ha aceptado protección de datos
    if (!parte.acepta_proteccion_datos) {
      return res.status(400).json({
        ok: false,
        message: 'El cliente no ha aceptado la política de protección de datos. Es necesario marcar el checkbox antes de enviar emails.',
        campoFaltante: 'acepta_proteccion_datos',
      });
    }

    // Inicializar el transporter si no existe
    const transporter = await initMailTransporter();
    
    if (!transporter) {
      // Determinar el motivo del fallo
      const hasSmtpConfig = config.smtp.host && config.smtp.user && config.smtp.pass;
      
      if (hasSmtpConfig) {
        // Hay configuración SMTP pero falló (probablemente auth error)
        return res.status(500).json({
          ok: false,
          error: 'SMTP_AUTH_FAILED',
          message: 'Error de autenticación SMTP. Verifica las credenciales.',
          details: `No se pudo conectar a ${config.smtp.host}:${config.smtp.port}. Revisa SMTP_USER y SMTP_PASS en el archivo .env`,
        });
      } else {
        // No hay configuración SMTP
        return res.status(500).json({
          ok: false,
          error: 'SMTP_NOT_CONFIGURED',
          message: 'Servicio de email no disponible. SMTP no configurado.',
          details: 'Configura las variables de entorno: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM',
        });
      }
    }

    // Advertir si se está usando modo test en producción (no debería pasar)
    if (smtpMode === 'test' && config.env === 'production') {
      console.error('⚠️  ADVERTENCIA: Usando SMTP de prueba en producción');
      return res.status(500).json({
        ok: false,
        message: 'Configuración de email incorrecta para producción',
        details: 'El servidor está usando cuenta de prueba en lugar de SMTP real',
      });
    }

    // Preparar contenido del email con TODOS los campos del parte
    const estadoTextos = {
      'inicial': 'Parte inicial',
      'revisando': 'Revisando',
      'revisado': 'Revisado',
      'visitas_realizadas': 'Visitas realizadas',
      'visitado': 'Visitado',
      'ausentes': 'Ausente',
      'reparado': 'Reparado'
    };
    const estadoTexto = estadoTextos[parte.estado] || parte.estado;
    const subject = `MisterClima - Parte #${parte.numero_parte || parte.id} - ${estadoTexto}`;
    
    // Formatear fecha de creación si existe
    const fechaCreacion = parte.created_at 
      ? new Date(parte.created_at).toLocaleDateString('es-ES', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : 'N/A';

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          .header { background-color: #facc15; color: #1f2937; padding: 30px 20px; text-align: center; }
          .header h1 { margin: 0 0 10px 0; font-size: 24px; }
          .header h2 { margin: 0; font-size: 20px; font-weight: normal; }
          .intro { padding: 20px 30px; background-color: #f9fafb; border-bottom: 2px solid #e5e7eb; }
          .intro p { margin: 0 0 12px 0; color: #4b5563; }
          .content { padding: 30px 20px; }
          .section { margin-bottom: 25px; }
          .section-title { font-size: 18px; font-weight: bold; color: #1f2937; margin-bottom: 15px; border-bottom: 2px solid #facc15; padding-bottom: 5px; }
          .field { margin-bottom: 12px; padding: 10px; background-color: #f9fafb; border-radius: 4px; }
          .label { font-weight: bold; color: #1f2937; display: inline-block; min-width: 150px; }
          .value { color: #4b5563; }
          .footer { margin-top: 30px; padding: 20px; background-color: #f9fafb; border-top: 2px solid #e5e7eb; font-size: 0.9em; color: #6b7280; text-align: center; }
          .footer p { margin: 5px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>MisterClima - Parte de Trabajo</h1>
            <h2>Parte #${parte.numero_parte || parte.id}</h2>
          </div>
          <div class="intro">
            <p><strong>Estimado/a cliente:</strong></p>
            <p>Le contactamos desde el Servicio de Asistencia Técnica de MisterClima para facilitarle un resumen del parte de trabajo asociado a su intervención.</p>
            <p>En este correo encontrará los detalles registrados por nuestro equipo (datos del equipo, población, observaciones e informe técnico, si aplica).</p>
            <p>Si detecta cualquier error en la información o necesita aportar datos adicionales, puede responder directamente a este mensaje y lo revisaremos a la mayor brevedad.</p>
            <p style="margin-bottom: 0;"><strong>Atentamente,</strong><br>MisterClima – Servicio de Asistencia Técnica (SAT)</p>
          </div>
          <div class="content">
            <!-- Información General -->
            <div class="section">
              <div class="section-title">📋 Información General</div>
              <div class="field">
                <span class="label">Estado:</span>
                <span class="value">${estadoTexto}</span>
              </div>
              ${parte.numero_parte ? `
              <div class="field">
                <span class="label">Número de Parte:</span>
                <span class="value">${parte.numero_parte}</span>
              </div>
              ` : ''}
              <div class="field">
                <span class="label">Fecha de Creación:</span>
                <span class="value">${fechaCreacion}</span>
              </div>
              ${parte.nombre_tecnico ? `
              <div class="field">
                <span class="label">Técnico Asignado:</span>
                <span class="value">${parte.nombre_tecnico}</span>
              </div>
              ` : ''}
            </div>

            <!-- Detalles del Servicio -->
            <div class="section">
              <div class="section-title">🔧 Detalles del Servicio</div>
              ${parte.aparato ? `
              <div class="field">
                <span class="label">Aparato:</span>
                <span class="value">${parte.aparato}</span>
              </div>
              ` : ''}
              ${parte.poblacion ? `
              <div class="field">
                <span class="label">Población:</span>
                <span class="value">${parte.poblacion}</span>
              </div>
              ` : ''}
              ${parte.calle ? `
              <div class="field">
                <span class="label">Calle:</span>
                <span class="value">${parte.calle}</span>
              </div>
              ` : ''}
              ${parte.observaciones ? `
              <div class="field">
                <span class="label">Observaciones del cliente:</span>
                <span class="value">${parte.observaciones}</span>
              </div>
              ` : ''}
              ${parte.nota_parte ? `
              <div class="field">
                <span class="label">Nota del Parte:</span>
                <span class="value">${parte.nota_parte}</span>
              </div>
              ` : ''}
            </div>

            <!-- Instrucciones e Informes -->
            ${(parte.instrucciones_recibidas || parte.instrucciones_tecnico || parte.informe_tecnico) ? `
            <div class="section">
              <div class="section-title">📝 Instrucciones e Informes</div>
              ${parte.instrucciones_recibidas ? `
              <div class="field">
                <span class="label">Instrucciones Recibidas:</span>
                <span class="value">${parte.instrucciones_recibidas}</span>
              </div>
              ` : ''}
              ${parte.instrucciones_tecnico ? `
              <div class="field">
                <span class="label">Observaciones del Técnico:</span>
                <span class="value">${parte.instrucciones_tecnico}</span>
              </div>
              ` : ''}
              ${parte.informe_tecnico ? `
              <div class="field">
                <span class="label">Informe Técnico:</span>
                <span class="value">${parte.informe_tecnico}</span>
              </div>
              ` : ''}
            </div>
            ` : ''}

            <!-- Datos del Cliente -->
            ${(parte.dni_cliente || parte.cliente_telefono || parte.acepta_proteccion_datos) ? `
            <div class="section">
              <div class="section-title">👤 Datos del Cliente</div>
              ${parte.dni_cliente ? `
              <div class="field">
                <span class="label">DNI del Cliente:</span>
                <span class="value">${parte.dni_cliente}</span>
              </div>
              ` : ''}
              ${parte.cliente_telefono ? `
              <div class="field">
                <span class="label">Teléfono:</span>
                <span class="value">${parte.cliente_telefono}</span>
              </div>
              ` : ''}
              ${parte.acepta_proteccion_datos !== undefined ? `
              <div class="field">
                <span class="label">Protección de Datos:</span>
                <span class="value">${parte.acepta_proteccion_datos ? 'Aceptado ✓' : 'No aceptado'}</span>
              </div>
              ` : ''}
            </div>
            ` : ''}

            <!-- Fotos adjuntas -->
            ${parte.fotos_json ? (() => {
              try {
                const fotos = JSON.parse(parte.fotos_json);
                if (Array.isArray(fotos) && fotos.length > 0) {
                  return `
            <div class="section">
              <div class="section-title">📸 Fotos del Servicio</div>
              <div class="field">
                <span class="value">Se adjuntan ${fotos.length} foto(s) en este correo.</span>
              </div>
            </div>
                  `;
                }
              } catch (e) {
                return '';
              }
              return '';
            })() : ''}

            <div class="footer">
              <p><strong>Este es un resumen automático del parte de trabajo.</strong></p>
              <p>Si tiene alguna duda o consulta, por favor contacte con nosotros.</p>
              <p style="margin-top: 15px;"><strong>MisterClima</strong> - Servicio técnico especializado</p>
              <p>Email: sat@misterclima.es</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const textBody = `
Estimado/a cliente:

Le contactamos desde el Servicio de Asistencia Técnica de MisterClima para facilitarle un resumen del parte de trabajo asociado a su intervención.

En este correo encontrará los detalles registrados por nuestro equipo (datos del equipo, población, observaciones e informe técnico, si aplica).

Si detecta cualquier error en la información o necesita aportar datos adicionales, puede responder directamente a este mensaje y lo revisaremos a la mayor brevedad.

Atentamente,
MisterClima – Servicio de Asistencia Técnica (SAT)

═══════════════════════════════════════════════════
MisterClima - Parte de Trabajo

═══════════════════════════════════════════════════
Parte #${parte.numero_parte || parte.id} del cliente
Estado: ${estadoTexto}
═══════════════════════════════════════════════════

📋 INFORMACIÓN GENERAL
${parte.numero_parte ? `  • Número de Parte: ${parte.numero_parte}` : ''}
  • Fecha de Creación: ${fechaCreacion}
${parte.nombre_tecnico ? `  • Técnico Asignado: ${parte.nombre_tecnico}` : ''}

🔧 DETALLES DEL SERVICIO
${parte.aparato ? `  • Aparato: ${parte.aparato}` : ''}
${parte.poblacion ? `  • Población: ${parte.poblacion}` : ''}
${parte.calle ? `  • Calle: ${parte.calle}` : ''}
${parte.observaciones ? `  • Observaciones: ${parte.observaciones}` : ''}
${parte.nota_parte ? `  • Nota del Parte: ${parte.nota_parte}` : ''}

${(parte.instrucciones_recibidas || parte.instrucciones_tecnico || parte.informe_tecnico) ? `
📝 INSTRUCCIONES E INFORMES
${parte.instrucciones_recibidas ? `  • Instrucciones Recibidas: ${parte.instrucciones_recibidas}` : ''}
${parte.instrucciones_tecnico ? `  • Observaciones del Técnico: ${parte.instrucciones_tecnico}` : ''}
${parte.informe_tecnico ? `  • Informe Técnico: ${parte.informe_tecnico}` : ''}
` : ''}

${(parte.dni_cliente || parte.cliente_telefono || parte.acepta_proteccion_datos) ? `
👤 DATOS DEL CLIENTE
${parte.dni_cliente ? `  • DNI del Cliente: ${parte.dni_cliente}` : ''}
${parte.cliente_telefono ? `  • Teléfono: ${parte.cliente_telefono}` : ''}
${parte.acepta_proteccion_datos !== undefined ? `  • Protección de Datos: ${parte.acepta_proteccion_datos ? 'Aceptado ✓' : 'No aceptado'}` : ''}
` : ''}

${parte.fotos_json ? (() => {
  try {
    const fotos = JSON.parse(parte.fotos_json);
    if (Array.isArray(fotos) && fotos.length > 0) {
      return `
📸 FOTOS DEL SERVICIO
  • Se adjuntan ${fotos.length} foto(s) en este correo
`;
    }
  } catch (e) {
    return '';
  }
  return '';
})() : ''}

═══════════════════════════════════════════════════
Este es un resumen automático del parte de trabajo.
Si tiene alguna duda o consulta, contacte con nosotros.

MisterClima - Servicio técnico especializado
Email: sat@misterclima.es
═══════════════════════════════════════════════════
    `.trim();

    // Enviar el email
    const from = config.smtp.from || 'sat@misterclima.es';
    
    // ✅ Preparar adjuntos (fotos) si existen
    const attachments = [];
    if (parte.fotos_json) {
      try {
        const fotos = JSON.parse(parte.fotos_json);
        if (Array.isArray(fotos) && fotos.length > 0) {
          fotos.forEach((foto, index) => {
            // Las fotos vienen en formato base64 con prefijo "data:image/jpeg;base64,"
            if (foto.data && foto.data.startsWith('data:')) {
              attachments.push({
                filename: foto.nombre || `foto_${index + 1}.jpg`,
                content: foto.data.split(',')[1], // Extraer solo el base64 sin el prefijo
                encoding: 'base64',
                cid: `foto${index + 1}` // Content-ID para usar en el HTML
              });
            }
          });
          
          console.log(`📎 ${attachments.length} foto(s) adjunta(s) al email`);
        }
      } catch (parseError) {
        console.error('⚠️ Error parseando fotos para adjuntar:', parseError.message);
        // Continuar sin fotos en caso de error
      }
    }
    
    try {
      const mailOptions = {
        from,
        to: parte.cliente_email.trim(),
        subject,
        text: textBody,
        html: htmlBody,
      };
      
      // Añadir adjuntos solo si hay fotos
      if (attachments.length > 0) {
        mailOptions.attachments = attachments;
      }
      
      const info = await transporter.sendMail(mailOptions);

      // Validar que el email fue aceptado
      if (!info.accepted || info.accepted.length === 0) {
        console.error('❌ Email rechazado por el servidor SMTP:', {
          accepted: info.accepted,
          rejected: info.rejected,
          pending: info.pending,
        });
        
        return res.status(500).json({
          ok: false,
          message: 'El servidor SMTP rechazó el email',
          details: info.rejected && info.rejected.length > 0 
            ? `Destinatarios rechazados: ${info.rejected.join(', ')}`
            : 'Email no aceptado',
        });
      }

      console.log('✅ Email enviado exitosamente:', {
        mode: smtpMode,
        messageId: info.messageId,
        to: parte.cliente_email,
        parteId: parte.id,
        accepted: info.accepted,
      });
      
      // Si es cuenta de prueba, obtener URL de vista previa
      let previewUrl = null;
      if (smtpMode === 'test' && nodemailer.getTestMessageUrl) {
        previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          console.log('📧 Vista previa del email (cuenta de prueba):', previewUrl);
        }
      }

      return res.status(200).json({
        ok: true,
        message: smtpMode === 'real' 
          ? 'Email enviado exitosamente' 
          : 'Email enviado a cuenta de prueba (desarrollo)',
        messageId: info.messageId,
        to: parte.cliente_email,
        subject,
        mode: smtpMode, // 'real' | 'test'
        previewUrl: previewUrl,
      });
    } catch (emailError) {
      console.error('❌ Error al enviar email:', {
        error: emailError.message,
        code: emailError.code,
        responseCode: emailError.responseCode,
        command: emailError.command,
        parteId: parte.id,
        to: parte.cliente_email,
      });
      
      // Determinar código de error específico
      let errorCode = 'SMTP_SEND_FAILED';
      let errorMessage = 'Error al enviar el email';
      
      if (emailError.responseCode === 535 || emailError.message.includes('535')) {
        errorCode = 'SMTP_AUTH_FAILED';
        errorMessage = 'Error de autenticación SMTP al enviar';
      } else if (emailError.code === 'ETIMEDOUT' || emailError.code === 'ECONNREFUSED') {
        errorCode = 'SMTP_CONNECTION_FAILED';
        errorMessage = 'No se pudo conectar al servidor SMTP';
      } else if (emailError.code === 'ESOCKET') {
        errorCode = 'SMTP_TLS_ERROR';
        errorMessage = 'Error de conexión SSL/TLS';
      } else if (emailError.responseCode === 550) {
        errorCode = 'SMTP_MAILBOX_UNAVAILABLE';
        errorMessage = 'Buzón del destinatario no disponible';
      } else if (emailError.responseCode === 554) {
        errorCode = 'SMTP_TRANSACTION_FAILED';
        errorMessage = 'Transacción SMTP rechazada';
      }
      
      return res.status(500).json({
        ok: false,
        error: errorCode,
        message: errorMessage,
        details: {
          originalError: emailError.message,
          code: emailError.code,
          responseCode: emailError.responseCode,
        },
      });
    }
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
