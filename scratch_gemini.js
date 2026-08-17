const { parseModerationIntent } = require('./src/utils/aiModeration');
require('dotenv').config();

async function testNewIntents() {
  const tests = [
    '@kite banea a @usuario por inactividad', // No especifica tiempo -> permanent
    '@kite banea a @usuario permanentemente por molesto',
    '@kite desbanea a este usuario por que si xd',
    '@kite elimina los 5 mensajes anteriores',
    '@kite borra 15 mensajes por favor'
  ];

  console.log('--- PRUEBA DE INTENCIONES (BAN PERMANENTE, UNBAN, CLEAR) ---');
  for (const t of tests) {
    const res = await parseModerationIntent(t);
    console.log(`Orden: "${t}"\n   => JSON Extraído:`, res, '\n');
  }
}

testNewIntents();
