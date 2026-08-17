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
        name: 'crear_editar_canal',
        description: 'Crea un nuevo canal de texto o voz, edita el tema/nombre de un canal o elimina un canal.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            accion: { type: Type.STRING, description: '"crear", "editar" o "eliminar"' },
            nombreCanal: { type: Type.STRING, description: 'Nombre del canal.' },
            tipoCanal: { type: Type.STRING, description: '"texto" o "voz"' },
            topic: { type: Type.STRING, description: 'Tema o descripción del canal.' }
          },
          required: ['accion', 'nombreCanal']
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
    `Tu nombre es KITE. Eres el Administrador y Reproductor de Música Agéntico Autónomo de Discord, con personalidad alegre, proactiva y cercana.\n` +
    `REGLAS OBLIGATORIAS:\n` +
    `1. NUNCA te presentes de forma mecánica (PROHIBIDO decir "Hola, soy KITE...").\n` +
    `2. Si el usuario "${username}" te pide reproducir música, desconectarse del canal de voz, saltar a la siguiente canción, o cualquier orden de administración (crear/editar/borrar roles, asignar/quitar roles, autorol, canales, modo pausado, borrar mensajes, banear/desbanear), EJECUTA LA FUNCIÓN CORRESPONDIENTE sin rodeos.\n` +
    `3. Si el usuario te hace una pregunta o habla contigo de forma normal, RESPONDE DE MANERA CONVERSACIONAL Y ALEGRE COMO UN AMIGO REAL.`;

  // Bucle de Conmutación Automática por 503 (Alta Demanda) o 429 (Cuota)
  const modelsToTry = [
    'gemini-flash-latest',
    'gemini-2.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.6-flash',
    'gemini-flash-lite-latest'
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
          return { type: 'tool', functionCall: response.functionCalls[0] };
        }

        if (response && response.text) {
          return { type: 'chat', text: response.text };
        }
      } catch (err) {
        console.log(`Modelo ${modelName} en alta demanda o límite (Error: ${err.message.substring(0, 60)}...), pasando al siguiente modelo del pool...`);
      }
    }
  }

  // Escudo de Respaldo Semántico
  const semantic = parseSemanticIntent(prompt, guildRoles);
  if (semantic.intent === 'STOP_MUSIC') {
    return { type: 'tool', functionCall: { name: 'desconectar_musica', args: {} } };
  }
  if (semantic.intent === 'SKIP_MUSIC') {
    return { type: 'tool', functionCall: { name: 'saltar_cancion', args: {} } };
  }
  if (semantic.intent === 'PLAY_MUSIC') {
    return { type: 'tool', functionCall: { name: 'reproducir_musica', args: { busqueda: semantic.query } } };
  }
  if (semantic.intent === 'SLOWMODE') {
    return { type: 'tool', functionCall: { name: 'modo_pausado', args: { segundos: semantic.seconds } } };
  }
  if (semantic.intent === 'UNRESTRICT_CHANNEL') {
    return { type: 'tool', functionCall: { name: 'restringir_canal', args: { desbloquear: true } } };
  }
  if (semantic.intent === 'RESTRICT_CHANNEL') {
    return { type: 'tool', functionCall: { name: 'restringir_canal', args: { desbloquear: false, nombreRol: semantic.role ? semantic.role.name : null } } };
  }
  if (semantic.intent === 'CLEAR_MESSAGES') {
    return { type: 'tool', functionCall: { name: 'borrar_mensajes', args: { cantidad: semantic.amount || 5 } } };
  }
  if (semantic.intent === 'BAN_USER') {
    return { type: 'tool', functionCall: { name: 'banear_usuario', args: { duracion: semantic.duration, razon: semantic.reason } } };
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
