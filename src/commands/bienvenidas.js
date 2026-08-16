const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { getWelcomeConfig, setWelcomeConfig } = require('../utils/welcomeStore');
const { generateWelcomeImage } = require('../utils/welcomeCanvas');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bienvenidas')
    .setDescription('Configura o prueba el sistema de bienvenidas con imagen personalizada')
    .addSubcommand(subcommand =>
      subcommand
        .setName('configurar')
        .setDescription('Configura el canal, mensaje e imagen de fondo para las bienvenidas')
        .addChannelOption(option =>
          option.setName('canal')
            .setDescription('Canal donde se enviarán las bienvenidas')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('mensaje')
            .setDescription('Texto fuera de la imagen. Usa {usuario}, {servidor}, {miembros}, {username}')
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('fondo_imagen')
            .setDescription('URL de la imagen de fondo para la tarjeta de bienvenida (Opcional)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('probar')
        .setDescription('Envía una bienvenida de prueba en este canal para ver cómo luce')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('desactivar')
        .setDescription('Desactiva el sistema de bienvenidas en el servidor')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subcommand === 'configurar') {
      const channel = interaction.options.getChannel('canal');
      const customMessage = interaction.options.getString('mensaje');
      const backgroundUrl = interaction.options.getString('fondo_imagen');

      const existingConfig = getWelcomeConfig(guildId) || {};
      const newConfig = {
        enabled: true,
        channelId: channel.id,
        message: customMessage || existingConfig.message || '¡Bienvenido, {usuario}, a **{servidor}**!\nPuedes obtener más información leyendo las reglas y hablar con el resto de usuarios.',
        backgroundUrl: backgroundUrl || existingConfig.backgroundUrl || null,
      };

      setWelcomeConfig(guildId, newConfig);

      const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('✅ Bienvenidas Configuradas')
        .setDescription(`El sistema de bienvenidas ha sido activado correctamente en ${channel}.`)
        .addFields(
          { name: '💬 Mensaje:', value: newConfig.message },
          { name: '🖼️ Fondo:', value: newConfig.backgroundUrl ? 'Personalizado' : 'Por defecto' }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } else if (subcommand === 'desactivar') {
      setWelcomeConfig(guildId, { enabled: false });
      await interaction.reply({
        content: '🔴 El sistema de bienvenidas ha sido desactivado en este servidor.',
        ephemeral: true
      });

    } else if (subcommand === 'probar') {
      await interaction.deferReply({ ephemeral: true });

      const config = getWelcomeConfig(guildId) || {
        enabled: true,
        channelId: interaction.channel.id,
        message: '¡Bienvenido, {usuario}, a **{servidor}**!\nPuedes obtener más información leyendo las reglas y hablar con el resto de usuarios.',
        backgroundUrl: null
      };

      // Generar imagen de prueba con los datos del usuario que ejecuta el comando
      const attachment = await generateWelcomeImage(interaction.member, config.backgroundUrl);

      let textContent = config.message
        .replace(/{usuario}/g, `${interaction.user}`)
        .replace(/{username}/g, interaction.user.username)
        .replace(/{servidor}/g, interaction.guild.name)
        .replace(/{miembros}/g, interaction.guild.memberCount);

      // Reemplazar \n por saltos de línea reales
      textContent = textContent.replace(/\\n/g, '\n');

      await interaction.channel.send({
        content: textContent,
        files: [attachment]
      });

      await interaction.editReply({
        content: '✅ Se ha enviado una bienvenida de prueba en este canal.'
      });
    }
  },
};
