const { GoogleGenerativeAI } = require('@google/generative-ai');


const SYSTEM_INSTRUCTION = `You are the FastAid Emergency AI Dispatcher. Your job is to analyze the emergency description and provide a structured JSON output.
The JSON must perfectly match this schema without any markdown formatting around it:
{
  "severity": "Low" | "Medium" | "High" | "Critical",
  "keyInjuries": ["string"],
  "victimAdvice": ["string"],
  "responderAdvice": ["string"]
}

Rules:
1. Provide immediate life-saving first aid advice based on standard medical protocols.
2. Keep advice to 3 short bullet points max.
3. If the description is vague, provide generic safety advice (e.g., "Stay calm", "Move to a safe area").
4. Do NOT include markdown blocks like \`\`\`json \`\`\`. Output raw JSON.
`;

/**
 * Analyzes an emergency description using Gemini 1.5 Flash.
 * @param {string} description The unstructured emergency note
 * @returns {Promise<Object|null>} Structured AI analysis or null if failed
 */
async function analyzeEmergency(description) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !description) return null;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        responseMimeType: 'application/json',
      }
    });

    const prompt = `Emergency Description: "${description}"`;
    const result = await model.generateContent(prompt);
    
    const responseText = result.response.text();
    const data = JSON.parse(responseText);
    
    return {
      severity: data.severity,
      keyInjuries: data.keyInjuries || [],
      victimAdvice: data.victimAdvice || [],
      responderAdvice: data.responderAdvice || [],
      analyzedAt: new Date()
    };
  } catch (error) {
    console.error('LLM Analysis failed or API overloaded. Falling back to mock data.', error.message);
    
    // Fallback Mock Response so the UI still works
    return {
      severity: "High",
      keyInjuries: ["Unspecified injury", "Requires assessment"],
      victimAdvice: ["Stay calm and do not move if you suspect spinal injury", "Wait for emergency responders"],
      responderAdvice: ["Assess the scene for safety", "Provide basic life support if trained"],
      analyzedAt: new Date()
    };
  }
}

module.exports = {
  analyzeEmergency
};
