# 🔐 VARIABLES DE ENTORNO - CONFIGURACIÓN PARA PRODUCCIÓN

## 📋 Variables para Render.com

Copia y pega estas variables en la sección **Environment** de Render.com:

```
NODE_ENV=production
PORT=10000
FRONTEND_URL=https://misterclima.es/partes
DB_HOST=204.93.189.82
DB_PORT=3306
DB_NAME=ysqytyxn_ddbbMrClimaPartes
DB_USER=ysqytyxn_usrMarcos
DB_PASSWORD=c2GU[1oKC+%oY8$B
JWT_SECRET=CAMBIAR_POR_SECRET_ALEATORIO_LARGO
```

⚠️ **IMPORTANTE**: Genera un `JWT_SECRET` seguro ejecutando:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 📋 Variables para VPS (archivo .env)

Crea el archivo `.env` en tu servidor con este contenido:

```bash
# Conecta por SSH
cd /var/www/beesoftware-backend
nano .env
```

Contenido del archivo `.env`:

```dotenv
# ============================================
# BEESOFTWARE - PRODUCCIÓN
# ============================================

# SERVIDOR
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://misterclima.es/partes

# BASE DE DATOS
DB_HOST=204.93.189.82
DB_PORT=3306
DB_NAME=ysqytyxn_ddbbMrClimaPartes
DB_USER=ysqytyxn_usrMarcos
DB_PASSWORD=c2GU[1oKC+%oY8$B

# SEGURIDAD
JWT_SECRET=CAMBIAR_POR_SECRET_ALEATORIO_LARGO
JWT_EXPIRES_IN=15m

# EMAIL (Opcional)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER=tu-email@gmail.com
# SMTP_PASS=tu-app-password
# FROM_EMAIL=no-reply@misterclima.es
```

---

## 🔄 Variables de Frontend

### Para desarrollo local:
**Archivo**: `frontend/.env.development`
```dotenv
VITE_API_URL=http://localhost:5000
```

### Para producción:
**Archivo**: `frontend/.env.production`

**Si usas Render.com**, actualiza con tu URL:
```dotenv
VITE_API_URL=https://beesoftware-api.onrender.com
```

**Si usas VPS con dominio propio**:
```dotenv
VITE_API_URL=https://api.misterclima.es
```

---

## 🛠️ Cómo aplicar cambios en el Frontend

Después de cambiar `frontend/.env.production`:

```bash
cd frontend
npm run build
```

Luego sube el contenido de `dist/` a `/public_html/partes/`

---

## ⚡ Generador de JWT_SECRET

Ejecuta uno de estos comandos para generar un secret seguro:

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))

# Online
# https://www.grc.com/passwords.htm
```

Ejemplo de output:
```
a7f4e2b8c9d1e6f3a0b5c7d8e9f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9
```

Usa ese valor para `JWT_SECRET`.

---

## 🧪 Verificar Variables

### En tu servidor (VPS):
```bash
cd /var/www/beesoftware-backend
pm2 restart beesoftware-api
pm2 logs beesoftware-api --lines 50
```

Deberías ver:
```
✅ Servidor escuchando en 0.0.0.0:5000
🌍 Entorno: production
🔗 CORS habilitado para: [ 'https://misterclima.es', ... ]
📦 [MySQL] Conexión OK contra 204.93.189.82
```

### En Render.com:
Ve a **Logs** y verifica la salida similar.

---

## 🎯 Checklist Final de Variables

Antes de desplegar, verifica:

- [ ] `NODE_ENV` = `production`
- [ ] `PORT` configurado (5000 para VPS, 10000 para Render)
- [ ] `FRONTEND_URL` = `https://misterclima.es/partes`
- [ ] `DB_HOST` = IP correcta de MySQL
- [ ] `DB_PASSWORD` = Contraseña real (no placeholder)
- [ ] `JWT_SECRET` = Valor aleatorio generado (no el de ejemplo)
- [ ] Frontend `.env.production` apunta al backend correcto
- [ ] Build del frontend regenerado con nueva URL

---

## 🚨 Errores Comunes

### Error: "Not allowed by CORS"
**Causa**: `FRONTEND_URL` no coincide con el dominio real  
**Solución**: Verifica que sea exactamente `https://misterclima.es/partes`

### Error: "connect ECONNREFUSED"
**Causa**: MySQL no es accesible  
**Solución**: Verifica IP, puerto, y que MySQL permita conexiones externas

### Error: "Authentication failed"
**Causa**: Credenciales de MySQL incorrectas  
**Solución**: Verifica `DB_USER` y `DB_PASSWORD`

### Frontend muestra "Network Error"
**Causa**: URL del backend incorrecta en `.env.production`  
**Solución**: Regenera el build después de corregir la URL

---

## 📞 Comandos Útiles

### Ver variables en Render:
1. Ve a tu servicio
2. Click en **Environment**
3. Verifica cada variable

### Ver variables en VPS:
```bash
cd /var/www/beesoftware-backend
cat .env
```

### Recargar variables (VPS):
```bash
pm2 restart beesoftware-api
```

### Test de conexión MySQL:
```bash
cd backend
node -e "require('./src/config/db').testConnection()"
```

---

## ✅ Variables Correctamente Configuradas

Cuando todo está bien, verás en los logs:

```
🚀 API BeeSoftware - PRODUCCIÓN
✅ Servidor escuchando en 0.0.0.0:5000
🌍 Entorno: production
🔗 CORS habilitado para: [
  'https://misterclima.es',
  'https://misterclima.es/partes',
  ...
]
📦 [MySQL] Conexión OK contra 204.93.189.82 ysqytyxn_ddbbMrClimaPartes
✉️ Mailer configurado con cuenta de prueba (Ethereal)
🎉 Servidor completamente inicializado
```

---

## 🎉 Listo!

Con estas variables correctamente configuradas, tu aplicación funcionará perfectamente en producción.

**Recuerda**:
1. Cambiar `JWT_SECRET`
2. Verificar `DB_PASSWORD`
3. Regenerar build del frontend si cambias la URL del backend
4. Probar con el checklist de `VERIFICACION_DESPLIEGUE.md`
