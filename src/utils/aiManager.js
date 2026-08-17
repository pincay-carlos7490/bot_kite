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
    `Tu nombre es KITE. Eres un bot agéntico verdaderamente inteligente para Discord con personalidad alegre, cercana y respetuosa.\n` +
    `REGLAS OBLIGATORIAS:\n` +
    `1. NUNCA te presentes de forma mecánica (PROHIBIDO decir "Hola, soy KITE...").\n` +
    `2. Si el usuario "${username}" te pide ejecutar una acción (bloquear canal, desbloquear canal, modo pausado/lento, borrar mensajes, banear o desbanear), EJECUTA LA FUNCIÓN CORRESPONDIENTE sin rodeos.\n` +
    `3. Si el usuario te hace una pregunta o habla contigo de forma normal (por ejemplo "estas ahi?", "hola", "que haces"), RESPONDE DE MANERA CONVERSACIONAL Y ALEGRE COMO UN AMIGO REAL, sin usar plantillas fijas.`;

  // 1. Intentar con Gemini 2.5 Flash Agentic AI
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
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
      console.error('Error con Gemini Agentic Engine, usando respaldo:', err.message);
    }
  }

  // 2. Escudo de Respaldo Semántico para Moderación
  const semantic = parseSemanticIntent(prompt, guildRoles);
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
  if (semantic.intent === 'UNBAN_USER') {
    return { type: 'tool', functionCall: { name: 'desbanear_usuario', args: { razon: semantic.reason } } };
  }

  return { type: 'chat', text: `¡Hola ${username}! 😊 Sí, aquí estoy listo para ayudarte. ¿Qué necesitas?` };
}

async function askAI(prompt, username = 'Usuario') {
  const result = await processAgenticAI(prompt, username);
  return result.text || '¡Hola! 🍃 ¿En qué puedo ayudarte hoy?';
}

module.exports = {
  processAgenticAI,
  askAI,
};
