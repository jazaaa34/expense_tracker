import React, { useMemo } from 'react';
import { useWallet } from '../context/WalletContext';
import { formatINR, isExpenseTxn, getCategoryMeta } from '../services/storageService';
import { getCategoryIcon } from '../utils/categoryIcons';
import { 
  Zap, 
  TrendingDown, 
  Plus, 
  AlertCircle,
  PieChart,
  ArrowDownRight,
  ShieldAlert
} from 'lucide-react';

export default function AnalyticsPage({ onOpenAddTxn }) {
  const { transactions = [] } = useWallet();

  // Aggregate deductions by sector / category
  const { sortedSectors, topSector, totalDeductions, expenseTxnCount } = useMemo(() => {
    const sectorMap = {};
    let total = 0;
    let count = 0;

    for (const t of transactions) {
      if (!isExpenseTxn(t)) continue;
      const amt = Number(t.amount) || 0;
      if (amt <= 0) continue;

      const sectorName = (t.category && t.category.trim()) ? t.category.trim() : 'Other Expense';
      if (!sectorMap[sectorName]) {
        sectorMap[sectorName] = {
          name: sectorName,
          amount: 0,
          count: 0
        };
      }
      sectorMap[sectorName].amount += amt;
      sectorMap[sectorName].count += 1;
      total += amt;
      count += 1;
    }

    const sorted = Object.values(sectorMap)
      .sort((a, b) => b.amount - a.amount)
      .map(s => ({
        ...s,
        percentage: total > 0 ? Math.round((s.amount / total) * 100) : 0
      }));

    return {
      sortedSectors: sorted,
      topSector: sorted.length > 0 ? sorted[0] : null,
      totalDeductions: total,
      expenseTxnCount: count
    };
  }, [transactions]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '900px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Page Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            color: 'var(--expense-red)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <TrendingDown size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
              Utility Usage & Sector Deductions
            </h1>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Identify which sector has the highest money deducted from your wallet
            </p>
          </div>
        </div>
      </div>

      {/* Case 1: No Money Deducted Yet (Empty state) */}
      {!topSector ? (
        <div className="card" style={{
          padding: '48px 24px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          border: '1.5px dashed var(--border-light)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            backgroundColor: 'var(--surface-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)'
          }}>
            <PieChart size={32} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
              No Money Deducted Yet
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto', lineHeight: 1.5 }}>
              There are no expense deductions recorded in your account. Add your daily spending or utility bills to see which sector most money is deducted from.
            </p>
          </div>
          {onOpenAddTxn && (
            <button
              onClick={onOpenAddTxn}
              style={{
                marginTop: '8px',
                padding: '10px 20px',
                borderRadius: '10px',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <Plus size={16} />
              <span>Record An Expense</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Case 2: Hero Highlight — In Which Sector Most Money Deducted */}
          {(() => {
            const meta = getCategoryMeta(topSector.name, true);
            const IconComp = getCategoryIcon(meta.icon);

            return (
              <div style={{
                background: 'linear-gradient(135deg, #FFF1F2 0%, #FFFFFF 100%)',
                border: '1.8px solid #FECDD3',
                borderRadius: '20px',
                padding: '28px 26px',
                boxShadow: '0 10px 25px -5px rgba(225, 29, 72, 0.08)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Decorative background glow */}
                <div style={{
                  position: 'absolute',
                  top: '-30px',
                  right: '-30px',
                  width: '160px',
                  height: '160px',
                  borderRadius: '50%',
                  background: 'rgba(244, 63, 94, 0.08)',
                  pointerEvents: 'none'
                }} />

                {/* Badge Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '18px' }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '999px',
                    backgroundColor: '#FFE4E6',
                    color: '#BE123C',
                    fontSize: '0.75rem',
                    fontWeight: 900,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase'
                  }}>
                    <ShieldAlert size={14} />
                    <span>Sector With Most Money Deducted</span>
                  </div>

                  <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#E11D48' }}>
                    {topSector.percentage}% of all deductions
                  </span>
                </div>

                {/* Sector Content */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '18px',
                    backgroundColor: meta.bg || '#FEE2E2',
                    color: meta.color || '#E11D48',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(225, 29, 72, 0.15)',
                    flexShrink: 0
                  }}>
                    <IconComp size={32} strokeWidth={2.4} />
                  </div>

                  <div style={{ flex: 1, minWidth: '220px' }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#9F1239', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Highest Deducted Sector
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0F172A', marginTop: '2px', letterSpacing: '-0.02em' }}>
                      {topSector.name}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#64748B', marginTop: '4px' }}>
                      {topSector.count} transaction{topSector.count !== 1 ? 's' : ''} recorded in this sector
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', minWidth: '160px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#9F1239', textTransform: 'uppercase' }}>
                      Total Deducted
                    </div>
                    <div style={{ fontSize: '2.25rem', fontWeight: 900, color: '#E11D48', lineHeight: 1.1, marginTop: '2px' }}>
                      {formatINR(topSector.amount)}
                    </div>
                  </div>
                </div>

                {/* Summary Statement */}
                <div style={{
                  marginTop: '20px',
                  paddingTop: '16px',
                  borderTop: '1px solid #FFE4E6',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.875rem',
                  color: '#475569'
                }}>
                  <ArrowDownRight size={18} color="#E11D48" />
                  <span>
                    Most of your money was deducted in <strong>{topSector.name}</strong> ({formatINR(topSector.amount)} out of {formatINR(totalDeductions)} total expense deductions).
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Ranked List of All Sectors Where Money Was Deducted */}
          {sortedSectors.length > 1 && (
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <div>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                    All Sectors by Money Deducted
                  </h2>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Ranked from highest deduction to lowest
                  </p>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                  {sortedSectors.length} Sectors Active
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {sortedSectors.map((sector, index) => {
                  const meta = getCategoryMeta(sector.name, true);
                  const IconComp = getCategoryIcon(meta.icon);
                  const isTop = index === 0;
                  const barFill = topSector.amount > 0 ? Math.max(10, Math.round((sector.amount / topSector.amount) * 100)) : 0;

                  return (
                    <div 
                      key={sector.name}
                      style={{
                        padding: '14px 16px',
                        borderRadius: '14px',
                        backgroundColor: isTop ? '#FFF1F2' : 'var(--bg-secondary)',
                        border: isTop ? '1.5px solid #FECDD3' : '1px solid var(--border-light)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '8px',
                            backgroundColor: isTop ? '#E11D48' : 'var(--surface-muted)',
                            color: isTop ? '#FFFFFF' : 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 900,
                            fontSize: '0.75rem'
                          }}>
                            #{index + 1}
                          </span>

                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            backgroundColor: meta.bg || 'var(--surface-muted)',
                            color: meta.color || 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <IconComp size={18} strokeWidth={2.4} />
                          </div>

                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                              {sector.name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {sector.count} transaction{sector.count !== 1 ? 's' : ''} • {sector.percentage}% share
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{
                            fontSize: '1.125rem',
                            fontWeight: 900,
                            color: isTop ? '#E11D48' : 'var(--text-primary)'
                          }}>
                            {formatINR(sector.amount)}
                          </div>
                          {isTop && (
                            <span style={{
                              fontSize: '0.625rem',
                              fontWeight: 900,
                              backgroundColor: '#E11D48',
                              color: '#FFFFFF',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              letterSpacing: '0.04em'
                            }}>
                              HIGHEST
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Visual Deduction Share Bar */}
                      <div style={{
                        width: '100%',
                        height: '8px',
                        backgroundColor: 'var(--surface-muted)',
                        borderRadius: '6px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${barFill}%`,
                          height: '100%',
                          backgroundColor: isTop ? '#E11D48' : (meta.color || 'var(--primary)'),
                          borderRadius: '6px',
                          transition: 'width 0.4s ease'
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
