const { Events } = require('discord.js');
const GuildConfig = require('../database/models/GuildConfig');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    if (member.user.bot) return;

    try {
      const config = await GuildConfig.findOne({ guildId: member.guild.id });
      if (config && config.autoRoleId) {
        const role = member.guild.roles.cache.get(config.autoRoleId);
        if (role) {
          await member.roles.add(role, 'Autorol de bienvenida asignado automáticamente por KITE');
          console.log(`✅ Autorol ${role.name} asignado automáticamente a ${member.user.tag}`);
        }
      }
    } catch (err) {
      console.error('Error al asignar autorol en guildMemberAdd:', err);
    }
  },
};
