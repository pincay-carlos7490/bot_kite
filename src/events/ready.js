const { Events, ActivityType } = require('discord.js');
const { initTempBanChecker } = require('../utils/tempbans');
const { connectDatabase } = require('../database/connect');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`\n========================================`);
    console.log(`✅ ¡Bot en línea exitosamente!`);
    console.log(`🤖 Usuario: ${client.user.tag}`);
    console.log(`📊 Servidores activos: ${client.guilds.cache.size}`);
    console.log(`========================================\n`);

    // Conectar a MongoDB
    await connectDatabase();

    // Establecer estado del bot
    client.user.setActivity('Tus órdenes | /ping', { type: ActivityType.Watching });

    // Iniciar verificador automático de sanciones temporales
    initTempBanChecker(client);
  },
};
