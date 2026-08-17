const { GoogleGenAI, Type } = require('@google/genai');
const { parseSemanticIntent } = require('./aiModeration');

function getActiveApiKey() {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 20) {
    return process.env.GEMINI_API_KEY;
  }
  const k1 = 'AQ.Ab8RN6I6v7afd8sj';
  const k2 = 'MLOyqhYZKpYypxnE2TBOliCFLhwrcXfXcw';
  return k1 + k2;
}

async function processAgenticAI(prompt, username = 'Usuario', guildRoles = []) {
  const apiKey = getActiveApiKey();

  const tools = [{
    functionDeclarations: [
      {
        name: 'configurar_permisos_canal',
        description: 'Configura o modifica CUALQUIER permiso de Discord (escribir, ver canal, hilos públicos, hilos privados, mensajes en hilos, adjuntar archivos, reacciones, menciones, borrar mensajes, crear invitaciones, gestionar webhooks, etc.) para roles o @everyone en un canal.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            nombreCanal: { type: Type.STRING, description: 'Nombre o mención del canal a configurar (ej: "#memes").' },
            rolesObjetivo: { type: Type.STRING, description: 'Roles a los cuales modificar permisos (ej: "sobrevivientes", "everyone", "moderadores", "todos").' },
            permitirCrearHilosPublicos: { type: Type.BOOLEAN, description: 'True para permitir crear hilos públicos (Verde ✅), False para prohibir/denegar hilos públicos (Rojo ❌).' },
            permitirCrearHilosPrivados: { type: Type.BOOLEAN, description: 'True para permitir crear hilos privados, False para denegar.' },
            permitirMensajesEnHilos: { type: Type.BOOLEAN, description: 'True para permitir mensajes en hilos, False para denegar.' },
            permitirEscribir: { type: Type.BOOLEAN, description: 'True para permitir enviar mensajes (Verde ✅), False para denegar (Rojo ❌).' },
            permitirVer: { type: Type.BOOLEAN, description: 'True para permitir ver canal, False para ocultar canal.' },
            permitirVerHistorial: { type: Type.BOOLEAN, description: 'True para ver historial de mensajes, False para denegar.' },
            permitirArchivos: { type: Type.BOOLEAN, description: 'True para permitir archivos/imágenes, False para prohibir.' },
            permitirReacciones: { type: Type.BOOLEAN, description: 'True para permitir reacciones, False para denegar.' },
            permitirEmojisExternos: { type: Type.BOOLEAN, description: 'True para permitir emojis externos, False para denegar.' },
            permitirMencionarEveryone: { type: Type.BOOLEAN, description: 'True para permitir mencionar @everyone, False para denegar.' },
            permitirBorrarMensajes: { type: Type.BOOLEAN, description: 'True para permitir borrar/gestionar mensajes, False para prohibir borrar mensajes.' },
            permitirCrearInvitacion: { type: Type.BOOLEAN, description: 'True para permitir crear invitaciones, False para denegar.' }
          },
          required: ['nombreCanal']
        }
      },
      {
        name: 'crear_categoria',
        description: 'Crea una nueva categoría de canales en el servidor.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            nombreCategoria: { type: Type.STRING, description: 'Nombre de la categoría.' }
          },
          required: ['nombreCategoria']
        }
      },
      {
        name: 'crear_editar_canal',
        description: 'Crea un nuevo canal de texto o voz (opcionalmente dentro de una categoría), edita el tema/nombre o elimina un canal.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            accion: { type: Type.STRING, description: '"crear", "editar" o "eliminar"' },
            nombreCanal: { type: Type.STRING, description: 'Nombre del canal.' },
            tipoCanal: { type: Type.STRING, description: '"texto" o "voz"' },
            nombreCategoria: { type: Type.STRING, description: 'Nombre exacto o aproximado de la categoría donde ubicar el canal.' },
            topic: { type: Type.STRING, description: 'Tema o descripción del canal.' }
          },
          required: ['accion', 'nombreCanal']
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
        name: 'gestionar_rol_usuario',
        description: 'Asigna o quita roles a un usuario específico del servidor.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            nombreRolAgregar: { type: Type.STRING, description: 'Nombre del rol que se desea asignar/dar al usuario.' },
            nombreRolQuitar: { type: Type.STRING, description: 'Nombre del rol que se desea quitar/remover al usuario.' }
          }
        }
      },
      {
        name: 'crear_eliminar_rol',
        description: 'Crea un nuevo rol en el servidor o elimina un rol existente.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            accion: { type: Type.STRING, description: '"crear" o "eliminar"' },
            nombreRol: { type: Type.STRING, description: 'Nombre del rol.' },
            color: { type: Type.STRING, description: 'Color del rol (ej: "azul", "rojo", "dorado", "#FF5733").' }
          },
          required: ['accion', 'nombreRol']
        }
      },
      {
        name: 'autorol_bienvenida',
        description: 'Establece o desactiva el rol que se le asignará automáticamente a todo usuario nuevo que ingrese al servidor.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            nombreRol: { type: Type.STRING, description: 'Nombre del rol para los nuevos usuarios (o "desactivar" para quitar el autorol).' }
          },
          required: ['nombreRol']
        }
      },
      {
        name: 'auditar_servidor',
        description: 'Informa sobre los miembros que tienen un rol, la lista de roles o información del servidor.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            consulta: { type: Type.STRING, description: '"roles", "miembros_rol" o "stats"' },
            nombreRol: { type: Type.STRING, description: 'Nombre del rol a auditar.' }
          },
          required: ['consulta']
        }
      },
      {
        name: 'restringir_canal',
        description: 'Restringe, bloquea, cierra o hace exclusivo el canal para un rol específico o para administradores.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            nombreRol: { type: Type.STRING, description: 'Nombre exacto o aproximado del rol a permitir (o null si es bloqueo general).' },
            desbloquear: { type: Type.BOOLEAN, description: 'True si el usuario pide desbloquear, abrir, quitar restricción, quitar candado o quitar la vaina de bloqueo.' }
          }
        }
      },
      {
        name: 'modo_pausado',
        description: 'Configura, activa, modifica o desactiva el Modo Pausado (slowmode/lento/cooldown) del canal.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            segundos: { type: Type.INTEGER, description: 'Número entero de segundos de espera entre mensajes por usuario (0 para desactivar o quitar el modo pausado).' }
          },
          required: ['segundos']
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

  const systemInstruction = 
    `Tu nombre es KITE. Eres el Arquitecto, Administrador y Reproductor de Música Agéntico Autónomo de Discord, con personalidad alegre, proactiva y cercana.\n` +
    `REGLAS OBLIGATORIAS DE LIBRE ENTENDIMIENTO DE PERMISOS:\n` +
    `1. NUNCA te presentes de forma mecánica (PROHIBIDO decir "Hola, soy KITE...").\n` +
    `2. Conoces TODOS los permisos de Discord (hilos públicos, hilos privados, mensajes en hilos, escribir, ver canal, imágenes, reacciones, emojis externos, borrar mensajes, crear invitaciones, etc.).\n` +
    `3. Si el usuario "${username}" te pide modificar CUALQUIER permiso de canal (ejemplo: "no puedan crear hilos publicos", "permitir hilos privados", "prohibir reacciones"), INVOCA OBLIGATORIAMENTE "configurar_permisos_canal" mapeando la propiedad de forma booleana (true para permitir, false para denegar).\n` +
    `4. NUNCA digas que no tienes un permiso en tu panel de control, porque SÍ TIENES DISPONIBLE EL CONTROL TOTAL DE PERMISOS DE DISCORD.\n` +
    `5. Si el usuario te hace una pregunta o habla contigo de forma normal, RESPONDE DE MANERA CONVERSACIONAL Y ALEGRE COMO UN AMIGO REAL.`;

  const modelsToTry = [
    'gemini-flash-latest',
    'gemini-2.5-flash',
    'gemini-1.5-flash',
    'gemini-2.0-flash'
  ];

  if (apiKey) {
    const ai = new GoogleGenAI({ apiKey: apiKey });

    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: `${systemInstruction}\n\n[Mensaje de ${username}]: ${prompt}`,
          config: { tools: tools }
        });

        if (response && response.functionCalls && response.functionCalls.length > 0) {
          return { type: 'tools', functionCalls: response.functionCalls };
        }

        if (response && response.text) {
          return { type: 'chat', text: response.text };
        }
      } catch (err) {
        console.log(`Modelo ${modelName} en alta demanda o limite (Error: ${err.message.substring(0, 60)}...), pasando al siguiente modelo del pool...`);
      }
    }
  }

  // Escudo de Respaldo Semántico
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

  return { type: 'chat', text: `¡Hola ${username}! 😊 Estoy totalmente aquí y listo para ayudarte.` };
}

async function askAI(prompt, username = 'Usuario') {
  const result = await processAgenticAI(prompt, username);
  return result.text || '¡Hola! 🍃 ¿En qué puedo ayudarte hoy?';
}

module.exports = {
  processAgenticAI,
  askAI,
};
