const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getQueue } = require('../utils/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Muestra la lista de canciones en la cola actual'),

  async execute(interaction) {
    const serverQueue = getQueue(interaction.guild.id);

    if (!serverQueue || serverQueue.songs.length === 0) {
      return await interaction.reply({
        content: '📜 No hay canciones en la cola actualmente.',
        ephemeral: true
      });
    }

    const currentSong = serverQueue.songs[0];
    const upcoming = serverQueue.songs.slice(1, 10);

    let queueString = upcoming.map((song, i) => `**${i + 1}.** [${song.title}](${song.url}) | (${song.duration})`).join('\n');
    if (!queueString) queueString = '*No hay más canciones en espera.*';

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('📜 Cola de Reproducción')
      .addFields(
        { name: '🎵 Sonando Ahora', value: `[${currentSong.title}](${currentSong.url}) | (${currentSong.duration})\n*Solicitado por ${currentSong.requestedBy}*` },
        { name: '⏩ A continuación', value: queueString }
      )
      .setFooter({ text: `Total de canciones en cola: ${serverQueue.songs.length}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
