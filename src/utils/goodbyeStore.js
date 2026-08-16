const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const GoodbyeConfig = require('../database/models/GoodbyeConfig');

const dataDir = path.join(__dirname, '..', '..', 'data');
const filePath = path.join(dataDir, 'goodbye_config.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(filePath)) {
  fs.writeFileSync(filePath, JSON.stringify({}));
}

function getLocalGoodbyeConfigs() {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return {};
  }
}

async function getGoodbyeConfigAsync(guildId) {
  if (mongoose.connection.readyState === 1) {
    try {
      const doc = await GoodbyeConfig.findOne({ guildId });
      if (doc) return doc.toObject();
    } catch (err) {
      console.error('Error obteniendo despedida desde MongoDB:', err);
    }
  }
  const configs = getLocalGoodbyeConfigs();
  return configs[guildId] || null;
}

function getGoodbyeConfig(guildId) {
  const configs = getLocalGoodbyeConfigs();
  return configs[guildId] || null;
}

async function setGoodbyeConfig(guildId, config) {
  // 1. Guardar en local JSON como respaldo
  const configs = getLocalGoodbyeConfigs();
  configs[guildId] = {
    ...(configs[guildId] || {}),
    ...config
  };
  fs.writeFileSync(filePath, JSON.stringify(configs, null, 2));

  // 2. Guardar en MongoDB si la conexión está activa
  if (mongoose.connection.readyState === 1) {
    try {
      await GoodbyeConfig.findOneAndUpdate(
        { guildId },
        { $set: config },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error('Error guardando despedida en MongoDB:', err);
    }
  }
}

module.exports = {
  getGoodbyeConfig,
  getGoodbyeConfigAsync,
  setGoodbyeConfig,
};
