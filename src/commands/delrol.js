const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delrol')
    .setDescription('Remueve un rol específico a un usuario del servidor')
    .setIntegrationTypes(0, 1)
    .setContexts(0, 1, 2)
    .addRoleOption(option =>
      option.setName('rol')
        .setDescription('Rol que deseas remover')
        .setRequired(true)
    )
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Usuario al cual deseas remover el rol')
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
    const targetUser = interaction.options.getUser('usuario');
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!member) {
      return await interaction.reply({
        content: '❌ No se encontró a ese usuario en este servidor.',
        ephemeral: true
      });
    }

    if (!member.roles.cache.has(role.id)) {
      return await interaction.reply({
        content: `⚠️ El usuario **${member.user.tag}** no posee el rol **${role.name}**.`,
        ephemeral: true
      });
    }

    if (role.position >= interaction.guild.members.me.roles.highest.position) {
      return await interaction.reply({
        content: '❌ No puedo remover este rol porque está ubicado por encima o igual a mi rol más alto.',
        ephemeral: true
      });
    }

    try {
      await member.roles.remove(role, `Removido por ${interaction.user.tag} mediante /delrol`);

      const embed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle('➖ Rol Removido Exitosamente')
        .setDescription(`Se le ha quitado el rol **${role.name}** (${role}) a **${member.user.tag}** (${member}).`)
        .addFields({ name: '🛡️ Moderador', value: `${interaction.user}` })
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error en /delrol:', error);
      await interaction.reply({
        content: '❌ Ocurrió un error al intentar remover el rol al usuario.',
        ephemeral: true
      });
    }
  },
};
