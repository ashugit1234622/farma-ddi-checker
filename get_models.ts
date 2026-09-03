import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
dotenv.config();

async function getModels() {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }
    });
    const data = await res.json();
    console.log(data.data.map((m: any) => m.id).join('\n'));
  } catch (e) {
    console.error(e);
  }
}
getModels();
