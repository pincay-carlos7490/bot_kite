const { GoogleGenAI } = require('@google/genai');

async function isInsultOrToxic(text) {
  if (!text || text.trim().length < 2) return false;

  const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyBxTgSKswnNjrv4AmulMAef7Ma5C8ztAT4';

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const prompt = 
        `Analiza el siguiente texto de un chat de Discord y determina si contiene un insulto directo, grosería, mala palabra, xenofobia, insulto racista, homófobo o toxicidad grave en CUALQUIER IDIOMA.\n\n` +
        `Responde ÚNICAMENTE con una sola palabra: "INSULTO" o "LIMPIO".\n\n` +
        `Texto: "${text.replace(/"/g, '')}"`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: prompt
      });

      if (response && response.text) {
        const result = response.text.trim().toUpperCase();
        return result.includes('INSULTO');
      }
    } catch (err) {}
  }

  const basicBadWords = ['puto', 'mierda', 'estupido', 'estúpido', 'pendejo', 'imbecil', 'imbécil', 'fuck', 'bitch', 'asshole', 'bastard', 'cero', 'perra'];
  const lower = text.toLowerCase();
  return basicBadWords.some(w => lower.includes(w));
}

async function parseModerationIntent(text) {
  const lowerText = text.toLowerCase();

  const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyBxTgSKswnNjrv4AmulMAef7Ma5C8ztAT4';
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: apiKey });

      const prompt = 
        `Analiza la orden de moderación en lenguaje natural y extrae la intención en formato JSON estricto.\n` +
        `Las posibles acciones son: "ban", "unban", "clear", "restrict", "unrestrict".\n\n` +
        `Reglas para "restrict" (restringir/bloquear canal):\n` +
        `- Responde: {"action": "restrict"}\n` +
        `Reglas para "unrestrict" (desbloquear/quitar restricción de canal):\n` +
        `- Responde: {"action": "unrestrict"}\n\n` +
        `Reglas para "ban":\n` +
        `- Si el mensaje NO menciona tiempo (o dice "permanente"), usa "duration": "permanent".\n` +
        `- Si especifica tiempo, usa formato como "10h", "30m", "1d".\n` +
        `- Responde: {"action": "ban", "duration": "10h", "reason": "razon"}\n\n` +
        `Reglas para "unban":\n` +
        `- Responde: {"action": "unban", "reason": "razon"}\n\n` +
        `Reglas para "clear" (borrar mensajes):\n` +
        `- Responde: {"action": "clear", "amount": 5}\n\n` +
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
    } catch (err) {}
  }

  // Analizador NLP inteligente de respaldo
  if (lowerText.includes('desbloquea') || lowerText.includes('quita la restriccion') || lowerText.includes('desrestringe')) {
    return { action: 'unrestrict' };
  }

  if (lowerText.includes('restringe') || lowerText.includes('bloquea') || lowerText.includes('exclusivo')) {
    return { action: 'restrict' };
  }

  if (lowerText.includes('desbanea') || lowerText.includes('unban') || lowerText.includes('quita ban')) {
    let reason = 'Desbaneo por orden de moderación';
    if (lowerText.includes('por') || lowerText.includes('razon')) {
      const parts = text.split(/por|razon/i);
      if (parts.length > 1) reason = parts[parts.length - 1].trim();
    }
    return { action: 'unban', reason: reason };
  }

  if (lowerText.includes('elimina') || lowerText.includes('borra') || lowerText.includes('purga')) {
    const numMatch = lowerText.match(/(\d+)/);
    const amount = numMatch ? parseInt(numMatch[1], 10) : 5;
    return { action: 'clear', amount: amount };
  }

  if (lowerText.includes('banea') || lowerText.includes('banear') || lowerText.includes('sanciona')) {
    let duration = 'permanent';
    const timeMatch = lowerText.match(/(\d+)\s*(horas?|h|minutos?|m|dias?|d)/i);
    if (timeMatch) {
      const num = timeMatch[1];
      const unit = timeMatch[2].toLowerCase()[0];
      duration = `${num}${unit}`;
    }
    let reason = 'Sanción por orden de moderación';
    if (lowerText.includes('por') || lowerText.includes('razon')) {
      const parts = text.split(/por|razon/i);
      if (parts.length > 1) reason = parts[parts.length - 1].trim();
    }
    return { action: 'ban', duration: duration, reason: reason };
  }

  return null;
}

module.exports = {
  isInsultOrToxic,
  parseModerationIntent,
};
