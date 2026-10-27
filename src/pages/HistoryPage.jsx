import React, { useState, useMemo } from 'react';
import { useWallet } from '../context/WalletContext';
import { exportService } from '../services/exportService';
import { formatINR, EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS } from '../services/storageService';
import TransactionTile from '../components/transactions/TransactionTile';
import EmptyState from '../components/common/EmptyState';
import { Search, Download, Filter, Plus, Calendar } from 'lucide-react';

export default function HistoryPage({ onSelectTxn, onOpenAddTxn, onOpenScanBill, initialQuery = '' }) {
  const { transactions } = useWallet();
  const [search, setSearch] = useState(initialQuery);
  const [filterType, setFilterType] = useState('all'); // 'all', 'expense', 'income', 'bills'
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedMethod, setSelectedMethod] = useState('all');

  const billCount = useMemo(() => {
    return transactions.filter(t => t.source === 'bill' || Boolean(t.screenshot)).length;
  }, [transactions]);

  const filteredTxns = useMemo(() => {
    return transactions.filter(t => {
      // Type Filter
      if (filterType === 'expense' && !t.isExpense) return false;
      if (filterType === 'income' && t.isExpense) return false;
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
    return filteredTxns.reduce((sum, t) => sum + (t.isExpense ? -t.amount : t.amount), 0);
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

        <div style={{ display: 'flex', gap: '10px' }}>
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
    </div>
  );
}
