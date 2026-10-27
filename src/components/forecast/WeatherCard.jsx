
import React from 'react';
import { Sun, Cloud, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function WeatherCard({ riskScore, day = 'Today', reason }) {
  const getRiskMeta = (score) => {
    if (score > 70) {
      return {
        label: 'HIGH SPENDING RISK',
        color: 'var(--expense-red)',
        bg: 'var(--expense-light)',
        icon: AlertTriangle,
        desc: reason || 'Elevated risk of impulsive purchases or weekend surge.'
      };
    }
    if (score > 40) {
      return {
        label: 'MODERATE VELOCITY',
        color: 'var(--warning-amber)',
        bg: 'var(--warning-light)',
        icon: Cloud,
        desc: reason || 'Standard weekday expenditures and grocery restock.'
      };
    }
    return {
      label: 'CALM & SAFE WEATHER',
      color: 'var(--income-green)',
      bg: 'var(--income-light)',
      icon: Sun,
      desc: reason || 'Low temptation day. Spending velocity is well in control.'
    };
  };

  const meta = getRiskMeta(riskScore);
  const IconComp = meta.icon;

  return (
    <div className="card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
      {/* Icon Badge */}
      <div style={{
        width: '74px',
        height: '74px',
        borderRadius: '22px',
        backgroundColor: meta.bg,
        color: meta.color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <IconComp size={38} strokeWidth={2.4} />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: '220px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
            {day}
          </span>
          <span style={{
            fontSize: '0.6875rem',
            fontWeight: 800,
            padding: '3px 8px',
            borderRadius: '6px',
            backgroundColor: meta.bg,
            color: meta.color
          }}>
            {meta.label}
          </span>
        </div>

        <div style={{
          fontSize: '2rem',
          fontWeight: 900,
          color: meta.color,
          letterSpacing: '-0.03em',
          marginBottom: '6px'
        }}>
          {riskScore}% Velocity Risk
        </div>

        <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>
          {meta.desc}
        </p>
      </div>
    </div>
  );
}
