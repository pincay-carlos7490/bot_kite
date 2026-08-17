const { PermissionFlagsBits } = require('discord.js');

function findRoleInGuild(text, guild, messageMentions = null) {
  // 1. Si hay una mención explícita a un rol (@Rol)
  const mentionedRole = messageMentions?.roles?.first();
  if (mentionedRole) return { status: 'found', role: mentionedRole };

  const lowerText = text.toLowerCase();
  const roles = guild.roles.cache.filter(r => r.id !== guild.roles.everyone.id && !r.managed);

  // 2. Buscar si algún nombre de rol existente en el servidor coincide (sin importar mayúsculas, minúsculas, plurale o singulares)
  for (const [id, role] of roles) {
    const roleName = role.name.toLowerCase();
    const singularName = roleName.endsWith('s') ? roleName.slice(0, -1) : roleName;
    const pluralName = roleName.endsWith('s') ? roleName : roleName + 's';

    const genericNames = ['administrador', 'administradores', 'admin', 'admins', 'bot', 'bots'];
    if (genericNames.includes(roleName)) continue;

    if (lowerText.includes(roleName) || (singularName.length > 2 && lowerText.includes(singularName)) || lowerText.includes(pluralName)) {
      return { status: 'found', role: role };
    }
  }

  // 3. Comprobar si el usuario intentó nombrar un rol específico que NO existe en el servidor
  const keywords = ['rol', 'para los', 'solo para', 'para el', 'solo los', 'solo los que tengan el rol', 'rol de'];
  for (const kw of keywords) {
    if (lowerText.includes(kw)) {
      const parts = lowerText.split(kw);
      if (parts.length > 1) {
        const afterKw = parts[1].trim().split(/\s+/)[0];
        const commonIgnored = ['que', 'los', 'el', 'un', 'una', 'este', 'chat', 'canal', 'administradores', 'moderadores', 'bots', 'puedan', 'escribir'];
        if (afterKw && !commonIgnored.includes(afterKw)) {
          return { status: 'not_found', requestedRoleName: afterKw };
        }
      }
    }
  }

  return { status: 'no_role', role: null };
}

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
      ? `🔒 **Canal Restringido:** Ahora este canal es exclusivo para el rol **${targetRole.name}** (${targetRole}) (además de Administradores y Bots). Ningún otro rol puede escribir.`
      : '🔒 **Canal Restringido:** El canal ha sido bloqueado por completo. Solo Administradores, Moderadores y Bots pueden escribir aquí.'
  };
}

module.exports = {
  toggleChannelRestriction,
  findRoleInGuild,
};
