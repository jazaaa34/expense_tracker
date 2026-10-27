import React from 'react';
import Modal from './Modal';
import { LogOut } from 'lucide-react';

export default function ExitConfirmModal({ isOpen, onClose, onConfirm }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      hideHeader={true}
      maxWidth="380px"
    >
      <div style={{ padding: '12px 6px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          backgroundColor: '#FEE2E2',
          border: '4px solid #FEF2F2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#DC2626',
          marginBottom: '16px'
        }}>
          <LogOut size={28} strokeWidth={2.4} />
        </div>

        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: 900,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
          marginBottom: '8px'
        }}>
          Really want to log out?
        </h3>

        <p style={{
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          marginBottom: '24px',
          maxWidth: '300px'
        }}>
          Are you sure you want to exit your session? Click "Yes" to log out. All your transactions and budgets remain securely saved.
        </p>

        <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
          <button
            type="button"
            id="cancel-exit-btn"
            onClick={onClose}
            style={{
              flex: 1,
              height: '46px',
              borderRadius: '12px',
              backgroundColor: 'var(--surface-muted)',
              border: '1.2px solid var(--border-light)',
              color: 'var(--text-primary)',
              fontWeight: 800,
              fontSize: '0.9375rem',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--border-light)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-muted)'}
          >
            Cancel
          </button>

          <button
            type="button"
            id="confirm-exit-btn"
            onClick={onConfirm}
            style={{
              flex: 1,
              height: '46px',
              borderRadius: '12px',
              backgroundColor: 'var(--expense-red)',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.9375rem',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#B91C1C'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--expense-red)'}
          >
            <LogOut size={16} />
            <span>Yes, Log Out</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
