const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Responde con la latencia del bot'),
  
  async execute(interaction) {
    const sent = await interaction.reply({ content: 'Calculando latencia...', fetchReply: true, ephemeral: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiPing = Math.round(interaction.client.ws.ping);

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🏓 ¡Pong!')
      .addFields(
        { name: '⚡ Latencia Mensaje', value: `${latency}ms`, inline: true },
        { name: '🌐 Latencia API Discord', value: `${apiPing}ms`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ content: null, embeds: [embed] });
  },
};
