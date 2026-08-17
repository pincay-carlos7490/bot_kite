const { SlashCommandBuilder } = require('discord.js');
const { getQueue } = require('../utils/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Salta la canción actual a la siguiente en la cola')
    .setIntegrationTypes(0, 1)
    .setContexts(0, 1, 2),

  async execute(interaction) {
    const voiceChannel = interaction.member.voice.channel;
    const serverQueue = getQueue(interaction.guild.id);

    if (!voiceChannel) {
      return await interaction.reply({ content: '❌ Debes estar en un canal de voz para saltar canciones.', ephemeral: true });
    }

    if (!serverQueue || serverQueue.songs.length === 0) {
      return await interaction.reply({ content: '❌ No hay ninguna canción reproduciéndose actualmente.', ephemeral: true });
    }

    const currentSong = serverQueue.songs[0];
    serverQueue.player.stop();

    await interaction.reply({
      content: `⏭️ Has saltado **${currentSong.title}**.`
    });
  },
};
