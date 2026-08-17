const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hola')
    .setDescription('Responde con un saludo cordial')
    .setIntegrationTypes(0, 1)
    .setContexts(0, 1, 2),
  
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('👋 ¡Hola!')
      .setDescription(`¡Saludos ${interaction.user}! Bienvenido al servidor. Tu bot de Discord en **discord.js v14** está funcionando perfectamente. 🎉`)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
