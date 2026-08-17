const { GoogleGenAI, Type } = require('@google/genai');

async function processAgenticAI(prompt, username = 'Usuario') {
  const apiKey = process.env.GEMINI_API_KEY;

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
    `2. Si el usuario "${username}" te pide ejecutar una acción (bloquear canal, desbloquear canal, borrar mensajes, banear o desbanear), EJECUTA LA FUNCIÓN CORRESPONDIENTE sin rodeos.\n` +
    `3. Si el usuario te hace una pregunta o habla contigo de forma normal, responde alegremente como un amigo sin llamar funciones.`;

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
      console.error('Error con Gemini Agentic Engine:', err.message);
    }
  }

  return { type: 'chat', text: `¡Hola ${username}! 🍃 Dime en qué te puedo ayudar o qué quieres hacer en el servidor.` };
}

async function askAI(prompt, username = 'Usuario') {
  const result = await processAgenticAI(prompt, username);
  return result.text || '¡Hola! 🍃 ¿En qué puedo ayudarte hoy?';
}

module.exports = {
  processAgenticAI,
  askAI,
};
