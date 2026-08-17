const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

async function testWorkingModels() {
  const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyBxTgSKswnNjrv4AmulMAef7Ma5C8ztAT4';
  const ai = new GoogleGenAI({ apiKey: apiKey });

  const models = ['gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-pro-latest'];

  for (const m of models) {
    try {
      console.log(`Probando: ${m}...`);
      const response = await ai.models.generateContent({
        model: m,
        contents: 'Hola KITE, preséntate brevemente'
      });
      console.log(`🎉 ¡ÉXITO ROTUNDO CON ${m}! =>`, response.text);
      break;
    } catch (e) {
      console.log(`❌ ${m}:`, e.message);
    }
  }
}

testWorkingModels();
