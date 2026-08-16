const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invitar')
    .setDescription('Obtén el enlace e instrucciones para invitar el bot a tu propio servidor'),

  async execute(interaction) {
    const clientId = process.env.CLIENT_ID || interaction.client.user.id;
    const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=8&integration_type=0&scope=bot+applications.commands`;

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setAuthor({ 
        name: interaction.client.user.username, 
        iconURL: interaction.client.user.displayAvatarURL({ dynamic: true }) 
      })
      .setTitle(`🚀 ¡Añade a ${interaction.client.user.username} a tu servidor!`)
      .setDescription(
        `¡Gracias por tu interés en **${interaction.client.user.username}**!\n\n` +
        `Puedes invitar el bot a cualquier servidor donde tengas permisos de **Administrador** o **Gestionar Servidor**.\n\n` +
        `✨ **Incluye:**\n` +
        `• Bienvenidas animadas personalizadas con GIF.\n` +
        `• Sistema de moderación y baneos temporales con auto-unban.\n` +
        `• Limpieza de mensajes (/clear).\n` +
        `• Anuncios y reglas con tarjetas Embed (/say).\n` +
        `• Perfiles completos de usuarios (/profile).\n` +
        `• Base de datos 24/7 en la nube.`
      )
      .setThumbnail(interaction.client.user.displayAvatarURL({ dynamic: true, size: 512 }))
      .setFooter({ text: 'Bot KITE 24/7 en la nube' });

    // Crear botón interactivo de enlace
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
