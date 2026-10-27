// ==============================================================================
// BACKEND GROQ API HANDLER - WALLETWEATHER WEB
// Secure server-side proxy for Groq API.
// Never exposes GROQ_API_KEY to the browser or public client.
// ==============================================================================

export const SUPPORTED_GROQ_MODELS = [
  { id: 'openai/gpt-oss-120b', name: 'OpenAI GPT-OSS 120B (Recommended)' },
  { id: 'openai/gpt-oss-20b', name: 'OpenAI GPT-OSS 20B (Ultra Fast)' },
  { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B' }
];

export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';

// Outdated/retired models to explicitly filter out
export const RETIRED_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-70b-versatile',
  'mixtral-8x7b-32768'
];

export function resolveModel(requestedModel, configuredModel) {
  if (!requestedModel || RETIRED_MODELS.includes(requestedModel)) {
    return configuredModel || DEFAULT_GROQ_MODEL;
  }
  return requestedModel;
}

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
      if (body.length > 1e6) { // 1MB protection
        req.destroy();
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

export async function handleGroqApi(req, res, apiKey, configuredModel = DEFAULT_GROQ_MODEL) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  const isStatus = pathname === '/api/status' || pathname === '/status' || pathname.endsWith('/status');
  const isTest = pathname === '/api/test-connection' || pathname === '/test-connection' || pathname.endsWith('/test-connection');
  const isChat = pathname === '/api/chat' || pathname === '/chat' || pathname.endsWith('/chat');

  // 1. GET /api/status - Check if backend has GROQ_API_KEY configured (without exposing the secret)
  if (req.method === 'GET' && isStatus) {
    const isConfigured = Boolean(apiKey && apiKey.startsWith('gsk_'));
    return sendJson(res, 200, {
      success: true,
      configured: isConfigured,
      model: configuredModel || DEFAULT_GROQ_MODEL,
      supportedModels: SUPPORTED_GROQ_MODELS
    });
  }

  // 2. POST /api/test-connection - Test Groq API connectivity with configured key
  if (req.method === 'POST' && isTest) {
    if (!apiKey || !apiKey.startsWith('gsk_')) {
      return sendJson(res, 400, {
        success: false,
        error: 'GROQ_API_KEY is not configured on the server. Please set GROQ_API_KEY in your .env file.',
        code: 'API_KEY_MISSING'
      });
    }

    try {
      const body = await parseBody(req);
      const testModel = resolveModel(body.model, configuredModel);

      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: testModel,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 5
        })
      });

      if (groqRes.ok) {
        return sendJson(res, 200, {
          success: true,
          message: `Connected! Groq model (${testModel}) is active and ready.`,
          model: testModel
        });
      }

      const errData = await groqRes.json().catch(() => ({}));
      const msg = errData.error?.message || `HTTP ${groqRes.status}`;
      return sendJson(res, groqRes.status, {
        success: false,
        error: `Groq error (${groqRes.status}): ${msg}`,
        code: errData.error?.code || 'GROQ_ERROR'
      });
    } catch (e) {
      return sendJson(res, 502, {
        success: false,
        error: `Failed to connect to Groq: ${e.message}`,
        code: 'NETWORK_ERROR'
      });
    }
  }

  // 3. POST /api/chat - Proxy chat completion request to Groq
  if (req.method === 'POST' && isChat) {
    if (!apiKey || !apiKey.startsWith('gsk_')) {
      return sendJson(res, 503, {
        success: false,
        error: 'GROQ_API_KEY is not configured on the server. Please add GROQ_API_KEY=your_key to your .env file and restart the server.',
        code: 'API_KEY_MISSING'
      });
    }

    try {
      const body = await parseBody(req);
      const messages = body.messages || [];
      const model = resolveModel(body.model, configuredModel);
      const temperature = typeof body.temperature === 'number' ? body.temperature : 0.7;
      const max_tokens = typeof body.max_tokens === 'number' ? body.max_tokens : 1024;

      if (!Array.isArray(messages) || messages.length === 0) {
        return sendJson(res, 400, {
          success: false,
          error: 'Missing or invalid "messages" array in request body.',
          code: 'INVALID_REQUEST'
        });
      }

      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens
        })
      });

      if (groqRes.ok) {
        const data = await groqRes.json();
        const content = data.choices?.[0]?.message?.content || '';
        return sendJson(res, 200, {
          success: true,
          content,
          model: data.model || model
        });
      }

      const errData = await groqRes.json().catch(() => ({}));
      const status = groqRes.status;
      let userFriendlyMessage = errData.error?.message || `HTTP ${status}`;

      if (status === 401) {
        userFriendlyMessage = 'Invalid Groq API key. Please check the GROQ_API_KEY setting in your .env file.';
      } else if (status === 404 || userFriendlyMessage.includes('does not exist')) {
        userFriendlyMessage = `The model "${model}" does not exist or you do not have access to it. Please use a supported model such as "${DEFAULT_GROQ_MODEL}".`;
      } else if (status === 429) {
        userFriendlyMessage = 'Groq rate limit reached. Please wait a few seconds and try again.';
      }

      return sendJson(res, status, {
        success: false,
        error: `Groq error: ${userFriendlyMessage}`,
        code: errData.error?.code || 'GROQ_ERROR'
      });
    } catch (e) {
      return sendJson(res, 502, {
        success: false,
        error: `Network failure connecting to Groq API: ${e.message}`,
        code: 'NETWORK_ERROR'
      });
    }
  }

  // Not handled
  return sendJson(res, 404, {
    success: false,
    error: `API route not found: ${pathname}`
  });
}
