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
      console.error('Error con Google Gemini API, intentando motor de respaldo:', err.message);
    }
  }

  // 2. Motor de IA de respaldo usando fetch nativo de Node.js
  try {
    const systemPrompt = encodeURIComponent(systemInstruction);
    const userPrompt = encodeURIComponent(prompt);
    
    const res = await fetch(`https://text.pollinations.ai/${userPrompt}?system=${systemPrompt}`);
    if (res.ok) {
      const text = await res.text();
      if (text && text.length > 0) return text;
    }
  } catch (err) {
    console.error('Error en motor de IA de respaldo:', err.message);
  }

  return 'Tranqui, dame un segundito que se cruzaron los cables. Vuelve a preguntarme en un instante ✨';
}

module.exports = {
  askAI,
};
