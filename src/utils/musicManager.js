const { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus, 
  VoiceConnectionStatus, 
  entersState 
} = require('@discordjs/voice');
const { EmbedBuilder } = require('discord.js');
const play = require('play-dl');

const queues = new Map();

async function initMusicEngine() {
  try {
    const clientID = await play.getFreeClientID();
    await play.setToken({
      soundcloud: {
        client_id: clientID
      }
    });
    console.log('✅ Motor de audio SoundCloud/YouTube inicializado correctamente.');
  } catch (err) {
    console.log('Aviso: No se pudo obtener el client ID gratuito de SoundCloud:', err.message);
  }
}

function getQueue(guildId) {
  return queues.get(guildId) || null;
}

async function getAudioStream(song) {
  let rawStream = null;
  let inputType = null;

  if (song.url && song.url.includes('soundcloud.com')) {
    const pdlStream = await play.stream(song.url);
    rawStream = pdlStream.stream;
    inputType = pdlStream.type;
  } else {
    try {
      const scResults = await play.search(song.title, { source: { soundcloud: 'tracks' }, limit: 1 });
      if (scResults && scResults.length > 0) {
        console.log(`✅ Transmitiendo "${scResults[0].name}" desde fuente de alta fidelidad.`);
        const pdlStream = await play.stream(scResults[0].url);
        rawStream = pdlStream.stream;
        inputType = pdlStream.type;
      }
    } catch (err) {
      console.error('Error en motor SoundCloud:', err.message);
    }
  }

  if (!rawStream) {
    const pdlStream = await play.stream(song.url);
    rawStream = pdlStream.stream;
    inputType = pdlStream.type;
  }

  const resource = createAudioResource(rawStream, { 
    inputType: inputType,
    inlineVolume: true 
  });

  if (resource.volume) {
    resource.volume.setVolume(0.75);
  }

  return resource;
}

async function playNextSong(guildId) {
  const queue = queues.get(guildId);
  if (!queue) return;

  if (queue.songs.length === 0) {
    queue.playing = false;
    if (queue.timeout) clearTimeout(queue.timeout);
    queue.timeout = setTimeout(() => {
      const currentQueue = queues.get(guildId);
      if (currentQueue && currentQueue.songs.length === 0) {
        if (currentQueue.connection) {
          currentQueue.connection.destroy();
        }
        queues.delete(guildId);
      }
    }, 120000);
    return;
  }

  if (queue.timeout) {
    clearTimeout(queue.timeout);
    queue.timeout = null;
  }

  const currentSong = queue.songs[0];

  try {
    const resource = await getAudioStream(currentSong);
    queue.player.play(resource);
    queue.playing = true;

    if (queue.textChannel) {
      queue.textChannel.send({
        content: `🎵 **Reproduciendo ahora:** [${currentSong.title}](${currentSong.url}) | Solicitado por: ${currentSong.requestedBy}`
      }).catch(() => null);
    }
  } catch (error) {
    console.error(`Error al reproducir ${currentSong.title}:`, error);
    if (queue.textChannel) {
      queue.textChannel.send({ 
        content: `❌ No se pudo transmitir **${currentSong.title}**. Saltando a la siguiente...` 
      }).catch(() => null);
    }
    queue.songs.shift();
    playNextSong(guildId);
  }
}

async function createServerQueue(context, voiceChannel) {
  const guildId = context.guild.id;
  const player = createAudioPlayer();

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guildId,
    adapterCreator: context.guild.voiceAdapterCreator,
  });

  const queueConstruct = {
    textChannel: context.channel,
    voiceChannel: voiceChannel,
    connection: connection,
    player: player,
    songs: [],
    playing: false,
    timeout: null
  };

  connection.subscribe(player);
  queues.set(guildId, queueConstruct);

  player.on(AudioPlayerStatus.Idle, () => {
    const q = queues.get(guildId);
    if (q) {
      q.songs.shift();
      playNextSong(guildId);
    }
  });

  player.on('error', error => {
    console.error('Audio Player Error:', error.message);
    const q = queues.get(guildId);
    if (q) {
      q.songs.shift();
      playNextSong(guildId);
    }
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch (e) {
      connection.destroy();
      queues.delete(guildId);
    }
  });

  return queueConstruct;
}

async function playMusicFromMessage(message, query) {
  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel) {
    return await message.reply('❌ Debes estar conectado a un canal de voz para que pueda unirme y reproducir música.');
  }

  let songInfo = null;

  try {
    const scResults = await play.search(query, { source: { soundcloud: 'tracks' }, limit: 1 });
    if (scResults && scResults.length > 0) {
      const track = scResults[0];
      songInfo = {
        title: track.name,
        url: track.permalink,
        duration: track.durationRaw || 'Desconocida',
        thumbnail: track.thumbnail || message.client.user.displayAvatarURL(),
        requestedBy: message.author
      };
    }
  } catch (err) {}

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
          requestedBy: message.author
        };
      }
    } catch (err) {}
  }

  if (!songInfo) {
    return await message.reply(`🔍 No se encontraron resultados de música para: **${query}**`);
  }

  let serverQueue = getQueue(message.guild.id);

  if (!serverQueue) {
    serverQueue = await createServerQueue(message, voiceChannel);
  } else if (serverQueue.voiceChannel.id !== voiceChannel.id) {
    return await message.reply(`❌ Ya me encuentro reproduciendo música en el canal de voz **${serverQueue.voiceChannel.name}**.`);
  }

  serverQueue.songs.push(songInfo);

  if (!serverQueue.playing && serverQueue.songs.length === 1) {
    await playNextSong(message.guild.id);
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🎵 Conectado al Canal y Reproduciendo')
      .setDescription(`[${songInfo.title}](${songInfo.url})`)
      .setThumbnail(songInfo.thumbnail)
      .addFields(
        { name: '⏱️ Duración', value: songInfo.duration, inline: true },
        { name: '👤 Solicitado por', value: `${songInfo.requestedBy}`, inline: true }
      )
      .setFooter({ text: `Conectado a ${voiceChannel.name}` });

    return await message.channel.send({ embeds: [embed] });
  } else {
    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('🎶 Añadido a la Cola por IA')
      .setDescription(`[${songInfo.title}](${songInfo.url})`)
      .setThumbnail(songInfo.thumbnail)
      .addFields(
        { name: '📍 Posición en Cola', value: `#${serverQueue.songs.length}`, inline: true },
        { name: '⏱️ Duración', value: songInfo.duration, inline: true },
        { name: '👤 Solicitado por', value: `${songInfo.requestedBy}`, inline: true }
      );

    return await message.channel.send({ embeds: [embed] });
  }
}

module.exports = {
  queues,
  getQueue,
  createServerQueue,
  playNextSong,
  initMusicEngine,
  playMusicFromMessage,
};
