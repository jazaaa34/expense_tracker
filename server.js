// ==============================================================================
// PRODUCTION SERVER - WALLETWEATHER WEB
// Built-in Node.js HTTP server (zero external dependencies required)
// Serves static assets from dist/ and handles /api/chat securely with GROQ_API_KEY
// ==============================================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleGroqApi, DEFAULT_GROQ_MODEL } from './api/groqHandler.js';
import { handleOtpApi } from './api/otpHandler.js';
import { handleBillExtractApi } from './api/billExtractHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env file if present
function loadLocalEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || '';
        val = val.trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadLocalEnv();

const PORT = parseInt(process.env.PORT || '5173', 10);
const DIST_DIR = path.join(__dirname, 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // Handle Backend API endpoints
  if (url.pathname === '/api/bills/extract') {
    const geminiKey = process.env.GEMINI_API_KEY || '';
    const anthropicKey = process.env.ANTHROPIC_API_KEY || '';
    return handleBillExtractApi(req, res, { geminiKey, anthropicKey });
  }

  if (url.pathname.startsWith('/api/auth/')) {
    const brevoKey = process.env.BREVO_API_KEY || '';
    const senderEmail = process.env.BREVO_SENDER_EMAIL || 'jazaaa34@gmail.com';
    const senderName = process.env.BREVO_SENDER_NAME || 'WalletWeather';
    return handleOtpApi(req, res, brevoKey, senderEmail, senderName);
  }

  if (url.pathname.startsWith('/api/')) {
    const apiKey = process.env.GROQ_API_KEY || '';
    const model = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
    return handleGroqApi(req, res, apiKey, model);
  }

  // Handle static files from dist/
  let filePath = path.join(DIST_DIR, url.pathname === '/' ? 'index.html' : url.pathname);

  // Security check: stay within DIST_DIR
  if (!filePath.startsWith(DIST_DIR)) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // SPA Fallback: serve index.html for unknown routes
      filePath = path.join(DIST_DIR, 'index.html');
    }

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.statusCode = 500;
        return res.end('Error loading application');
      }
      const ext = path.extname(filePath).toLowerCase();
      res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  console.log(`WalletWeather server running at http://localhost:${PORT}`);
  console.log(`Backend Groq API active with model: ${process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL}`);
  console.log(`GROQ_API_KEY configured: ${Boolean(process.env.GROQ_API_KEY)}`);
});
