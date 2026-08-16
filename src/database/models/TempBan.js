const mongoose = require('mongoose');

const tempBanSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  unbanTimestamp: { type: Number, required: true },
  reason: { type: String, default: 'Sin razón especificada' }
});

module.exports = mongoose.model('TempBan', tempBanSchema);
