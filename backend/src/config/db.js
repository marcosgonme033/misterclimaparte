// backend/src/config/db.js
const mysql = require('mysql2/promise');
const config = require('./env');

// Pool de conexiones MySQL
const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.name,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
});

// Variable para saber si MySQL está disponible
let mysqlAvailable = false;

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log('✅ Conectado a MySQL: ' + config.db.name + ' en ' + config.db.host + ':' + config.db.port);
    mysqlAvailable = true;
    return true;
  } catch (err) {
    console.error('❌ No se pudo conectar a MySQL');
    console.error('   Host: ' + config.db.host + ':' + config.db.port);
    console.error('   Error: ' + err.message);
    
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
      console.error('');
      console.error('⚠️  El servidor MySQL remoto no es accesible desde esta red.');
      console.error('💡 Causas comunes:');
      console.error('   • Tu IP no está en la lista blanca del servidor MySQL');
      console.error('   • Firewall bloqueando el puerto 3306');
      console.error('   • El servidor requiere VPN');
      console.error('');
      console.error('✅ SOLUCIÓN TEMPORAL: Usando usuarios en memoria para desarrollo');
      console.error('   → Puedes hacer login con: marcos / 1234');
      console.error('   → En producción, el servidor SÍ tendrá acceso a MySQL');
      console.error('');
    }
    
    mysqlAvailable = false;
    return false;
  }
}

function isMysqlAvailable() {
  return mysqlAvailable;
}

module.exports = { pool, testConnection, isMysqlAvailable };
