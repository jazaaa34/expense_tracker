// ==============================================================================
// BACKEND BILL EXTRACTION HANDLER - WALLETWEATHER WEB
// Secure server-side endpoint for extracting bill details using Vision AI.
// Supports Google Gemini Vision (GEMINI_API_KEY) and Anthropic Claude (ANTHROPIC_API_KEY).
// Never exposes API keys to the browser or public client.
// In-memory processing only (image is never stored on disk).
// ==============================================================================

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(data));
}

function parseJsonBody(req, maxBytes = 10 * 1024 * 1024) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object') return Promise.resolve(req.body);
    if (typeof req.body === 'string') {
      try {
        return Promise.resolve(req.body ? JSON.parse(req.body) : {});
      } catch {
        return Promise.reject(new Error('Invalid JSON request payload.'));
      }
    }
  }

  return new Promise((resolve, reject) => {
    let body = '';
    let bytesReceived = 0;

    req.on('data', chunk => {
      bytesReceived += chunk.length;
      if (bytesReceived > maxBytes) {
        req.destroy();
        reject(new Error('Payload too large. Maximum image size is 5 MB.'));
        return;
      }
      body += chunk;
    });

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON request payload.'));
      }
    });

    req.on('error', reject);
  });
}

/**
 * Validates extracted date in YYYY-MM-DD format
 */
function validateDate(dateStr) {
  if (typeof dateStr !== 'string') return null;
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const d = new Date(`${match[1]}-${match[2]}-${match[3]}`);
  if (isNaN(d.getTime())) return null;

  return `${match[1]}-${match[2]}-${match[3]}`;
}

/**
 * Validates extracted positive amount
 */
function validateAmount(amountVal) {
  if (amountVal === null || amountVal === undefined) return null;
  const num = typeof amountVal === 'number' ? amountVal : parseFloat(String(amountVal).replace(/[^0-9.]/g, ''));
  if (isNaN(num) || num <= 0 || !isFinite(num)) {
    return null;
  }
  return Math.round(num * 100) / 100;
}

/**
 * Validates shop / merchant name
 */
function validateShopName(nameVal) {
  if (typeof nameVal !== 'string') return null;
  const trimmed = nameVal.trim();
  if (!trimmed || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'unknown') {
    return null;
  }
  return trimmed.slice(0, 100);
}

/**
 * Validates confidence score between 0.0 and 1.0
 */
function validateConfidence(confVal, hasData) {
  const num = typeof confVal === 'number' ? confVal : parseFloat(confVal);
  if (!isNaN(num) && num >= 0 && num <= 1) {
    return Math.round(num * 100) / 100;
  }
  return hasData ? 0.8 : 0.0;
}

/**
 * Clean markdown code fences from AI reply
 */
function cleanJsonOutput(text) {
  if (!text) return '';
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

/**
 * Call Google Gemini Vision API
 */
async function callGeminiVision(geminiKey, mediaType, pureBase64, signal) {
  const models = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash'];
  const prompt = `You are an expert receipt and bill OCR assistant.
Analyze this bill/receipt photo and extract:
1. shopName: Store, vendor, restaurant, or business name (string or null).
2. date: Transaction date strictly in YYYY-MM-DD format (string or null).
3. totalAmount: Final payable total amount (number or null). Must be the final total to pay, NOT subtotal, change, or taxes.
4. confidence: Estimated extraction certainty from 0.0 to 1.0 based on image readability and clarity.

RULES:
- Return ONLY valid JSON with no markdown formatting, backticks, or explanation.
- If a field is unreadable, blurry, or missing, set it to null. NEVER guess, estimate, or hallucinate.
- If the image is not a bill or receipt at all, return: {"shopName": null, "date": null, "totalAmount": null, "confidence": 0.0}`;

  const payload = {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: mediaType,
              data: pureBase64
            }
          },
          {
            text: prompt
          }
        ]
      }
    ],
    generationConfig: {
      response_mime_type: 'application/json'
    }
  };

  let lastError = null;

  for (const model of models) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey.trim()}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        let parsedErr = {};
        try { parsedErr = JSON.parse(errText); } catch {}
        const msg = parsedErr?.error?.message || `Gemini API error (${res.status})`;
        lastError = new Error(msg);
        // If 503 or 404, try next fallback model
        if (res.status === 503 || res.status === 404) continue;
        throw lastError;
      }

      const json = await res.json();
      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return rawText;
    } catch (err) {
      lastError = err;
      if (err.name === 'AbortError') throw err;
    }
  }

  throw lastError || new Error('All Gemini models failed to process the image.');
}

/**
 * Call Anthropic Claude Vision API
 */
async function callClaudeVision(anthropicKey, mediaType, pureBase64, signal) {
  const systemPrompt = `You are an expert receipt and bill OCR assistant.
Analyze the bill/receipt photo and extract:
1. shopName: Store, vendor, restaurant, or business name (string or null).
2. date: Transaction date strictly in YYYY-MM-DD format (string or null).
3. totalAmount: Final payable total amount (number or null). Must be the final total to pay, NOT subtotal, change, or taxes.
4. confidence: Estimated extraction certainty from 0.0 to 1.0 based on image readability and clarity.

RULES:
- Return ONLY valid JSON with no markdown formatting, backticks, or explanation.
- If a field is unreadable, blurry, or missing, set it to null. NEVER guess, estimate, or hallucinate.
- If the image is not a bill or receipt at all, return: {"shopName": null, "date": null, "totalAmount": null, "confidence": 0.0}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey.trim(),
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 512,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: pureBase64
              }
            },
            {
              type: 'text',
              text: 'Extract the shopName, date (YYYY-MM-DD), totalAmount (final payable amount), and confidence score from this bill. Reply with only the JSON object.'
            }
          ]
        }
      ]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    let parsedErr = {};
    try { parsedErr = JSON.parse(errText); } catch {}
    const errMsg = parsedErr?.error?.message || `Anthropic API error (${res.status})`;
    throw new Error(errMsg);
  }

  const json = await res.json();
  return json.content?.find(c => c.type === 'text')?.text || '';
}

/**
 * Handles POST /api/bills/extract
 */
export async function handleBillExtractApi(req, res, configKeys) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  const isExtract = pathname === '/api/bills/extract' || pathname === '/extract' || pathname.endsWith('/extract') || pathname.endsWith('/bills/extract');

  // Only handle POST /api/bills/extract
  if (!isExtract) {
    return sendJson(res, 404, {
      success: false,
      error: `Endpoint ${pathname} not found.`
    });
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, {
      success: false,
      error: 'Method not allowed. Use POST.'
    });
  }

  // Resolve API keys (support both Gemini and Anthropic)
  let geminiKey = process.env.GEMINI_API_KEY || '';
  let anthropicKey = process.env.ANTHROPIC_API_KEY || '';

  if (typeof configKeys === 'string') {
    if (configKeys.startsWith('AQ.') || configKeys.startsWith('AIza')) {
      geminiKey = geminiKey || configKeys;
    } else {
      anthropicKey = anthropicKey || configKeys;
    }
  } else if (configKeys && typeof configKeys === 'object') {
    geminiKey = geminiKey || configKeys.geminiKey || '';
    anthropicKey = anthropicKey || configKeys.anthropicKey || '';
  }

  if (!geminiKey && !anthropicKey) {
    return sendJson(res, 500, {
      success: false,
      error: 'Vision AI key is not configured. Please add GEMINI_API_KEY or ANTHROPIC_API_KEY to your .env file.',
      fallback: 'manual'
    });
  }

  let body;
  try {
    body = await parseJsonBody(req);
  } catch (err) {
    return sendJson(res, 400, {
      success: false,
      error: err.message || 'Failed to parse request body.',
      fallback: 'manual'
    });
  }

  const { image, mimeType } = body;
  if (!image || typeof image !== 'string') {
    return sendJson(res, 400, {
      success: false,
      error: 'Missing required "image" field containing base64 data.',
      fallback: 'manual'
    });
  }

  // Extract media_type and pure base64 data
  let mediaType = mimeType || 'image/jpeg';
  let pureBase64 = image.trim();

  const dataUrlMatch = pureBase64.match(/^data:([a-zA-Z0-9.+/-]+);base64,(.+)$/s);
  if (dataUrlMatch) {
    mediaType = dataUrlMatch[1].toLowerCase();
    pureBase64 = dataUrlMatch[2].trim();
  }

  if (mediaType === 'image/jpg') mediaType = 'image/jpeg';

  if (!ALLOWED_MIME_TYPES.includes(mediaType)) {
    return sendJson(res, 400, {
      success: false,
      error: `Unsupported image format (${mediaType}). Please upload a JPEG, PNG, or WebP photo.`,
      fallback: 'manual'
    });
  }

  // Check approximate binary size from base64 length
  const approxSizeBytes = Math.floor((pureBase64.length * 3) / 4);
  if (approxSizeBytes > MAX_FILE_SIZE_BYTES) {
    return sendJson(res, 400, {
      success: false,
      error: 'Image exceeds the 5 MB size limit. Please upload a smaller or compressed photo.',
      fallback: 'manual'
    });
  }

  // Call Vision API with timeout protection
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000); // 35 second timeout

  try {
    let rawContent = '';

    if (geminiKey) {
      rawContent = await callGeminiVision(geminiKey, mediaType, pureBase64, controller.signal);
    } else {
      rawContent = await callClaudeVision(anthropicKey, mediaType, pureBase64, controller.signal);
    }

    clearTimeout(timeoutId);

    const cleanedText = cleanJsonOutput(rawContent);

    let parsed = null;
    try {
      parsed = JSON.parse(cleanedText);
    } catch {
      // Attempt to extract JSON substring if there's any stray text
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch {}
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      return sendJson(res, 422, {
        success: false,
        error: 'Could not read clear bill details from this image. Please review and enter details manually.',
        data: { shopName: null, date: null, totalAmount: null, confidence: 0.0 },
        fallback: 'manual'
      });
    }

    // Validate fields using plain JavaScript checks
    const shopName = validateShopName(parsed.shopName);
    const date = validateDate(parsed.date);
    const totalAmount = validateAmount(parsed.totalAmount);
    const hasAnyField = Boolean(shopName || date || totalAmount);
    const confidence = validateConfidence(parsed.confidence, hasAnyField);

    return sendJson(res, 200, {
      success: true,
      data: {
        shopName,
        date,
        totalAmount,
        confidence
      }
    });

  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      return sendJson(res, 504, {
        success: false,
        error: 'Extraction timed out after 35 seconds. Please try again with a clearer photo or enter manually.',
        fallback: 'manual'
      });
    }

    return sendJson(res, 502, {
      success: false,
      error: `AI extraction error: ${error.message}`,
      fallback: 'manual'
    });
  }
}
