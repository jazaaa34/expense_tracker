
import React from 'react';
import { Sun, Cloud, AlertTriangle } from 'lucide-react';

export default function SevenDaySelector({ forecastList, selectedIndex, onSelect }) {
  const getIcon = (risk) => {
    if (risk > 70) return AlertTriangle;
    if (risk > 40) return Cloud;
    return Sun;
  };

  const getColor = (risk) => {
    if (risk > 70) return 'var(--expense-red)';
    if (risk > 40) return 'var(--warning-amber)';
    return 'var(--income-green)';
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(7, 1fr)',
      gap: '10px',
      overflowX: 'auto',
      paddingBottom: '4px'
    }}>
      {forecastList.map((item, idx) => {
        const isSelected = selectedIndex === idx;
        const color = getColor(item.risk);
        const IconComp = getIcon(item.risk);

        return (
          <button
            key={item.day}
            onClick={() => onSelect(idx)}
            className="card card-hover"
            style={{
              padding: '16px 8px',
              borderRadius: '16px',
              border: isSelected ? `2.5px solid ${color}` : '1.2px solid var(--border-light)',
              backgroundColor: isSelected ? `${color}15` : '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              minWidth: '68px',
              textAlign: 'center'
            }}
          >
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: isSelected ? color : 'var(--text-secondary)' }}>
              {item.day}
            </span>
            <IconComp size={22} color={color} />
            <span style={{ fontSize: '0.875rem', fontWeight: 900, color: 'var(--text-primary)' }}>
              {item.risk}%
            </span>
          </button>
        );
      })}
    </div>
  );
}
