const prisma = require('../prismaClient');
const nodemailer = require('nodemailer');
require('dotenv').config(); // Asegúrate de tener dotenv configurado


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

const nodemailer = require('nodemailer');
require('dotenv').config();

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
      empleadoId, // Ahora puede ser undefined
    } = req.body;

    if (!clienteNombre || !cedula || !correo || !telefono || !servicioId || !fecha || !hora) {
      return res.status(400).json({ error: 'Faltan campos obligatorios'} );
    }

    const empresa = await prisma.empresa.findUnique({ where: { slug } });
    if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });

    const servicio = await prisma.servicio.findUnique({ where: { id: servicioId } });
    if (!servicio) return res.status(404).json({ error: 'Servicio no encontrado' });

    const duracionMinutos = servicio.duracion;
    const fechaObj = new Date(fecha + 'T12:00:00');
    const diaSemana = fechaObj.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
    const horaInicioMin = parseInt(hora.split(':')[0]) * 60 + parseInt(hora.split(':')[1]);
    const horaFinMin = horaInicioMin + duracionMinutos;

    let empleadoAsignado;

    if (empleadoId) {
      empleadoAsignado = await prisma.empleado.findUnique({ where: { id: empleadoId } });
      if (!empleadoAsignado) return res.status(404).json({ error: 'Empleado no encontrado' });

      // Verificamos si el empleado está disponible en ese horario (similar a la lógica anterior)
      const empleadoServicio = await prisma.empleadoServicio.findFirst({
        where: { servicioId, empleadoId },
        include: {
          empleado: {
            include: {
              horarios: { where: { dia: { equals: diaSemana } } },
              citas: {
                where: {
                  fecha: fechaObj,
                  estado: 'activa',
                },
                include: { servicio: { select: { duracion: true } } },
              },
            },
          },
        },
      });

      if (!empleadoServicio?.empleado?.horarios.some(h => {
        const inicioHorario = parseInt(h.horaInicio.split(':')[0]) * 60 + parseInt(h.horaInicio.split(':')[1]);
        const finHorario = parseInt(h.horaFin.split(':')[0]) * 60 + parseInt(h.horaFin.split(':')[1]);
        return horaInicioMin >= inicioHorario && horaFinMin <= finHorario;
      })) {
        return res.status(409).json({ error: 'El empleado seleccionado no está disponible en ese horario' });
      }

      const hayConflicto = empleadoServicio.empleado.citas.some(cita => {
        const citaInicio = parseInt(cita.hora.split(':')[0]) * 60 + parseInt(cita.hora.split(':')[1]);
        const citaFin = citaInicio + (cita.servicio?.duracion || 30);
        return horaInicioMin < citaFin && horaFinMin > citaInicio;
      });

      if (hayConflicto) {
        return res.status(409).json({ error: 'El empleado seleccionado ya tiene una cita en ese horario' });
      }

    } else {
      // Seleccionar un empleado aleatorio
      const empleadosDisponibles = await prisma.empleadoServicio.findMany({
        where: {
          servicioId,
          empleado: {
            empresaId: empresa.id,
            horarios: {
              some: {
                dia: { equals: diaSemana },
                horaInicio: { lte: hora },
                horaFin: { gte: `${String(Math.floor(horaFinMin / 60)).padStart(2, '0')}:${String(horaFinMin % 60).padStart(2, '0')}` },
              },
            },
            citas: {
              none: {
                fecha: fechaObj,
                hora: { lte: `${String(Math.floor(horaFinMin / 60)).padStart(2, '0')}:${String(horaFinMin % 60).padStart(2, '0')}` },
                estado: 'activa',
                servicio: {
                  duracion: { gt: 0 } // Asegurarse de que la duración esté definida
                },
                AND: [
                  { hora: { gte: hora } },
                  {
                    OR: [
                      { servicio: { duracion: { equals: duracionMinutos } } },
                      {
                        servicio: {
                          duracion: {
                            equals: 30 // Considerar el múltiplo base
                          }
                        }
                      }
                    ]
                  }
                ],
              },
            },
          },
        },
        include: { empleado: true },
      });

      if (empleadosDisponibles.length === 0) {
        return res.status(409).json({ error: 'No hay empleados disponibles en ese horario' });
      }

      const indiceAleatorio = Math.floor(Math.random() * empleadosDisponibles.length);
      empleadoAsignado = empleadosDisponibles[indiceAleatorio].empleado;
    }

    const cita = await prisma.cita.create({
      data: {
        clienteNombre,
        cedula,
        correo,
        telefono,
        fecha: fechaObj,
        hora,
        estado: 'activa',
        empresa: { connect: { id: empresa.id } },
        servicio: { connect: { id: servicioId } },
        empleado: { connect: { id: empleadoAsignado.id } },
      },
      include: {
        empresa: true,
        servicio: true,
        empleado: true,
      },
    });

    // *** Configuración del transporter ***
    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.GMAIL_USER, // Asegúrate de tener esta variable en .env
        pass: process.env.GMAIL_PASS, // Asegúrate de tener esta variable en .env
      },
    });

    // *** Construcción del mensaje del correo ***
    const mailOptions = {
      from: process.env.GMAIL_USER, // Usa tu dirección de Gmail
      to: correo, // El correo del cliente
      subject: `Confirmación de su cita en ${cita.empresa.nombre}`,
      html: `
        <p>Estimado/a ${clienteNombre},</p>
        <p>Su cita ha sido confirmada con los siguientes detalles:</p>
        <ul>
          <li><strong>ID de Cita:</strong> ${cita.id}</li>
          <li><strong>Servicio:</strong> ${cita.servicio.nombre}</li>
          <li><strong>Fecha:</strong> ${cita.fecha.toLocaleDateString()}</li>
          <li><strong>Hora:</strong> ${cita.hora}</li>
          ${cita.empleado ? `<li><strong>Profesional:</strong> ${cita.empleado.nombre}</li>` : '<li><strong>Profesional:</strong> No asignado</li>'}
          <li><strong>Lugar:</strong> ${cita.empresa.nombre}</li>
          <li><strong>Dirección:</strong> ${cita.empresa.direccion || 'No especificada'}</li>
        </ul>
        <p>Gracias por su reserva.</p>
        <p>Atentamente,<br>${cita.empresa.nombre}</p>
      `,
    };

    // *** Envío del correo electrónico ***
    transporter.sendMail(mailOptions, function(error, info) {
      if (error) {
        console.log('Error al enviar el correo de confirmación:', error);
        // Aquí podrías registrar el error, pero no necesariamente fallar la reserva
      } else {
        console.log('Correo de confirmación enviado:', info.response);
      }
      res.status(201).json({ mensaje: 'Cita agendada exitosamente', cita });
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al agendar cita' });
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

//
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

    const servicioSeleccionado = await prisma.servicio.findUnique({
      where: { id: Number(servicioId) },
      select: { duracion: true },
    });
    const duracionServicio = servicioSeleccionado?.duracion || 30;

    const empleadosVinculados = await prisma.empleadoServicio.findMany({
      where: {
        servicioId: Number(servicioId),
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
                estado: 'activa',
              },
              include: {
                servicio: { select: { duracion: true } },
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
      const diaNormalizado = dia.normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
      const fechaStr = fechaActual.toISOString().split('T')[0];

      let horariosDelDia = [];
      const horariosUnicos = new Set(); // Para evitar repeticiones

      for (const { empleado } of empleadosVinculados) {
        const horario = empleado.horarios.find(h =>
          h.dia &&
          h.dia.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim() === diaNormalizado
        );
        if (!horario) continue;

        const inicioTurno = parseInt(horario.horaInicio.split(":")[0]) * 60 + parseInt(horario.horaInicio.split(":")[1]);
        const finTurno = parseInt(horario.horaFin.split(":")[0]) * 60 + parseInt(horario.horaFin.split(":")[1]);

        const citasOcupadas = (empleado.citas || [])
          .filter(cita => cita.fecha?.toISOString().split('T')[0] === fechaStr)
          .map(cita => {
            const horaCita = parseInt(cita.hora.split(":")[0]) * 60 + parseInt(cita.hora.split(":")[1]);
            const duracionCita = cita.servicio?.duracion || 30;
            return { inicio: horaCita, fin: horaCita + duracionCita };
          });

        for (let start = inicioTurno; start + duracionServicio <= finTurno; start += 30) {
          const finBloque = start + duracionServicio;
          const solapamiento = citasOcupadas.some(cita =>
            start < cita.fin && finBloque > cita.inicio
          );
          const horaInicioStr = `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`;

          if (!solapamiento) {
            if (!empleadoId) {
              if (!horariosUnicos.has(horaInicioStr)) {
                horariosDelDia.push({ hora: horaInicioStr, empleadoId: empleado.id }); // Guardamos el empleadoId para la asignación aleatoria
                horariosUnicos.add(horaInicioStr);
              }
            } else {
              horariosDelDia.push({
                hora: horaInicioStr,
                empleadoId: empleado.id,
                empleadoNombre: empleado.nombre,
              });
            }
          }
        }
      }

      if (horariosDelDia.length) {
        fechasHorarios.push({
          fecha: fechaStr,
          horarios: horariosDelDia,
        });
      }
    }

    res.json(fechasHorarios);
  } catch (err) {
    console.error('Error en obtenerFechasYHorarios:', err);
    res.status(500).json({ error: 'Error al obtener horarios', detalle: err.message });
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