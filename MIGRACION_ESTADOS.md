# Migración de Estados del Sistema BeeSoftware

## 📋 Resumen de Cambios

Este documento detalla los cambios realizados en el sistema BeeSoftware para migrar de los estados antiguos a los nuevos estados del flujo de trabajo de partes.

### Estados Antiguos → Nuevos

| Estado Antiguo | Estado Nuevo |
|----------------|--------------|
| `inicial` | `inicial` (sin cambios) |
| `revisado` | `revisando` |
| `visitado` | `visitas_realizadas` |
| `reparado` | `ausentes` |

## 🗂️ Archivos Modificados

### 1. Base de Datos - Script de Migración
**Archivo:** `backend/sql/migration_statuses.sql`

- ✅ Creado script SQL para migrar todos los registros existentes
- ✅ Incluye verificaciones antes y después de la migración
- ✅ Actualiza índices para optimizar rendimiento

**Instrucciones de ejecución:**
```bash
# Conectar a MySQL y ejecutar:
mysql -u usuario -p beesoftware < backend/sql/migration_statuses.sql
```

### 2. Backend - Controlador
**Archivo:** `backend/src/controllers/partes.controller.js`

**Cambios realizados:**
- ✅ Actualizada constante `ESTADOS_VALIDOS` con los nuevos estados
- ✅ Agregada función `normalizarEstado()` para mapeo de compatibilidad
- ✅ Agregado mapeo `ESTADO_LEGACY_MAP` para convertir estados antiguos
- ✅ Modificadas validaciones de estado en `updateParte()`
- ✅ Actualizada función `enviarEmailCliente()` para usar nuevos estados
- ✅ Eliminadas restricciones de edición basadas en estado 'reparado'

**Mapeo de compatibilidad:**
```javascript
const ESTADO_LEGACY_MAP = {
  'revisado': 'revisando',
  'visitado': 'visitas_realizadas',
  'reparado': 'ausentes'
};
```

### 3. Backend - Repositorio
**Archivo:** `backend/src/repositories/partes.repository.js`

**Cambios realizados:**
- ✅ Actualizado ORDER BY en `getAllPartes()` con nuevos estados
- ✅ Actualizado ORDER BY en `getPartesByTecnico()` con nuevos estados
- ✅ Orden de prioridad: inicial (1) → revisando (2) → visitas_realizadas (3) → ausentes (4)

### 4. Frontend - Tablero Kanban
**Archivo:** `frontend/src/PartesBoard.jsx`

**Cambios realizados:**
- ✅ Actualizada constante `COLUMNS` con nuevos estados y títulos
- ✅ Actualizado el campo `estado` en `formData` inicial
- ✅ Modificadas condiciones para mostrar campos según estado:
  - Campos básicos: disponibles en todos los estados
  - Observaciones del técnico: desde `revisando`
  - Informe técnico y fotos: desde `visitas_realizadas`
- ✅ **Agregados mini-botones de cambio de estado** en el modal de edición
- ✅ **Reubicados botones de estado** encima del botón "Guardar cambios"
- ✅ Eliminadas todas las restricciones `disabled` basadas en 'reparado'
- ✅ Actualizado envío de emails para estados `visitas_realizadas` y `ausentes`

### 5. Nuevas Funcionalidades del Modal de Edición

#### Mini-botones de Estado
Los botones de cambio de estado ahora están ubicados **justo encima del botón "Guardar cambios"** con:
- ✅ Indicador visual del estado actualmente seleccionado
- ✅ Colores distintivos para cada estado
- ✅ Instrucción clara: "Selecciona el nuevo estado y luego pulsa 'Guardar cambios'"
- ✅ **El estado seleccionado se persiste al guardar** el parte

#### Comportamiento del Guardado
- Cuando cambias el estado usando los mini-botones y pulsas "Guardar cambios":
  1. El estado se actualiza en la base de datos
  2. El tablero se refresca automáticamente
  3. El parte aparece en la columna correspondiente al nuevo estado

## 🔄 Compatibilidad con Clientes Antiguos

El backend incluye mapeo automático para convertir estados antiguos:
- Si un cliente antiguo envía `estado: 'revisado'` → se guarda como `'revisando'`
- Si un cliente antiguo envía `estado: 'visitado'` → se guarda como `'visitas_realizadas'`
- Si un cliente antiguo envía `estado: 'reparado'` → se guarda como `'ausentes'`

Esto garantiza que no haya pérdida de datos durante la transición.

## ✅ Checklist de Validación

### Antes del Despliegue
- [ ] Ejecutar script de migración SQL en base de datos de desarrollo
- [ ] Verificar que no quedan estados antiguos en BD: 
  ```sql
  SELECT id, numero_parte, estado FROM partes 
  WHERE estado IN ('revisado', 'visitado', 'reparado');
  ```
  - Debe devolver 0 resultados
- [ ] Reiniciar backend para cargar nuevas validaciones
- [ ] Limpiar caché del navegador antes de probar frontend

### Pruebas Funcionales
- [ ] **Login** como admin y técnico funcionan correctamente
- [ ] **Admin** ve todos los partes, **técnico** solo los suyos
- [ ] **Tablero Kanban** muestra 4 columnas con los títulos correctos:
  - Parte inicial
  - Revisando
  - Visitas realizadas
  - Ausentes
- [ ] **Drag & Drop** entre columnas funciona y persiste
- [ ] **Drag & Drop** dentro de la misma columna (reordenamiento) funciona
- [ ] **Crear nuevo parte** asigna estado "inicial" correctamente
- [ ] **Modal de edición:**
  - Los mini-botones de estado aparecen encima de "Guardar cambios"
  - Al seleccionar un estado y guardar, el parte se mueve a la columna correcta
  - Los campos se habilitan/deshabilitan según el estado seleccionado
- [ ] **Filtros** por técnico y población siguen funcionando
- [ ] **Búsqueda** por número de parte y población funciona
- [ ] **Autorefresco** cada 60 segundos sigue activo
- [ ] No aparecen partes "fantasma" ni columnas vacías por estados antiguos

### Pruebas de Email
- [ ] Enviar email desde estado `visitas_realizadas` funciona
- [ ] Enviar email desde estado `ausentes` funciona
- [ ] Email no se puede enviar desde `inicial` o `revisando`

## 📊 Impacto en Datos Existentes

### Antes de la Migración
Ejemplo de registros en BD:
```
id  | numero_parte | estado    
----|--------------|----------
1   | 100001       | inicial
2   | 100002       | revisado
3   | 100003       | visitado
4   | 100004       | reparado
```

### Después de la Migración
```
id  | numero_parte | estado              
----|--------------|--------------------
1   | 100001       | inicial
2   | 100002       | revisando
3   | 100003       | visitas_realizadas
4   | 100004       | ausentes
```

## 🚨 Problemas Conocidos y Soluciones

### Problema: Partes no aparecen en el tablero
**Causa:** Estados antiguos en BD que el frontend no reconoce  
**Solución:** Ejecutar script `migration_statuses.sql`

### Problema: Error "Estado inválido" al actualizar parte
**Causa:** Envío de estado antiguo desde cliente  
**Solución:** El backend ahora mapea automáticamente estados antiguos

### Problema: Los botones de estado no cambian el parte de columna
**Causa:** Falta enviar el campo `estado` en el payload de actualización  
**Solución:** Ya implementado - `formData.estado` se incluye en `parteData`

## 📞 Soporte

Si encuentras algún problema después de la migración:
1. Verifica que el script SQL se ejecutó correctamente
2. Revisa los logs del backend para mensajes de error
3. Verifica que el frontend esté usando la última versión del código
4. Comprueba que no hay estados antiguos en BD con la query de validación

## 🎯 Próximos Pasos

1. **Ejecutar migración en producción:**
   - Hacer backup de la base de datos
   - Ejecutar `migration_statuses.sql`
   - Desplegar nuevo código de backend
   - Desplegar nuevo código de frontend
   
2. **Monitorear:**
   - Logs de backend para detectar mapeos de estados antiguos
   - Comportamiento de usuarios en el tablero
   - Tiempo de carga de partes

3. **Optimización futura:**
   - Considerar crear ENUM en MySQL para el campo `estado`
   - Añadir índice compuesto `(estado, orden)` si no existe
   - Implementar notificaciones cuando un parte cambia de estado

---

**Fecha de migración:** 17 de Diciembre de 2025  
**Versión:** 2.0.0  
**Autor:** Sistema de migración automática BeeSoftware
