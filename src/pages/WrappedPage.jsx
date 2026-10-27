import React, { useState, useRef, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { formatINR } from '../services/storageService';
import { RefreshCw, Share2, Sparkles, Award } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function WrappedPage() {
  const { expense, savedAmount, transactions, user } = useWallet();
  const [seed, setSeed] = useState(2026);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef(null);

  // Generative Canvas Art based on seed (Matching Flutter ArtPainter)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Warm luxury gradient background
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#2D1A12');
    bgGrad.addColorStop(1, '#1A0E08');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Pseudorandom generator based on seed
    let s = seed;
    const random = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };

    const colors = ['#8C532B', '#B46E2E', '#F5EFE9', '#16A34A', '#FF6584'];

    // Draw generative fluid orbital rings
    for (let i = 0; i < 28; i++) {
      ctx.beginPath();
      const cx = width * (0.3 + 0.4 * random());
      const cy = height * (0.3 + 0.4 * random());
      const r = 30 + 120 * random();
      const col = colors[Math.floor(random() * colors.length)];

      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5 + 3 * random();
      ctx.globalAlpha = 0.25 + 0.35 * random();
      ctx.stroke();
    }

    ctx.globalAlpha = 1.0;
  }, [seed]);

  const handleShare = () => {
    confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } });
    const text = `🌟 My WalletWeather Monthly Summary:\n` +
      `Total Outflow Tracked: ${formatINR(expense)}\n` +
      `Impulse Money Protected: ${formatINR(savedAmount)}\n` +
      `Check your financial weather on WalletWeather!`;

    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '640px', margin: '0 auto' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
          Monthly Wallet Wrapped
        </h1>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          A visual overview of your monthly spending patterns and behavioral fingerprint
        </p>
      </div>

      {/* Canvas Artwork Card */}
      <div className="card" style={{ padding: '16px', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          width={560}
          height={380}
          style={{ width: '100%', height: 'auto', borderRadius: '18px', display: 'block' }}
        />
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '14px',
          padding: '0 8px'
        }}>
          <button
            onClick={() => setSeed(Math.floor(Math.random() * 99999))}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              backgroundColor: 'var(--surface-muted)',
              color: 'var(--text-primary)',
              fontWeight: 700,
              fontSize: '0.8125rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={14} />
            <span>New Visual</span>
          </button>

          <button
            onClick={handleShare}
            style={{
              padding: '8px 20px',
              borderRadius: '10px',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.8125rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Share2 size={14} />
            <span>{copied ? 'Summary Copied!' : 'Share Summary'}</span>
          </button>
        </div>
      </div>

      {/* Personality Badge & Summary Highlights */}
      <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '16px',
            backgroundColor: 'var(--income-light)',
            color: 'var(--income-green)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Award size={26} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Your Financial Personality
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)' }}>
              "The Mindful Optimizer"
            </div>
          </div>
        </div>

        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          You consistently pause before making impulse purchases, saving a cumulative <strong>{formatINR(savedAmount)}</strong> this cycle. Your primary expenditures lean heavily towards essentials and planned dining.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
          borderTop: '1px solid var(--border-light)',
          paddingTop: '16px'
        }}>
          <div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>TOTAL TRACKED</div>
            <div style={{ fontSize: '1.125rem', fontWeight: 900, color: 'var(--text-primary)' }}>{formatINR(expense)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>IMPULSE PROTECTED</div>
            <div style={{ fontSize: '1.125rem', fontWeight: 900, color: 'var(--income-green)' }}>{formatINR(savedAmount)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>TRANSACTIONS</div>
            <div style={{ fontSize: '1.125rem', fontWeight: 900, color: 'var(--primary)' }}>{transactions.length}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
