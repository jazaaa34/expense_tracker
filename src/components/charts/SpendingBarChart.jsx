
import React from 'react';
import { formatINR } from '../../services/storageService';

export default function SpendingBarChart({ daysData }) {
  const maxSpend = Math.max(...daysData.map(d => d.amount), 1000);

  return (
    <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px', height: '150px', paddingTop: '20px' }}>
      {daysData.map((d) => {
        const heightPct = Math.max(8, (d.amount / maxSpend) * 100);

        return (
          <div 
            key={d.day + d.date}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              height: '100%',
              justifyContent: 'flex-end',
              gap: '6px'
            }}
          >
            {/* Amount Tooltip / Label */}
            <span style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              {d.amount > 0 ? formatINR(d.amount) : '0'}
            </span>

            {/* Bar */}
            <div 
              style={{
                width: '100%',
                maxWidth: '28px',
                height: `${heightPct}%`,
                backgroundColor: d.isToday ? 'var(--primary)' : 'var(--surface-muted)',
                border: d.isToday ? '1px solid var(--primary-dark)' : '1px solid var(--border-light)',
                borderRadius: '8px 8px 4px 4px',
                transition: 'height 0.4s ease-out'
              }}
              title={`${d.day}: ${formatINR(d.amount)}`}
            />

            {/* Day Name */}
            <span style={{
              fontSize: '0.75rem',
              fontWeight: d.isToday ? 900 : 600,
              color: d.isToday ? 'var(--primary)' : 'var(--text-secondary)'
            }}>
              {d.day}
            </span>
          </div>
        );
      })}
    </div>
  );
}
