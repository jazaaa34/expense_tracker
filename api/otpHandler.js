// ==============================================================================
// BACKEND OTP & EMAIL VERIFICATION HANDLER - WALLETWEATHER WEB
// Powered by Brevo Transactional Email API
// Securely verifies user emails before account creation
// ==============================================================================

// In-memory store for OTPs: email -> { otp, expiresAt, attempts, name }
const otpStore = new Map();

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) {
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

export async function handleOtpApi(req, res, brevoApiKey, senderEmail = 'jazaaa34@gmail.com', senderName = 'WalletWeather') {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // 1. POST /api/auth/send-otp - Generate OTP and dispatch via Brevo
  if (req.method === 'POST' && pathname === '/api/auth/send-otp') {
    if (!brevoApiKey) {
      return sendJson(res, 503, {
        success: false,
        error: 'BREVO_API_KEY is not configured on the server. Please add BREVO_API_KEY in your .env file.',
        code: 'BREVO_KEY_MISSING'
      });
    }

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

      // Check rate-limiting per email (minimum 15 seconds between requests)
      const existing = otpStore.get(email);
      if (existing && Date.now() - existing.createdAt < 15000) {
        return sendJson(res, 429, {
          success: false,
          error: 'Please wait a few seconds before requesting another verification code.'
        });
      }

      const otp = generateOtp();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      // Call Brevo transactional email endpoint
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
        console.error('Brevo API Error:', msg);
        return sendJson(res, 502, {
          success: false,
          error: `Failed to send email via Brevo: ${msg}`,
          code: 'EMAIL_SEND_FAILED'
        });
      }

      // Save OTP in store
      otpStore.set(email, {
        otp,
        expiresAt,
        createdAt: Date.now(),
        attempts: 0,
        name
      });

      return sendJson(res, 200, {
        success: true,
        message: `Verification code sent successfully to ${email}.`,
        expiresInSeconds: 600
      });
    } catch (e) {
      console.error('Error handling send-otp:', e);
      return sendJson(res, 500, {
        success: false,
        error: `Server error sending verification code: ${e.message}`
      });
    }
  }

  // 2. POST /api/auth/verify-otp - Verify user submitted OTP
  if (req.method === 'POST' && pathname === '/api/auth/verify-otp') {
    try {
      const body = await parseBody(req);
      const email = (body.email || '').trim().toLowerCase();
      const userOtp = (body.otp || '').trim();

      if (!email || !userOtp) {
        return sendJson(res, 400, {
          success: false,
          error: 'Email and 6-digit verification code are required.'
        });
      }

      const record = otpStore.get(email);

      if (!record) {
        return sendJson(res, 400, {
          success: false,
          error: 'No active verification code found for this email. Please click "Resend Code".'
        });
      }

      if (Date.now() > record.expiresAt) {
        otpStore.delete(email);
        return sendJson(res, 400, {
          success: false,
          error: 'Verification code has expired. Please request a new code.'
        });
      }

      record.attempts += 1;
      if (record.attempts > 5) {
        otpStore.delete(email);
        return sendJson(res, 429, {
          success: false,
          error: 'Too many incorrect attempts. Please request a fresh verification code.'
        });
      }

      if (record.otp !== userOtp) {
        const remaining = 5 - record.attempts;
        return sendJson(res, 400, {
          success: false,
          error: `Incorrect verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Code expired.'}`
        });
      }

      // Successful verification! Clean up OTP
      otpStore.delete(email);

      return sendJson(res, 200, {
        success: true,
        verified: true,
        message: 'Email verified successfully.'
      });
    } catch (e) {
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
