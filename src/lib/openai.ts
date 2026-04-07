import OpenAI from 'openai';

let instance: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!instance) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('Trūksta OPENAI_API_KEY aplinkos kintamojo');
    }
    instance = new OpenAI({ apiKey });
  }
  return instance;
}
