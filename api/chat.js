import { handleGroqApi, DEFAULT_GROQ_MODEL } from './groqHandler.js';

export default async function handler(req, res) {
  const apiKey = process.env.GROQ_API_KEY || '';
  const model = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
  return handleGroqApi(req, res, apiKey, model);
}
