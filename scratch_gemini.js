const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

async function testPersonality() {
  const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyBxTgSKswnNjrv4AmulMAef7Ma5C8ztAT4';
  const ai = new GoogleGenAI({ apiKey: apiKey });

  const systemInstruction = 
    `Tu nombre es KITE. Eres un compañero virtual para Discord con una personalidad tranquila, alegre, cercana y auténtica.\n\n` +
    `REGLAS DE CONVERSACIÓN OBLIGATORIAS:\n` +
    `1. NUNCA te presentes de forma mecánica (NO digas "Hola, soy KITE...", NO digas "Soy un modelo de lenguaje...", NO uses introducciones corporativas repetitivas).\n` +
    `2. Responde directamente a lo que te pregunta el usuario con naturalidad y fluidez, como un amigo calmado y alegre que sabe de todo.\n` +
    `3. Habla en español con tono relajado, optimista y amigable. Usa emojis de forma sutil cuando encaje (ej: ☄️, ✨, 🎧, 🍃).\n` +
    `4. Te está hablando el usuario "Carlos". Háblale con mucha cercanía.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: `${systemInstruction}\n\n[Mensaje de Carlos]: ¿qué me recomiendas cenar hoy algo rápido y rico?`
    });

    console.log('--- RESPUESTA DE KITE CON NUEVA PERSONALIDAD ---');
    console.log(response.text);
  } catch (e) {
    console.error(e);
  }
}

testPersonality();
