const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Elimina mensajes, con opciones opcionales de usuario o canal')
    .addIntegerOption(option =>
      option.setName('cantidad')
        .setDescription('Número de mensajes a borrar (de 1 a 100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Filtrar y borrar solo los mensajes de este usuario (Opcional)')
        .setRequired(false)
    )
    .addChannelOption(option =>
      option.setName('canal')
        .setDescription('Canal objetivo donde borrar los mensajes (Opcional)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const amount = interaction.options.getInteger('cantidad');
    const targetUser = interaction.options.getUser('usuario');
    const targetChannel = interaction.options.getChannel('canal') || interaction.channel;

    await interaction.deferReply({ ephemeral: true });

    try {
      let deletedCount = 0;

      if (targetUser) {
        // Obtener mensajes recientes para filtrar los del usuario específico
        const fetchedMessages = await targetChannel.messages.fetch({ limit: 100 });
        const userMessages = fetchedMessages
          .filter(msg => msg.author.id === targetUser.id)
          .first(amount);

        if (!userMessages || userMessages.length === 0) {
          return await interaction.editReply({
            content: `🔍 No se encontraron mensajes recientes del usuario ${targetUser} en ${targetChannel}.`
          });
        }

        const deleted = await targetChannel.bulkDelete(userMessages, true);
        deletedCount = deleted.size;
      } else {
        // Borrado general si no hay filtro de usuario
        const deleted = await targetChannel.bulkDelete(amount, true);
        deletedCount = deleted.size;
      }

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🧹 Limpieza de mensajes')
        .setTimestamp();

      let description = `Se han eliminado **${deletedCount}** mensaje(s) en ${targetChannel}.`;
      if (targetUser) {
        description += `\n👤 **Filtro por usuario:** ${targetUser}`;
      }

      embed.setDescription(description);

      if (deletedCount < amount && !targetUser) {
        embed.setFooter({ 
          text: 'Nota: Discord no permite borrar en masa mensajes con más de 14 días de antigüedad.' 
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error al borrar mensajes:', error);
      await interaction.editReply({
        content: '❌ No se pudieron borrar los mensajes. Verifica que el bot tenga el permiso **Gestionar Mensajes** en el canal de destino.'
      });
    }
  },
};
