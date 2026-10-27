import React, { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { useAuth } from '../context/AuthContext';
import { exportService } from '../services/exportService';
import { aiService } from '../services/aiService';
import { formatINR, EXPENSE_CATEGORIES } from '../services/storageService';
import Modal from '../components/common/Modal';
import { User, RotateCcw, Download, Key, Edit2, ShieldAlert } from 'lucide-react';

export default function ProfilePage({ onOpenApiKeyModal }) {
  const { user, updateProfile } = useAuth();
  const { budgets, setBudget, transactions, resetToDefaultData } = useWallet();

  const [isEditNameOpen, setIsEditNameOpen] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name || (user?.email === 'jazaaa34@gmail.com' ? 'Aysha' : ''));
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  React.useEffect(() => {
    if (user?.name) {
      setNameInput(user.name);
    }
  }, [user]);

  const [hasKey, setHasKey] = useState(false);
  const [model, setModel] = useState(aiService.getModel());

  React.useEffect(() => {
    let isMounted = true;
    const check = async () => {
      const st = await aiService.getServerStatus();
      if (isMounted) {
        setHasKey(Boolean(st.configured));
        setModel(aiService.getModel());
      }
    };
    check();
    const handleUpdate = () => check();
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('walletweather_model_updated', handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('walletweather_model_updated', handleUpdate);
    };
  }, []);

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

        {/* AI Key Card */}
        <div style={{
          padding: '16px',
          borderRadius: '14px',
          border: '1.2px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Key size={20} color={hasKey ? 'var(--income-green)' : 'var(--accent-honey)'} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.875rem' }}>Groq AI Backend Engine</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {hasKey ? `Server Connected (${model})` : `Server Key Not Set (Using client assistant: ${model})`}
              </div>
            </div>
          </div>
          <button
            onClick={onOpenApiKeyModal}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: 'var(--surface-muted)',
              fontWeight: 700,
              fontSize: '0.8125rem'
            }}
          >
            Configure
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

        {/* Reset Data */}
        <div style={{
          padding: '16px',
          borderRadius: '14px',
          border: '1.2px solid rgba(220, 38, 38, 0.25)',
          backgroundColor: 'var(--expense-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <RotateCcw size={20} color="var(--expense-red)" />
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--expense-red)' }}>Restore Default Demo Data</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Reset local storage to original seed transactions and budgets
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsResetConfirmOpen(true)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: 'var(--expense-red)',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.8125rem'
            }}
          >
            Reset
          </button>
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
        title="Reset All Local Data?"
        maxWidth="420px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            This will clear your local transactions and restore the default demo records (Salary, Rent, Swiggy, etc.).
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setIsResetConfirmOpen(false)}
              style={{
                flex: 1,
                height: '44px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--surface-muted)',
                fontWeight: 700
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                resetToDefaultData();
                setIsResetConfirmOpen(false);
              }}
              style={{
                flex: 1,
                height: '44px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--expense-red)',
                color: '#FFFFFF',
                fontWeight: 800
              }}
            >
              Reset Data
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
