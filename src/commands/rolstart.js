const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const GuildConfig = require('../database/models/GuildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rolstart')
    .setDescription('Establece el rol automático que se asignará a cada nuevo miembro que se una al servidor')
    .setIntegrationTypes(0, 1)
    .setContexts(0, 1, 2)
    .addRoleOption(option =>
      option.setName('rol')
        .setDescription('Rol que recibirán los nuevos miembros al unirse')
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
        content: '❌ No puedes establecer un rol gestionado por una integración o el rol @everyone como autorol.',
        ephemeral: true
      });
    }

    try {
      await GuildConfig.findOneAndUpdate(
        { guildId: interaction.guild.id },
        { autoRoleId: role.id, autoRoleName: role.name, updatedAt: Date.now() },
        { upsert: true }
      );

      const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('🌟 Autorol de Bienvenida Configurado')
        .setDescription(`A partir de ahora, cada **nuevo miembro** que ingrese al servidor recibirá automáticamente el rol **${role.name}** (${role}).`)
        .addFields({ name: '🛡️ Configurado por', value: `${interaction.user}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error en /rolstart:', error);
      await interaction.reply({
        content: '❌ Ocurrió un error al guardar la configuración del autorol en la base de datos.',
        ephemeral: true
      });
    }
  },
};
