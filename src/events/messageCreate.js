const { Events, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { processAgenticAI } = require('../utils/aiManager');
const { isInsultOrToxic } = require('../utils/aiModeration');
const { addTempBan, removeTempBan } = require('../utils/tempbans');
const { toggleChannelRestriction, findRoleInGuild } = require('../utils/channelRestrict');
const { playMusicFromMessage, stopMusic, skipSong } = require('../utils/musicManager');
const GuildConfig = require('../database/models/GuildConfig');

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
    // CASO 2: Motor Agéntico Autónomo de IA por Mención (@KITE)
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

        // 0. REPRODUCIR MÚSICA EN CANAL DE VOZ POR IA
        if (name === 'reproducir_musica') {
          const query = args.busqueda || cleanPrompt;
          return await playMusicFromMessage(message, query);
        }

        // 0. DESCONECTAR MÚSICA / SALIR DEL CANAL DE VOZ POR IA
        if (name === 'desconectar_musica') {
          return await stopMusic(message);
        }

        // 0. SALTAR CANCIÓN / SKIP POR IA
        if (name === 'saltar_cancion') {
          return await skipSong(message);
        }

        // 1. GESTIONAR ROL DE USUARIO (DALE / QUÍTALE UN ROL A UN USUARIO)
        if (name === 'gestionar_rol_usuario') {
          if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles) &&
              !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await message.reply('❌ No tienes permiso de **Gestionar Roles** para ejecutar esta acción.');
          }

          const targetMember = message.mentions.members.filter(m => m.id !== message.client.user.id).first();
          if (!targetMember) {
            return await message.reply('⚠️ Debes mencionar al usuario al cual deseas gestionar los roles.');
          }

          let addedRole = null;
          let removedRole = null;

          if (args.nombreRolAgregar) {
            const res = findRoleInGuild(args.nombreRolAgregar, message.guild, message.mentions);
            if (res.status === 'found') {
              addedRole = res.role;
              await targetMember.roles.add(addedRole).catch(() => null);
            } else {
              return await message.reply(`⚠️ El rol **"${args.nombreRolAgregar}"** no existe en este servidor.`);
            }
          }

          if (args.nombreRolQuitar) {
            const res = findRoleInGuild(args.nombreRolQuitar, message.guild, message.mentions);
            if (res.status === 'found') {
              removedRole = res.role;
              await targetMember.roles.remove(removedRole).catch(() => null);
            } else {
              return await message.reply(`⚠️ El rol **"${args.nombreRolQuitar}"** no existe en este servidor.`);
            }
          }

          const embed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('👤 Roles de Usuario Actualizados')
            .setDescription(`Se han modificado los roles de **${targetMember.user.tag}** (${targetMember}).`)
            .addFields(
              { name: '➕ Rol Asignado', value: addedRole ? `${addedRole}` : 'Ninguno', inline: true },
              { name: '➖ Rol Removido', value: removedRole ? `${removedRole}` : 'Ninguno', inline: true },
              { name: '🛡️ Moderador', value: `${message.author}` }
            )
            .setThumbnail(targetMember.user.displayAvatarURL())
            .setTimestamp();

          return await message.channel.send({ embeds: [embed] });
        }

        // 2. CREAR O ELIMINAR ROL EN EL SERVIDOR
        if (name === 'crear_eliminar_rol') {
          if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles) &&
              !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await message.reply('❌ No tienes permiso de **Gestionar Roles** para ejecutar esta acción.');
          }

          const action = (args.accion || 'crear').toLowerCase();
          const roleName = args.nombreRol;

          if (action === 'crear') {
            const colorMap = { azul: 'Blue', rojo: 'Red', verde: 'Green', amarillo: 'Yellow', dorado: 'Gold', morado: 'Purple', negro: 'DarkerGrey' };
            const colorValue = colorMap[(args.color || '').toLowerCase()] || args.color || 'Blue';

            const createdRole = await message.guild.roles.create({
              name: roleName,
              color: colorValue,
              reason: `Creado por orden agéntica de ${message.author.tag}`
            });

            const embed = new EmbedBuilder()
              .setColor(createdRole.color || '#57F287')
              .setTitle('🎭 Nuevo Rol Creado')
              .setDescription(`Se ha creado exitosamente el rol **${createdRole.name}** (${createdRole}).`)
              .addFields({ name: '🛡️ Creado por', value: `${message.author}` })
              .setTimestamp();

            return await message.channel.send({ embeds: [embed] });
          }

          if (action === 'eliminar') {
            const res = findRoleInGuild(roleName, message.guild, message.mentions);
            if (res.status === 'found') {
              await res.role.delete(`Eliminado por orden agéntica de ${message.author.tag}`);
              const embed = new EmbedBuilder()
                .setColor('#ED4245')
                .setTitle('🗑️ Rol Eliminado')
                .setDescription(`El rol **"${roleName}"** ha sido eliminado del servidor.`)
                .addFields({ name: '🛡️ Moderador', value: `${message.author}` })
                .setTimestamp();
              return await message.channel.send({ embeds: [embed] });
            } else {
              return await message.reply(`⚠️ El rol **"${roleName}"** no existe en este servidor.`);
            }
          }
        }

        // 3. AUTOROL DE BIENVENIDA (ASIGNAR ROL A NUEVOS MIEMBROS AUTOMÁTICAMENTE)
        if (name === 'autorol_bienvenida') {
          if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles) &&
              !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await message.reply('❌ No tienes permiso de **Gestionar Roles** para ejecutar esta acción.');
          }

          const inputRole = (args.nombreRol || '').toLowerCase();
          if (inputRole === 'desactivar' || inputRole === 'ninguno' || inputRole === 'remover') {
            await GuildConfig.findOneAndUpdate(
              { guildId: message.guild.id },
              { autoRoleId: null, autoRoleName: null, updatedAt: Date.now() },
              { upsert: true }
            );
            return await message.reply('⚙️ El **Autorol de Bienvenida** ha sido **desactivado**. Los nuevos usuarios ya no recibirán un rol automático.');
          }

          const res = findRoleInGuild(args.nombreRol, message.guild, message.mentions);
          if (res.status === 'found') {
            const targetRole = res.role;
            await GuildConfig.findOneAndUpdate(
              { guildId: message.guild.id },
              { autoRoleId: targetRole.id, autoRoleName: targetRole.name, updatedAt: Date.now() },
              { upsert: true }
            );

            const embed = new EmbedBuilder()
              .setColor('#57F287')
              .setTitle('🌟 Autorol de Bienvenida Configurado')
              .setDescription(`Ahora **todos los miembros nuevos** que ingresen al servidor recibirán automáticamente el rol **${targetRole.name}** (${targetRole}).`)
              .addFields({ name: '🛡️ Configurado por', value: `${message.author}` })
              .setTimestamp();

            return await message.channel.send({ embeds: [embed] });
          } else {
            return await message.reply(`⚠️ El rol **"${args.nombreRol}"** no existe en este servidor.`);
          }
        }

        // 4. CREAR O EDITAR CANAL DE TEXTO/VOZ
        if (name === 'crear_editar_canal') {
          if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) &&
              !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await message.reply('❌ No tienes permiso de **Gestionar Canales** para ejecutar esta acción.');
          }

          const action = (args.accion || 'crear').toLowerCase();
          const channelName = args.nombreCanal;
          const isVoice = (args.tipoCanal || '').toLowerCase().includes('voz');

          if (action === 'crear') {
            const createdChannel = await message.guild.channels.create({
              name: channelName,
              type: isVoice ? ChannelType.GuildVoice : ChannelType.GuildText,
              topic: args.topic || 'Canal creado por KITE IA',
              reason: `Creado por orden agéntica de ${message.author.tag}`
            });

            const embed = new EmbedBuilder()
              .setColor('#3498DB')
              .setTitle(isVoice ? '🔊 Nuevo Canal de Voz Creado' : '💬 Nuevo Canal de Texto Creado')
              .setDescription(`Se ha creado el canal **${createdChannel.name}** (${createdChannel}).`)
              .addFields({ name: '🛡️ Creado por', value: `${message.author}` })
              .setTimestamp();

            return await message.channel.send({ embeds: [embed] });
          }

          if (action === 'eliminar') {
            const targetChan = message.guild.channels.cache.find(c => c.name.toLowerCase() === channelName.toLowerCase());
            if (targetChan) {
              await targetChan.delete(`Eliminado por orden agéntica de ${message.author.tag}`);
              return await message.reply(`🗑️ El canal **#${channelName}** ha sido eliminado.`);
            } else {
              return await message.reply(`⚠️ No se encontró el canal **#${channelName}**.`);
            }
          }
        }

        // 5. AUDITAR SERVIDOR / MIEMBROS DE UN ROL
        if (name === 'auditar_servidor') {
          await message.guild.members.fetch();

          if (args.consulta === 'miembros_rol' && args.nombreRol) {
            const res = findRoleInGuild(args.nombreRol, message.guild, message.mentions);
            if (res.status === 'found') {
              const r = res.role;
              const membersWithRole = r.members.map(m => m.user.tag).slice(0, 25);
              const totalCount = r.members.size;

              const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle(`📊 Auditoría de Rol: ${r.name}`)
                .setDescription(`Total de miembros con este rol: **${totalCount}**`)
                .addFields({ name: '👤 Lista de Miembros (Muestra)', value: membersWithRole.length > 0 ? membersWithRole.join('\n') : 'Ningún miembro tiene este rol.' })
                .setTimestamp();

              return await message.channel.send({ embeds: [embed] });
            }
          }

          const rolesCount = message.guild.roles.cache.size;
          const membersCount = message.guild.memberCount;

          const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📊 Auditoría General del Servidor')
            .addFields(
              { name: '👥 Total de Miembros', value: `${membersCount}`, inline: true },
              { name: '🎭 Total de Roles', value: `${rolesCount}`, inline: true }
            )
            .setTimestamp();

          return await message.channel.send({ embeds: [embed] });
        }

        // 6. RESTRINGIR / DESBLOQUEAR CANAL
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
              return await message.reply(`⚠️ El rol **"${args.nombreRol}"** no existe en este servidor.`);
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
            return await message.reply('❌ Ocurrió un error al intentar modificar los permisos del canal.');
          }
        }

        // 7. MODO PAUSADO
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
            return await message.reply('❌ Ocurrió un error al intentar cambiar el Modo Pausado del canal.');
          }
        }

        // 8. BORRAR MENSAJES
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

        // 9. BANEAR USUARIO
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

        // 10. DESBANEAR USUARIO
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
