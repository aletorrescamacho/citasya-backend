const prisma = require('../prismaClient');

exports.getInfoEmpresa = async (req, res) => {
  try {
    const { slug } = req.params;

    const empresa = await prisma.empresa.findUnique({
      where: { slug },
      include: {
        servicios: true,
        empleados: {
          include: {
            horarios: true,
            servicios: {
              include: { servicio: true }
            }
          }
        }
      }
    });

    if (!empresa) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    res.json({
      nombre: empresa.nombre,
      contacto: empresa.contacto,
      servicios: empresa.servicios,
      empleados: empresa.empleados.map(e => ({
        id: e.id,
        nombre: e.nombre,
        horarios: e.horarios,
        servicios: e.servicios.map(s => s.servicio)
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener información de la empresa' });
  }
};


const nodemailer = require('nodemailer');

exports.agendarCita = async (req, res) => {
    try {
      const { slug } = req.params;
      const {
        clienteNombre,
        cedula,
        correo,
        telefono,
        servicioId,
        fecha,
        hora,
        empleadoId // opcional
      } = req.body;
  
      if (!clienteNombre || !cedula || !correo || !telefono || !servicioId || !fecha || !hora) {
        return res.status(400).json({ error: 'Faltan campos obligatorios' });
      }
  
      const empresa = await prisma.empresa.findUnique({ where: { slug } });
      if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });
  
      let empleadoAsignadoId = empleadoId;
  
      // Si no se seleccionó empleado, buscar uno disponible
      if (!empleadoId) {
        // Para evitar problemas de zona horaria, añade "T12:00:00" a la fecha
        const fechaObj = new Date(fecha + 'T12:00:00');
  
        // Usamos un arreglo estático de días (en español)
        const weekdays = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
        // Si usas getUTCDay() podrías obtener el día correcto en UTC,
        // o usa getDay() si deseas el día según la configuración local.
        const dayName = weekdays[fechaObj.getDay()]; // o getUTCDay() según convenga
        console.log('Día generado para la fecha:', fecha, '=>', dayName); // 👈 este log
        // Busca todos los empleados vinculados al servicio
        const empleados = await prisma.empleadoServicio.findMany({
          where: { servicioId },
          include: {
            empleado: {
              include: {
                horarios: true,
                citas: {
                  where: {
                    fecha: new Date(fecha), // aqui la fecha se filtra según lo almacenado
                    // No se filtra por "hora" aquí ya que el campo "hora" no se puede filtrar
                    // directamente en un objeto Date: mejor lo validamos en el siguiente paso.
                  }
                }
              }
            }
          }
        });
  
        // Filtramos manualmente los que tienen horario disponible para el día
        const disponible = empleados.find(({ empleado }) =>
          empleado.horarios.some(h => h.dia.toLowerCase() === dayName.toLowerCase())
          // Opcional: además, podrías validar que no tenga una cita en ese mismo horario,
          // comparando la propiedad "hora" de cada cita (siempre y cuando formatees correctamente).
        );
  
        if (!disponible) {
          return res.status(409).json({ error: 'No hay empleados disponibles para ese horario' });
        }
  
        empleadoAsignadoId = disponible.empleado.id;
      }
  
      const cita = await prisma.cita.create({
        data: {
          clienteNombre,
          cedula,
          correo,
          telefono,
          fecha: new Date(fecha),
          hora,  // Asumiendo que 'hora' es un string (ej: "10:00")
          estado: 'activa',
          empresa: { connect: { id: empresa.id } },
          servicio: { connect: { id: servicioId } },
          empleado: { connect: { id: empleadoAsignadoId } }
        }
      });
  
      // Aquí podrías implementar el envío de correo usando nodemailer
      
      res.status(201).json({ mensaje: 'Cita agendada exitosamente', cita });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al agendar cita' });
    }
  };
  


  exports.cancelarCita = async (req, res) => {
    try {
      const { cedula, fecha, hora } = req.body;
  
      if (!cedula || !fecha || !hora) {
        return res.status(400).json({ error: 'Faltan campos' });
      }
  
      const cita = await prisma.cita.findFirst({
        where: {
          cedula,
          fecha: new Date(fecha),
          hora,
          estado: 'activa'
        }
      });
  
      if (!cita) {
        return res.status(404).json({ error: 'Cita no encontrada o ya cancelada' });
      }
  
      const citaCancelada = await prisma.cita.update({
        where: { id: cita.id },
        data: { estado: 'cancelada' }
      });
  
      res.json({ mensaje: 'Cita cancelada correctamente', cita: citaCancelada });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al cancelar la cita' });
    }
  };

  
  exports.obtenerHorariosDisponibles = async (req, res) => {
    try {
      const { slug } = req.params;
      const { servicioId, fecha, empleadoId } = req.query;
  
      if (!servicioId || !fecha) {
        return res.status(400).json({ error: 'Faltan parámetros obligatorios (servicioId y fecha)' });
      }
  
      const empresa = await prisma.empresa.findUnique({
        where: { slug }
      });
  
      if (!empresa) {
        return res.status(404).json({ error: 'Empresa no encontrada' });
      }
  
      const servicio = await prisma.servicio.findUnique({
        where: { id: parseInt(servicioId) }
      });
  
      if (!servicio) {
        return res.status(404).json({ error: 'Servicio no encontrado' });
      }
  
      const duracionServicio = servicio.duracion; // en minutos
  
      const fechaObj = new Date(fecha + 'T12:00:00');
      const weekdays = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
      const dayName = weekdays[fechaObj.getDay()];
  
      let empleados;
  
      if (empleadoId) {
        empleados = await prisma.empleado.findMany({
          where: {
            id: parseInt(empleadoId),
            empresaId: empresa.id,
            servicios: {
              some: { servicioId: parseInt(servicioId) }
            }
          },
          include: {
            horarios: true,
            citas: {
              where: {
                fecha: new Date(fecha),
                estado: 'activa'
              }
            }
          }
        });
      } else {
        empleados = await prisma.empleado.findMany({
          where: {
            empresaId: empresa.id,
            servicios: {
              some: { servicioId: parseInt(servicioId) }
            }
          },
          include: {
            horarios: true,
            citas: {
              where: {
                fecha: new Date(fecha),
                estado: 'activa'
              }
            }
          }
        });
      }
  
      const horariosDisponibles = [];
  
      for (const emp of empleados) {
        const horariosDia = emp.horarios.filter(h => h.dia.toLowerCase() === dayName.toLowerCase());
  
        for (const h of horariosDia) {
          let bloques = [];
  
          // Inicializamos los bloques desde la horaInicio hasta horaFin
          const inicioHora = parseInt(h.horaInicio.split(':')[0]);
          const inicioMin = parseInt(h.horaInicio.split(':')[1]);
          const finHora = parseInt(h.horaFin.split(':')[0]);
          const finMin = parseInt(h.horaFin.split(':')[1]);
  
          const startTotalMin = inicioHora * 60 + inicioMin;
          const endTotalMin = finHora * 60 + finMin;
  
          // Agregamos las citas actuales del día
          const citasOcupadas = emp.citas.map(cita => {
            const citaHora = parseInt(cita.hora.split(':')[0]);
            const citaMin = parseInt(cita.hora.split(':')[1]);
            const inicioCita = citaHora * 60 + citaMin;
            const finCita = inicioCita + duracionServicio; // ⬅️ Aquí deberías tener guardada la duración real de la cita si manejas servicios variables
            return { inicio: inicioCita, fin: finCita };
          });
  
          // Ordenamos las citas por inicio
          citasOcupadas.sort((a, b) => a.inicio - b.inicio);
  
          let currentTime = startTotalMin;
  
          for (const cita of citasOcupadas) {
            if (currentTime + duracionServicio <= cita.inicio) {
              bloques.push({ inicio: currentTime, fin: cita.inicio });
            }
            currentTime = Math.max(currentTime, cita.fin);
          }
  
          // Bloque después de la última cita hasta fin del horario
          if (currentTime + duracionServicio <= endTotalMin) {
            bloques.push({ inicio: currentTime, fin: endTotalMin });
          }
  
          // Convertimos los bloques en horarios disponibles
          for (const bloque of bloques) {
            let horaActual = bloque.inicio;
  
            while (horaActual + duracionServicio <= bloque.fin) {
              const horaInicioStr = `${Math.floor(horaActual / 60).toString().padStart(2, '0')}:${(horaActual % 60).toString().padStart(2, '0')}`;
              const horaFinStr = `${Math.floor((horaActual + duracionServicio) / 60).toString().padStart(2, '0')}:${((horaActual + duracionServicio) % 60).toString().padStart(2, '0')}`;
  
              horariosDisponibles.push({
                empleadoId: emp.id,
                empleadoNombre: emp.nombre,
                horaInicio: horaInicioStr,
                horaFin: horaFinStr
              });
  
              horaActual += duracionServicio; // Avanza en bloques del tamaño del servicio
            }
          }
        }
      }
  
      res.json(horariosDisponibles);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al obtener horarios disponibles' });
    }
  };
  