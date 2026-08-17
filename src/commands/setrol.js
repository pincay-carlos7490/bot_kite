const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setrol')
    .setDescription('Asigna un rol específico a un usuario del servidor')
    .setIntegrationTypes(0, 1)
    .setContexts(0, 1, 2)
    .addRoleOption(option =>
      option.setName('rol')
        .setDescription('Rol que deseas asignar')
        .setRequired(true)
    )
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Usuario al cual deseas asignar el rol')
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

    if (role.managed || role.id === interaction.guild.roles.everyone.id) {
      return await interaction.reply({
        content: '❌ No puedes asignar un rol gestionado por bot/integración ni el rol @everyone.',
        ephemeral: true
      });
    }

    if (role.position >= interaction.guild.members.me.roles.highest.position) {
      return await interaction.reply({
        content: '❌ No puedo asignar este rol porque está ubicado por encima o igual a mi rol más alto.',
        ephemeral: true
      });
    }

    try {
      await member.roles.add(role, `Asignado por ${interaction.user.tag} mediante /setrol`);

      const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('➕ Rol Asignado Exitosamente')
        .setDescription(`Se le ha otorgado el rol **${role.name}** (${role}) a **${member.user.tag}** (${member}).`)
        .addFields({ name: '🛡️ Moderador', value: `${interaction.user}` })
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error en /setrol:', error);
      await interaction.reply({
        content: '❌ Ocurrió un error al intentar asignar el rol al usuario.',
        ephemeral: true
      });
    }
  },
};
