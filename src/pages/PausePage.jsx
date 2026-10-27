import React, { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { formatINR } from '../services/storageService';
import BreathModal from '../components/pause/BreathModal';
import { ShieldAlert, Zap, PiggyBank, HeartHandshake } from 'lucide-react';

export default function PausePage() {
  const { savedAmount, addSavedAmount } = useWallet();
  const [amount, setAmount] = useState('1800');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState('');

  const handleSimulate = (e) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (!isNaN(val) && val > 0) {
      setIsModalOpen(true);
    }
  };

  const handleSkipAndSave = (savedVal) => {
    addSavedAmount(savedVal);
    setSavedSuccess(`Great choice! You just prevented an impulse purchase and saved ${formatINR(savedVal)}.`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '780px', margin: '0 auto' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
          Mindful Pause & Save
        </h1>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          Experience the scientific impulse shopping breaker before you spend
        </p>
      </div>

      {/* Simulated Context Alert Card */}
      <div style={{
        padding: '20px',
        borderRadius: '20px',
        backgroundColor: 'var(--warning-light)',
        border: '1.2px solid rgba(217, 119, 6, 0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{
          width: '46px',
          height: '46px',
          borderRadius: '14px',
          backgroundColor: 'rgba(217, 119, 6, 0.2)',
          color: 'var(--warning-amber)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <Zap size={24} />
        </div>
        <div>
          <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            High-Risk Moment Simulation
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.4 }}>
            11:42 PM • Late night browsing • Shopping Cart checkout ready • Monthly budget at 90% reached.
          </p>
        </div>
      </div>

      {savedSuccess && (
        <div style={{
          padding: '16px 20px',
          borderRadius: '14px',
          backgroundColor: 'var(--income-light)',
          color: 'var(--income-green)',
          fontSize: '0.875rem',
          fontWeight: 800,
          border: '1px solid var(--income-green)'
        }}>
          🎉 {savedSuccess}
        </div>
      )}

      {/* Input Simulation Card */}
      <div className="card" style={{ padding: '28px' }}>
        <form onSubmit={handleSimulate} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>
              Simulated Purchase Amount
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-secondary)' }}>
                ₹
              </span>
              <input
                type="number"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{
                  width: '100%',
                  height: '52px',
                  paddingLeft: '38px',
                  paddingRight: '16px',
                  fontSize: '1.375rem',
                  fontWeight: 900,
                  borderRadius: 'var(--radius-md)',
                  border: '1.2px solid var(--border-light)'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            style={{
              height: '50px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.9375rem',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            Simulate Checkout & Take Mindful Pause
          </button>
        </form>
      </div>

      {/* Cumulative Saved Stat */}
      <div className="card" style={{ padding: '28px', display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '18px',
          backgroundColor: 'var(--income-light)',
          color: 'var(--income-green)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <PiggyBank size={32} />
        </div>
        <div>
          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            Total Saved By Pausing
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--income-green)', letterSpacing: '-0.02em' }}>
            {formatINR(savedAmount)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Accumulated wealth protected from impulse shopping
          </div>
        </div>
      </div>

      {/* Breathing Modal */}
      <BreathModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        amount={parseFloat(amount) || 1800}
        onSkipAndSave={handleSkipAndSave}
      />
    </div>
  );
}
