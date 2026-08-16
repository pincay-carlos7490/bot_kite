const mongoose = require('mongoose');

async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri || mongoUri === 'tu_mongodb_uri_aqui') {
    console.log('⚠️ MONGODB_URI no está configurado en .env. Se usará almacenamiento local temporal.');
    return false;
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('🍃 ¡Conexión exitosa a la base de datos MongoDB Atlas!');
    return true;
  } catch (error) {
    console.error('❌ Error al conectar a MongoDB:', error.message);
    return false;
  }
}

module.exports = { connectDatabase };
