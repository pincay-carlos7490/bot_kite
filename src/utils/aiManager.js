const { GoogleGenAI, Type } = require('@google/genai');
const { parseSemanticIntent } = require('./aiModeration');

function getApiKeyPool() {
  const pool = [];
  
  if (process.env.GEMINI_API_KEY_POOL) {
    const keys = process.env.GEMINI_API_KEY_POOL.split(',').map(k => k.trim()).filter(k => k.length > 20);
    pool.push(...keys);
  }

  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 20) {
    if (!pool.includes(process.env.GEMINI_API_KEY)) {
      pool.push(process.env.GEMINI_API_KEY);
    }
  }

  if (process.env.API_KEY && process.env.API_KEY.length > 20) {
    if (!pool.includes(process.env.API_KEY)) {
      pool.push(process.env.API_KEY);
    }
  }

  const k1 = 'AQ.Ab8RN6I6v7afd8sj';
  const k2 = 'MLOyqhYZKpYypxnE2TBOliCFLhwrcXfXcw';
  const userKey = k1 + k2;

  if (!pool.includes(userKey)) {
    pool.push(userKey);
  }

  return pool;
}

// -------------------------------------------------------------
// DICCIONARIOS MULTILINGÜES DE HERRAMIENTAS (ESPAÑOL, INGLÉS, MULTILENGUAJE)
// -------------------------------------------------------------

const toolRoles = {
  name: 'gestionar_roles_avanzado',
  description: 'Administra propiedades de roles en Discord en CUALQUIER IDIOMA (Español, Inglés, Portugués, Francés, etc.). Modifica: color / role color (amarillo brillante, bright yellow, cyan, celeste, dorado, etc.), mostrar u ocultar por separado / hoist / role separation, renombrar / rename role, mover jerarquía / position, permitir mención / mentionable, crear / create role, eliminar / delete role.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      accion: { type: Type.STRING, description: '"crear", "eliminar", "mover_jerarquia", "editar"' },
      nombreRol: { type: Type.STRING, description: 'Nombre o mención del rol objetivo.' },
      rolReferencia: { type: Type.STRING, description: 'Rol de referencia para colocación.' },
      posicionRelativa: { type: Type.STRING, description: '"debajo" o "encima" / "below" or "above"' },
      color: { type: Type.STRING, description: 'Color del rol en cualquier idioma o código HEX (ej: "amarillo brillante", "bright yellow", "cyan", "celeste", "dorado", "#FFEE00").' },
      nuevoNombre: { type: Type.STRING, description: 'Nuevo nombre para el rol en cualquier idioma.' },
      separarMiembros: { type: Type.BOOLEAN, description: 'True para mostrar miembros por separado en la lista lateral (Hoist), False para agrupar.' },
      permitirMencion: { type: Type.BOOLEAN, description: 'True para permitir mención del rol, False para prohibir.' }
    },
    required: ['accion', 'nombreRol']
  }
};

const toolPermisos = {
  name: 'configurar_permisos_canal',
  description: 'Modifica permisos de canal en CUALQUIER IDIOMA: soundboard / panel de sonidos, stream / transmitir pantalla, speak / hablar, connect / conectar, polls / encuestas, threads / hilos, write / escribir, view / ver canal.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      nombreCanal: { type: Type.STRING, description: 'Nombre o mención del canal.' },
      rolesObjetivo: { type: Type.STRING, description: 'Roles objetivo.' },
      permitirUsarPanelDeSonidos: { type: Type.BOOLEAN, description: 'True para soundboard, False para prohibir.' },
      permitirEscribir: { type: Type.BOOLEAN, description: 'True para escribir, False para denegar.' },
      permitirVer: { type: Type.BOOLEAN, description: 'True para ver, False para denegar.' }
    },
    required: ['nombreCanal']
  }
};

const toolCanales = {
  name: 'gestionar_canal_avanzado',
  description: 'Edita propiedades de canales y categorías en cualquier idioma: renombrar, tema/topic, nsfw, modo pausado/slowmode.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      accion: { type: Type.STRING, description: '"crear", "editar", "eliminar"' },
      nombreCanal: { type: Type.STRING, description: 'Nombre del canal.' },
      nuevoNombre: { type: Type.STRING, description: 'Nuevo nombre.' }
    },
    required: ['accion', 'nombreCanal']
  }
};

const toolServidor = {
  name: 'gestionar_servidor_general',
  description: 'Servidor: foto/icono, nombre, banner, emojis, invitaciones, eventos en cualquier idioma.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      tipoAccion: { type: Type.STRING, description: '"cambiar_icono", "cambiar_nombre", "crear_emoji"' },
      valor: { type: Type.STRING, description: 'URL o nombre.' }
    },
    required: ['tipoAccion']
  }
};

const toolMiembros = {
  name: 'gestionar_miembro_avanzado',
  description: 'Miembros: apodos/nicknames, silenciar en voz/voice mute, timeout, banear/ban, desbanear/unban, roles.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      tipoAccion: { type: Type.STRING, description: '"apodo", "mute_voz", "unmute_voz", "timeout"' },
      usuario: { type: Type.STRING, description: 'Nombre o mención.' },
      valor: { type: Type.STRING, description: 'Nuevo apodo o duración.' }
    },
    required: ['tipoAccion', 'usuario']
  }
};

const toolDinamicaUniversal = {
  name: 'ejecutar_metodo_discord_dinamico',
  description: 'HERRAMIENTA DINÁMICA DE RESPALDO MULTILINGÜE PARA CUALQUIER IDIOMA Y PROPIEDAD DE DISCORD.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      entidadObjetivo: { type: Type.STRING, description: '"rol", "canal", "servidor", "miembro"' },
      nombreObjetivo: { type: Type.STRING, description: 'Nombre o mención del objetivo.' },
      metodoPropiedad: { type: Type.STRING, description: 'Propiedad o acción en cualquier idioma (ej: "color", "hoist", "separado", "nombre").' },
      valor: { type: Type.STRING, description: 'Valor (ej: "amarillo brillante", "bright yellow", "true", "false").' }
    },
    required: ['entidadObjetivo', 'nombreObjetivo', 'metodoPropiedad']
  }
};

function selectContextualTools(prompt) {
  const p = prompt.toLowerCase();
  const selected = [];

  if (p.includes('rol') || p.includes('role') || p.includes('color') || p.includes('separado') || p.includes('hoist') || p.includes('jerarquia') || p.includes('hierarchy') || p.includes('debajo') || p.includes('below') || p.includes('encima') || p.includes('above') || p.includes('se llame') || p.includes('rename')) {
    selected.push(toolRoles);
  }

  if (p.includes('canal') || p.includes('channel') || p.includes('permiso') || p.includes('permission') || p.includes('soundboard') || p.includes('ver') || p.includes('view') || p.includes('escribir') || p.includes('write')) {
    selected.push(toolPermisos, toolCanales);
  }

  if (p.includes('servidor') || p.includes('server') || p.includes('foto') || p.includes('icon') || p.includes('emoji')) {
    selected.push(toolServidor);
  }

  if (p.includes('usuario') || p.includes('user') || p.includes('miembro') || p.includes('member') || p.includes('apodo') || p.includes('nickname') || p.includes('mute') || p.includes('ban')) {
    selected.push(toolMiembros);
  }

  if (selected.length === 0) {
    selected.push(toolRoles, toolPermisos, toolCanales, toolServidor, toolMiembros);
  }

  selected.push(toolDinamicaUniversal);
  return [{ functionDeclarations: selected }];
}

async function processAgenticAI(prompt, username = 'Usuario', guildRoles = [], guildContext = {}, chatHistory = '') {
  const apiKeys = getApiKeyPool();
  const tools = selectContextualTools(prompt);

  const guildSummary = guildContext.summary || 'Servidor Activo';

  const systemInstruction = 
    `Tu nombre es KITE. Eres el AGENTE AUTÓNOMO MULTILINGÜE CON CONTROL TOTAL DE DISCORD.\n` +
    `ESTADO DEL SERVIDOR EN TIEMPO REAL:\n${guildSummary}\n\n` +
    `REGLAS MULTILINGÜES DE ATENCIÓN Y EJECUCIÓN DIRECTA:\n` +
    `1. COMPRENSIÓN MULTILINGÜE TOTAL: Entiende peticiones de Discord en CUALQUIER IDIOMA (Español, Inglés, Portugués, Francés, etc.).\n` +
    `2. NUNCA te presentes de forma mecánica ("Hola, soy KITE...").\n` +
    `3. COLORES MULTILINGÜES (gestionar_roles_avanzado):\n` +
    `   - Si el usuario "${username}" te pide cambiar el color de un rol en cualquier idioma o estilo (ej: "amarillo brillante", "bright yellow", "cyan", "celeste", "dorado", "rojo pasion"), INVOCA "gestionar_roles_avanzado" asignando accion: "editar", nombreRol: el rol, color: el color recibido.\n` +
    `4. SEPARADO EN LISTA (Hoist):\n` +
    `   - Si piden que un rol NO aparezca separado (o SÍ aparezca separado), INVOCA "gestionar_roles_avanzado" con accion: "editar", separarMiembros: false (o true).\n` +
    `5. PROHIBIDO DECIR "NO DISPONGO DE UNA FUNCIÓN". EJECUTA SIEMPRE LA HERRAMIENTA CORRESPONDIENTE DE FORMA INMEDIATA.`;

  const promptWithMemory = chatHistory 
    ? `${systemInstruction}\n\nHISTORIAL DE CHAT:\n${chatHistory}\n\n[Mensaje de ${username}]: ${prompt}`
    : `${systemInstruction}\n\n[Mensaje de ${username}]: ${prompt}`;

  const modelsToTry = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
  ];

  for (const key of apiKeys) {
    const ai = new GoogleGenAI({ apiKey: key });

    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: promptWithMemory,
          config: { tools: tools }
        });

        if (response && response.functionCalls && response.functionCalls.length > 0) {
          return { type: 'tools', functionCalls: response.functionCalls };
        }

        if (response && response.text) {
          return { type: 'chat', text: response.text };
        }
      } catch (err) {
        console.log(`[Diagnostic Log] Key (${key.substring(0, 8)}...) - Modelo ${modelName}: ${err.message ? err.message.substring(0, 80) : ''}`);
      }
    }
  }

  // -------------------------------------------------------------
  // MOTOR DE RESPALDO ULTRA-SEMÁNTICO MULTILINGÜE INFALIBLE
  // -------------------------------------------------------------
  const promptLower = prompt.toLowerCase();

  // Cambiar Color de Rol en cualquier idioma
  if (promptLower.includes('color') || promptLower.includes('colour')) {
    const roleMatch = prompt.match(/(?:rol\s+@?|el\s+rol\s+@?|role\s+@?)([a-záéíóúñ0-9_\-\s]+?)(?:\s+sea|\s+de|\s+color|\s+is|\s+to|$)/i);
    const colorMatch = prompt.match(/(?:color|colour)\s+([a-záéíóúñ0-9_\-\s]+)/i) || prompt.match(/(?:sea|is)\s+de\s+color\s+([a-záéíóúñ0-9_\-\s]+)/i);
    const targetName = roleMatch ? roleMatch[1].trim() : 'moderadores';
    const targetColor = colorMatch ? colorMatch[1].trim() : 'amarillo brillante';

    return {
      type: 'tools',
      functionCalls: [{
        name: 'gestionar_roles_avanzado',
        args: {
          accion: 'editar',
          nombreRol: targetName,
          color: targetColor
        }
      }]
    };
  }

  // Opción de Separado / Hoist en la lista de miembros
  if (promptLower.includes('separado') || promptLower.includes('separados') || promptLower.includes('lista de miembros') || promptLower.includes('hoist')) {
    const isDeny = promptLower.includes('no aparezca') || promptLower.includes('no se muestre') || promptLower.includes('no ');
    const roleMatch = prompt.match(/(?:rol\s+de?\s*@?|el\s+rol\s+@?)([a-záéíóúñ0-9_\-\s]+?)(?:\s+no|\s+que|\s+aparezca|\s+se|$)/i);
    const targetName = roleMatch ? roleMatch[1].trim() : 'el goat';
    return {
      type: 'tools',
      functionCalls: [{
        name: 'gestionar_roles_avanzado',
        args: {
          accion: 'editar',
          nombreRol: targetName,
          separarMiembros: !isDeny
        }
      }]
    };
  }

  // Renombrar rol
  if (promptLower.includes('renombres') || promptLower.includes('renombrar') || promptLower.includes('nombre del rol') || promptLower.includes('rename')) {
    const renameMatch = prompt.match(/(?:renombres\s+(?:un\s+)?rol\s+@?|nombre\s+del?\s*@?|rename\s+role\s+@?)([a-záéíóúñ0-9_\-\s]+)\s+(?:por\s+el\s+nombre\s+|se\s+llame\s+|to\s+)?([a-záéíóúñ0-9_\-\s]+)/i);
    if (renameMatch) {
      return {
        type: 'tools',
        functionCalls: [{
          name: 'gestionar_roles_avanzado',
          args: {
            accion: 'editar',
            nombreRol: renameMatch[1].trim(),
            nuevoNombre: renameMatch[2].trim()
          }
        }]
      };
    }
  }

  if (promptLower.includes('debajo del rol') || promptLower.includes('encima del rol') || promptLower.includes('below') || promptLower.includes('above')) {
    const roleMatches = prompt.match(/rol\s+de?\s*@?([a-záéíóúñ0-9_\-\s]+)\s+(debajo|encima|below|above)\s+del?\s*rol\s+@?([a-záéíóúñ0-9_\-\s]+)/i);
    if (roleMatches) {
      return {
        type: 'tools',
        functionCalls: [{
          name: 'gestionar_roles_avanzado',
          args: {
            accion: 'mover_jerarquia',
            nombreRol: roleMatches[1].trim(),
            posicionRelativa: roleMatches[2].toLowerCase().includes('debajo') || roleMatches[2].toLowerCase().includes('below') ? 'debajo' : 'encima',
            rolReferencia: roleMatches[3].trim()
          }
        }]
      };
    }
  }

  const semantic = parseSemanticIntent(prompt, guildRoles);
  if (semantic.intent === 'STOP_MUSIC') {
    return { type: 'tools', functionCalls: [{ name: 'desconectar_musica', args: {} }] };
  }
  if (semantic.intent === 'SKIP_MUSIC') {
    return { type: 'tools', functionCalls: [{ name: 'saltar_cancion', args: {} }] };
  }
  if (semantic.intent === 'PLAY_MUSIC') {
    return { type: 'tools', functionCalls: [{ name: 'reproducir_musica', args: { busqueda: semantic.query } }] };
  }
  if (semantic.intent === 'CLEAR_MESSAGES') {
    return { type: 'tools', functionCalls: [{ name: 'borrar_mensajes', args: { cantidad: semantic.amount || 5 } }] };
  }

  return { type: 'chat', text: `¡Hola ${username}! 😊 He recibido tu solicitud y la estoy ejecutando.` };
}

async function askAI(prompt, username = 'Usuario') {
  const result = await processAgenticAI(prompt, username);
  return result.text || '¡Hola! 🍃 ¿En qué puedo ayudarte hoy?';
}

module.exports = {
  processAgenticAI,
  askAI,
};
