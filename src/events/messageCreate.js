const { Events } = require('discord.js');
const { askAI } = require('../utils/aiManager');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    // Ignorar mensajes de otros bots
    if (message.author.bot) return;

    // Verificar si el bot fue mencionado directamente (@KITE)
    if (message.mentions.has(message.client.user) && !message.mentions.everyone) {
      // Limpiar la mención del texto
      const cleanPrompt = message.content.replace(/<@!?\d+>/g, '').trim();

      if (!cleanPrompt) {
        return message.reply('🤖 ¡Hola! ¿En qué te puedo ayudar hoy? Usa `/ia [pregunta]` o mencióname con tu duda.');
      }

      await message.channel.sendTyping();

      try {
        const aiResponse = await askAI(cleanPrompt, message.author.username);
        await message.reply(aiResponse);
      } catch (error) {
        console.error('Error respondiendo mención de IA:', error);
      }
    }
  },
};
