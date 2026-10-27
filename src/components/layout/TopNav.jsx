
import React from 'react';
import { Search, Plus, Bell, LogOut, Camera } from 'lucide-react';
import { useWallet } from '../../context/WalletContext';
import { useAuth } from '../../context/AuthContext';
import { getGreeting } from '../../services/storageService';

export default function TopNav({ currentTab, onOpenAddTxn, onOpenScanBill, searchQuery, onSearchChange, onSelectTab }) {
  const { user, alerts } = useWallet();
  const { requestLogout } = useAuth();
  const unreadAlerts = alerts.filter(a => !a.isResolved);

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

      {/* Middle: Live Search Bar */}
      <div style={{
        flex: 1,
        maxWidth: '420px',
        margin: '0 24px',
        position: 'relative'
      }} className="hidden-mobile">
        <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
        <input
          type="text"
          placeholder="Search expenses, shops, categories..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: '100%',
            height: '42px',
            padding: '0 16px 0 40px',
            backgroundColor: '#FFFFFF',
            border: '1.2px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-xs)'
          }}
        />
      </div>

      {/* Right: Actions & Indicators */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Alerts Button */}
        <button
          onClick={() => onSelectTab('alerts')}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            backgroundColor: '#FFFFFF',
            border: '1.2px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: unreadAlerts.length > 0 ? 'var(--warning-amber)' : 'var(--text-secondary)',
            position: 'relative'
          }}
          title={`${unreadAlerts.length} Active Money Guard Alerts`}
        >
          <Bell size={18} />
          {unreadAlerts.length > 0 && (
            <span style={{
              position: 'absolute',
              top: '7px',
              right: '7px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--expense-red)'
            }} />
          )}
        </button>

        {/* Add from Bill Button */}
        <button
          id="topnav-scan-bill-btn"
          onClick={onOpenScanBill}
          style={{
            padding: '9px 16px',
            borderRadius: '12px',
            backgroundColor: '#F0FDFA',
            color: 'var(--primary-teal, #0D9488)',
            border: '1.2px solid rgba(13, 148, 136, 0.3)',
            fontWeight: 800,
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer'
          }}
          title="Scan or upload a bill photo to extract expense"
        >
          <Camera size={16} strokeWidth={2.4} />
          <span>Scan Bill</span>
        </button>

        {/* Quick Add Button */}
        <button
          onClick={onOpenAddTxn}
          style={{
            padding: '9px 18px',
            borderRadius: '12px',
            backgroundColor: 'var(--primary)',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: 'var(--shadow-sm)',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <Plus size={16} strokeWidth={2.8} />
          <span>New Txn</span>
        </button>

        {/* Profile & Settings Button */}
        <button
          id="topnav-profile-btn"
          onClick={() => onSelectTab('profile')}
          style={{
            padding: '5px 12px 5px 6px',
            borderRadius: '12px',
            backgroundColor: currentTab === 'profile' ? 'var(--surface-muted)' : '#FFFFFF',
            border: currentTab === 'profile' ? '2px solid var(--primary)' : '1.2px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          title="Open Profile & Settings"
        >
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: 'var(--surface-muted)',
            border: '1.5px solid var(--primary)',
            color: 'var(--primary)',
            fontWeight: 900,
            fontSize: '0.8125rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {(user?.name || (user?.email === 'jazaaa34@gmail.com' ? 'Aysha' : user?.email || 'U'))[0].toUpperCase()}
          </div>
          <span className="hidden-tablet" style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {user?.name || (user?.email === 'jazaaa34@gmail.com' ? 'Aysha' : user?.email?.split('@')[0] || 'Profile')}
          </span>
        </button>

        {/* Quick Log Out Button */}
        <button
          id="topnav-logout-btn"
          onClick={() => requestLogout()}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            backgroundColor: '#FFF5F5',
            border: '1.2px solid rgba(239, 68, 68, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--expense-red)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          title="Log Out of WalletWeather"
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--expense-red)';
            e.currentTarget.style.color = '#FFFFFF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#FFF5F5';
            e.currentTarget.style.color = 'var(--expense-red)';
          }}
        >
          <LogOut size={17} />
        </button>
      </div>
    </header>
  );
}
