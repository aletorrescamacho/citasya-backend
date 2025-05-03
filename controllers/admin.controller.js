const prisma = require('../prismaClient');

exports.crearEmpresa = async (req, res) => {
  try {
    const { nombre, slug, contacto } = req.body;

    if (!nombre || !slug || !contacto) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const empresaExistente = await prisma.empresa.findUnique({ where: { slug } });
    if (empresaExistente) {
      return res.status(409).json({ error: 'Ya existe una empresa con ese slug' });
    }

    const empresa = await prisma.empresa.create({
      data: { nombre, slug, contacto }
    });

    res.status(201).json(empresa);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear empresa' });
  }
};

exports.crearCredenciales = async (req, res) => {
  try {
    const { usuario, llave, empresaSlug } = req.body;

    if (!usuario || !llave || !empresaSlug) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const empresa = await prisma.empresa.findUnique({ where: { slug: empresaSlug } });
    if (!empresa) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    const credencialExistente = await prisma.adminCredencial.findUnique({
      where: { usuario }
    });
    if (credencialExistente) {
      return res.status(409).json({ error: 'Ese usuario ya tiene credencial creada' });
    }

    const credencial = await prisma.adminCredencial.create({
      data: {
        usuario,
        llave,
        empresa: { connect: { id: empresa.id } }
      }
    });

    res.status(201).json({ mensaje: 'Credencial creada con éxito', credencial });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear credenciales' });
  }
};

exports.crearServicio = async (req, res) => {
    try {
      const { empresaSlug, nombre, duracion, precio } = req.body;
  
      if (!empresaSlug || !nombre || !duracion || !precio) {
        return res.status(400).json({ error: 'Faltan campos obligatorios' });
      }
  
      const empresa = await prisma.empresa.findUnique({ where: { slug: empresaSlug } });
      if (!empresa) {
        return res.status(404).json({ error: 'Empresa no encontrada' });
      }
  
      const servicio = await prisma.servicio.create({
        data: {
          nombre,
          duracion,
          precio,
          empresa: {
            connect: { id: empresa.id }
          }
        }
      });
  
      res.status(201).json(servicio);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al crear el servicio' });
    }
  };

  exports.crearEmpleado = async (req, res) => {
    try {
      const { nombre, empresaSlug } = req.body;
  
      if (!nombre || !empresaSlug) {
        return res.status(400).json({ error: 'Faltan campos obligatorios' });
      }
  
      const empresa = await prisma.empresa.findUnique({ where: { slug: empresaSlug } });
      if (!empresa) {
        return res.status(404).json({ error: 'Empresa no encontrada' });
      }
  
      const empleado = await prisma.empleado.create({
        data: {
          nombre,
          empresa: { connect: { id: empresa.id } }
        }
      });
  
      res.status(201).json(empleado);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al crear el empleado' });
    }
  };

  exports.asignarHorario = async (req, res) => {
    try {
      const { empleadoId, dia, horaInicio, horaFin } = req.body;
  
      if (!empleadoId || !dia || !horaInicio || !horaFin) {
        return res.status(400).json({ error: 'Faltan campos' });
      }
  
      const horario = await prisma.horario.create({
        data: {
          dia,
          horaInicio,
          horaFin,
          empleado: { connect: { id: empleadoId } }
        }
      });
  
      res.status(201).json(horario);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al asignar horario' });
    }
  };

  exports.vincularServicio = async (req, res) => {
    try {
      const { empleadoId, servicioId } = req.body;
  
      if (!empleadoId || !servicioId) {
        return res.status(400).json({ error: 'Faltan campos' });
      }
  
      const vinculo = await prisma.empleadoServicio.create({
        data: {
          empleado: { connect: { id: empleadoId } },
          servicio: { connect: { id: servicioId } }
        }
      });
  
      res.status(201).json(vinculo);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al vincular servicio al empleado' });
    }
  };
  
  exports.editarServicio = async (req, res) => {
    try {
      const { id } = req.params;
      const { nombre, duracion, precio } = req.body;
  
      const servicio = await prisma.servicio.update({
        where: { id: parseInt(id) },
        data: { nombre, duracion, precio }
      });
  
      res.json(servicio);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al editar servicio' });
    }
  };

  
  exports.eliminarServicio = async (req, res) => {
    try {
      const { id } = req.params;
      const servicioId = parseInt(id);
  
      // Primero elimina relaciones en EmpleadoServicio
      await prisma.empleadoServicio.deleteMany({ where: { servicioId } });
  
      // Luego elimina las citas relacionadas
      await prisma.cita.deleteMany({ where: { servicioId } });
  
      // Finalmente elimina el servicio
      await prisma.servicio.delete({
        where: { id: servicioId }
      });
  
      res.json({ mensaje: 'Servicio eliminado correctamente' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al eliminar servicio' });
    }
  };

  
  exports.editarEmpleado = async (req, res) => {
    try {
      const { id } = req.params;
      const { nombre, horarios, servicios } = req.body;
  
      const empleadoId = parseInt(id);
  
      // Actualizar nombre si se incluye
      if (nombre) {
        await prisma.empleado.update({
          where: { id: empleadoId },
          data: { nombre }
        });
      }
  
      // Si vienen horarios, primero eliminamos los anteriores y luego creamos los nuevos
      if (Array.isArray(horarios)) {
        await prisma.horario.deleteMany({ where: { empleadoId } });
  
        for (const h of horarios) {
          const { dia, horaInicio, horaFin } = h;
          await prisma.horario.create({
            data: {
              dia,
              horaInicio,
              horaFin,
              empleado: { connect: { id: empleadoId } }
            }
          });
        }
      }
  
      // Si vienen servicios, eliminamos los actuales y registramos los nuevos
      if (Array.isArray(servicios)) {
        await prisma.empleadoServicio.deleteMany({ where: { empleadoId } });
  
        for (const servicioId of servicios) {
          await prisma.empleadoServicio.create({
            data: {
              empleado: { connect: { id: empleadoId } },
              servicio: { connect: { id: servicioId } }
            }
          });
        }
      }
  
      const empleado = await prisma.empleado.findUnique({
        where: { id: empleadoId },
        include: {
          horarios: true,
          servicios: { include: { servicio: true } }
        }
      });
  
      res.json({ mensaje: 'Empleado actualizado', empleado });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al editar empleado' });
    }
  };


  exports.eliminarEmpleado = async (req, res) => {
    try {
      const { id } = req.params;
      const empleadoId = parseInt(id);
  
      // Elimina todas las relaciones primero
      await prisma.horario.deleteMany({ where: { empleadoId } });
      await prisma.empleadoServicio.deleteMany({ where: { empleadoId } });
      await prisma.cita.deleteMany({ where: { empleadoId } });
  
      // Luego elimina el empleado
      await prisma.empleado.delete({
        where: { id: empleadoId }
      });
  
      res.json({ mensaje: 'Empleado eliminado correctamente' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al eliminar empleado' });
    }
  };

  
  exports.loginAdmin = async (req, res) => {
    try {
      const { usuario, llave } = req.body;
  
      if (!usuario || !llave) {
        return res.status(400).json({ error: 'Campos incompletos' });
      }
  
      const credencial = await prisma.adminCredencial.findUnique({
        where: { usuario },
        include: { empresa: true }
      });
  
      if (!credencial || credencial.llave !== llave) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }
  
      res.json({
        empresaSlug: credencial.empresa.slug
      });
      
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al iniciar sesión' });
    }
  };

  
  exports.obtenerCitas = async (req, res) => {
    try {
      const { empresaSlug } = req.params;
  
      const empresa = await prisma.empresa.findUnique({
        where: { slug: empresaSlug }
      });
  
      if (!empresa) {
        return res.status(404).json({ error: 'Empresa no encontrada' });
      }
  
      const hoy = new Date();
      const fechaLimite = new Date();
      fechaLimite.setDate(hoy.getDate() + 15); // 🔥 15 días después de hoy
  
      const citas = await prisma.cita.findMany({
        where: {
          empresaId: empresa.id,
          estado: 'activa',
          fecha: {
            gte: hoy,
            lte: fechaLimite
          }
        },
        orderBy: [
          { fecha: 'asc' },
          { hora: 'asc' }
        ],
        include: {
          servicio: true,
          empleado: true
        }
      });
  
      res.json(citas);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al obtener citas' });
    }
  };
  
  exports.obtenerEmpleadoCompleto = async (req, res) => {
    try {
      const { id } = req.params;
      const empleado = await prisma.empleado.findUnique({
        where: { id: parseInt(id) },
        include: {
          horarios: true,
          servicios: {
            include: { servicio: true }
          }
        }
      });
  
      if (!empleado) {
        return res.status(404).json({ error: 'Empleado no encontrado' });
      }
  
      res.json(empleado);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al obtener empleado' });
    }
  };

  