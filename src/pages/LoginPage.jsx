import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Lock, Mail } from 'lucide-react';

export default function LoginPage({ onNavigateIntro, onNavigateSignup }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('jazaaa34@gmail.com');
  const [password, setPassword] = useState('password123');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

  const handleFillDemo = () => {
    setEmail('jazaaa34@gmail.com');
    setPassword('password123');
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

          <div style={{
            padding: '12px 16px',
            borderRadius: '12px',
            backgroundColor: 'var(--surface-muted)',
            border: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px'
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-honey)' }}>
                Saved Demo Account (Aysha):
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                jazaaa34@gmail.com / password123
              </div>
            </div>
            <button
              type="button"
              onClick={handleFillDemo}
              style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                color: 'var(--primary)',
                textDecoration: 'underline',
                cursor: 'pointer'
              }}
            >
              Fill Aysha
            </button>
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
                  placeholder="aysha@example.com"
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
                onClick={() => alert('Password reset link sent to registered email.')}
                style={{ color: 'var(--accent-honey)', fontWeight: 700 }}
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
    </div>
  );
}
