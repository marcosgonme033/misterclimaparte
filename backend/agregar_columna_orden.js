// Script para añadir la columna 'orden' a la tabla partes
const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306
};

async function agregarColumnaOrden() {
  let connection;
  
  try {
    console.log('📡 Conectando a la base de datos...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conexión exitosa\n');

    // 1. Verificar si la columna 'orden' ya existe
    console.log('🔍 Verificando si la columna "orden" existe...');
    const [columns] = await connection.query(`
      SHOW COLUMNS FROM partes LIKE 'orden'
    `);

    if (columns.length > 0) {
      console.log('⚠️  La columna "orden" ya existe en la tabla partes');
      console.log('✅ No es necesario hacer cambios\n');
      return;
    }

    console.log('➕ La columna "orden" no existe, procediendo a añadirla...\n');

    // 2. Añadir la columna 'orden' después de 'estado'
    console.log('📝 Ejecutando ALTER TABLE...');
    await connection.query(`
      ALTER TABLE partes 
      ADD COLUMN orden INT DEFAULT 0 AFTER estado
    `);
    console.log('✅ Columna "orden" añadida exitosamente\n');

    // 3. Inicializar valores de 'orden' para partes existentes
    console.log('🔢 Inicializando valores de "orden" para partes existentes...');
    
    // Obtener todos los estados únicos
    const [estados] = await connection.query('SELECT DISTINCT estado FROM partes');
    
    for (const { estado } of estados) {
      console.log(`  📋 Procesando estado: ${estado}`);
      
      // Obtener partes de este estado ordenados por created_at
      const [partes] = await connection.query(
        'SELECT id FROM partes WHERE estado = ? ORDER BY created_at ASC',
        [estado]
      );
      
      // Asignar orden secuencial (1, 2, 3, ...)
      for (let i = 0; i < partes.length; i++) {
        await connection.query(
          'UPDATE partes SET orden = ? WHERE id = ?',
          [i + 1, partes[i].id]
        );
      }
      
      console.log(`  ✅ ${partes.length} partes actualizados en estado "${estado}"`);
    }
    
    console.log('\n✅ Todos los valores de "orden" inicializados correctamente');

    // 4. Crear índice para optimizar consultas
    console.log('\n🗂️  Creando índice en columna "orden"...');
    await connection.query(`
      CREATE INDEX idx_estado_orden ON partes(estado, orden)
    `);
    console.log('✅ Índice creado exitosamente\n');

    // 5. Verificar resultado final
    console.log('🔍 Verificando resultado final:');
    const [verificacion] = await connection.query(`
      SELECT estado, COUNT(*) as total, MIN(orden) as min_orden, MAX(orden) as max_orden
      FROM partes
      GROUP BY estado
      ORDER BY estado
    `);
    
    console.log('\n📊 Resumen por estado:');
    console.table(verificacion);

    console.log('\n🎉 ¡Migración completada exitosamente!');

  } catch (error) {
    console.error('\n❌ Error durante la migración:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Conexión cerrada');
    }
  }
}

// Ejecutar script
agregarColumnaOrden()
  .then(() => {
    console.log('\n✅ Script finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script finalizado con errores');
    process.exit(1);
  });
