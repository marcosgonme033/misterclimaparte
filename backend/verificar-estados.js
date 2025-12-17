#!/usr/bin/env node

/**
 * Script de verificación para diagnosticar problemas de partes faltantes
 * Uso: node verificar-estados.js
 * 
 * IMPORTANTE: Ejecutar este script en el servidor de producción
 * con acceso a la BD MySQL
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function verificarEstados() {
  let connection;

  try {
    log('\n🔍 INICIANDO VERIFICACIÓN DE ESTADOS EN BD...', 'bright');
    log('='.repeat(60), 'cyan');

    // Conectar a la BD
    log('\n📡 Conectando a la base de datos...', 'blue');
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    log('✅ Conexión exitosa\n', 'green');

    // 1. Total de partes
    log('📊 TOTAL DE PARTES:', 'bright');
    const [totalRows] = await connection.query('SELECT COUNT(*) as total FROM partes');
    log(`   Total: ${totalRows[0].total} partes\n`, 'cyan');

    // 2. Distribución por estado (RAW - sin normalización)
    log('📊 DISTRIBUCIÓN POR ESTADO (valores reales en BD):', 'bright');
    const [estadosRaw] = await connection.query(`
      SELECT estado, COUNT(*) as count 
      FROM partes 
      GROUP BY estado 
      ORDER BY count DESC
    `);

    let tieneEstadosAntiguos = false;
    estadosRaw.forEach(row => {
      const esAntiguo = ['revisado', 'visitado', 'reparado'].includes(row.estado);
      if (esAntiguo) tieneEstadosAntiguos = true;

      const color = esAntiguo ? 'yellow' : 'green';
      const marker = esAntiguo ? '⚠️' : '✅';
      log(`   ${marker} ${row.estado.padEnd(20)} : ${row.count}`, color);
    });

    if (tieneEstadosAntiguos) {
      log('\n⚠️  ADVERTENCIA: Se detectaron estados antiguos en la BD', 'yellow');
      log('   El backend debería normalizarlos automáticamente.', 'yellow');
      log('   Si no aparecen en frontend, verificar normalización.\n', 'yellow');
    } else {
      log('\n✅ Todos los estados están actualizados\n', 'green');
    }

    // 3. Distribución por técnico
    log('📊 DISTRIBUCIÓN POR TÉCNICO:', 'bright');
    const [tecnicos] = await connection.query(`
      SELECT nombre_tecnico, COUNT(*) as count 
      FROM partes 
      GROUP BY nombre_tecnico 
      ORDER BY count DESC
      LIMIT 10
    `);

    tecnicos.forEach(row => {
      log(`   👤 ${row.nombre_tecnico.padEnd(30)} : ${row.count} partes`, 'cyan');
    });

    // 4. Distribución por estado Y técnico
    log('\n📊 MATRIZ: TÉCNICO x ESTADO:', 'bright');
    const [matriz] = await connection.query(`
      SELECT 
        nombre_tecnico,
        estado,
        COUNT(*) as count
      FROM partes
      GROUP BY nombre_tecnico, estado
      ORDER BY nombre_tecnico, estado
    `);

    const tecnicoMap = {};
    matriz.forEach(row => {
      if (!tecnicoMap[row.nombre_tecnico]) {
        tecnicoMap[row.nombre_tecnico] = {};
      }
      tecnicoMap[row.nombre_tecnico][row.estado] = row.count;
    });

    const todosEstados = [...new Set(matriz.map(r => r.estado))];
    
    log(`   ${'Técnico'.padEnd(25)} | ${todosEstados.join(' | ')}`, 'bright');
    log(`   ${'-'.repeat(80)}`, 'cyan');

    Object.keys(tecnicoMap).forEach(tecnico => {
      const counts = todosEstados.map(estado => 
        (tecnicoMap[tecnico][estado] || 0).toString().padStart(estado.length)
      );
      log(`   ${tecnico.padEnd(25)} | ${counts.join(' | ')}`, 'cyan');
    });

    // 5. Verificar duplicados o problemas comunes
    log('\n🔎 VERIFICACIONES ADICIONALES:', 'bright');

    // 5.1. Partes sin técnico asignado
    const [sinTecnico] = await connection.query(`
      SELECT COUNT(*) as count 
      FROM partes 
      WHERE nombre_tecnico IS NULL OR nombre_tecnico = ''
    `);
    if (sinTecnico[0].count > 0) {
      log(`   ⚠️  ${sinTecnico[0].count} partes sin técnico asignado`, 'yellow');
    } else {
      log('   ✅ Todos los partes tienen técnico asignado', 'green');
    }

    // 5.2. Nombres de técnicos con espacios extras
    const [espacios] = await connection.query(`
      SELECT DISTINCT nombre_tecnico
      FROM partes
      WHERE nombre_tecnico != TRIM(nombre_tecnico)
    `);
    if (espacios.length > 0) {
      log(`   ⚠️  ${espacios.length} técnicos con espacios extras:`, 'yellow');
      espacios.forEach(row => {
        log(`      "${row.nombre_tecnico}"`, 'yellow');
      });
      log('   Ejecutar: UPDATE partes SET nombre_tecnico = TRIM(nombre_tecnico);', 'magenta');
    } else {
      log('   ✅ No hay nombres con espacios extras', 'green');
    }

    // 5.3. Números de parte duplicados
    const [duplicados] = await connection.query(`
      SELECT numero_parte, COUNT(*) as count
      FROM partes
      GROUP BY numero_parte
      HAVING count > 1
    `);
    if (duplicados.length > 0) {
      log(`   ⚠️  ${duplicados.length} números de parte duplicados:`, 'red');
      duplicados.forEach(row => {
        log(`      ${row.numero_parte} (${row.count} veces)`, 'red');
      });
    } else {
      log('   ✅ No hay números de parte duplicados', 'green');
    }

    // 6. Generar script de migración si es necesario
    if (tieneEstadosAntiguos) {
      log('\n📝 SCRIPT DE MIGRACIÓN (ejecutar solo si normalización automática falla):', 'bright');
      log(`
-- ⚠️  EJECUTAR SOLO SI LOS PARTES NO APARECEN EN FRONTEND
-- El backend normaliza automáticamente, este script es respaldo

START TRANSACTION;

UPDATE partes SET estado = 'ausentes' WHERE estado = 'reparado';
UPDATE partes SET estado = 'visitas_realizadas' WHERE estado = 'visitado';
UPDATE partes SET estado = 'revisando' WHERE estado = 'revisado';

-- Verificar cambios antes de confirmar
SELECT estado, COUNT(*) FROM partes GROUP BY estado;

-- Si todo está bien:
COMMIT;

-- Si algo salió mal:
-- ROLLBACK;
      `.trim(), 'magenta');
    }

    log('\n' + '='.repeat(60), 'cyan');
    log('✅ VERIFICACIÓN COMPLETADA\n', 'green');

  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, 'red');
    log(`   Code: ${error.code}`, 'red');
    log(`   SQL State: ${error.sqlState}`, 'red');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar
verificarEstados().catch(err => {
  log(`\n❌ Error fatal: ${err.message}`, 'red');
  process.exit(1);
});
