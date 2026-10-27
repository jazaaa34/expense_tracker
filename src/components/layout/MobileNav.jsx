
import React from 'react';
import { LayoutDashboard, History, Receipt, ShieldAlert, User, Plus } from 'lucide-react';

export default function MobileNav({ currentTab, onSelectTab, onOpenAddTxn }) {
  const items = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'bills', label: 'Bills', icon: Receipt },
    { id: 'add', label: 'Add', isSpecial: true },
    { id: 'history', label: 'History', icon: History },
    { id: 'alerts', label: 'Alerts', icon: ShieldAlert }
  ];

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: '68px',
      backgroundColor: '#FFFFFF',
      borderTop: '1.2px solid var(--border-light)',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'space-around',
      zIndex: 50,
      padding: '0 8px'
    }} className="show-mobile">
      {items.map(item => {
        if (item.isSpecial) {
          return (
            <button
              key="special-add"
              onClick={onOpenAddTxn}
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(45, 26, 18, 0.3)',
                transform: 'translateY(-12px)'
              }}
              title="Add Transaction"
            >
              <Plus size={24} strokeWidth={2.5} />
            </button>
          );
        }

        const Icon = item.icon;
        const isActive = currentTab === item.id || (item.id === 'alerts' && currentTab === 'forecast');

        return (
          <button
            key={item.id}
            onClick={() => onSelectTab(item.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              color: isActive ? 'var(--primary)' : 'var(--text-muted)',
              fontSize: '0.6875rem',
              fontWeight: isActive ? 800 : 500,
              padding: '6px 12px'
            }}
          >
            <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
