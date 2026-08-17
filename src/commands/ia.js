const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { askAI } = require('../utils/aiManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ia')
    .setDescription('Pregunta o conversa con la Inteligencia Artificial de KITE Bot')
    .setIntegrationTypes(0, 1)
    .setContexts(0, 1, 2)
    .addStringOption(option =>
      option.setName('pregunta')
        .setDescription('Tu pregunta, consulta, código o tema para la IA')
        .setRequired(true)
    ),

  async execute(interaction) {
    const question = interaction.options.getString('pregunta');
    await interaction.deferReply();

    try {
      const aiResponse = await askAI(question, interaction.user.username);

      // Si la respuesta es corta, enviarla directamente; si es larga, usar Embed
      if (aiResponse.length <= 2000) {
        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setAuthor({ 
            name: `KITE IA • Consulta de ${interaction.user.username}`, 
            iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
          })
          .setTitle(`❓ ${question.length > 256 ? question.substring(0, 253) + '...' : question}`)
          .setDescription(aiResponse)
          .setFooter({ text: 'Desarrollado con Inteligencia Artificial • KITE Bot' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } else {
        // Cortar la respuesta en bloques de 2000 caracteres si es extremadamente larga
        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setAuthor({ 
            name: `KITE IA • Consulta de ${interaction.user.username}`, 
            iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
          })
          .setTitle(`❓ ${question.length > 256 ? question.substring(0, 253) + '...' : question}`)
          .setDescription(aiResponse.substring(0, 4096))
          .setFooter({ text: 'Desarrollado con Inteligencia Artificial • KITE Bot' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      }

    } catch (error) {
      console.error('Error en /ia:', error);
      await interaction.editReply({
        content: '❌ Ocurrió un error al procesar tu consulta con la Inteligencia Artificial.'
      });
    }
  },
};
