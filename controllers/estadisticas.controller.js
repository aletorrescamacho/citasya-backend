const prisma = require('../prismaClient')

const EstadisticasController = {
  async citasPorMes(req, res) {
    const { slug } = req.params
    try {
      const citas = await prisma.cita.findMany({
        where: { empresa: { slug } },
        select: { fecha: true },
      })

      const resultado = {}

      for (const cita of citas) {
        const fecha = new Date(cita.fecha)
        const clave = `${fecha.getFullYear()}-${fecha.getMonth() + 1}`
        resultado[clave] = (resultado[clave] || 0) + 1
      }

      res.json(resultado)
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener citas por mes' })
    }
  },

  async citasPorEmpleado(req, res) {
    const { slug } = req.params
    try {
      const citas = await prisma.cita.findMany({
        where: { empresa: { slug } },
        select: { empleado: { select: { nombre: true } } },
      })

      const resultado = {}
      for (const cita of citas) {
        const nombre = cita.empleado?.nombre || 'Sin asignar'
        resultado[nombre] = (resultado[nombre] || 0) + 1
      }

      res.json(resultado)
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener citas por empleado' })
    }
  },

  async citasPorServicio(req, res) {
    const { slug } = req.params
    try {
      const citas = await prisma.cita.findMany({
        where: { empresa: { slug } },
        select: { servicio: { select: { nombre: true } } },
      })

      const resultado = {}
      for (const cita of citas) {
        const nombre = cita.servicio?.nombre || 'Sin servicio'
        resultado[nombre] = (resultado[nombre] || 0) + 1
      }

      res.json(resultado)
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener citas por servicio' })
    }
  },

  async citasPorDiaUltimos7(req, res) {
    const { slug } = req.params
    const desde = new Date()
    desde.setDate(desde.getDate() - 6)

    try {
      const citas = await prisma.cita.findMany({
        where: {
          empresa: { slug },
          fecha: { gte: desde },
        },
        select: { fecha: true },
      })

      const resultado = {}

      for (const cita of citas) {
        const dia = new Date(cita.fecha).toLocaleDateString('es-ES')
        resultado[dia] = (resultado[dia] || 0) + 1
      }

      res.json(resultado)
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener citas por día' })
    }
  },

  async citasPorAnio(req, res) {
    const { slug } = req.params
    try {
      const citas = await prisma.cita.findMany({
        where: { empresa: { slug } },
        select: { fecha: true },
      })

      const resultado = {}

      for (const cita of citas) {
        const anio = new Date(cita.fecha).getFullYear()
        resultado[anio] = (resultado[anio] || 0) + 1
      }

      res.json(resultado)
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener citas por año' })
    }
  },
}

module.exports = EstadisticasController
