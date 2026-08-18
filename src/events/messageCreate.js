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
    // CASO 2: Motor Agéntico Autónomo Administrador Total por Mención (@KITE)
    // -------------------------------------------------------------
    if (message.mentions.has(message.client.user) && !message.mentions.everyone) {
      await message.channel.sendTyping();

      const cleanPrompt = message.content.replace(/<@!?\d+>/g, '').trim();
      const rolesList = Array.from(message.guild.roles.cache.values());

      // 1. Mapeo en Tiempo Real del Servidor
      const channelsList = message.guild.channels.cache.map(c => `#${c.name}`).slice(0, 30).join(', ');
      const rolesListNames = message.guild.roles.cache.map(r => `@${r.name}`).slice(0, 30).join(', ');
      const guildContext = {
        summary: `Servidor: "${message.guild.name}" | Canales Existentes: [${channelsList}] | Roles Existentes: [${rolesListNames}]`
      };

      // 2. Historial de Conversación Reciente en Memoria (Incluyendo Mensajes y Embeds de KITE)
      let chatHistory = '';
      try {
        const fetchedMsgs = await message.channel.messages.fetch({ limit: 10 });
        chatHistory = Array.from(fetchedMsgs.values())
          .reverse()
          .map(m => {
            const author = m.author.username;
            let text = m.content ? m.content.replace(/<@!?\d+>/g, '').trim() : '';
            if (m.embeds && m.embeds.length > 0) {
              const embedDetails = m.embeds.map(e => `${e.title || ''}: ${e.description || ''}`).join(' ');
              text = text ? `${text} [Embed: ${embedDetails}]` : `[Embed: ${embedDetails}]`;
            }
            return text ? `[${author}]: ${text}` : null;
          })
          .filter(Boolean)
          .join('\n');
      } catch (historyErr) {
        console.log('Error obteniendo historial de chat:', historyErr.message);
      }

      const agentResult = await processAgenticAI(cleanPrompt, message.author.username, rolesList, guildContext, chatHistory);

      if ((agentResult.type === 'tools' || agentResult.type === 'tool') && (agentResult.functionCalls || agentResult.functionCall)) {
        const calls = agentResult.functionCalls || [agentResult.functionCall];

        for (const fn of calls) {
          const name = fn.name;
          const args = fn.args || {};

          // 0. HERRAMIENTA DINÁMICA DE RESPALDO UNIVERSAL (CATCH-ALL)
          if (name === 'ejecutar_metodo_discord_dinamico') {
            const entity = (args.entidadObjetivo || '').toLowerCase();
            const prop = (args.metodoPropiedad || '').toLowerCase();
            const valStr = String(args.valor || '').toLowerCase();

            if (entity.includes('rol') || prop.includes('hoist') || prop.includes('separado')) {
              const resTarget = findRoleInGuild(args.nombreObjetivo, message.guild, message.mentions);
              if (resTarget.status === 'found') {
                const r = resTarget.role;
                const isFalse = valStr.includes('false') || cleanPrompt.toLowerCase().includes('no ');
                try {
                  await r.setHoist(!isFalse);
                  const embed = new EmbedBuilder()
                    .setColor(r.color || '#57F287')
                    .setTitle('🎭 Configuración de Rol Actualizada (Dinámica)')
                    .setDescription(`El rol **${r.name}** (${r}) ahora ${!isFalse ? '**se muestra por separado**' : '**NO se muestra por separado**'}.`)
                    .addFields({ name: '🛡️ Moderador', value: `${message.author}` })
                    .setTimestamp();
                  await message.channel.send({ embeds: [embed] });
                  continue;
                } catch (e) {}
              }
            }
          }

          // 0. GESTIONAR ROLES AVANZADO (RENOMBRAR, MOVER JERARQUÍA, SEPARAR MIEMBROS - HOIST)
          if (name === 'gestionar_roles_avanzado') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles) &&
                !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
              await message.reply('❌ No tienes permiso de **Gestionar Roles** para ejecutar esta acción.');
              continue;
            }

            const roleName = args.nombreRol;
            const resTarget = findRoleInGuild(roleName, message.guild, message.mentions);

            if (resTarget.status === 'found') {
              const targetRole = resTarget.role;

              // Cambiar visibilidad de separado en lista de miembros (Hoist)
              if (typeof args.separarMiembros === 'boolean') {
                try {
                  await targetRole.setHoist(args.separarMiembros, `Por orden de ${message.author.tag}`);
                  const embed = new EmbedBuilder()
                    .setColor(targetRole.color || '#57F287')
                    .setTitle('🎭 Configuración de Rol Actualizada')
                    .setDescription(`El rol **${targetRole.name}** (${targetRole}) ahora ${args.separarMiembros ? '**se muestra por separado** en la lista de miembros.' : '**NO se muestra por separado** (agrupado normalmente).'}`)
                    .addFields({ name: '🛡️ Moderador', value: `${message.author}` })
                    .setTimestamp();
                  await message.channel.send({ embeds: [embed] });
                  continue;
                } catch (err) {
                  await message.reply('❌ No pude cambiar la visibilidad del rol en la lista.');
                  continue;
                }
              }

              // Renombrar rol
              if (args.nuevoNombre) {
                const oldName = targetRole.name;
                try {
                  await targetRole.setName(args.nuevoNombre);
                  const embed = new EmbedBuilder()
                    .setColor(targetRole.color || '#57F287')
                    .setTitle('✏️ Nombre de Rol Actualizado')
                    .setDescription(`El rol **"${oldName}"** ha sido renombrado exitosamente a **"${args.nuevoNombre}"** (${targetRole}).`)
                    .addFields({ name: '🛡️ Moderador', value: `${message.author}` })
                    .setTimestamp();
                  await message.channel.send({ embeds: [embed] });
                  continue;
                } catch (err) {
                  await message.reply('❌ No pude cambiar el nombre de ese rol (puede que sea un rol administrado por un bot o superior).');
                  continue;
                }
              }

              // Mover jerarquía
              if (args.rolReferencia) {
                const resRef = findRoleInGuild(args.rolReferencia, message.guild, message.mentions);
                if (resRef.status === 'found') {
                  const refRole = resRef.role;
                  let newPos = refRole.position;
                  if ((args.posicionRelativa || '').toLowerCase() === 'debajo') {
                    newPos = Math.max(refRole.position - 1, 1);
                  } else {
                    newPos = refRole.position + 1;
                  }

                  try {
                    await targetRole.setPosition(newPos);
                    const embed = new EmbedBuilder()
                      .setColor('#57F287')
                      .setTitle('🎚️ Jerarquía de Rol Actualizada')
                      .setDescription(`El rol **${targetRole.name}** (${targetRole}) ha sido movido **${args.posicionRelativa || 'debajo'}** del rol **${refRole.name}** (${refRole}).`)
                      .addFields({ name: '🛡️ Moderador', value: `${message.author}` })
                      .setTimestamp();
                    await message.channel.send({ embeds: [embed] });
                    continue;
                  } catch (posErr) {
                    await message.reply('❌ No pude mover la posición del rol. Recuerda que el rol de KITE en Discord debe estar en la parte superior para poder ordenar a los demás roles.');
                    continue;
                  }
                }
              }
            } else {
              await message.reply(`⚠️ No se encontró el rol **"${roleName}"** en este servidor.`);
              continue;
            }
          }

          // 0. GESTIONAR CANAL AVANZADO
          if (name === 'gestionar_canal_avanzado') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) &&
                !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
              await message.reply('❌ No tienes permiso de **Gestionar Canales** para ejecutar esta acción.');
              continue;
            }

            const chanName = args.nombreCanal;
            const targetChan = message.guild.channels.cache.find(c => c.name.toLowerCase() === (chanName || '').toLowerCase()) || message.channel;

            if (args.nuevoNombre) {
              await targetChan.setName(args.nuevoNombre).catch(() => null);
            }
            if (args.topic) {
              await targetChan.setTopic(args.topic).catch(() => null);
            }
            if (typeof args.nsfw === 'boolean') {
              await targetChan.setNSFW(args.nsfw).catch(() => null);
            }
            if (typeof args.modoPausadoSegundos === 'number') {
              await targetChan.setRateLimitPerUser(args.modoPausadoSegundos).catch(() => null);
            }

            const embed = new EmbedBuilder()
              .setColor('#3498DB')
              .setTitle('⚙️ Configuración de Canal Actualizada')
              .setDescription(`Se han actualizado las propiedades del canal **${targetChan}**.`)
              .addFields({ name: '🛡️ Moderador', value: `${message.author}` })
              .setTimestamp();
            await message.channel.send({ embeds: [embed] });
            continue;
          }

          // 0. GESTIONAR SERVIDOR GENERAL (FOTO DE PERFIL DE SERVIDOR, NOMBRE, EMOJIS)
          if (name === 'gestionar_servidor_general') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild) &&
                !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
              await message.reply('❌ No tienes permiso de **Gestionar Servidor** para ejecutar esta acción.');
              continue;
            }

            const actionType = args.tipoAccion;

            if (actionType === 'cambiar_icono') {
              let iconUrl = args.valor;
              if (message.attachments.size > 0) {
                iconUrl = message.attachments.first().url;
              }

              if (!iconUrl) {
                await message.reply('⚠️ Por favor proporciona una imagen adjunta o un enlace URL para cambiar la foto del servidor.');
                continue;
              }

              try {
                await message.guild.setIcon(iconUrl);
                const embed = new EmbedBuilder()
                  .setColor('#57F287')
                  .setTitle('🖼️ Icono del Servidor Actualizado')
                  .setDescription(`Se ha cambiado la foto de perfil del servidor **${message.guild.name}**.`)
                  .setThumbnail(iconUrl)
                  .addFields({ name: '🛡️ Moderador', value: `${message.author}` })
                  .setTimestamp();
                await message.channel.send({ embeds: [embed] });
                continue;
              } catch (err) {
                console.error('Error cambiando el icono del servidor:', err);
                await message.reply('❌ No se pudo cambiar la foto del servidor. Asegúrate de enviar una imagen válida en formato PNG/JPG.');
                continue;
              }
            }

            if (actionType === 'cambiar_nombre') {
              const newName = args.valor;
              if (!newName) {
                await message.reply('⚠️ Debes especificar el nuevo nombre para el servidor.');
                continue;
              }

              try {
                const oldName = message.guild.name;
                await message.guild.setName(newName);
                const embed = new EmbedBuilder()
                  .setColor('#57F287')
                  .setTitle('🏷️ Nombre del Servidor Actualizado')
                  .setDescription(`Se ha cambiado el nombre del servidor de **"${oldName}"** a **"${newName}"**.`)
                  .addFields({ name: '🛡️ Moderador', value: `${message.author}` })
                  .setTimestamp();
                await message.channel.send({ embeds: [embed] });
                continue;
              } catch (err) {
                await message.reply('❌ No se pudo cambiar el nombre del servidor.');
                continue;
              }
            }

            if (actionType === 'crear_emoji') {
              let emojiUrl = args.valor;
              if (message.attachments.size > 0) {
                emojiUrl = message.attachments.first().url;
              }

              if (!emojiUrl) {
                await message.reply('⚠️ Por favor adjunta una imagen o enlace URL para crear el emoji.');
                continue;
              }

              try {
                const emojiName = `emoji_${Date.now()}`;
                const createdEmoji = await message.guild.emojis.create({ attachment: emojiUrl, name: emojiName });
                await message.reply(`🎉 ¡Emoji creado con éxito! ${createdEmoji}`);
                continue;
              } catch (err) {
                await message.reply('❌ Ocurrió un error al crear el emoji personalizado.');
                continue;
              }
            }
          }

          // 0. GESTIONAR MIEMBRO AVANZADO (APODOS, MUTE EN VOZ, TIMEOUT)
          if (name === 'gestionar_miembro_avanzado') {
            const actionType = args.tipoAccion;
            const targetMember = message.mentions.members.filter(m => m.id !== message.client.user.id).first() ||
                                 message.guild.members.cache.find(m => m.user.username.toLowerCase().includes((args.usuario || '').toLowerCase()));

            if (!targetMember) {
              await message.reply(`⚠️ No se encontró al usuario **"${args.usuario}"** en este servidor.`);
              continue;
            }

            if (actionType === 'apodo') {
              if (!message.member.permissions.has(PermissionFlagsBits.ManageNicknames) &&
                  !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                await message.reply('❌ No tienes permiso de **Gestionar Apodos** para ejecutar esta acción.');
                continue;
              }

              try {
                const newNick = args.valor || null;
                await targetMember.setNickname(newNick);
                await message.reply(`✏️ Apodo de **${targetMember.user.tag}** cambiado a **"${newNick || targetMember.user.username}"**.`);
                continue;
              } catch (err) {
                await message.reply('❌ No pude cambiar el apodo de ese usuario (puede que tenga un rol superior al mío).');
                continue;
              }
            }

            if (actionType === 'mute_voz') {
              if (!message.member.permissions.has(PermissionFlagsBits.MuteMembers)) {
                await message.reply('❌ No tienes permiso de **Silenciar Miembros en Voz**.');
                continue;
              }

              try {
                await targetMember.voice.setMute(true, `Ordenado por ${message.author.tag}`);
                await message.reply(`🎙️ **${targetMember.user.tag}** ha sido silenciado en el canal de voz.`);
                continue;
              } catch (err) {
                await message.reply('❌ No se pudo silenciar al miembro en voz (asegúrate de que esté en un canal de voz).');
                continue;
              }
            }
          }

          // 0. CONFIGURAR PERMISOS AVANZADOS DINÁMICOS Y UNIVERSALES DE ROLES EN CANAL POR IA
          if (name === 'configurar_permisos_canal') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) &&
                !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
              await message.reply('❌ No tienes permiso de **Gestionar Canales** para ejecutar esta acción.');
              continue;
            }

            let targetChan = message.mentions.channels.first();

            if (!targetChan && args.nombreCanal) {
              const cleanStr = args.nombreCanal.replace(/<#|>/g, '').trim().toLowerCase();
              targetChan = message.guild.channels.cache.get(cleanStr) ||
                           message.guild.channels.cache.find(c => c.name.toLowerCase() === cleanStr);
            }

            if (!targetChan) {
              targetChan = message.channel;
            }

            try {
              const rolesToModify = [];
              const rolesTargetStr = (args.rolesObjetivo || '').toLowerCase();

              if (rolesTargetStr.includes('everyone') || rolesTargetStr.includes('todos')) {
                rolesToModify.push(message.guild.roles.everyone);
              }

              for (const [id, role] of message.guild.roles.cache) {
                if (role.id === message.guild.roles.everyone.id) continue;
                const rName = role.name.toLowerCase();

                if (rolesTargetStr.includes(rName) ||
                    (rolesTargetStr.includes('sobreviviente') && rName.includes('sobreviviente')) ||
                    (rolesTargetStr.includes('miembro') && rName.includes('miembro')) ||
                    (rolesTargetStr.includes('mod') && rName.includes('mod')) ||
                    (rolesTargetStr.includes('admin') && rName.includes('admin')) ||
                    (rolesTargetStr.includes('mute') && rName.includes('mute'))) {
                  rolesToModify.push(role);
                }
              }

              if (rolesToModify.length === 0) {
                for (const [id, role] of message.guild.roles.cache) {
                  const rName = role.name.toLowerCase();
                  if (rName.includes('sobreviviente') || rName.includes('miembro') || rName.includes('mod') || rName.includes('mute')) {
                    rolesToModify.push(role);
                  }
                }
                if (rolesToModify.length === 0) rolesToModify.push(message.guild.roles.everyone);
              }

              const overwritesObj = {};
              const summaryLines = [];

              if (typeof args.permitirUsarPanelDeSonidos === 'boolean') {
                overwritesObj[PermissionFlagsBits.UseSoundboard || 'UseSoundboard'] = args.permitirUsarPanelDeSonidos;
                summaryLines.push(`• 🔊 **Usar Panel de Sonidos (Soundboard):** ${args.permitirUsarPanelDeSonidos ? 'PERMITIDO (Verde ✅)' : 'PROHIBIDO (Rojo ❌)'}`);
              }

              if (typeof args.permitirEscribir === 'boolean') {
                overwritesObj.SendMessages = args.permitirEscribir;
                summaryLines.push(`• 📝 **Enviar Mensajes:** ${args.permitirEscribir ? 'PERMITIDO (Verde ✅)' : 'PROHIBIDO (Rojo ❌)'}`);
              }

              if (typeof args.permitirVer === 'boolean') {
                overwritesObj.ViewChannel = args.permitirVer;
                overwritesObj.ReadMessageHistory = args.permitirVer;
                summaryLines.push(`• 👁️ **Ver Canal:** ${args.permitirVer ? 'PERMITIDO (Verde ✅)' : 'OCULTO (Rojo ❌)'}`);
              }

              if (Object.keys(overwritesObj).length === 0) {
                overwritesObj.SendMessages = true;
                summaryLines.push('• 📝 **Enviar Mensajes:** PERMITIDO (Verde ✅)');
              }

              for (const role of rolesToModify) {
                await targetChan.permissionOverwrites.edit(role.id, overwritesObj);
              }

              const modifiedNames = rolesToModify.map(r => r.name).join(', ');

              const embed = new EmbedBuilder()
                .setColor(summaryLines.some(l => l.includes('PROHIBIDO') || l.includes('OCULTO')) ? '#ED4245' : '#57F287')
                .setTitle('⚙️ Permisos de Canal Actualizados por IA')
                .setDescription(`Se han actualizado los permisos en el canal **${targetChan}**:\n\n` +
                  `• 🎭 **Roles Modificados:** ${modifiedNames}\n` +
                  summaryLines.join('\n'))
                .addFields({ name: '🛡️ Configurado por', value: `${message.author}` })
                .setTimestamp();

              await message.channel.send({ embeds: [embed] });
            } catch (err) {
              console.error('Error configurando permisos dinámicos de canal:', err);
              await message.reply('❌ Ocurrió un error al configurar los permisos del canal.');
            }
          }

          // 0. REPRODUCIR MÚSICA EN CANAL DE VOZ POR IA
          if (name === 'reproducir_musica') {
            const query = args.busqueda || cleanPrompt;
            await playMusicFromMessage(message, query);
            continue;
          }

          // 0. DESCONECTAR MÚSICA / SALIR DEL CANAL DE VOZ POR IA
          if (name === 'desconectar_musica') {
            await stopMusic(message);
            continue;
          }

          // 0. SALTAR CANCIÓN / SKIP POR IA
          if (name === 'saltar_cancion') {
            await skipSong(message);
            continue;
          }

          // 8. BORRAR MENSAJES
          if (name === 'borrar_mensajes') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
              await message.reply('❌ No tienes permiso de **Gestionar Mensajes** para ejecutar esta acción.');
              continue;
            }

            const amount = Math.min(Math.max(args.cantidad || 5, 1), 100);

            try {
              const deleted = await message.channel.bulkDelete(amount + 1, true);
              const count = Math.max(deleted.size - 1, 1);

              const confirmMsg = await message.channel.send({
                content: `🧹 **${count} mensajes** eliminados correctamente por orden de ${message.author}.`
              });
              setTimeout(() => confirmMsg.delete().catch(() => null), 4000);
              continue;
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
                continue;
              } catch (e) {
                await message.reply('❌ No se pudieron borrar los mensajes. Asegúrate de que el bot tenga el permiso de **Gestionar Mensajes** en este canal.');
                continue;
              }
            }
          }
        }
        return;
      }

      // SI ES CHAT CONVERSACIONAL NORMAL DE IA
      if (agentResult.text) {
        return await message.reply(agentResult.text);
      }
    }
  },
};
