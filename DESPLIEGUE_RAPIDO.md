# 🚀 Despliegue Rápido - Fix Partes Faltantes en Producción

## ⚡ Pasos Inmediatos (5 minutos)

### 1. Subir código al servidor
```bash
# En tu máquina local
cd C:\Users\marco\Desktop\BeeSoftware\backend
git add .
git commit -m "Fix: Normalización estados + diagnóstico partes faltantes"
git push origin main
```

### 2. Actualizar en producción
```bash
# SSH al servidor o cPanel Terminal
cd /path/to/backend
git pull origin main
npm install
pm2 restart beesoftware-backend  # O usar restart desde cPanel
```

### 3. Verificar deployment
Abrir en navegador:
```
https://misterclima.es/api/version
```
Debes ver `timestamp` reciente.

### 4. Activar modo debug TEMPORALMENTE
```bash
# Editar .env en producción
DEBUG_PARTES=true

# Reiniciar
pm2 restart beesoftware-backend
```

### 5. Reproducir y ver logs
```bash
# Ver logs en tiempo real
pm2 logs beesoftware-backend --lines 100

# O si no usas PM2
tail -f /var/log/node-app.log
```

### 6. Probar endpoint de diagnóstico
Como admin, hacer login y luego:
```bash
curl -H "Authorization: Bearer TU_TOKEN_AQUI" \
     https://misterclima.es/api/partes/debug/summary
```

Buscar en respuesta:
- `total`: debe coincidir con total real en BD
- `porEstadoRaw`: debe incluir "ausentes" o "reparado"
- `porTecnico`: debe listar todos los técnicos

### 7. Desactivar debug
```bash
# .env
DEBUG_PARTES=false

# Reiniciar
pm2 restart beesoftware-backend
```

---

## ✅ Qué Se Ha Corregido

### 1. Normalización Automática de Estados
- `reparado` → `ausentes`  
- `visitado` → `visitas_realizadas`  
- `revisado` → `revisando`

**NO necesitas migrar la BD manualmente**. El backend convierte automáticamente.

### 2. Filtro por Técnico Mejorado
Ahora ignora mayúsculas/minúsculas y espacios:
```sql
WHERE LOWER(TRIM(nombre_tecnico)) = LOWER(TRIM(?))
```

### 3. Logging Detallado (controlado por DEBUG_PARTES)
Cada petición a `/api/partes` loguea:
- Usuario y rol
- Filtro aplicado
- Total partes devueltos
- Conteo por estado

### 4. Endpoint de Diagnóstico
`GET /api/partes/debug/summary` (solo admin)
Muestra resumen de BD sin necesitar SQL.

### 5. Endpoint de Versión
`GET /api/version` (público)
Para verificar que el deployment funcionó.

---

## 🔍 Troubleshooting Rápido

### Problema: `/api/version` da 404
**Causa:** Código viejo en producción  
**Solución:**
```bash
cd /path/to/backend
git status  # Ver si hay cambios
git pull
pm2 restart beesoftware-backend
```

### Problema: "Ausentes" sigue vacío
**Causa:** Estados antiguos en BD  
**Diagnóstico:**
```bash
# Ver endpoint debug
curl -H "Authorization: Bearer TOKEN" \
     https://misterclima.es/api/partes/debug/summary
```

Si ves `"reparado": 20` pero "ausentes" está vacío → normalización no está aplicándose.

**Solución temporal (manual):**
```sql
UPDATE partes SET estado = 'ausentes' WHERE estado = 'reparado';
UPDATE partes SET estado = 'visitas_realizadas' WHERE estado = 'visitado';
UPDATE partes SET estado = 'revisando' WHERE estado = 'revisado';
```

### Problema: Técnico no ve sus partes
**Diagnóstico:** Ver logs (con DEBUG_PARTES=true), buscar:
```
Total partes devueltos: 0
```

**Causa probable:** Nombre técnico con tildes o espacios diferentes.

**Solución:**
```sql
-- Ver nombres exactos
SELECT DISTINCT nombre_tecnico FROM partes;

-- Normalizar espacios
UPDATE partes SET nombre_tecnico = TRIM(nombre_tecnico);
```

---

## 📊 Validación Final

1. ✅ Login como admin → ver contador "Ausentes" > 0
2. ✅ Login como técnico → ver sus partes en todos los estados
3. ✅ Drag & drop funciona
4. ✅ Modal de edición funciona
5. ✅ Envío de email funciona

---

## 📁 Archivos Modificados

```
backend/
├── src/
│   ├── controllers/partes.controller.js  ← Logging + normalización
│   ├── repositories/partes.repository.js ← Filtro case-insensitive + debug
│   ├── routes/partes.routes.js           ← Nuevas rutas
│   └── index.js                          ← Endpoint versión global
├── .env.example                           ← Nuevas variables documentadas
└── (ningún cambio en frontend necesario)
```

---

## 📞 Si Nada Funciona

1. Verificar que backend arranca sin errores:
```bash
pm2 logs beesoftware-backend --err
```

2. Verificar conexión a BD:
```bash
curl https://misterclima.es/health/db
```

3. Verificar variables de entorno:
```bash
# En servidor
cat .env | grep DEBUG
cat .env | grep DB_
```

4. Revisar documento completo: `DIAGNOSTICO_PRODUCCION.md`

---

**Tiempo estimado total:** 10-15 minutos  
**Riesgo:** Bajo (solo añade logging y normalización, no modifica BD)
