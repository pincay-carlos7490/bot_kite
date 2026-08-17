const { GoogleGenAI } = require('@google/genai');

async function isInsultOrToxic(text) {
  if (!text || text.trim().length < 2) return false;

  const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyBxTgSKswnNjrv4AmulMAef7Ma5C8ztAT4';

  if (!apiKey) return false;

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey });

    const prompt = 
      `Analiza el siguiente texto de un chat de Discord y determina si contiene un insulto directo, grosería, mala palabra, xenofobia, insulto racista, homófobo o toxicidad grave en CUALQUIER IDIOMA (español, inglés, portugués, ruso, japonés, jerga urbana, etc.).\n\n` +
      `Responde ÚNICAMENTE con una sola palabra: "INSULTO" si contiene groserías/insultos, o "LIMPIO" si es un mensaje normal de conversación.\n\n` +
      `Texto: "${text.replace(/"/g, '')}"`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt
    });

    if (response && response.text) {
      const result = response.text.trim().toUpperCase();
      return result.includes('INSULTO');
    }
  } catch (err) {
    console.error('Error en moderación por IA:', err.message);
  }

  return false;
}

async function parseModerationIntent(text, mentionedUsers) {
  const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyBxTgSKswnNjrv4AmulMAef7Ma5C8ztAT4';
  if (!apiKey) return null;

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey });

    const prompt = 
      `Analiza la orden de moderación en lenguaje natural y extrae la intención en formato JSON estricto.\n` +
      `Si la orden pide banear a un usuario, responde ÚNICAMENTE con un JSON con los siguientes campos:\n` +
      `{"action": "ban", "duration": "5h", "reason": "razon encontrada"}\n\n` +
      `Duración debe convertirse a formato de tiempo de Discord si aplica (ejemplos: "5 horas" -> "5h", "30 minutos" -> "30m", "1 dia" -> "1d", "permanente" -> "permanent"). Si no se especifica tiempo, usa "permanent".\n` +
      `Si no hay razón explícita, usa "Sanción aplicada por moderación de IA".\n\n` +
      `Orden: "${text.replace(/"/g, '')}"`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt
    });

    if (response && response.text) {
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (err) {
    console.error('Error parseando orden de moderación con IA:', err.message);
  }

  return null;
}

module.exports = {
  isInsultOrToxic,
  parseModerationIntent,
};
