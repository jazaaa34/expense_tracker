// Test script to verify consolidated serverless API handler
import handleServerlessApi from '../api/index.js';
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
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
    }
  }
}

async function runTests() {
  console.log('=== CONSOLIDATED SERVERLESS API AUDIT (1 FUNCTION) ===\n');

  // Test 1: Root /api status
  console.log('Test 1: GET /api');
  {
    const req = { method: 'GET', url: '/api', headers: { host: 'localhost' } };
    const res = createMockRes();
    await handleServerlessApi(req, res);
    const parsed = res.json();
    console.log(`Status: ${res.statusCode}, Service: ${parsed.service}, Functions: ${parsed.functions}`);
    if (res.statusCode !== 200 || parsed.functions !== 1) throw new Error('Root /api failed');
  }

  // Test 2: GET /api/status (Groq AI Status)
  console.log('\nTest 2: GET /api/status (Groq Status)');
  {
    const req = { method: 'GET', url: '/api/status', headers: { host: 'localhost' } };
    const res = createMockRes();
    await handleServerlessApi(req, res);
    const parsed = res.json();
    console.log(`Status: ${res.statusCode}, Configured: ${parsed.configured}, Model: ${parsed.model}`);
    if (res.statusCode !== 200 || !parsed.success) throw new Error('Status endpoint failed');
  }

  // Test 3: OPTIONS /api/status (CORS preflight)
  console.log('\nTest 3: OPTIONS /api/status (CORS preflight)');
  {
    const req = { method: 'OPTIONS', url: '/api/status', headers: { host: 'localhost' } };
    const res = createMockRes();
    await handleServerlessApi(req, res);
    console.log(`Status: ${res.statusCode}, Access-Control-Allow-Methods: ${res.getHeader('access-control-allow-methods')}`);
    if (res.statusCode !== 204) throw new Error('OPTIONS preflight failed');
  }

  // Test 4: GET /api/db/status (MongoDB Atlas Health)
  console.log('\nTest 4: GET /api/db/status (MongoDB Atlas Status)');
  {
    const req = { method: 'GET', url: '/api/db/status', headers: { host: 'localhost' } };
    const res = createMockRes();
    await handleServerlessApi(req, res);
    const parsed = res.json();
    console.log(`Status: ${res.statusCode}, Connected: ${parsed.connected}, Storage: ${parsed.storage}`);
    if (res.statusCode !== 200 || !parsed.success) throw new Error('DB Status endpoint failed');
  }

  // Test 5: POST /api/test-connection (Groq Ping)
  console.log('\nTest 5: POST /api/test-connection');
  {
    const req = {
      method: 'POST',
      url: '/api/test-connection',
      headers: { host: 'localhost' },
      body: { model: 'openai/gpt-oss-120b' }
    };
    const res = createMockRes();
    await handleServerlessApi(req, res);
    const parsed = res.json();
    console.log(`Status: ${res.statusCode}, Success: ${parsed.success}, Message: ${parsed.message || parsed.error}`);
    if (res.statusCode !== 200 || !parsed.success) throw new Error('Test connection failed: ' + parsed.error);
  }

  // Test 6: POST /api/auth/send-otp validation
  console.log('\nTest 6: POST /api/auth/send-otp (Validation test with empty email)');
  {
    const req = {
      method: 'POST',
      url: '/api/auth/send-otp',
      headers: { host: 'localhost' },
      body: { email: '', name: 'Test' }
    };
    const res = createMockRes();
    await handleServerlessApi(req, res);
    const parsed = res.json();
    console.log(`Status: ${res.statusCode}, Error: ${parsed.error}`);
    if (res.statusCode !== 400 || parsed.success !== false) throw new Error('Validation failed');
  }

  // Test 7: POST /api/bills/extract validation
  console.log('\nTest 7: POST /api/bills/extract (Validation test with missing image)');
  {
    const req = {
      method: 'POST',
      url: '/api/bills/extract',
      headers: { host: 'localhost' },
      body: {}
    };
    const res = createMockRes();
    await handleServerlessApi(req, res);
    const parsed = res.json();
    console.log(`Status: ${res.statusCode}, Error: ${parsed.error}`);
    if (res.statusCode !== 400 || parsed.success !== false) throw new Error('Bill validation failed');
  }

  // Test 8: Simulated Vercel rewrite with _route query parameter
  console.log('\nTest 8: Vercel Rewrite simulation (?_route=auth/send-otp)');
  {
    const req = {
      method: 'POST',
      url: '/api?_route=auth/send-otp',
      headers: { host: 'localhost' },
      body: { email: '', name: 'Test' }
    };
    const res = createMockRes();
    await handleServerlessApi(req, res);
    const parsed = res.json();
    console.log(`Status: ${res.statusCode}, Error: ${parsed.error}`);
    if (res.statusCode !== 400 || parsed.success !== false) throw new Error('Vercel rewrite simulation failed');
  }

  // Test 9: Simulated Vercel edge x-forwarded-uri header
  console.log('\nTest 9: Vercel Edge simulation (x-forwarded-uri: /api/status)');
  {
    const req = {
      method: 'GET',
      url: '/api',
      headers: { host: 'localhost', 'x-forwarded-uri': '/api/status' }
    };
    const res = createMockRes();
    await handleServerlessApi(req, res);
    const parsed = res.json();
    console.log(`Status: ${res.statusCode}, Configured: ${parsed.configured}, Model: ${parsed.model}`);
    if (res.statusCode !== 200 || !parsed.success) throw new Error('Vercel Edge header simulation failed');
  }

  console.log('\n=== ALL CONSOLIDATED ENDPOINT CHECKS PASSED PERFECTLY ===');
}

runTests().catch(err => {
  console.error('\nFAIL:', err.message);
  process.exit(1);
});
