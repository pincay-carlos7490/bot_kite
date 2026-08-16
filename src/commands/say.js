const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Envía un mensaje con texto normal fuera del embed y/o dentro de la tarjeta Embed')
    .addStringOption(option =>
      option.setName('mensaje_normal')
        .setDescription('Texto fuera del Embed (soporta # Letras grandes, emojis, *cursiva*, > citas)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('titulo_embed')
        .setDescription('Título dentro de la tarjeta Embed (soporta emojis y letras grandes)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('mensaje_embed')
        .setDescription('Texto del Embed (soporta # Letras grandes, emojis, *cursiva*, __subrayado__, > citas)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('firma')
        .setDescription('Firma o texto al pie de la tarjeta Embed (Opcional, ej: Soporte de GermanClan)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('icono_firma')
        .setDescription('URL del icono pequeño para la firma (Opcional)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('color')
        .setDescription('Selecciona un color para el borde de la tarjeta Embed')
        .setRequired(false)
        .addChoices(
          { name: '🔵 Azul Discord', value: '#5865F2' },
          { name: '🔴 Rojo', value: '#ED4245' },
          { name: '🟢 Verde', value: '#57F287' },
          { name: '🟡 Amarillo', value: '#FEE75C' },
          { name: '🟣 Morado', value: '#9B59B6' },
          { name: '💖 Rosado', value: '#EB459E' },
          { name: '🟧 Naranja', value: '#E67E22' },
          { name: '🖤 Negro', value: '#202225' },
          { name: '⚪ Blanco', value: '#FFFFFF' }
        )
    )
    .addChannelOption(option =>
      option.setName('canal')
        .setDescription('Canal donde enviar el anuncio (Opcional, por defecto este canal)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false)
    )
    .addRoleOption(option =>
      option.setName('mencionar_rol')
        .setDescription('Rol a mencionar arriba de todo el mensaje (Opcional)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('imagen')
        .setDescription('URL de una imagen o banner para añadir al Embed (Opcional)')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('mostrar_hora')
        .setDescription('¿Mostrar fecha y hora al final del Embed? (Por defecto: No)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const rawMensajeNormal = interaction.options.getString('mensaje_normal');
    const mensajeNormal = rawMensajeNormal ? rawMensajeNormal.replace(/\\n/g, '\n') : null;

    const tituloEmbed = interaction.options.getString('titulo_embed');

    const rawMensajeEmbed = interaction.options.getString('mensaje_embed');
    const mensajeEmbed = rawMensajeEmbed ? rawMensajeEmbed.replace(/\\n/g, '\n') : null;

    const firma = interaction.options.getString('firma');
    const iconoFirma = interaction.options.getString('icono_firma');
    const showTimestamp = interaction.options.getBoolean('mostrar_hora') || false;

    const targetChannel = interaction.options.getChannel('canal') || interaction.channel;
    const roleMention = interaction.options.getRole('mencionar_rol');
    const colorHex = interaction.options.getString('color') || '#5865F2';
    const imageUrl = interaction.options.getString('imagen');

    if (!mensajeNormal && !mensajeEmbed && !tituloEmbed) {
      return await interaction.reply({
        content: '❌ Debes escribir al menos `mensaje_normal`, `titulo_embed` o `mensaje_embed`.',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      let contentText = '';
      if (roleMention) {
        contentText += `${roleMention} `;
      }
      if (mensajeNormal) {
        contentText += mensajeNormal;
      }

      const embeds = [];
      if (tituloEmbed || mensajeEmbed || firma) {
        const embed = new EmbedBuilder()
          .setColor(colorHex);

        if (tituloEmbed) embed.setTitle(tituloEmbed);
        if (mensajeEmbed) embed.setDescription(mensajeEmbed);

        if (firma) {
          embed.setFooter({
            text: firma,
            iconURL: iconoFirma || undefined
          });
        }

        if (showTimestamp) {
          embed.setTimestamp();
        }

        if (imageUrl) {
          try {
            embed.setImage(imageUrl);
          } catch (err) {
            console.error('URL de imagen no válida:', err);
          }
        }

        embeds.push(embed);
      }

      await targetChannel.send({
        content: contentText ? contentText : null,
        embeds: embeds.length > 0 ? embeds : []
      });

      await interaction.editReply({
        content: `✅ Mensaje publicado con éxito en ${targetChannel}.`
      });
    } catch (error) {
      console.error('Error al ejecutar /say:', error);
      await interaction.editReply({
        content: '❌ No se pudo publicar el mensaje. Revisa los permisos del bot en el canal especificado.'
      });
    }
  },
};
