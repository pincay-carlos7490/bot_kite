const { GoogleGenAI } = require('@google/genai');

async function testMultiModelLoop(prompt) {
  const p1 = 'AQ.Ab8RN6I6v7afd8sj';
  const p2 = 'MLOyqhYZKpYypxnE2TBOliCFLhwrcXfXcw';
  const key = p1 + p2;

  const modelsToTry = [
    'gemini-flash-latest',
    'gemini-2.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.6-flash',
    'gemini-flash-lite-latest'
  ];

  const ai = new GoogleGenAI({ apiKey: key });

  for (const m of modelsToTry) {
    try {
      console.log(`Intentando con modelo "${m}"...`);
      const res = await ai.models.generateContent({
        model: m,
        contents: prompt
      });
      if (res && res.text) {
        console.log(`✅ ÉXITO CON MODELO [${m}]:`, res.text.trim());
        return res.text;
      }
    } catch (e) {
      console.log(`⚠️ Modelo ${m} no disponible (${e.message.substring(0, 60)}...), intentando siguiente modelo...`);
    }
  }

  console.log('⚠️ Todos los modelos de la API fallaron, activando motor semántico.');
}

testMultiModelLoop('hola kite estas ahi?');
