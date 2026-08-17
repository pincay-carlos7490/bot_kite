const { isInsultOrToxic, parseModerationIntent } = require('./src/utils/aiModeration');
require('dotenv').config();

async function testModeration() {
  const testTexts = [
    'Hola bro qué tal cómo estás hoy?',
    'You are a f***ing idiot get out',
    'Eres un pedazo de estúpido e inútil',
    'jajajaja xd que divertido ese juego',
    'Baka idiot shut up'
  ];

  console.log('--- PRUEBA 1: FILTRO DE INSULTOS MULTILINGÜE ---');
  for (const text of testTexts) {
    const isToxic = await isInsultOrToxic(text);
    console.log(`Texto: "${text}" => 🚫 ¿Insulto?: ${isToxic}`);
  }

  console.log('\n--- PRUEBA 2: ORDEN DE MODERACIÓN EN LENGUAJE NATURAL ---');
  const modOrder = 'banea a este usuario por 5 horas, razon es molesto';
  const parsed = await parseModerationIntent(modOrder);
  console.log(`Orden: "${modOrder}" => Intent:`, parsed);
}

testModeration();
