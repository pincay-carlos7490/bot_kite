const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { addTempBan, parseDuration } = require('../utils/tempbans');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Sanciona a un usuario de forma permanente o temporal')
    .setIntegrationTypes(0, 1)
    .setContexts(0, 1, 2)
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Usuario a banear del servidor')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('razon')
        .setDescription('Razón del baneo (Opcional)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('duracion')
        .setDescription('Duración ej: 30m, 2h, 1d, 7d (Omitir para BAN PERMANENTE)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('usuario');
    const reason = interaction.options.getString('razon') || 'Sin razón especificada';
    const durationInput = interaction.options.getString('duracion');

    await interaction.deferReply();

    // 1. Validaciones básicas
    if (targetUser.id === interaction.user.id) {
      return await interaction.editReply({
        content: '❌ No puedes banearte a ti mismo.'
      });
    }

    if (targetUser.id === interaction.client.user.id) {
      return await interaction.editReply({
        content: '❌ No puedes banear al bot.'
      });
    }

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    // 2. Verificar jerarquía si el miembro está en el servidor
    if (member) {
      if (!member.bannable) {
        return await interaction.editReply({
          content: '❌ No puedo banear a este usuario. Tiene un rol igual o superior al bot.'
        });
      }

      if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
        return await interaction.editReply({
          content: '❌ No puedes banear a este usuario porque tiene un rol igual o superior al tuyo.'
        });
      }
    }

    // 3. Procesar Duración (si se especificó)
    let isTemporary = false;
    let unbanTimestamp = null;
    let durationFormatted = 'Permanente ♾️';

    if (durationInput) {
      const durationMs = parseDuration(durationInput);
      if (!durationMs) {
        return await interaction.editReply({
          content: '❌ Formato de duración inválido. Usa formato corto como: `30m` (30 minutos), `2h` (2 horas), `1d` (1 día) o `7d` (7 días).'
        });
      }

      isTemporary = true;
      unbanTimestamp = Date.now() + durationMs;
      const unbanUnix = Math.floor(unbanTimestamp / 1000);
      durationFormatted = `${durationInput} (Finaliza: <t:${unbanUnix}:R>)`;
    }

    // 4. Intentar enviar mensaje privado al usuario sancionado
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle(`⛔ Has sido baneado de ${interaction.guild.name}`)
        .addFields(
          { name: '📄 Razón', value: reason },
          { name: '⏳ Duración', value: isTemporary ? durationInput : 'Permanente' },
          { name: '🛡️ Moderador', value: interaction.user.tag }
        )
        .setTimestamp();

      await targetUser.send({ embeds: [dmEmbed] }).catch(() => null);
    } catch (e) {
      // Ignorar si el usuario tiene MDs cerrados
    }

    // 5. Aplicar el BAN en Discord
    try {
      await interaction.guild.members.ban(targetUser.id, {
        reason: `${reason} | Baneado por: ${interaction.user.tag}`
      });

      // Si es temporal, guardar registro en el verificador automático
      if (isTemporary && unbanTimestamp) {
        addTempBan(interaction.guild.id, targetUser.id, unbanTimestamp, reason);
      }

      // 6. Enviar confirmación pública en el canal
      const embed = new EmbedBuilder()
        .setColor(isTemporary ? '#FEE75C' : '#ED4245')
        .setTitle('⛔ Usuario Sancionado')
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '👤 Usuario', value: `**${targetUser.tag}** (\`${targetUser.id}\`)`, inline: false },
          { name: '📄 Razón', value: reason, inline: false },
          { name: '⏳ Duración', value: durationFormatted, inline: true },
          { name: '🛡️ Moderador', value: `${interaction.user}`, inline: true }
        )
        .setFooter({ text: `Acción realizada en ${interaction.guild.name}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error al aplicar ban:', error);
      await interaction.editReply({
        content: '❌ Ocurrió un error al intentar banear al usuario. Revisa los permisos del bot.'
      });
    }
  },
};
