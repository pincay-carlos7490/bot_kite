const fs = require('node:fs');
const path = require('node:path');

const dataDir = path.join(__dirname, '..', '..', 'data');
const filePath = path.join(dataDir, 'tempbans.json');

// Asegurar que exista la carpeta data
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Asegurar que exista el archivo tempbans.json
if (!fs.existsSync(filePath)) {
  fs.writeFileSync(filePath, JSON.stringify([]));
}

function getTempBans() {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error al leer tempbans.json:', error);
    return [];
  }
}

function saveTempBans(tempbans) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(tempbans, null, 2));
  } catch (error) {
    console.error('Error al guardar tempbans.json:', error);
  }
}

function addTempBan(guildId, userId, unbanTimestamp, reason) {
  const tempbans = getTempBans();
  // Filtrar si ya existía un ban previo del mismo usuario en el mismo server
  const filtered = tempbans.filter(b => !(b.guildId === guildId && b.userId === userId));
  filtered.push({ guildId, userId, unbanTimestamp, reason });
  saveTempBans(filtered);
}

function removeTempBan(guildId, userId) {
  const tempbans = getTempBans();
  const filtered = tempbans.filter(b => !(b.guildId === guildId && b.userId === userId));
  saveTempBans(filtered);
}

function initTempBanChecker(client) {
  const checkBans = async () => {
    const tempbans = getTempBans();
    const now = Date.now();

    for (const ban of tempbans) {
      if (now >= ban.unbanTimestamp) {
        try {
          const guild = await client.guilds.fetch(ban.guildId).catch(() => null);
          if (guild) {
            await guild.members.unban(ban.userId, 'Sanción temporal finalizada automáticamente.');
            console.log(`✅ Unban automático completado para el usuario ${ban.userId} en el servidor ${guild.name}`);
          }
        } catch (error) {
          console.error(`❌ Error al desbanear automáticamente a ${ban.userId}:`, error);
        } finally {
          removeTempBan(ban.guildId, ban.userId);
        }
      }
    }
  };

  // Revisa cada 30 segundos si hay algún desban pendiente
  setInterval(checkBans, 30000);
  checkBans(); // Ejecuta una revisión inicial al encender
}

// Función auxiliar para convertir cadenas como "30m", "2h", "1d" a milisegundos
function parseDuration(durationStr) {
  if (!durationStr) return null;
  const regex = /^(\d+)\s*([smhd])$/i;
  const match = durationStr.trim().match(regex);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

module.exports = {
  addTempBan,
  removeTempBan,
  initTempBanChecker,
  parseDuration,
};
