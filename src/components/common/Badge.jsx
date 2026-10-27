
import React from 'react';

export default function Badge({ children, variant = 'default', color, bg, icon: Icon, style = {} }) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'income':
        return { color: 'var(--income-green)', backgroundColor: 'var(--income-light)' };
      case 'expense':
        return { color: 'var(--expense-red)', backgroundColor: 'var(--expense-light)' };
      case 'warning':
        return { color: 'var(--warning-amber)', backgroundColor: 'var(--warning-light)' };
      case 'info':
        return { color: 'var(--info-blue)', backgroundColor: 'var(--info-light)' };
      case 'custom':
        return { color: color || 'var(--text-primary)', backgroundColor: bg || 'var(--surface-muted)' };
      default:
        return { color: 'var(--text-secondary)', backgroundColor: 'var(--surface-muted)' };
    }
  };

  const vStyles = getVariantStyles();

  return (
    <span 
      className="badge"
      style={{
        ...vStyles,
        border: '1px solid currentColor',
        borderColor: 'rgba(0,0,0,0.06)',
        ...style
      }}
    >
      {Icon && <Icon size={12} />}
      {children}
    </span>
  );
}
