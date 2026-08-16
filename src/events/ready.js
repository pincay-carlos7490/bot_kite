const { Events, ActivityType } = require('discord.js');
const { initTempBanChecker } = require('../utils/tempbans');
const { connectDatabase } = require('../database/connect');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    // 1. Conectar a la base de datos MongoDB primero
    await connectDatabase();

    // 2. Mostrar banner de estado
    console.log(`========================================`);
    console.log(`✅ ¡Bot en línea exitosamente!`);
    console.log(`🤖 Usuario: ${client.user.tag}`);
    console.log(`📊 Servidores activos: ${client.guilds.cache.size}`);
    console.log(`========================================\n`);

    // 3. Establecer estado del bot
    client.user.setActivity('Tus órdenes | /ping', { type: ActivityType.Watching });

    // 4. Iniciar verificador automático de sanciones temporales
    initTempBanChecker(client);
  },
};
