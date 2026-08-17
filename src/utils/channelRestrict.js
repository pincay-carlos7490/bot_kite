const { PermissionFlagsBits } = require('discord.js');

async function toggleChannelRestriction(channel, guild, targetRole = null, forceUnlock = false) {
  const everyoneRole = guild.roles.everyone;
  const currentEveryoneOverride = channel.permissionOverwrites.cache.get(everyoneRole.id);
  const isCurrentlyLocked = currentEveryoneOverride && currentEveryoneOverride.deny.has(PermissionFlagsBits.SendMessages);

  // 1. DESBLOQUEAR CANAL (@KITE quita la restriccion / desbloquea)
  if (forceUnlock || (isCurrentlyLocked && !targetRole)) {
    const promises = [channel.permissionOverwrites.edit(everyoneRole, { SendMessages: null })];

    for (const [id, override] of channel.permissionOverwrites.cache) {
      const role = guild.roles.cache.get(id);
      if (role && role.id !== everyoneRole.id && !role.managed && !role.permissions.has(PermissionFlagsBits.Administrator)) {
        promises.push(channel.permissionOverwrites.edit(role, { SendMessages: null }).catch(() => null));
      }
    }

    if (targetRole) {
      promises.push(channel.permissionOverwrites.edit(targetRole, { SendMessages: null }).catch(() => null));
    }

    await Promise.all(promises);

    return {
      restricted: false,
      message: '🔓 **Canal Desbloqueado:** La restricción ha sido removida. El canal ha vuelto a la normalidad y todos pueden escribir.'
    };
  }

  // 2. RESTRINGIR CANAL
  const promises = [channel.permissionOverwrites.edit(everyoneRole, { SendMessages: false })];

  for (const [id, override] of channel.permissionOverwrites.cache) {
    const role = guild.roles.cache.get(id);
    if (role && role.id !== everyoneRole.id && (!targetRole || role.id !== targetRole.id) && !role.managed && !role.permissions.has(PermissionFlagsBits.Administrator)) {
      promises.push(channel.permissionOverwrites.edit(role, { SendMessages: false }).catch(() => null));
    }
  }

  if (targetRole) {
    promises.push(channel.permissionOverwrites.edit(targetRole, { SendMessages: true }).catch(() => null));
  }

  await Promise.all(promises);

  return {
    restricted: true,
    message: targetRole 
      ? `🔒 **Canal Restringido:** Ahora este canal es exclusivo para el rol ${targetRole} (además de Administradores y Bots).`
      : '🔒 **Canal Restringido:** El canal ha sido bloqueado por completo. Solo Administradores y Bots pueden escribir aquí.'
  };
}

module.exports = {
  toggleChannelRestriction,
};
