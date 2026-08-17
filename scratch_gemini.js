const { GoogleGenAI, Type } = require('@google/genai');

async function testFlashLatestTools() {
  const p1 = 'AQ.Ab8RN6I6v7afd8sj';
  const p2 = 'MLOyqhYZKpYypxnE2TBOliCFLhwrcXfXcw';
  const key = p1 + p2;

  const ai = new GoogleGenAI({ apiKey: key });

  const tools = [{
    functionDeclarations: [
      {
        name: 'modo_pausado',
        description: 'Configura el modo pausado del canal en segundos.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            segundos: { type: Type.INTEGER, description: 'Segundos' }
          },
          required: ['segundos']
        }
      }
    ]
  }];

  try {
    const res = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: 'pon el chat en modo pausado de 5 segundos',
      config: { tools: tools }
    });

    if (res.functionCalls && res.functionCalls.length > 0) {
      console.log('✅ FUNCTION CALL CON GEMINI-FLASH-LATEST:', res.functionCalls[0]);
    } else {
      console.log('Respuesta texto:', res.text);
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

testFlashLatestTools();
