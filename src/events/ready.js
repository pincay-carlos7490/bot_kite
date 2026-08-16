const { Events, ActivityType } = require('discord.js');
const { initTempBanChecker } = require('../utils/tempbans');
const { connectDatabase } = require('../database/connect');
const { deployCommands } = require('../deploy-commands');
const { initMusicEngine } = require('../utils/musicManager');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    // 1. Conectar a la base de datos MongoDB
    await connectDatabase();

    // 2. Registrar comandos automáticamente en la API de Discord al encender
    await deployCommands();

    // 3. Inicializar token gratuito de SoundCloud/YouTube para el reproductor
    await initMusicEngine();

    // 4. Mostrar banner de estado
    console.log(`========================================`);
    console.log(`✅ ¡Bot en línea exitosamente!`);
    console.log(`🤖 Usuario: ${client.user.tag}`);
    console.log(`📊 Servidores activos: ${client.guilds.cache.size}`);
    console.log(`========================================\n`);

    // 5. Establecer estado del bot personalizado
    client.user.setActivity('🌸 /help | /invitar', { type: ActivityType.Listening });

    // 6. Iniciar verificador automático de sanciones temporales
    initTempBanChecker(client);
  },
};
