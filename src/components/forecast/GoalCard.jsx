
import React, { useState } from 'react';
import { Plus, CheckCircle2 } from 'lucide-react';
import { formatINR } from '../../services/storageService';
import confetti from 'canvas-confetti';

export default function GoalCard({ goal, onContribute }) {
  const [isContributing, setIsContributing] = useState(false);
  const [amt, setAmt] = useState('');

  const pct = Math.min(100, Math.round((goal.savedAmount / (goal.targetAmount || 1)) * 100));
  const isReached = goal.savedAmount >= goal.targetAmount;

  const handleSave = (e) => {
    e.preventDefault();
    const val = parseFloat(amt);
    if (!isNaN(val) && val > 0) {
      onContribute(goal.id, val);
      if (goal.savedAmount + val >= goal.targetAmount) {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
      }
      setAmt('');
      setIsContributing(false);
    }
  };

  return (
    <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.75rem' }}>{goal.iconEmoji || '🎯'}</span>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {goal.title}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Target: {formatINR(goal.targetAmount)}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.125rem', fontWeight: 900, color: 'var(--primary)' }}>
            {formatINR(goal.savedAmount)}
          </div>
          <span style={{
            fontSize: '0.6875rem',
            fontWeight: 800,
            color: isReached ? 'var(--income-green)' : 'var(--accent-honey)'
          }}>
            {pct}% Reached
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--surface-muted)', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          backgroundColor: isReached ? 'var(--income-green)' : 'var(--primary)',
          borderRadius: '10px',
          transition: 'width 0.5s ease-out'
        }} />
      </div>

      {/* Contribute Form / Button */}
      {isContributing ? (
        <form onSubmit={handleSave} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="number"
            placeholder="Amount ₹"
            autoFocus
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
            style={{
              flex: 1,
              height: '38px',
              padding: '0 12px',
              borderRadius: '8px',
              border: '1.2px solid var(--border-light)',
              fontSize: '0.875rem'
            }}
          />
          <button
            type="submit"
            style={{
              padding: '0 14px',
              height: '38px',
              borderRadius: '8px',
              backgroundColor: 'var(--income-green)',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.8125rem'
            }}
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setIsContributing(false)}
            style={{
              padding: '0 12px',
              height: '38px',
              borderRadius: '8px',
              backgroundColor: 'var(--surface-muted)',
              color: 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.8125rem'
            }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          onClick={() => setIsContributing(true)}
          style={{
            width: '100%',
            height: '36px',
            borderRadius: '10px',
            backgroundColor: 'var(--surface-muted)',
            color: 'var(--primary)',
            fontWeight: 700,
            fontSize: '0.8125rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <Plus size={14} />
          <span>Contribute Savings</span>
        </button>
      )}
    </div>
  );
}
