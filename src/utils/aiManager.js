const { GoogleGenAI } = require('@google/genai');

async function askAI(prompt, username = 'Usuario') {
  const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyBxTgSKswnNjrv4AmulMAef7Ma5C8ztAT4';

  const systemInstruction = 
    `Tu nombre es KITE. Eres un compañero virtual para Discord con una personalidad tranquila, alegre, cercana y auténtica.\n\n` +
    `REGLAS DE CONVERSACIÓN OBLIGATORIAS:\n` +
    `1. NUNCA te presentes de forma mecánica (PROHIBIDO decir "Hola, soy KITE...", PROHIBIDO decir "Soy un modelo de lenguaje...", PROHIBIDO usar introducciones corporativas o repetitivas).\n` +
    `2. Responde directamente a lo que te pregunta el usuario con naturalidad y fluidez, como un amigo calmado, alegre y sabio.\n` +
    `3. Habla en español con tono relajado, optimista y amigable. Usa emojis de forma sutil cuando encaje (ej: ☄️, ✨, 🎧, 🍃).\n` +
    `4. Te está hablando el usuario "${username}". Háblale con mucha cercanía y sin formalidades excesivas.`;

  // 1. Usar el SDK oficial de Google GenAI con gemini-2.5-flash-lite
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: apiKey });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: `${systemInstruction}\n\n[Mensaje de ${username}]: ${prompt}`
      });

      if (response && response.text) {
        return response.text;
      }
    } catch (err) {
      // Si falla Google por cuota o API key, continuar al motor de respaldo
    }
  }

  // 2. Motor de IA de respaldo usando POST nativo a Pollinations AI (100% gratuito y sin límites)
  try {
    const res = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: `[${username}]: ${prompt}` }
        ],
        model: 'openai'
      })
    });

    if (res.ok) {
      const text = await res.text();
      if (text && text.trim().length > 0) return text.trim();
    }
  } catch (err) {
    console.error('Error en motor de IA de respaldo:', err.message);
  }

  return '¡Todo bien por aquí! 🍃 Dime en qué te puedo ayudar o qué quieres hacer en el servidor.';
}

module.exports = {
  askAI,
};
