const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { initTempBanChecker } = require('./utils/tempbans');
const http = require('node:http');
require('dotenv').config();

// Servidor HTTP web para compatibilidad con hosting gratuito 24/7 (Render Web Service)
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('🤖 Bot KITE en línea 24/7');
}).listen(port, () => {
  console.log(`🌐 Servidor Web activo en puerto ${port}`);
});

// Inicializar el cliente del bot con los Intents necesarios
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ]
});

client.commands = new Collection();

// Cargador dinámico de Comandos
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.log(`[ADVERTENCIA] El comando en ${filePath} requiere "data" y "execute".`);
  }
}

// Cargador dinámico de Eventos
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

// Iniciar sesión en Discord
if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN === 'tu_token_aqui') {
  console.error('❌ ERROR: Debes configurar tu DISCORD_TOKEN en el archivo .env');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
