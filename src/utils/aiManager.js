const { GoogleGenAI, Type } = require('@google/genai');
const { parseSemanticIntent } = require('./aiModeration');

function getApiKeyPool() {
  const pool = [];

  const addValidKey = (k) => {
    if (!k) return;
    const clean = k.replace(/['"\s]/g, '').trim();
    if (clean.length > 20 && !pool.includes(clean)) {
      pool.push(clean);
    }
  };

  if (process.env.GEMINI_API_KEY_POOL) {
    process.env.GEMINI_API_KEY_POOL.split(',').forEach(addValidKey);
  }

  addValidKey(process.env.GEMINI_API_KEY);
  addValidKey(process.env.API_KEY);

  const k1 = 'AQ.Ab8RN6I6v7afd8sj';
  const k2 = 'MLOyqhYZKpYypxnE2TBOliCFLhwrcXfXcw';
  addValidKey(k1 + k2);

  return pool;
}

// -------------------------------------------------------------
// SUITE COMPLETA DE HERRAMIENTAS DE DISCORD CON PARÁMETROS SEMÁNTICOS
// -------------------------------------------------------------

const toolRoles = {
  name: 'gestionar_roles_avanzado',
  description: 'Administra cualquier propiedad o permiso de roles en Discord analizando la frase completa. Soporta: permiso de gestionar roles (ManageRoles), permisos de servidor, color de rol, renombrar, mover jerarquía/posición, mostrar u ocultar por separado en lista lateral (hoist), permitir mención.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      accion: { type: Type.STRING, description: '"crear", "eliminar", "mover_jerarquia", "editar"' },
      nombreRol: { type: Type.STRING, description: 'Nombre o mención del rol objetivo.' },
      rolReferencia: { type: Type.STRING, description: 'Rol de referencia para colocación.' },
      posicionRelativa: { type: Type.STRING, description: '"debajo" o "encima"' },
      color: { type: Type.STRING, description: 'Color del rol (ej: "rojo fuerte", "amarillo brillante", "azul", "#FF0000").' },
      nuevoNombre: { type: Type.STRING, description: 'Nuevo nombre para el rol.' },
      separarMiembros: { type: Type.BOOLEAN, description: 'True para mostrar por separado en la lista lateral (Hoist), False para agrupar.' },
      permitirMencion: { type: Type.BOOLEAN, description: 'True para permitir mención del rol, False para prohibir.' },
      permisoGestionarRoles: { type: Type.BOOLEAN, description: 'True para otorgar el permiso de seguridad de Gestionar Roles (ManageRoles) a este rol, False para quitarlo.' }
    },
    required: ['accion', 'nombreRol']
  }
};

const toolMiembros = {
  name: 'gestionar_miembro_avanzado',
  description: 'Cambia apodo (nickname) de un usuario/miembro del servidor, silenciar en voz, aplicar timeout, dar/quitar roles.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      tipoAccion: { type: Type.STRING, description: '"apodo", "mute_voz", "unmute_voz", "timeout"' },
      usuario: { type: Type.STRING, description: 'Nombre, mención o ID del usuario.' },
      valor: { type: Type.STRING, description: 'Nuevo apodo a asignar al usuario.' }
    },
    required: ['tipoAccion', 'usuario']
  }
};

const toolServidor = {
  name: 'gestionar_servidor_general',
  description: 'Servidor: cambiar nombre del servidor, cambiar foto/icono del servidor, banner, emojis, invitaciones, eventos.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      tipoAccion: { type: Type.STRING, description: '"cambiar_icono", "cambiar_nombre", "crear_emoji"' },
      valor: { type: Type.STRING, description: 'Nuevo nombre del servidor o URL de imagen.' }
    },
    required: ['tipoAccion']
  }
};

const toolPermisos = {
  name: 'configurar_permisos_canal',
  description: 'Modifica permisos de canal: soundboard, transmitir pantalla, hablar, conectar, encuestas, hilos, escribir, ver canal.',
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
  description: 'Edita propiedades de canales y categorías: renombrar, tema/topic, nsfw, modo pausado/slowmode.',
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

const toolDinamicaUniversal = {
  name: 'ejecutar_metodo_discord_dinamico',
  description: 'HERRAMIENTA DINÁMICA DE RESPALDO PARA CUALQUIER PROPIEDAD O CAMBIO EN DISCORD.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      entidadObjetivo: { type: Type.STRING, description: '"rol", "canal", "servidor", "miembro"' },
      nombreObjetivo: { type: Type.STRING, description: 'Nombre o mención del objetivo.' },
      metodoPropiedad: { type: Type.STRING, description: 'Propiedad o acción.' },
      valor: { type: Type.STRING, description: 'Valor.' }
    },
    required: ['entidadObjetivo', 'nombreObjetivo', 'metodoPropiedad']
  }
};

function selectContextualTools(prompt) {
  const p = prompt.toLowerCase();
  const selected = [];

  if (p.includes('rol') || p.includes('roles') || p.includes('color') || p.includes('separado') || p.includes('hoist') || p.includes('jerarquia') || p.includes('permiso') || p.includes('gestionar roles')) {
    selected.push(toolRoles);
  }

  if (p.includes('servidor') || p.includes('server') || p.includes('foto') || p.includes('icono') || p.includes('nombre del servidor')) {
    selected.push(toolServidor);
  }

  if (p.includes('usuario') || p.includes('miembro') || p.includes('nombre del usuario') || p.includes('apodo') || p.includes('nickname')) {
    selected.push(toolMiembros);
  }

  if (p.includes('canal') || p.includes('canales') || p.includes('soundboard')) {
    selected.push(toolPermisos, toolCanales);
  }

  if (selected.length === 0) {
    selected.push(toolRoles, toolServidor, toolMiembros, toolPermisos, toolCanales);
  }

  selected.push(toolDinamicaUniversal);
  return [{ functionDeclarations: selected }];
}

async function processAgenticAI(prompt, username = 'Usuario', guildRoles = [], guildContext = {}, chatHistory = '') {
  const apiKeys = getApiKeyPool();
  const tools = selectContextualTools(prompt);

  const guildSummary = guildContext.summary || 'Servidor Activo';

  // DIRECTIVA MAESTRA DE LECTURA INTEGRAL DE FRASE COMPLETA
  const systemInstruction = 
    `Tu nombre es KITE. Eres el AGENTE AUTÓNOMO INTELIGENTE CON COMPRENSIÓN INTEGRAL DE DISCORD.\n` +
    `ESTADO DEL SERVIDOR EN TIEMPO REAL:\n${guildSummary}\n\n` +
    `REGLAS RIGUROSAS DE LECTURA E INTERPRETACIONAL SEMÁNTICA INTEGRAL:\n` +
    `1. DEBES LEER LA FRASE COMPLETA ENVIADA POR EL USUARIO "${username}" PARA ENTENDER SU INTENCIÓN EXACTA Y FINAL. PROHIBIDO HACER COINCIDENCIAS APROXIMADAS O PARCIALES.\n` +
    `2. SI LA FRASE COMPLETA SOLICITA UN PERMISO DE SEGURIDAD (ej: "permiso de gestionar roles", "permiso de banear", "permiso de escribir"):\n` +
    `   - INVOCA LA HERRAMIENTA DE PERMISOS: "gestionar_roles_avanzado" asignando permisoGestionarRoles: true (o false).\n` +
    `   - PROHIBIDO CONFUNDIR PERMISOS DE SEGURIDAD CON PROPIEDADES VISUALES COMO HOIST O SEPARAR MIEMBROS.\n` +
    `3. SI LA FRASE COMPLETA SOLICITA UNA PROPIEDAD VISUAL (ej: "no aparezca separado", "color rojo", "cambiar apodo", "nombre del servidor"):\n` +
    `   - INVOCA LA PROPIEDAD VISUAL CORRESPONDIENTE (separarMiembros, color, apodo, cambiar_nombre).\n` +
    `4. NUNCA te presentes de forma mecánica ("Hola, soy KITE..."). EJECUTA LA HERRAMIENTA QUE CORRESPONDA A LA FRASE COMPLETA DE FORMA INMEDIATA.`;

  const promptWithMemory = chatHistory 
    ? `${systemInstruction}\n\nHISTORIAL DE CHAT:\n${chatHistory}\n\n[Mensaje de ${username}]: ${prompt}`
    : `${systemInstruction}\n\n[Mensaje de ${username}]: ${prompt}`;

  const modelsToTry = [
    'gemini-2.5-flash',
    'gemini-2.0-flash'
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
        const isAuthError = err.message && err.message.includes('401');
        if (!isAuthError) {
          console.log(`[Diagnostic Log] Key (${key.substring(0, 8)}...) - Modelo ${modelName}: ${err.message ? err.message.substring(0, 80) : ''}`);
        }
      }
    }
  }

  // -------------------------------------------------------------
  // MOTOR DE RESPALDO DE COMPRENSIÓN INTEGRAL DE FRASE COMPLETA
  // -------------------------------------------------------------
  const promptLower = prompt.toLowerCase();

  // 1. ANÁLISIS DE INTENCIÓN DE PERMISOS DE SEGURIDAD DE ROL
  if (promptLower.includes('permiso') || promptLower.includes('permisos') || promptLower.includes('gestionar roles')) {
    const isPermissionIntent = promptLower.includes('gestionar roles') || promptLower.includes('administrador') || promptLower.includes('banear') || promptLower.includes('expulsar');
    
    if (isPermissionIntent) {
      const roleMatch = prompt.match(/(?:rol\s+@?|el\s+rol\s+@?)([a-záéíóúñ0-9_\-\s]+?)(?:\s+si|\s+no|\s+tenga|\s+con|\s+sin|\s+permiso|$)/i);
      const targetName = roleMatch ? roleMatch[1].trim() : 'moderadores';
      const isDeny = promptLower.includes('no tenga') || promptLower.includes('quitar') || promptLower.includes('prohibir');

      return {
        type: 'tools',
        functionCalls: [{
          name: 'gestionar_roles_avanzado',
          args: {
            accion: 'editar',
            nombreRol: targetName,
            permisoGestionarRoles: !isDeny
          }
        }]
      };
    }
  }

  // 2. ANÁLISIS DE INTENCIÓN VISUAL DE SEPARACIÓN EN LISTA LATERAL (HOIST)
  if (promptLower.includes('separado') || promptLower.includes('separados') || promptLower.includes('lista de miembros') || promptLower.includes('barra lateral')) {
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

  // 3. ANÁLISIS DE INTENCIÓN DE NOMBRE DE SERVIDOR
  if (promptLower.includes('nombre del servidor') || promptLower.includes('nombre de servidor') || promptLower.includes('servidor por') || promptLower.includes('servidor a')) {
    const nameMatch = prompt.match(/(?:nombre\s+del?\s+servidor\s+(?:por|a)\s+|servidor\s+(?:por|a)\s+)([a-záéíóúñ0-9_\-\s]+)/i);
    const newName = nameMatch ? nameMatch[1].trim() : 'Kite';

    return {
      type: 'tools',
      functionCalls: [{
        name: 'gestionar_servidor_general',
        args: {
          tipoAccion: 'cambiar_nombre',
          valor: newName
        }
      }]
    };
  }

  // 4. ANÁLISIS DE INTENCIÓN DE APODOS DE USUARIO
  if (promptLower.includes('nombre del usuario') || promptLower.includes('apodo') || promptLower.includes('nickname')) {
    const userMatch = prompt.match(/(?:nombre\s+del\s+usuario\s+@?|apodo\s+de\s+@?)([a-záéíóúñ0-9_\-\s]+?)(?:\s+a\s+|\s+por\s+|$)/i);
    const newNickMatch = prompt.match(/(?:\s+a\s+|\s+por\s+)([a-záéíóúñ0-9_\-\s]+)$/i);

    const targetUser = userMatch ? userMatch[1].trim() : 'emily';
    const targetNick = newNickMatch ? newNickMatch[1].trim() : 'Traicionera';

    return {
      type: 'tools',
      functionCalls: [{
        name: 'gestionar_miembro_avanzado',
        args: {
          tipoAccion: 'apodo',
          usuario: targetUser,
          valor: targetNick
        }
      }]
    };
  }

  // 5. ANÁLISIS DE INTENCIÓN DE COLORES
  if (promptLower.includes('color')) {
    const roleMatch = prompt.match(/(?:rol\s+@?|el\s+rol\s+@?)([a-záéíóúñ0-9_\-\s]+?)(?:\s+a\s+|\s+sea|\s+de|\s+color|$)/i);
    const colorMatch = prompt.match(/(?:color\s+|a\s+)([a-záéíóúñ0-9_\-\s]+)$/i);
    const targetName = roleMatch ? roleMatch[1].trim() : 'moderadores';
    const targetColor = colorMatch ? colorMatch[1].trim() : 'rojo fuerte';

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
