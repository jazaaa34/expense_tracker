
import React from 'react';
import { getCategoryMeta, formatINR, formatDate } from '../../services/storageService';
import { getCategoryIcon } from '../../utils/categoryIcons';

export default function TransactionTile({ txn, onClick }) {
  const meta = getCategoryMeta(txn.category, txn.isExpense);
  const IconComponent = getCategoryIcon(meta.icon);
  const isExp = txn.isExpense;

  return (
    <div
      onClick={() => onClick && onClick(txn)}
      className="card card-hover"
      style={{
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        marginBottom: '10px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Category Icon */}
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '14px',
          backgroundColor: meta.bg || 'var(--surface-muted)',
          color: meta.color || 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <IconComponent size={20} strokeWidth={2.4} />
        </div>

        {/* Info */}
        <div>
          <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '3px' }}>
            {txn.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {txn.category}
            </span>
            <span style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '6px',
              backgroundColor: 'var(--surface-muted)',
              color: 'var(--text-secondary)'
            }}>
              {txn.paymentMethod || 'UPI'}
            </span>
            {txn.tag && (
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                #{txn.tag}
              </span>
            )}
            {txn.isMonthly && (
              <span style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '6px',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                color: '#2563EB'
              }}>
                🔄 Autopay
              </span>
            )}
            {txn.source === 'bill' ? (
              <span style={{
                fontSize: '0.6875rem',
                fontWeight: 800,
                padding: '2px 7px',
                borderRadius: '6px',
                backgroundColor: 'rgba(13, 148, 136, 0.12)',
                color: '#0D9488',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }} title={`Scanned Bill (${Math.round((txn.confidence || 0.95) * 100)}% OCR match)`}>
                🧾 Scanned Bill
              </span>
            ) : txn.screenshot ? (
              <span style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '6px',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                color: '#059669',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px'
              }} title="Receipt / Screenshot attached">
                📎 Receipt
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Amount and Date */}
      <div style={{ textAlign: 'right' }}>
        <div style={{
          fontSize: '1rem',
          fontWeight: 900,
          color: isExp ? 'var(--expense-red)' : 'var(--income-green)',
          letterSpacing: '-0.02em',
          marginBottom: '3px'
        }}>
          {isExp ? '-' : '+'}{formatINR(txn.amount)}
        </div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          {formatDate(txn.date)}
        </div>
      </div>
    </div>
  );
}
