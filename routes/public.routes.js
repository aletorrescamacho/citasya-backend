const express = require('express');
const router = express.Router();
const publicController = require('../controllers/public.controller');

// Devuelve info de la empresa
router.get('/:slug', publicController.getInfoEmpresa);
/*
http://localhost:3000/empresa/tamanaco-spa
*/


// Reservar cita
router.post('/:slug/reservar', publicController.agendarCita);
/*
http://localhost:3000/empresa/tamanaco-spa/reservar

{
  "clienteNombre": "Luis Soriano",
  "cedula": "12345678",
  "correo": "luis@mail.com",
  "telefono": "04140001122",
  "servicioId": 1,
  "fecha": "2025-04-28",
  "hora": "10:00"
}

*/
//////////////////////////////////////

//Cancelar citas
router.post('/:slug/cancelar', publicController.cancelarCita);
/*
http://localhost:3000/empresa/tamanaco-spa/cancelar
{
  "cedula": "12345678",
  "fecha": "2025-04-25",
  "hora": "10:00"
}
 */


///////////////////////////////////////////////////////////////////////////
// Horarios disponibles para reservar
router.get('/:slug/horarios-disponibles', publicController.obtenerHorariosDisponibles);


router.get('/:slug/servicios', publicController.obtenerServiciosPorEmpresa);
router.get('/:slug/empleados', publicController.obtenerEmpleadosPorEmpresa);


router.get('/:slug/fechas-horarios', publicController.obtenerFechasYHorarios);

module.exports = router;
