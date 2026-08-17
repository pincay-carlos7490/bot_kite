const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearrol')
    .setDescription('Elimina un rol existente del servidor')
    .setIntegrationTypes(0, 1)
    .setContexts(0, 1, 2)
    .addRoleOption(option =>
      option.setName('rol')
        .setDescription('Rol que deseas eliminar del servidor')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles) && 
        !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({
        content: '❌ No tienes permiso de **Gestionar Roles** para ejecutar este comando.',
        ephemeral: true
      });
    }

    const role = interaction.options.getRole('rol');

    if (role.managed || role.id === interaction.guild.roles.everyone.id) {
      return await interaction.reply({
        content: '❌ No puedes eliminar un rol gestionado por bot/integración ni el rol @everyone.',
        ephemeral: true
      });
    }

    if (role.position >= interaction.guild.members.me.roles.highest.position) {
      return await interaction.reply({
        content: '❌ No puedo eliminar este rol porque está ubicado por encima o igual a mi rol más alto.',
        ephemeral: true
      });
    }

    const roleName = role.name;

    try {
      await role.delete(`Eliminado por ${interaction.user.tag} mediante /clearrol`);

      const embed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle('🗑️ Rol Eliminado Exitosamente')
        .setDescription(`El rol **"${roleName}"** ha sido eliminado por completo del servidor.`)
        .addFields({ name: '🛡️ Moderador', value: `${interaction.user}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error en /clearrol:', error);
      await interaction.reply({
        content: '❌ Ocurrió un error al intentar eliminar el rol.',
        ephemeral: true
      });
    }
  },
};
