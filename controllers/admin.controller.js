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
  

