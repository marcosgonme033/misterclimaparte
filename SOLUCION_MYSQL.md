# 🔧 SOLUCIÓN: Error de Conexión a MySQL

## ❌ Problema Detectado

El servidor MySQL remoto **204.93.189.82:3306** no es accesible desde tu red local. Error: `ETIMEDOUT` o `ECONNREFUSED`

## ✅ Soluciones Disponibles

### OPCIÓN 1: Túnel SSH (Recomendado para desarrollo)

Si tienes acceso SSH al servidor, crea un túnel:

```bash
ssh -L 3306:localhost:3306 tu_usuario@204.93.189.82
```

Luego en `.env` usa:
```dotenv
DB_HOST=localhost
DB_PORT=3306
```

---

### OPCIÓN 2: Instalar MySQL Local (XAMPP)

1. **Descarga e instala XAMPP**: https://www.apachefriends.org/download.html

2. **Inicia MySQL** desde el panel de XAMPP

3. **Crea la base de datos**:
   ```bash
   # Abre phpMyAdmin: http://localhost/phpmyadmin
   # Crea una base de datos llamada: ysqytyxn_ddbbMrClimaPartes
   ```

4. **Importa las tablas** (ejecuta en phpMyAdmin):
   ```sql
   CREATE TABLE usuarios (
     id INT PRIMARY KEY AUTO_INCREMENT,
     username VARCHAR(50) UNIQUE NOT NULL,
     password VARCHAR(255) NOT NULL,
     name VARCHAR(100),
     role VARCHAR(20) DEFAULT 'tecnico'
   );

   INSERT INTO usuarios (username, password, name, role) 
   VALUES ('marcos', '1234', 'Marcos - BeeSoftware', 'admin');

   CREATE TABLE partes (
     id INT PRIMARY KEY AUTO_INCREMENT,
     numero_parte VARCHAR(50) UNIQUE NOT NULL,
     aparato VARCHAR(100),
     marca VARCHAR(100),
     modelo VARCHAR(100),
     serie VARCHAR(100),
     observaciones TEXT,
     cliente VARCHAR(100),
     direccion VARCHAR(255),
     telefono VARCHAR(20),
     email VARCHAR(100),
     estado ENUM('inicial','revisado','visitado','reparado') DEFAULT 'inicial',
     tecnico_asignado VARCHAR(100),
     foto_base64 LONGTEXT,
     fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     orden INT DEFAULT 0
   );
   ```

5. **Actualiza `.env`**:
   ```dotenv
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=ysqytyxn_ddbbMrClimaPartes
   DB_USER=root
   DB_PASSWORD=
   ```

---

### OPCIÓN 3: VPN al Servidor

Si tu empresa tiene VPN, conéctate a ella para acceder al servidor 204.93.189.82

---

### OPCIÓN 4: Configurar MySQL para Conexiones Remotas

En el servidor 204.93.189.82, asegúrate de:

1. **MySQL permite conexiones remotas**:
   ```bash
   # my.cnf o my.ini
   bind-address = 0.0.0.0
   ```

2. **Firewall permite el puerto 3306**:
   ```bash
   sudo ufw allow 3306
   ```

3. **Usuario tiene permisos remotos**:
   ```sql
   GRANT ALL PRIVILEGES ON ysqytyxn_ddbbMrClimaPartes.* 
   TO 'ysqytyxn_usrMarcos'@'%' IDENTIFIED BY 'c2GU[1oKC+%oY8$B';
   FLUSH PRIVILEGES;
   ```

---

## 🚀 Inicio Rápido con XAMPP (Más fácil)

```bash
# 1. Instala XAMPP
# https://www.apachefriends.org/download.html

# 2. Abre el panel de XAMPP

# 3. Click en "Start" en MySQL

# 4. Abre phpMyAdmin: http://localhost/phpmyadmin

# 5. Click en "Nueva" para crear base de datos

# 6. Nombre: ysqytyxn_ddbbMrClimaPartes

# 7. Click en SQL y pega el código de las tablas (arriba)

# 8. Actualiza .env:
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=

# 9. Reinicia el backend
cd backend
npm start
```

---

## ✅ Verificar que Funciona

Después de configurar:

```bash
cd backend
npm start
```

Deberías ver:
```
📦 [MySQL] Conexión OK contra localhost:3306 / ysqytyxn_ddbbMrClimaPartes
```

---

## 🔍 Mejoras Aplicadas

He actualizado:
- ✅ `backend/src/config/db.js` - Timeout de 10s y mejor manejo de errores
- ✅ Mensajes de error más descriptivos con soluciones
- ✅ Detección automática del tipo de error (timeout, credenciales, BD no existe)

---

## 🎯 Recomendación

Para **desarrollo local**, usa **OPCIÓN 2 (XAMPP)**.  
Para **producción**, mantén el servidor remoto con VPN o túnel SSH.
