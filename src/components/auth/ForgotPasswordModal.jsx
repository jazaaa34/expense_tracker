import React, { useState, useEffect, useRef } from 'react';
import Modal from '../common/Modal';
import { apiRequest } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { Mail, Lock, KeyRound, CheckCircle2, ArrowRight, RefreshCw, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function ForgotPasswordModal({ isOpen, onClose, initialEmail = '', onSuccessLogin }) {
  const { resetPassword, login } = useAuth();
  
  // Steps: 'email' | 'code_and_password' | 'success'
  const [step, setStep] = useState('email');
  
  const [email, setEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [verificationToken, setVerificationToken] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  
  const otpInputsRef = useRef([]);

  // Sync initial email when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialEmail && initialEmail.includes('@')) {
        setEmail(initialEmail.trim());
      }
      setStep('email');
      setError('');
      setInfoMessage('');
      setOtpDigits(['', '', '', '', '', '']);
      setNewPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  }, [isOpen, initialEmail]);

  // Resend cooldown timer
  useEffect(() => {
    let timer = null;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendCooldown]);

  // Handle Step 1: Send Reset Code
  const handleSendResetCode = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setInfoMessage('');

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      const { ok, data } = await apiRequest('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({
          email: cleanEmail,
          purpose: 'reset'
        })
      });

      if (!ok || !data?.success) {
        throw new Error(data?.error || 'Unable to send password reset code. Please check your email.');
      }

      if (data?.verificationToken) {
        setVerificationToken(data.verificationToken);
      }

      setResendCooldown(60);
      setStep('code_and_password');
      setInfoMessage(`We've sent a 6-digit reset code to ${cleanEmail}. Please check your inbox.`);
      
      // Auto focus first OTP input after render
      setTimeout(() => {
        if (otpInputsRef.current[0]) {
          otpInputsRef.current[0].focus();
        }
      }, 150);
    } catch (err) {
      setError(err.message || 'Error requesting password reset.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Resend
  const handleResend = async () => {
    if (resendCooldown > 0 || isLoading) return;
    setError('');
    setInfoMessage('');
    setIsLoading(true);

    try {
      const { ok, data } = await apiRequest('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          purpose: 'reset'
        })
      });

      if (!ok || !data?.success) {
        throw new Error(data?.error || 'Failed to resend code.');
      }

      if (data?.verificationToken) {
        setVerificationToken(data.verificationToken);
      }

      setResendCooldown(60);
      setInfoMessage('A fresh 6-digit code has been dispatched to your email.');
    } catch (err) {
      setError(err.message || 'Error resending code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP digit changes & paste
  const handleOtpChange = (index, val) => {
    const raw = val.replace(/\D/g, '');
    if (!raw) {
      const copy = [...otpDigits];
      copy[index] = '';
      setOtpDigits(copy);
      return;
    }

    // If user pasted multi digits (e.g. 6 digits)
    if (raw.length > 1) {
      const pasted = raw.slice(0, 6).split('');
      const copy = [...otpDigits];
      pasted.forEach((d, i) => {
        if (index + i < 6) copy[index + i] = d;
      });
      setOtpDigits(copy);
      const nextIdx = Math.min(5, index + pasted.length);
      if (otpInputsRef.current[nextIdx]) {
        otpInputsRef.current[nextIdx].focus();
      }
      return;
    }

    const copy = [...otpDigits];
    copy[index] = raw[0];
    setOtpDigits(copy);

    if (index < 5 && raw[0]) {
      if (otpInputsRef.current[index + 1]) {
        otpInputsRef.current[index + 1].focus();
      }
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      if (otpInputsRef.current[index - 1]) {
        otpInputsRef.current[index - 1].focus();
      }
    }
  };

  // Handle Step 2: Finalize Reset Password
  const handleFinalizeReset = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setInfoMessage('');

    const code = otpDigits.join('').trim();
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify both fields.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await resetPassword({
        email: email.trim().toLowerCase(),
        otp: code,
        newPassword,
        verificationToken
      });

      if (!result.success) {
        throw new Error(result.message || 'Unable to reset password.');
      }

      // Success! Fire celebratory confetti
      try {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {}

      setStep('success');
    } catch (err) {
      setError(err.message || 'Error completing password reset.');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-login or sign in with new credentials
  const handleSignInNow = async () => {
    setIsLoading(true);
    try {
      const res = await login(email, newPassword, true);
      if (res.success) {
        onClose();
        if (onSuccessLogin) onSuccessLogin();
      } else {
        // If auto-login fails, simply close modal so user can login manually
        onClose();
      }
    } catch {
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  // Password strength helper
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { label: '', color: '#CBD5E1', percent: 0 };
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 10) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 1) return { label: 'Weak', color: '#EF4444', percent: 25 };
    if (score <= 3) return { label: 'Moderate', color: '#F59E0B', percent: 65 };
    return { label: 'Strong', color: '#10B981', percent: 100 };
  };

  const strength = getPasswordStrength(newPassword);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={step === 'success' ? 'Password Reset Complete' : 'Reset Your Password'}
      subtitle={
        step === 'email'
          ? 'Enter your registered email to receive a secure recovery code'
          : step === 'code_and_password'
          ? `Enter the 6-digit code sent to ${email} and set your new password`
          : 'Your account security has been updated'
      }
      maxWidth="480px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Step Progress Pills */}
        {step !== 'success' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            paddingBottom: '4px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              fontWeight: 800,
              color: step === 'email' ? 'var(--primary)' : 'var(--income-green)',
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor: step === 'email' ? 'rgba(30, 41, 59, 0.08)' : 'var(--income-light)'
            }}>
              <span>1. Email</span>
              {step === 'code_and_password' && <CheckCircle2 size={12} />}
            </div>
            <div style={{ width: '20px', height: '1.5px', backgroundColor: 'var(--border-light)' }} />
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              fontWeight: 800,
              color: step === 'code_and_password' ? 'var(--primary)' : 'var(--text-muted)',
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor: step === 'code_and_password' ? 'rgba(30, 41, 59, 0.08)' : 'transparent'
            }}>
              <span>2. Code & New Password</span>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div style={{
            padding: '12px 14px',
            borderRadius: '12px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5',
            color: '#B91C1C',
            fontSize: '0.8125rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Info Alert */}
        {infoMessage && (
          <div style={{
            padding: '12px 14px',
            borderRadius: '12px',
            backgroundColor: '#EFF6FF',
            border: '1px solid #BFDBFE',
            color: '#1D4ED8',
            fontSize: '0.8125rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <ShieldCheck size={18} style={{ flexShrink: 0 }} />
            <span>{infoMessage}</span>
          </div>
        )}

        {/* STEP 1: Email Form */}
        {step === 'email' && (
          <form onSubmit={handleSendResetCode} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 800,
                color: 'var(--text-secondary)',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                Registered Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={16}
                  color="var(--text-muted)"
                  style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: '100%',
                    height: '46px',
                    paddingLeft: '40px',
                    paddingRight: '14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1.2px solid var(--border-light)',
                    fontSize: '0.9375rem',
                    backgroundColor: '#FFFFFF',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>
            </div>

            <div style={{
              fontSize: '0.8125rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              backgroundColor: 'var(--bg-card-subtle, #F8FAFC)',
              padding: '12px 14px',
              borderRadius: '10px',
              border: '1px solid var(--border-light)'
            }}>
              💡 We will send a secure 6-digit recovery code through Brevo transactional email to ensure only you can reset this password.
            </div>

            <button
              type="submit"
              disabled={isLoading || !email}
              className="btn btn-primary"
              style={{
                height: '46px',
                fontSize: '0.9375rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: isLoading || !email ? 'not-allowed' : 'pointer',
                opacity: isLoading || !email ? 0.7 : 1
              }}
            >
              {isLoading ? (
                <>
                  <RefreshCw size={16} className="spin" />
                  <span>Sending Recovery Code...</span>
                </>
              ) : (
                <>
                  <span>Send Recovery Code</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: Code and New Password Form */}
        {step === 'code_and_password' && (
          <form onSubmit={handleFinalizeReset} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Email badge with switch option */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              backgroundColor: 'var(--bg-card-subtle, #F8FAFC)',
              borderRadius: '10px',
              border: '1px solid var(--border-light)',
              fontSize: '0.8125rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                <Mail size={14} />
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{email}</span>
              </div>
              <button
                type="button"
                onClick={() => setStep('email')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-honey)',
                  fontWeight: 800,
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                Change
              </button>
            </div>

            {/* 6-Digit Code Inputs */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  6-Digit Verification Code
                </label>
                <button
                  type="button"
                  disabled={resendCooldown > 0 || isLoading}
                  onClick={handleResend}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: resendCooldown > 0 ? 'var(--text-muted)' : 'var(--accent-honey)',
                    cursor: resendCooldown > 0 ? 'default' : 'pointer'
                  }}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpInputsRef.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    style={{
                      width: '46px',
                      height: '52px',
                      textAlign: 'center',
                      fontSize: '1.35rem',
                      fontWeight: 900,
                      fontFamily: 'monospace',
                      borderRadius: '10px',
                      border: digit ? '2px solid var(--primary)' : '1.5px solid var(--border-light)',
                      backgroundColor: digit ? 'rgba(30, 41, 59, 0.04)' : '#FFFFFF',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      transition: 'all 0.15s ease'
                    }}
                  />
                ))}
              </div>
            </div>

            {/* New Password Input */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 800,
                color: 'var(--text-secondary)',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={16}
                  color="var(--text-muted)"
                  style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Min. 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{
                    width: '100%',
                    height: '46px',
                    paddingLeft: '40px',
                    paddingRight: '40px',
                    borderRadius: 'var(--radius-md)',
                    border: '1.2px solid var(--border-light)',
                    fontSize: '0.9375rem'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)'
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Password strength bar */}
              {newPassword && (
                <div style={{ marginTop: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Strength</span>
                    <span style={{ color: strength.color, fontWeight: 700, fontSize: '0.7rem' }}>{strength.label}</span>
                  </div>
                  <div style={{ width: '100%', height: '4px', backgroundColor: '#E2E8F0', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${strength.percent}%`,
                      height: '100%',
                      backgroundColor: strength.color,
                      transition: 'all 0.3s ease'
                    }} />
                  </div>
                </div>
              )}
            </div>

            {/* Confirm New Password Input */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 800,
                color: 'var(--text-secondary)',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                Confirm New Password
              </label>
              <div style={{ position: 'relative' }}>
                <KeyRound
                  size={16}
                  color="var(--text-muted)"
                  style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{
                    width: '100%',
                    height: '46px',
                    paddingLeft: '40px',
                    paddingRight: '40px',
                    borderRadius: 'var(--radius-md)',
                    border: '1.2px solid var(--border-light)',
                    fontSize: '0.9375rem'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)'
                  }}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary"
              style={{
                height: '46px',
                fontSize: '0.9375rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '4px',
                cursor: isLoading ? 'not-allowed' : 'pointer'
              }}
            >
              {isLoading ? (
                <>
                  <RefreshCw size={16} className="spin" />
                  <span>Resetting Password...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={18} />
                  <span>Update Password & Save</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 3: Success Screen */}
        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '16px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              backgroundColor: 'var(--income-light, #ECFDF5)',
              color: 'var(--income-green, #10B981)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.2)'
            }}>
              <CheckCircle2 size={36} />
            </div>

            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Password Reset Successfully!
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: '340px', lineHeight: 1.5 }}>
                Your account password has been securely updated in our database. You can now access all your financial analytics.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSignInNow}
              disabled={isLoading}
              className="btn btn-primary"
              style={{
                width: '100%',
                height: '46px',
                fontSize: '0.9375rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '8px'
              }}
            >
              {isLoading ? (
                <>
                  <RefreshCw size={16} className="spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In To WalletWeather</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        )}

      </div>
    </Modal>
  );
}
