const { SlashCommandBuilder } = require('discord.js');
const { getQueue, queues } = require('../utils/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Detiene la música, vacía la cola y desconecta al bot del canal de voz')
    .setIntegrationTypes(0, 1)
    .setContexts(0, 1, 2),

  async execute(interaction) {
    const voiceChannel = interaction.member.voice.channel;
    const serverQueue = getQueue(interaction.guild.id);

    if (!voiceChannel) {
      return await interaction.reply({ content: '❌ Debes estar en un canal de voz para detener la música.', ephemeral: true });
    }

    if (!serverQueue) {
      return await interaction.reply({ content: '❌ El bot no está reproduciendo música en este servidor.', ephemeral: true });
    }

    serverQueue.songs = [];
    serverQueue.player.stop();
    if (serverQueue.connection) {
      serverQueue.connection.destroy();
    }
    queues.delete(interaction.guild.id);

    await interaction.reply({
      content: '⏹️ Se ha detenido la música y el bot se ha desconectado del canal de voz.'
    });
  },
};
