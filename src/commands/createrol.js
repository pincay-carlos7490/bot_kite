const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createrol')
    .setDescription('Crea un nuevo rol en el servidor con nombre y color personalizado')
    .setIntegrationTypes(0, 1)
    .setContexts(0, 1, 2)
    .addStringOption(option =>
      option.setName('nombre')
        .setDescription('Nombre del nuevo rol')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('color')
        .setDescription('Color del rol (ej: rojo, azul, verde, dorado, morado o código Hex #FF5733)')
        .setRequired(false)
        .addChoices(
          { name: '🔵 Azul', value: 'Blue' },
          { name: '🔴 Rojo', value: 'Red' },
          { name: '🟢 Verde', value: 'Green' },
          { name: '🟡 Amarillo', value: 'Yellow' },
          { name: '👑 Dorado (Gold)', value: 'Gold' },
          { name: '🟣 Morado (Purple)', value: 'Purple' },
          { name: '⚪ Blanco', value: 'White' },
          { name: '⚫ Negro / Gris Oscuro', value: 'DarkerGrey' }
        )
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

    const name = interaction.options.getString('nombre');
    const colorInput = interaction.options.getString('color') || 'Blue';

    try {
      const createdRole = await interaction.guild.roles.create({
        name: name,
        color: colorInput,
        reason: `Creado por ${interaction.user.tag} mediante /createrol`
      });

      const embed = new EmbedBuilder()
        .setColor(createdRole.color || '#57F287')
        .setTitle('🎭 Nuevo Rol Creado Exitosamente')
        .setDescription(`Se ha creado el rol **${createdRole.name}** (${createdRole}) en el servidor.`)
        .addFields(
          { name: '🎨 Color', value: `${colorInput}`, inline: true },
          { name: '🛡️ Creado por', value: `${interaction.user}`, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error en /createrol:', error);
      await interaction.reply({
        content: '❌ Ocurrió un error al intentar crear el rol en el servidor.',
        ephemeral: true
      });
    }
  },
};
