const { Events, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { askAI } = require('../utils/aiManager');
const { isInsultOrToxic, parseModerationIntent } = require('../utils/aiModeration');
const { addTempBan } = require('../utils/tempbans');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    // Ignorar mensajes de bots o fuera de un servidor
    if (message.author.bot || !message.guild) return;

    // -------------------------------------------------------------
    // CASO 1: Filtro de Insultos Multilingüe por IA en tiempo real
    // -------------------------------------------------------------
    const isToxic = await isInsultOrToxic(message.content);

    if (isToxic) {
      try {
        // Borrar el mensaje con el insulto
        await message.delete();

        // Enviar advertencia en el canal
        const warningMsg = await message.channel.send({
          content: `⚠️ ${message.author}, tu mensaje fue eliminado porque contiene insultos o lenguaje no permitido.`
        });

        // Borrar la advertencia después de 6 segundos para mantener limpio el chat
        setTimeout(() => {
          warningMsg.delete().catch(() => null);
        }, 6000);

        return; // Detener procesamiento para mensajes borrados
      } catch (err) {
        console.error('Error borrando mensaje con insulto:', err);
      }
    }

    // -------------------------------------------------------------
    // CASO 2: Moderación Inteligente por Mención (@KITE banea a @usuario...)
    // -------------------------------------------------------------
    if (message.mentions.has(message.client.user) && !message.mentions.everyone) {
      const content = message.content.toLowerCase();

      // Verificar si el mensaje contiene una intención de baneo o sanción
      if (content.includes('banea') || content.includes('banear') || content.includes('sanciona') || content.includes('expulsa')) {
        
        // Verificar si el usuario que dio la orden tiene permiso de banear miembros
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
          return await message.reply('❌ No tienes permiso de **Banear Miembros** para ejecutar esta acción de moderación.');
        }

        // Obtener el usuario mencionado a banear (excluyendo al bot)
        const targetMember = message.mentions.members.filter(m => m.id !== message.client.user.id).first();

        if (!targetMember) {
          return await message.reply('⚠️ Debes mencionar al usuario que deseas banear. Ejemplo: `@KITE banea a @usuario por 5 horas, razon: es molesto`');
        }

        // Verificar jerarquía de roles
        if (targetMember.roles.highest.position >= message.member.roles.highest.position && message.guild.ownerId !== message.author.id) {
          return await message.reply('❌ No puedes banear a este usuario porque tiene un rol igual o superior al tuyo.');
        }

        if (!targetMember.bannable) {
          return await message.reply('❌ No tengo permisos suficientes en el servidor para banear a este usuario.');
        }

        // Parsear duración y razón usando la IA
        const parsedIntent = await parseModerationIntent(message.content);
        const durationStr = parsedIntent?.duration || '5h';
        const reasonStr = parsedIntent?.reason || 'Sanción por orden de moderación';

        // Parsear duración en milisegundos para ban temporal
        let durationMs = 0;
        if (durationStr !== 'permanent') {
          const match = durationStr.match(/^(\d+)([smhd])$/i);
          if (match) {
            const num = parseInt(match[1], 10);
            const unit = match[2].toLowerCase();
            const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
            durationMs = num * (multipliers[unit] || 3600000);
          } else {
            durationMs = 5 * 3600000; // 5 horas por defecto si no especifica unidad
          }
        }

        // Ejecutar el ban
        try {
          await targetMember.ban({ reason: `${reasonStr} (Por ${message.author.tag})` });

          if (durationMs > 0) {
            const expiresAt = new Date(Date.now() + durationMs);
            await addTempBan({
              guildId: message.guild.id,
              userId: targetMember.id,
              userTag: targetMember.user.tag,
              bannedBy: message.author.id,
              reason: reasonStr,
              expiresAt: expiresAt
            });
          }

          const embed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('🔴 Usuario Sancionado por IA')
            .setDescription(`**${targetMember.user.tag}** ha sido baneado del servidor.`)
            .addFields(
              { name: '👤 Usuario', value: `${targetMember.user}`, inline: true },
              { name: '⏱️ Duración', value: durationMs > 0 ? `${durationStr}` : 'Permanente', inline: true },
              { name: '🛡️ Moderador', value: `${message.author}`, inline: true },
              { name: '💬 Razón', value: reasonStr }
            )
            .setTimestamp();

          return await message.channel.send({ embeds: [embed] });
        } catch (banErr) {
          console.error('Error aplicando ban por IA:', banErr);
          return await message.reply('❌ Ocurrió un error al intentar banear al usuario.');
        }
      }

      // Si es una pregunta normal a la IA
      const cleanPrompt = message.content.replace(/<@!?\d+>/g, '').trim();
      if (!cleanPrompt) {
        return message.reply('🤖 ¡Hola! ¿En qué te puedo ayudar hoy? Usa `/ia [pregunta]` o mencióname con tu duda.');
      }

      await message.channel.sendTyping();
      try {
        const aiResponse = await askAI(cleanPrompt, message.author.username);
        await message.reply(aiResponse);
      } catch (error) {
        console.error('Error respondiendo mención de IA:', error);
      }
    }
  },
};
