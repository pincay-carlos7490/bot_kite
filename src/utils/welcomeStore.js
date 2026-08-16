const fs = require('node:fs');
const path = require('node:path');

const dataDir = path.join(__dirname, '..', '..', 'data');
const filePath = path.join(dataDir, 'welcome_config.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(filePath)) {
  fs.writeFileSync(filePath, JSON.stringify({}));
}

function getWelcomeConfigs() {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return {};
  }
}

function getWelcomeConfig(guildId) {
  const configs = getWelcomeConfigs();
  return configs[guildId] || null;
}

function setWelcomeConfig(guildId, config) {
  const configs = getWelcomeConfigs();
  configs[guildId] = {
    ...(configs[guildId] || {}),
    ...config
  };
  fs.writeFileSync(filePath, JSON.stringify(configs, null, 2));
}

module.exports = {
  getWelcomeConfig,
  setWelcomeConfig,
};
