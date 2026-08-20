require('dotenv').config();
const { analyzeEmergency } = require('./src/services/llm.service');

async function test() {
  console.log('API Key available:', !!process.env.GEMINI_API_KEY);
  const result = await analyzeEmergency("Medical: Severe car crash, bleeding heavily from the head.");
  console.log('Result:', result);
}
test();
