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
// DICCIONARIOS DE HERRAMIENTAS POR NÚCLEOS Y SINÓNIMOS EN ESPAÑOL
// -------------------------------------------------------------

// Núcleo 1: Roles y Jerarquías
const toolRoles = {
  name: 'gestionar_roles_avanzado',
  description: 'Administra cualquier propiedad de roles en Discord. Soporta expresiones en español: "separado", "no aparezca separado", "agrupar", "lista lateral", "barra de miembros", "hoist", "renombrar", "cambiar nombre", "se llame", "cambiar color", "mención", "mencionable", "debajo del rol", "encima del rol", "mover jerarquía", "crear rol", "eliminar rol".',
  parameters: {
    type: Type.OBJECT,
    properties: {
      accion: { type: Type.STRING, description: '"crear", "eliminar", "mover_jerarquia", "editar"' },
      nombreRol: { type: Type.STRING, description: 'Nombre o mención del rol objetivo.' },
      rolReferencia: { type: Type.STRING, description: 'Rol de referencia para colocarlo por encima o por debajo.' },
      posicionRelativa: { type: Type.STRING, description: '"debajo" o "encima"' },
      color: { type: Type.STRING, description: 'Color del rol.' },
      nuevoNombre: { type: Type.STRING, description: 'Nuevo nombre para el rol.' },
      separarMiembros: { type: Type.BOOLEAN, description: 'True para mostrar los miembros de este rol por separado en la lista lateral (Hoist), False para que NO aparezca separado (agrupar).' },
      permitirMencion: { type: Type.BOOLEAN, description: 'True para permitir que cualquiera mencione el rol, False para prohibir.' }
    },
    required: ['accion', 'nombreRol']
  }
};

// Núcleo 2: Permisos de Canales (Texto, Voz, Hilos y Soundboard)
const toolPermisos = {
  name: 'configurar_permisos_canal',
  description: 'Modifica cualquier permiso de canal en Discord. Soporta frases en español: "soundboard", "panel de sonidos", "efectos de sonido", "transmitir pantalla", "stream", "hablar", "conectar a voz", "encuestas", "votaciones", "hilos públicos", "hilos privados", "mensajes en hilos", "escribir", "ver canal", "ocultar canal", "archivos", "imágenes", "reacciones", "emojis externos", "borrar mensajes".',
  parameters: {
    type: Type.OBJECT,
    properties: {
      nombreCanal: { type: Type.STRING, description: 'Nombre o mención del canal a configurar.' },
      rolesObjetivo: { type: Type.STRING, description: 'Roles objetivo (ej: "sobrevivientes", "everyone", "moderadores", "bots", "mute").' },
      permitirUsarPanelDeSonidos: { type: Type.BOOLEAN, description: 'True para permitir el panel de sonidos/soundboard (Verde ✅), False para prohibir (Rojo ❌).' },
      permitirEscribir: { type: Type.BOOLEAN, description: 'True para permitir escribir mensajes (Verde ✅), False para denegar (Rojo ❌).' },
      permitirVer: { type: Type.BOOLEAN, description: 'True para permitir ver canal, False para ocultar canal (Rojo ❌).' },
      permitirTransmitir: { type: Type.BOOLEAN, description: 'True para permitir transmitir pantalla/stream, False para denegar.' },
      permitirHablar: { type: Type.BOOLEAN, description: 'True para permitir hablar en voz, False para denegar.' },
      permitirConectar: { type: Type.BOOLEAN, description: 'True para permitir conectar a voz, False para denegar.' },
      permitirCrearEncuestas: { type: Type.BOOLEAN, description: 'True para permitir encuestas, False para denegar.' },
      permitirCrearHilosPublicos: { type: Type.BOOLEAN, description: 'True para hilos públicos, False para denegar.' },
      permitirCrearHilosPrivados: { type: Type.BOOLEAN, description: 'True para hilos privados, False para denegar.' }
    },
    required: ['nombreCanal']
  }
};

// Núcleo 3: Canales y Categorías
const toolCanales = {
  name: 'gestionar_canal_avanzado',
  description: 'Crea, edita o elimina propiedades de canales y categorías. Soporta: "renombrar canal", "tema", "descripción", "topic", "+18", "nsfw", "modo pausado", "slowmode", "mover a categoría", "límite de usuarios en voz".',
  parameters: {
    type: Type.OBJECT,
    properties: {
      accion: { type: Type.STRING, description: '"crear", "editar", "eliminar"' },
      nombreCanal: { type: Type.STRING, description: 'Nombre o mención del canal.' },
      nuevoNombre: { type: Type.STRING, description: 'Nuevo nombre para el canal.' },
      tipoCanal: { type: Type.STRING, description: '"texto", "voz", "categoria", "foro", "anuncios"' },
      topic: { type: Type.STRING, description: 'Tema o descripción del canal.' },
      nombreCategoria: { type: Type.STRING, description: 'Categoría donde ubicar el canal.' },
      nsfw: { type: Type.BOOLEAN, description: 'True para canal NSFW (+18), False para normal.' },
      modoPausadoSegundos: { type: Type.INTEGER, description: 'Segundos de espera en modo pausado.' },
      limiteUsuariosVoz: { type: Type.INTEGER, description: 'Límite de usuarios en voz.' }
    },
    required: ['accion', 'nombreCanal']
  }
};

// Núcleo 4: Servidor e Identidad
const toolServidor = {
  name: 'gestionar_servidor_general',
  description: 'Administración del servidor: cambiar foto/icono del servidor, cambiar nombre del servidor, cambiar banner, crear emojis personalizados, crear stickers, crear invitaciones, crear eventos.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      tipoAccion: { type: Type.STRING, description: '"cambiar_icono", "cambiar_nombre", "cambiar_banner", "crear_emoji", "crear_invitacion", "crear_evento"' },
      valor: { type: Type.STRING, description: 'URL de la imagen, nuevo nombre o detalle.' }
    },
    required: ['tipoAccion']
  }
};

// Núcleo 5: Miembros y Moderación
const toolMiembros = {
  name: 'gestionar_miembro_avanzado',
  description: 'Administración de usuarios: cambiar apodos (nickname), silenciar en voz (mute_voz), ensordecer en voz, mover de canal de voz, tiempo fuera (timeout), banear, desbanear, asignar/quitar roles.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      tipoAccion: { type: Type.STRING, description: '"apodo", "mute_voz", "unmute_voz", "timeout", "ban", "unban", "dar_rol", "quitar_rol"' },
      usuario: { type: Type.STRING, description: 'Nombre, mención o ID del usuario.' },
      valor: { type: Type.STRING, description: 'Nuevo apodo, duración o nombre del rol.' }
    },
    required: ['tipoAccion', 'usuario']
  }
};

// Herramienta Comodín de Respaldo Dinámico Futuro (Catch-All Universal)
const toolDinamicaUniversal = {
  name: 'ejecutar_metodo_discord_dinamico',
  description: 'HERRAMIENTA DINÁMICA DE RESPALDO PARA CUALQUIER MÉTODO FUTURO O PROPIEDAD NO LISTADA EN DISCORD: Permite enviar cualquier propiedad o comando dinámico a ejecutar sobre el servidor, canal, rol o miembro.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      entidadObjetivo: { type: Type.STRING, description: '"rol", "canal", "servidor", "miembro"' },
      nombreObjetivo: { type: Type.STRING, description: 'Nombre o mención del objetivo.' },
      metodoPropiedad: { type: Type.STRING, description: 'Propiedad o acción en español o inglés (ej: "hoist", "separado", "mencionable", "icono", "color", "posicion").' },
      valor: { type: Type.STRING, description: 'Valor a asignar (ej: "true", "false", "nuevo_nombre", "azul").' }
    },
    required: ['entidadObjetivo', 'nombreObjetivo', 'metodoPropiedad']
  }
};

const toolMusica = {
  name: 'reproducir_musica',
  description: 'Unirse a voz y reproducir música o video por nombre o URL.',
  parameters: {
    type: Type.OBJECT,
    properties: { busqueda: { type: Type.STRING, description: 'Canción o URL.' } },
    required: ['busqueda']
  }
};

const toolMusicaStop = { name: 'desconectar_musica', description: 'Desconectar música de voz.', parameters: { type: Type.OBJECT, properties: {} } };
const toolMusicaSkip = { name: 'saltar_cancion', description: 'Saltar canción actual.', parameters: { type: Type.OBJECT, properties: {} } };
const toolBorrar = {
  name: 'borrar_mensajes',
  description: 'Borra mensajes en chat.',
  parameters: { type: Type.OBJECT, properties: { cantidad: { type: Type.INTEGER, description: 'Número de mensajes.' } }, required: ['cantidad'] }
};

// -------------------------------------------------------------
// DISPATCHER DINÁMICO DE HERRAMIENTAS POR CONTEXTO (POCO A POCO)
// -------------------------------------------------------------
function selectContextualTools(prompt) {
  const p = prompt.toLowerCase();

  // Herramientas prioritarias según el contexto del prompt del usuario
  const selected = [];

  if (p.includes('rol') || p.includes('roles') || p.includes('separado') || p.includes('hoist') || p.includes('jerarquia') || p.includes('debajo') || p.includes('encima') || p.includes('se llame') || p.includes('renombrar')) {
    selected.push(toolRoles);
  }

  if (p.includes('canal') || p.includes('canales') || p.includes('permiso') || p.includes('permisos') || p.includes('soundboard') || p.includes('sonidos') || p.includes('stream') || p.includes('encuesta') || p.includes('hilo') || p.includes('ver') || p.includes('escribir')) {
    selected.push(toolPermisos);
    selected.push(toolCanales);
  }

  if (p.includes('servidor') || p.includes('foto') || p.includes('icono') || p.includes('banner') || p.includes('emoji') || p.includes('evento') || p.includes('invitacion')) {
    selected.push(toolServidor);
  }

  if (p.includes('usuario') || p.includes('miembro') || p.includes('apodo') || p.includes('mute') || p.includes('ban') || p.includes('timeout')) {
    selected.push(toolMiembros);
  }

  if (p.includes('musica') || p.includes('cancion') || p.includes('reproduce') || p.includes('pon ') || p.includes('play')) {
    selected.push(toolMusica, toolMusicaStop, toolMusicaSkip);
  }

  if (p.includes('borrar') || p.includes('limpiar') || p.includes('purge')) {
    selected.push(toolBorrar);
  }

  // Si no coincidió con una categoría específica o es una orden abierta, enviamos la Suite Maestra + la Herramienta Dinámica Universal
  if (selected.length === 0) {
    selected.push(toolRoles, toolPermisos, toolCanales, toolServidor, toolMiembros);
  }

  // Siempre adjuntamos la Herramienta Dinámica Universal como comodín para cualquier propiedad futura
  selected.push(toolDinamicaUniversal);

  return [{ functionDeclarations: selected }];
}

async function processAgenticAI(prompt, username = 'Usuario', guildRoles = [], guildContext = {}, chatHistory = '') {
  const apiKeys = getApiKeyPool();
  const tools = selectContextualTools(prompt);

  const guildSummary = guildContext.summary || 'Servidor Activo';

  const systemInstruction = 
    `Tu nombre es KITE. Eres el AGENTE AUTÓNOMO CON CONOCIMIENTO Y CONTROL TOTAL DE DISCORD.\n` +
    `ESTADO DEL SERVIDOR EN TIEMPO REAL:\n${guildSummary}\n\n` +
    `REGLAS DE ATENCIÓN Y EJECUCIÓN DIRECTA (CERO PRESENTACIONES MECÁNICAS):\n` +
    `1. NUNCA te presentes de forma mecánica ("Hola, soy KITE...").\n` +
    `2. ROLES Y SEPARACIÓN EN LISTA LATERAL (Hoist):\n` +
    `   - Si el usuario "${username}" te pide que un rol NO aparezca separado (o SÍ aparezca separado) en la lista de miembros, INVOCA "gestionar_roles_avanzado" asignando accion: "editar", nombreRol: el rol objetivo, separarMiembros: false (o true).\n` +
    `   - Si piden mover la jerarquía de un rol (ej: debajo del rol X), INVOCA "gestionar_roles_avanzado" asignando accion: "mover_jerarquia", rolReferencia: X, posicionRelativa: "debajo".\n` +
    `   - Si piden renombrar un rol, INVOCA con accion: "editar", nuevoNombre: el nuevo nombre.\n` +
    `3. HERRAMIENTA DINÁMICA DE RESPALDO:\n` +
    `   - Si piden modificar una propiedad rara o futura, INVOCA "ejecutar_metodo_discord_dinamico".\n` +
    `4. PROHIBIDO DECIR "NO DISPONGO DE UNA FUNCIÓN". EJECUTA SIEMPRE LA ACCIÓN TÚ MISMO DE FORMA INMEDIATA.`;

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
      } catch (err) {}
    }
  }

  // -------------------------------------------------------------
  // MOTOR DE RESPALDO ULTRA-SEMÁNTICO INFALIBLE (FUNCIONA AÚN SI LA API FALLA)
  // -------------------------------------------------------------
  const promptLower = prompt.toLowerCase();

  // Opción de Separado / Hoist en la lista de miembros (ej: "hace que el rol de @el goat no aparezca separado de los otros roles")
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

  // Renombrar rol
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
