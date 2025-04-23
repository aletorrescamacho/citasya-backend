require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Importa rutas
const adminRoutes = require('./routes/admin.routes');
//const publicRoutes = require('./routes/public.routes');
console.log('adminRoutes exportado:', adminRoutes);

app.use('/admin', adminRoutes);
//app.use('/empresa', publicRoutes);

app.get('/', (req, res) => res.send('API funcionando ✅'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
