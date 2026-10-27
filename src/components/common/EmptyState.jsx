
import React from 'react';
import { Sparkles } from 'lucide-react';

export default function EmptyState({ 
  icon: Icon = Sparkles, 
  title = 'No records found', 
  description = 'Add your first transaction or adjust your search filters.',
  actionLabel,
  onAction
}) {
  return (
    <div style={{
      padding: '48px 24px',
      textAlign: 'center',
      backgroundColor: 'var(--surface-card)',
      borderRadius: 'var(--radius-lg)',
      border: '1.2px dashed var(--border-light)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        width: '56px',
        height: '56px',
        borderRadius: '18px',
        backgroundColor: 'var(--surface-muted)',
        color: 'var(--accent-honey)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '16px'
      }}>
        <Icon size={28} />
      </div>
      <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
        {title}
      </h3>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: '380px', marginBottom: actionLabel ? '20px' : '0', lineHeight: 1.5 }}>
        {description}
      </p>
      {actionLabel && (
        <button
          onClick={onAction}
          style={{
            padding: '10px 20px',
            backgroundColor: 'var(--primary)',
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: '0.875rem',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
