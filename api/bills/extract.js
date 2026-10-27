import { handleBillExtractApi } from '../billExtractHandler.js';

export default async function handler(req, res) {
  const geminiKey = process.env.GEMINI_API_KEY || '';
  const anthropicKey = process.env.ANTHROPIC_API_KEY || '';
  return handleBillExtractApi(req, res, { geminiKey, anthropicKey });
}
