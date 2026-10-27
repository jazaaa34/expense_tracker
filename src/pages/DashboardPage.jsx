import React from 'react';
import { useWallet } from '../context/WalletContext';
import { formatINR } from '../services/storageService';
import TransactionTile from '../components/transactions/TransactionTile';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Sparkles, 
  ShieldAlert, 
  Zap,
  Receipt
} from 'lucide-react';

export default function DashboardPage({ onOpenAddTxn, onSelectTxn, onNavigateTab }) {
  const { 
    balance, 
    income, 
    expense, 
    billExpense = 0,
    transactions
  } = useWallet();

  const netIncome = Math.max(0, income - billExpense);
  const recentTxns = transactions.slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Hero Balance Card */}
      <div className="hero-card" style={{ padding: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>
            Net Available Balance
          </div>
          <span style={{
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'rgba(255,255,255,0.12)',
            fontSize: '0.6875rem',
            fontWeight: 700,
            color: '#FFFFFF'
          }}>
            Live Account
          </span>
        </div>

        <div style={{
          fontSize: '3rem',
          fontWeight: 900,
          letterSpacing: '-0.04em',
          color: '#FFFFFF',
          marginBottom: '24px'
        }}>
          {formatINR(balance)}
        </div>

        {/* Dual Metric Inflow & Outflow */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div style={{
            padding: '14px 18px',
            borderRadius: '16px',
            backgroundColor: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              backgroundColor: 'rgba(74, 222, 128, 0.2)',
              color: '#4ADE80',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ArrowDownLeft size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>
                Total Income
              </div>
              <div style={{ fontSize: '1.125rem', fontWeight: 900, color: '#FFFFFF' }}>
                {formatINR(netIncome)}
              </div>
              {billExpense > 0 && (
                <div style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.75)', marginTop: '2px' }}>
                  (-{formatINR(billExpense)} bills deducted)
                </div>
              )}
            </div>
          </div>

          <div style={{
            padding: '14px 18px',
            borderRadius: '16px',
            backgroundColor: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              backgroundColor: 'rgba(248, 113, 113, 0.2)',
              color: '#F87171',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ArrowUpRight size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>
                Total Outflow
              </div>
              <div style={{ fontSize: '1.125rem', fontWeight: 900, color: '#FFFFFF' }}>
                {formatINR(expense)}
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Recent Transactions Section */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div>
            <div style={{ fontSize: '1.125rem', fontWeight: 900, color: 'var(--text-primary)' }}>
              Recent Transactions
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {transactions.length} total entries recorded
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('history')}
            style={{
              fontSize: '0.8125rem',
              fontWeight: 800,
              color: 'var(--primary)',
              padding: '6px 12px',
              borderRadius: '8px',
              backgroundColor: 'var(--surface-muted)'
            }}
          >
            View All History →
          </button>
        </div>

        {recentTxns.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
            No transactions yet. Click "+ Add Txn" to record your first entry.
          </div>
        ) : (
          <div>
            {recentTxns.map(t => (
              <TransactionTile 
                key={t.id} 
                txn={t} 
                onClick={() => onSelectTxn(t)} 
              />
            ))}
          </div>
        )}
      </div>

      {/* Quick Access Feature Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div 
          onClick={() => onNavigateTab('ai-chat')}
          className="card card-hover" 
          style={{ padding: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px' }}
        >
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: 'var(--surface-muted)', color: 'var(--accent-honey)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--text-primary)' }}>AI Advisor</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Get spending diagnosis</div>
          </div>
        </div>

        <div 
          onClick={() => onNavigateTab('alerts')}
          className="card card-hover" 
          style={{ padding: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px' }}
        >
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: 'var(--expense-light)', color: 'var(--expense-red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--text-primary)' }}>Money Guard & Alerts</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Peak spend day & alerts</div>
          </div>
        </div>

        <div 
          onClick={() => onNavigateTab('analytics')}
          className="card card-hover" 
          style={{ padding: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px' }}
        >
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning-amber)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--text-primary)' }}>Utility Usage</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Graphical utility meters</div>
          </div>
        </div>

        <div 
          onClick={() => onNavigateTab('bills')}
          className="card card-hover" 
          style={{ padding: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px' }}
        >
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: '#F0FDFA', color: '#0D9488', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Receipt size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--text-primary)' }}>Bills & Receipts</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Scan, view & verify receipts</div>
          </div>
        </div>
      </div>
    </div>
  );
}
