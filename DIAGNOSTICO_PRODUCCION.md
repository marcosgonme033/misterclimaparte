# 🔍 Guía de Diagnóstico y Solución - Partes Faltantes en Producción

## Problema Detectado
En producción (https://misterclima.es/partes/) faltan partes, especialmente en la columna "Ausentes", aunque en local (localhost:5173) se ven todos correctamente. Ambos apuntan a la misma base de datos.

## Cambios Implementados

### 1. ✅ Logging Detallado para Diagnóstico

Se ha añadido logging controlado por variable de entorno `DEBUG_PARTES` que permite diagnosticar en producción sin afectar el rendimiento normal.

**Activación:**
```env
# En .env de producción
DEBUG_PARTES=true
```

**Información que se loguea:**
- Usuario logueado (username, name, role)
- Filtro aplicado (nombre_tecnico si aplica)
- Total de partes devueltos
- Conteo por estado (inicial, revisando, visitas_realizadas, ausentes)
- Estados presentes en la respuesta
- Técnicos encontrados en BD

**Ubicación:** `backend/src/controllers/partes.controller.js` - función `getPartes()`

---

### 2. ✅ Normalización de Estados (Compatibilidad Retroactiva)

Se garantiza que el sistema funcione con estados antiguos y nuevos:

**Mapeo automático:**
- `revisado` → `revisando`
- `visitado` → `visitas_realizadas`  
- `reparado` → `ausentes`

**Aplicado en:**
- ✅ GET `/api/partes` - Todos los partes devueltos normalizan estados
- ✅ GET `/api/partes/:id` - Parte individual normalizado
- ✅ POST `/api/partes` - Nuevos partes con estado normalizado
- ✅ PUT `/api/partes/:id` - Actualizaciones con estado normalizado

**Ubicaciones:**
- `backend/src/repositories/partes.repository.js` - funciones `normalizarEstadoParte()` y `normalizarEstadosPartes()`
- `backend/src/controllers/partes.controller.js` - función `normalizarEstado()`

---

### 3. ✅ Filtro por Técnico Case-Insensitive

Se mejoró el filtro por técnico para evitar problemas con mayúsculas/minúsculas o espacios:

**Query mejorada:**
```sql
WHERE LOWER(TRIM(nombre_tecnico)) = LOWER(TRIM(?))
```

Esto soluciona problemas como:
- "Juan Pérez" vs "juan pérez"
- "José" vs " José " (con espacios)

**Ubicación:** `backend/src/repositories/partes.repository.js` - función `getPartesByTecnico()`

---

### 4. ✅ Endpoint de Diagnóstico Seguro

Nuevo endpoint protegido para obtener resumen de la base de datos:

**Endpoint:** `GET /api/partes/debug/summary`

**Requisitos:** Solo accesible para:
- Usuarios con rol `admin`
- O si `DEBUG_PARTES=true` en .env

**Respuesta:**
```json
{
  "ok": true,
  "data": {
    "total": 150,
    "porEstadoRaw": [
      { "estado": "inicial", "count": 45 },
      { "estado": "revisando", "count": 30 },
      { "estado": "visitas_realizadas", "count": 50 },
      { "estado": "ausentes", "count": 20 },
      { "estado": "reparado", "count": 5 }
    ],
    "porTecnico": [
      { "nombre_tecnico": "Juan Pérez", "count": 75 },
      { "nombre_tecnico": "María García", "count": 75 }
    ]
  }
}
```

**Nota:** `porEstadoRaw` muestra estados tal cual están en BD (sin normalización) para detectar estados antiguos.

**Ubicaciones:**
- Controller: `backend/src/controllers/partes.controller.js` - función `getDebugSummary()`
- Repository: `backend/src/repositories/partes.repository.js` - función `getDebugSummary()`
- Ruta: `backend/src/routes/partes.routes.js`

---

### 5. ✅ Endpoint de Versión (Verificar Deployment)

Nuevo endpoint **SIN autenticación** para verificar que producción corre el código actualizado:

**Endpoint:** `GET /api/version`

**Respuesta:**
```json
{
  "ok": true,
  "version": "1.0.0",
  "environment": "production",
  "buildDate": "2025-12-17T10:30:00.000Z",
  "gitCommit": "abc123def",
  "nodeVersion": "v18.17.0",
  "timestamp": "2025-12-17T15:45:00.000Z"
}
```

**Uso:**
```bash
# Verificar versión en local
curl http://localhost:5000/api/version

# Verificar versión en producción
curl https://misterclima.es/api/version
```

**Ubicaciones:**
- Global: `backend/src/index.js`
- En rutas de partes: `backend/src/routes/partes.routes.js`

---

## 📋 Checklist de Deployment en Producción

### Paso 1: Subir Código Actualizado
```bash
# Desde tu máquina local
git add .
git commit -m "Fix: Añadir diagnóstico y normalización de estados"
git push origin main
```

### Paso 2: Actualizar Backend en Servidor
```bash
# SSH al servidor o usar cPanel File Manager
cd /path/to/backend

# Pull del nuevo código
git pull origin main

# Instalar dependencias (si hay nuevas)
npm install

# Reiniciar el proceso Node
# Opción A: PM2
pm2 restart beesoftware-backend

# Opción B: cPanel Node App
# Ir al panel de cPanel → Setup Node.js App → Restart

# Opción C: Manualmente
pkill -f "node.*index.js"
npm run start
```

### Paso 3: Verificar que Producción Tiene el Nuevo Código
```bash
# Desde tu navegador o terminal
curl https://misterclima.es/api/version
```

Deberías ver `timestamp` actualizado y `environment: "production"`.

### Paso 4: Activar Modo Debug (Temporal)
```bash
# En el servidor, editar .env
DEBUG_PARTES=true

# Reiniciar backend
pm2 restart beesoftware-backend
```

### Paso 5: Reproducir el Problema
1. Inicia sesión en producción (https://misterclima.es/partes)
2. Como admin: ve la vista completa
3. Como técnico: filtra por técnico

### Paso 6: Revisar Logs del Servidor
```bash
# Ver logs en tiempo real
pm2 logs beesoftware-backend

# O si no usas PM2
tail -f /path/to/logs/app.log
```

**Busca líneas como:**
```
🔍 [DIAGNÓSTICO getPartes]
  Usuario logueado: { username: 'admin', name: 'Marcos', role: 'admin' }
  Filtro técnico: ninguno
  📋 Técnicos en BD: [ 'Juan Pérez', 'María García' ]
  📊 Total partes devueltos: 150
  📊 Por estado: { inicial: 45, revisando: 30, visitas_realizadas: 50, ausentes: 20, reparado: 5 }
  Estados presentes: [ 'inicial', 'revisando', 'visitas_realizadas', 'ausentes', 'reparado' ]
```

### Paso 7: Consultar Endpoint de Diagnóstico
```bash
# Con token de admin
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     https://misterclima.es/api/partes/debug/summary
```

Compara:
- Total en BD vs total mostrado en frontend
- Estados en `porEstadoRaw` (deben incluir 'ausentes' o 'reparado')

### Paso 8: Desactivar Modo Debug
```bash
# En .env
DEBUG_PARTES=false

# Reiniciar
pm2 restart beesoftware-backend
```

---

## 🔧 Posibles Causas y Soluciones

### Causa 1: Código Antiguo en Producción
**Síntoma:** Endpoint `/api/version` no existe o devuelve 404

**Solución:**
```bash
# Verificar que el servidor tiene el código nuevo
cd /path/to/backend
git log --oneline -5  # Ver últimos commits
git status            # Ver si hay cambios sin aplicar

# Pull y restart
git pull
pm2 restart beesoftware-backend
```

---

### Causa 2: Estados Antiguos en BD Sin Normalización
**Síntoma:** En `/api/partes/debug/summary` aparece `reparado` pero en frontend no hay partes en "Ausentes"

**Solución 1 (Automática - YA IMPLEMENTADA):**
El backend normaliza automáticamente `reparado` → `ausentes`. Verifica que:
```javascript
// backend/src/repositories/partes.repository.js
function normalizarEstadoParte(parte) {
  if (parte && parte.estado && ESTADO_LEGACY_MAP[parte.estado]) {
    return {
      ...parte,
      estado: ESTADO_LEGACY_MAP[parte.estado]
    };
  }
  return parte;
}
```

**Solución 2 (Manual - Solo si normalización falla):**
```sql
-- Ejecutar en MySQL
UPDATE partes SET estado = 'ausentes' WHERE estado = 'reparado';
UPDATE partes SET estado = 'visitas_realizadas' WHERE estado = 'visitado';
UPDATE partes SET estado = 'revisando' WHERE estado = 'revisado';
```

---

### Causa 3: Filtro por Técnico con Problemas de Nombre
**Síntoma:** Técnico no ve sus partes o ve menos de los esperados

**Diagnóstico:**
```bash
# Ver logs con DEBUG_PARTES=true
# Busca:
Usuario logueado: { username: 'juan', name: 'Juan Pérez', role: 'user' }
Filtro técnico: Juan Pérez
Total partes devueltos: 0  <-- PROBLEMA!
```

**Solución (YA IMPLEMENTADA):**
El filtro es ahora case-insensitive. Si persiste:

```sql
-- Verificar nombres exactos en BD
SELECT DISTINCT nombre_tecnico FROM partes;

-- Buscar técnico con espacios o tildes
SELECT nombre_tecnico, COUNT(*) 
FROM partes 
GROUP BY nombre_tecnico;
```

Normalizar si es necesario:
```sql
UPDATE partes SET nombre_tecnico = TRIM(nombre_tecnico);
```

---

### Causa 4: CORS o Caché del Navegador
**Síntoma:** Local funciona pero producción no, incluso con mismo backend

**Solución:**
```javascript
// Verificar CORS en backend/src/index.js
app.use(cors({
  origin: true,  // O especificar: 'https://misterclima.es'
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user'],
}));
```

En navegador:
1. Abrir DevTools (F12)
2. Network → Seleccionar petición `/api/partes`
3. Ver Response → ¿Llegan todos los partes?
4. Si sí → problema en frontend
5. Si no → problema en backend

**Limpiar caché:**
```bash
# En producción
Ctrl + Shift + R  # Hard reload
```

---

## 📊 Validación Final

### Test 1: Endpoint de Versión
```bash
curl https://misterclima.es/api/version
# Debe devolver timestamp reciente
```

### Test 2: Endpoint de Diagnóstico
```bash
curl -H "Authorization: Bearer TOKEN" \
     https://misterclima.es/api/partes/debug/summary
# Debe mostrar total correcto y estados
```

### Test 3: Login como Admin
1. Ir a https://misterclima.es/partes
2. Login como admin
3. Verificar contadores en columnas:
   - Inicial: X partes
   - Revisando: Y partes  
   - Visitas realizadas: Z partes
   - Ausentes: W partes

### Test 4: Login como Técnico
1. Login como técnico
2. Verificar que ve solo sus partes
3. Verificar que ve partes en TODOS los estados (inicial, revisando, visitas_realizadas, ausentes)

### Test 5: Drag & Drop
1. Mover un parte de "Inicial" a "Revisando"
2. Verificar que se guarda correctamente
3. Verificar que aparece en la columna correcta

### Test 6: Modal de Edición
1. Abrir un parte
2. Cambiar estado manualmente
3. Guardar
4. Verificar que el cambio persiste

---

## 🚀 Optimizaciones Adicionales (Opcional)

### 1. Índices en BD para Mejorar Performance
```sql
-- Crear índices para consultas más rápidas
CREATE INDEX idx_estado ON partes(estado);
CREATE INDEX idx_nombre_tecnico ON partes(nombre_tecnico);
CREATE INDEX idx_estado_tecnico ON partes(estado, nombre_tecnico);
```

### 2. Caché en Backend (Redis)
Si tienes muchos partes (>1000), considera añadir caché:
```javascript
// Ejemplo con node-cache
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 60 }); // 60 segundos

async function getAllPartes() {
  const cacheKey = 'all_partes';
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  
  const partes = await partesRepository.getAllPartes();
  cache.set(cacheKey, partes);
  return partes;
}
```

### 3. Paginación en Frontend
Si hay muchos partes, paginar la respuesta:
```javascript
// Backend
GET /api/partes?page=1&limit=50

// Frontend: lazy loading o infinite scroll
```

---

## 📞 Soporte

Si después de seguir esta guía el problema persiste:

1. **Recopilar evidencia:**
   - Screenshot del problema en producción
   - Logs del backend (con DEBUG_PARTES=true)
   - Respuesta de `/api/partes/debug/summary`
   - Respuesta de `/api/version`

2. **Verificar configuración:**
   - `.env` en producción tiene todos los campos
   - BD credentials son correctos
   - Puerto 5000 está libre y backend arranca sin errores

3. **Contactar:**
   - Desarrollador backend
   - Administrador del servidor

---

## 📝 Archivos Modificados

Todos los archivos con cambios:

1. **backend/src/controllers/partes.controller.js**
   - ✅ Logging detallado en `getPartes()`
   - ✅ Normalización de estados en `createParte()` y `updateParte()`
   - ✅ Nueva función `getDebugSummary()`
   - ✅ Nueva función `getVersion()`

2. **backend/src/repositories/partes.repository.js**
   - ✅ Filtro case-insensitive en `getPartesByTecnico()`
   - ✅ Nueva función `getDebugSummary()`

3. **backend/src/routes/partes.routes.js**
   - ✅ Ruta `GET /api/partes/debug/summary`
   - ✅ Ruta `GET /api/partes/version`

4. **backend/src/index.js**
   - ✅ Ruta global `GET /api/version`

5. **backend/.env.example**
   - ✅ Nueva variable `DEBUG_PARTES`
   - ✅ Nuevas variables de versión (APP_VERSION, BUILD_DATE, GIT_SHA)

---

**Última actualización:** 17 de diciembre de 2025  
**Versión del documento:** 1.0.0
