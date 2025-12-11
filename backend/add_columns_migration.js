// Script para añadir columnas dni_cliente y acepta_proteccion_datos
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
    const dniExists = columnNames.includes('dni_cliente');
    const aceptaExists = columnNames.includes('acepta_proteccion_datos');

    // Añadir dni_cliente si no existe
    if (!dniExists) {
      console.log('\n➕ Añadiendo columna dni_cliente...');
      await connection.query(
        `ALTER TABLE partes 
         ADD COLUMN dni_cliente VARCHAR(20) NULL 
         AFTER cliente_email`
      );
      console.log('✅ Columna dni_cliente añadida correctamente');
    } else {
      console.log('ℹ️  La columna dni_cliente ya existe');
    }

    // Añadir acepta_proteccion_datos si no existe
    if (!aceptaExists) {
      console.log('\n➕ Añadiendo columna acepta_proteccion_datos...');
      await connection.query(
        `ALTER TABLE partes 
         ADD COLUMN acepta_proteccion_datos BOOLEAN DEFAULT FALSE 
         AFTER ${dniExists ? 'dni_cliente' : 'cliente_email'}`
      );
      console.log('✅ Columna acepta_proteccion_datos añadida correctamente');
    } else {
      console.log('ℹ️  La columna acepta_proteccion_datos ya existe');
    }

    // Mostrar estructura final
    console.log('\n📋 Estructura final de la tabla partes:');
    const [structure] = await connection.query('DESCRIBE partes');
    console.table(structure);

    console.log('\n✅ ¡Migración completada exitosamente!');
    
  } catch (error) {
    console.error('\n❌ Error durante la migración:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Conexión cerrada');
    }
  }
}

// Ejecutar
addColumns();
