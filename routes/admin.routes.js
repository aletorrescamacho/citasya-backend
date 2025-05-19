// routes/admin.routes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const EstadisticasController = require('../controllers/estadisticas.controller')

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

///////////////////////////////////////////////////

//Asignar horarios al empleado
router.post('/empleado/horario', adminController.asignarHorario);

/*
http://localhost:3000/admin/empleado/horario
{
  "empleadoId": 1,
  "dia": "lunes",
  "horaInicio": "08:00",
  "horaFin": "13:00"
}

*/

/////////////////////////////////////////////////////

// Asignar servicios que realiza el empleado
router.post('/empleado/servicio', adminController.vincularServicio);

/*
http://localhost:3000/admin/empleado/servicio
{
  "empleadoId": 1,
  "servicioId": 1
}

*/

///////////////////////////////////////////

// Editar servicio
router.put('/servicio/:id', adminController.editarServicio);
/*
http://localhost:3000/admin/servicio/1
PUT
{
  "nombre": "Quiropedia avanzada",
  "duracion": 60,
  "precio": 25.0
}

*/

///////////////////////////////////////////

// Eliminar servicio
router.delete('/servicio/:id', adminController.eliminarServicio);
/*
DELETE
http://localhost:3000/admin/servicio/1


*/

/////////////////////////////////////////////////////////////////

// Editar empleado
router.put('/empleado/:id', adminController.editarEmpleado);
/*
http://localhost:3000/admin/empleado/1
PUT

{
  "nombre": "Yelitza González",
  "horarios": [
    { "dia": "lunes", "horaInicio": "08:00", "horaFin": "13:00" },
    { "dia": "miércoles", "horaInicio": "10:00", "horaFin": "14:00" }
  ],
  "servicios": [1, 2]
}

*/

/////////////////////////////////////////////////////////////////////////////////

// Eliminar empleado
router.delete('/empleado/:id', adminController.eliminarEmpleado);

/*
http://localhost:3000/admin/empleado/1
DELETE
*/

/////////////////////////////////////////////////////////////////////////////////

// Iniciar sesión como admin
router.post('/login', adminController.loginAdmin);

/*
http://localhost:3000/admin/login

{
  "usuario": "admin-tamanaco",
  "llave": "123456"
}



*/

/////////////////////////////////////////////////////////////////

// Ver citas como admin
router.get('/citas/:empresaSlug', adminController.obtenerCitas);

/*
http://localhost:3000/admin/citas/tamanaco-spa
GET
*/

router.get('/empleado/:id', adminController.obtenerEmpleadoCompleto);



router.get('/estadisticas/:slug/citas-por-mes', EstadisticasController.citasPorMes)
router.get('/estadisticas/:slug/citas-por-empleado', EstadisticasController.citasPorEmpleado)
router.get('/estadisticas/:slug/citas-por-servicio', EstadisticasController.citasPorServicio)
router.get('/estadisticas/:slug/citas-por-dia-ultimos-7', EstadisticasController.citasPorDiaUltimos7)
router.get('/estadisticas/:slug/citas-por-anio', EstadisticasController.citasPorAnio)



router.get("/citas/:slug/total", adminController.getTotalCitas)



module.exports = router;