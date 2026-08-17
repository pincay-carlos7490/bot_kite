const { Events, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { askAI } = require('../utils/aiManager');
const { isInsultOrToxic, parseSemanticIntent } = require('../utils/aiModeration');
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
    // CASO 2: Motor Agéntico de IA por Mención (@KITE) - Entendimiento Semántico Libre
    // -------------------------------------------------------------
    if (message.mentions.has(message.client.user) && !message.mentions.everyone) {
      const rolesList = Array.from(message.guild.roles.cache.values());
      const intentResult = parseSemanticIntent(message.content, rolesList);

      // A) RESTRINGIR / CERRAR / CANDADO EN CANAL
      if (intentResult.intent === 'RESTRICT_CHANNEL') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) &&
            !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return await message.reply('❌ No tienes permiso de **Gestionar Canales** para ejecutar esta acción.');
        }

        await message.channel.sendTyping();

        if (intentResult.status === 'not_found') {
          return await message.reply(`⚠️ El rol **"${intentResult.requestedRoleName}"** no existe en este servidor. Por favor verifica los roles de tu servidor.`);
        }

        try {
          const result = await toggleChannelRestriction(message.channel, message.guild, intentResult.role, false);
          const embed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('🔒 Modo Restringido Activado')
            .setDescription(result.message)
            .addFields({ name: '🛡️ Moderador', value: `${message.author}` })
            .setTimestamp();
          return await message.channel.send({ embeds: [embed] });
        } catch (err) {
          console.error('Error al restringir canal:', err);
          return await message.reply('❌ Ocurrió un error al intentar modificar los permisos del canal.');
        }
      }

      // B) DESBLOQUEAR / ABRIR / LIBERAR CANAL
      if (intentResult.intent === 'UNRESTRICT_CHANNEL') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) &&
            !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return await message.reply('❌ No tienes permiso de **Gestionar Canales** para ejecutar esta acción.');
        }

        await message.channel.sendTyping();

        try {
          const result = await toggleChannelRestriction(message.channel, message.guild, null, true);
          const embed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('🔓 Modo Restringido Desactivado')
            .setDescription(result.message)
            .addFields({ name: '🛡️ Moderador', value: `${message.author}` })
            .setTimestamp();
          return await message.channel.send({ embeds: [embed] });
        } catch (err) {
          console.error('Error al desbloquear canal:', err);
          return await message.reply('❌ Ocurrió un error al intentar desbloquear el canal.');
        }
      }

      // C) ELIMINAR / LIMPIAR / PURGAR MENSAJES
      if (intentResult.intent === 'CLEAR_MESSAGES') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
          return await message.reply('❌ No tienes permiso de **Gestionar Mensajes** para ejecutar esta acción.');
        }

        const amount = Math.min(Math.max(intentResult.amount || 5, 1), 100);

        try {
          const deleted = await message.channel.bulkDelete(amount + 1, true);
          const count = Math.max(deleted.size - 1, 1);

          const confirmMsg = await message.channel.send({
            content: `🧹 **${count} mensajes** eliminados correctamente por orden de ${message.author}.`
          });
          setTimeout(() => confirmMsg.delete().catch(() => null), 4000);
          return;
        } catch (err) {
          console.error('Error borrando mensajes en lote, intentando borrado individual:', err);

          try {
            const fetchedMsgs = await message.channel.messages.fetch({ limit: amount + 1 });
            let count = 0;
            for (const [id, msg] of fetchedMsgs) {
              if (msg.deletable) {
                await msg.delete().catch(() => null);
                count++;
              }
            }
            const confirmMsg = await message.channel.send({
              content: `🧹 **${Math.max(count - 1, 1)} mensajes** eliminados por orden de ${message.author}.`
            });
            setTimeout(() => confirmMsg.delete().catch(() => null), 4000);
            return;
          } catch (e) {
            return await message.reply('❌ No se pudieron borrar los mensajes. Asegúrate de que el bot tenga el permiso de **Gestionar Mensajes** en este canal.');
          }
        }
      }

      // D) DESBANEAR / LIBERAR BAN DE USUARIO
      if (intentResult.intent === 'UNBAN_USER') {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
          return await message.reply('❌ No tienes permiso de **Banear Miembros** para ejecutar esta acción.');
        }

        const idMatch = message.content.match(/\d{17,19}/);
        const targetUserId = idMatch ? idMatch[0] : null;

        if (!targetUserId) {
          return await message.reply('⚠️ Debes mencionar o escribir la ID del usuario a desbanear.');
        }

        try {
          await message.guild.bans.remove(targetUserId, `${intentResult.reason} (Por ${message.author.tag})`);
          await removeTempBan(message.guild.id, targetUserId);

          const embed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('🟢 Usuario Desbaneado por IA')
            .setDescription(`El usuario con ID \`${targetUserId}\` ha sido desbaneado del servidor.`)
            .addFields(
              { name: '🛡️ Moderador', value: `${message.author}`, inline: true },
              { name: '💬 Razón', value: intentResult.reason }
            )
            .setTimestamp();

          return await message.channel.send({ embeds: [embed] });
        } catch (unbanErr) {
          console.error('Error desbaneando usuario:', unbanErr);
          return await message.reply('❌ No se encontró el ban de ese usuario en este servidor.');
        }
      }

      // E) BANEAR / EXPULSAR / SANCIONAR USUARIO
      if (intentResult.intent === 'BAN_USER') {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
          return await message.reply('❌ No tienes permiso de **Banear Miembros** para ejecutar esta acción.');
        }

        const targetMember = message.mentions.members.filter(m => m.id !== message.client.user.id).first();
        if (!targetMember) {
          return await message.reply('⚠️ Debes mencionar al usuario que deseas banear.');
        }

        if (targetMember.roles.highest.position >= message.member.roles.highest.position && message.guild.ownerId !== message.author.id) {
          return await message.reply('❌ No puedes banear a este usuario porque tiene un rol igual o superior al tuyo.');
        }

        if (!targetMember.bannable) {
          return await message.reply('❌ No tengo permisos suficientes para banear a este usuario.');
        }

        const durationStr = intentResult.duration || 'permanent';
        const reasonStr = intentResult.reason || 'Sanción por orden de moderación';

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

      // F) PREGUNTA O CHARLA NORMAL CON LA IA
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
