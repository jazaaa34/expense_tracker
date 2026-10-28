import React, { useState, useMemo } from 'react';
import { useWallet } from '../context/WalletContext';
import { formatINR } from '../services/storageService';
import MoneyGuardList from '../components/forecast/MoneyGuardList';
import { 
  detectDuplicatesInTransactions, 
  detectPriceIncreasesInTransactions,
  buildUnifiedAlerts
} from '../utils/alertAnalyzer';
import { 
  ShieldAlert, 
  Calendar, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  BellRing,
  Flame,
  ArrowUpRight,
  Info,
  Copy,
  Trash2,
  RefreshCw,
  ExternalLink,
  Tag,
  ArrowRight,
  ShieldCheck,
  Check
} from 'lucide-react';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AlertsPage({ onNavigateTab }) {
  const { 
    alerts, 
    resolveAlert, 
    dismissAlert, 
    deleteTransaction, 
    transactions, 
    refreshAlertsAnalysis 
  } = useWallet();

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'duplicates' | 'hikes' | 'peak' | 'pending' | 'resolved'
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 1. Live Analysis of Duplicate Transactions (including submitted import txns)
  const duplicateAlerts = useMemo(() => {
    return detectDuplicatesInTransactions(transactions);
  }, [transactions]);

  // 2. Live Analysis of Constant/Recurring Payment Increases
  const hikeAlerts = useMemo(() => {
    return detectPriceIncreasesInTransactions(transactions);
  }, [transactions]);

  // 3. Peak Day Analysis (Highest spending day of week)
  const { dayStats, peakDay, totalExpense } = useMemo(() => {
    const expenseTxns = transactions.filter(t => t.isExpense);
    const total = expenseTxns.reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const stats = DAY_NAMES.map((name, dayIndex) => {
      const dayTxns = expenseTxns.filter(t => {
        const d = new Date(t.date);
        return d.getDay() === dayIndex;
      });

      const amount = dayTxns.reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const count = dayTxns.length;

      // Top category on this day
      const catMap = {};
      for (const t of dayTxns) {
        catMap[t.category] = (catMap[t.category] || 0) + Number(t.amount || 0);
      }
      const topCatEntry = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
      const topCategory = topCatEntry ? topCatEntry[0] : 'None';
      const topCategoryAmount = topCatEntry ? topCatEntry[1] : 0;

      return {
        index: dayIndex,
        name,
        short: DAY_SHORT[dayIndex],
        amount,
        count,
        topCategory,
        topCategoryAmount,
        percentage: total > 0 ? (amount / total) * 100 : 0
      };
    });

    const sorted = [...stats].sort((a, b) => b.amount - a.amount);
    const peak = sorted[0] || { name: 'Saturday', amount: 0, percentage: 0, count: 0, topCategory: 'None' };

    return {
      dayStats: stats,
      peakDay: peak,
      totalExpense: total
    };
  }, [transactions]);

  // Max expense amount for chart scaling
  const maxDayAmount = useMemo(() => {
    return Math.max(1, ...dayStats.map(d => d.amount));
  }, [dayStats]);

  // Build unified alerts combining stored alerts + live detected alerts
  const unifiedAlertsData = useMemo(() => {
    return buildUnifiedAlerts(transactions, alerts);
  }, [transactions, alerts]);

  // Metrics for top diagnostic summary
  const totalDuplicateAmount = useMemo(() => {
    return duplicateAlerts
      .filter(d => !d.isResolved)
      .reduce((sum, d) => sum + Number(d.amount || 0), 0);
  }, [duplicateAlerts]);

  const totalHikeDifference = useMemo(() => {
    return hikeAlerts
      .filter(h => !h.isResolved)
      .reduce((sum, h) => sum + Number(h.diffAmount || 0), 0);
  }, [hikeAlerts]);

  const unresolvedDuplicatesCount = duplicateAlerts.filter(d => !d.isResolved).length;
  const unresolvedHikesCount = hikeAlerts.filter(h => !h.isResolved).length;
  const pendingAlertsCount = unifiedAlertsData.allAlerts.filter(a => !a.isResolved).length;

  // Handle deleting duplicate transaction
  const handleDeleteDuplicate = (duplicateTxnId, alertId, txnName, amount) => {
    if (!duplicateTxnId) return;
    deleteTransaction(duplicateTxnId);
    if (alertId) resolveAlert(alertId);
    setFeedbackMsg(`✓ Duplicate transaction "${txnName}" of ${formatINR(amount)} was deleted successfully.`);
    setTimeout(() => setFeedbackMsg(''), 5000);
  };

  // Handle manual refresh
  const handleRefreshAnalysis = () => {
    setIsRefreshing(true);
    if (refreshAlertsAnalysis) refreshAlertsAnalysis();
    setFeedbackMsg('✓ Re-scanned all transactions for duplicates and price hikes.');
    setTimeout(() => {
      setIsRefreshing(false);
      setTimeout(() => setFeedbackMsg(''), 4000);
    }, 600);
  };

  // Filtered list for the general Money Guard list section
  const displayAlerts = useMemo(() => {
    const list = unifiedAlertsData.allAlerts;
    if (activeTab === 'duplicates') return list.filter(a => a.type === 'duplicate' || a.iconType === 'copy');
    if (activeTab === 'hikes') return list.filter(a => a.type === 'price_increase' || a.iconType === 'trending-up');
    if (activeTab === 'pending') return list.filter(a => !a.isResolved);
    if (activeTab === 'resolved') return list.filter(a => a.isResolved);
    return list;
  }, [unifiedAlertsData, activeTab]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '26px', maxWidth: '1100px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* ========================================================================= */}
      {/* PAGE HEADER */}
      {/* ========================================================================= */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            backgroundColor: 'var(--expense-light)',
            color: 'var(--expense-red)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)'
          }}>
            <ShieldAlert size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
              Alerts & Financial Guard
            </h1>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Live statement analysis for duplicate charges, recurring payment increases, and peak spending days
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleRefreshAnalysis}
            disabled={isRefreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '10px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--border-light)',
              color: 'var(--text-secondary)',
              fontSize: '0.8125rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-xs)'
            }}
            title="Re-analyze transactions for duplicates and price hikes"
          >
            <RefreshCw size={14} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            <span>{isRefreshing ? 'Scanning...' : 'Re-scan Transactions'}</span>
          </button>

          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('import')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '10px',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                fontSize: '0.8125rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)'
              }}
            >
              <span>Import Statement</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Feedback Toast Banner */}
      {feedbackMsg && (
        <div style={{
          padding: '12px 18px',
          borderRadius: '12px',
          backgroundColor: '#ECFDF5',
          border: '1.5px solid #A7F3D0',
          color: '#065F46',
          fontSize: '0.875rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeIn 0.2s ease'
        }}>
          <CheckCircle2 size={18} color="#10B981" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3 DIAGNOSTIC SUMMARY CARDS: DUPLICATES, PAYMENT HIKES, PEAK SPEND */}
      {/* ========================================================================= */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px'
      }}>
        {/* CARD 1: DUPLICATE CHARGES SCANNER */}
        <div 
          onClick={() => setActiveTab('duplicates')}
          className="card" 
          style={{
            padding: '20px',
            border: unresolvedDuplicatesCount > 0 ? '1.5px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--border-light)',
            backgroundColor: unresolvedDuplicatesCount > 0 ? '#FEF2F2' : '#FFFFFF',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: unresolvedDuplicatesCount > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.1)',
              color: unresolvedDuplicatesCount > 0 ? '#DC2626' : '#10B981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Copy size={20} />
            </div>
            <span style={{
              fontSize: '0.6875rem',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '6px',
              backgroundColor: unresolvedDuplicatesCount > 0 ? '#EF4444' : '#10B981',
              color: '#FFFFFF',
              letterSpacing: '0.04em'
            }}>
              {unresolvedDuplicatesCount > 0 ? `${unresolvedDuplicatesCount} ACTION NEEDED` : 'CLEAN'}
            </span>
          </div>

          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Import & History Duplicates
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: unresolvedDuplicatesCount > 0 ? '#DC2626' : 'var(--text-primary)', marginTop: '4px' }}>
            {unresolvedDuplicatesCount > 0 ? `${unresolvedDuplicatesCount} Duplicate${unresolvedDuplicatesCount !== 1 ? 's' : ''}` : 'Zero Duplicates'}
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {unresolvedDuplicatesCount > 0 
              ? `${formatINR(totalDuplicateAmount)} potential double charge at risk` 
              : 'All imported transactions verified unique'}
          </div>
        </div>

        {/* CARD 2: CONSTANT PAYMENT HIKES SCANNER */}
        <div 
          onClick={() => setActiveTab('hikes')}
          className="card" 
          style={{
            padding: '20px',
            border: unresolvedHikesCount > 0 ? '1.5px solid rgba(245, 158, 11, 0.35)' : '1px solid var(--border-light)',
            backgroundColor: unresolvedHikesCount > 0 ? '#FFFBEB' : '#FFFFFF',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: unresolvedHikesCount > 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.1)',
              color: unresolvedHikesCount > 0 ? '#D97706' : '#10B981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <TrendingUp size={20} />
            </div>
            <span style={{
              fontSize: '0.6875rem',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '6px',
              backgroundColor: unresolvedHikesCount > 0 ? '#F59E0B' : '#10B981',
              color: '#FFFFFF',
              letterSpacing: '0.04em'
            }}>
              {unresolvedHikesCount > 0 ? `${unresolvedHikesCount} PRICE HIKE${unresolvedHikesCount !== 1 ? 'S' : ''}` : 'STABLE'}
            </span>
          </div>

          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Constant Payment Increases
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: unresolvedHikesCount > 0 ? '#B45309' : 'var(--text-primary)', marginTop: '4px' }}>
            {unresolvedHikesCount > 0 ? `+${formatINR(totalHikeDifference)} Outflow` : 'No Rate Hikes'}
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {unresolvedHikesCount > 0 
              ? `Detected on ${unresolvedHikesCount} recurring bill${unresolvedHikesCount !== 1 ? 's' : ''} / services` 
              : 'Subscriptions and utilities are at normal rates'}
          </div>
        </div>

        {/* CARD 3: PEAK OUTFLOW DAY */}
        <div 
          onClick={() => setActiveTab('peak')}
          className="card" 
          style={{
            padding: '20px',
            border: '1px solid var(--border-light)',
            backgroundColor: '#FFFFFF',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--expense-red)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Flame size={20} />
            </div>
            <span style={{
              fontSize: '0.6875rem',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '6px',
              backgroundColor: 'var(--expense-light)',
              color: 'var(--expense-red)',
              letterSpacing: '0.04em'
            }}>
              PEAK DAY
            </span>
          </div>

          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Highest Spending Day
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--expense-red)', marginTop: '4px' }}>
            {peakDay.name} ({formatINR(peakDay.amount)})
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {peakDay.percentage.toFixed(1)}% of total expenses across {peakDay.count} transactions
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FILTER TABS */}
      {/* ========================================================================= */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        borderBottom: '1px solid var(--border-light)',
        paddingBottom: '12px'
      }}>
        <div style={{
          display: 'flex',
          backgroundColor: 'var(--surface-muted)',
          padding: '4px',
          borderRadius: '12px',
          gap: '4px',
          overflowX: 'auto',
          maxWidth: '100%'
        }}>
          <button
            onClick={() => setActiveTab('all')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'all' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: activeTab === 'all' ? 'var(--shadow-xs)' : 'none'
            }}
          >
            All Insights ({unifiedAlertsData.allAlerts.length})
          </button>
          <button
            onClick={() => setActiveTab('duplicates')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: activeTab === 'duplicates' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'duplicates' ? '#DC2626' : 'var(--text-secondary)',
              boxShadow: activeTab === 'duplicates' ? 'var(--shadow-xs)' : 'none'
            }}
          >
            <Copy size={13} />
            <span>Duplicates ({duplicateAlerts.length})</span>
            {unresolvedDuplicatesCount > 0 && (
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
            )}
          </button>
          <button
            onClick={() => setActiveTab('hikes')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: activeTab === 'hikes' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'hikes' ? '#D97706' : 'var(--text-secondary)',
              boxShadow: activeTab === 'hikes' ? 'var(--shadow-xs)' : 'none'
            }}
          >
            <TrendingUp size={13} />
            <span>Price Increases ({hikeAlerts.length})</span>
            {unresolvedHikesCount > 0 && (
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
            )}
          </button>
          <button
            onClick={() => setActiveTab('peak')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: activeTab === 'peak' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'peak' ? 'var(--expense-red)' : 'var(--text-secondary)',
              boxShadow: activeTab === 'peak' ? 'var(--shadow-xs)' : 'none'
            }}
          >
            <Flame size={13} />
            <span>Peak Spending Day</span>
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'pending' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'pending' ? '#DC2626' : 'var(--text-secondary)',
              boxShadow: activeTab === 'pending' ? 'var(--shadow-xs)' : 'none'
            }}
          >
            Pending ({pendingAlertsCount})
          </button>
          <button
            onClick={() => setActiveTab('resolved')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'resolved' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'resolved' ? '#10B981' : 'var(--text-secondary)',
              boxShadow: activeTab === 'resolved' ? 'var(--shadow-xs)' : 'none'
            }}
          >
            Resolved ({unifiedAlertsData.allAlerts.length - pendingAlertsCount})
          </button>
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Showing: <strong style={{ color: 'var(--text-primary)' }}>{activeTab.toUpperCase()}</strong>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: DUPLICATE CHARGES FROM IMPORT / STATEMENT SUBMISSIONS */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'duplicates' || activeTab === 'pending') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Copy size={16} />
              </div>
              <h2 style={{ fontSize: '1.1875rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                Imported & Duplicate Transactions Analysis
              </h2>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              {duplicateAlerts.length} duplicate{duplicateAlerts.length !== 1 ? 's' : ''} detected
            </span>
          </div>

          {duplicateAlerts.length === 0 ? (
            <div className="card" style={{
              padding: '24px',
              textAlign: 'center',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--border-light)'
            }}>
              <CheckCircle2 size={32} color="#10B981" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                No Duplicate Transactions Found
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '500px', margin: '4px auto 0' }}>
                All transactions submitted via the Import section and recorded in your wallet have unique reference IDs and timestamps.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {duplicateAlerts.map(dup => {
                const isResolved = dup.isResolved;
                const orig = dup.originalTxn || {};
                const dupl = dup.duplicateTxn || {};

                return (
                  <div
                    key={dup.id}
                    className="card"
                    style={{
                      padding: '20px',
                      border: isResolved ? '1px solid var(--border-light)' : '1.5px solid rgba(239, 68, 68, 0.35)',
                      backgroundColor: isResolved ? 'var(--surface-muted)' : '#FFFFFF',
                      opacity: isResolved ? 0.65 : 1,
                      boxShadow: isResolved ? 'none' : '0 4px 16px rgba(239, 68, 68, 0.05)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '12px',
                          backgroundColor: isResolved ? 'var(--border-light)' : '#FEE2E2',
                          color: isResolved ? 'var(--text-muted)' : '#DC2626',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Copy size={22} />
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                              {dup.merchant || dupl.name || 'Duplicate Transaction'}
                            </span>
                            <span style={{
                              fontSize: '0.6875rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              backgroundColor: '#EF4444',
                              color: '#FFFFFF'
                            }}>
                              POTENTIAL DOUBLE CHARGE
                            </span>
                            {dup.isImported && (
                              <span style={{
                                fontSize: '0.6875rem',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                                color: 'var(--primary)'
                              }}>
                                Submitted in Import
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            {dup.description}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--expense-red)' }}>
                          {formatINR(dup.amount)}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                          {dup.refId ? `UTR: ${dup.refId}` : 'Matching Amount & Payee'}
                        </div>
                      </div>
                    </div>

                    {/* Comparison Box: Original vs Duplicate Record */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '12px',
                      padding: '14px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-light)',
                      marginBottom: '14px',
                      fontSize: '0.8125rem'
                    }}>
                      {/* Original Record */}
                      <div>
                        <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          Primary / Earlier Entry:
                        </div>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                          {orig.name || 'Original Transaction'}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                          📅 {orig.date ? new Date(orig.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Earlier'}
                          {orig.paymentMethod ? ` • ${orig.paymentMethod}` : ''}
                        </div>
                        {orig.note && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', fontStyle: 'italic' }}>
                            "{orig.note}"
                          </div>
                        )}
                      </div>

                      {/* Duplicate Record */}
                      <div>
                        <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#DC2626', textTransform: 'uppercase' }}>
                          Duplicate / Imported Entry:
                        </div>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                          {dupl.name || 'Imported Duplicate'}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                          📅 {dupl.date ? new Date(dupl.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recently'}
                          {dupl.refId ? ` • Ref: ${dupl.refId}` : ''}
                        </div>
                        {dupl.note && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', fontStyle: 'italic' }}>
                            "{dupl.note}"
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
                      {isResolved ? (
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--income-green)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={15} />
                          <span>Resolved / Dismissed</span>
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => resolveAlert(dup.id)}
                            style={{
                              padding: '8px 14px',
                              borderRadius: '8px',
                              backgroundColor: '#FFFFFF',
                              border: '1px solid var(--border-light)',
                              color: 'var(--text-secondary)',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <Check size={14} />
                            <span>Keep Both / Dismiss</span>
                          </button>

                          <button
                            onClick={() => handleDeleteDuplicate(dupl.id, dup.id, dupl.name || dup.merchant, dup.amount)}
                            style={{
                              padding: '8px 16px',
                              borderRadius: '8px',
                              backgroundColor: '#EF4444',
                              color: '#FFFFFF',
                              fontWeight: 800,
                              fontSize: '0.75rem',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
                            }}
                          >
                            <Trash2 size={14} />
                            <span>Delete Duplicate Transaction</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: CONSTANT / RECURRING PAYMENT INCREASES (SUBSCRIPTIONS, BILLS) */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'hikes' || activeTab === 'pending') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                color: '#D97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <TrendingUp size={16} />
              </div>
              <h2 style={{ fontSize: '1.1875rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                Constant Payment Increases (Recurring Bills & Subscriptions)
              </h2>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              {hikeAlerts.length} rate hike{hikeAlerts.length !== 1 ? 's' : ''} detected
            </span>
          </div>

          {hikeAlerts.length === 0 ? (
            <div className="card" style={{
              padding: '24px',
              textAlign: 'center',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--border-light)'
            }}>
              <CheckCircle2 size={32} color="#10B981" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Constant Payments Are Stable
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '520px', margin: '4px auto 0' }}>
                We track recurring expenses like electricity, broadband, mobile recharges, rent, and subscriptions. None of your regular bills have seen price increases.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {hikeAlerts.map(hike => {
                const isResolved = hike.isResolved;
                const prevDateStr = hike.previousDate ? new Date(hike.previousDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Previous';
                const latestDateStr = hike.latestDate ? new Date(hike.latestDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Latest';

                return (
                  <div
                    key={hike.id}
                    className="card"
                    style={{
                      padding: '20px',
                      border: isResolved ? '1px solid var(--border-light)' : '1.5px solid rgba(245, 158, 11, 0.4)',
                      backgroundColor: isResolved ? 'var(--surface-muted)' : '#FFFFFF',
                      opacity: isResolved ? 0.65 : 1,
                      boxShadow: isResolved ? 'none' : '0 4px 16px rgba(245, 158, 11, 0.06)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '12px',
                          backgroundColor: isResolved ? 'var(--border-light)' : '#FEF3C7',
                          color: isResolved ? 'var(--text-muted)' : '#D97706',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <TrendingUp size={22} />
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                              {hike.merchant}
                            </span>
                            <span style={{
                              fontSize: '0.6875rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              backgroundColor: '#F59E0B',
                              color: '#FFFFFF'
                            }}>
                              +{hike.percentIncrease}% INCREASE
                            </span>
                            <span style={{
                              fontSize: '0.6875rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              backgroundColor: 'var(--bg-secondary)',
                              color: 'var(--text-secondary)'
                            }}>
                              {hike.category || 'Recurring Bill'}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            {hike.description}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#D97706' }}>
                          +{formatINR(hike.diffAmount)}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                          Higher than prior bill
                        </div>
                      </div>
                    </div>

                    {/* Step Comparison Bar: Old vs New Price */}
                    <div style={{
                      padding: '12px 16px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(245, 158, 11, 0.06)',
                      border: '1px solid rgba(245, 158, 11, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                      marginBottom: '14px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div>
                          <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)' }}>PREVIOUS PAYMENT ({prevDateStr})</div>
                          <div style={{ fontSize: '1.0625rem', fontWeight: 800, color: 'var(--text-secondary)', textDecoration: 'line-through' }}>
                            {formatINR(hike.previousAmount)}
                          </div>
                        </div>
                        <ArrowRight size={18} color="#D97706" />
                        <div>
                          <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#D97706' }}>LATEST PAYMENT ({latestDateStr})</div>
                          <div style={{ fontSize: '1.1875rem', fontWeight: 900, color: '#B45309' }}>
                            {formatINR(hike.latestAmount)}
                          </div>
                        </div>
                      </div>

                      <div style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        color: '#B45309'
                      }}>
                        Rate Jump: +{formatINR(hike.diffAmount)} (+{hike.percentIncrease}%)
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                      {isResolved ? (
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--income-green)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={15} />
                          <span>Acknowledged</span>
                        </span>
                      ) : (
                        <>
                          {onNavigateTab && (
                            <button
                              onClick={() => onNavigateTab('history')}
                              style={{
                                padding: '8px 14px',
                                borderRadius: '8px',
                                backgroundColor: '#FFFFFF',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-secondary)',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <ExternalLink size={13} />
                              <span>View in History</span>
                            </button>
                          )}

                          <button
                            onClick={() => resolveAlert(hike.id)}
                            style={{
                              padding: '8px 16px',
                              borderRadius: '8px',
                              backgroundColor: '#F59E0B',
                              color: '#FFFFFF',
                              fontWeight: 800,
                              fontSize: '0.75rem',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)'
                            }}
                          >
                            <Check size={14} />
                            <span>Acknowledge Hike</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: WHICH DAY EXPENSE IS MOST (PEAK EXPENSE DAY ALERT & CHART) */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'peak') && (
        <div className="card" style={{
          padding: '28px',
          border: '1.5px solid rgba(239, 68, 68, 0.25)',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 8px 24px rgba(239, 68, 68, 0.06)',
          marginTop: '10px'
        }}>
          {/* Banner Alert Header */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                backgroundColor: 'var(--expense-red)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.35)',
                flexShrink: 0
              }}>
                <Flame size={26} />
              </div>
              <div>
                <div style={{
                  fontSize: '0.6875rem',
                  fontWeight: 900,
                  color: 'var(--expense-red)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <AlertTriangle size={13} />
                  <span>Highest Spending Day Analysis</span>
                </div>
                <div style={{ fontSize: '1.375rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '2px' }}>
                  Your Most Expensive Day is <span style={{ color: 'var(--expense-red)' }}>{peakDay.name}</span>
                </div>
              </div>
            </div>

            <div style={{
              padding: '10px 18px',
              borderRadius: '12px',
              backgroundColor: 'var(--expense-light)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              textAlign: 'right'
            }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {peakDay.name} Total Spend
              </div>
              <div style={{ fontSize: '1.375rem', fontWeight: 900, color: 'var(--expense-red)' }}>
                {formatINR(peakDay.amount)}
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
                {peakDay.percentage.toFixed(1)}% of all expenses
              </div>
            </div>
          </div>

          {/* Insight Summary Pill Box */}
          <div style={{
            padding: '14px 18px',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-light)',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.5
          }}>
            <Info size={20} color="var(--primary)" style={{ flexShrink: 0 }} />
            <div>
              You have spent a total of <strong>{formatINR(peakDay.amount)}</strong> across <strong>{peakDay.count} transactions</strong> on <strong>{peakDay.name}s</strong>.
              {peakDay.topCategory !== 'None' && (
                <span> Primary spending driver: <strong style={{ color: 'var(--text-primary)' }}>{peakDay.topCategory}</strong> ({formatINR(peakDay.topCategoryAmount)}).</span>
              )}
            </div>
          </div>

          {/* 7-Day Day-of-Week Comparison Chart */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{
              fontSize: '0.75rem',
              fontWeight: 800,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '16px'
            }}>
              Weekly Spending By Day of the Week
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '10px',
              alignItems: 'flex-end',
              minHeight: '180px',
              paddingTop: '20px'
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
                      gap: '8px',
                      height: '100%',
                      justifyContent: 'flex-end'
                    }}
                  >
                    <div style={{
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      color: isPeak ? 'var(--expense-red)' : 'var(--text-secondary)',
                      whiteSpace: 'nowrap'
                    }}>
                      {item.amount > 0 ? formatINR(item.amount) : '₹0'}
                    </div>

                    {isPeak && (
                      <span style={{
                        fontSize: '0.625rem',
                        fontWeight: 900,
                        backgroundColor: 'var(--expense-red)',
                        color: '#FFFFFF',
                        padding: '2px 6px',
                        borderRadius: '6px',
                        letterSpacing: '0.02em',
                        boxShadow: '0 2px 6px rgba(239, 68, 68, 0.3)'
                      }}>
                        MOST
                      </span>
                    )}

                    <div
                      style={{
                        width: '100%',
                        maxWidth: '44px',
                        height: `${barHeightPercent}%`,
                        backgroundColor: isPeak ? 'var(--expense-red)' : 'var(--primary)',
                        opacity: isPeak ? 1 : 0.45,
                        borderRadius: '8px 8px 4px 4px',
                        transition: 'all 0.3s ease'
                      }}
                      title={`${item.name}: ${formatINR(item.amount)} (${item.count} txns)`}
                    />

                    <div style={{ textAlign: 'center', marginTop: '2px' }}>
                      <div style={{
                        fontSize: '0.8125rem',
                        fontWeight: isPeak ? 900 : 700,
                        color: isPeak ? 'var(--expense-red)' : 'var(--text-primary)'
                      }}>
                        {item.short}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {item.count} txn{item.count !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{
            marginTop: '20px',
            padding: '14px 16px',
            borderRadius: '12px',
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
            border: '1px dashed rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
              💡 <strong>Money Guard Recommendation:</strong> Set a strict daily spending cap on <strong>{peakDay.name}s</strong> or plan large shopping runs on weekdays to curb peak outflow.
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 4: GENERAL MONEY GUARD ALERTS */}
      {/* ========================================================================= */}
      <div style={{ marginTop: '10px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              color: 'var(--warning-amber)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <BellRing size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                System Money Guard Alerts
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {displayAlerts.length} total alert{displayAlerts.length !== 1 ? 's' : ''} in this view
              </span>
            </div>
          </div>
        </div>

        {/* Money Guard Alert List Component */}
        <MoneyGuardList alerts={displayAlerts} onResolve={resolveAlert} />
      </div>
    </div>
  );
}
