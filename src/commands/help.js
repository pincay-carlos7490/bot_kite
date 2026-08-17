const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Muestra la lista completa de comandos y funciones de KITE Bot')
    .setIntegrationTypes(0, 1)
    .setContexts(0, 1, 2),

  async execute(interaction) {
    const clientId = process.env.CLIENT_ID || interaction.client.user.id;
    const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=8&integration_type=0&scope=bot+applications.commands`;

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setAuthor({ 
        name: `Panel de Ayuda - ${interaction.client.user.username}`, 
        iconURL: interaction.client.user.displayAvatarURL({ dynamic: true }) 
      })
      .setTitle('✨ Lista de Comandos Disponibles')
      .setDescription(
        `¡Hola **${interaction.user.username}**! Aquí tienes todos los comandos organizados por categorías:\n`
      )
      .addFields(
        {
          name: '🧠 Inteligencia Artificial (IA)',
          value: '` /ia ` • Realiza preguntas o conversas con la IA.\n' +
                 '` @KITE ` • Menciona al bot en cualquier canal para chatear con IA.',
          inline: false
        },
        {
          name: '🎵 Música y Llamadas',
          value: '` /play ` • Reproduce canciones de YouTube/SoundCloud.\n' +
                 '` /skip ` • Salta a la siguiente canción en cola.\n' +
                 '` /queue ` • Muestra la lista de reproducción actual.\n' +
                 '` /stop ` • Detiene la música y desconecta al bot.',
          inline: false
        },
        {
          name: '👋 Bienvenidas y Despedidas',
          value: '` /bienvenidas ` • Configura el canal, mensaje e imágenes GIF de bienvenida.\n' +
                 '` /despedidas ` • Configura tarjetas animadas cuando alguien sale del servidor.',
          inline: false
        },
        {
          name: '🛡️ Moderación y Administración',
          value: '` /clear ` • Borra mensajes en masa con filtros por usuario o canal.\n' +
                 '` /ban ` • Sanciona a un usuario de forma temporal o permanente.',
          inline: false
        },
        {
          name: '🎨 Anuncios y Perfiles',
          value: '` /say ` • Publica anuncios y reglas formateadas con Embeds y títulos grandes.\n' +
                 '` /profile ` • Revisa el perfil, banner y antigüedad de un miembro.',
          inline: false
        },
        {
          name: '⚙️ Utilidades',
          value: '` /invitar ` • Enlace directo para añadir el bot a tu servidor.\n' +
                 '` /ping ` • Verifica la latencia y velocidad de respuesta del bot.\n' +
                 '` /hola ` • Saludo personalizado.',
          inline: false
        }
      )
      .setThumbnail(interaction.client.user.displayAvatarURL({ dynamic: true, size: 512 }))
      .setFooter({ text: 'Bot KITE 24/7 en la nube • Usa /invitar para añadirlo' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('➕ Añadir Bot a mi Servidor')
        .setStyle(ButtonStyle.Link)
        .setURL(inviteUrl)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row]
    });
  },
};
