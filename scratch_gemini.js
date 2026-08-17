const { GoogleGenAI, Type } = require('@google/genai');
require('dotenv').config();

async function testCurrentSetup() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('Testing process.env.GEMINI_API_KEY:', apiKey ? apiKey.substring(0, 10) + '...' : 'NULL');

  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY no está configurada en .env!');
    return;
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });

  const tools = [{
    functionDeclarations: [
      {
        name: 'modo_pausado',
        description: 'Configura, activa, modifica o desactiva el Modo Pausado del canal.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            segundos: { type: Type.INTEGER, description: 'Número de segundos.' }
          },
          required: ['segundos']
        }
      }
    ]
  }];

  try {
    console.log('Enviando mensaje a Gemini 2.5...');
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'pon el chat en modo pausado de 5 segundos',
      config: { tools: tools }
    });

    console.log('Respuesta de Gemini:', JSON.stringify(response));
  } catch (err) {
    console.error('❌ ERROR AL LLAMAR A GEMINI:', err.message);
  }
}

testCurrentSetup();
