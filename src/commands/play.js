const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const play = require('play-dl');
const { getQueue, createServerQueue, playNextSong } = require('../utils/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Reproduce una canción en tu canal de voz')
    .setIntegrationTypes(0, 1)
    .setContexts(0, 1, 2)
    .addStringOption(option =>
      option.setName('cancion')
        .setDescription('Nombre de la canción o enlace (SoundCloud, YouTube, etc.)')
        .setRequired(true)
    ),

  async execute(interaction) {
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) {
      return await interaction.reply({
        content: '❌ Debes estar conectado a un canal de voz para reproducir música.',
        ephemeral: true
      });
    }

    const query = interaction.options.getString('cancion');
    await interaction.deferReply();

    try {
      let songInfo = null;

      // 1. Buscar en SoundCloud (Libre de bloqueos de IP en la nube)
      try {
        const scResults = await play.search(query, { source: { soundcloud: 'tracks' }, limit: 1 });
        if (scResults && scResults.length > 0) {
          const track = scResults[0];
          songInfo = {
            title: track.name,
            url: track.permalink,
            duration: track.durationRaw || 'Desconocida',
            thumbnail: track.thumbnail || interaction.client.user.displayAvatarURL(),
            requestedBy: interaction.user
          };
        }
      } catch (err) {
        console.log('Error buscando en SoundCloud, intentando en YouTube...', err.message);
      }

      // 2. Si no dió resultado en SoundCloud, intentar en YouTube
      if (!songInfo) {
        try {
          const ytResults = await play.search(query, { limit: 1 });
          if (ytResults && ytResults.length > 0) {
            const video = ytResults[0];
            songInfo = {
              title: video.title,
              url: video.url,
              duration: video.durationRaw || 'Desconocida',
              thumbnail: video.thumbnails[0]?.url,
              requestedBy: interaction.user
            };
          }
        } catch (ytErr) {
          console.error('Error buscando en YouTube:', ytErr.message);
        }
      }

      if (!songInfo) {
        return await interaction.editReply({
          content: `🔍 No se encontraron resultados para: **${query}**`
        });
      }

      let serverQueue = getQueue(interaction.guild.id);

      if (!serverQueue) {
        serverQueue = await createServerQueue(interaction, voiceChannel);
      } else if (serverQueue.voiceChannel.id !== voiceChannel.id) {
        return await interaction.editReply({
          content: `❌ Ya me encuentro reproduciendo música en el canal de voz **${serverQueue.voiceChannel.name}**.`
        });
      }

      serverQueue.songs.push(songInfo);

      if (!serverQueue.playing && serverQueue.songs.length === 1) {
        await playNextSong(interaction.guild.id);
        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('🎵 Añadido y Reproduciendo')
          .setDescription(`[${songInfo.title}](${songInfo.url})`)
          .setThumbnail(songInfo.thumbnail)
          .addFields(
            { name: '⏱️ Duración', value: songInfo.duration, inline: true },
            { name: '👤 Solicitado por', value: `${songInfo.requestedBy}`, inline: true }
          )
          .setFooter({ text: `Conectado a ${voiceChannel.name}` });

        await interaction.editReply({ embeds: [embed] });
      } else {
        const embed = new EmbedBuilder()
          .setColor('#57F287')
          .setTitle('🎶 Añadido a la Cola')
          .setDescription(`[${songInfo.title}](${songInfo.url})`)
          .setThumbnail(songInfo.thumbnail)
          .addFields(
            { name: '📍 Posición en Cola', value: `#${serverQueue.songs.length}`, inline: true },
            { name: '⏱️ Duración', value: songInfo.duration, inline: true },
            { name: '👤 Solicitado por', value: `${songInfo.requestedBy}`, inline: true }
          );

        await interaction.editReply({ embeds: [embed] });
      }

    } catch (error) {
      console.error('Error en /play:', error);
      await interaction.editReply({
        content: '❌ Ocurrió un error al intentar procesar o reproducir la canción.'
      });
    }
  },
};
