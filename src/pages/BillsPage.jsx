import React, { useState, useMemo } from 'react';
import { useWallet } from '../context/WalletContext';
import { formatINR, formatDate, formatDateTime, getCategoryMeta, EXPENSE_CATEGORIES } from '../services/storageService';
import { exportService } from '../services/exportService';
import Modal from '../components/common/Modal';
import { 
  Camera, 
  Sparkles, 
  Receipt, 
  Search, 
  Download, 
  Trash2, 
  ExternalLink, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Calendar, 
  CreditCard, 
  FileCheck,
  X
} from 'lucide-react';
import { getCategoryIcon } from '../utils/categoryIcons';

export default function BillsPage({ onSelectTxn, onOpenScanBill, onOpenAddTxn }) {
  const { transactions, deleteTransaction, addTransaction } = useWallet();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all'); // 'all', 'this_month', 'last_30_days'
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'oldest', 'highest', 'lowest'

  // Lightbox Viewer state
  const [activeReceiptTxn, setActiveReceiptTxn] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Filter only transactions with a scanned bill or receipt attached
  const billTransactions = useMemo(() => {
    return transactions.filter(t => t.source === 'bill' || Boolean(t.screenshot));
  }, [transactions]);

  // Apply search, category, timeframe, and sorting
  const filteredBills = useMemo(() => {
    return billTransactions.filter(bill => {
      // Category filter
      if (selectedCategory !== 'all' && bill.category !== selectedCategory) {
        return false;
      }

      // Timeframe filter
      if (timeFilter !== 'all') {
        const d = new Date(bill.date);
        const now = new Date();
        if (timeFilter === 'this_month') {
          if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) {
            return false;
          }
        } else if (timeFilter === 'last_30_days') {
          const diffDays = (now - d) / (1000 * 60 * 60 * 24);
          if (diffDays > 30) return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (bill.name || '').toLowerCase().includes(q);
        const matchCat = (bill.category || '').toLowerCase().includes(q);
        const matchNote = (bill.note || '').toLowerCase().includes(q);
        const matchMethod = (bill.paymentMethod || '').toLowerCase().includes(q);
        const matchAmount = String(bill.amount || '').includes(q);
        if (!matchName && !matchCat && !matchNote && !matchMethod && !matchAmount) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.date) - new Date(a.date);
      if (sortBy === 'oldest') return new Date(a.date) - new Date(b.date);
      if (sortBy === 'highest') return (b.amount || 0) - (a.amount || 0);
      if (sortBy === 'lowest') return (a.amount || 0) - (b.amount || 0);
      return 0;
    });
  }, [billTransactions, searchQuery, selectedCategory, timeFilter, sortBy]);

  // Aggregate Metrics
  const totalBillSpend = useMemo(() => {
    return billTransactions.reduce((sum, b) => sum + Number(b.amount || 0), 0);
  }, [billTransactions]);

  // Quick Action: Load Sample Receipt Demo
  const handleLoadSampleBill = async () => {
    try {
      const sampleTxn = {
        name: 'FRESH MART',
        amount: 1250,
        date: new Date().toISOString(),
        category: 'Groceries',
        paymentMethod: 'UPI',
        note: 'Fresh groceries & vegetables',
        tag: 'Bills',
        isExpense: true,
        isMonthly: false,
        screenshot: '/sample_freshmart_bill.jpg',
        screenshotName: 'sample_freshmart_bill.jpg',
        source: 'bill',
        confidence: 0.99
      };
      addTransaction(sampleTxn);
    } catch (err) {
      console.error('Failed to load sample bill:', err);
    }
  };

  // Open Lightbox
  const handleOpenLightbox = (bill, e) => {
    if (e) e.stopPropagation();
    setActiveReceiptTxn(bill);
    setZoomLevel(1);
    setRotation(0);
  };

  // Download receipt image
  const handleDownloadReceipt = (bill, e) => {
    if (e) e.stopPropagation();
    if (!bill.screenshot) return;
    const a = document.createElement('a');
    a.href = bill.screenshot;
    a.download = bill.screenshotName || `${bill.name.replace(/\s+/g, '_')}_receipt.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              backgroundColor: '#F0FDFA',
              border: '1.2px solid rgba(13, 148, 136, 0.3)',
              color: 'var(--primary-teal, #0D9488)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Receipt size={20} strokeWidth={2.4} />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
              Bills & Receipts Vault
            </h1>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            All your scanned bills, receipts, and verified purchase records in one secure vault
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {billTransactions.length > 0 && (
            <button
              onClick={() => exportService.exportToCsv(billTransactions, 'WalletWeather_Bills_Vault.csv')}
              style={{
                padding: '9px 15px',
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
              title="Export all bill transactions to CSV"
            >
              <Download size={15} />
              <span>Export Bills CSV</span>
            </button>
          )}

          <button
            onClick={onOpenScanBill}
            style={{
              padding: '9px 20px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary-teal, #0D9488)',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(13, 148, 136, 0.3)',
              cursor: 'pointer'
            }}
            title="Scan or upload a new bill photo"
          >
            <Camera size={16} strokeWidth={2.5} />
            <Sparkles size={14} />
            <span>Scan New Bill</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards - Cleaned to 2 essential summary boxes */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '16px'
      }}>
        {/* Card 1: Total Bills Spend */}
        <div className="card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Bill Spend
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CreditCard size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.875rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            {formatINR(totalBillSpend)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Deducted from your income & balance across {billTransactions.length} archived receipt{billTransactions.length === 1 ? '' : 's'}
          </div>
        </div>

        {/* Card 2: Total Bills Count */}
        <div className="card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Receipts Archived
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#F0FDFA', color: '#0D9488', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileCheck size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.875rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            {billTransactions.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Saved with full photo proof & details
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Search Input */}
          <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search bills by store, category, note, amount..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Category Filter */}
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
              {EXPENSE_CATEGORIES.map(c => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>

            {/* Timeframe Filter */}
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
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
              <option value="all">All Time</option>
              <option value="this_month">This Month</option>
              <option value="last_30_days">Last 30 Days</option>
            </select>

            {/* Sorting Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
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
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="highest">Highest Amount</option>
              <option value="lowest">Lowest Amount</option>
            </select>
          </div>
        </div>

        {/* Results summary line */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.8125rem',
          color: 'var(--text-secondary)',
          borderTop: '1px solid var(--border-light)',
          paddingTop: '10px'
        }}>
          <span>Showing <strong>{filteredBills.length}</strong> bill transaction{filteredBills.length === 1 ? '' : 's'}</span>
          <span>Filtered Total: <strong style={{ color: 'var(--expense-red)' }}>{formatINR(filteredBills.reduce((s, b) => s + Number(b.amount || 0), 0))}</strong></span>
        </div>
      </div>

      {/* Main Content Area - Clean Gallery Cards View */}
      {filteredBills.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            backgroundColor: '#F0FDFA',
            border: '1.5px solid rgba(13, 148, 136, 0.25)',
            color: 'var(--primary-teal, #0D9488)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px'
          }}>
            <Receipt size={32} />
          </div>

          <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '6px' }}>
            {billTransactions.length === 0 ? 'Your Bills Vault is Empty' : 'No matching bills found'}
          </h3>

          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: '420px', marginBottom: '24px', lineHeight: 1.5 }}>
            {billTransactions.length === 0 
              ? 'Scan paper receipts or upload digital bills using camera OCR to automatically capture merchant names, dates, and amounts in your vault and history.'
              : 'Try clearing your search query or adjusting your filters to see your saved bills.'}
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={onOpenScanBill}
              style={{
                padding: '11px 22px',
                borderRadius: '12px',
                backgroundColor: 'var(--primary-teal, #0D9488)',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(13, 148, 136, 0.25)'
              }}
            >
              <Camera size={16} />
              <span>Scan Bill Now</span>
            </button>

            {billTransactions.length === 0 && (
              <button
                onClick={handleLoadSampleBill}
                style={{
                  padding: '11px 18px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--surface-muted)',
                  border: '1.2px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                title="Load a sample grocery receipt to test the vault"
              >
                <Sparkles size={16} color="var(--primary-teal, #0D9488)" />
                <span>Load Sample Fresh Mart Bill</span>
              </button>
            )}

            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setTimeFilter('all');
                }}
                style={{
                  padding: '11px 18px',
                  borderRadius: '12px',
                  backgroundColor: '#FFFFFF',
                  border: '1.2px solid var(--border-light)',
                  color: 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '0.875rem'
                }}
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      ) : (
        /* BILLS GALLERY GRID */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
          gap: '18px'
        }}>
          {filteredBills.map(bill => {
            const meta = getCategoryMeta(bill.category, true);
            const IconComp = getCategoryIcon(meta.icon);

            return (
              <div
                key={bill.id}
                className="card card-hover"
                style={{
                  borderRadius: '16px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.2s ease',
                  border: '1.2px solid var(--border-light)'
                }}
              >
                {/* Photo Header */}
                <div 
                  onClick={(e) => handleOpenLightbox(bill, e)}
                  style={{
                    height: '170px',
                    backgroundColor: '#0F172A',
                    position: 'relative',
                    cursor: 'zoom-in',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Click to zoom receipt photo"
                >
                  {bill.screenshot ? (
                    <img
                      src={bill.screenshot}
                      alt={`Receipt from ${bill.name}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transition: 'transform 0.3s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1.0)'}
                    />
                  ) : (
                    <div style={{ color: '#94A3B8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <Receipt size={32} />
                      <span style={{ fontSize: '0.75rem' }}>Receipt recorded</span>
                    </div>
                  )}

                  {/* Gradient Overlay for badges */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    padding: '10px 12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%)'
                  }}>
                    {/* Category pill */}
                    <span style={{
                      fontSize: '0.6875rem',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      color: meta.color || 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <IconComp size={12} />
                      <span>{bill.category}</span>
                    </span>
                  </div>

                  {/* Click to Zoom Pill */}
                  <div style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '8px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(15, 23, 42, 0.75)',
                    backdropFilter: 'blur(4px)',
                    color: '#FFFFFF',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <ZoomIn size={12} />
                    <span>View Bill</span>
                  </div>
                </div>

                {/* Card Body */}
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1, gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '1rem',
                        fontWeight: 900,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }} title={bill.name}>
                        {bill.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                        <Calendar size={13} color="var(--text-muted)" />
                        <span>{formatDate(bill.date)}</span>
                      </div>
                    </div>

                    <div style={{
                      fontSize: '1.1875rem',
                      fontWeight: 900,
                      color: 'var(--expense-red)',
                      letterSpacing: '-0.02em',
                      textAlign: 'right'
                    }}>
                      -{formatINR(bill.amount)}
                    </div>
                  </div>

                  {bill.note && (
                    <div style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      backgroundColor: 'var(--surface-muted)',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      lineHeight: 1.4,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      {bill.note}
                    </div>
                  )}

                  {/* Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: 'auto' }}>
                    <span style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--surface-muted)',
                      color: 'var(--text-secondary)'
                    }}>
                      {bill.paymentMethod || 'UPI'}
                    </span>
                    <span style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      backgroundColor: '#F0FDFA',
                      color: '#0D9488'
                    }}>
                      🧾 Scanned Bill
                    </span>
                  </div>

                  {/* Action Footer */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid var(--border-light)',
                    paddingTop: '10px',
                    marginTop: '4px'
                  }}>
                    <button
                      onClick={() => onSelectTxn(bill)}
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        color: 'var(--primary)',
                        padding: '5px 10px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--surface-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Open full transaction details"
                    >
                      <ExternalLink size={13} />
                      <span>Details</span>
                    </button>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      {bill.screenshot && (
                        <button
                          onClick={(e) => handleDownloadReceipt(bill, e)}
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '8px',
                            backgroundColor: 'var(--surface-muted)',
                            color: 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Download receipt image"
                        >
                          <Download size={14} />
                        </button>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Remove bill transaction for "${bill.name}"?`)) {
                            deleteTransaction(bill.id);
                          }
                        }}
                        style={{
                          width: '30px',
                          height: '30px',
                          borderRadius: '8px',
                          backgroundColor: '#FFF1F2',
                          color: '#BE123C',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Delete this bill"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FULL SCREEN RECEIPT LIGHTBOX MODAL */}
      {activeReceiptTxn && (
        <Modal
          isOpen={Boolean(activeReceiptTxn)}
          onClose={() => setActiveReceiptTxn(null)}
          title={`Bill Receipt: ${activeReceiptTxn.name}`}
          subtitle={`Recorded on ${formatDate(activeReceiptTxn.date)} • ${formatINR(activeReceiptTxn.amount)}`}
          maxWidth="780px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Toolbar: Zoom & Rotate & Download */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--surface-muted)',
              padding: '8px 14px',
              borderRadius: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 2.5))}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}
                  title="Zoom In"
                >
                  <ZoomIn size={14} />
                  <span>Zoom In</span>
                </button>

                <button
                  onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.5))}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}
                  title="Zoom Out"
                >
                  <ZoomOut size={14} />
                  <span>Zoom Out</span>
                </button>

                <button
                  onClick={() => setRotation(prev => (prev + 90) % 360)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}
                  title="Rotate 90 degrees"
                >
                  <RotateCw size={14} />
                  <span>Rotate</span>
                </button>

                <button
                  onClick={() => { setZoomLevel(1); setRotation(0); }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}
                >
                  Reset
                </button>
              </div>

              {activeReceiptTxn.screenshot && (
                <button
                  onClick={() => handleDownloadReceipt(activeReceiptTxn)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--primary)',
                    color: '#FFFFFF',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Download size={14} />
                  <span>Download Image</span>
                </button>
              )}
            </div>

            {/* High-res Photo Canvas Viewport */}
            <div style={{
              width: '100%',
              height: '420px',
              backgroundColor: '#0F172A',
              borderRadius: '16px',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              position: 'relative'
            }}>
              {activeReceiptTxn.screenshot ? (
                <img
                  src={activeReceiptTxn.screenshot}
                  alt={`Receipt from ${activeReceiptTxn.name}`}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                    transition: 'transform 0.2s ease',
                    objectFit: 'contain',
                    borderRadius: '8px',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
                  }}
                />
              ) : (
                <div style={{ color: '#94A3B8', textAlign: 'center' }}>
                  <Receipt size={48} style={{ margin: '0 auto 10px' }} />
                  <div>No image data available for this bill.</div>
                </div>
              )}
            </div>

            {/* Extracted Bill Info Summary Bar */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '10px',
              backgroundColor: 'var(--surface-muted)',
              padding: '14px',
              borderRadius: '12px'
            }}>
              <div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 700 }}>MERCHANT</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-primary)' }}>{activeReceiptTxn.name}</div>
              </div>

              <div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 700 }}>TOTAL AMOUNT</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 900, color: 'var(--expense-red)' }}>{formatINR(activeReceiptTxn.amount)}</div>
              </div>

              <div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 700 }}>CATEGORY</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>{activeReceiptTxn.category}</div>
              </div>

              <div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 700 }}>PAYMENT METHOD</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>{activeReceiptTxn.paymentMethod || 'UPI'}</div>
              </div>

              <div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 700 }}>STATUS</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0D9488' }}>
                  Archived Proof
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => {
                  const target = activeReceiptTxn;
                  setActiveReceiptTxn(null);
                  onSelectTxn(target);
                }}
                style={{
                  padding: '9px 16px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  fontSize: '0.8125rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <ExternalLink size={14} />
                <span>Open Full Transaction Details</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
