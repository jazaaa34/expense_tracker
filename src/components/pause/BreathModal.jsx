
import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { formatINR } from '../../services/storageService';
import confetti from 'canvas-confetti';

export default function BreathModal({ isOpen, onClose, amount = 1800, onSkipAndSave }) {
  const [secondsLeft, setSecondsLeft] = useState(10);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSecondsLeft(10);
      setIsDone(false);
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsDone(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  const handleSkip = () => {
    confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
    onSkipAndSave(amount);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Mindful Breathing Pause"
      subtitle="Impulse breaker in action"
      maxWidth="460px"
    >
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
          Take a deep breath... ask yourself if this purchase of <strong>{formatINR(amount)}</strong> is essential right now.
        </p>

        {/* Breathing Animation Circle */}
        <div style={{
          width: '140px',
          height: '140px',
          borderRadius: '50%',
          backgroundColor: 'var(--surface-muted)',
          border: '3px solid var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px'
        }} className="animate-breathe">
          <span style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--primary)' }}>
            {isDone ? '✓' : secondsLeft}
          </span>
        </div>

        {/* Grounding Quote */}
        <div style={{
          padding: '16px',
          borderRadius: '16px',
          backgroundColor: 'var(--surface-muted)',
          border: '1px solid var(--border-light)',
          fontStyle: 'italic',
          fontSize: '0.8125rem',
          color: 'var(--text-primary)',
          lineHeight: 1.5,
          marginBottom: '24px'
        }}>
          "The goal isn't to buy things to feel good; the goal is to feel in control of your financial freedom."
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
          <button
            onClick={handleSkip}
            style={{
              flex: 1.2,
              height: '48px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--income-green)',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.875rem',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            Skip & Save {formatINR(amount)}!
          </button>

          <button
            disabled={!isDone}
            onClick={onClose}
            style={{
              flex: 1,
              height: '48px',
              borderRadius: 'var(--radius-md)',
              border: '1.2px solid var(--border-light)',
              color: isDone ? 'var(--text-primary)' : 'var(--text-muted)',
              backgroundColor: isDone ? '#FFFFFF' : 'var(--surface-muted)',
              fontWeight: 700,
              fontSize: '0.875rem',
              cursor: isDone ? 'pointer' : 'not-allowed'
            }}
          >
            {isDone ? 'Proceed to Pay' : `Wait ${secondsLeft}s`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
