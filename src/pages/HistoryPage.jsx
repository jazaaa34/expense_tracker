import React, { useState, useMemo } from 'react';
import { useWallet } from '../context/WalletContext';
import { exportService } from '../services/exportService';
import { formatINR, EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS, isIncomeTxn, isExpenseTxn } from '../services/storageService';
import TransactionTile from '../components/transactions/TransactionTile';
import EmptyState from '../components/common/EmptyState';
import { Search, Download, Filter, Plus, Calendar, RotateCcw, AlertTriangle } from 'lucide-react';

export default function HistoryPage({ onSelectTxn, onOpenAddTxn, onOpenScanBill, initialQuery = '' }) {
  const { transactions, resetAllToZero } = useWallet();
  const [search, setSearch] = useState(initialQuery);
  const [filterType, setFilterType] = useState('all'); // 'all', 'expense', 'income', 'bills'
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedMethod, setSelectedMethod] = useState('all');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const billCount = useMemo(() => {
    return transactions.filter(t => t.source === 'bill' || Boolean(t.screenshot)).length;
  }, [transactions]);

  const filteredTxns = useMemo(() => {
    return transactions.filter(t => {
      // Type Filter
      if (filterType === 'expense' && !isExpenseTxn(t)) return false;
      if (filterType === 'income' && !isIncomeTxn(t)) return false;
      if (filterType === 'bills' && !(t.source === 'bill' || Boolean(t.screenshot))) return false;

      // Category Filter
      if (selectedCategory !== 'all' && t.category !== selectedCategory) return false;

      // Payment Method Filter
      if (selectedMethod !== 'all' && t.paymentMethod !== selectedMethod) return false;

      // Search Query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = (t.name || '').toLowerCase().includes(q);
        const matchCat = (t.category || '').toLowerCase().includes(q);
        const matchNote = (t.note || '').toLowerCase().includes(q);
        const matchTag = (t.tag || '').toLowerCase().includes(q);
        const matchMethod = (t.paymentMethod || '').toLowerCase().includes(q);
        if (!matchName && !matchCat && !matchNote && !matchTag && !matchMethod) return false;
      }

      return true;
    });
  }, [transactions, search, filterType, selectedCategory, selectedMethod]);

  // Date Grouping
  const groupedTxns = useMemo(() => {
    const groups = {};
    for (const t of filteredTxns) {
      const d = new Date(t.date);
      const dateKey = d.toISOString().split('T')[0];
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(t);
    }
    return groups;
  }, [filteredTxns]);

  const allCategories = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

  const totalFilteredSum = useMemo(() => {
    return filteredTxns.reduce((sum, t) => sum + (isExpenseTxn(t) ? -t.amount : t.amount), 0);
  }, [filteredTxns]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Export Action */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            Transaction History
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Search, filter, and audit your financial records
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => exportService.exportToCsv(transactions)}
            style={{
              padding: '9px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--surface-card)',
              border: '1.2px solid var(--border-light)',
              color: 'var(--text-primary)',
              fontWeight: 700,
              fontSize: '0.8125rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: 'var(--shadow-xs)'
            }}
          >
            <Download size={16} />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsResetModalOpen(true)}
            title="Wipe transactions and start from zero"
            style={{
              padding: '9px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#FEE2E2',
              color: '#DC2626',
              border: '1.2px solid #FECACA',
              fontWeight: 700,
              fontSize: '0.8125rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <RotateCcw size={15} />
            <span>Reset to 0</span>
          </button>

          <button
            onClick={onOpenAddTxn}
            style={{
              padding: '9px 18px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.8125rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <Plus size={16} />
            <span>Add Entry</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search Box */}
          <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Filter by description, tag, or note..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                height: '42px',
                paddingLeft: '38px',
                paddingRight: '14px',
                borderRadius: 'var(--radius-md)',
                border: '1.2px solid var(--border-light)',
                fontSize: '0.875rem'
              }}
            />
          </div>

          {/* Type Toggle Pills */}
          <div style={{ display: 'flex', backgroundColor: 'var(--surface-muted)', borderRadius: '10px', padding: '3px' }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'expense', label: 'Expense' },
              { id: 'income', label: 'Income' },
              { id: 'bills', label: `🧾 Bills (${billCount})` }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                style={{
                  padding: '7px 13px',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  backgroundColor: filterType === tab.id ? '#FFFFFF' : 'transparent',
                  color: filterType === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
                  boxShadow: filterType === tab.id ? 'var(--shadow-xs)' : 'none',
                  whiteSpace: 'nowrap'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{
              height: '42px',
              padding: '0 12px',
              borderRadius: 'var(--radius-md)',
              border: '1.2px solid var(--border-light)',
              backgroundColor: '#FFFFFF',
              fontSize: '0.8125rem',
              fontWeight: 600
            }}
          >
            <option value="all">All Categories</option>
            {allCategories.map(c => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>

          {/* Payment Method Dropdown */}
          <select
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value)}
            style={{
              height: '42px',
              padding: '0 12px',
              borderRadius: 'var(--radius-md)',
              border: '1.2px solid var(--border-light)',
              backgroundColor: '#FFFFFF',
              fontSize: '0.8125rem',
              fontWeight: 600
            }}
          >
            <option value="all">All Payment Methods</option>
            {PAYMENT_METHODS.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Stats summary */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.8125rem',
          color: 'var(--text-secondary)',
          borderTop: '1px solid var(--border-light)',
          paddingTop: '10px'
        }}>
          <span>Showing <strong>{filteredTxns.length}</strong> transactions</span>
          <span>Net for selected filter: <strong style={{ color: totalFilteredSum >= 0 ? 'var(--income-green)' : 'var(--expense-red)' }}>{formatINR(totalFilteredSum)}</strong></span>
        </div>
      </div>

      {/* Transaction Groups */}
      {filteredTxns.length === 0 ? (
        <EmptyState
          title="No transactions matched"
          description="Try broadening your search term or resetting the filters."
          actionLabel="Clear Filters"
          onAction={() => {
            setSearch('');
            setFilterType('all');
            setSelectedCategory('all');
            setSelectedMethod('all');
          }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {Object.entries(groupedTxns).map(([dateKey, items]) => {
            const dateObj = new Date(dateKey);
            const now = new Date();
            const isToday = dateKey === now.toISOString().split('T')[0];

            let heading = `${dateObj.getDate()} ${dateObj.toLocaleString('default', { month: 'short' })} ${dateObj.getFullYear()}`;
            if (isToday) heading = 'Today';

            return (
              <div key={dateKey}>
                <div style={{
                  fontSize: '0.8125rem',
                  fontWeight: 800,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Calendar size={14} />
                  <span>{heading}</span>
                </div>

                <div>
                  {items.map(txn => (
                    <TransactionTile
                      key={txn.id}
                      txn={txn}
                      onClick={() => onSelectTxn(txn)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {isResetModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            maxWidth: '440px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: '#FEE2E2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#DC2626'
              }}>
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Reset Everything to ₹0?
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                  Start fresh with zero history
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              This will permanently delete all transactions, scanned bills, budgets, and goals, resetting your balance and income to <strong>₹0.00</strong>. This action also syncs to MongoDB Atlas cloud.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                style={{
                  padding: '9px 16px',
                  borderRadius: '10px',
                  border: '1.2px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  resetAllToZero();
                  setIsResetModalOpen(false);
                }}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  cursor: 'pointer'
                }}
              >
                Yes, Reset Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
