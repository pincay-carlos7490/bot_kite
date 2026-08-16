const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hola')
    .setDescription('Te saluda amablemente el bot'),
  
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
