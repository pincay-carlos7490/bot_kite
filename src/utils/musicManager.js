const { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus, 
  VoiceConnectionStatus, 
  entersState 
} = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');
const play = require('play-dl');

const queues = new Map();

function getQueue(guildId) {
  return queues.get(guildId) || null;
}

async function getAudioStream(song) {
  // 1. Intentar primero con la URL de YouTube si está disponible
  if (song.url && (song.url.includes('youtube.com') || song.url.includes('youtu.be'))) {
    try {
      const stream = ytdl(song.url, {
        filter: 'audioonly',
        highWaterMark: 1 << 25,
        quality: 'highestaudio',
        requestOptions: {
          headers: {
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
          }
        }
      });
      return createAudioResource(stream);
    } catch (err) {
      console.log(`⚠️ YouTube bloqueó IP de Render para "${song.title}", pasando a motor SoundCloud...`);
    }

    try {
      const pdlStream = await play.stream(song.url);
      return createAudioResource(pdlStream.stream, { inputType: pdlStream.type });
    } catch (err) {
      console.log(`⚠️ Falló play-dl YouTube, buscando automáticamente en SoundCloud...`);
    }
  } else if (song.url && song.url.includes('soundcloud.com')) {
    const pdlStream = await play.stream(song.url);
    return createAudioResource(pdlStream.stream, { inputType: pdlStream.type });
  }

  // 2. Respaldo Automático Anti-Bloqueos: Buscar y transmitir el mismo título en SoundCloud (Sin bloqueos de IP en la nube)
  try {
    const scResults = await play.search(song.title, { source: { soundcloud: 'tracks' }, limit: 1 });
    if (scResults && scResults.length > 0) {
      console.log(`✅ Transmitiendo "${song.title}" desde fuente libre de bloqueos.`);
      const pdlStream = await play.stream(scResults[0].url);
      return createAudioResource(pdlStream.stream, { inputType: pdlStream.type });
    }
  } catch (scErr) {
    console.error('Error en respaldo SoundCloud:', scErr);
  }

  throw new Error('No se pudo obtener el audio de ninguna fuente disponible.');
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

async function createServerQueue(interaction, voiceChannel) {
  const guildId = interaction.guild.id;
  const player = createAudioPlayer();

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guildId,
    adapterCreator: interaction.guild.voiceAdapterCreator,
  });

  const queueConstruct = {
    textChannel: interaction.channel,
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
    console.error('Audio Player Error:', error);
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

module.exports = {
  queues,
  getQueue,
  createServerQueue,
  playNextSong,
};
