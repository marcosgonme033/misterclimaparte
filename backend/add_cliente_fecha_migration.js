// Script para añadir columnas nombre_cliente y fecha_parte
const mysql = require('mysql2/promise');
require('dotenv').config();

async function addColumns() {
  let connection;
  
  try {
    // Crear conexión
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'beesoftware'
    });

    console.log('✅ Conectado a MySQL');
    console.log(`📊 Base de datos: ${process.env.DB_NAME}`);

    // Verificar si las columnas ya existen
    console.log('\n🔍 Verificando columnas existentes...');
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'partes'`,
      [process.env.DB_NAME]
    );
    
    const columnNames = columns.map(c => c.COLUMN_NAME);
    const nombreClienteExists = columnNames.includes('nombre_cliente');
    const fechaParteExists = columnNames.includes('fecha_parte');

    // Añadir nombre_cliente si no existe
    if (!nombreClienteExists) {
      console.log('\n➕ Añadiendo columna nombre_cliente...');
      await connection.query(
        `ALTER TABLE partes 
         ADD COLUMN nombre_cliente VARCHAR(255) NULL 
         AFTER numero_parte`
      );
      console.log('✅ Columna nombre_cliente añadida correctamente');
    } else {
      console.log('ℹ️  La columna nombre_cliente ya existe');
    }

    // Añadir fecha_parte si no existe
    if (!fechaParteExists) {
      console.log('\n➕ Añadiendo columna fecha_parte...');
      await connection.query(
        `ALTER TABLE partes 
         ADD COLUMN fecha_parte DATE NULL 
         AFTER nombre_cliente`
      );
      console.log('✅ Columna fecha_parte añadida correctamente');
    } else {
      console.log('ℹ️  La columna fecha_parte ya existe');
    }

    // Mostrar estructura final de la tabla
    console.log('\n📋 Estructura final de la tabla partes:');
    const [finalColumns] = await connection.query(
      `SHOW COLUMNS FROM partes`
    );
    finalColumns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    console.log('\n✅ Migración completada con éxito');
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

// Ejecutar migración
addColumns()
  .then(() => {
    console.log('\n🎉 Script completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 El script falló:', error);
    process.exit(1);
  });
