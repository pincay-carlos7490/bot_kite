const { PermissionFlagsBits } = require('discord.js');

async function toggleChannelRestriction(channel, guild, targetRole = null, forceUnlock = false) {
  const everyoneRole = guild.roles.everyone;
  const currentEveryoneOverride = channel.permissionOverwrites.cache.get(everyoneRole.id);
  const isCurrentlyLocked = currentEveryoneOverride && currentEveryoneOverride.deny.has(PermissionFlagsBits.SendMessages);

  // 1. DESBLOQUEAR CANAL (@KITE quita la restriccion / desbloquea)
  if (forceUnlock || (isCurrentlyLocked && !targetRole)) {
    // Restaurar @everyone a la normalidad
    await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: null });

    // Restaurar todos los roles del canal que fueron bloqueados previamente
    for (const [id, override] of channel.permissionOverwrites.cache) {
      const role = guild.roles.cache.get(id);
      if (role && role.id !== everyoneRole.id && !role.managed && !role.permissions.has(PermissionFlagsBits.Administrator)) {
        await channel.permissionOverwrites.edit(role, { SendMessages: null });
      }
    }

    if (targetRole) {
      await channel.permissionOverwrites.edit(targetRole, { SendMessages: null });
    }

    return {
      restricted: false,
      message: '🔓 **Canal Desbloqueado:** La restricción ha sido removida. El canal ha vuelto a la normalidad y todos pueden escribir.'
    };
  }

  // 2. RESTRINGIR CANAL
  if (targetRole) {
    // Exclusivo para un rol específico (ej: @VIP)
    await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: false });

    // Bloquear también todos los demás roles excepto targetRole y Admins
    for (const [id, override] of channel.permissionOverwrites.cache) {
      const role = guild.roles.cache.get(id);
      if (role && role.id !== everyoneRole.id && role.id !== targetRole.id && !role.managed && !role.permissions.has(PermissionFlagsBits.Administrator)) {
        await channel.permissionOverwrites.edit(role, { SendMessages: false });
      }
    }

    await channel.permissionOverwrites.edit(targetRole, { SendMessages: true });

    return {
      restricted: true,
      message: `🔒 **Canal Restringido:** Ahora este canal es exclusivo para el rol ${targetRole} (además de Administradores y Bots). Ningún otro rol puede escribir.`
    };
  } else {
    // Bloquear para TODOS los roles del servidor en este canal (evita la anomalía de roles con permisos heredados)
    await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: false });

    for (const [id, override] of channel.permissionOverwrites.cache) {
      const role = guild.roles.cache.get(id);
      if (role && role.id !== everyoneRole.id && !role.managed && !role.permissions.has(PermissionFlagsBits.Administrator)) {
        await channel.permissionOverwrites.edit(role, { SendMessages: false });
      }
    }

    return {
      restricted: true,
      message: '🔒 **Canal Restringido:** El canal ha sido bloqueado por completo. Solo Administradores y Bots pueden escribir aquí.'
    };
  }
}

module.exports = {
  toggleChannelRestriction,
};
