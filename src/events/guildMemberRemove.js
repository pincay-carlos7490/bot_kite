const { Events } = require('discord.js');
const { getGoodbyeConfigAsync } = require('../utils/goodbyeStore');
const { generateGoodbyeImage } = require('../utils/goodbyeCanvas');

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member) {
    const config = await getGoodbyeConfigAsync(member.guild.id);
    if (!config || !config.enabled || !config.channelId) return;

    const channel = member.guild.channels.cache.get(config.channelId);
    if (!channel) return;

    try {
      // 1. Generar la imagen de despedida con avatar redondo y miembros restantes
      const attachment = await generateGoodbyeImage(member, config.backgroundUrl);

      // 2. Reemplazar variables dinámicas en el mensaje
      let textContent = config.message || '👋 **{username}** ha dejado el servidor **{servidor}**.';
      textContent = textContent
        .replace(/{usuario}/g, `${member.user}`)
        .replace(/{username}/g, member.user.username)
        .replace(/{servidor}/g, member.guild.name)
        .replace(/{miembros}/g, member.guild.memberCount)
        .replace(/\\n/g, '\n');

      // 3. Enviar mensaje al canal configurado
      await channel.send({
        content: textContent,
        files: [attachment]
      });
    } catch (error) {
      console.error(`Error al enviar mensaje de despedida en ${member.guild.name}:`, error);
    }
  },
};
