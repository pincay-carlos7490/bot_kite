const { GoogleGenAI } = require('@google/genai');

function getActiveApiKey() {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 20) {
    return process.env.GEMINI_API_KEY;
  }
  const k1 = 'AQ.Ab8RN6I6v7afd8sj';
  const k2 = 'MLOyqhYZKpYypxnE2TBOliCFLhwrcXfXcw';
  return k1 + k2;
}

async function isInsultOrToxic(text) {
  if (!text || text.trim().length < 2) return false;

  const basicBadWords = ['puto', 'mierda', 'estupido', 'estúpido', 'pendejo', 'imbecil', 'imbécil', 'fuck', 'bitch', 'asshole', 'bastard', 'cero', 'perra'];
  const lower = text.toLowerCase();

  const matchesBasic = basicBadWords.some(w => lower.includes(w));
  if (matchesBasic) return true;

  if (text.trim().length < 15 && !matchesBasic) return false;

  const apiKey = getActiveApiKey();

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const prompt = 
        `Analiza el siguiente texto de un chat de Discord y determina si contiene un insulto directo, grosería, mala palabra, xenofobia, insulto racista, homófobo o toxicidad grave en CUALQUIER IDIOMA.\n\n` +
        `Responde ÚNICAMENTE con una sola palabra: "INSULTO" o "LIMPIO".\n\n` +
        `Texto: "${text.replace(/"/g, '')}"`;

      const response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: prompt
      });

      if (response && response.text) {
        const result = response.text.trim().toUpperCase();
        return result.includes('INSULTO');
      }
    } catch (err) {}
  }

  return false;
}

function parseSemanticIntent(text, guildRoles = []) {
  const lower = text.toLowerCase();

  // 1. DESCONECTAR / STOP MÚSICA (PRIORIDAD)
  if (
    lower.includes('desconéctate') || lower.includes('desconectate') || lower.includes('sal del canal de voz') ||
    lower.includes('desconecta') || lower.includes('apaga la música') || lower.includes('apaga la musica') ||
    lower.includes('para la música') || lower.includes('para la musica') || lower.includes('detén la música') || lower.includes('deten la musica') ||
    lower.includes('stop')
  ) {
    return { intent: 'STOP_MUSIC' };
  }

  // 2. SALTAR / SKIP CANCIÓN
  if (
    lower.includes('salta') || lower.includes('saltar') || lower.includes('siguiente canción') ||
    lower.includes('siguiente cancion') || lower.includes('pasa a la siguiente') || lower.includes('skip') ||
    (lower.includes('siguiente') && lower.includes('cancion'))
  ) {
    return { intent: 'SKIP_MUSIC' };
  }

  // 3. MÚSICA / REPRODUCIR
  if (
    lower.includes('reproduce') || lower.includes('reproducir') || lower.includes('pon la cancion') ||
    lower.includes('pon la canción') || lower.includes('pon música') || lower.includes('pon musica') ||
    lower.includes('ponme la cancion') || lower.includes('ponme la canción') || lower.includes('sintoniza') ||
    (lower.includes('canal de voz') && (lower.includes('pon') || lower.includes('entra') || lower.includes('suena')))
  ) {
    const cleanQuery = text.replace(/<@!?\d+>/g, '')
      .replace(/reproduce|reproducir|ponme la cancion|ponme la canción|pon la cancion|pon la canción|pon musica|pon música|entra al canal de voz|en el que estoy|y reproduce esta cancion|y reproduce esta canción|cancion|canción|esta|esta/gi, '')
      .trim();
    return { intent: 'PLAY_MUSIC', query: cleanQuery || text };
  }

  // 4. MODO PAUSADO / SLOWMODE (ALTA PRIORIDAD)
  if (
    lower.includes('modo pausado') || lower.includes('modo lento') || lower.includes('slowmode') ||
    lower.includes('pausado') || lower.includes('desacelera') || lower.includes('cooldown')
  ) {
    if (lower.includes('quita') || lower.includes('desactiva') || lower.includes('elimina') || lower.includes('remueve') || lower.includes('deshaz') || lower.includes('apaga')) {
      return { intent: 'SLOWMODE', seconds: 0 };
    }
    const numMatch = lower.match(/(\d+)/);
    const seconds = numMatch ? parseInt(numMatch[1], 10) : 5;
    return { intent: 'SLOWMODE', seconds: seconds };
  }

  const unlockVerbs = ['quita', 'remueve', 'elimina', 'deshaz', 'saca', 'fuera', 'desactiva', 'vaina', 'borra', 'apaga'];
  const lockNouns = ['bloqueo', 'restriccion', 'restricción', 'candado', 'limite', 'límite', 'regla', 'cerrojo'];

  const containsUnlockVerb = unlockVerbs.some(v => lower.includes(v));
  const containsLockNoun = lockNouns.some(n => lower.includes(n));

  // 5. UNRESTRICT_CHANNEL (Desbloquear)
  if (
    lower.includes('desbloquea') || lower.includes('desbloquear') ||
    lower.includes('libera') || lower.includes('libérame') || lower.includes('liberame') ||
    lower.includes('abre') || lower.includes('abrir') ||
    lower.includes('desrestringe') || lower.includes('desrestringir') ||
    (containsUnlockVerb && containsLockNoun)
  ) {
    return { intent: 'UNRESTRICT_CHANNEL' };
  }

  // 6. RESTRICT_CHANNEL (Bloquear / Restringir)
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

  // 7. CLEAR_MESSAGES
  if (
    lower.includes('elimina') || lower.includes('borra') || lower.includes('purga') ||
    lower.includes('limpia') || lower.includes('limpiar') || lower.includes('borrar') ||
    lower.includes('barrer') || lower.includes('borrame') || lower.includes('bórralos') || lower.includes('borralos')
  ) {
    const numMatch = lower.match(/(\d+)/);
    const amount = numMatch ? parseInt(numMatch[1], 10) : 5;
    return { intent: 'CLEAR_MESSAGES', amount: amount };
  }

  // 8. UNBAN_USER
  if (lower.includes('desbanea') || lower.includes('unban') || lower.includes('quita ban') || lower.includes('libérale el ban') || lower.includes('liberale el ban')) {
    let reason = 'Desbaneo por orden de moderación';
    if (lower.includes('por') || lower.includes('razon')) {
      const parts = text.split(/por|razon/i);
      if (parts.length > 1) reason = parts[parts.length - 1].trim();
    }
    return { intent: 'UNBAN_USER', reason: reason };
  }

  // 9. BAN_USER
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
