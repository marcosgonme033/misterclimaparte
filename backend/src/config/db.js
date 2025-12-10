// backend/src/config/db.js
const mysql = require('mysql2/promise');
const config = require('./env');

// Configuración robusta del pool de conexiones MySQL
const poolConfig = {
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.name,
  
  // Configuración de conexiones
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  
  // Timeouts (en milisegundos)
  connectTimeout: 10000,      // 10 segundos para establecer conexión
  
  // Keep-alive para mantener conexiones activas
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  
  // Opciones para mejorar compatibilidad
  charset: 'utf8mb4',
  timezone: '+00:00',
  
  // Manejo de errores de conexión
  multipleStatements: false,
  dateStrings: false,
};

const pool = mysql.createPool(poolConfig);

// Log de configuración (sin password)
console.log('🔧 [MySQL] Configuración del pool:');
console.log(`   Host: ${config.db.host}:${config.db.port}`);
console.log(`   Database: ${config.db.name}`);
console.log(`   User: ${config.db.user}`);
console.log(`   Timeout: ${poolConfig.connectTimeout}ms`);

/**
 * Comprueba que la conexión a la BD funciona.
 * Se llama al arrancar el servidor.
 * @returns {Promise<boolean>} true si conectó exitosamente, false si falló
 */
async function testConnection() {
  try {
    console.log('🔄 [MySQL] Intentando conectar...');
    const conn = await pool.getConnection();
    await conn.ping();
    
    // Obtener información del servidor
    const [rows] = await conn.query('SELECT VERSION() as version, DATABASE() as db, USER() as user');
    conn.release();
    
    console.log('✅ [MySQL] ¡Conexión exitosa!');
    console.log(`   Servidor MySQL: ${rows[0].version}`);
    console.log(`   Base de datos: ${rows[0].db}`);
    console.log(`   Usuario conectado: ${rows[0].user}`);
    
    return true;
  } catch (err) {
    console.error('❌ [MySQL] ERROR DE CONEXIÓN');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`   Host: ${config.db.host}:${config.db.port}`);
    console.error(`   Database: ${config.db.name}`);
    console.error(`   User: ${config.db.user}`);
    console.error(`   Error: ${err.message}`);
    console.error(`   Código: ${err.code || 'N/A'}`);
    console.error(`   Estado SQL: ${err.sqlState || 'N/A'}`);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Diagnóstico según tipo de error
    console.error('💡 DIAGNÓSTICO:');
    
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
      console.error('   ⚠️  El servidor MySQL no es accesible desde tu red.');
      console.error('   Posibles causas:');
      console.error('   1. Firewall bloqueando puerto 3306');
      console.error('   2. IP incorrecta o servidor apagado');
      console.error('   3. Necesitas VPN o túnel SSH');
      console.error('   4. El hosting solo permite conexiones desde IPs específicas');
      console.error('');
      console.error('   Soluciones:');
      console.error('   → Verifica la IP en phpMyAdmin');
      console.error('   → Contacta al hosting para permitir acceso remoto');
      console.error('   → Usa túnel SSH: ssh -L 3306:localhost:3306 user@' + config.db.host);
      console.error('   → O instala MySQL local para desarrollo');
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   ⚠️  Usuario o contraseña incorrectos');
      console.error('   → Verifica DB_USER y DB_PASSWORD en el archivo .env');
      console.error('   → Asegúrate de que el usuario tiene permisos remotos');
    } else if (err.code === 'ER_BAD_DB_ERROR') {
      console.error('   ⚠️  La base de datos no existe');
      console.error('   → Verifica el nombre: ' + config.db.name);
      console.error('   → Créala en phpMyAdmin si no existe');
    } else if (err.code === 'ENOTFOUND') {
      console.error('   ⚠️  No se puede resolver el nombre del host');
      console.error('   → Verifica que la IP/dominio sea correcta: ' + config.db.host);
      console.error('   → Comprueba tu conexión a internet');
    } else {
      console.error('   ⚠️  Error desconocido - revisa la configuración');
    }
    
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('');
    
    return false;
  }
}

/**
 * Ejecuta una consulta de prueba simple
 * @returns {Promise<boolean>} true si la consulta fue exitosa
 */
async function testQuery() {
  try {
    const [rows] = await pool.query('SELECT 1 as test');
    return rows[0].test === 1;
  } catch (err) {
    console.error('❌ [MySQL] Error en consulta de prueba:', err.message);
    return false;
  }
}

module.exports = { pool, testConnection, testQuery };
