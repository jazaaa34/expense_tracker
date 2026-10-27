import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, Shield, Zap, Sparkles, UserCheck } from 'lucide-react';

export default function IntroPage({ onNavigateLogin, onNavigateSignup }) {
  const { savedSession, login } = useAuth();

  const handleQuickResume = async () => {
    if (savedSession) {
      await login(savedSession.email, savedSession.password || 'password123', true);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <header style={{
        padding: '24px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '14px',
            backgroundColor: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF'
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
              <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '1.125rem', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              WalletWeather
            </div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Predicts, Pauses & Personalises
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onNavigateLogin}
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontWeight: 700,
              fontSize: '0.875rem'
            }}
          >
            Sign In
          </button>
          <button
            onClick={onNavigateSignup}
            style={{
              padding: '10px 22px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.875rem',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            Get Started
          </button>
        </div>
      </header>

      <div style={{
        flex: 1,
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto',
        padding: '32px 32px 64px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '48px',
        alignItems: 'center'
      }}>
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--surface-muted)',
            border: '1px solid var(--border-light)',
            fontSize: '0.8125rem',
            fontWeight: 800,
            color: 'var(--accent-honey)',
            marginBottom: '20px'
          }}>
            <Sparkles size={14} />
            <span>Next-Gen Behavioral Expense Tracking</span>
          </div>

          <h1 style={{
            fontSize: '3rem',
            fontWeight: 900,
            lineHeight: 1.15,
            letterSpacing: '-0.04em',
            color: 'var(--text-primary)',
            marginBottom: '20px'
          }}>
            Smart Money Tracking That <span style={{ color: 'var(--accent-honey)' }}>Predicts</span> & <span style={{ color: 'var(--expense-red)' }}>Alerts</span>
          </h1>

          <p style={{
            fontSize: '1.125rem',
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
            marginBottom: '32px',
            maxWidth: '520px'
          }}>
            Stop tracking in the rearview mirror. WalletWeather analyzes peak spending days, detects double charges, and coaches you with integrated Groq AI intelligence.
          </p>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            {savedSession ? (
              <button
                onClick={handleQuickResume}
                style={{
                  height: '52px',
                  padding: '0 26px',
                  borderRadius: '16px',
                  backgroundColor: 'var(--income-green)',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: 'var(--shadow-md)'
                }}
              >
                <UserCheck size={20} />
                <span>Continue as {savedSession.name || 'Aysha'}</span>
                <ArrowRight size={18} />
              </button>
            ) : (
              <button
                onClick={onNavigateSignup}
                style={{
                  height: '52px',
                  padding: '0 26px',
                  borderRadius: '16px',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: 'var(--shadow-hero)'
                }}
              >
                <span>Launch Your Dashboard</span>
                <ArrowRight size={18} />
              </button>
            )}

            <button
              onClick={onNavigateLogin}
              style={{
                height: '52px',
                padding: '0 22px',
                borderRadius: '16px',
                backgroundColor: 'var(--surface-card)',
                border: '1.2px solid var(--border-light)',
                color: 'var(--text-primary)',
                fontWeight: 800,
                fontSize: '0.9375rem'
              }}
            >
              Sign In with Account
            </button>
          </div>

          <div style={{ display: 'flex', gap: '24px', marginTop: '48px' }}>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--expense-red)' }}>Peak Day</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Expense Analysis</div>
            </div>
            <div style={{ width: '1px', height: '40px', backgroundColor: 'var(--border-light)' }} />
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--primary)' }}>24/7</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Money Guard Alerts</div>
            </div>
            <div style={{ width: '1px', height: '40px', backgroundColor: 'var(--border-light)' }} />
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--accent-honey)' }}>GPT-OSS</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Groq AI Advisor</div>
            </div>
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <div className="card" style={{
            overflow: 'hidden',
            borderRadius: '28px',
            boxShadow: 'var(--shadow-hero)',
            border: '2px solid var(--border-light)'
          }}>
            <img 
              src="/tracking_hero.jpg" 
              alt="WalletWeather tracking hero" 
              style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <div style={{
              padding: '24px',
              backgroundColor: '#FFFFFF',
              borderTop: '1px solid var(--border-light)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--income-green)', textTransform: 'uppercase' }}>
                  Live MoneyGuard Protection
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Active Shield
                </span>
              </div>
              <div style={{ fontSize: '1.125rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                "Duplicate Charge & Subscription Surge Detected"
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Automated algorithms safeguard your wallet from silent price hikes and rogue subscriptions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
