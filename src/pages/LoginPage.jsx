import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Lock, Mail } from 'lucide-react';
import ForgotPasswordModal from '../components/auth/ForgotPasswordModal';

export default function LoginPage({ onNavigateIntro, onNavigateSignup }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const res = await login(email, password, rememberMe);
    if (!res.success) {
      setError(res.message || 'Login failed.');
      setIsLoading(false);
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
      <div style={{ width: '100%', maxWidth: '440px' }}>
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
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '16px',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <Lock size={24} />
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)' }}>
              Sign In to WalletWeather
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
              Access your financial weather forecast & live accounts
            </p>
          </div>

          {error && (
            <div style={{
              padding: '12px',
              borderRadius: '10px',
              backgroundColor: 'var(--expense-light)',
              color: 'var(--expense-red)',
              fontSize: '0.8125rem',
              fontWeight: 700,
              marginBottom: '18px',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
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
                  placeholder="••••••••"
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

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                Remember me
              </label>
              <button
                type="button"
                onClick={() => setIsForgotPasswordOpen(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-honey)',
                  fontWeight: 800,
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                height: '48px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '0.9375rem',
                marginTop: '10px',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Don't have an account?{' '}
            <button
              onClick={onNavigateSignup}
              style={{ color: 'var(--primary)', fontWeight: 800, textDecoration: 'underline' }}
            >
              Sign Up
            </button>
          </div>
        </div>
      </div>

      {/* Real Interactive Password Reset Modal */}
      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        initialEmail={email}
      />
    </div>
  );
}
