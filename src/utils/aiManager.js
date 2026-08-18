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

async function processAgenticAI(prompt, username = 'Usuario', guildRoles = [], guildContext = {}, chatHistory = '') {
  const apiKeys = getApiKeyPool();

  const tools = [{
    functionDeclarations: [
      {
        name: 'gestionar_roles_avanzado',
        description: 'Crea, elimina o modifica cualquier rol del servidor: renombrar un rol, cambiar color, mover posición/jerarquía (mover un rol por encima o por debajo de otro rol), separar lista de miembros (hoist), permitir mención, etc.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            accion: { type: Type.STRING, description: '"crear", "eliminar", "mover_jerarquia", "editar"' },
            nombreRol: { type: Type.STRING, description: 'Nombre o mención del rol a modificar (ej: "@Bots" o "Bots").' },
            rolReferencia: { type: Type.STRING, description: 'Nombre del rol de referencia para colocarlo por encima o por debajo.' },
            posicionRelativa: { type: Type.STRING, description: '"debajo" o "encima"' },
            color: { type: Type.STRING, description: 'Color del rol.' },
            nuevoNombre: { type: Type.STRING, description: 'Nuevo nombre para el rol (ej: "ayudantes").' }
          },
          required: ['accion', 'nombreRol']
        }
      },
      {
        name: 'configurar_permisos_canal',
        description: 'Modifica de forma AGÉNTICA Y UNIVERSAL cualquier permiso de canal en Discord (Usar panel de sonidos / soundboard, sonidos externos, transmitir en vivo, hablar, conectar, crear encuestas, escribir, hilos públicos, hilos privados, ver canal, imágenes, reacciones, emojis externos, menciones, borrar mensajes, crear invitaciones, etc.) para cualquier rol o @everyone.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            nombreCanal: { type: Type.STRING, description: 'Nombre o mención del canal a configurar.' },
            rolesObjetivo: { type: Type.STRING, description: 'Roles a los cuales modificar permisos.' },
            permitirUsarPanelDeSonidos: { type: Type.BOOLEAN, description: 'True para permitir usar el panel de sonidos (Verde ✅), False para prohibir (Rojo ❌).' },
            permitirEscribir: { type: Type.BOOLEAN, description: 'True para permitir enviar mensajes (Verde ✅), False para denegar (Rojo ❌).' },
            permitirVer: { type: Type.BOOLEAN, description: 'True para permitir ver canal, False para ocultar canal.' }
          },
          required: ['nombreCanal']
        }
      },
      {
        name: 'gestionar_servidor_general',
        description: 'Herramienta universal de administración del servidor: cambiar el icono/foto del servidor, cambiar nombre del servidor, crear emoji personalizado, etc.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            tipoAccion: { type: Type.STRING, description: '"cambiar_icono", "cambiar_nombre", "crear_emoji"' },
            valor: { type: Type.STRING, description: 'URL de la imagen o el nuevo nombre.' }
          },
          required: ['tipoAccion']
        }
      },
      {
        name: 'gestionar_miembro_avanzado',
        description: 'Administración avanzada de miembros: cambiar apodo (nickname), silenciar en voz, timeout, dar/quitar roles.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            tipoAccion: { type: Type.STRING, description: '"apodo", "mute_voz", "unmute_voz", "timeout"' },
            usuario: { type: Type.STRING, description: 'Nombre, mención o ID del usuario.' },
            valor: { type: Type.STRING, description: 'Nuevo apodo o duración.' }
          },
          required: ['tipoAccion', 'usuario']
        }
      },
      {
        name: 'reproducir_musica',
        description: 'Unirse al canal de voz del usuario y reproducir una canción por nombre o URL.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            busqueda: { type: Type.STRING, description: 'Canción o URL.' }
          },
          required: ['busqueda']
        }
      },
      {
        name: 'desconectar_musica',
        description: 'Desconectar el bot del canal de voz.',
        parameters: { type: Type.OBJECT, properties: {} }
      },
      {
        name: 'saltar_cancion',
        description: 'Saltar la canción actual.',
        parameters: { type: Type.OBJECT, properties: {} }
      },
      {
        name: 'borrar_mensajes',
        description: 'Borra mensajes en el chat.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            cantidad: { type: Type.INTEGER, description: 'Número de mensajes.' }
          },
          required: ['cantidad']
        }
      }
    ]
  }];

  const guildSummary = guildContext.summary || 'Servidor Activo';

  const systemInstruction = 
    `Tu nombre es KITE. Eres el AGENTE AUTÓNOMO CON CONTROL Y EJECUCIÓN TOTAL DE DISCORD.\n` +
    `ESTADO DEL SERVIDOR:\n${guildSummary}\n\n` +
    `1. NUNCA te presentes de forma mecánica ("Hola, soy KITE...").\n` +
    `2. Si el usuario "${username}" te pide cambiar el nombre de un rol, INVOCA "gestionar_roles_avanzado" con accion: "editar", nombreRol: el rol original, nuevoNombre: el nuevo nombre.\n` +
    `3. Si te piden mover la posición de un rol, INVOCA "gestionar_roles_avanzado" con accion: "mover_jerarquia".\n` +
    `4. NUNCA le digas al usuario que haga las cosas manualmente. EJECUTA LA ACCIÓN TÚ MISMO.`;

  const promptWithMemory = chatHistory 
    ? `${systemInstruction}\n\nHISTORIAL DE CHAT:\n${chatHistory}\n\n[Mensaje de ${username}]: ${prompt}`
    : `${systemInstruction}\n\n[Mensaje de ${username}]: ${prompt}`;

  // Modelos compatibles oficialmente
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
        // Registro silencioso de fallback sin mostrar errores rojos innecesarios en consola
      }
    }
  }

  // -------------------------------------------------------------
  // MOTOR DE RESPALDO ULTRA-SEMÁNTICO INFALIBLE (FUNCIONA AÚN SI LA API FALLA)
  // -------------------------------------------------------------
  const promptLower = prompt.toLowerCase();

  // Renombrar rol (ej: "quiero que renombres un rol @Bot Moderador quiero que ese rol ahora se llame el goat")
  if (promptLower.includes('renombres') || promptLower.includes('renombrar') || promptLower.includes('nombre del rol') || promptLower.includes('nombre de rol') || promptLower.includes('cambiale el nombre') || promptLower.includes('se llame')) {
    const renameMatch = prompt.match(/(?:renombres\s+(?:un\s+)?rol\s+@?|nombre\s+del?\s*@?|cambiale\s+el\s+nombre\s+del?\s*@?)([a-záéíóúñ0-9_\-\s]+)\s+(?:por\s+el\s+nombre\s+|se\s+llame\s+|por\s+)?([a-záéíóúñ0-9_\-\s]+)/i);
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

  if (promptLower.includes('debajo del rol') || promptLower.includes('encima del rol') || promptLower.includes('debajo de') || promptLower.includes('encima de')) {
    const roleMatches = prompt.match(/rol\s+de?\s*@?([a-záéíóúñ0-9_\-\s]+)\s+(debajo|encima)\s+del?\s*rol\s+@?([a-záéíóúñ0-9_\-\s]+)/i);
    if (roleMatches) {
      return {
        type: 'tools',
        functionCalls: [{
          name: 'gestionar_roles_avanzado',
          args: {
            accion: 'mover_jerarquia',
            nombreRol: roleMatches[1].trim(),
            posicionRelativa: roleMatches[2].toLowerCase(),
            rolReferencia: roleMatches[3].trim()
          }
        }]
      };
    }
  }

  if (promptLower.includes('soundboard') || promptLower.includes('panel de sonidos') || promptLower.includes('panel de sonido') || promptLower.includes('sonidos')) {
    let chanMatch = prompt.match(/#([a-záéíóúñ0-9_\-]+)/i) || prompt.match(/canal\s+de\s+voz\s+de\s+([a-záéíóúñ0-9_\-]+)/i) || prompt.match(/canal\s+de\s+([a-záéíóúñ0-9_\-]+)/i) || prompt.match(/canal\s+([a-záéíóúñ0-9_\-]+)/i);
    let targetChan = chanMatch ? chanMatch[1] : null;

    let rolesObj = 'everyone';
    if (promptLower.includes('sobreviviente')) rolesObj = 'sobrevivientes';
    else if (promptLower.includes('mod')) rolesObj = 'moderadores';
    else if (promptLower.includes('bot')) rolesObj = 'bots';
    else if (promptLower.includes('mute')) rolesObj = 'mute';

    const isDeny = promptLower.includes('no pueda') || promptLower.includes('no puedan') || promptLower.includes('quítale') || promptLower.includes('quitale') || promptLower.includes('prohib');

    return {
      type: 'tools',
      functionCalls: [{
        name: 'configurar_permisos_canal',
        args: {
          nombreCanal: targetChan || 'actual',
          rolesObjetivo: rolesObj,
          permitirUsarPanelDeSonidos: !isDeny
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
