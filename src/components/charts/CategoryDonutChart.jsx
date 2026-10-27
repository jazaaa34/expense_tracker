
import React from 'react';
import { formatINR } from '../../services/storageService';

export default function CategoryDonutChart({ breakdown, totalExpense }) {
  const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0 || !totalExpense) {
    return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No expense data recorded.</div>;
  }

  const colors = [
    '#FF6584', '#38BDF8', '#FBBF24', '#A78BFA', '#F472B6', 
    '#818CF8', '#34D399', '#60A5FA', '#FB923C', '#94A3B8'
  ];

  let cumulativeAngle = 0;
  const slices = entries.map(([cat, amt], idx) => {
    const fraction = amt / totalExpense;
    const angle = fraction * 360;
    const startAngle = cumulativeAngle;
    cumulativeAngle += angle;
    return {
      category: cat,
      amount: amt,
      fraction,
      percent: (fraction * 100).toFixed(1),
      color: colors[idx % colors.length],
      startAngle,
      angle
    };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
      {/* SVG Donut */}
      <div style={{ position: 'relative', width: '160px', height: '160px', flexShrink: 0 }}>
        <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
          {slices.map((s, i) => {
            const strokeDash = `${s.fraction * 251.2} 251.2`;
            const strokeOffset = -((s.startAngle / 360) * 251.2);

            return (
              <circle
                key={s.category}
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke={s.color}
                strokeWidth="18"
                strokeDasharray={strokeDash}
                strokeDashoffset={strokeOffset}
              />
            );
          })}
        </svg>
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL</span>
          <span style={{ fontSize: '0.9375rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            {formatINR(totalExpense)}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div style={{ flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {slices.slice(0, 5).map(s => (
          <div key={s.category} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: s.color }} />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.category}</span>
            </div>
            <span style={{ fontWeight: 800, color: 'var(--text-secondary)' }}>{s.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
