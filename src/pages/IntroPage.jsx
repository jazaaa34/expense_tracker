import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function IntroPage({ onNavigateLogin, onNavigateSignup }) {
  const { savedSession, login } = useAuth();

  const handleLaunchDashboard = async () => {
    if (savedSession) {
      await login(savedSession.email, savedSession.password || 'password123', true);
    } else {
      onNavigateSignup();
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Upper Navigation Bar */}
      <header style={{
        padding: '24px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto'
      }}>
        {/* WalletWeather in upper part */}
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
          <span style={{
            fontSize: '1.25rem',
            fontWeight: 900,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)'
          }}>
            WalletWeather
          </span>
        </div>

        {/* Sign In & Get Started */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={onNavigateLogin}
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-light)',
              backgroundColor: 'var(--surface-card)',
              color: 'var(--text-primary)',
              fontWeight: 700,
              fontSize: '0.875rem',
              cursor: 'pointer'
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
              border: 'none',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.875rem',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            Get Started
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main style={{
        flex: 1,
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto',
        padding: '48px 32px 80px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '56px',
        alignItems: 'center'
      }}>
        {/* Left: Heading and Actions */}
        <div>
          <h1 style={{
            fontSize: 'clamp(2.4rem, 4vw, 3.25rem)',
            fontWeight: 900,
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
            color: 'var(--text-primary)',
            marginBottom: '32px'
          }}>
            Smart Money Tracking That <span style={{ color: 'var(--accent-honey)' }}>Predicts</span> & <span style={{ color: 'var(--expense-red)' }}>Alerts</span>
          </h1>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleLaunchDashboard}
              style={{
                height: '52px',
                padding: '0 28px',
                borderRadius: '16px',
                backgroundColor: 'var(--primary)',
                border: 'none',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '1rem',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-hero)'
              }}
            >
              Launch Your Dashboard
            </button>

            <button
              onClick={onNavigateLogin}
              style={{
                height: '52px',
                padding: '0 24px',
                borderRadius: '16px',
                backgroundColor: 'var(--surface-card)',
                border: '1.2px solid var(--border-light)',
                color: 'var(--text-primary)',
                fontWeight: 800,
                fontSize: '0.9375rem',
                cursor: 'pointer'
              }}
            >
              Sign In
            </button>
          </div>
        </div>

        {/* Right: That Photo */}
        <div>
          <div style={{
            overflow: 'hidden',
            borderRadius: '28px',
            boxShadow: 'var(--shadow-hero)',
            border: '2px solid var(--border-light)'
          }}>
            <img 
              src="/tracking_hero.jpg" 
              alt="WalletWeather tracking hero" 
              style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover' }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
