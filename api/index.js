// ==============================================================================
// CONSOLIDATED SERVERLESS API HANDLER - WALLETWEATHER WEB
// Single unified catch-all entrypoint for Vercel Hobby plan (1 Serverless Function)
// Preserves all existing endpoints, methods, auth, Brevo OTP, MongoDB Atlas, AI
// ==============================================================================

import { handleGroqApi, DEFAULT_GROQ_MODEL } from '../lib/groqHandler.js';
import { handleOtpApi } from '../lib/otpHandler.js';
import { handleBillExtractApi } from '../lib/billExtractHandler.js';
import { handleDataApi } from '../lib/dataHandler.js';

/**
 * Resolves the logical request path from headers, query params, or req.url
 */
export function resolvePath(req) {
  // 1. Check proxy / CDN headers injected by Vercel edge
  const headerUri = req.headers?.['x-forwarded-uri'] || 
                    req.headers?.['x-matched-path'] || 
                    req.headers?.['x-real-url'] ||
                    req.headers?.['x-original-url'];
  if (headerUri) {
    try {
      const parsed = new URL(headerUri, 'http://localhost');
      if (parsed.pathname && parsed.pathname !== '/api' && parsed.pathname !== '/api/' && parsed.pathname !== '/api/index.js') {
        return parsed.pathname;
      }
    } catch {}
  }

  // 2. Check query parameter _route passed by vercel.json rewrite
  if (req.url) {
    try {
      const parsed = new URL(req.url, 'http://localhost');
      const routeParam = parsed.searchParams.get('_route');
      if (routeParam) {
        return routeParam.startsWith('/') ? `/api${routeParam}` : `/api/${routeParam}`;
      }
      if (parsed.pathname && parsed.pathname !== '/api' && parsed.pathname !== '/api/' && parsed.pathname !== '/api/index.js') {
        return parsed.pathname;
      }
    } catch {}
  }

  return (req.url || '').split('?')[0] || '/api';
}

export default async function handler(req, res) {
  // 1. Handle global CORS preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    return res.end();
  }

  const rawPath = resolvePath(req);
  const pathname = rawPath.replace(/\/+$/, '') || '/api';

  // Normalize req.url so downstream handlers see the expected pathname and query
  try {
    const urlObj = new URL(req.url || '/', 'http://localhost');
    urlObj.searchParams.delete('_route');
    const search = urlObj.searchParams.toString();
    req.url = pathname + (search ? `?${search}` : '');
  } catch {
    req.url = pathname;
  }

  // Environment credentials
  const geminiKey = process.env.GEMINI_API_KEY || '';
  const anthropicKey = process.env.ANTHROPIC_API_KEY || '';
  const brevoKey = process.env.BREVO_API_KEY || '';
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'jazaaa34@gmail.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'WalletWeather';
  const groqKey = process.env.GROQ_API_KEY || '';
  const groqModel = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;

  // 2. Route Dispatching

  // A. Bill Extraction API (Gemini Vision / Claude OCR)
  if (pathname === '/api/bills/extract') {
    return handleBillExtractApi(req, res, { geminiKey, anthropicKey });
  }

  // B. Authentication & OTP APIs (Brevo Email + MongoDB Atlas)
  if (pathname === '/api/auth/send-otp') {
    return handleOtpApi(req, res, brevoKey, senderEmail, senderName, 'send');
  }

  if (pathname === '/api/auth/verify-otp') {
    return handleOtpApi(req, res, brevoKey, senderEmail, senderName, 'verify');
  }

  if (pathname.startsWith('/api/auth/')) {
    return handleOtpApi(req, res, brevoKey, senderEmail, senderName);
  }

  // C. MongoDB Atlas Data APIs (Status, User Sync, Profile)
  if (pathname === '/api/db/status') {
    return handleDataApi(req, res, 'status');
  }

  if (pathname === '/api/db/sync') {
    return handleDataApi(req, res, 'sync');
  }

  if (pathname === '/api/db/user/save') {
    return handleDataApi(req, res, 'user_save');
  }

  if (pathname === '/api/db/user/find') {
    return handleDataApi(req, res, 'user_find');
  }

  if (pathname.startsWith('/api/db/')) {
    return handleDataApi(req, res);
  }

  // D. Groq AI Chatbot APIs (Status, Test Connection, Chat)
  if (pathname === '/api/status' || pathname === '/api/test-connection' || pathname === '/api/chat') {
    return handleGroqApi(req, res, groqKey, groqModel);
  }

  // E. Consolidated API Root Status Endpoint
  if (pathname === '/api' || pathname === '') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.end(JSON.stringify({
      success: true,
      service: 'WalletWeather Consolidated API',
      functions: 1,
      endpoints: [
        '/api/status',
        '/api/test-connection',
        '/api/chat',
        '/api/auth/send-otp',
        '/api/auth/verify-otp',
        '/api/bills/extract',
        '/api/db/status',
        '/api/db/sync',
        '/api/db/user/save',
        '/api/db/user/find'
      ]
    }));
  }

  // F. Fallback for unhandled /api/* routes
  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.end(JSON.stringify({
    success: false,
    error: `API route not found: ${pathname}`
  }));
}
