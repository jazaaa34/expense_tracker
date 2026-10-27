import React, { useState, useMemo } from 'react';
import { useWallet } from '../context/WalletContext';
import { formatINR } from '../services/storageService';
import MoneyGuardList from '../components/forecast/MoneyGuardList';
import { 
  ShieldAlert, 
  Calendar, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  BellRing,
  Flame,
  ArrowUpRight,
  Info
} from 'lucide-react';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AlertsPage() {
  const { alerts, resolveAlert, transactions } = useWallet();
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'resolved'

  // 1. Calculate which day of week has the most expenses
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

      // Find top category on this day
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

  // Max expense amount among days for relative bar height
  const maxDayAmount = useMemo(() => {
    return Math.max(1, ...dayStats.map(d => d.amount));
  }, [dayStats]);

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    if (filter === 'pending') return alerts.filter(a => !a.isResolved);
    if (filter === 'resolved') return alerts.filter(a => a.isResolved);
    return alerts;
  }, [alerts, filter]);

  const pendingCount = alerts.filter(a => !a.isResolved).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Page Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            backgroundColor: 'var(--expense-light)',
            color: 'var(--expense-red)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ShieldAlert size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
              Alerts & Money Guard
            </h1>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Peak spending day detection and active financial guard alerts
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: WHICH DAY EXPENSE IS MOST (PEAK EXPENSE DAY ALERT) */}
      {/* ========================================================================= */}
      <div className="card" style={{
        padding: '28px',
        border: '1.5px solid rgba(239, 68, 68, 0.25)',
        backgroundColor: '#FFFFFF',
        boxShadow: '0 8px 24px rgba(239, 68, 68, 0.06)'
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
                  {/* Amount Label on Top */}
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    color: isPeak ? 'var(--expense-red)' : 'var(--text-secondary)',
                    whiteSpace: 'nowrap'
                  }}>
                    {item.amount > 0 ? formatINR(item.amount) : '₹0'}
                  </div>

                  {/* Peak Badge */}
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

                  {/* Bar */}
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '44px',
                      height: `${barHeightPercent}%`,
                      backgroundColor: isPeak ? 'var(--expense-red)' : 'var(--primary)',
                      opacity: isPeak ? 1 : 0.45,
                      borderRadius: '8px 8px 4px 4px',
                      transition: 'all 0.3s ease',
                      position: 'relative'
                    }}
                    title={`${item.name}: ${formatINR(item.amount)} (${item.count} txns)`}
                  />

                  {/* Day Label */}
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

        {/* Actionable Peak Day Alert Tip */}
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

      {/* ========================================================================= */}
      {/* SECTION 2: MONEY GUARD ALERTS */}
      {/* ========================================================================= */}
      <div>
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
                Money Guard Alerts
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {pendingCount} active alert{pendingCount !== 1 ? 's' : ''} requiring attention
              </span>
            </div>
          </div>

          {/* Filter Pills */}
          <div style={{
            display: 'flex',
            backgroundColor: 'var(--surface-muted)',
            padding: '4px',
            borderRadius: '10px',
            gap: '4px'
          }}>
            <button
              onClick={() => setFilter('all')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 800,
                backgroundColor: filter === 'all' ? '#FFFFFF' : 'transparent',
                color: filter === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: filter === 'all' ? 'var(--shadow-xs)' : 'none'
              }}
            >
              All ({alerts.length})
            </button>
            <button
              onClick={() => setFilter('pending')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 800,
                backgroundColor: filter === 'pending' ? '#FFFFFF' : 'transparent',
                color: filter === 'pending' ? 'var(--expense-red)' : 'var(--text-secondary)',
                boxShadow: filter === 'pending' ? 'var(--shadow-xs)' : 'none'
              }}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setFilter('resolved')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 800,
                backgroundColor: filter === 'resolved' ? '#FFFFFF' : 'transparent',
                color: filter === 'resolved' ? 'var(--income-green)' : 'var(--text-secondary)',
                boxShadow: filter === 'resolved' ? 'var(--shadow-xs)' : 'none'
              }}
            >
              Resolved ({alerts.length - pendingCount})
            </button>
          </div>
        </div>

        {/* Money Guard Alert List Component */}
        <MoneyGuardList alerts={filteredAlerts} onResolve={resolveAlert} />
      </div>
    </div>
  );
}
