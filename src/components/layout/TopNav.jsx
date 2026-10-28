import React from 'react';
import { Plus } from 'lucide-react';
import { useWallet } from '../../context/WalletContext';
import { getGreeting } from '../../services/storageService';

export default function TopNav({ onOpenAddTxn }) {
  const { user } = useWallet();

  return (
    <header style={{
      height: '72px',
      backgroundColor: 'rgba(251, 249, 246, 0.85)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1.2px solid var(--border-light)',
      padding: '0 32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 30
    }}>
      {/* Left: User Greeting */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            {getGreeting()}
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {user?.name || (user?.email === 'jazaaa34@gmail.com' ? 'Aysha' : user?.email?.split('@')[0] || 'User')} 👋
          </div>
        </div>
      </div>

      {/* Center / Where Search Was: Add Transaction Button */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button
          id="topnav-add-transaction-btn"
          onClick={onOpenAddTxn}
          style={{
            padding: '10px 24px',
            borderRadius: '12px',
            backgroundColor: 'var(--primary)',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: '0.9375rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(45, 26, 18, 0.25)',
            border: 'none',
            cursor: 'pointer',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 6px 18px rgba(45, 26, 18, 0.35)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(45, 26, 18, 0.25)';
          }}
          title="Add New Transaction"
        >
          <Plus size={18} strokeWidth={2.8} />
          <span>Add Transaction</span>
        </button>
      </div>
    </header>
  );
}
