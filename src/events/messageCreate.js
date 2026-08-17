const { Events, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { askAI } = require('../utils/aiManager');
const { isInsultOrToxic, parseModerationIntent } = require('../utils/aiModeration');
const { addTempBan, removeTempBan } = require('../utils/tempbans');
const { toggleChannelRestriction } = require('../utils/channelRestrict');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    // -------------------------------------------------------------
    // CASO 1: Filtro de Insultos Multilingüe por IA en tiempo real
    // -------------------------------------------------------------
    const isToxic = await isInsultOrToxic(message.content);

    if (isToxic) {
      try {
        await message.delete();
      } catch (err) {
        console.error('Error al intentar borrar el mensaje con insulto:', err.message);
      }

      try {
        const warningMsg = await message.channel.send({
          content: `⚠️ ${message.author}, tu mensaje fue eliminado porque contiene insultos o lenguaje no permitido.`
        });
        setTimeout(() => {
          warningMsg.delete().catch(() => null);
        }, 6000);
        return;
      } catch (err) {}
    }

    // -------------------------------------------------------------
    // CASO 2: Moderación Inteligente por Mención (@KITE banea, desbanea, borra, restringe...)
    // -------------------------------------------------------------
    if (message.mentions.has(message.client.user) && !message.mentions.everyone) {
      const content = message.content.toLowerCase();

      // A) ORDEN DE RESTRINGIR / DESBLOQUEAR CANAL EN LENGUAJE NATURAL
      if (content.includes('restringe') || content.includes('bloquea') || content.includes('desbloquea') || content.includes('exclusivo') || content.includes('restriccion') || content.includes('restricción')) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) &&
            !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return await message.reply('❌ No tienes permiso de **Gestionar Canales** para ejecutar esta acción.');
        }

        const targetRole = message.mentions.roles.first() || null;
        const forceUnlock = content.includes('desbloquea') || content.includes('quita') || content.includes('remueve') || content.includes('desrestringe');

        try {
          const result = await toggleChannelRestriction(message.channel, message.guild, targetRole, forceUnlock);

          const embed = new EmbedBuilder()
            .setColor(result.restricted ? '#ED4245' : '#57F287')
            .setTitle(result.restricted ? '🔒 Modo Restringido Activado' : '🔓 Modo Restringido Desactivado')
            .setDescription(result.message)
            .addFields({ name: '🛡️ Moderador', value: `${message.author}` })
            .setTimestamp();

          return await message.channel.send({ embeds: [embed] });
        } catch (err) {
          console.error('Error modificando canal por orden de IA:', err);
          return await message.reply('❌ Ocurrió un error al intentar modificar los permisos del canal.');
        }
      }

      // B) ORDEN DE ELIMINAR MENSAJES (@KITE elimina los 5 mensajes anteriores)
      if (content.includes('elimina') || content.includes('borra') || content.includes('purga')) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
          return await message.reply('❌ No tienes permiso de **Gestionar Mensajes** para ejecutar esta acción.');
        }

        const parsed = await parseModerationIntent(message.content);
        const amount = Math.min(Math.max(parsed?.amount || 5, 1), 100);

        try {
          const deleted = await message.channel.bulkDelete(amount + 1, true);
          const confirmMsg = await message.channel.send({
            content: `🧹 **${deleted.size - 1} mensajes** eliminados correctamente por orden de ${message.author}.`
          });
          setTimeout(() => confirmMsg.delete().catch(() => null), 4000);
          return;
        } catch (err) {
          console.error('Error borrando mensajes por orden de IA:', err);
          return await message.reply('❌ Ocurrió un error al intentar borrar los mensajes.');
        }
      }

      // C) ORDEN DE DESBANEAR (@KITE desbanea a este usuario porque si xd)
      if (content.includes('desbanea') || content.includes('unban') || content.includes('quita ban')) {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
          return await message.reply('❌ No tienes permiso de **Banear Miembros** para ejecutar esta acción.');
        }

        const idMatch = message.content.match(/\d{17,19}/);
        const targetUserId = idMatch ? idMatch[0] : null;

        if (!targetUserId) {
          return await message.reply('⚠️ Debes mencionar o escribir la ID del usuario a desbanear. Ejemplo: `@KITE desbanea a @usuario porque si xd`');
        }

        const parsedIntent = await parseModerationIntent(message.content);
        const reasonStr = parsedIntent?.reason || 'Desbaneo por orden de moderación';

        try {
          await message.guild.bans.remove(targetUserId, `${reasonStr} (Por ${message.author.tag})`);
          await removeTempBan(message.guild.id, targetUserId);

          const embed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('🟢 Usuario Desbaneado por IA')
            .setDescription(`El usuario con ID \`${targetUserId}\` ha sido desbaneado del servidor.`)
            .addFields(
              { name: '🛡️ Moderador', value: `${message.author}`, inline: true },
              { name: '💬 Razón', value: reasonStr }
            )
            .setTimestamp();

          return await message.channel.send({ embeds: [embed] });
        } catch (unbanErr) {
          console.error('Error desbaneando usuario:', unbanErr);
          return await message.reply('❌ No se encontró el ban de ese usuario en este servidor o ya fue desbaneado.');
        }
      }

      // D) ORDEN DE BANEAR (@KITE banea a @usuario...)
      if (content.includes('banea') || content.includes('banear') || content.includes('sanciona')) {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
          return await message.reply('❌ No tienes permiso de **Banear Miembros** para ejecutar esta acción.');
        }

        const targetMember = message.mentions.members.filter(m => m.id !== message.client.user.id).first();
        if (!targetMember) {
          return await message.reply('⚠️ Debes mencionar al usuario que deseas banear. Ejemplo: `@KITE banea a @usuario por inactividad`');
        }

        if (targetMember.roles.highest.position >= message.member.roles.highest.position && message.guild.ownerId !== message.author.id) {
          return await message.reply('❌ No puedes banear a este usuario porque tiene un rol igual o superior al tuyo.');
        }

        if (!targetMember.bannable) {
          return await message.reply('❌ No tengo permisos suficientes en el servidor para banear a este usuario.');
        }

        const parsedIntent = await parseModerationIntent(message.content);
        const durationStr = parsedIntent?.duration || 'permanent';
        const reasonStr = parsedIntent?.reason || 'Sanción por orden de moderación';

        let durationMs = 0;
        if (durationStr !== 'permanent') {
          const match = durationStr.match(/^(\d+)([smhd])$/i);
          if (match) {
            const num = parseInt(match[1], 10);
            const unit = match[2].toLowerCase();
            const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
            durationMs = num * (multipliers[unit] || 3600000);
          } else {
            durationMs = 5 * 3600000;
          }
        }

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

      // E) PREGUNTA NORMAL A LA IA
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
