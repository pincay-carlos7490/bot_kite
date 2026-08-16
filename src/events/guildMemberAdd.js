const { Events } = require('discord.js');
const { getWelcomeConfig } = require('../utils/welcomeStore');
const { generateWelcomeImage } = require('../utils/welcomeCanvas');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    const config = getWelcomeConfig(member.guild.id);
    if (!config || !config.enabled || !config.channelId) return;

    const channel = member.guild.channels.cache.get(config.channelId);
    if (!channel) return;

    try {
      // 1. Generar la imagen con foto de perfil redonda y contador de miembros
      const attachment = await generateWelcomeImage(member, config.backgroundUrl);

      // 2. Reemplazar variables dinámicas en el mensaje
      let textContent = config.message || '¡Bienvenido, {usuario}, a **{servidor}**!';
      textContent = textContent
        .replace(/{usuario}/g, `${member.user}`)
        .replace(/{username}/g, member.user.username)
        .replace(/{servidor}/g, member.guild.name)
        .replace(/{miembros}/g, member.guild.memberCount)
        .replace(/\\n/g, '\n');

      // 3. Enviar al canal configurado
      await channel.send({
        content: textContent,
        files: [attachment]
      });
    } catch (error) {
      console.error(`Error al enviar mensaje de bienvenida en ${member.guild.name}:`, error);
    }
  },
};
