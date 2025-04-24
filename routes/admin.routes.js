// routes/admin.routes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');

// Crear empresa
router.post('/empresa', adminController.crearEmpresa);
/*
http://localhost:3000/admin/empresa

{
  "nombre": "Tamanaco Spa",
  "slug": "tamanaco-spa",
  "contacto": "0414-0000000"
}
*/
/////////////////////////////////////////////////

// Crear credenciales
router.post('/credenciales', adminController.crearCredenciales);
/* 
http://localhost:3000/admin/credenciales
{
  "usuario": "admin-tamanaco",
  "llave": "123456",
  "empresaSlug": "tamanaco-spa"
}
*/
///////////////////////////////////////////


// Crear servicio
router.post('/servicio', adminController.crearServicio);
/*
http://localhost:3000/admin/servicio
{
  "empresaSlug": "tamanaco-spa",
  "nombre": "Quiropedia completa",
  "duracion": 45,
  "precio": 20.0
}
 */
/////////////////////////////////////


//Crear empleado
router.post('/empleado', adminController.crearEmpleado);

/*
http://localhost:3000/admin/empleado
{
  "nombre": "Yelitza Pérez",
  "empresaSlug": "tamanaco-spa"
}
*/



module.exports = router;