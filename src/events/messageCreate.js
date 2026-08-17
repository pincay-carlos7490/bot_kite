const { Events, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { processAgenticAI } = require('../utils/aiManager');
const { isInsultOrToxic } = require('../utils/aiModeration');
const { addTempBan, removeTempBan } = require('../utils/tempbans');
const { toggleChannelRestriction, findRoleInGuild } = require('../utils/channelRestrict');

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
    // CASO 2: Motor Agéntico de IA por Mención (@KITE) - Function Calling Pura con Doble Escudo
    // -------------------------------------------------------------
    if (message.mentions.has(message.client.user) && !message.mentions.everyone) {
      await message.channel.sendTyping();

      const cleanPrompt = message.content.replace(/<@!?\d+>/g, '').trim();
      const rolesList = Array.from(message.guild.roles.cache.values());
      const agentResult = await processAgenticAI(cleanPrompt, message.author.username, rolesList);

      if (agentResult.type === 'tool' && agentResult.functionCall) {
        const fn = agentResult.functionCall;
        const name = fn.name;
        const args = fn.args || {};

        // 1. RESTRINGIR / DESBLOQUEAR CANAL (PURA RAZONAMIENTO DE IA)
        if (name === 'restringir_canal') {
          if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) &&
              !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await message.reply('❌ No tienes permiso de **Gestionar Canales** para ejecutar esta acción.');
          }

          const forceUnlock = args.desbloquear === true;
          let targetRole = null;

          if (!forceUnlock && args.nombreRol) {
            const roleResult = findRoleInGuild(args.nombreRol, message.guild, message.mentions);
            if (roleResult.status === 'not_found') {
              return await message.reply(`⚠️ El rol **"${args.nombreRol}"** no existe en este servidor. Por favor verifica los roles de tu servidor.`);
            }
            targetRole = roleResult.role;
          }

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
            console.error('Error modificando canal por IA:', err);
            return await message.reply('❌ Ocurrió un error al intentar modificar los permisos del canal.');
          }
        }

        // 2. MODO PAUSADO (PURA RAZONAMIENTO DE IA)
        if (name === 'modo_pausado') {
          if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) &&
              !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await message.reply('❌ No tienes permiso de **Gestionar Canales** para ejecutar esta acción.');
          }

          const seconds = Math.max(args.segundos || 0, 0);

          try {
            await message.channel.setRateLimitPerUser(seconds, `Por orden de ${message.author.tag}`);
            const embed = new EmbedBuilder()
              .setColor(seconds > 0 ? '#3498DB' : '#57F287')
              .setTitle(seconds > 0 ? '⏱️ Modo Pausado Activado' : '⏱️ Modo Pausado Desactivado')
              .setDescription(seconds > 0 
                ? `El **Modo Pausado** ha sido configurado a **${seconds} segundos** de espera por usuario en este canal.`
                : 'El **Modo Pausado** ha sido **desactivado**. Los miembros pueden enviar mensajes normalmente.')
              .addFields({ name: '🛡️ Moderador', value: `${message.author}` })
              .setTimestamp();
            return await message.channel.send({ embeds: [embed] });
          } catch (err) {
            console.error('Error al cambiar modo pausado por IA:', err);
            return await message.reply('❌ Ocurrió un error al intentar cambiar el Modo Pausado del canal.');
          }
        }

        // 3. BORRAR MENSAJES (PURA RAZONAMIENTO DE IA)
        if (name === 'borrar_mensajes') {
          if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return await message.reply('❌ No tienes permiso de **Gestionar Mensajes** para ejecutar esta acción.');
          }

          const amount = Math.min(Math.max(args.cantidad || 5, 1), 100);

          try {
            const deleted = await message.channel.bulkDelete(amount + 1, true);
            const count = Math.max(deleted.size - 1, 1);

            const confirmMsg = await message.channel.send({
              content: `🧹 **${count} mensajes** eliminados correctamente por orden de ${message.author}.`
            });
            setTimeout(() => confirmMsg.delete().catch(() => null), 4000);
            return;
          } catch (err) {
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

        // 4. BANEAR USUARIO (PURA RAZONAMIENTO DE IA)
        if (name === 'banear_usuario') {
          if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return await message.reply('❌ No tienes permiso de **Banear Miembros** para ejecutar esta acción.');
          }

          const targetMember = message.mentions.members.filter(m => m.id !== message.client.user.id).first();
          if (!targetMember) {
            return await message.reply('⚠️ Debes mencionar al usuario que deseas banear.');
          }

          const durationStr = args.duracion || 'permanent';
          const reasonStr = args.razon || 'Sanción por orden de moderación de IA';

          let durationMs = 0;
          if (durationStr !== 'permanent') {
            const match = durationStr.match(/^(\d+)([smhd])$/i);
            if (match) {
              const num = parseInt(match[1], 10);
              const unit = match[2].toLowerCase();
              const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
              durationMs = num * (multipliers[unit] || 3600000);
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
            return await message.reply('❌ Ocurrió un error al intentar banear al usuario.');
          }
        }

        // 5. DESBANEAR USUARIO (PURA RAZONAMIENTO DE IA)
        if (name === 'desbanear_usuario') {
          if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return await message.reply('❌ No tienes permiso de **Banear Miembros** para ejecutar esta acción.');
          }

          const idMatch = message.content.match(/\d{17,19}/);
          const targetUserId = idMatch ? idMatch[0] : null;

          if (!targetUserId) {
            return await message.reply('⚠️ Debes mencionar o escribir la ID del usuario a desbanear.');
          }

          const reasonStr = args.razon || 'Desbaneo por orden de moderación de IA';

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
            return await message.reply('❌ No se encontró el ban de ese usuario en este servidor.');
          }
        }
      }

      // SI ES CHAT CONVERSACIONAL NORMAL DE IA
      if (agentResult.text) {
        return await message.reply(agentResult.text);
      }
    }
  },
};
