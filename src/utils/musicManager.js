const { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus, 
  VoiceConnectionStatus, 
  entersState 
} = require('@discordjs/voice');
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

  // 1. Si el enlace es de SoundCloud
  if (song.url && song.url.includes('soundcloud.com')) {
    const pdlStream = await play.stream(song.url);
    rawStream = pdlStream.stream;
    inputType = pdlStream.type;
  } else {
    // 2. Transmitir usando la búsqueda de SoundCloud para evitar bloqueos de IP de YouTube
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

  // 3. Crear recurso de audio con control de volumen activado para eliminar la saturación
  const resource = createAudioResource(rawStream, { 
    inputType: inputType,
    inlineVolume: true 
  });

  // Ajustar el volumen al 75% para eliminar el clipping / sonido saturado y entrecortado
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

module.exports = {
  queues,
  getQueue,
  createServerQueue,
  playNextSong,
  initMusicEngine,
};
