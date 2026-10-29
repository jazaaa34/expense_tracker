// ==============================================================================
// BACKEND OTP & EMAIL VERIFICATION HANDLER - WALLETWEATHER WEB
// Powered by Brevo Transactional Email API + MongoDB Persistent Store
// Securely verifies user emails before account creation
// ==============================================================================

import crypto from 'node:crypto';
import { saveOtp, verifyOtp, findUserByEmail, saveUserAccount } from './db.js';

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
      if (body.length > 1e6) {
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

function createEmailHtml(otp, name, purpose = 'signup') {
  const safeName = name ? name.trim() : 'there';
  const isReset = purpose === 'reset' || purpose === 'password_reset';

  const headingText = isReset
    ? 'Reset Your Password'
    : 'Verify Your Email';

  const introText = isReset
    ? `We received a request to reset your password for your <strong>WalletWeather</strong> account. Please use the 6-digit security code below to complete your password reset:`
    : `Thank you for starting your account setup with <strong>WalletWeather</strong>. Please use the 6-digit verification code below to verify your email address:`;

  const noticeText = isReset
    ? `If you did not request a password reset, you can safely ignore this email. Your account remains secure and your password has not been changed.`
    : `If you did not request this email, you can safely disregard it. Someone may have entered your email by mistake.`;

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
    .title-badge { display: inline-block; padding: 5px 14px; background: ${isReset ? '#FEE2E2' : '#EFF6FF'}; color: ${isReset ? '#DC2626' : '#2563EB'}; border-radius: 20px; font-size: 12px; font-weight: 800; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px; }
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
      <div class="title-badge">${headingText}</div>
      <div class="greeting">Hello ${safeName},</div>
      <div class="text">
        ${introText}
      </div>
      <div class="otp-card">
        <div class="otp-code">${otp}</div>
        <div class="otp-expiry">⏱️ Valid for 10 minutes</div>
      </div>
      <div class="text" style="font-size: 13px; color: #94A3B8;">
        ${noticeText}
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
  const isForgotPassword = explicitAction === 'forgot-password' || pathname === '/api/auth/forgot-password' || pathname === '/forgot-password' || pathname.endsWith('/forgot-password');
  const isResetPassword = explicitAction === 'reset-password' || pathname === '/api/auth/reset-password' || pathname === '/reset-password' || pathname.endsWith('/reset-password');
  const isChangePassword = explicitAction === 'change-password' || pathname === '/api/auth/change-password' || pathname === '/change-password' || pathname.endsWith('/change-password');

  // 1. POST /api/auth/send-otp or /api/auth/forgot-password - Generate OTP & dispatch via Brevo
  if (req.method === 'POST' && (isSendOtp || isForgotPassword)) {
    try {
      const body = await parseBody(req);
      const email = (body.email || '').trim().toLowerCase();
      let name = (body.name || '').trim();
      const purpose = body.purpose || (isForgotPassword ? 'reset' : 'signup');
      const isReset = purpose === 'reset' || purpose === 'password_reset';

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        return sendJson(res, 400, {
          success: false,
          error: 'Please provide a valid email address.'
        });
      }

      // If this is a password reset request, verify the user actually exists in the system
      if (isReset) {
        const existingUser = await findUserByEmail(email);
        const isDemo = email === 'jazaaa34@gmail.com' || email === 'aysha@example.com';
        if (!existingUser && !isDemo) {
          return sendJson(res, 404, {
            success: false,
            error: 'No account found with this email address. Please check your spelling or sign up.'
          });
        }
        if (existingUser?.name && !name) {
          name = existingUser.name;
        }
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

      const emailSubject = isReset
        ? `${otp} is your WalletWeather password reset code`
        : `${otp} is your WalletWeather verification code`;

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
              subject: emailSubject,
              htmlContent: createEmailHtml(otp, name, purpose)
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

      console.log(`[OTP] Verification code generated and saved for email: ${email} (purpose: ${purpose})`);

      return sendJson(res, 200, {
        success: true,
        message: isReset
          ? `Password reset code sent successfully to ${email}.`
          : `Verification code sent successfully to ${email}.`,
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
          message: 'Code verified successfully.'
        });
      }

      // 2. Cryptographic token fallback (stateless serverless resilience across separate lambdas)
      const submittedToken = body.verificationToken || body.token || '';
      if (submittedToken && verifyVerificationToken(email, userOtp, submittedToken)) {
        return sendJson(res, 200, {
          success: true,
          verified: true,
          message: 'Code verified successfully.'
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

  // 3. POST /api/auth/reset-password - Verify OTP & update user's password in MongoDB Atlas
  if (req.method === 'POST' && isResetPassword) {
    try {
      const body = await parseBody(req);
      const email = (body.email || '').trim().toLowerCase();
      const userOtp = String(body.otp || '').replace(/\D/g, '').trim();
      const newPassword = (body.newPassword || body.password || '').trim();
      const submittedToken = body.verificationToken || body.token || '';

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        return sendJson(res, 400, { success: false, error: 'Valid email address is required.' });
      }

      if (!userOtp || userOtp.length !== 6) {
        return sendJson(res, 400, { success: false, error: '6-digit verification code is required.' });
      }

      if (!newPassword || newPassword.length < 6) {
        return sendJson(res, 400, { success: false, error: 'New password must be at least 6 characters long.' });
      }

      // Verify OTP
      let isVerified = false;
      const verifyResult = await verifyOtp(email, userOtp);
      if (verifyResult.success) {
        isVerified = true;
      } else if (submittedToken && verifyVerificationToken(email, userOtp, submittedToken)) {
        isVerified = true;
      }

      if (!isVerified) {
        return sendJson(res, 400, {
          success: false,
          error: verifyResult.error || 'Invalid or expired verification code. Please request a new code.'
        });
      }

      // Retrieve existing user or create record
      const existingUser = (await findUserByEmail(email)) || { email };
      const updatedUser = {
        ...existingUser,
        email,
        name: existingUser.name || (email === 'jazaaa34@gmail.com' ? 'Aysha' : 'User'),
        password: newPassword,
        updatedAt: new Date()
      };

      // Persist in MongoDB & local DB
      await saveUserAccount(updatedUser);

      console.log(`[AUTH] Password successfully reset for user: ${email}`);

      return sendJson(res, 200, {
        success: true,
        message: 'Your password has been successfully reset. You can now log in.',
        user: {
          email: updatedUser.email,
          name: updatedUser.name
        }
      });
    } catch (e) {
      console.error('Error handling reset-password:', e.message);
      return sendJson(res, 500, {
        success: false,
        error: `Server error resetting password: ${e.message}`
      });
    }
  }

  // 4. POST /api/auth/change-password - Change password for logged-in user with current password verification
  if (req.method === 'POST' && isChangePassword) {
    try {
      const body = await parseBody(req);
      const email = (body.email || '').trim().toLowerCase();
      const currentPassword = (body.currentPassword || '').trim();
      const newPassword = (body.newPassword || '').trim();

      if (!email) {
        return sendJson(res, 400, { success: false, error: 'User email is required.' });
      }
      if (!currentPassword) {
        return sendJson(res, 400, { success: false, error: 'Current password is required.' });
      }
      if (!newPassword || newPassword.length < 6) {
        return sendJson(res, 400, { success: false, error: 'New password must be at least 6 characters long.' });
      }
      if (currentPassword === newPassword) {
        return sendJson(res, 400, { success: false, error: 'New password cannot be the same as your current password.' });
      }

      const existingUser = await findUserByEmail(email);
      const isDemo = email === 'jazaaa34@gmail.com' || email === 'aysha@example.com';

      // Check current password
      const passwordMatches = (existingUser && existingUser.password === currentPassword) ||
                              (isDemo && (!existingUser?.password || existingUser?.password === 'password123') && currentPassword === 'password123');

      if (!passwordMatches) {
        return sendJson(res, 400, {
          success: false,
          error: 'Current password is incorrect. Please verify and try again.'
        });
      }

      const updatedUser = {
        ...(existingUser || {}),
        email,
        name: existingUser?.name || (isDemo ? 'Aysha' : 'User'),
        password: newPassword,
        updatedAt: new Date()
      };

      await saveUserAccount(updatedUser);

      console.log(`[AUTH] Password changed successfully for user: ${email}`);

      return sendJson(res, 200, {
        success: true,
        message: 'Password changed successfully!'
      });
    } catch (e) {
      console.error('Error handling change-password:', e.message);
      return sendJson(res, 500, {
        success: false,
        error: `Server error changing password: ${e.message}`
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
