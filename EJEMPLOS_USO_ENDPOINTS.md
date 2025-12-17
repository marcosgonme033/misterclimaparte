# 🧪 Ejemplos de Uso - Endpoints de Diagnóstico

## 📌 Endpoints Nuevos

### 1. GET /api/version (público)
### 2. GET /api/partes/version (con autenticación)
### 3. GET /api/partes/debug/summary (solo admin)

---

## 1️⃣ Verificar Versión del Backend (Sin Autenticación)

### Local
```bash
curl http://localhost:5000/api/version
```

### Producción
```bash
curl https://misterclima.es/api/version
```

### Respuesta Esperada
```json
{
  "ok": true,
  "version": "1.0.0",
  "environment": "production",
  "buildDate": "2025-12-17T10:30:00.000Z",
  "gitCommit": "abc123def",
  "nodeVersion": "v18.17.0",
  "timestamp": "2025-12-17T16:45:23.456Z"
}
```

### Uso
- Verificar que el deployment funcionó (timestamp reciente)
- Confirmar que producción corre en `environment: "production"`
- Comparar `gitCommit` con el último commit en repo

---

## 2️⃣ Obtener Resumen de Diagnóstico (Solo Admin)

### Paso 1: Hacer Login y Obtener Token

**Local:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "marcos", "password": "1234"}'
```

**Producción:**
```bash
curl -X POST https://misterclima.es/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "marcos", "password": "TU_PASSWORD_REAL"}'
```

**Respuesta:**
```json
{
  "ok": true,
  "token": "fake-jwt-token-beesoftware",
  "user": {
    "id": "1",
    "username": "marcos",
    "name": "Marcos - BeeSoftware",
    "role": "admin"
  }
}
```

Copiar el `token` para usarlo en siguientes peticiones.

---

### Paso 2: Consultar Diagnóstico

**Local:**
```bash
curl http://localhost:5000/api/partes/debug/summary \
  -H "Authorization: Bearer fake-jwt-token-beesoftware"
```

**Producción:**
```bash
curl https://misterclima.es/api/partes/debug/summary \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

**Respuesta Esperada:**
```json
{
  "ok": true,
  "data": {
    "total": 150,
    "porEstadoRaw": [
      { "estado": "inicial", "count": 45 },
      { "estado": "revisando", "count": 25 },
      { "estado": "revisado", "count": 5 },
      { "estado": "visitas_realizadas", "count": 40 },
      { "estado": "visitado", "count": 10 },
      { "estado": "ausentes", "count": 15 },
      { "estado": "reparado", "count": 10 }
    ],
    "porTecnico": [
      { "nombre_tecnico": "Juan Pérez", "count": 75 },
      { "nombre_tecnico": "María García", "count": 50 },
      { "nombre_tecnico": "Carlos López", "count": 25 }
    ]
  }
}
```

---

### Interpretación de la Respuesta

#### `total`
Total de partes en la base de datos.

#### `porEstadoRaw`
Distribución de partes por estado **tal cual están en la BD** (sin normalización).

**⚠️ Si ves estados antiguos (`revisado`, `visitado`, `reparado`):**
- Es normal si la BD no se ha migrado manualmente
- El backend normaliza automáticamente al devolver datos
- Si no aparecen en frontend → verificar normalización en repository

**✅ Si solo ves estados nuevos (`inicial`, `revisando`, `visitas_realizadas`, `ausentes`):**
- La BD ya está migrada
- Todo funciona correctamente

#### `porTecnico`
Distribución de partes por técnico asignado.

**Uso:**
- Verificar que todos los técnicos tienen partes asignados
- Detectar si hay técnicos con muchos partes vs pocos

---

## 3️⃣ Ejemplos con JavaScript (Frontend)

### Verificar Versión del Backend

```javascript
async function verificarVersion() {
  try {
    const response = await fetch('https://misterclima.es/api/version');
    const data = await response.json();
    
    console.log('Versión del backend:', data.version);
    console.log('Entorno:', data.environment);
    console.log('Última actualización:', new Date(data.timestamp).toLocaleString());
    
    return data;
  } catch (error) {
    console.error('Error al verificar versión:', error);
  }
}

// Llamar al cargar la app
verificarVersion();
```

---

### Obtener Diagnóstico (desde Frontend con Token)

```javascript
async function obtenerDiagnostico() {
  try {
    const token = localStorage.getItem('token'); // O desde tu estado global
    
    const response = await fetch('https://misterclima.es/api/partes/debug/summary', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.table(data.data.porEstadoRaw);
    console.table(data.data.porTecnico);
    
    return data;
  } catch (error) {
    console.error('Error al obtener diagnóstico:', error);
  }
}

// Llamar desde DevTools o componente de admin
obtenerDiagnostico();
```

---

## 4️⃣ Verificación con Postman

### Colección de Postman

#### Request 1: Verificar Versión
- **Método:** GET
- **URL:** `https://misterclima.es/api/version`
- **Headers:** (ninguno)
- **Auth:** None

#### Request 2: Login
- **Método:** POST
- **URL:** `https://misterclima.es/api/auth/login`
- **Headers:** 
  - Content-Type: application/json
- **Body (raw JSON):**
```json
{
  "username": "marcos",
  "password": "1234"
}
```
- **Auth:** None
- **Variables a guardar:** `token` de la respuesta

#### Request 3: Diagnóstico
- **Método:** GET
- **URL:** `https://misterclima.es/api/partes/debug/summary`
- **Headers:**
  - Authorization: Bearer {{token}}
- **Auth:** Bearer Token (usar variable `{{token}}`)

---

## 5️⃣ Ejemplos de Troubleshooting

### Problema: Endpoint /api/version da 404

**Síntoma:**
```bash
$ curl https://misterclima.es/api/version
{"error": "Not Found"}
```

**Causa:** Backend no actualizado en producción

**Solución:**
```bash
# SSH al servidor
cd /path/to/backend
git pull origin main
pm2 restart beesoftware-backend

# Verificar nuevamente
curl https://misterclima.es/api/version
```

---

### Problema: Endpoint /api/partes/debug/summary da 403

**Síntoma:**
```json
{
  "ok": false,
  "message": "No autorizado"
}
```

**Causa 1:** No eres admin y `DEBUG_PARTES=false`

**Solución:**
```bash
# Opción A: Login como admin
curl -X POST https://misterclima.es/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "ADMIN_USER", "password": "ADMIN_PASS"}'

# Opción B: Activar DEBUG_PARTES en .env
DEBUG_PARTES=true
# Reiniciar backend
pm2 restart beesoftware-backend
```

**Causa 2:** Token expirado

**Solución:** Hacer login nuevamente y obtener nuevo token

---

### Problema: porEstadoRaw muestra "reparado" pero frontend no muestra "Ausentes"

**Síntoma:**
```json
{
  "porEstadoRaw": [
    { "estado": "reparado", "count": 25 }
  ]
}
```

Pero en frontend la columna "Ausentes" está vacía.

**Diagnóstico:**
```bash
# Verificar que normalización funciona
curl https://misterclima.es/api/partes \
  -H "Authorization: Bearer TOKEN"
```

Ver si los partes devueltos tienen `"estado": "ausentes"` (normalizado) o `"estado": "reparado"` (sin normalizar).

**Causa:** Normalización no se está aplicando

**Solución:**
1. Verificar que `backend/src/repositories/partes.repository.js` tiene:
```javascript
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

2. Verificar que `getAllPartes()` y `getPartesByTecnico()` llaman:
```javascript
return normalizarEstadosPartes(rows);
```

3. Si todo está bien pero sigue sin funcionar → migrar BD manualmente:
```sql
UPDATE partes SET estado = 'ausentes' WHERE estado = 'reparado';
UPDATE partes SET estado = 'visitas_realizadas' WHERE estado = 'visitado';
UPDATE partes SET estado = 'revisando' WHERE estado = 'revisado';
```

---

## 6️⃣ Script de Verificación en Node.js

### Uso
```bash
cd backend
node verificar-estados.js
```

### Salida Esperada
```
🔍 INICIANDO VERIFICACIÓN DE ESTADOS EN BD...
============================================================

📡 Conectando a la base de datos...
✅ Conexión exitosa

📊 TOTAL DE PARTES:
   Total: 150 partes

📊 DISTRIBUCIÓN POR ESTADO (valores reales en BD):
   ✅ inicial              : 45
   ⚠️  revisado            : 5
   ✅ revisando            : 25
   ⚠️  visitado            : 10
   ✅ visitas_realizadas   : 40
   ⚠️  reparado            : 10
   ✅ ausentes             : 15

⚠️  ADVERTENCIA: Se detectaron estados antiguos en la BD
   El backend debería normalizarlos automáticamente.
   Si no aparecen en frontend, verificar normalización.

📊 DISTRIBUCIÓN POR TÉCNICO:
   👤 Juan Pérez                     : 75 partes
   👤 María García                   : 50 partes
   👤 Carlos López                   : 25 partes

📊 MATRIZ: TÉCNICO x ESTADO:
   Técnico                   | inicial | revisado | revisando | visitado | visitas_realizadas | reparado | ausentes
   --------------------------------------------------------------------------------
   Juan Pérez                | 20      | 2        | 15        | 5        | 20                 | 5        | 8
   María García              | 15      | 2        | 8         | 3        | 12                 | 3        | 7
   Carlos López              | 10      | 1        | 2         | 2        | 8                  | 2        | 0

🔎 VERIFICACIONES ADICIONALES:
   ✅ Todos los partes tienen técnico asignado
   ✅ No hay nombres con espacios extras
   ✅ No hay números de parte duplicados

============================================================
✅ VERIFICACIÓN COMPLETADA
```

---

## 7️⃣ Monitoreo Continuo

### Activar Logging en Producción (Temporal)

**1. Editar .env:**
```env
DEBUG_PARTES=true
```

**2. Reiniciar backend:**
```bash
pm2 restart beesoftware-backend
```

**3. Ver logs en tiempo real:**
```bash
pm2 logs beesoftware-backend --lines 100
```

**4. Reproducir problema:**
- Login en frontend
- Navegar por tablero
- Ver logs en terminal

**5. Desactivar logging:**
```env
DEBUG_PARTES=false
```
```bash
pm2 restart beesoftware-backend
```

---

## 📝 Notas Importantes

1. **DEBUG_PARTES debe estar en false en producción normal**  
   Solo activar para troubleshooting temporal.

2. **El endpoint /api/version es útil para CI/CD**  
   Puedes integrarlo en pipelines para verificar deployment.

3. **porEstadoRaw muestra estados reales en BD**  
   No confundir con estados normalizados que ve el frontend.

4. **Token expira según JWT_EXPIRES_IN**  
   Por defecto 15 minutos. Renovar token si da 401.

---

**Última actualización:** 17 de diciembre de 2025  
**Proyecto:** BeeSoftware - Mr. Clima Partes
