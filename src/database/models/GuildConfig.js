const mongoose = require('mongoose');

const guildConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  autoRoleId: { type: String, default: null },
  autoRoleName: { type: String, default: null },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GuildConfig', guildConfigSchema);
