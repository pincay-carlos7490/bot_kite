const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pausado')
    .setDescription('Configura el Modo Pausado (Slowmode) del canal actual')
    .setIntegrationTypes(0, 1)
    .setContexts(0, 1, 2)
    .addIntegerOption(option =>
      option.setName('segundos')
        .setDescription('Segundos de espera entre mensajes (0 para desactivar)')
        .setRequired(true)
        .addChoices(
          { name: 'Desactivado (0s)', value: 0 },
          { name: '5 segundos', value: 5 },
          { name: '10 segundos', value: 10 },
          { name: '15 segundos', value: 15 },
          { name: '30 segundos', value: 30 },
          { name: '1 minuto (60s)', value: 60 },
          { name: '2 minutos (120s)', value: 120 },
          { name: '5 minutos (300s)', value: 300 },
          { name: '10 minutos (600s)', value: 600 },
          { name: '15 minutos (900s)', value: 900 },
          { name: '30 minutos (1800s)', value: 1800 },
          { name: '1 hora (3600s)', value: 3600 },
          { name: '2 horas (7200s)', value: 7200 },
          { name: '6 horas (21600s)', value: 21600 }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) && 
        !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({
        content: '❌ No tienes permiso de **Gestionar Canales** para ejecutar este comando.',
        ephemeral: true
      });
    }

    const seconds = interaction.options.getInteger('segundos');

    try {
      await interaction.channel.setRateLimitPerUser(seconds, `Por orden de ${interaction.user.tag}`);

      const embed = new EmbedBuilder()
        .setColor(seconds > 0 ? '#3498DB' : '#57F287')
        .setTitle(seconds > 0 ? '⏱️ Modo Pausado Activado' : '⏱️ Modo Pausado Desactivado')
        .setDescription(seconds > 0 
          ? `El **Modo Pausado** ha sido configurado a **${seconds} segundos** de espera por usuario en este canal.`
          : 'El **Modo Pausado** ha sido **desactivado**. Los miembros pueden enviar mensajes normalmente.')
        .addFields({ name: '🛡️ Moderador', value: `${interaction.user}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error en /pausado:', error);
      await interaction.reply({
        content: '❌ Ocurrió un error al intentar cambiar el Modo Pausado del canal.',
        ephemeral: true
      });
    }
  },
};
