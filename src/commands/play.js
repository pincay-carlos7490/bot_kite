const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ytdl = require('@distube/ytdl-core');
const play = require('play-dl');
const { getQueue, createServerQueue, playNextSong } = require('../utils/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Reproduce una canción o enlace de YouTube en tu canal de voz')
    .addStringOption(option =>
      option.setName('cancion')
        .setDescription('Nombre de la canción o enlace de YouTube / SoundCloud')
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

      // 1. Verificar si es un enlace directo de YouTube con @distube/ytdl-core
      if (ytdl.validateURL(query)) {
        try {
          const info = await ytdl.getBasicInfo(query);
          const details = info.videoDetails;
          const seconds = parseInt(details.lengthSeconds || '0', 10);
          const durationStr = seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'Desconocida';

          songInfo = {
            title: details.title,
            url: details.video_url || query,
            duration: durationStr,
            thumbnail: details.thumbnails[0]?.url,
            requestedBy: interaction.user
          };
        } catch (e) {
          console.log('Error obteniendo info con ytdl-core, intentando con play-dl...', e.message);
        }
      }

      // 2. Si no es enlace directo o falló ytdl-core, usar play-dl para buscar por nombre
      if (!songInfo) {
        const validation = await play.validate(query);

        if (validation === 'yt_video') {
          const ytInfo = await play.video_info(query);
          const details = ytInfo.video_details;
          songInfo = {
            title: details.title,
            url: details.url,
            duration: details.durationRaw,
            thumbnail: details.thumbnails[0]?.url,
            requestedBy: interaction.user
          };
        } else {
          const searchResults = await play.search(query, { limit: 1 });
          if (!searchResults || searchResults.length === 0) {
            return await interaction.editReply({
              content: `🔍 No se encontraron resultados para: **${query}**`
            });
          }
          const video = searchResults[0];
          songInfo = {
            title: video.title,
            url: video.url,
            duration: video.durationRaw,
            thumbnail: video.thumbnails[0]?.url,
            requestedBy: interaction.user
          };
        }
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
            { name: '⏱️ Duración', value: songInfo.duration || 'Desconocida', inline: true },
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
            { name: '⏱️ Duración', value: songInfo.duration || 'Desconocida', inline: true },
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
