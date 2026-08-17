function smartMatchRole(text, roles) {
  const lowerText = text.toLowerCase();
  
  // 1. Coincidencia exacta o parcial de roles ignorando mayúsculas/minúsculas y plurale/singulares
  for (const role of roles) {
    const rName = role.name.toLowerCase();
    const singular = rName.endsWith('s') ? rName.slice(0, -1) : rName;
    const plural = rName.endsWith('s') ? rName : rName + 's';

    if (lowerText.includes(rName) || (singular.length > 2 && lowerText.includes(singular)) || lowerText.includes(plural)) {
      return { status: 'found', role: role };
    }
  }

  // 2. Erratas comunes o palabras mal escritas ("quierl", "moderadores", etc.)
  const keywords = ['rol', 'para los', 'solo para', 'para el', 'solo los'];
  for (const kw of keywords) {
    if (lowerText.includes(kw)) {
      const parts = lowerText.split(kw);
      if (parts.length > 1) {
        const afterKw = parts[1].trim().split(/\s+/)[0];
        const commonIgnored = ['que', 'los', 'el', 'un', 'una', 'este', 'chat', 'canal', 'administradores', 'moderadores', 'bots'];
        if (afterKw && !commonIgnored.includes(afterKw)) {
          return { status: 'not_found', requestedRoleName: afterKw };
        }
      }
    }
  }

  return { status: 'no_role', role: null };
}

const mockRoles = [
  { id: '111', name: 'Administrador' },
  { id: '222', name: 'Moderadores' },
  { id: '333', name: 'Sobreviviente' },
  { id: '444', name: 'VIP' }
];

const testTexts = [
  '@kite hace que este canal solo puedan escribir los que tengan el rol moderadores',
  '@kite quierl que este chat solo sea para moderadores',
  '@kite pon este chat solo para el rol astronautas',
  '@kite bloquea este chat porfa'
];

console.log('--- PRUEBA INTELIGENTE SIN FORMATO NI RESTRICCIONES ---');
for (const t of testTexts) {
  const res = smartMatchRole(t, mockRoles);
  console.log(`Texto: "${t}"\n   => Matched Role:`, res, '\n');
}
