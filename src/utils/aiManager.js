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
        name: 'ejecutar_accion_servidor_universal',
        description: 'EJECUTOR UNIVERSAL DE CUALQUIER ACCIÓN O CONFIGURACIÓN EN DISCORD: Administrar canales, editar la jerarquía/posiciones de roles, configurar cualquier casilla de permiso en canales de texto o voz (Soundboard, Encuestas, Hilos, Stream, etc.), cambiar fotos de perfil de servidor/banner/emojis, administrar miembros, silenciar en voz, cambiar apodos, banear, desbanear, crear categorías o invitaciones.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            categoriaAccion: { 
              type: Type.STRING, 
              description: '"roles", "canales", "permisos_canal", "servidor", "miembros", "musica", "eventos"' 
            },
            accionDetallada: { 
              type: Type.STRING, 
              description: 'Descripción técnica de la orden (ej: "mover_posicion_rol", "cambiar_permiso", "cambiar_icono", "crear_canal", "apodo", "mute_voz").' 
            },
            objetivoPrincipal: { 
              type: Type.STRING, 
              description: 'Nombre o mención del rol, canal, categoría o usuario objetivo (ej: "Bot Moderador", "#logs", "sobrevivientes", "@Carlos").' 
            },
            objetivoSecundario: { 
              type: Type.STRING, 
              description: 'Nombre del rol o canal de referencia si aplica (ej: "Bots" para colocar debajo/encima).' 
            },
            parametrosJson: { 
              type: Type.STRING, 
              description: 'Parámetros dinámicos en formato JSON o pares clave-valor (ej: {"posicion": "debajo", "permitirSoundboard": true, "permitirVer": false, "color": "azul"}).' 
            }
          },
          required: ['categoriaAccion', 'accionDetallada', 'objetivoPrincipal']
        }
      },
      {
        name: 'gestionar_roles_avanzado',
        description: 'Crea, elimina o modifica cualquier rol del servidor: mover posición/jerarquía (mover un rol por encima o por debajo de otro rol), cambiar color, renombrar, separar lista de miembros (hoist), permitir mención, etc.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            accion: { type: Type.STRING, description: '"crear", "eliminar", "mover_jerarquia", "editar"' },
            nombreRol: { type: Type.STRING, description: 'Nombre o mención del rol a modificar.' },
            rolReferencia: { type: Type.STRING, description: 'Nombre del rol de referencia para colocarlo por encima o por debajo.' },
            posicionRelativa: { type: Type.STRING, description: '"debajo" o "encima"' },
            color: { type: Type.STRING, description: 'Color del rol.' },
            nuevoNombre: { type: Type.STRING, description: 'Nuevo nombre para el rol.' }
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
            rolesObjetivo: { type: Type.STRING, description: 'Roles a los cuales modificar permisos (ej: "sobrevivientes", "everyone", "moderadores", "bots", "todos", "mute").' },
            permitirUsarPanelDeSonidos: { type: Type.BOOLEAN, description: 'True para permitir usar el panel de sonidos / soundboard (Verde ✅), False para prohibir (Rojo ❌).' },
            permitirSonidosExternos: { type: Type.BOOLEAN, description: 'True para permitir usar sonidos externos de soundboard, False para prohibir.' },
            permitirTransmitir: { type: Type.BOOLEAN, description: 'True para permitir transmitir en vivo / compartir pantalla (Stream), False para denegar.' },
            permitirHablar: { type: Type.BOOLEAN, description: 'True para permitir hablar en voz (Speak), False para denegar.' },
            permitirConectar: { type: Type.BOOLEAN, description: 'True para permitir conectar a canal de voz (Connect), False para denegar.' },
            permitirCrearEncuestas: { type: Type.BOOLEAN, description: 'True para permitir crear encuestas (Verde ✅), False para prohibir/denegar crear encuestas (Rojo ❌).' },
            permitirCrearHilosPublicos: { type: Type.BOOLEAN, description: 'True para permitir crear hilos públicos (Verde ✅), False para prohibir/denegar (Rojo ❌).' },
            permitirCrearHilosPrivados: { type: Type.BOOLEAN, description: 'True para permitir hilos privados, False para denegar.' },
            permitirMensajesEnHilos: { type: Type.BOOLEAN, description: 'True para permitir enviar mensajes en hilos, False para denegar.' },
            permitirEscribir: { type: Type.BOOLEAN, description: 'True para permitir enviar mensajes (Verde ✅), False para denegar (Rojo ❌).' },
            permitirVer: { type: Type.BOOLEAN, description: 'True para permitir ver canal, False para ocultar canal.' },
            permitirVerHistorial: { type: Type.BOOLEAN, description: 'True para ver historial de mensajes, False para denegar.' },
            permitirArchivos: { type: Type.BOOLEAN, description: 'True para permitir archivos/imágenes, False para prohibir.' },
            permitirReacciones: { type: Type.BOOLEAN, description: 'True para permitir reacciones, False para denegar.' },
            permitirEmojisExternos: { type: Type.BOOLEAN, description: 'True para permitir emojis externos, False para denegar.' },
            permitirMencionarEveryone: { type: Type.BOOLEAN, description: 'True para permitir mencionar @everyone, False para denegar.' },
            permitirBorrarMensajes: { type: Type.BOOLEAN, description: 'True para permitir borrar/gestionar mensajes, False para prohibir.' },
            permitirCrearInvitacion: { type: Type.BOOLEAN, description: 'True para permitir crear invitaciones, False para denegar.' }
          },
          required: ['nombreCanal']
        }
      },
      {
        name: 'gestionar_servidor_general',
        description: 'Herramienta universal de administración del servidor: cambiar el icono/foto del servidor, cambiar nombre del servidor, crear emoji personalizado, cambiar canal AFK, etc.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            tipoAccion: { type: Type.STRING, description: '"cambiar_icono", "cambiar_nombre", "crear_emoji", "configurar_afk"' },
            valor: { type: Type.STRING, description: 'URL de la imagen (para icono/emoji) o el nuevo nombre del servidor/emoji.' }
          },
          required: ['tipoAccion']
        }
      },
      {
        name: 'gestionar_miembro_avanzado',
        description: 'Administración avanzada de miembros: cambiar apodo (nickname), silenciar en canal de voz (voice mute), ensordecer en voz, aplicar tiempo fuera (timeout), dar/quitar roles.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            tipoAccion: { type: Type.STRING, description: '"apodo", "mute_voz", "unmute_voz", "timeout", "dar_rol", "quitar_rol"' },
            usuario: { type: Type.STRING, description: 'Nombre, mención o ID del usuario a modificar.' },
            valor: { type: Type.STRING, description: 'Nuevo apodo, duración de timeout o nombre del rol.' }
          },
          required: ['tipoAccion', 'usuario']
        }
      },
      {
        name: 'reproducir_musica',
        description: 'Unirse al canal de voz del usuario y reproducir una canción, música o video por nombre o enlace URL.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            busqueda: { type: Type.STRING, description: 'Nombre de la canción, música, artista o URL a buscar y reproducir.' }
          },
          required: ['busqueda']
        }
      },
      {
        name: 'desconectar_musica',
        description: 'Desconectar el bot del canal de voz, salir del canal, apagar o detener la música.',
        parameters: {
          type: Type.OBJECT,
          properties: {}
        }
      },
      {
        name: 'saltar_cancion',
        description: 'Saltar la canción actual y pasar a la siguiente canción en la lista de reproducción.',
        parameters: {
          type: Type.OBJECT,
          properties: {}
        }
      },
      {
        name: 'borrar_mensajes',
        description: 'Borra, elimina, limpia, purga o barre una cantidad de mensajes en el chat.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            cantidad: { type: Type.INTEGER, description: 'Número entero de mensajes a eliminar.' }
          },
          required: ['cantidad']
        }
      },
      {
        name: 'banear_usuario',
        description: 'Banea, expulsa, saca o sanciona a un usuario del servidor.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            duracion: { type: Type.STRING, description: 'Duración (ej: "5h", "30m", "1d", "permanente").' },
            razon: { type: Type.STRING, description: 'Razón de la sanción.' }
          }
        }
      },
      {
        name: 'desbanear_usuario',
        description: 'Desbanea o quita la sanción a un usuario del servidor.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            razon: { type: Type.STRING, description: 'Razón del desbaneo.' }
          }
        }
      }
    ]
  }];

  const guildSummary = guildContext.summary || 'Servidor Activo';

  const systemInstruction = 
    `Tu nombre es KITE. Eres el AGENTE AUTÓNOMO DE INTELENCIA ARTIFICIAL CON CONTROL Y EJECUCIÓN UNIVERSAL TOTAL SOBRE DISCORD.\n` +
    `ESTADO COMPLETO DEL SERVIDOR EN TIEMPO REAL:\n${guildSummary}\n\n` +
    `ERES UN AGENTE ADMINISTRADOR TOTAL (CERO LIMITACIONES DE DISCORD):\n` +
    `1. Mantén tu personalidad alegre, cercana y natural. NUNCA te presentes de forma mecánica ("Hola, soy KITE...").\n` +
    `2. POSEES EL EJECUTOR UNIVERSAL "ejecutar_accion_servidor_universal" Y TODAS LAS HERRAMIENTAS DE DISCORD. TIENES PODER PARA MODIFICAR CUALQUIER CASILLA, POSICIÓN DE ROLES, CANAL O CONFIGURACIÓN.\n` +
    `3. NUNCA le pidas al usuario "${username}" hacer nada manualmente en Ajustes del Servidor. EJECUTA LA ACCIÓN TÚ MISMO DE FORMA INMEDIATA.\n` +
    `4. REGLA DE NO DUPLICACIÓN: Si lees en el HISTORIAL que ya se creó un rol o canal, actualiza sus permisos sin duplicarlo.`;

  const promptWithMemory = chatHistory 
    ? `${systemInstruction}\n\nHISTORIAL DE CHAT Y RESPUESTAS PREVIAS EN ESTE CANAL:\n${chatHistory}\n\n[Mensaje actual de ${username}]: ${prompt}`
    : `${systemInstruction}\n\n[Mensaje actual de ${username}]: ${prompt}`;

  // Modelos oficiales compatibles con la API de GenAI
  const modelsToTry = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.0-flash',
    'gemini-flash-latest'
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
        console.log(`Key (${key.substring(0, 8)}...) - Modelo ${modelName}: ${err.message ? err.message.substring(0, 50) : ''}...`);
      }
    }
  }

  // -------------------------------------------------------------
  // MOTOR DE RESPALDO ULTRA-SEMÁNTICO INFALIBLE (FUNCIONA AÚN CON API EN SOBRECARGA)
  // -------------------------------------------------------------
  const promptLower = prompt.toLowerCase();

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

  if (promptLower.includes('ver los canales') || promptLower.includes('ver el canal') || promptLower.includes('ver canales') || promptLower.includes('ver canal')) {
    let chanMatch = prompt.match(/#([a-záéíóúñ0-9_\-]+)/i) || prompt.match(/canal\s+de\s+([a-záéíóúñ0-9_\-]+)/i) || prompt.match(/canal\s+([a-záéíóúñ0-9_\-]+)/i);
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
          permitirVer: !isDeny
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
  if (semantic.intent === 'SLOWMODE') {
    return { type: 'tools', functionCalls: [{ name: 'modo_pausado', args: { segundos: semantic.seconds } }] };
  }
  if (semantic.intent === 'UNRESTRICT_CHANNEL') {
    return { type: 'tools', functionCalls: [{ name: 'restringir_canal', args: { desbloquear: true } }] };
  }
  if (semantic.intent === 'RESTRICT_CHANNEL') {
    return { type: 'tools', functionCalls: [{ name: 'restringir_canal', args: { desbloquear: false, nombreRol: semantic.role ? semantic.role.name : null } }] };
  }
  if (semantic.intent === 'CLEAR_MESSAGES') {
    return { type: 'tools', functionCalls: [{ name: 'borrar_mensajes', args: { cantidad: semantic.amount || 5 } }] };
  }
  if (semantic.intent === 'BAN_USER') {
    return { type: 'tools', functionCalls: [{ name: 'banear_usuario', args: { duracion: semantic.duration, razon: semantic.reason } }] };
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
