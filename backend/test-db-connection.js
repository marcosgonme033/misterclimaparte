// Test de conexión a MySQL con diferentes configuraciones
const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnection() {
  console.log('🔍 Probando conexión a MySQL...\n');
  
  const configs = [
    {
      name: 'Configuración 1: Directo desde .env',
      config: {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        connectTimeout: 10000,
      }
    },
    {
      name: 'Configuración 2: Sin especificar base de datos',
      config: {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectTimeout: 10000,
      }
    },
    {
      name: 'Configuración 3: Con opciones adicionales',
      config: {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        connectTimeout: 15000,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
      }
    }
  ];

  console.log('📋 Credenciales detectadas:');
  console.log(`   Host: ${process.env.DB_HOST}`);
  console.log(`   Port: ${process.env.DB_PORT}`);
  console.log(`   User: ${process.env.DB_USER}`);
  console.log(`   Database: ${process.env.DB_NAME}`);
  console.log(`   Password: ${process.env.DB_PASSWORD ? '[***' + process.env.DB_PASSWORD.slice(-4) + ']' : 'NO DEFINIDA'}`);
  console.log(`   Password Length: ${process.env.DB_PASSWORD ? process.env.DB_PASSWORD.length : 0} caracteres`);
  console.log(`   Caracteres especiales en password: ${/[^a-zA-Z0-9]/.test(process.env.DB_PASSWORD || '')}\n`);

  for (const { name, config } of configs) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📝 ${name}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    let connection = null;
    try {
      console.log('⏳ Intentando conectar...');
      connection = await mysql.createConnection(config);
      
      console.log('✅ Conexión establecida!');
      
      // Probar una consulta simple
      const [rows] = await connection.query('SELECT VERSION() as version, DATABASE() as db, NOW() as time');
      console.log('✅ Consulta ejecutada exitosamente:');
      console.log(`   MySQL Version: ${rows[0].version}`);
      console.log(`   Database: ${rows[0].db || 'NULL'}`);
      console.log(`   Server Time: ${rows[0].time}`);
      
      // Listar bases de datos disponibles
      try {
        const [databases] = await connection.query('SHOW DATABASES');
        console.log(`\n📊 Bases de datos disponibles (${databases.length}):`);
        databases.forEach(db => {
          console.log(`   - ${Object.values(db)[0]}`);
        });
      } catch (err) {
        console.log('⚠️  No se pudieron listar las bases de datos:', err.message);
      }
      
      // Verificar si la base de datos específica existe
      if (process.env.DB_NAME) {
        try {
          await connection.query(`USE ${process.env.DB_NAME}`);
          console.log(`\n✅ Base de datos '${process.env.DB_NAME}' existe y es accesible`);
          
          // Listar tablas
          const [tables] = await connection.query('SHOW TABLES');
          console.log(`📋 Tablas en la base de datos (${tables.length}):`);
          tables.forEach(table => {
            console.log(`   - ${Object.values(table)[0]}`);
          });
        } catch (err) {
          console.log(`\n❌ Error al usar la base de datos '${process.env.DB_NAME}':`, err.message);
        }
      }
      
      console.log('\n🎉 ¡ÉXITO! Esta configuración funciona correctamente.');
      break; // Si funciona, no necesitamos probar más
      
    } catch (error) {
      console.log('❌ Error en la conexión:');
      console.log(`   Código: ${error.code}`);
      console.log(`   Mensaje: ${error.message}`);
      console.log(`   SQL State: ${error.sqlState || 'N/A'}`);
      
      if (error.code === 'ETIMEDOUT') {
        console.log('\n💡 Diagnóstico: TIMEOUT');
        console.log('   - El servidor no responde en el tiempo límite');
        console.log('   - Posibles causas: Firewall, VPN desconectada, servidor caído');
      } else if (error.code === 'ECONNREFUSED') {
        console.log('\n💡 Diagnóstico: CONEXIÓN RECHAZADA');
        console.log('   - El servidor rechaza activamente la conexión');
        console.log('   - MySQL puede estar detenido en ese servidor');
      } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
        console.log('\n💡 Diagnóstico: ACCESO DENEGADO');
        console.log('   - Usuario o contraseña incorrectos');
        console.log('   - O el usuario no tiene permisos de conexión remota');
      } else if (error.code === 'ER_BAD_DB_ERROR') {
        console.log('\n💡 Diagnóstico: BASE DE DATOS NO EXISTE');
        console.log('   - La base de datos especificada no existe');
      }
    } finally {
      if (connection) {
        await connection.end();
        console.log('🔌 Conexión cerrada');
      }
    }
  }
}

testConnection().catch(err => {
  console.error('\n💥 Error fatal:', err);
  process.exit(1);
});
