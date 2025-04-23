// routes/admin.routes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');

// Crear empresa
router.post('/empresa', adminController.crearEmpresa);

// Crear credenciales
router.post('/credenciales', adminController.crearCredenciales);

module.exports = router;