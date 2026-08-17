function parseSemanticIntent(text, guildRoles = []) {
  const lower = text.toLowerCase();

  // 1. MODO PAUSADO / SLOWMODE (PRIORIDAD ALTA)
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

  // 2. UNRESTRICT_CHANNEL (Desbloquear)
  if (
    lower.includes('desbloquea') || lower.includes('desbloquear') ||
    lower.includes('libera') || lower.includes('libérame') || lower.includes('liberame') ||
    lower.includes('abre') || lower.includes('abrir') ||
    lower.includes('desrestringe') || lower.includes('desrestringir') ||
    (containsUnlockVerb && containsLockNoun)
  ) {
    return { intent: 'UNRESTRICT_CHANNEL' };
  }

  return { intent: 'CHAT' };
}

console.log('Prueba quita el modo pausado:', parseSemanticIntent('quita el modo pausado'));
