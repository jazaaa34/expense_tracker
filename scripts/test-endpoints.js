// Test script to verify all API endpoints and serverless entry points
import { handleGroqApi, DEFAULT_GROQ_MODEL } from '../api/groqHandler.js';
import { handleOtpApi } from '../api/otpHandler.js';
import { handleBillExtractApi } from '../api/billExtractHandler.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock response object
function createMockRes() {
  const headers = {};
  let statusCode = 200;
  let body = '';
  return {
    statusCode,
    setHeader(name, val) { headers[name.toLowerCase()] = val; },
    getHeader(name) { return headers[name.toLowerCase()]; },
    get headers() { return headers; },
    end(data) {
      if (data) body += data;
      this.body = body;
    },
    json() {
      try { return JSON.parse(body); } catch { return body; }
    }
  };
}

// Load env
const envPath = path.join(__dirname, '..', '.env');
const env = {};
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) env[match[1]] = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
  }
}

async function runTests() {
  console.log('=== WALLETWEATHER ENDPOINT AUDIT & VERIFICATION ===\n');

  // Test 1: GET /api/status
  console.log('Test 1: GET /api/status');
  {
    const req = { method: 'GET', url: '/api/status', headers: { host: 'localhost' } };
    const res = createMockRes();
    await handleGroqApi(req, res, env.GROQ_API_KEY, env.GROQ_MODEL || DEFAULT_GROQ_MODEL);
    const parsed = res.json();
    console.log(`Status: ${res.statusCode}, Configured: ${parsed.configured}, Model: ${parsed.model}, CORS: ${res.getHeader('access-control-allow-origin')}`);
    if (res.statusCode !== 200 || !parsed.success) throw new Error('Status endpoint failed');
  }

  // Test 2: OPTIONS /api/status (CORS preflight)
  console.log('\nTest 2: OPTIONS /api/status (CORS preflight)');
  {
    const req = { method: 'OPTIONS', url: '/api/status', headers: { host: 'localhost' } };
    const res = createMockRes();
    await handleGroqApi(req, res, env.GROQ_API_KEY);
    console.log(`Status: ${res.statusCode}, Access-Control-Allow-Methods: ${res.getHeader('access-control-allow-methods')}`);
    if (res.statusCode !== 204) throw new Error('OPTIONS preflight failed');
  }

  // Test 3: POST /api/test-connection
  console.log('\nTest 3: POST /api/test-connection');
  {
    const req = {
      method: 'POST',
      url: '/api/test-connection',
      headers: { host: 'localhost' },
      body: { model: env.GROQ_MODEL || DEFAULT_GROQ_MODEL }
    };
    const res = createMockRes();
    await handleGroqApi(req, res, env.GROQ_API_KEY, env.GROQ_MODEL);
    const parsed = res.json();
    console.log(`Status: ${res.statusCode}, Success: ${parsed.success}, Message: ${parsed.message || parsed.error}`);
    if (res.statusCode !== 200 || !parsed.success) throw new Error('Test connection failed: ' + parsed.error);
  }

  // Test 4: POST /api/chat with openai/gpt-oss-120b
  console.log('\nTest 4: POST /api/chat with openai/gpt-oss-120b');
  {
    const req = {
      method: 'POST',
      url: '/api/chat',
      headers: { host: 'localhost' },
      body: {
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: 'Say hello in 3 words' }],
        max_tokens: 15
      }
    };
    const res = createMockRes();
    await handleGroqApi(req, res, env.GROQ_API_KEY, 'openai/gpt-oss-120b');
    const parsed = res.json();
    console.log(`Status: ${res.statusCode}, Success: ${parsed.success}, Content: ${parsed.content?.trim()}`);
    if (res.statusCode !== 200 || !parsed.success) throw new Error('Chat failed: ' + parsed.error);
  }

  // Test 5: POST /api/auth/send-otp validation
  console.log('\nTest 5: POST /api/auth/send-otp (Validation test with empty email)');
  {
    const req = {
      method: 'POST',
      url: '/api/auth/send-otp',
      headers: { host: 'localhost' },
      body: { email: '', name: 'Test' }
    };
    const res = createMockRes();
    await handleOtpApi(req, res, env.BREVO_API_KEY);
    const parsed = res.json();
    console.log(`Status: ${res.statusCode}, Error: ${parsed.error}`);
    if (res.statusCode !== 400 || parsed.success !== false) throw new Error('Validation failed');
  }

  // Test 6: POST /api/bills/extract validation
  console.log('\nTest 6: POST /api/bills/extract (Validation test with missing image)');
  {
    const req = {
      method: 'POST',
      url: '/api/bills/extract',
      headers: { host: 'localhost' },
      body: {}
    };
    const res = createMockRes();
    await handleBillExtractApi(req, res, { geminiKey: env.GEMINI_API_KEY });
    const parsed = res.json();
    console.log(`Status: ${res.statusCode}, Error: ${parsed.error}`);
    if (res.statusCode !== 400 || parsed.success !== false) throw new Error('Bill validation failed');
  }

  console.log('\n=== ALL ENDPOINT CHECKS PASSED PERFECTLY ===');
}

runTests().catch(err => {
  console.error('\nFAIL:', err.message);
  process.exit(1);
});
