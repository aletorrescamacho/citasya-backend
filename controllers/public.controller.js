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
    const { slug } = req.params
    const {
      clienteNombre,
      cedula,
      correo,
      telefono,
      servicioId,
      fecha,
      hora,
      empleadoId // opcional
    } = req.body

    if (!clienteNombre || !cedula || !correo || !telefono || !servicioId || !fecha || !hora) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' })
    }

    const empresa = await prisma.empresa.findUnique({ where: { slug } })
    if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' })

    const servicio = await prisma.servicio.findUnique({ where: { id: servicioId } })
    if (!servicio) return res.status(404).json({ error: 'Servicio no encontrado' })

    const duracionMinutos = servicio.duracion

    const empleadosVinculados = await prisma.empleadoServicio.findMany({
      where: {
        servicioId,
        empleado: { empresaId: empresa.id }
      },
      include: {
        empleado: {
          include: {
            horarios: true,
            citas: {
              where: {
                fecha: new Date(fecha),
                estado: 'activa'
              },
              include: {
                servicio: { select: { duracion: true } }
              }
            }
          }
        }
      }
    })

    const diaSemana = new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase()
    const horaInicioMin = parseInt(hora.split(':')[0]) * 60 + parseInt(hora.split(':')[1])
    const horaFinMin = horaInicioMin + duracionMinutos

    const empleadoDisponible = empleadosVinculados.find(({ empleado }) => {
      if (empleadoId && empleado.id !== empleadoId) return false

      const horario = empleado.horarios.find(h => h.dia.toLowerCase() === diaSemana)
      if (!horario) return false

      const inicioHorario = parseInt(horario.horaInicio.split(':')[0]) * 60 + parseInt(horario.horaInicio.split(':')[1])
      const finHorario = parseInt(horario.horaFin.split(':')[0]) * 60 + parseInt(horario.horaFin.split(':')[1])

      if (horaInicioMin < inicioHorario || horaFinMin > finHorario) return false

      const hayConflicto = empleado.citas.some(cita => {
        const citaInicio = parseInt(cita.hora.split(':')[0]) * 60 + parseInt(cita.hora.split(':')[1])
        const citaFin = citaInicio + (cita.servicio?.duracion || 30)
        return horaInicioMin < citaFin && horaFinMin > citaInicio
      })

      return !hayConflicto
    })

    if (!empleadoDisponible) {
      return res.status(409).json({ error: 'No hay disponibilidad para ese horario' })
    }

    const cita = await prisma.cita.create({
      data: {
        clienteNombre,
        cedula,
        correo,
        telefono,
        fecha: new Date(fecha),
        hora,
        estado: 'activa',
        empresa: { connect: { id: empresa.id } },
        servicio: { connect: { id: servicioId } },
        empleado: { connect: { id: empleadoDisponible.empleado.id } }
      }
    })

    res.status(201).json({ mensaje: 'Cita agendada exitosamente', cita })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al agendar cita' })
  }
}


  
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

  exports.obtenerServiciosPorEmpresa = async (req, res) => {
    try {
      const { slug } = req.params;
  
      const empresa = await prisma.empresa.findUnique({
        where: { slug },
      });
  
      if (!empresa) {
        return res.status(404).json({ error: 'Empresa no encontrada' });
      }
  
      const servicios = await prisma.servicio.findMany({
        where: { empresaId: empresa.id },
      });
  
      res.json(servicios);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al obtener servicios' });
    }
  };


  exports.obtenerFechasYHorarios = async (req, res) => {
    try {
      const { slug } = req.params;
      const { servicioId, empleadoId } = req.query;
  
      if (!servicioId) return res.status(400).json({ error: 'Falta el servicioId' });
  
      const empresa = await prisma.empresa.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });
  
      const duracionServicio = (await prisma.servicio.findUnique({
        where: { id: Number(servicioId) },
        select: { duracion: true },
      }))?.duracion || 30;
  
      const empleadosVinculados = await prisma.empleadoServicio.findMany({
        where: {
          servicioId: Number(servicioId),
          empleadoId: empleadoId ? Number(empleadoId) : undefined,
          empleado: { empresaId: empresa.id },
        },
        include: {
          empleado: {
            include: {
              horarios: true,
              citas: {
                where: {
                  fecha: {
                    gte: new Date(),
                    lte: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
                  },
                  estado: 'activa'
                },
                include: {
                  servicio: {
                    select: { duracion: true },
                  },
                },
              },
            },
          },
        },
      });
  
      const fechasHorarios = [];
  
      for (let i = 0; i < 15; i++) {
        const fechaActual = new Date();
        fechaActual.setDate(fechaActual.getDate() + i);
        const dia = fechaActual.toLocaleDateString('es-VE', { weekday: 'long' }).toLowerCase();
        const diaNormalizado = dia.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        const fechaStr = fechaActual.toISOString().split('T')[0];
  
        let horariosDelDia = [];
  
        for (const { empleado } of empleadosVinculados) {
          const horario = empleado.horarios.find(h =>
            h.dia &&
            h.dia.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() === diaNormalizado
          );
          if (!horario) continue;
  
          const inicioTurno = parseInt(horario.horaInicio.split(":")[0]) * 60 + parseInt(horario.horaInicio.split(":")[1]);
          const finTurno = parseInt(horario.horaFin.split(":")[0]) * 60 + parseInt(horario.horaFin.split(":")[1]);
  
          // Citas ordenadas por inicio
          const citasOcupadas = empleado.citas
            .filter(cita => cita.fecha.toISOString().split('T')[0] === fechaStr)
            .map(cita => {
              const horaCita = parseInt(cita.hora.split(":")[0]) * 60 + parseInt(cita.hora.split(":")[1]);
              const duracionCita = cita.servicio?.duracion || 30;
              return { inicio: horaCita, fin: horaCita + duracionCita };
            })
            .sort((a, b) => a.inicio - b.inicio);
  
          // Construir bloques libres
          let bloquesLibres = [];
          let bloqueInicio = inicioTurno;
  
          for (const cita of citasOcupadas) {
            if (bloqueInicio < cita.inicio) {
              bloquesLibres.push({ inicio: bloqueInicio, fin: cita.inicio });
            }
            bloqueInicio = Math.max(bloqueInicio, cita.fin);
          }
          if (bloqueInicio < finTurno) {
            bloquesLibres.push({ inicio: bloqueInicio, fin: finTurno });
          }
  
          // Solo permite reservar en el inicio de cada bloque libre si cabe el servicio completo
          for (const bloque of bloquesLibres) {
            if (bloque.inicio + duracionServicio <= bloque.fin) {
              horariosDelDia.push({
                hora: `${String(Math.floor(bloque.inicio / 60)).padStart(2, '0')}:${String(bloque.inicio % 60).padStart(2, '0')}`,
                empleadoId: empleado.id,
              });
            }
          }
        }
  
        // Elimina horarios duplicados (por si acaso)
        horariosDelDia = horariosDelDia.filter(
          (h, idx, arr) => arr.findIndex(x => x.hora === h.hora && x.empleadoId === h.empleadoId) === idx
        );
  
        if (horariosDelDia.length) {
          fechasHorarios.push({
            fecha: fechaStr,
            horarios: horariosDelDia,
          });
        }
      }
  
      res.json(fechasHorarios);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al obtener horarios' });
    }
  };
  exports.obtenerEmpleadosPorEmpresa = async (req, res) => {
    try {
      const { slug } = req.params;
  
      const empresa = await prisma.empresa.findUnique({
        where: { slug },
      });
  
      if (!empresa) {
        return res.status(404).json({ error: 'Empresa no encontrada' });
      }
  
      const empleados = await prisma.empleado.findMany({
        where: { empresaId: empresa.id },
        include: {
          horarios: true,
          servicios: {
            include: { servicio: true },
          },
        },
      });
  
      res.json(empleados);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al obtener empleados' });
    }
  };