import { handleOtpApi } from '../otpHandler.js';

export default async function handler(req, res) {
  const brevoKey = process.env.BREVO_API_KEY || '';
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'jazaaa34@gmail.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'WalletWeather';
  return handleOtpApi(req, res, brevoKey, senderEmail, senderName, 'verify');
}
