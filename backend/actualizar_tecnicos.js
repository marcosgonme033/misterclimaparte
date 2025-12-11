// Script para actualizar técnicos directamente en MySQL
const mysql = require('mysql2/promise');
require('dotenv').config();

async function actualizarTecnicos() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'beesoftware'
  });

  try {
    console.log('✅ Conectado a MySQL');
    
    // 1. Ver técnicos actuales en usuarios
    console.log('\n📋 TÉCNICOS ACTUALES EN USUARIOS:');
    const [usuarios] = await connection.query(
      'SELECT id, username, name, role FROM usuarios WHERE role = "user" ORDER BY name'
    );
    console.table(usuarios);

    // 2. Ver técnicos actuales en partes
    console.log('\n📋 TÉCNICOS EN PARTES (ÚNICOS):');
    const [partes] = await connection.query(
      'SELECT DISTINCT nombre_tecnico, COUNT(*) as cantidad FROM partes GROUP BY nombre_tecnico ORDER BY nombre_tecnico'
    );
    console.table(partes);

    // 3. LIMPIAR ESPACIOS
    console.log('\n🧹 Limpiando espacios...');
    await connection.query('UPDATE partes SET nombre_tecnico = TRIM(nombre_tecnico) WHERE nombre_tecnico IS NOT NULL');

    // 4. NORMALIZAR JOSÉ
    console.log('✏️ Normalizando José...');
    await connection.query(
      "UPDATE partes SET nombre_tecnico = 'José' WHERE nombre_tecnico IN ('Jose', 'jose', 'JOSE', 'José', 'josé', 'JOSÉ')"
    );
    await connection.query(
      "UPDATE usuarios SET name = 'José' WHERE username = 'jose' AND role = 'user'"
    );

    // 5. NORMALIZAR TADAS
    console.log('✏️ Normalizando Tadas...');
    await connection.query(
      "UPDATE partes SET nombre_tecnico = 'Tadas' WHERE nombre_tecnico IN ('tadas', 'TADAS', 'Tadas', 'Tadas tecnico')"
    );
    await connection.query(
      "UPDATE usuarios SET name = 'Tadas' WHERE username = 'tadas' AND role = 'user'"
    );

    // 6. NORMALIZAR ENRIQUE
    console.log('✏️ Normalizando Enrique...');
    await connection.query(
      "UPDATE partes SET nombre_tecnico = 'Enrique' WHERE nombre_tecnico IN ('enrique', 'ENRIQUE', 'Enrique', 'Enrique tecnico')"
    );
    await connection.query(
      "UPDATE usuarios SET name = 'Enrique' WHERE username = 'enrique' AND role = 'user'"
    );

    // 7. NORMALIZAR DEVE
    console.log('✏️ Normalizando Deve...');
    await connection.query(
      "UPDATE partes SET nombre_tecnico = 'Deve' WHERE nombre_tecnico IN ('deve', 'DEVE', 'Deve')"
    );
    await connection.query(
      "UPDATE usuarios SET name = 'Deve' WHERE username = 'deve' AND role = 'user'"
    );

    // 8. ELIMINAR ANTONIO
    console.log('🗑️ Eliminando Antonio...');
    await connection.query(
      "DELETE FROM usuarios WHERE username = 'antonio' AND role = 'user'"
    );
    await connection.query(
      "UPDATE partes SET nombre_tecnico = NULL WHERE nombre_tecnico = 'Antonio'"
    );

    // 9. VERIFICAR RESULTADO EN USUARIOS
    console.log('\n✅ RESULTADO FINAL - USUARIOS:');
    const [usuariosFinales] = await connection.query(
      'SELECT id, username, name, role FROM usuarios WHERE role = "user" ORDER BY name'
    );
    console.table(usuariosFinales);

    // 10. VERIFICAR RESULTADO EN PARTES
    console.log('\n✅ RESULTADO FINAL - PARTES:');
    const [partesFinales] = await connection.query(
      'SELECT DISTINCT nombre_tecnico, COUNT(*) as cantidad FROM partes GROUP BY nombre_tecnico ORDER BY nombre_tecnico'
    );
    console.table(partesFinales);

    console.log('\n🎉 ¡Normalización completada!');
    console.log('✅ Deben aparecer SOLO: Deve, Enrique, José, Tadas');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
    console.log('\n🔌 Desconectado de MySQL');
  }
}

actualizarTecnicos();
