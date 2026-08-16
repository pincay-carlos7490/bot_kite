const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const WelcomeConfig = require('../database/models/WelcomeConfig');

const dataDir = path.join(__dirname, '..', '..', 'data');
const filePath = path.join(dataDir, 'welcome_config.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(filePath)) {
  fs.writeFileSync(filePath, JSON.stringify({}));
}

function getLocalWelcomeConfigs() {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return {};
  }
}

async function getWelcomeConfigAsync(guildId) {
  if (mongoose.connection.readyState === 1) {
    try {
      const doc = await WelcomeConfig.findOne({ guildId });
      if (doc) return doc.toObject();
    } catch (err) {
      console.error('Error obteniendo bienvenida desde MongoDB:', err);
    }
  }
  const configs = getLocalWelcomeConfigs();
  return configs[guildId] || null;
}

function getWelcomeConfig(guildId) {
  // Para llamadas síncronas o de fallback
  const configs = getLocalWelcomeConfigs();
  return configs[guildId] || null;
}

async function setWelcomeConfig(guildId, config) {
  // 1. Guardar en local JSON como respaldo
  const configs = getLocalWelcomeConfigs();
  configs[guildId] = {
    ...(configs[guildId] || {}),
    ...config
  };
  fs.writeFileSync(filePath, JSON.stringify(configs, null, 2));

  // 2. Guardar en MongoDB si la conexión está activa
  if (mongoose.connection.readyState === 1) {
    try {
      await WelcomeConfig.findOneAndUpdate(
        { guildId },
        { $set: config },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error('Error guardando bienvenida en MongoDB:', err);
    }
  }
}

module.exports = {
  getWelcomeConfig,
  getWelcomeConfigAsync,
  setWelcomeConfig,
};
