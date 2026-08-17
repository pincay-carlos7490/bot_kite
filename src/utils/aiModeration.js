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

function parseSemanticIntent(text, guildRoles = []) {
  const lower = text.toLowerCase();

  const unlockVerbs = ['quita', 'remueve', 'elimina', 'deshaz', 'saca', 'fuera', 'desactiva', 'vaina', 'borra', 'apaga'];
  const lockNouns = ['bloqueo', 'restriccion', 'restricción', 'candado', 'limite', 'límite', 'modo', 'regla', 'cerrojo'];

  const containsUnlockVerb = unlockVerbs.some(v => lower.includes(v));
  const containsLockNoun = lockNouns.some(n => lower.includes(n));

  // 1. UNRESTRICT_CHANNEL (Desbloquear / Quitar candado / Quitar restricción / Quitar bloqueo / Quitar esa vaina de bloqueo)
  if (
    lower.includes('desbloquea') || lower.includes('desbloquear') ||
    lower.includes('libera') || lower.includes('libérame') || lower.includes('liberame') ||
    lower.includes('abre') || lower.includes('abrir') ||
    lower.includes('desrestringe') || lower.includes('desrestringir') ||
    (containsUnlockVerb && containsLockNoun)
  ) {
    return { intent: 'UNRESTRICT_CHANNEL' };
  }

  // 2. RESTRICT_CHANNEL (Bloquear / Restringir / Cerrar / Poner candado / Solo ciertos roles)
  if (
    lower.includes('restringe') || lower.includes('restringir') ||
    lower.includes('bloquea') || lower.includes('bloquear') || lower.includes('bloqueo') ||
    lower.includes('candado') || lower.includes('exclusivo') || lower.includes('restriccion') || lower.includes('restricción') ||
    lower.includes('cierra') || lower.includes('cerrar') || lower.includes('cerrojo') ||
    (lower.includes('solo') && (lower.includes('escribir') || lower.includes('hablar') || lower.includes('rol') || lower.includes('puedan') || lower.includes('los') || lower.includes('para'))) ||
    (lower.includes('nadie') && (lower.includes('hable') || lower.includes('escriba') || lower.includes('salvo') || lower.includes('excepto') || lower.includes('pueda'))) ||
    (lower.includes('hace') && (lower.includes('canal') || lower.includes('chat') || lower.includes('sitio'))) ||
    (lower.includes('haz') && (lower.includes('canal') || lower.includes('chat') || lower.includes('sitio'))) ||
    (lower.includes('pon') && (lower.includes('canal') || lower.includes('chat') || lower.includes('sitio')))
  ) {
    let matchedRole = null;
    for (const r of guildRoles) {
      const rName = r.name.toLowerCase();
      const singular = rName.endsWith('s') ? rName.slice(0, -1) : rName;
      const plural = rName.endsWith('s') ? rName : rName + 's';

      const genericNames = ['administrador', 'administradores', 'admin', 'admins', 'bot', 'bots'];
      if (genericNames.includes(rName)) continue;

      if (lower.includes(rName) || (singular.length > 2 && lower.includes(singular)) || lower.includes(plural)) {
        matchedRole = r;
        break;
      }
    }

    if (!matchedRole) {
      const keywords = ['rol', 'para los', 'solo para', 'para el', 'solo los', 'salvo los', 'excepto los', 'rol de'];
      for (const kw of keywords) {
        if (lower.includes(kw)) {
          const parts = lower.split(kw);
          if (parts.length > 1) {
            const afterKw = parts[1].trim().split(/\s+/)[0];
            const ignored = ['que', 'los', 'el', 'un', 'una', 'este', 'chat', 'canal', 'administradores', 'moderadores', 'bots', 'puedan', 'escribir', 'hablar'];
            if (afterKw && !ignored.includes(afterKw)) {
              return { intent: 'RESTRICT_CHANNEL', status: 'not_found', requestedRoleName: afterKw };
            }
          }
        }
      }
    }

    return { intent: 'RESTRICT_CHANNEL', status: matchedRole ? 'found' : 'no_role', role: matchedRole };
  }

  // 3. CLEAR_MESSAGES
  if (
    lower.includes('elimina') || lower.includes('borra') || lower.includes('purga') ||
    lower.includes('limpia') || lower.includes('limpiar') || lower.includes('borrar') || lower.includes('barrer')
  ) {
    const numMatch = lower.match(/(\d+)/);
    const amount = numMatch ? parseInt(numMatch[1], 10) : 5;
    return { intent: 'CLEAR_MESSAGES', amount: amount };
  }

  // 4. UNBAN_USER
  if (lower.includes('desbanea') || lower.includes('unban') || lower.includes('quita ban') || lower.includes('libérale el ban') || lower.includes('liberale el ban')) {
    let reason = 'Desbaneo por orden de moderación';
    if (lower.includes('por') || lower.includes('razon')) {
      const parts = text.split(/por|razon/i);
      if (parts.length > 1) reason = parts[parts.length - 1].trim();
    }
    return { intent: 'UNBAN_USER', reason: reason };
  }

  // 5. BAN_USER
  if (lower.includes('banea') || lower.includes('banear') || lower.includes('sanciona') || lower.includes('saca a') || lower.includes('expulsa') || lower.includes('sacalo')) {
    let duration = 'permanent';
    const timeMatch = lower.match(/(\d+)\s*(horas?|h|minutos?|m|dias?|d)/i);
    if (timeMatch) {
      const num = timeMatch[1];
      const unit = timeMatch[2].toLowerCase()[0];
      duration = `${num}${unit}`;
    }
    let reason = 'Sanción por orden de moderación';
    if (lower.includes('por') || lower.includes('razon')) {
      const parts = text.split(/por|razon/i);
      if (parts.length > 1) reason = parts[parts.length - 1].trim();
    }
    return { intent: 'BAN_USER', duration: duration, reason: reason };
  }

  return { intent: 'CHAT' };
}

module.exports = {
  isInsultOrToxic,
  parseSemanticIntent,
};
