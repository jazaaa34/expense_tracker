import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { storageService, STORAGE_KEYS } from '../services/storageService';
import { ArrowLeft, UserPlus, Mail, Lock, User, KeyRound, CheckCircle2, RefreshCw, ArrowRight, Edit2, ShieldCheck } from 'lucide-react';

export default function SignupPage({ onNavigateIntro, onNavigateLogin }) {
  const { signUp } = useAuth();
  const [step, setStep] = useState('details'); // 'details' | 'otp'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // OTP state
  const [otp, setOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Timer countdown effect
  useEffect(() => {
    let interval = null;
    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendCooldown]);

  // Step 1: Validate details and send OTP via Brevo API
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanName) {
      setError('Please enter your full name.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    // Check if account already exists
    const registered = storageService.get(STORAGE_KEYS.REGISTERED_USERS, {});
    if (registered[cleanEmail]) {
      setError('An account with this email already exists. Please sign in instead.');
      return;
    }

    setIsSendingOtp(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, name: cleanName })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send verification email.');
      }

      setStep('otp');
      setResendCooldown(60);
      setInfoMessage(`We've sent a 6-digit verification code to ${cleanEmail}.`);
    } catch (err) {
      setError(err.message || 'Error sending verification code.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isSendingOtp) return;
    setError('');
    setInfoMessage('');
    setIsSendingOtp(true);

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), name: name.trim() })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to resend code.');
      }

      setResendCooldown(60);
      setInfoMessage('A fresh verification code has been dispatched to your email.');
    } catch (err) {
      setError(err.message || 'Error resending code.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Step 2: Verify OTP and finalize signup
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      setError('Please enter all 6 digits of the verification code.');
      return;
    }

    setError('');
    setInfoMessage('');
    setIsVerifying(true);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: cleanOtp
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Verification failed.');
      }

      // OTP verified! Create user account in AuthContext
      const signRes = await signUp(name, email, password, rememberMe);
      if (!signRes.success) {
        setError(signRes.message || 'Signup failed after verification.');
        setIsVerifying(false);
      }
      // On success, AuthContext sets current user and App automatically redirects
    } catch (err) {
      setError(err.message || 'Incorrect verification code.');
      setIsVerifying(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '24px'
    }}>
      <div style={{ width: '100%', maxWidth: '480px' }}>
        <button
          onClick={onNavigateIntro}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.875rem',
            marginBottom: '24px'
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Home</span>
        </button>

        <div className="card" style={{ padding: '36px 32px' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              backgroundColor: step === 'otp' ? 'var(--income-green)' : 'var(--primary)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 8px 16px rgba(0,0,0,0.08)',
              transition: 'all 0.3s ease'
            }}>
              {step === 'otp' ? <KeyRound size={26} /> : <UserPlus size={26} />}
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)' }}>
              {step === 'otp' ? 'Verify Your Email' : 'Create Your Account'}
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
              {step === 'otp'
                ? 'Enter the 6-digit verification code sent to your email'
                : 'Start mastering your money with WalletWeather'}
            </p>
          </div>

          {/* Error Message Banner */}
          {error && (
            <div style={{
              padding: '12px 14px',
              borderRadius: '10px',
              backgroundColor: 'var(--expense-light)',
              color: 'var(--expense-red)',
              fontSize: '0.8125rem',
              fontWeight: 700,
              marginBottom: '18px',
              textAlign: 'center',
              lineHeight: 1.4
            }}>
              {error}
            </div>
          )}

          {/* Info Message Banner */}
          {infoMessage && (
            <div style={{
              padding: '12px 14px',
              borderRadius: '10px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: 'var(--income-green)',
              fontSize: '0.8125rem',
              fontWeight: 700,
              marginBottom: '18px',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              lineHeight: 1.4
            }}>
              <CheckCircle2 size={16} />
              <span>{infoMessage}</span>
            </div>
          )}

          {/* STEP 1: Registration Details */}
          {step === 'details' && (
            <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Full Name
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Aysha Jaza"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{
                      width: '100%',
                      height: '46px',
                      paddingLeft: '40px',
                      paddingRight: '14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1.2px solid var(--border-light)'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: '100%',
                      height: '46px',
                      paddingLeft: '40px',
                      paddingRight: '14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1.2px solid var(--border-light)'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="password"
                    required
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: '100%',
                      height: '46px',
                      paddingLeft: '40px',
                      paddingRight: '14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1.2px solid var(--border-light)'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Confirm Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="password"
                    required
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{
                      width: '100%',
                      height: '46px',
                      paddingLeft: '40px',
                      paddingRight: '14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1.2px solid var(--border-light)'
                    }}
                  />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.8125rem', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                Remember this session on this device
              </label>

              <button
                type="submit"
                disabled={isSendingOtp}
                style={{
                  height: '48px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '0.9375rem',
                  marginTop: '10px',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: isSendingOtp ? 'not-allowed' : 'pointer',
                  opacity: isSendingOtp ? 0.8 : 1
                }}
              >
                {isSendingOtp ? (
                  <>
                    <RefreshCw size={18} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Sending Code...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Email & Continue</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 2: OTP Verification Screen */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Target Email Summary Card */}
              <div style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-light)',
                borderRadius: '12px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Mail size={18} color="var(--primary)" />
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Sent to:</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 800 }}>{email}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStep('details');
                    setError('');
                    setInfoMessage('');
                  }}
                  title="Edit details"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.75rem',
                    color: 'var(--primary)',
                    fontWeight: 700,
                    padding: '6px 10px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(59, 130, 246, 0.08)'
                  }}
                >
                  <Edit2 size={13} />
                  <span>Edit</span>
                </button>
              </div>

              {/* OTP Digits Input */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  color: 'var(--text-secondary)',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  textAlign: 'center'
                }}>
                  Enter 6-Digit Code
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoFocus
                    placeholder="• • • • • •"
                    value={otp}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setOtp(val);
                      if (error) setError('');
                    }}
                    style={{
                      width: '100%',
                      height: '56px',
                      fontSize: '1.75rem',
                      fontWeight: 900,
                      textAlign: 'center',
                      letterSpacing: '12px',
                      fontFamily: 'monospace',
                      borderRadius: 'var(--radius-md)',
                      border: '2px solid var(--primary)',
                      backgroundColor: 'var(--card-bg)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>
                <div style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  marginTop: '8px',
                  textAlign: 'center'
                }}>
                  ⏱️ Code expires in 10 minutes. Check spam folder if not received.
                </div>
              </div>

              {/* Verify & Create Account Button */}
              <button
                type="submit"
                disabled={isVerifying || otp.length !== 6}
                style={{
                  height: '48px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--income-green)',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '0.9375rem',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: (isVerifying || otp.length !== 6) ? 'not-allowed' : 'pointer',
                  opacity: (isVerifying || otp.length !== 6) ? 0.7 : 1
                }}
              >
                {isVerifying ? (
                  <>
                    <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    <span>Verify & Create Account</span>
                  </>
                )}
              </button>

              {/* Resend Action */}
              <div style={{ textAlign: 'center', paddingTop: '4px' }}>
                {resendCooldown > 0 ? (
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Resend code in <strong style={{ color: 'var(--text-primary)' }}>{resendCooldown}s</strong>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={isSendingOtp}
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--primary)',
                      fontWeight: 800,
                      textDecoration: 'underline',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <RefreshCw size={14} className={isSendingOtp ? 'spin' : ''} />
                    <span>Didn't get the code? Resend Email</span>
                  </button>
                )}
              </div>
            </form>
          )}

          <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Already have an account?{' '}
            <button
              onClick={onNavigateLogin}
              style={{ color: 'var(--primary)', fontWeight: 800, textDecoration: 'underline' }}
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
