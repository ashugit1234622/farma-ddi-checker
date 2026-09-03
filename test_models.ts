import { GoogleGenAI } from "@google/genai";
import * as dotenv from 'dotenv';
dotenv.config();

const key = process.env.GEMINI_API_KEY_SECONDARY;

async function testModels() {
  if (!key) return console.error("No secondary key found");
  
  const modelsToTest = [
    "gemini-1.5-pro",
    "gemini-2.5-pro",
    "gemini-3.0-flash",
    "gemini-3.5-flash"
  ];
  
  const ai = new GoogleGenAI({ apiKey: key });

  for (const model of modelsToTest) {
    console.log(`\nTesting ${model}...`);
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: "Hello",
      });
      console.log(`SUCCESS on ${model}:`, response.text);
    } catch (e: any) {
      console.log(`FAILED on ${model}:`, e.message);
    }
  }
}

testModels();
