// Script para agregar técnico Deve
const mysql = require('mysql2/promise');
require('dotenv').config();

async function agregarDeve() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'beesoftware'
  });

  try {
    console.log('✅ Conectado a MySQL');
    
    // Verificar si Deve existe
    const [deveExiste] = await connection.query(
      "SELECT * FROM usuarios WHERE username = 'deve'"
    );
    
    if (deveExiste.length > 0) {
      console.log('ℹ️ El usuario Deve ya existe, actualizando nombre...');
      await connection.query(
        "UPDATE usuarios SET name = 'Deve', role = 'user' WHERE username = 'deve'"
      );
    } else {
      console.log('➕ Creando usuario Deve...');
      // Nota: Necesitarás establecer una contraseña adecuada
      await connection.query(
        "INSERT INTO usuarios (username, password, name, role) VALUES ('deve', '$2b$10$defaultpasswordhash', 'Deve', 'user')"
      );
    }

    // Verificar resultado
    console.log('\n✅ TODOS LOS TÉCNICOS:');
    const [tecnicos] = await connection.query(
      'SELECT id, username, name, role FROM usuarios WHERE role = "user" ORDER BY name'
    );
    console.table(tecnicos);
    
    if (tecnicos.length === 4) {
      console.log('\n🎉 ¡Perfecto! Los 4 técnicos válidos están en la BD');
    } else {
      console.log(`\n⚠️ Se encontraron ${tecnicos.length} técnicos, deberían ser 4`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

agregarDeve();
