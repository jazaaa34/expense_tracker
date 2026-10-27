
import React from 'react';
import { ShieldCheck, Copy, TrendingUp, Timer, CheckCircle2 } from 'lucide-react';

export default function MoneyGuardList({ alerts, onResolve }) {
  const getIcon = (type) => {
    switch (type) {
      case 'copy': return Copy;
      case 'trending-up': return TrendingUp;
      case 'timer': return Timer;
      default: return ShieldCheck;
    }
  };

  if (!alerts || alerts.length === 0) {
    return (
      <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--income-green)' }}>
        <CheckCircle2 size={32} style={{ margin: '0 auto 8px' }} />
        <div style={{ fontWeight: 800 }}>All Clear! No alerts detected.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {alerts.map(a => {
        const IconComp = getIcon(a.iconType);
        const isResolved = a.isResolved;

        return (
          <div
            key={a.id}
            className="card"
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              opacity: isResolved ? 0.6 : 1,
              backgroundColor: isResolved ? 'var(--surface-muted)' : '#FFFFFF'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: isResolved ? 'var(--border-light)' : `${a.color}20`,
                color: isResolved ? 'var(--text-muted)' : a.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <IconComp size={20} />
              </div>

              <div>
                <div style={{
                  fontSize: '0.9375rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  textDecoration: isResolved ? 'line-through' : 'none'
                }}>
                  {a.title}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {a.description}
                </div>
              </div>
            </div>

            <div>
              {isResolved ? (
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--income-green)' }}>
                  ✓ Resolved
                </span>
              ) : (
                <button
                  onClick={() => onResolve(a.id)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--primary)',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {a.actionLabel || 'Resolve'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
