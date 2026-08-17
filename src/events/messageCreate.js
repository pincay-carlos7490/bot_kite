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

            if (actionType === 'unmute_voz') {
              try {
                await targetMember.voice.setMute(false, `Ordenado por ${message.author.tag}`);
                await message.reply(`🎙️ **${targetMember.user.tag}** ya no está silenciado en el canal de voz.`);
                continue;
              } catch (err) {
                await message.reply('❌ No se pudo quitar el silencio en voz al miembro.');
                continue;
              }
            }
          }

          // 0. CREAR CATEGORÍA POR IA
          if (name === 'crear_categoria') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) &&
                !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
              await message.reply('❌ No tienes permiso de **Gestionar Canales** para ejecutar esta acción.');
              continue;
            }

            try {
              const category = await message.guild.channels.create({
                name: args.nombreCategoria,
                type: ChannelType.GuildCategory,
                reason: `Creado por orden agéntica de ${message.author.tag}`
              });

              const embed = new EmbedBuilder()
                .setColor('#9B59B6')
                .setTitle('📁 Nueva Categoría Creada')
                .setDescription(`Se ha creado la categoría **${category.name}** en el servidor.`)
                .addFields({ name: '🛡️ Arquitecto', value: `${message.author}` })
                .setTimestamp();

              await message.channel.send({ embeds: [embed] });
            } catch (err) {
              console.error('Error creando categoría:', err);
              await message.reply('❌ Ocurrió un error al intentar crear la categoría.');
            }
          }

          // 0. CREAR O EDITAR ROL EN EL SERVIDOR (CON PERMISOS DE ROL INTELIGENTE SIN DUPLICADOS)
          if (name === 'crear_eliminar_rol') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles) &&
                !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
              await message.reply('❌ No tienes permiso de **Gestionar Roles** para ejecutar esta acción.');
              continue;
            }

            const action = (args.accion || 'crear').toLowerCase();
            const roleName = args.nombreRol;

            if (action === 'crear') {
              const colorMap = { azul: 'Blue', rojo: 'Red', verde: 'Green', amarillo: 'Yellow', dorado: 'Gold', morado: 'Purple', gris: 'Grey', negro: 'DarkerGrey' };
              const colorValue = colorMap[(args.color || '').toLowerCase()] || args.color || 'Grey';

              let targetRole = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
              let isNew = false;

              if (!targetRole) {
                targetRole = await message.guild.roles.create({
                  name: roleName,
                  color: colorValue,
                  reason: `Creado por orden agéntica de ${message.author.tag}`
                });
                isNew = true;
              }

              // Aplicar o modificar permisos en todos los canales
              const overwrites = {};
              const summaryLines = [];

              if (typeof args.permitirVerCanales === 'boolean') {
                overwrites.ViewChannel = args.permitirVerCanales;
                overwrites.ReadMessageHistory = args.permitirVerCanales;
                summaryLines.push(`• 👁️ **Ver Canales:** ${args.permitirVerCanales ? 'PERMITIDO (Verde ✅)' : 'PROHIBIDO (Rojo ❌)'}`);
              }

              if (typeof args.permitirEscribir === 'boolean') {
                overwrites.SendMessages = args.permitirEscribir;
                summaryLines.push(`• 📝 **Enviar Mensajes:** ${args.permitirEscribir ? 'PERMITIDO (Verde ✅)' : 'PROHIBIDO (Rojo ❌)'}`);
              }

              if (typeof args.permitirVerHistorial === 'boolean') {
                overwrites.ReadMessageHistory = args.permitirVerHistorial;
                summaryLines.push(`• 📜 **Leer Historial:** ${args.permitirVerHistorial ? 'PERMITIDO (Verde ✅)' : 'PROHIBIDO (Rojo ❌)'}`);
              }

              if (typeof args.permitirVoz === 'boolean') {
                overwrites.Connect = args.permitirVoz;
                overwrites.Speak = args.permitirVoz;
                summaryLines.push(`• 🔊 **Unirse a Voz:** ${args.permitirVoz ? 'PERMITIDO (Verde ✅)' : 'PROHIBIDO (Rojo ❌)'}`);
              }

              if (Object.keys(overwrites).length > 0) {
                for (const [, channel] of message.guild.channels.cache) {
                  await channel.permissionOverwrites.edit(targetRole.id, overwrites).catch(() => null);
                }
              }

              const embed = new EmbedBuilder()
                .setColor(targetRole.color || '#57F287')
                .setTitle(isNew ? '🎭 Nuevo Rol Creado y Configurado' : '⚙️ Permisos de Rol Actualizados')
                .setDescription(`Se han actualizado los permisos del rol **${targetRole.name}** (${targetRole}).\n\n` +
                  (summaryLines.length > 0 ? summaryLines.join('\n') : '• Configuración general aplicada.'))
                .setTimestamp();

              await message.channel.send({ embeds: [embed] });
              continue;
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
                await message.channel.send({ embeds: [embed] });
                continue;
              } else {
                await message.reply(`⚠️ El rol **"${roleName}"** no existe en este servidor.`);
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

              // Matriz Completa y Universal de Permisos de Discord (Incluyendo Encuestas y Hilos)
              const overwritesObj = {};
              const summaryLines = [];

              if (typeof args.permitirCrearEncuestas === 'boolean') {
                overwritesObj[PermissionFlagsBits.SendPolls || 'SendPolls'] = args.permitirCrearEncuestas;
                summaryLines.push(`• 📊 **Crear Encuestas:** ${args.permitirCrearEncuestas ? 'PERMITIDO (Verde ✅)' : 'PROHIBIDO (Rojo ❌)'}`);
              }

              if (typeof args.permitirCrearHilosPublicos === 'boolean') {
                overwritesObj.CreatePublicThreads = args.permitirCrearHilosPublicos;
                summaryLines.push(`• 🧵 **Crear Hilos Públicos:** ${args.permitirCrearHilosPublicos ? 'PERMITIDO (Verde ✅)' : 'PROHIBIDO (Rojo ❌)'}`);
              }

              if (typeof args.permitirCrearHilosPrivados === 'boolean') {
                overwritesObj.CreatePrivateThreads = args.permitirCrearHilosPrivados;
                summaryLines.push(`• 🔒 **Crear Hilos Privados:** ${args.permitirCrearHilosPrivados ? 'PERMITIDO (Verde ✅)' : 'PROHIBIDO (Rojo ❌)'}`);
              }

              if (typeof args.permitirMensajesEnHilos === 'boolean') {
                overwritesObj.SendMessagesInThreads = args.permitirMensajesEnHilos;
                summaryLines.push(`• 💬 **Enviar Mensajes en Hilos:** ${args.permitirMensajesEnHilos ? 'PERMITIDO (Verde ✅)' : 'PROHIBIDO (Rojo ❌)'}`);
              }

              if (typeof args.permitirBorrarMensajes === 'boolean') {
                overwritesObj.ManageMessages = args.permitirBorrarMensajes;
                summaryLines.push(`• 🗑️ **Borrar / Gestionar Mensajes:** ${args.permitirBorrarMensajes ? 'PERMITIDO (Verde ✅)' : 'PROHIBIDO (Rojo ❌)'}`);
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

              if (typeof args.permitirVerHistorial === 'boolean') {
                overwritesObj.ReadMessageHistory = args.permitirVerHistorial;
                summaryLines.push(`• 📜 **Leer Historial:** ${args.permitirVerHistorial ? 'PERMITIDO (Verde ✅)' : 'PROHIBIDO (Rojo ❌)'}`);
              }

              if (typeof args.permitirArchivos === 'boolean') {
                overwritesObj.AttachFiles = args.permitirArchivos;
                overwritesObj.EmbedLinks = args.permitirArchivos;
                summaryLines.push(`• 🖼️ **Adjuntar Archivos:** ${args.permitirArchivos ? 'PERMITIDO (Verde ✅)' : 'PROHIBIDO (Rojo ❌)'}`);
              }

              if (typeof args.permitirReacciones === 'boolean') {
                overwritesObj.AddReactions = args.permitirReacciones;
                summaryLines.push(`• 😀 **Añadir Reacciones:** ${args.permitirReacciones ? 'PERMITIDO (Verde ✅)' : 'PROHIBIDO (Rojo ❌)'}`);
              }

              if (typeof args.permitirEmojisExternos === 'boolean') {
                overwritesObj.UseExternalEmojis = args.permitirEmojisExternos;
                summaryLines.push(`• 🎨 **Usar Emojis Externos:** ${args.permitirEmojisExternos ? 'PERMITIDO (Verde ✅)' : 'PROHIBIDO (Rojo ❌)'}`);
              }

              if (typeof args.permitirMencionarEveryone === 'boolean') {
                overwritesObj.MentionEveryone = args.permitirMencionarEveryone;
                summaryLines.push(`• 🔔 **Mencionar @everyone:** ${args.permitirMencionarEveryone ? 'PERMITIDO (Verde ✅)' : 'PROHIBIDO (Rojo ❌)'}`);
              }

              if (typeof args.permitirCrearInvitacion === 'boolean') {
                overwritesObj.CreateInstantInvite = args.permitirCrearInvitacion;
                summaryLines.push(`• 🔗 **Crear Invitación:** ${args.permitirCrearInvitacion ? 'PERMITIDO (Verde ✅)' : 'PROHIBIDO (Rojo ❌)'}`);
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

          // 1. GESTIONAR ROL DE USUARIO (DALE / QUÍTALE UN ROL A UN USUARIO)
          if (name === 'gestionar_rol_usuario') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles) &&
                !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
              await message.reply('❌ No tienes permiso de **Gestionar Roles** para ejecutar esta acción.');
              continue;
            }

            const targetMember = message.mentions.members.filter(m => m.id !== message.client.user.id).first();
            if (!targetMember) {
              await message.reply('⚠️ Debes mencionar al usuario al cual deseas gestionar los roles.');
              continue;
            }

            let addedRole = null;
            let removedRole = null;

            if (args.nombreRolAgregar) {
              const res = findRoleInGuild(args.nombreRolAgregar, message.guild, message.mentions);
              if (res.status === 'found') {
                addedRole = res.role;
                await targetMember.roles.add(addedRole).catch(() => null);
              } else {
                await message.reply(`⚠️ El rol **"${args.nombreRolAgregar}"** no existe en este servidor.`);
                continue;
              }
            }

            if (args.nombreRolQuitar) {
              const res = findRoleInGuild(args.nombreRolQuitar, message.guild, message.mentions);
              if (res.status === 'found') {
                removedRole = res.role;
                await targetMember.roles.remove(removedRole).catch(() => null);
              } else {
                await message.reply(`⚠️ El rol **"${args.nombreRolQuitar}"** no existe en este servidor.`);
                continue;
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

            await message.channel.send({ embeds: [embed] });
            continue;
          }

          // 3. AUTOROL DE BIENVENIDA
          if (name === 'autorol_bienvenida') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles) &&
                !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
              await message.reply('❌ No tienes permiso de **Gestionar Roles** para ejecutar esta acción.');
              continue;
            }

            const inputRole = (args.nombreRol || '').toLowerCase();
            if (inputRole === 'desactivar' || inputRole === 'ninguno' || inputRole === 'remover') {
              await GuildConfig.findOneAndUpdate(
                { guildId: message.guild.id },
                { autoRoleId: null, autoRoleName: null, updatedAt: Date.now() },
                { upsert: true }
              );
              await message.reply('⚙️ El **Autorol de Bienvenida** ha sido **desactivado**.');
              continue;
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
                .setDescription(`Ahora **todos los miembros nuevos** recibirán automáticamente el rol **${targetRole.name}** (${targetRole}).`)
                .addFields({ name: '🛡️ Configurado por', value: `${message.author}` })
                .setTimestamp();

              await message.channel.send({ embeds: [embed] });
              continue;
            } else {
              await message.reply(`⚠️ El rol **"${args.nombreRol}"** no existe en este servidor.`);
              continue;
            }
          }

          // 4. CREAR O EDITAR CANAL DE TEXTO/VOZ (CON SOPORTE DE CATEGORÍA)
          if (name === 'crear_editar_canal') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) &&
                !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
              await message.reply('❌ No tienes permiso de **Gestionar Canales** para ejecutar esta acción.');
              continue;
            }

            const action = (args.accion || 'crear').toLowerCase();
            const channelName = args.nombreCanal;
            const isVoice = (args.tipoCanal || '').toLowerCase().includes('voz');

            let parentCategory = null;
            if (args.nombreCategoria) {
              parentCategory = message.guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === args.nombreCategoria.toLowerCase());
            }

            if (action === 'crear') {
              const createdChannel = await message.guild.channels.create({
                name: channelName,
                type: isVoice ? ChannelType.GuildVoice : ChannelType.GuildText,
                parent: parentCategory ? parentCategory.id : undefined,
                topic: args.topic || 'Canal creado por KITE IA',
                reason: `Creado por orden agéntica de ${message.author.tag}`
              });

              const embed = new EmbedBuilder()
                .setColor('#3498DB')
                .setTitle(isVoice ? '🔊 Nuevo Canal de Voz Creado' : '💬 Nuevo Canal de Texto Creado')
                .setDescription(`Se ha creado el canal **${createdChannel.name}** (${createdChannel})` + (parentCategory ? ` dentro de la categoría **${parentCategory.name}**.` : '.'))
                .addFields({ name: '🛡️ Creado por', value: `${message.author}` })
                .setTimestamp();

              await message.channel.send({ embeds: [embed] });
              continue;
            }

            if (action === 'eliminar') {
              const targetChan = message.guild.channels.cache.find(c => c.name.toLowerCase() === channelName.toLowerCase());
              if (targetChan) {
                await targetChan.delete(`Eliminado por orden agéntica de ${message.author.tag}`);
                await message.reply(`🗑️ El canal **#${channelName}** ha sido eliminado.`);
                continue;
              } else {
                await message.reply(`⚠️ No se encontró el canal **#${channelName}**.`);
                continue;
              }
            }
          }

          // 5. AUDITAR SERVIDOR
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

                await message.channel.send({ embeds: [embed] });
                continue;
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

            await message.channel.send({ embeds: [embed] });
            continue;
          }

          // 6. RESTRINGIR / DESBLOQUEAR CANAL
          if (name === 'restringir_canal') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) &&
                !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
              await message.reply('❌ No tienes permiso de **Gestionar Canales** para ejecutar esta acción.');
              continue;
            }

            const forceUnlock = args.desbloquear === true;
            let targetRole = null;

            if (!forceUnlock && args.nombreRol) {
              const roleResult = findRoleInGuild(args.nombreRol, message.guild, message.mentions);
              if (roleResult.status === 'not_found') {
                await message.reply(`⚠️ El rol **"${args.nombreRol}"** no existe en este servidor.`);
                continue;
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
              await message.channel.send({ embeds: [embed] });
              continue;
            } catch (err) {
              await message.reply('❌ Ocurrió un error al intentar modificar los permisos del canal.');
              continue;
            }
          }

          // 7. MODO PAUSADO
          if (name === 'modo_pausado') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) &&
                !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
              await message.reply('❌ No tienes permiso de **Gestionar Canales** para ejecutar esta acción.');
              continue;
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
              await message.channel.send({ embeds: [embed] });
              continue;
            } catch (err) {
              await message.reply('❌ Ocurrió un error al intentar cambiar el Modo Pausado del canal.');
              continue;
            }
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

          // 9. BANEAR USUARIO
          if (name === 'banear_usuario') {
            if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
              await message.reply('❌ No tienes permiso de **Banear Miembros** para ejecutar esta acción.');
              continue;
            }

            const targetMember = message.mentions.members.filter(m => m.id !== message.client.user.id).first();
            if (!targetMember) {
              await message.reply('⚠️ Debes mencionar al usuario que deseas banear.');
              continue;
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

              await message.channel.send({ embeds: [embed] });
              continue;
            } catch (banErr) {
              await message.reply('❌ Ocurrió un error al intentar banear al usuario.');
              continue;
            }
          }

          // 10. DESBANEAR USUARIO
          if (name === 'desbanear_usuario') {
            if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
              await message.reply('❌ No tienes permiso de **Banear Miembros** para ejecutar esta acción.');
              continue;
            }

            const idMatch = message.content.match(/\d{17,19}/);
            const targetUserId = idMatch ? idMatch[0] : null;

            if (!targetUserId) {
              await message.reply('⚠️ Debes mencionar o escribir la ID del usuario a desbanear.');
              continue;
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

              await message.channel.send({ embeds: [embed] });
              continue;
            } catch (unbanErr) {
              await message.reply('❌ No se encontró el ban de ese usuario en este servidor.');
              continue;
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
