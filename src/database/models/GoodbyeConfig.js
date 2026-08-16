const mongoose = require('mongoose');

const goodbyeSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: true },
  channelId: { type: String, required: true },
  message: { type: String, default: null },
  backgroundUrl: { type: String, default: null }
});

module.exports = mongoose.model('GoodbyeConfig', goodbyeSchema);
