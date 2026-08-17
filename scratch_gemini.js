function findRoleInText(text, rolesList) {
  const lowerText = text.toLowerCase();

  // 1. Buscar si algún nombre de rol existente en el servidor coincide
  for (const role of rolesList) {
    const roleName = role.name.toLowerCase();
    const singularName = roleName.endsWith('s') ? roleName.slice(0, -1) : roleName;
    const pluralName = roleName.endsWith('s') ? roleName : roleName + 's';

    if (lowerText.includes(roleName) || lowerText.includes(singularName) || lowerText.includes(pluralName)) {
      return { status: 'found', role: role };
    }
  }

  // 2. Comprobar si el usuario nombró un rol que NO existe
  const roleKeywordsMatch = text.match(/(?:rol|rol de|para|solo)\s+([a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ]+)/i);
  if (roleKeywordsMatch) {
    const potentialRoleName = roleKeywordsMatch[1].trim();
    const commonWords = ['que', 'los', 'el', 'un', 'una', 'este', 'chat', 'canal', 'administradores', 'moderadores', 'bots'];
    if (!commonWords.includes(potentialRoleName.toLowerCase())) {
      return { status: 'not_found', requestedRoleName: potentialRoleName };
    }
  }

  return { status: 'no_role', role: null };
}

const mockRoles = [
  { id: '111', name: 'Administrador' },
  { id: '222', name: 'Moderador' },
  { id: '333', name: 'Sobreviviente' },
  { id: '444', name: 'VIP' }
];

const testTexts = [
  '@kite restringe este chat que solo los que tengan el rol de moderadores puedan escribir',
  '@kite quiero que este chat sea solo para el rol Sobreviviente',
  '@kite restringe este chat para el rol astronautas',
  '@kite bloquea este canal por favor'
];

console.log('--- PRUEBA DE BUSCADOR DE ROLES INTELIGENTE ---');
for (const t of testTexts) {
  const res = findRoleInText(t, mockRoles);
  console.log(`Texto: "${t}"\n   => Resultado:`, res, '\n');
}
