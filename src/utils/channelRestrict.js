const { PermissionFlagsBits } = require('discord.js');

async function toggleChannelRestriction(channel, guild, targetRole = null, forceUnlock = false) {
  const everyoneRole = guild.roles.everyone;
  const currentEveryoneOverride = channel.permissionOverwrites.cache.get(everyoneRole.id);
  const isCurrentlyLocked = currentEveryoneOverride && currentEveryoneOverride.deny.has(PermissionFlagsBits.SendMessages);

  // Si se pide forzar el desbloqueo o si el canal ya está bloqueado y no se forzó un nuevo rol -> Desbloquear
  if (forceUnlock || (isCurrentlyLocked && !targetRole)) {
    await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: null });
    if (targetRole) {
      await channel.permissionOverwrites.edit(targetRole, { SendMessages: null });
    }
    return {
      restricted: false,
      message: '🔓 **Canal Desbloqueado:** El canal ha vuelto a la normalidad y todos los miembros pueden escribir.'
    };
  }

  // Restringir canal
  if (targetRole) {
    // Exclusivo para un rol específico (más Admins/Mods/Bot)
    await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: false });
    await channel.permissionOverwrites.edit(targetRole, { SendMessages: true });
    return {
      restricted: true,
      message: `🔒 **Canal Restringido:** Ahora este canal es exclusivo para el rol ${targetRole} (además de Administradores y Moderadores).`
    };
  } else {
    // Bloquear para todos los miembros normales
    await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: false });
    return {
      restricted: true,
      message: '🔒 **Canal Restringido:** El canal ha sido bloqueado. Solo Administradores, Moderadores y Bots pueden escribir aquí.'
    };
  }
}

module.exports = {
  toggleChannelRestriction,
};
