const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

async function deployCommands(token = process.env.DISCORD_TOKEN, clientId = process.env.CLIENT_ID) {
  if (!token || !clientId) return;

  const commands = [];
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
    }
  }

  const rest = new REST().setToken(token);

  try {
    console.log(`🔄 Registrando ${commands.length} comandos slash en la API de Discord...`);
    const data = await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands },
    );
    console.log(`✅ ¡Se registraron ${data.length} comandos de barra (/) en la API de Discord!`);
  } catch (error) {
    console.error('❌ Error al registrar comandos REST:', error.message);
  }
}

if (require.main === module) {
  deployCommands();
}

module.exports = { deployCommands };
