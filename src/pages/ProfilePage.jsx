import React, { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { useAuth } from '../context/AuthContext';
import { exportService } from '../services/exportService';
import { formatINR, EXPENSE_CATEGORIES } from '../services/storageService';
import { apiRequest } from '../services/apiClient';
import Modal from '../components/common/Modal';
import { User, RotateCcw, Download, Database, Edit2, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const { budgets, setBudget, transactions, resetToDefaultData, resetAllToZero } = useWallet();
  const [resetMode, setResetMode] = useState('zero'); // 'zero' or 'demo'

  const [isEditNameOpen, setIsEditNameOpen] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name || (user?.email === 'jazaaa34@gmail.com' ? 'Aysha' : ''));
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Database status
  const [dbStatus, setDbStatus] = useState({ connected: false, storageType: 'local' });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    if (user?.name) {
      setNameInput(user.name);
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;
    const checkDb = async () => {
      try {
        const { ok, data } = await apiRequest('/api/db/status');
        if (isMounted && ok && data) {
          setDbStatus(data);
        }
      } catch {
        // local fallback
      }
    };
    checkDb();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleManualSync = async () => {
    if (!user?.email || isSyncing) return;
    setIsSyncing(true);
    setSyncMessage('');
    try {
      const { ok, data } = await apiRequest('/api/db/sync', {
        method: 'POST',
        body: JSON.stringify({
          email: user.email,
          data: {
            transactions,
            budgets,
            updatedAt: new Date().toISOString()
          }
        })
      });
      if (ok && data?.success) {
        setSyncMessage('Data synced successfully to database!');
        setTimeout(() => setSyncMessage(''), 3000);
      }
    } catch (e) {
      setSyncMessage('Synced locally.');
      setTimeout(() => setSyncMessage(''), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveName = (e) => {
    e.preventDefault();
    if (nameInput.trim()) {
      updateProfile(nameInput.trim());
      setIsEditNameOpen(false);
    }
  };

  const handleBudgetChange = (category, val) => {
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      setBudget(category, num);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '800px', margin: '0 auto' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
          Profile & Preferences
        </h1>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          Manage your account, category budgets, AI connection, and data storage
        </p>
      </div>

      {/* User Info Card */}
      <div className="card" style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: 'var(--surface-muted)',
            border: '2.5px solid var(--primary)',
            color: 'var(--primary)',
            fontSize: '1.5rem',
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {(user?.name || (user?.email === 'jazaaa34@gmail.com' ? 'Aysha' : user?.email || 'U'))[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)' }}>
              {user?.name || (user?.email === 'jazaaa34@gmail.com' ? 'Aysha' : user?.email?.split('@')[0] || 'User')}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              {user?.email || 'jazaaa34@gmail.com'}
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setNameInput(user?.name || 'Aysha');
            setIsEditNameOpen(true);
          }}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            backgroundColor: 'var(--surface-muted)',
            border: '1.2px solid var(--border-light)',
            color: 'var(--text-primary)',
            fontWeight: 700,
            fontSize: '0.8125rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Edit2 size={14} />
          <span>Edit Name</span>
        </button>
      </div>

      {/* Category Budgets Manager */}
      <div className="card" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '6px' }}>
          Category Monthly Spending Caps & Budgets
        </h2>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '18px' }}>
          Set monthly spending caps for each category. Money Guard alerts you automatically when your spending exceeds a cap.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {(EXPENSE_CATEGORIES || []).map((catItem) => {
            const limit = (budgets && budgets[catItem.name] !== undefined) ? budgets[catItem.name] : 0;
            return (
              <div
                key={catItem.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--surface-muted)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: catItem.color
                  }} />
                  <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                    {catItem.name}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Cap: ₹</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    defaultValue={limit > 0 ? limit : ''}
                    onBlur={(e) => handleBudgetChange(catItem.name, e.target.value)}
                    style={{
                      width: '110px',
                      height: '36px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      border: '1.2px solid var(--border-light)',
                      fontWeight: 800,
                      fontSize: '0.875rem',
                      textAlign: 'right',
                      backgroundColor: '#FFFFFF'
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Key & Data Management */}
      <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 900, color: 'var(--text-primary)' }}>
          Data & AI Configuration
        </h2>

        {/* Database & Cloud Sync Card */}
        <div style={{
          padding: '16px',
          borderRadius: '14px',
          border: '1.2px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: dbStatus.connected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)',
              color: dbStatus.connected ? 'var(--income-green)' : 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Database size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{dbStatus.connected ? 'MongoDB Cloud Database' : 'Database Storage Engine'}</span>
                <span style={{
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: dbStatus.connected ? 'rgba(16, 185, 129, 0.15)' : 'var(--surface-muted)',
                  color: dbStatus.connected ? 'var(--income-green)' : 'var(--text-secondary)'
                }}>
                  {dbStatus.connected ? 'Connected' : 'Active (Local Sync)'}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {syncMessage || (dbStatus.connected ? `Live sync to database (${dbStatus.database || 'walletweather'})` : 'Transactions and budgets automatically backed up')}
              </div>
            </div>
          </div>
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: 'var(--surface-muted)',
              border: '1px solid var(--border-light)',
              fontWeight: 700,
              fontSize: '0.8125rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: isSyncing ? 'not-allowed' : 'pointer',
              color: 'var(--text-primary)'
            }}
          >
            <RefreshCw size={13} className={isSyncing ? 'spin' : ''} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Database'}</span>
          </button>
        </div>

        {/* Export Statement */}
        <div style={{
          padding: '16px',
          borderRadius: '14px',
          border: '1.2px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Download size={20} color="var(--primary)" />
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.875rem' }}>Export Financial Records</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Download all transactions as a CSV spreadsheet
              </div>
            </div>
          </div>
          <button
            onClick={() => exportService.exportToCsv(transactions)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: 'var(--surface-muted)',
              fontWeight: 700,
              fontSize: '0.8125rem'
            }}
          >
            Download CSV
          </button>
        </div>

        {/* Reset Data to Zero (Start Fresh) */}
        <div style={{
          padding: '16px',
          borderRadius: '14px',
          border: '1.2px solid rgba(220, 38, 38, 0.25)',
          backgroundColor: 'var(--expense-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <RotateCcw size={20} color="var(--expense-red)" />
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--expense-red)' }}>
                Start Clean from Zero (₹0 Balance)
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Wipe all transactions, history, and details to start completely fresh from ₹0
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => {
                setResetMode('zero');
                setIsResetConfirmOpen(true);
              }}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                backgroundColor: 'var(--expense-red)',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '0.8125rem',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Reset to ₹0
            </button>
            <button
              onClick={() => {
                setResetMode('demo');
                setIsResetConfirmOpen(true);
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: 'var(--surface-muted)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
              title="Restore demo transactions and sample budgets"
            >
              Restore Demo
            </button>
          </div>
        </div>
      </div>

      {/* Edit Name Modal */}
      <Modal
        isOpen={isEditNameOpen}
        onClose={() => setIsEditNameOpen(false)}
        title="Edit Your Name"
        maxWidth="400px"
      >
        <form onSubmit={handleSaveName} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Full Name
            </label>
            <input
              type="text"
              required
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              style={{
                width: '100%',
                height: '44px',
                padding: '0 14px',
                borderRadius: 'var(--radius-md)',
                border: '1.2px solid var(--border-light)'
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              height: '44px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.875rem'
            }}
          >
            Save Name
          </button>
        </form>
      </Modal>



      {/* Reset Data Confirm Modal */}
      <Modal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        title={resetMode === 'zero' ? "Start Fresh from ₹0?" : "Restore Demo Data?"}
        maxWidth="420px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {resetMode === 'zero'
              ? 'This will clear all transactions, bills, and history so you start with a completely empty account and ₹0 balance.'
              : 'This will restore sample demo records (Salary, Rent, Swiggy, etc.) into your account.'}
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setIsResetConfirmOpen(false)}
              style={{
                flex: 1,
                height: '44px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--surface-muted)',
                fontWeight: 700,
                border: '1px solid var(--border-light)',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (resetMode === 'zero') {
                  await resetAllToZero();
                } else {
                  resetToDefaultData();
                }
                setIsResetConfirmOpen(false);
              }}
              style={{
                flex: 1,
                height: '44px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--expense-red)',
                color: '#FFFFFF',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              {resetMode === 'zero' ? 'Yes, Reset to ₹0' : 'Restore Demo'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
