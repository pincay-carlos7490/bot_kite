const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { toggleChannelRestriction } = require('../utils/channelRestrict');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('restringir')
    .setDescription('Restringe o desbloquea el canal actual para miembros o roles específicos')
    .setIntegrationTypes(0, 1)
    .setContexts(0, 1, 2)
    .addRoleOption(option =>
      option.setName('rol')
        .setDescription('Rol exclusivo permitido para escribir en este canal (Opcional)')
        .setRequired(false)
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

    const targetRole = interaction.options.getRole('rol');

    try {
      const result = await toggleChannelRestriction(interaction.channel, interaction.guild, targetRole);

      const embed = new EmbedBuilder()
        .setColor(result.restricted ? '#ED4245' : '#57F287')
        .setTitle(result.restricted ? '🔒 Modo Restringido Activado' : '🔓 Modo Restringido Desactivado')
        .setDescription(result.message)
        .addFields({ name: '🛡️ Ejecutado por', value: `${interaction.user}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error en /restringir:', error);
      await interaction.reply({
        content: '❌ Ocurrió un error al intentar modificar los permisos del canal.',
        ephemeral: true
      });
    }
  },
};
