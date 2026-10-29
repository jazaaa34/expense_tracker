// ==============================================================================
// BACKEND GROQ API HANDLER - WALLETWEATHER WEB
// Secure server-side proxy for Groq API with AUTOMATIC MODEL FAILOVER.
// Seamlessly rotates models upon rate-limit (429) or token limits without showing symbols or errors.
// ==============================================================================

// Ordered list of models to try in sequence upon rate limits or errors
export const GROQ_MODEL_CASCADE = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b'
];

export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';

export const SUPPORTED_GROQ_MODELS = [
  { id: 'openai/gpt-oss-120b', name: 'OpenAI GPT-OSS 120B' },
  { id: 'openai/gpt-oss-20b', name: 'OpenAI GPT-OSS 20B' },
  { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B' }
];

export const RETIRED_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-70b-versatile',
  'mixtral-8x7b-32768'
];

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) {
      try {
        return Promise.resolve(JSON.parse(req.body.toString('utf8')));
      } catch {
        return Promise.reject(new Error('Invalid JSON payload'));
      }
    }
    if (typeof req.body === 'object') return Promise.resolve(req.body);
    if (typeof req.body === 'string') {
      try {
        return Promise.resolve(req.body ? JSON.parse(req.body) : {});
      } catch {
        return Promise.reject(new Error('Invalid JSON payload'));
      }
    }
  }

  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 2e6) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Fallback to Google Gemini if Groq is unavailable or at limit
 */
export async function executeGeminiChat(geminiKey, messages, temperature = 0.7, max_tokens = 1024) {
  const models = ['gemini-3.1-flash-lite', 'gemini-3-flash-preview', 'gemini-flash-latest', 'gemini-3.8-flash'];
  const cleanKey = (geminiKey || '').trim().replace(/^['"]|['"]$/g, '');
  if (!cleanKey) return { success: false, error: 'No Gemini API key available' };

  // Separate system instruction from conversational turns
  const systemMessages = messages.filter(m => m.role === 'system');
  const systemInstruction = systemMessages.map(m => m.content).join('\n\n');
  const chatTurns = messages.filter(m => m.role !== 'system');

  const contents = chatTurns.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content || '' }]
  }));

  const payload = {
    contents: contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: 'Hello' }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: max_tokens
    }
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  let lastError = null;
  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text) {
          return { success: true, content: text, model: `gemini/${model}` };
        }
      }

      const errJson = await res.json().catch(() => ({}));
      lastError = errJson?.error?.message || `HTTP ${res.status}`;
      if (res.status === 404 || res.status === 503) continue;
    } catch (e) {
      lastError = e.message;
    }
  }

  return { success: false, error: lastError || 'Gemini models unavailable' };
}

/**
 * Executes chat completion with automatic model failover if rate limit (429) or failure occurs
 */
export async function executeGroqWithFailover(effectiveKey, initialModel, messages, temperature = 0.7, max_tokens = 1024) {
  // Build priority order starting with requested/default model, followed by other cascade models
  const candidateModels = [
    initialModel,
    ...GROQ_MODEL_CASCADE.filter(m => m !== initialModel)
  ];

  let lastError = null;

  for (const modelToTry of candidateModels) {
    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveKey}`
        },
        body: JSON.stringify({
          model: modelToTry,
          messages,
          temperature,
          max_tokens
        })
      });

      if (groqRes.ok) {
        const data = await groqRes.json();
        const content = data.choices?.[0]?.message?.content || '';
        return {
          success: true,
          content,
          model: modelToTry
        };
      }

      // If rate limited (429) or model issue, seamlessly try the next model
      const errData = await groqRes.json().catch(() => ({}));
      lastError = errData.error?.message || `HTTP ${groqRes.status}`;
      console.warn(`[Groq Failover] Model ${modelToTry} returned status ${groqRes.status}. Auto-switching to next candidate...`);
    } catch (fetchErr) {
      lastError = fetchErr.message;
      console.warn(`[Groq Failover] Network error on ${modelToTry}: ${fetchErr.message}. Auto-switching...`);
    }
  }

  return {
    success: false,
    error: lastError || 'All models reached limits'
  };
}

export async function handleGroqApi(req, res, configOrKey, configuredModel = DEFAULT_GROQ_MODEL) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.end();
  }

  let apiKey = '';
  let modelArg = configuredModel;
  let geminiKey = process.env.GEMINI_API_KEY || '';

  if (configOrKey && typeof configOrKey === 'object') {
    apiKey = configOrKey.groqKey || '';
    modelArg = configOrKey.groqModel || configuredModel;
    geminiKey = configOrKey.geminiKey || geminiKey;
  } else if (typeof configOrKey === 'string') {
    apiKey = configOrKey;
  }

  const effectiveKey = (apiKey || process.env.GROQ_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');
  const effectiveModel = (modelArg || process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL).trim().replace(/^['"]|['"]$/g, '');
  const hasKey = Boolean(effectiveKey && (effectiveKey.startsWith('gsk_') || effectiveKey.length >= 20));
  const hasGemini = Boolean(geminiKey && geminiKey.length >= 10);

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  const isStatus = pathname === '/api/status' || pathname === '/status' || pathname.endsWith('/status');
  const isTest = pathname === '/api/test-connection' || pathname === '/test-connection' || pathname.endsWith('/test-connection');
  const isChat = pathname === '/api/chat' || pathname === '/chat' || pathname.endsWith('/chat');

  // 1. GET /api/status
  if (req.method === 'GET' && isStatus) {
    return sendJson(res, 200, {
      success: true,
      configured: hasKey || hasGemini,
      hasGroq: hasKey,
      hasGemini: hasGemini,
      model: effectiveModel,
      supportedModels: SUPPORTED_GROQ_MODELS
    });
  }

  // 2. POST /api/test-connection
  if (req.method === 'POST' && isTest) {
    if (hasKey) {
      try {
        const result = await executeGroqWithFailover(effectiveKey, effectiveModel, [{ role: 'user', content: 'ping' }], 0.7, 5);
        if (result.success) {
          return sendJson(res, 200, {
            success: true,
            message: 'Connected! Groq intelligence is active and ready.',
            model: result.model
          });
        }
      } catch {}
    }

    if (hasGemini) {
      try {
        const geminiResult = await executeGeminiChat(geminiKey, [{ role: 'user', content: 'ping' }], 0.7, 5);
        if (geminiResult.success) {
          return sendJson(res, 200, {
            success: true,
            message: 'Connected! Gemini AI intelligence is active and ready.',
            model: geminiResult.model
          });
        }
      } catch {}
    }

    return sendJson(res, 400, {
      success: false,
      error: 'Neither GROQ_API_KEY nor GEMINI_API_KEY is configured on the server.'
    });
  }

  // 3. POST /api/chat - Proxy chat with auto failover to Gemini
  if (req.method === 'POST' && isChat) {
    let body;
    try {
      body = await parseBody(req);
    } catch (parseErr) {
      return sendJson(res, 400, { success: false, error: parseErr.message });
    }

    const messages = body.messages || [];
    const requestedModel = body.model && !RETIRED_MODELS.includes(body.model) ? body.model : effectiveModel;
    const temperature = typeof body.temperature === 'number' ? body.temperature : 0.7;
    const max_tokens = typeof body.max_tokens === 'number' ? body.max_tokens : 1024;

    if (!Array.isArray(messages) || messages.length === 0) {
      return sendJson(res, 400, {
        success: false,
        error: 'Missing or invalid "messages" array.'
      });
    }

    // Attempt Groq first if key exists
    if (hasKey) {
      try {
        const result = await executeGroqWithFailover(effectiveKey, requestedModel, messages, temperature, max_tokens);
        if (result.success && result.content) {
          return sendJson(res, 200, {
            success: true,
            content: result.content,
            model: result.model,
            provider: 'groq'
          });
        }
      } catch (groqErr) {
        console.warn('[AI Proxy] Groq error, attempting Gemini failover:', groqErr.message);
      }
    }

    // Seamless Failover to Google Gemini
    if (hasGemini) {
      try {
        const geminiResult = await executeGeminiChat(geminiKey, messages, temperature, max_tokens);
        if (geminiResult.success && geminiResult.content) {
          return sendJson(res, 200, {
            success: true,
            content: geminiResult.content,
            model: geminiResult.model,
            provider: 'gemini'
          });
        }
      } catch (geminiErr) {
        console.warn('[AI Proxy] Gemini failover error:', geminiErr.message);
      }
    }

    return sendJson(res, 503, {
      success: false,
      error: 'AI service unavailable. Please ensure GROQ_API_KEY or GEMINI_API_KEY is set.'
    });
  }

  return sendJson(res, 404, {
    success: false,
    error: `API route not found: ${pathname}`
  });
}

export default async function handler(req, res) {
  const apiKey = process.env.GROQ_API_KEY || '';
  const model = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
  const geminiKey = process.env.GEMINI_API_KEY || '';
  return handleGroqApi(req, res, { groqKey: apiKey, groqModel: model, geminiKey });
}
