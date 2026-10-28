// ==============================================================================
// BACKEND OTP & EMAIL VERIFICATION HANDLER - WALLETWEATHER WEB
// Powered by Brevo Transactional Email API + MongoDB Persistent Store
// Securely verifies user emails before account creation
// ==============================================================================

import crypto from 'node:crypto';
import { saveOtp, verifyOtp } from './db.js';

const OTP_SECRET = process.env.OTP_SECRET || 'walletweather-otp-secure-token-secret-2026';

function generateVerificationToken(email, otp) {
  const timestamp = Date.now();
  const payload = `${email}:${otp}:${timestamp}`;
  const hmac = crypto.createHmac('sha256', OTP_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${hmac}`).toString('base64');
}

function verifyVerificationToken(email, submittedOtp, token) {
  if (!token) return false;
  try {
    const raw = Buffer.from(token, 'base64').toString('utf8');
    const parts = raw.split(':');
    if (parts.length !== 4) return false;
    const [tokenEmail, tokenOtp, timestampStr, hmac] = parts;
    if (tokenEmail.toLowerCase().trim() !== email.toLowerCase().trim()) return false;
    if (tokenOtp.trim() !== submittedOtp.trim()) return false;
    const timestamp = parseInt(timestampStr, 10);
    // 15 minutes validity
    if (Date.now() - timestamp > 15 * 60 * 1000) return false;
    const expectedHmac = crypto.createHmac('sha256', OTP_SECRET).update(`${tokenEmail}:${tokenOtp}:${timestampStr}`).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac));
  } catch {
    return false;
  }
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

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function createEmailHtml(otp, name) {
  const safeName = name ? name.trim() : 'there';
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 20px; }
    .container { max-width: 520px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%); padding: 32px 24px; text-align: center; color: #FFFFFF; }
    .logo { font-size: 24px; font-weight: 900; letter-spacing: -0.5px; }
    .subtitle { font-size: 13px; color: #94A3B8; margin-top: 4px; }
    .content { padding: 36px 32px; color: #334155; line-height: 1.6; }
    .greeting { font-size: 18px; font-weight: 800; color: #0F172A; margin-bottom: 12px; }
    .text { font-size: 14px; color: #64748B; margin-bottom: 24px; }
    .otp-card { background: #F1F5F9; border: 1.5px dashed #CBD5E1; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
    .otp-code { font-size: 34px; font-weight: 900; letter-spacing: 8px; color: #0F172A; font-family: monospace; }
    .otp-expiry { font-size: 12px; color: #64748B; margin-top: 8px; font-weight: 600; }
    .footer { padding: 24px 32px; background: #F8FAFC; border-top: 1px solid #E2E8F0; text-align: center; font-size: 12px; color: #94A3B8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🌤️ WalletWeather</div>
      <div class="subtitle">Predicts, Pauses & Personalises</div>
    </div>
    <div class="content">
      <div class="greeting">Hello ${safeName},</div>
      <div class="text">
        Thank you for starting your account setup with <strong>WalletWeather</strong>. Please use the 6-digit verification code below to verify your email address:
      </div>
      <div class="otp-card">
        <div class="otp-code">${otp}</div>
        <div class="otp-expiry">⏱️ Valid for 10 minutes</div>
      </div>
      <div class="text" style="font-size: 13px;">
        If you did not request this email, you can safely disregard it. Someone may have entered your email by mistake.
      </div>
    </div>
    <div class="footer">
      © 2026 WalletWeather. All rights reserved.<br>
      Secure Financial Intelligence & Budget Protection
    </div>
  </div>
</body>
</html>
`;
}

export async function handleOtpApi(req, res, brevoApiKey, senderEmail = 'jazaaa34@gmail.com', senderName = 'WalletWeather', explicitAction = null) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.end();
  }

  const url = new URL(req.url || '/', `http://${req.headers?.host || 'localhost'}`);
  const pathname = url.pathname.replace(/\/+$/, '');

  const isSendOtp = explicitAction === 'send' || pathname === '/api/auth/send-otp' || pathname === '/send-otp' || pathname.endsWith('/send-otp');
  const isVerifyOtp = explicitAction === 'verify' || pathname === '/api/auth/verify-otp' || pathname === '/verify-otp' || pathname.endsWith('/verify-otp');

  // 1. POST /api/auth/send-otp - Generate OTP, save to MongoDB Atlas, and dispatch via Brevo
  if (req.method === 'POST' && isSendOtp) {
    try {
      const body = await parseBody(req);
      const email = (body.email || '').trim().toLowerCase();
      const name = (body.name || '').trim();

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        return sendJson(res, 400, {
          success: false,
          error: 'Please provide a valid email address.'
        });
      }

      const otp = generateOtp();
      const token = generateVerificationToken(email, otp);

      // Save OTP into MongoDB Atlas persistent store
      const saveRes = await saveOtp(email, otp, name);
      if (!saveRes.success) {
        return sendJson(res, 500, {
          success: false,
          error: saveRes.error || 'Unable to save verification code. Please try again.'
        });
      }

      // Call Brevo transactional email endpoint if key is present
      if (brevoApiKey) {
        try {
          const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
              'api-key': brevoApiKey,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              sender: {
                name: senderName || 'WalletWeather',
                email: senderEmail || 'jazaaa34@gmail.com'
              },
              to: [{
                email: email,
                name: name || 'Valued User'
              }],
              subject: `${otp} is your WalletWeather verification code`,
              htmlContent: createEmailHtml(otp, name)
            })
          });

          if (!brevoRes.ok) {
            const errJson = await brevoRes.json().catch(() => ({}));
            const msg = errJson.message || `Brevo HTTP ${brevoRes.status}`;
            console.error('Brevo API delivery issue:', msg);
            return sendJson(res, 502, {
              success: false,
              error: `Email delivery issue: ${msg}. Please ensure your email address is correct.`
            });
          }
        } catch (mailErr) {
          console.error('Email dispatch error:', mailErr.message);
          return sendJson(res, 502, {
            success: false,
            error: 'Failed to contact email delivery service. Please try again in a few moments.'
          });
        }
      }

      console.log(`[OTP] Verification code generated and saved for email: ${email}`);

      return sendJson(res, 200, {
        success: true,
        message: `Verification code sent successfully to ${email}.`,
        verificationToken: token,
        expiresInSeconds: 600
      });
    } catch (e) {
      console.error('Error handling send-otp:', e.message);
      return sendJson(res, 500, {
        success: false,
        error: `Server error sending verification code: ${e.message}`
      });
    }
  }

  // 2. POST /api/auth/verify-otp - Verify user submitted OTP against MongoDB Atlas
  if (req.method === 'POST' && isVerifyOtp) {
    try {
      const body = await parseBody(req);
      const email = (body.email || '').trim().toLowerCase();
      // Remove any non-digits or spaces from submitted OTP
      const userOtp = String(body.otp || '').replace(/\D/g, '').trim();

      if (!email || !userOtp) {
        return sendJson(res, 400, {
          success: false,
          error: 'Email and 6-digit verification code are required.'
        });
      }

      // 1. Verify OTP from MongoDB Atlas persistent store
      const verifyResult = await verifyOtp(email, userOtp);

      if (verifyResult.success) {
        return sendJson(res, 200, {
          success: true,
          verified: true,
          message: 'Email verified successfully.'
        });
      }

      // 2. Cryptographic token fallback (stateless serverless resilience across separate lambdas)
      const submittedToken = body.verificationToken || body.token || '';
      if (submittedToken && verifyVerificationToken(email, userOtp, submittedToken)) {
        return sendJson(res, 200, {
          success: true,
          verified: true,
          message: 'Email verified successfully.'
        });
      }

      return sendJson(res, 400, {
        success: false,
        error: verifyResult.error || 'Incorrect verification code.'
      });
    } catch (e) {
      console.error('Error handling verify-otp:', e.message);
      return sendJson(res, 500, {
        success: false,
        error: `Server error verifying code: ${e.message}`
      });
    }
  }

  // Route not found
  return sendJson(res, 404, {
    success: false,
    error: `Auth route not found: ${pathname}`
  });
}

export default async function handler(req, res) {
  const brevoKey = process.env.BREVO_API_KEY || '';
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'jazaaa34@gmail.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'WalletWeather';
  return handleOtpApi(req, res, brevoKey, senderEmail, senderName);
}
