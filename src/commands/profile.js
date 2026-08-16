const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Muestra la información de perfil de un usuario en el servidor')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Usuario del cual deseas ver el perfil (Opcional, por defecto tú)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('usuario') || interaction.user;
    
    try {
      const member = await interaction.guild.members.fetch(targetUser.id);
      const bannerUrl = 'https://i.pinimg.com/736x/d5/2b/f0/d52bf04f6eec82a1cb4ba3a7e9026914.jpg';

      const joinedServerUnix = Math.floor(member.joinedTimestamp / 1000);
      const createdAccountUnix = Math.floor(targetUser.createdTimestamp / 1000);

      const embed = new EmbedBuilder()
        .setColor('#FEE75C') // Borde amarillo
        .setAuthor({ 
          name: `Perfil de ${member.displayName}`, 
          iconURL: member.displayAvatarURL({ dynamic: true }) 
        })
        .setTitle(`✨ Perfil de ${targetUser.username}`)
        .setThumbnail(member.displayAvatarURL({ dynamic: true, size: 512 }))
        .addFields(
          { 
            name: '👤 Nombre en el servidor', 
            value: `**${member.displayName}** (\`@${targetUser.username}\`)`, 
            inline: false 
          },
          { 
            name: '📥 Se unió al servidor', 
            value: `<t:${joinedServerUnix}:F>\n*(<t:${joinedServerUnix}:R>)*`, 
            inline: true 
          },
          { 
            name: '⌛ Antigüedad en Discord', 
            value: `<t:${createdAccountUnix}:F>\n*(<t:${createdAccountUnix}:R>)*`, 
            inline: true 
          }
        )
        .setImage(bannerUrl)
        .setFooter({ text: `ID de usuario: ${targetUser.id}` });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error en comando /profile:', error);
      await interaction.reply({
        content: '❌ No se pudo obtener la información de ese usuario.',
        ephemeral: true
      });
    }
  },
};
