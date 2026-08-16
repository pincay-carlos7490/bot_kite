const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const TempBan = require('../database/models/TempBan');

const dataDir = path.join(__dirname, '..', '..', 'data');
const filePath = path.join(dataDir, 'tempbans.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(filePath)) {
  fs.writeFileSync(filePath, JSON.stringify([]));
}

function getLocalTempBans() {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function saveLocalTempBans(tempbans) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(tempbans, null, 2));
  } catch (error) {
    console.error('Error guardando tempbans locales:', error);
  }
}

async function addTempBan(guildId, userId, unbanTimestamp, reason) {
  // Guardar en archivo local
  const tempbans = getLocalTempBans();
  const filtered = tempbans.filter(b => !(b.guildId === guildId && b.userId === userId));
  filtered.push({ guildId, userId, unbanTimestamp, reason });
  saveLocalTempBans(filtered);

  // Guardar en MongoDB si está disponible
  if (mongoose.connection.readyState === 1) {
    try {
      await TempBan.deleteMany({ guildId, userId });
      await TempBan.create({ guildId, userId, unbanTimestamp, reason });
    } catch (err) {
      console.error('Error guardando TempBan en MongoDB:', err);
    }
  }
}

async function removeTempBan(guildId, userId) {
  // Remover de archivo local
  const tempbans = getLocalTempBans();
  const filtered = tempbans.filter(b => !(b.guildId === guildId && b.userId === userId));
  saveLocalTempBans(filtered);

  // Remover de MongoDB si está disponible
  if (mongoose.connection.readyState === 1) {
    try {
      await TempBan.deleteMany({ guildId, userId });
    } catch (err) {
      console.error('Error borrando TempBan en MongoDB:', err);
    }
  }
}

function initTempBanChecker(client) {
  const checkBans = async () => {
    let tempbans = [];

    // Obtener desde MongoDB si está activo, de lo contrario del archivo local
    if (mongoose.connection.readyState === 1) {
      try {
        tempbans = await TempBan.find({});
      } catch (err) {
        tempbans = getLocalTempBans();
      }
    } else {
      tempbans = getLocalTempBans();
    }

    const now = Date.now();

    for (const ban of tempbans) {
      if (now >= ban.unbanTimestamp) {
        try {
          const guild = await client.guilds.fetch(ban.guildId).catch(() => null);
          if (guild) {
            await guild.members.unban(ban.userId, 'Sanción temporal finalizada automáticamente.');
            console.log(`✅ Unban automático completado para el usuario ${ban.userId} en ${guild.name}`);
          }
        } catch (error) {
          console.error(`❌ Error al desbanear a ${ban.userId}:`, error);
        } finally {
          await removeTempBan(ban.guildId, ban.userId);
        }
      }
    }
  };

  setInterval(checkBans, 30000);
  checkBans();
}

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
