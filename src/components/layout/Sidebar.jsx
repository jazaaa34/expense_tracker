
import React from 'react';
import { 
  LayoutDashboard, 
  History,
  Receipt, 
  Sparkles, 
  ShieldAlert, 
  Zap, 
  User, 
  Plus,
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useWallet } from '../../context/WalletContext';
import { useAuth } from '../../context/AuthContext';
import { formatINR } from '../../services/storageService';

export default function Sidebar({ currentTab, onSelectTab, isExpanded, onToggleExpand, onOpenAddTxn }) {
  const { user, balance, alerts, transactions = [] } = useWallet();
  const { logout, requestLogout } = useAuth();
  const pendingAlerts = alerts.filter(a => !a.isResolved).length;
  const billCount = transactions.filter(t => t.source === 'bill' || Boolean(t.screenshot)).length;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'history', label: 'History', icon: History },
    { id: 'bills', label: 'Bills & Receipts', icon: Receipt, badge: billCount > 0 ? billCount : null },
    { id: 'ai-chat', label: 'AI Advisor', icon: Sparkles },
    { id: 'alerts', label: 'Alerts', icon: ShieldAlert, alertCount: pendingAlerts },
    { id: 'analytics', label: 'Utility Usage', icon: Zap },
    { id: 'profile', label: 'Profile & Settings', icon: User }
  ];

  return (
    <aside 
      style={{
        width: isExpanded ? '260px' : '82px',
        backgroundColor: 'var(--surface-card)',
        borderRight: '1.2px solid var(--border-light)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width var(--transition-normal)',
        position: 'sticky',
        top: 0,
        height: '100vh',
        zIndex: 40,
        flexShrink: 0
      }}
      className="hidden-mobile"
    >
      {/* Brand Header */}
      <div style={{
        padding: isExpanded ? '24px 20px 16px' : '24px 14px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isExpanded ? 'space-between' : 'center',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
          onClick={() => onSelectTab('dashboard')}
        >
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '14px',
            backgroundColor: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
              <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
            </svg>
          </div>
          {isExpanded && (
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
                WalletWeather
              </div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Predicts & Alerts
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onToggleExpand}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--surface-muted)'
          }}
          title={isExpanded ? 'Collapse Sidebar' : 'Expand Sidebar'}
        >
          {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {/* Add Transaction CTA */}
      <div style={{ padding: isExpanded ? '16px 18px 8px' : '16px 12px 8px' }}>
        <button
          onClick={onOpenAddTxn}
          style={{
            width: '100%',
            height: '46px',
            borderRadius: '14px',
            backgroundColor: 'var(--primary)',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(45, 26, 18, 0.2)'
          }}
          title="Add New Transaction"
        >
          <Plus size={18} strokeWidth={2.5} />
          {isExpanded && <span>Add Txn</span>}
        </button>
      </div>

      {/* Navigation Links */}
      <nav style={{
        flex: 1,
        padding: isExpanded ? '12px 14px' : '12px 10px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}>
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id || (item.id === 'alerts' && currentTab === 'forecast');

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              style={{
                width: '100%',
                padding: isExpanded ? '10px 14px' : '11px 0',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: isExpanded ? 'flex-start' : 'center',
                gap: '12px',
                backgroundColor: isActive ? 'rgba(45, 26, 18, 0.08)' : 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? 800 : 600,
                fontSize: '0.875rem',
                border: isActive ? '1.2px solid rgba(45, 26, 18, 0.18)' : '1.2px solid transparent',
                position: 'relative'
              }}
              title={item.label}
            >
              <Icon size={20} color={isActive ? 'var(--primary)' : 'currentColor'} strokeWidth={isActive ? 2.4 : 2} />
              
              {isExpanded && (
                <span style={{ flex: 1, textAlign: 'left', whiteSpace: 'nowrap' }}>
                  {item.label}
                </span>
              )}

              {/* Badges */}
              {item.badge && isExpanded && (
                <span style={{
                  padding: '2px 6px',
                  borderRadius: '6px',
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  backgroundColor: 'var(--accent-honey)',
                  color: '#FFFFFF'
                }}>
                  {item.badge}
                </span>
              )}

              {item.alertCount > 0 && (
                <span style={{
                  width: isExpanded ? 'auto' : '10px',
                  height: isExpanded ? 'auto' : '10px',
                  padding: isExpanded ? '2px 7px' : '0',
                  borderRadius: '10px',
                  backgroundColor: 'var(--expense-red)',
                  color: '#FFFFFF',
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  position: isExpanded ? 'static' : 'absolute',
                  top: '6px',
                  right: '12px'
                }}>
                  {isExpanded ? item.alertCount : ''}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Mini Balance & Profile Footer */}
      <div style={{
        padding: isExpanded ? '16px' : '14px 10px',
        borderTop: '1px solid var(--border-light)',
        backgroundColor: 'var(--surface-muted)'
      }}>
        {isExpanded && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Live Available
            </div>
            <div style={{ fontSize: '1.125rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '-0.02em' }}>
              {formatINR(balance)}
            </div>
          </div>
        )}

        <div style={{
          display: 'flex',
          flexDirection: isExpanded ? 'row' : 'column',
          alignItems: 'center',
          justifyContent: isExpanded ? 'space-between' : 'center',
          gap: isExpanded ? '8px' : '10px'
        }}>
          <div 
            onClick={() => onSelectTab('profile')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              overflow: 'hidden',
              flex: isExpanded ? 1 : 'unset'
            }}
            title={`Profile: ${user?.name || (user?.email === 'jazaaa34@gmail.com' ? 'Aysha' : user?.email || 'User')}`}
          >
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              border: '2px solid var(--primary)',
              color: 'var(--primary)',
              fontWeight: 800,
              fontSize: '0.9375rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {(user?.name || (user?.email === 'jazaaa34@gmail.com' ? 'Aysha' : user?.email || 'U'))[0].toUpperCase()}
            </div>
            {isExpanded && (
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {user?.name || (user?.email === 'jazaaa34@gmail.com' ? 'Aysha' : user?.email?.split('@')[0] || 'User')}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {user?.email || 'jazaaa34@gmail.com'}
                </div>
              </div>
            )}
          </div>

          {/* Quick Logout Button */}
          <button
            id="sidebar-logout-btn"
            onClick={(e) => {
              e.stopPropagation();
              requestLogout();
            }}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              backgroundColor: '#FFF5F5',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: 'var(--expense-red)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
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
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
