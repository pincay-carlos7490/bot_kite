const { GoogleGenAI } = require('@google/genai');

async function askAI(prompt, username = 'Usuario') {
  const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyBxTgSKswnNjrv4AmulMAef7Ma5C8ztAT4';

  // 1. Usar el SDK oficial de Google GenAI con el modelo oficial activo gemini-2.5-flash-lite
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const systemInstruction = `Eres KITE, un asistente de IA inteligente, amigable, divertido y servicial para Discord. Tu objetivo es ayudar a los miembros con sus preguntas, programar, dar consejos o conversar de forma natural en español. Mantén un tono entusiasta y usa emojis con moderación. El usuario que te habla se llama ${username}.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: `${systemInstruction}\n\nPregunta de ${username}: ${prompt}`
      });

      if (response && response.text) {
        return response.text;
      }
    } catch (err) {
      console.error('Error con Google Gemini API, intentando motor de respaldo:', err.message);
    }
  }

  // 2. Motor de IA de respaldo usando fetch nativo de Node.js (Sin librerías externas)
  try {
    const systemPrompt = encodeURIComponent(`Eres KITE, un asistente virtual de IA amigable y divertido en Discord. Responde en español de forma útil y entusiasta a ${username}.`);
    const userPrompt = encodeURIComponent(prompt);
    
    const res = await fetch(`https://text.pollinations.ai/${userPrompt}?system=${systemPrompt}`);
    if (res.ok) {
      const text = await res.text();
      if (text && text.length > 0) return text;
    }
  } catch (err) {
    console.error('Error en motor de IA de respaldo:', err.message);
  }

  return '🤖 ¡Hola! Soy la IA de KITE. En este momento estoy procesando muchas solicitudes. Por favor, intenta hacerme tu pregunta de nuevo en un instante.';
}

module.exports = {
  askAI,
};
