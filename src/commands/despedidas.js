const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { getGoodbyeConfig, setGoodbyeConfig } = require('../utils/goodbyeStore');
const { generateGoodbyeImage } = require('../utils/goodbyeCanvas');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('despedidas')
    .setDescription('Configura o prueba el sistema de despedidas cuando un usuario sale del servidor')
    .setIntegrationTypes(0, 1)
    .setContexts(0, 1, 2)
    .addSubcommand(subcommand =>
      subcommand
        .setName('configurar')
        .setDescription('Configura el canal, mensaje e imagen de fondo para las despedidas')
        .addChannelOption(option =>
          option.setName('canal')
            .setDescription('Canal donde se enviarán las despedidas')
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
            .setDescription('URL de la imagen o GIF de fondo para la tarjeta de despedida (Opcional)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('probar')
        .setDescription('Envía una despedida de prueba en este canal para ver cómo luce')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('desactivar')
        .setDescription('Desactiva el sistema de despedidas en el servidor')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subcommand === 'configurar') {
      const channel = interaction.options.getChannel('canal');
      const customMessage = interaction.options.getString('mensaje');
      const backgroundUrl = interaction.options.getString('fondo_imagen');

      const existingConfig = getGoodbyeConfig(guildId) || {};
      const newConfig = {
        enabled: true,
        channelId: channel.id,
        message: customMessage || existingConfig.message || '👋 **{username}** ha dejado el servidor **{servidor}**. ¡Esperamos vuelva pronto!',
        backgroundUrl: backgroundUrl || existingConfig.backgroundUrl || null,
      };

      await setGoodbyeConfig(guildId, newConfig);

      const embed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle('🔴 Despedidas Configuradas')
        .setDescription(`El sistema de despedidas ha sido activado correctamente en ${channel}.`)
        .addFields(
          { name: '💬 Mensaje:', value: newConfig.message },
          { name: '🖼️ Fondo:', value: newConfig.backgroundUrl ? 'Personalizado' : 'Por defecto' }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } else if (subcommand === 'desactivar') {
      await setGoodbyeConfig(guildId, { enabled: false });
      await interaction.reply({
        content: '🔴 El sistema de despedidas ha sido desactivado en este servidor.',
        ephemeral: true
      });

    } else if (subcommand === 'probar') {
      await interaction.deferReply({ ephemeral: true });

      const config = getGoodbyeConfig(guildId) || {
        enabled: true,
        channelId: interaction.channel.id,
        message: '👋 **{username}** ha dejado el servidor **{servidor}**. ¡Esperamos vuelva pronto!',
        backgroundUrl: null
      };

      // Generar imagen de despedida de prueba con los datos del usuario que ejecuta el comando
      const attachment = await generateGoodbyeImage(interaction.member, config.backgroundUrl);

      let textContent = config.message
        .replace(/{usuario}/g, `${interaction.user}`)
        .replace(/{username}/g, interaction.user.username)
        .replace(/{servidor}/g, interaction.guild.name)
        .replace(/{miembros}/g, interaction.guild.memberCount);

      textContent = textContent.replace(/\\n/g, '\n');

      await interaction.channel.send({
        content: textContent,
        files: [attachment]
      });

      await interaction.editReply({
        content: '✅ Se ha enviado una despedida de prueba en este canal.'
      });
    }
  },
};
