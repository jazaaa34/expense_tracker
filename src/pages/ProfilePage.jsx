import React, { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { useAuth } from '../context/AuthContext';
import { exportService } from '../services/exportService';
import { formatINR, EXPENSE_CATEGORIES } from '../services/storageService';
import { apiRequest } from '../services/apiClient';
import Modal from '../components/common/Modal';
import ForgotPasswordModal from '../components/auth/ForgotPasswordModal';
import { User, RotateCcw, Download, Database, Edit2, ShieldAlert, CheckCircle2, RefreshCw, Lock, KeyRound, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';

export default function ProfilePage() {
  const { user, updateProfile, changePassword } = useAuth();
  const { budgets, setBudget, transactions, resetToDefaultData, resetAllToZero } = useWallet();
  const [resetMode, setResetMode] = useState('zero'); // 'zero' or 'demo'

  const [isEditNameOpen, setIsEditNameOpen] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name || (user?.email === 'jazaaa34@gmail.com' ? 'Aysha' : ''));
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Password management state
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

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

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPasswordInput) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (newPasswordInput.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (newPasswordInput !== confirmNewPasswordInput) {
      setPasswordError('New passwords do not match. Please verify both fields.');
      return;
    }
    if (currentPasswordInput === newPasswordInput) {
      setPasswordError('New password cannot be the same as your current password.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await changePassword({
        currentPassword: currentPasswordInput,
        newPassword: newPasswordInput
      });

      if (!res.success) {
        setPasswordError(res.message || 'Failed to change password.');
      } else {
        setPasswordSuccess('Password successfully updated in your account!');
        setCurrentPasswordInput('');
        setNewPasswordInput('');
        setConfirmNewPasswordInput('');
        setTimeout(() => {
          setIsChangePasswordOpen(false);
          setPasswordSuccess('');
        }, 1800);
      }
    } catch (err) {
      setPasswordError(err.message || 'Error updating password.');
    } finally {
      setIsChangingPassword(false);
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

      {/* Account Security & Password Card */}
      <div className="card" style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            backgroundColor: 'rgba(30, 41, 59, 0.08)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Lock size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.0625rem', fontWeight: 900, color: 'var(--text-primary)' }}>
              Account Security & Password
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Keep your credentials updated or reset your password securely via email OTP
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              setPasswordError('');
              setPasswordSuccess('');
              setCurrentPasswordInput('');
              setNewPasswordInput('');
              setConfirmNewPasswordInput('');
              setIsChangePasswordOpen(true);
            }}
            className="btn btn-primary"
            style={{
              padding: '8px 16px',
              fontSize: '0.8125rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <KeyRound size={14} />
            <span>Change Password</span>
          </button>

          <button
            onClick={() => setIsForgotPasswordOpen(true)}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              backgroundColor: 'var(--surface-muted)',
              border: '1.2px solid var(--border-light)',
              color: 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.8125rem',
              cursor: 'pointer'
            }}
            title="Reset your password with an email verification code"
          >
            <span>Forgot Password?</span>
          </button>
        </div>
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

      {/* Change Password Modal */}
      <Modal
        isOpen={isChangePasswordOpen}
        onClose={() => {
          setIsChangePasswordOpen(false);
          setPasswordError('');
          setPasswordSuccess('');
        }}
        title="Change Your Password"
        subtitle="Enter your current password and choose a secure new password"
        maxWidth="440px"
      >
        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {passwordError && (
            <div style={{
              padding: '12px 14px',
              borderRadius: '10px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FCA5A5',
              color: '#B91C1C',
              fontSize: '0.8125rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{passwordError}</span>
            </div>
          )}

          {passwordSuccess && (
            <div style={{
              padding: '12px 14px',
              borderRadius: '10px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              color: '#047857',
              fontSize: '0.8125rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              <span>{passwordSuccess}</span>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' }}>
              Current Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                required
                placeholder="Enter current password"
                value={currentPasswordInput}
                onChange={(e) => setCurrentPasswordInput(e.target.value)}
                style={{
                  width: '100%',
                  height: '44px',
                  paddingLeft: '14px',
                  paddingRight: '40px',
                  borderRadius: 'var(--radius-md)',
                  border: '1.2px solid var(--border-light)',
                  fontSize: '0.9375rem'
                }}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)'
                }}
              >
                {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' }}>
              New Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                placeholder="Min. 6 characters"
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                style={{
                  width: '100%',
                  height: '44px',
                  paddingLeft: '14px',
                  paddingRight: '40px',
                  borderRadius: 'var(--radius-md)',
                  border: '1.2px solid var(--border-light)',
                  fontSize: '0.9375rem'
                }}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)'
                }}
              >
                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' }}>
              Confirm New Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirmNewPassword ? 'text' : 'password'}
                required
                placeholder="Re-enter new password"
                value={confirmNewPasswordInput}
                onChange={(e) => setConfirmNewPasswordInput(e.target.value)}
                style={{
                  width: '100%',
                  height: '44px',
                  paddingLeft: '14px',
                  paddingRight: '40px',
                  borderRadius: 'var(--radius-md)',
                  border: '1.2px solid var(--border-light)',
                  fontSize: '0.9375rem'
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)'
                }}
              >
                {showConfirmNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
            <button
              type="button"
              onClick={() => {
                setIsChangePasswordOpen(false);
                setIsForgotPasswordOpen(true);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-honey)',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                padding: 0
              }}
            >
              Forgot current password?
            </button>

            <button
              type="submit"
              disabled={isChangingPassword}
              className="btn btn-primary"
              style={{
                padding: '10px 20px',
                fontSize: '0.875rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {isChangingPassword ? (
                <>
                  <RefreshCw size={14} className="spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <KeyRound size={14} />
                  <span>Update Password</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Forgot Password Modal (Accessible directly from Profile too) */}
      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        initialEmail={user?.email || ''}
      />
    </div>
  );
}
