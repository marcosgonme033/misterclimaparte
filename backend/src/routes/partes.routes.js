// BeeSoftware/backend/src/routes/partes.routes.js
// Rutas para la gestión de partes con autenticación

const express = require('express');
const router = express.Router();
const partesController = require('../controllers/partes.controller');
const { authMiddleware, requireAdmin } = require('../middleware/auth.middleware');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// GET /api/partes/tecnicos - Obtener lista de técnicos (solo admin)
router.get('/tecnicos', requireAdmin, partesController.getTecnicos);

// PUT /api/partes/orden - Actualizar orden de partes (batch)
router.put('/orden', partesController.updatePartesOrden);

// GET /api/partes - Obtener partes según rol (admin: todos, user: solo suyos)
router.get('/', partesController.getPartes);

// GET /api/partes/:id - Obtener un parte específico
router.get('/:id', partesController.getParteById);

// POST /api/partes - Crear un nuevo parte (solo admin)
router.post('/', requireAdmin, partesController.createParte);

// PUT /api/partes/:id - Actualizar un parte
router.put('/:id', partesController.updateParte);

// POST /api/partes/:id/enviar-email - Enviar email al cliente
router.post('/:id/enviar-email', partesController.enviarEmailCliente);

// DELETE /api/partes/:id - Eliminar un parte (solo admin)
router.delete('/:id', requireAdmin, partesController.deleteParte);

module.exports = router;
