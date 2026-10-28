import React, { useState, useRef } from 'react';
import { useWallet } from '../context/WalletContext';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/apiClient';
import { formatINR, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../services/storageService';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Trash2,
  Edit2,
  Check,
  X,
  ShieldAlert,
  HelpCircle,
  FileText
} from 'lucide-react';

const MAX_FILE_SIZE_BYTES = 4.5 * 1024 * 1024; // 4.5 MB

const ALL_CATEGORIES = [
  ...EXPENSE_CATEGORIES.map(c => ({ name: c.name, isExpense: true })),
  ...INCOME_CATEGORIES.map(c => ({ name: c.name, isExpense: false }))
];

export default function ImportTransactionsPage({ onNavigateTab }) {
  const { user } = useAuth();
  const { importTransactions } = useWallet();

  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successResult, setSuccessResult] = useState(null);

  // Extracted transactions list
  const [transactions, setTransactions] = useState([]);
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'selected', 'duplicates', 'review'

  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processSelectedFile(droppedFile);
    }
  };

  const handleFileInputChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      processSelectedFile(selected);
    }
  };

  const processSelectedFile = async (f) => {
    setErrorMsg('');
    setSuccessResult(null);

    // Validate size
    if (f.size > MAX_FILE_SIZE_BYTES) {
      setErrorMsg(`File is too large (${(f.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is 4.5 MB.`);
      return;
    }

    const name = f.name.toLowerCase();
    const ext = (name.split('.').pop() || '').toLowerCase();
    const mime = (f.type || '').toLowerCase();
    const fileType = ext || (mime.includes('pdf') ? 'pdf' : (mime.includes('csv') ? 'csv' : (mime.includes('image') ? 'png' : 'txt')));

    setFile(f);
    setIsParsing(true);

    try {
      // Read file into Base64
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
      });
      reader.readAsDataURL(f);
      const base64Data = await base64Promise;

      const response = await apiRequest('/api/statements/parse', {
        method: 'POST',
        body: JSON.stringify({
          fileData: base64Data,
          fileName: f.name,
          fileType,
          userEmail: user?.email || ''
        })
      });

      if (!response.ok) {
        throw new Error(response.data?.error || `Server returned HTTP ${response.status}`);
      }

      const txns = response.data?.transactions || [];
      if (txns.length === 0) {
        throw new Error('No transactions could be extracted from this statement. Please check the file formatting.');
      }

      setTransactions(txns);
    } catch (err) {
      console.error('Statement parse failure:', err);
      setErrorMsg(err.message || 'Failed to read statement. Please check the file format.');
      setTransactions([]);
    } finally {
      setIsParsing(false);
    }
  };

  // Toggle single selection
  const handleToggleSelect = (tempId) => {
    setTransactions(prev => prev.map(t => t.tempId === tempId ? { ...t, selected: !t.selected } : t));
  };

  // Select all or Deselect all
  const handleSelectAll = (selectState) => {
    setTransactions(prev => prev.map(t => ({ ...t, selected: selectState })));
  };

  // Update specific field in a transaction row
  const handleUpdateRow = (tempId, field, value) => {
    setTransactions(prev => prev.map(t => {
      if (t.tempId !== tempId) return t;
      const updated = { ...t, [field]: value };
      if (field === 'type') {
        const isExp = value === 'expense';
        updated.isExpense = isExp;
        if (isExp && (updated.category === 'Salary' || updated.category === 'Other Income' || updated.category === 'Rental Income')) {
          updated.category = 'Other Expense';
        } else if (!isExp && (updated.category === 'Other Expense' || updated.category === 'Food & Dining')) {
          updated.category = 'Other Income';
        }
      }
      if (field === 'isExpense') {
        const isExp = Boolean(value);
        updated.isExpense = isExp;
        updated.type = isExp ? 'expense' : 'income';
        if (isExp && (updated.category === 'Salary' || updated.category === 'Other Income' || updated.category === 'Rental Income')) {
          updated.category = 'Other Expense';
        } else if (!isExp && (updated.category === 'Other Expense' || updated.category === 'Food & Dining')) {
          updated.category = 'Other Income';
        }
      }
      return updated;
    }));
  };

  // AI Category Suggestion with Groq
  const handleAutoCategorizeAi = async () => {
    setIsAiLoading(true);
    setErrorMsg('');

    try {
      const itemsToCategorize = transactions.map(t => ({
        tempId: t.tempId,
        merchant: t.merchant || t.name,
        rawDescription: t.rawDescription
      }));

      const res = await apiRequest('/api/statements/ai-categories', {
        method: 'POST',
        body: JSON.stringify({ items: itemsToCategorize })
      });

      if (res.ok && res.data?.suggestions) {
        const suggestions = res.data.suggestions;
        let count = 0;
        setTransactions(prev => prev.map(t => {
          if (suggestions[t.tempId]) {
            count++;
            return {
              ...t,
              category: suggestions[t.tempId],
              needsReview: false
            };
          }
          return t;
        }));
      }
    } catch (err) {
      console.warn('AI categorization notice:', err.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Save confirmed transactions
  const handleConfirmImport = async () => {
    const selectedTxns = transactions.filter(t => t.selected);
    if (selectedTxns.length === 0) {
      setErrorMsg('Please select at least one transaction to import.');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');

    try {
      const response = await apiRequest('/api/statements/confirm-import', {
        method: 'POST',
        body: JSON.stringify({
          userEmail: user?.email || '',
          transactions: selectedTxns
        })
      });

      if (!response.ok) {
        throw new Error(response.data?.error || 'Database storage error occurred.');
      }

      // Update local wallet context state
      const savedItems = response.data?.importedTransactions || selectedTxns;
      importTransactions(savedItems);

      setSuccessResult({
        count: savedItems.length,
        totalTransactions: response.data?.totalTransactions || savedItems.length
      });
      setTransactions([]);
      setFile(null);
    } catch (err) {
      console.error('Import save error:', err);
      setErrorMsg(err.message || 'Failed to save transactions to MongoDB Atlas.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setTransactions([]);
    setErrorMsg('');
    setSuccessResult(null);
  };

  // Computed summary metrics
  const totalCount = transactions.length;
  const selectedCount = transactions.filter(t => t.selected).length;
  const duplicateCount = transactions.filter(t => t.isDuplicate).length;
  const needsReviewCount = transactions.filter(t => t.needsReview).length;

  const totalDebit = transactions
    .filter(t => t.selected && t.isExpense)
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const totalCredit = transactions
    .filter(t => t.selected && !t.isExpense)
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  // Filtered view
  const displayedTxns = transactions.filter(t => {
    if (filterMode === 'selected') return t.selected;
    if (filterMode === 'duplicates') return t.isDuplicate;
    if (filterMode === 'review') return t.needsReview;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', maxWidth: '1100px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            color: 'var(--income-green)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FileSpreadsheet size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
              UPI & Statement Importer
            </h1>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Upload bank statements (CSV, Excel XLSX, PDF) to auto-extract UPI payments into your wallet
            </p>
          </div>
        </div>

        {transactions.length > 0 && (
          <button
            onClick={handleReset}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1.2px solid var(--border-light)',
              backgroundColor: 'var(--surface-card)',
              color: 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.8125rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <RotateCcw size={14} />
            <span>Upload New Statement</span>
          </button>
        )}
      </div>

      {/* Success Notification Banner */}
      {successResult && (
        <div style={{
          padding: '20px',
          borderRadius: '14px',
          backgroundColor: '#ECFDF5',
          border: '1.5px solid #A7F3D0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#10B981', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Check size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.9375rem', color: '#065F46' }}>
                Successfully Imported {successResult.count} Transactions!
              </div>
              <div style={{ fontSize: '0.75rem', color: '#047857' }}>
                All records have been securely saved to MongoDB Atlas and updated in your balance.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => onNavigateTab && onNavigateTab('dashboard')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: '#10B981',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.8125rem',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              View Dashboard
            </button>
            <button
              onClick={() => onNavigateTab && onNavigateTab('history')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF',
                color: '#065F46',
                border: '1px solid #A7F3D0',
                fontWeight: 700,
                fontSize: '0.8125rem',
                cursor: 'pointer'
              }}
            >
              View History
            </button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div style={{
          padding: '16px',
          borderRadius: '12px',
          backgroundColor: '#FEF2F2',
          border: '1.5px solid #FECACA',
          color: '#DC2626',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.875rem',
          fontWeight: 600
        }}>
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* STEP 1: Upload Dropzone (shown when no statement is currently loaded) */}
      {transactions.length === 0 && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="card"
          style={{
            padding: '50px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            border: isDragging ? '2px dashed var(--primary)' : '2px dashed var(--border-light)',
            backgroundColor: isDragging ? 'rgba(59, 130, 246, 0.05)' : 'var(--surface-card)',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px'
          }}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            accept="*/*"
            style={{ display: 'none' }}
          />

          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            backgroundColor: 'var(--surface-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--primary)'
          }}>
            {isParsing ? (
              <div style={{ width: '28px', height: '28px', border: '3px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            ) : (
              <UploadCloud size={32} />
            )}
          </div>

          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
              {isParsing ? 'Parsing Statement Rows...' : 'Click or Drag & Drop Any Statement / Receipt File'}
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', maxWidth: '460px', margin: '0 auto', lineHeight: 1.5 }}>
              Upload bank statements or payment receipts in <strong>any format</strong> — CSV, Excel (XLSX/XLS), PDF, TXT, or Photos/Screenshots (PNG/JPG). Automated UTR, payee, and date extraction.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '6px' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
              📄 CSV / TSV / TXT
            </span>
            <span style={{ fontSize: '0.6875rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
              📊 Excel (XLSX / XLS)
            </span>
            <span style={{ fontSize: '0.6875rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
              📑 PDF Statements
            </span>
            <span style={{ fontSize: '0.6875rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
              📸 Receipts & Screenshots
            </span>
            <span style={{ fontSize: '0.6875rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', backgroundColor: '#ECFDF5', color: '#047857' }}>
              🔒 100% In-Memory Processing
            </span>
          </div>
        </div>
      )}

      {/* STEP 2: Review Table & Customization */}
      {transactions.length > 0 && (
        <>
          {/* Summary Dashboard Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Selected Rows
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', margin: '4px 0 2px' }}>
                {selectedCount} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>/ {totalCount}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Transactions to be imported
              </div>
            </div>

            <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--expense-red)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Money Sent (Deducted)
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--expense-red)', margin: '4px 0 2px' }}>
                -{formatINR(totalDebit)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--expense-red)', fontWeight: 600 }}>
                Deducted from Dashboard & History
              </div>
            </div>

            <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--income-green)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Money Received (Added)
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--income-green)', margin: '4px 0 2px' }}>
                +{formatINR(totalCredit)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--income-green)', fontWeight: 600 }}>
                Added to Dashboard & History
              </div>
            </div>

            <div className="card" style={{ padding: '16px', borderLeft: `4px solid ${totalCredit >= totalDebit ? 'var(--income-green)' : 'var(--expense-red)'}` }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Net Balance Impact
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: totalCredit >= totalDebit ? 'var(--income-green)' : 'var(--expense-red)', margin: '4px 0 2px' }}>
                {totalCredit >= totalDebit ? '+' : '-'}{formatINR(Math.abs(totalCredit - totalDebit))}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {totalCredit >= totalDebit ? 'Account balance increases' : 'Account balance decreases'}
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            {/* Filter pills */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={() => setFilterMode('all')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: filterMode === 'all' ? 'var(--primary)' : 'var(--surface-muted)',
                  color: filterMode === 'all' ? '#FFFFFF' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                All ({totalCount})
              </button>
              <button
                onClick={() => setFilterMode('selected')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: filterMode === 'selected' ? 'var(--primary)' : 'var(--surface-muted)',
                  color: filterMode === 'selected' ? '#FFFFFF' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                Selected ({selectedCount})
              </button>
              {duplicateCount > 0 && (
                <button
                  onClick={() => setFilterMode('duplicates')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: filterMode === 'duplicates' ? 'var(--warning-amber)' : 'rgba(245, 158, 11, 0.12)',
                    color: filterMode === 'duplicates' ? '#FFFFFF' : 'var(--warning-amber)',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  ⚠️ Duplicates ({duplicateCount})
                </button>
              )}
              {needsReviewCount > 0 && (
                <button
                  onClick={() => setFilterMode('review')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: filterMode === 'review' ? '#BE123C' : '#FFE4E6',
                    color: filterMode === 'review' ? '#FFFFFF' : '#BE123C',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  Needs Review ({needsReviewCount})
                </button>
              )}
            </div>

            {/* Quick action buttons */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleSelectAll(true)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'var(--surface-card)',
                  color: 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                Select All
              </button>

              <button
                type="button"
                onClick={() => handleSelectAll(false)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'var(--surface-card)',
                  color: 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                Deselect All
              </button>

              <button
                type="button"
                onClick={handleAutoCategorizeAi}
                disabled={isAiLoading}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#8B5CF6',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: isAiLoading ? 'wait' : 'pointer'
                }}
              >
                <Sparkles size={14} />
                <span>{isAiLoading ? 'AI Categorizing...' : 'AI Categorize (Groq)'}</span>
              </button>
            </div>
          </div>

          {/* Transactions Review Table */}
          <div className="card" style={{ padding: '0', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-muted)', borderBottom: '1.2px solid var(--border-light)' }}>
                  <th style={{ padding: '12px 14px', width: '40px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedCount === totalCount && totalCount > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      style={{ cursor: 'pointer', transform: 'scale(1.15)' }}
                    />
                  </th>
                  <th style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--text-secondary)' }}>Date</th>
                  <th style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--text-secondary)' }}>Payee / Merchant</th>
                  <th style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--text-secondary)' }}>Payment Flow</th>
                  <th style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--text-secondary)' }}>Category</th>
                  <th style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--text-secondary)', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--text-secondary)' }}>UPI / Status</th>
                </tr>
              </thead>
              <tbody>
                {displayedTxns.map((t) => (
                  <tr 
                    key={t.tempId}
                    style={{
                      borderBottom: '1px solid var(--border-light)',
                      backgroundColor: t.isDuplicate ? 'rgba(245, 158, 11, 0.04)' : (t.selected ? 'transparent' : 'rgba(241, 245, 249, 0.4)'),
                      opacity: t.selected ? 1 : 0.65,
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    {/* Checkbox */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={t.selected}
                        onChange={() => handleToggleSelect(t.tempId)}
                        style={{ cursor: 'pointer', transform: 'scale(1.15)' }}
                      />
                    </td>

                    {/* Date */}
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <input
                        type="date"
                        value={t.date ? t.date.split('T')[0] : ''}
                        onChange={(e) => handleUpdateRow(t.tempId, 'date', new Date(e.target.value).toISOString())}
                        style={{
                          border: '1px solid var(--border-light)',
                          borderRadius: '6px',
                          padding: '4px 6px',
                          fontSize: '0.75rem',
                          backgroundColor: '#FFFFFF'
                        }}
                      />
                    </td>

                    {/* Payee / Name */}
                    <td style={{ padding: '12px 14px', minWidth: '180px' }}>
                      <input
                        type="text"
                        value={t.name || ''}
                        onChange={(e) => handleUpdateRow(t.tempId, 'name', e.target.value)}
                        placeholder="Payee name"
                        style={{
                          width: '100%',
                          border: '1px solid var(--border-light)',
                          borderRadius: '6px',
                          padding: '5px 8px',
                          fontWeight: 700,
                          fontSize: '0.8125rem',
                          backgroundColor: '#FFFFFF'
                        }}
                      />
                      {t.rawDescription && (
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.rawDescription}>
                          {t.rawDescription}
                        </div>
                      )}
                    </td>

                    {/* Payment Flow (Sent vs Received) */}
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handleUpdateRow(t.tempId, 'isExpense', !t.isExpense)}
                          title="Click to toggle between Money Sent (Deducted from balance) and Money Received (Added to balance)"
                          style={{
                            padding: '4px 9px',
                            borderRadius: '6px',
                            border: t.isExpense ? '1px solid #FECACA' : '1px solid #A7F3D0',
                            backgroundColor: t.isExpense ? '#FEF2F2' : '#ECFDF5',
                            color: t.isExpense ? '#DC2626' : '#059669',
                            fontWeight: 800,
                            fontSize: '0.6875rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {t.isExpense ? '💸 Sent (- Deduct)' : '💰 Received (+ Add)'}
                        </button>

                        <select
                          value={t.type || (t.isExpense ? 'expense' : 'income')}
                          onChange={(e) => handleUpdateRow(t.tempId, 'type', e.target.value)}
                          style={{
                            border: '1px solid var(--border-light)',
                            borderRadius: '6px',
                            padding: '4px 6px',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            backgroundColor: '#FFFFFF',
                            color: 'var(--text-secondary)'
                          }}
                        >
                          <option value="expense">Expense</option>
                          <option value="income">Income</option>
                          <option value="refund">Refund</option>
                          <option value="transfer">Transfer</option>
                        </select>
                      </div>
                    </td>

                    {/* Category Selector */}
                    <td style={{ padding: '12px 14px', minWidth: '160px' }}>
                      <select
                        value={t.category || (t.isExpense ? 'Other Expense' : 'Other Income')}
                        onChange={(e) => handleUpdateRow(t.tempId, 'category', e.target.value)}
                        style={{
                          width: '100%',
                          border: '1px solid var(--border-light)',
                          borderRadius: '6px',
                          padding: '5px 8px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: '#FFFFFF'
                        }}
                      >
                        {ALL_CATEGORIES.map(c => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Amount */}
                    <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                        <span style={{ fontWeight: 800, color: t.isExpense ? 'var(--expense-red)' : 'var(--income-green)' }}>
                          {t.isExpense ? '-' : '+'}₹
                        </span>
                        <input
                          type="number"
                          step="any"
                          value={t.amount}
                          onChange={(e) => handleUpdateRow(t.tempId, 'amount', parseFloat(e.target.value) || 0)}
                          style={{
                            width: '80px',
                            textAlign: 'right',
                            border: '1px solid var(--border-light)',
                            borderRadius: '6px',
                            padding: '4px 6px',
                            fontWeight: 800,
                            fontSize: '0.8125rem',
                            backgroundColor: '#FFFFFF',
                            color: t.isExpense ? 'var(--expense-red)' : 'var(--income-green)'
                          }}
                        />
                      </div>
                    </td>

                    {/* UPI Status / Duplicate Badge */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {t.isUpi && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.625rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: '#EDE9FE',
                            color: '#6D28D9',
                            width: 'fit-content'
                          }}>
                            UPI {t.refId ? `#${t.refId.substring(t.refId.length - 6)}` : ''}
                          </span>
                        )}

                        {t.isDuplicate && (
                          <span 
                            title={t.duplicateReason}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.625rem',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: '#FEF3C7',
                              color: '#B45309',
                              width: 'fit-content'
                            }}
                          >
                            <AlertTriangle size={10} />
                            <span>Potential Duplicate</span>
                          </span>
                        )}

                        {t.needsReview && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.625rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: '#FFE4E6',
                            color: '#BE123C',
                            width: 'fit-content'
                          }}>
                            Review Type
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Confirm & Save Button Footer */}
          <div style={{
            position: 'sticky',
            bottom: '20px',
            backgroundColor: '#FFFFFF',
            padding: '16px 24px',
            borderRadius: '16px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
            border: '1.5px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
            zIndex: 30
          }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                Ready to Import {selectedCount} Transaction{selectedCount !== 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Net Debit: <strong style={{ color: 'var(--expense-red)' }}>{formatINR(totalDebit)}</strong> | Net Credit: <strong style={{ color: 'var(--income-green)' }}>{formatINR(totalCredit)}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={handleReset}
                disabled={isSaving}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: '1.2px solid var(--border-light)',
                  backgroundColor: 'var(--surface-muted)',
                  color: 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isSaving || selectedCount === 0}
                style={{
                  padding: '10px 24px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: selectedCount === 0 ? 'var(--text-muted)' : 'var(--primary)',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: (isSaving || selectedCount === 0) ? 'not-allowed' : 'pointer',
                  boxShadow: 'var(--shadow-md)'
                }}
              >
                {isSaving ? (
                  <>
                    <div style={{ width: '16px', height: '16px', border: '2px solid #FFFFFF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <span>Saving to MongoDB...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    <span>Confirm & Save ({selectedCount})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
