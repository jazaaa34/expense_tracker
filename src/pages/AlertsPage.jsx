import React, { useState, useMemo } from 'react';
import { useWallet } from '../context/WalletContext';
import { formatINR } from '../services/storageService';
import { 
  detectDuplicatesInTransactions, 
  detectPriceIncreasesInTransactions 
} from '../utils/alertAnalyzer';
import { 
  ShieldAlert, 
  TrendingUp, 
  CheckCircle2, 
  Flame, 
  Copy, 
  Trash2, 
  RefreshCw, 
  ArrowRight, 
  Check, 
  AlertCircle,
  Clock,
  Sparkles
} from 'lucide-react';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AlertsPage({ onNavigateTab }) {
  const { 
    alerts, 
    resolveAlert, 
    deleteTransaction, 
    transactions, 
    refreshAlertsAnalysis 
  } = useWallet();

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'duplicates' | 'hikes' | 'peak'
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 1. Detect duplicates (e.g. paid twice on import or history)
  const duplicates = useMemo(() => {
    return detectDuplicatesInTransactions(transactions);
  }, [transactions]);

  // 2. Detect constant/recurring bills that went up in price
  const priceHikes = useMemo(() => {
    return detectPriceIncreasesInTransactions(transactions);
  }, [transactions]);

  // 3. Peak spending day analysis
  const { dayStats, peakDay, totalExpense } = useMemo(() => {
    const expenseTxns = transactions.filter(t => t.isExpense);
    const total = expenseTxns.reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const stats = DAY_NAMES.map((name, dayIndex) => {
      const dayTxns = expenseTxns.filter(t => new Date(t.date).getDay() === dayIndex);
      const amount = dayTxns.reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const count = dayTxns.length;

      const catMap = {};
      for (const t of dayTxns) {
        catMap[t.category] = (catMap[t.category] || 0) + Number(t.amount || 0);
      }
      const topCatEntry = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
      const topCategory = topCatEntry ? topCatEntry[0] : 'General';

      return {
        index: dayIndex,
        name,
        short: DAY_SHORT[dayIndex],
        amount,
        count,
        topCategory,
        percentage: total > 0 ? (amount / total) * 100 : 0
      };
    });

    const sorted = [...stats].sort((a, b) => b.amount - a.amount);
    const peak = sorted[0] || { name: 'Saturday', amount: 0, percentage: 0, count: 0, topCategory: 'General' };

    return { dayStats: stats, peakDay: peak, totalExpense: total };
  }, [transactions]);

  const maxDayAmount = useMemo(() => {
    return Math.max(1, ...dayStats.map(d => d.amount));
  }, [dayStats]);

  // Check resolved states against context alerts
  const resolvedIds = useMemo(() => {
    return new Set(alerts.filter(a => a.isResolved).map(a => String(a.id)));
  }, [alerts]);

  const unresolvedDuplicates = duplicates.filter(d => !d.isResolved && !resolvedIds.has(String(d.id)));
  const unresolvedHikes = priceHikes.filter(h => !h.isResolved && !resolvedIds.has(String(h.id)));

  const totalDuplicateMoney = unresolvedDuplicates.reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const totalHikeIncrease = unresolvedHikes.reduce((sum, h) => sum + Number(h.diffAmount || 0), 0);

  // Simple handler to delete duplicate transaction
  const handleDeleteDuplicate = (duplicateTxnId, alertId, name, amount) => {
    if (!duplicateTxnId) return;
    deleteTransaction(duplicateTxnId);
    if (alertId) resolveAlert(alertId);
    setFeedbackMsg(`Deleted duplicate payment of ${formatINR(amount)} for ${name}. Balance updated.`);
    setTimeout(() => setFeedbackMsg(''), 4500);
  };

  // Simple dismiss / keep both
  const handleDismiss = (alertId) => {
    resolveAlert(alertId);
    setFeedbackMsg('Alert dismissed.');
    setTimeout(() => setFeedbackMsg(''), 3000);
  };

  // Quick refresh scan
  const handleRefresh = () => {
    setIsRefreshing(true);
    if (refreshAlertsAnalysis) refreshAlertsAnalysis();
    setFeedbackMsg('Re-scanned all transactions for duplicates and price jumps.');
    setTimeout(() => {
      setIsRefreshing(false);
      setTimeout(() => setFeedbackMsg(''), 3500);
    }, 500);
  };

  const totalActiveAlerts = unresolvedDuplicates.length + unresolvedHikes.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', maxWidth: '960px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* ========================================================================= */}
      {/* 1. SIMPLE PAGE HEADER */}
      {/* ========================================================================= */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.625rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Alerts & Reminders
            </h1>
            {totalActiveAlerts > 0 && (
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                backgroundColor: '#EF4444',
                color: '#FFFFFF',
                padding: '2px 8px',
                borderRadius: '12px'
              }}>
                {totalActiveAlerts} new
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            We watch your payments for double charges, price increases on bills, and heavy spending days.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            borderRadius: '9px',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--border-light)',
            color: 'var(--text-secondary)',
            fontSize: '0.8125rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: 'var(--shadow-xs)'
          }}
        >
          <RefreshCw size={13} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
          <span>{isRefreshing ? 'Checking...' : 'Re-check Now'}</span>
        </button>
      </div>

      {/* Friendly Feedback Message */}
      {feedbackMsg && (
        <div style={{
          padding: '10px 16px',
          borderRadius: '10px',
          backgroundColor: '#ECFDF5',
          border: '1px solid #A7F3D0',
          color: '#065F46',
          fontSize: '0.8125rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={16} color="#10B981" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. THREE SIMPLE SUMMARY CARDS */}
      {/* ========================================================================= */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '14px'
      }}>
        {/* CARD 1: DUPLICATE PAYMENTS */}
        <div 
          onClick={() => setActiveTab('duplicates')}
          className="card"
          style={{
            padding: '18px',
            border: unresolvedDuplicates.length > 0 ? '1.5px solid #FCA5A5' : '1px solid var(--border-light)',
            backgroundColor: unresolvedDuplicates.length > 0 ? '#FEF2F2' : '#FFFFFF',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Double Payments
            </span>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              backgroundColor: unresolvedDuplicates.length > 0 ? '#FEE2E2' : '#E0F2FE',
              color: unresolvedDuplicates.length > 0 ? '#DC2626' : 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Copy size={15} />
            </div>
          </div>
          <div style={{ fontSize: '1.375rem', fontWeight: 900, color: unresolvedDuplicates.length > 0 ? '#DC2626' : 'var(--text-primary)' }}>
            {unresolvedDuplicates.length > 0 ? `${unresolvedDuplicates.length} found` : 'None found ✓'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {unresolvedDuplicates.length > 0 ? `${formatINR(totalDuplicateMoney)} paid twice` : 'No duplicate charges in your records'}
          </div>
        </div>

        {/* CARD 2: BILL INCREASES */}
        <div 
          onClick={() => setActiveTab('hikes')}
          className="card"
          style={{
            padding: '18px',
            border: unresolvedHikes.length > 0 ? '1.5px solid #FDE68A' : '1px solid var(--border-light)',
            backgroundColor: unresolvedHikes.length > 0 ? '#FFFBEB' : '#FFFFFF',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Bill Increases
            </span>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              backgroundColor: unresolvedHikes.length > 0 ? '#FEF3C7' : '#ECFDF5',
              color: unresolvedHikes.length > 0 ? '#D97706' : '#10B981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <TrendingUp size={15} />
            </div>
          </div>
          <div style={{ fontSize: '1.375rem', fontWeight: 900, color: unresolvedHikes.length > 0 ? '#B45309' : 'var(--text-primary)' }}>
            {unresolvedHikes.length > 0 ? `${unresolvedHikes.length} bill${unresolvedHikes.length !== 1 ? 's' : ''} went up` : 'All steady ✓'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {unresolvedHikes.length > 0 ? `+${formatINR(totalHikeIncrease)} higher this month` : 'Regular bills have not increased'}
          </div>
        </div>

        {/* CARD 3: PEAK SPEND DAY */}
        <div 
          onClick={() => setActiveTab('peak')}
          className="card"
          style={{
            padding: '18px',
            border: '1px solid var(--border-light)',
            backgroundColor: '#FFFFFF',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Heaviest Spend Day
            </span>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--expense-red)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Flame size={15} />
            </div>
          </div>
          <div style={{ fontSize: '1.375rem', fontWeight: 900, color: 'var(--expense-red)' }}>
            {peakDay.name}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {formatINR(peakDay.amount)} ({peakDay.percentage.toFixed(0)}% of your expenses)
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. SIMPLE FILTER TABS */}
      {/* ========================================================================= */}
      <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px', overflowX: 'auto' }}>
        <button
          onClick={() => setActiveTab('all')}
          style={{
            padding: '7px 14px',
            borderRadius: '8px',
            fontSize: '0.75rem',
            fontWeight: 800,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'all' ? 'var(--primary)' : 'var(--surface-muted)',
            color: activeTab === 'all' ? '#FFFFFF' : 'var(--text-secondary)'
          }}
        >
          All Alerts ({totalActiveAlerts})
        </button>
        <button
          onClick={() => setActiveTab('duplicates')}
          style={{
            padding: '7px 14px',
            borderRadius: '8px',
            fontSize: '0.75rem',
            fontWeight: 800,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'duplicates' ? '#EF4444' : 'var(--surface-muted)',
            color: activeTab === 'duplicates' ? '#FFFFFF' : (unresolvedDuplicates.length > 0 ? '#DC2626' : 'var(--text-secondary)')
          }}
        >
          Double Payments ({unresolvedDuplicates.length})
        </button>
        <button
          onClick={() => setActiveTab('hikes')}
          style={{
            padding: '7px 14px',
            borderRadius: '8px',
            fontSize: '0.75rem',
            fontWeight: 800,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'hikes' ? '#F59E0B' : 'var(--surface-muted)',
            color: activeTab === 'hikes' ? '#FFFFFF' : (unresolvedHikes.length > 0 ? '#D97706' : 'var(--text-secondary)')
          }}
        >
          Bill Increases ({unresolvedHikes.length})
        </button>
        <button
          onClick={() => setActiveTab('peak')}
          style={{
            padding: '7px 14px',
            borderRadius: '8px',
            fontSize: '0.75rem',
            fontWeight: 800,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'peak' ? 'var(--expense-red)' : 'var(--surface-muted)',
            color: activeTab === 'peak' ? '#FFFFFF' : 'var(--text-secondary)'
          }}
        >
          Weekly Spend Day
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 4. ALL CLEAR MESSAGE (WHEN NO ACTIVE ALERTS) */}
      {/* ========================================================================= */}
      {totalActiveAlerts === 0 && (activeTab === 'all' || activeTab === 'duplicates' || activeTab === 'hikes') && (
        <div className="card" style={{
          padding: '32px 20px',
          textAlign: 'center',
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--border-light)'
        }}>
          <CheckCircle2 size={36} color="#10B981" style={{ margin: '0 auto 10px' }} />
          <div style={{ fontSize: '1.0625rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Everything Looks Good!
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '440px', margin: '4px auto 0' }}>
            No double charges or bill increases detected. When you import new statements or enter transactions, we will check them automatically.
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. DOUBLE CHARGE ALERTS (SIMPLE CARDS) */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'duplicates') && unresolvedDuplicates.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#DC2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={16} />
            <span>Double Payments Found ({unresolvedDuplicates.length})</span>
          </div>

          {unresolvedDuplicates.map(dup => {
            const dupl = dup.duplicateTxn || {};
            const orig = dup.originalTxn || {};
            const dateStr = dup.dateStr || (dupl.date ? new Date(dupl.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'recently');

            return (
              <div
                key={dup.id}
                className="card"
                style={{
                  padding: '16px 20px',
                  border: '1.5px solid #FCA5A5',
                  backgroundColor: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '14px',
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.05)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: '#FEE2E2',
                    color: '#DC2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}>
                    <Copy size={18} />
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {dup.merchant || dupl.name}
                      </span>
                      <span style={{
                        fontSize: '0.6875rem',
                        fontWeight: 800,
                        backgroundColor: '#FEE2E2',
                        color: '#DC2626',
                        padding: '2px 6px',
                        borderRadius: '6px'
                      }}>
                        Paid twice
                      </span>
                      {dup.isImported && (
                        <span style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          backgroundColor: 'var(--surface-muted)',
                          color: 'var(--text-secondary)',
                          padding: '2px 6px',
                          borderRadius: '6px'
                        }}>
                          From statement
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                      Two identical payments of <strong>{formatINR(dup.amount)}</strong> recorded on {dateStr}.
                      {dup.refId && <span> (UPI Ref: {dup.refId})</span>}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => handleDismiss(dup.id)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'transparent',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Keep both
                  </button>

                  <button
                    onClick={() => handleDeleteDuplicate(dupl.id, dup.id, dup.merchant || dupl.name, dup.amount)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      backgroundColor: '#EF4444',
                      color: '#FFFFFF',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={13} />
                    <span>Delete extra payment ({formatINR(dup.amount)})</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. BILL INCREASE ALERTS (SIMPLE CARDS) */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'hikes') && unresolvedHikes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#D97706', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <TrendingUp size={16} />
            <span>Bill Increases ({unresolvedHikes.length})</span>
          </div>

          {unresolvedHikes.map(hike => {
            return (
              <div
                key={hike.id}
                className="card"
                style={{
                  padding: '16px 20px',
                  border: '1.5px solid #FDE68A',
                  backgroundColor: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '14px',
                  boxShadow: '0 2px 8px rgba(245, 158, 11, 0.05)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: '#FEF3C7',
                    color: '#D97706',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}>
                    <TrendingUp size={18} />
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {hike.merchant}
                      </span>
                      <span style={{
                        fontSize: '0.6875rem',
                        fontWeight: 800,
                        backgroundColor: '#FEF3C7',
                        color: '#B45309',
                        padding: '2px 6px',
                        borderRadius: '6px'
                      }}>
                        +{hike.percentIncrease}% higher
                      </span>
                      <span style={{
                        fontSize: '0.6875rem',
                        color: 'var(--text-muted)'
                      }}>
                        {hike.category || 'Regular bill'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                      Went up from <strong>{formatINR(hike.previousAmount)}</strong> to <strong>{formatINR(hike.latestAmount)}</strong> (+{formatINR(hike.diffAmount)} more).
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {onNavigateTab && (
                    <button
                      onClick={() => onNavigateTab('history')}
                      style={{
                        padding: '7px 12px',
                        borderRadius: '8px',
                        backgroundColor: 'transparent',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-secondary)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      View in History
                    </button>
                  )}

                  <button
                    onClick={() => handleDismiss(hike.id)}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '8px',
                      backgroundColor: '#F59E0B',
                      color: '#FFFFFF',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Got it
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. HEAVIEST SPENDING DAY CHART (CLEAN & SIMPLE) */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'peak') && (
        <div className="card" style={{
          padding: '22px',
          border: '1px solid var(--border-light)',
          backgroundColor: '#FFFFFF',
          marginTop: '6px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--expense-red)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Flame size={18} />
              </div>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                  You spend the most on <span style={{ color: 'var(--expense-red)' }}>{peakDay.name}s</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Total of {formatINR(peakDay.amount)} across {peakDay.count} transactions ({peakDay.percentage.toFixed(0)}% of all spending)
                </div>
              </div>
            </div>

            <div style={{
              fontSize: '0.75rem',
              fontWeight: 800,
              backgroundColor: 'var(--bg-secondary)',
              padding: '6px 12px',
              borderRadius: '8px',
              color: 'var(--text-secondary)'
            }}>
              Main spending: {peakDay.topCategory}
            </div>
          </div>

          {/* Clean 7-day bar chart */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '8px',
            alignItems: 'flex-end',
            minHeight: '140px',
            paddingTop: '16px'
          }}>
            {dayStats.map((item) => {
              const isPeak = item.index === peakDay.index && item.amount > 0;
              const barHeightPercent = maxDayAmount > 0 ? Math.max(12, (item.amount / maxDayAmount) * 100) : 12;

              return (
                <div
                  key={item.name}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    height: '100%',
                    justifyContent: 'flex-end'
                  }}
                >
                  <div style={{
                    fontSize: '0.6875rem',
                    fontWeight: 800,
                    color: isPeak ? 'var(--expense-red)' : 'var(--text-muted)',
                    whiteSpace: 'nowrap'
                  }}>
                    {item.amount > 0 ? formatINR(item.amount) : '₹0'}
                  </div>

                  <div
                    style={{
                      width: '100%',
                      maxWidth: '36px',
                      height: `${barHeightPercent}%`,
                      backgroundColor: isPeak ? 'var(--expense-red)' : 'var(--primary)',
                      opacity: isPeak ? 1 : 0.4,
                      borderRadius: '6px 6px 3px 3px',
                      transition: 'height 0.2s ease'
                    }}
                    title={`${item.name}: ${formatINR(item.amount)}`}
                  />

                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: isPeak ? 900 : 700,
                    color: isPeak ? 'var(--expense-red)' : 'var(--text-primary)'
                  }}>
                    {item.short}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{
            marginTop: '16px',
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-secondary)',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)'
          }}>
            💡 <strong>Helpful Tip:</strong> Plan large shopping or eating-out trips on weekdays to reduce high spending on {peakDay.name}s.
          </div>
        </div>
      )}

    </div>
  );
}
