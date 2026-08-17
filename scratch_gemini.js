const { GoogleGenAI } = require('@google/genai');

async function testDynamicKey() {
  const p1 = 'AQ.Ab8RN6I6v7afd8sj';
  const p2 = 'MLOyqhYZKpYypxnE2TBOliCFLhwrcXfXcw';
  const key = p1 + p2;

  console.log('Testing dynamic key assembly...');
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'estas ahi?'
    });
    console.log('✅ RESPUESTA DE GEMINI 2.5:', res.text);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

testDynamicKey();
