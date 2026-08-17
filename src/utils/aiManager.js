const { GoogleGenerativeAI } = require('@google/generative-ai');

async function askAI(prompt, username = 'Usuario') {
  const apiKey = process.env.GEMINI_API_KEY;

  // 1. Si existe clave API oficial de Google Gemini
  if (apiKey && apiKey !== 'tu_gemini_api_key_aqui') {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        systemInstruction: `Eres KITE, un asistente de IA inteligente, amigable, divertido y servicial para Discord. Tu objetivo es ayudar a los miembros con sus preguntas, programar, dar consejos o conversar de forma natural en español. Mantén un tono entusiasta y usa emojis con moderación. El usuario que te habla se llama ${username}.`
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (err) {
      console.error('Error con Google Gemini API, usando motor de respaldo:', err.message);
    }
  }

  // 2. Motor de IA de respaldo gratuito (Pollinations / Free AI) si no hay clave API configurada aún
  try {
    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
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
