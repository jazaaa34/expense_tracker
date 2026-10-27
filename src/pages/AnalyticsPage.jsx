import React, { useState, useMemo } from 'react';
import { useWallet } from '../context/WalletContext';
import { formatINR } from '../services/storageService';
import Modal from '../components/common/Modal';
import { 
  Zap, 
  Droplets, 
  Wifi, 
  Smartphone, 
  Flame, 
  Tv, 
  Building2, 
  Activity,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  Edit2
} from 'lucide-react';

// Predefined core utilities configuration with icons and colors
const BASE_UTILITIES = [
  {
    id: 'electricity',
    name: 'Electricity & Power',
    icon: Zap,
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.12)',
    defaultAmount: 2450,
    unit: '290 kWh',
    maxThreshold: 3500,
    status: 'Moderate Usage',
    statusColor: 'var(--warning-amber)',
    provider: 'State Electricity Board'
  },
  {
    id: 'broadband',
    name: 'Fiber Broadband & Wi-Fi',
    icon: Wifi,
    color: '#3B82F6',
    bgColor: 'rgba(59, 130, 246, 0.12)',
    defaultAmount: 1199,
    unit: '420 GB / 200 Mbps',
    maxThreshold: 1500,
    status: 'Optimal Plan',
    statusColor: 'var(--income-green)',
    provider: 'High-Speed Optical Fiber'
  },
  {
    id: 'water',
    name: 'Water Supply & Tanker',
    icon: Droplets,
    color: '#06B6D4',
    bgColor: 'rgba(6, 182, 212, 0.12)',
    defaultAmount: 650,
    unit: '14,000 Litres',
    maxThreshold: 1200,
    status: 'Normal Usage',
    statusColor: 'var(--income-green)',
    provider: 'Municipal Water Board'
  },
  {
    id: 'mobile',
    name: 'Mobile Postpaid & Cellular',
    icon: Smartphone,
    color: '#8B5CF6',
    bgColor: 'rgba(139, 92, 246, 0.12)',
    defaultAmount: 799,
    unit: '2 Active SIMs',
    maxThreshold: 1200,
    status: 'Standard Pack',
    statusColor: 'var(--income-green)',
    provider: '5G Postpaid Family Plan'
  },
  {
    id: 'gas',
    name: 'Piped Gas & LPG Cylinder',
    icon: Flame,
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.12)',
    defaultAmount: 950,
    unit: '1 Cylinder Refill',
    maxThreshold: 1400,
    status: 'Monthly Refill',
    statusColor: 'var(--income-green)',
    provider: 'Domestic PNG / LPG'
  },
  {
    id: 'streaming',
    name: 'Streaming & Digital Media',
    icon: Tv,
    color: '#EC4899',
    bgColor: 'rgba(236, 72, 153, 0.12)',
    defaultAmount: 549,
    unit: '3 Active OTT Apps',
    maxThreshold: 1000,
    status: 'Active Recurring',
    statusColor: 'var(--income-green)',
    provider: 'Cloud & Entertainment'
  },
  {
    id: 'maintenance',
    name: 'Society & Home Maintenance',
    icon: Building2,
    color: '#10B981',
    bgColor: 'rgba(16, 185, 129, 0.12)',
    defaultAmount: 3200,
    unit: 'Monthly Maintenance',
    maxThreshold: 4500,
    status: 'Fixed Upkeep',
    statusColor: 'var(--primary)',
    provider: 'Residency Association'
  }
];

export default function AnalyticsPage() {
  const { transactions, user, utilityCaps, setUtilityCap, addAlert } = useWallet();
  const [selectedUtilityId, setSelectedUtilityId] = useState(null);
  const [editingCapUtility, setEditingCapUtility] = useState(null);
  const [capInputValue, setCapInputValue] = useState('');

  // Compute dynamic amounts by matching user's logged transactions
  const utilityData = useMemo(() => {
    const isDemo = (user?.email || '').toLowerCase().trim() === 'jazaaa34@gmail.com' || (user?.email || '').toLowerCase().trim() === 'aysha@example.com';

    return BASE_UTILITIES.map(util => {
      let loggedSum = 0;
      let matchCount = 0;

      for (const t of transactions) {
        if (!t.isExpense) continue;
        const name = (t.name || '').toLowerCase();
        const note = (t.note || '').toLowerCase();
        const cat = (t.category || '').toLowerCase();

        const isMatch = (
          (util.id === 'electricity' && (name.includes('electr') || name.includes('power') || note.includes('eb bill') || name.includes('bescom'))) ||
          (util.id === 'broadband' && (name.includes('wifi') || name.includes('broadband') || name.includes('internet') || name.includes('airtel fiber') || name.includes('jio fiber'))) ||
          (util.id === 'water' && (name.includes('water') || note.includes('tanker') || name.includes('aqua'))) ||
          (util.id === 'mobile' && (name.includes('mobile') || name.includes('recharge') || name.includes('postpaid') || name.includes('cellular'))) ||
          (util.id === 'gas' && (name.includes('gas') || name.includes('lpg') || name.includes('cylinder') || name.includes('indane'))) ||
          (util.id === 'streaming' && (name.includes('spotify') || name.includes('netflix') || name.includes('prime') || cat.includes('entertainment'))) ||
          (util.id === 'maintenance' && (name.includes('rent') || name.includes('maintenance') || name.includes('apartment') || note.includes('society')))
        );

        if (isMatch) {
          loggedSum += Number(t.amount || 0);
          matchCount += 1;
        }
      }

      const totalAmount = loggedSum > 0 ? loggedSum : (isDemo ? util.defaultAmount : 0);
      const effectiveCap = (utilityCaps && utilityCaps[util.id] !== undefined) ? utilityCaps[util.id] : util.maxThreshold;
      const usageFill = effectiveCap > 0 ? Math.min(100, Math.round((totalAmount / effectiveCap) * 100)) : (totalAmount > 0 ? 100 : 0);

      let currentStatus = 'Within Cap';
      let currentStatusColor = 'var(--income-green)';
      if (effectiveCap > 0 && totalAmount > effectiveCap) {
        currentStatus = '⚠️ Cap Exceeded';
        currentStatusColor = 'var(--expense-red)';
      } else if (effectiveCap > 0 && totalAmount >= effectiveCap * 0.85) {
        currentStatus = 'Near Cap Limit';
        currentStatusColor = 'var(--warning-amber)';
      } else if (totalAmount === 0) {
        currentStatus = 'No Spend Yet';
        currentStatusColor = 'var(--text-muted)';
      }

      return {
        ...util,
        amount: totalAmount,
        maxThreshold: effectiveCap,
        usageFill,
        status: currentStatus,
        statusColor: currentStatusColor,
        matchCount: matchCount > 0 ? matchCount : (isDemo ? 1 : 0)
      };
    });
  }, [transactions, user, utilityCaps]);

  const handleOpenEditCap = (u) => {
    setEditingCapUtility(u);
    setCapInputValue(u.maxThreshold ? u.maxThreshold.toString() : '');
  };

  const handleSaveCap = (e) => {
    e.preventDefault();
    if (!editingCapUtility) return;
    const num = Math.max(0, parseFloat(capInputValue) || 0);
    setUtilityCap(editingCapUtility.id, num);

    // If spend already exceeds the new cap, trigger Money Guard alert
    if (num > 0 && editingCapUtility.amount > num) {
      addAlert({
        id: `util_cap_${editingCapUtility.id}_${Date.now()}`,
        title: `Utility Cap Exceeded: ${editingCapUtility.name}`,
        description: `${editingCapUtility.name} spend of ${formatINR(editingCapUtility.amount)} exceeds your monthly cap of ${formatINR(num)}.`,
        actionLabel: 'Review Utility',
        iconType: 'warning',
        color: '#EF4444'
      });
    }

    setEditingCapUtility(null);
  };

  // Overall Totals
  const totalUtilitySpend = useMemo(() => {
    return utilityData.reduce((sum, u) => sum + u.amount, 0);
  }, [utilityData]);

  const maxUtility = useMemo(() => {
    return [...utilityData].sort((a, b) => b.amount - a.amount)[0];
  }, [utilityData]);

  const maxAmount = maxUtility ? maxUtility.amount : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            color: 'var(--warning-amber)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Zap size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
              Utility Usage & Consumption
            </h1>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Graphical meters and consumption tracking for each household and digital utility
            </p>
          </div>
        </div>
      </div>

      {/* Top 3 Summary Cards (Amounts only, no percentage) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ padding: '22px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Total Utilities Outflow
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)', margin: '6px 0 2px' }}>
            {formatINR(totalUtilitySpend)}
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Combined cost across {utilityData.length} tracked utilities
          </div>
        </div>

        <div className="card" style={{ padding: '22px', borderLeft: '4px solid var(--expense-red)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Highest Cost Utility
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--expense-red)', margin: '6px 0 2px' }}>
            {formatINR(maxUtility.amount)}
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 700 }}>
            {maxUtility.name} ({maxUtility.unit})
          </div>
        </div>

        <div className="card" style={{ padding: '22px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Active Utility Services
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--income-green)', margin: '6px 0 2px' }}>
            {utilityData.length} Connected
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Power, Water, Gas, Internet & Telecom
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: COMPARATIVE GRAPHICAL USAGE BARS (SIDE-BY-SIDE GRAPH) */}
      {/* ========================================================================= */}
      <div className="card" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)' }}>
              Utility Expense Comparison Graph
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Graphical scale of each utility's monthly cost (in INR ₹)
            </p>
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Monthly Volume
          </span>
        </div>

        {/* Horizontal Graphical Comparison Bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {utilityData.map((u) => {
            const IconComponent = u.icon;
            const barWidthPercent = Math.max(12, Math.round((u.amount / maxAmount) * 100));
            const isHighest = u.id === maxUtility.id;

            return (
              <div 
                key={u.id}
                onClick={() => setSelectedUtilityId(selectedUtilityId === u.id ? null : u.id)}
                style={{
                  cursor: 'pointer',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  backgroundColor: selectedUtilityId === u.id ? 'var(--bg-secondary)' : 'transparent',
                  transition: 'background-color 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: u.bgColor,
                      color: u.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <IconComponent size={18} />
                    </div>
                    <div>
                      <span style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                        {u.name}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                        • {u.unit}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {isHighest && (
                      <span style={{
                        fontSize: '0.625rem',
                        fontWeight: 900,
                        backgroundColor: 'var(--expense-red)',
                        color: '#FFFFFF',
                        padding: '2px 6px',
                        borderRadius: '6px'
                      }}>
                        HIGHEST
                      </span>
                    )}
                    <span style={{ fontWeight: 900, fontSize: '1rem', color: isHighest ? 'var(--expense-red)' : 'var(--text-primary)' }}>
                      {formatINR(u.amount)}
                    </span>
                  </div>
                </div>

                {/* Graphical Fill Meter Bar */}
                <div style={{
                  width: '100%',
                  height: '14px',
                  backgroundColor: 'var(--surface-muted)',
                  borderRadius: '10px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${barWidthPercent}%`,
                    height: '100%',
                    backgroundColor: u.color,
                    borderRadius: '10px',
                    transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: `0 2px 8px ${u.color}40`
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: GRAPHICAL UTILITY CARDS & CONSUMPTION METERS */}
      {/* ========================================================================= */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)' }}>
              Individual Utility Consumption Meters
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Detailed graphical gauge and threshold capacity for each utility
            </p>
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
            {utilityData.length} Services Monitored
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
          {utilityData.map((u) => {
            const IconComp = u.icon;

            return (
              <div 
                key={u.id}
                className="card card-hover"
                style={{
                  padding: '22px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  {/* Card Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        backgroundColor: u.bgColor,
                        color: u.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: 'var(--shadow-xs)'
                      }}>
                        <IconComp size={22} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                          {u.name}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          {u.provider}
                        </div>
                      </div>
                    </div>

                    <span style={{
                      fontSize: '0.6875rem',
                      fontWeight: 800,
                      padding: '4px 8px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--surface-muted)',
                      color: u.statusColor,
                      border: `1px solid ${u.statusColor}30`
                    }}>
                      {u.status}
                    </span>
                  </div>

                  {/* Amount & Unit Consumption */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    marginTop: '10px',
                    marginBottom: '10px'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Monthly Cost
                      </div>
                      <div style={{ fontSize: '1.625rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                        {formatINR(u.amount)}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Recorded Unit
                      </div>
                      <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: u.color }}>
                        {u.unit}
                      </div>
                    </div>
                  </div>

                  {/* Graphical Gauge Progress Bar */}
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                      <span>Usage Level</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditCap(u);
                        }}
                        style={{
                          background: 'none',
                          border: '1px solid var(--border-light)',
                          color: u.amount > u.maxThreshold ? 'var(--expense-red)' : 'var(--primary)',
                          fontWeight: 800,
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: u.amount > u.maxThreshold ? 'rgba(239, 68, 68, 0.08)' : 'var(--surface-muted)'
                        }}
                        title={`Click to customize spending cap for ${u.name}`}
                      >
                        <span>Cap: {formatINR(u.maxThreshold)}</span>
                        <Edit2 size={11} />
                      </button>
                    </div>

                    <div style={{
                      width: '100%',
                      height: '10px',
                      backgroundColor: 'var(--surface-muted)',
                      borderRadius: '10px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${u.usageFill}%`,
                        height: '100%',
                        backgroundColor: u.amount > u.maxThreshold ? 'var(--expense-red)' : u.color,
                        borderRadius: '10px',
                        transition: 'width 0.5s ease',
                        boxShadow: u.amount > u.maxThreshold ? '0 0 8px rgba(239, 68, 68, 0.5)' : 'none'
                      }} />
                    </div>
                  </div>
                </div>

                {/* Subtext info footer */}
                <div style={{
                  marginTop: '16px',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--border-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)'
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Activity size={14} color="var(--primary)" />
                    <span>Auto-tracked</span>
                  </span>
                  <span style={{ fontWeight: 700 }}>
                    {u.matchCount} statement entr{u.matchCount !== 1 ? 'ies' : 'y'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 3: UTILITY EFFICIENCY & ACTIONABLE CONSERVATION */}
      {/* ========================================================================= */}
      <div className="card" style={{ padding: '24px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <CheckCircle2 size={20} color="var(--income-green)" />
          <h3 style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            Utility Optimization & Smart Conservation
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#FFFFFF', border: '1px solid var(--border-light)' }}>
            <div style={{ fontWeight: 800, fontSize: '0.8125rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
              ⚡ Electricity Peak Offsetting
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Running high-wattage appliances (washing machine, water heater) during off-peak morning hours lowers tiered slab charges.
            </div>
          </div>

          <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#FFFFFF', border: '1px solid var(--border-light)' }}>
            <div style={{ fontWeight: 800, fontSize: '0.8125rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
              🌐 Broadband Annual Billing
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Switching your fiber broadband subscription to an annual or semi-annual advance plan waives 1 to 2 months of rental fees.
            </div>
          </div>

          <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#FFFFFF', border: '1px solid var(--border-light)' }}>
            <div style={{ fontWeight: 800, fontSize: '0.8125rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
              📺 Subscription Consolidation
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Audit recurring entertainment apps every 30 days and pause platforms you haven't watched this billing cycle.
            </div>
          </div>
        </div>
      </div>

      {/* Edit Utility Cap Modal */}
      <Modal
        isOpen={Boolean(editingCapUtility)}
        onClose={() => setEditingCapUtility(null)}
        title={editingCapUtility ? `Set Monthly Cap for ${editingCapUtility.name}` : 'Set Spending Cap'}
        subtitle="Money Guard will notify you immediately if your consumption exceeds this cap"
        maxWidth="420px"
      >
        <form onSubmit={handleSaveCap} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Monthly Cap Limit (INR ₹)
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontWeight: 900, color: 'var(--text-secondary)' }}>
                ₹
              </span>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={capInputValue}
                onChange={(e) => setCapInputValue(e.target.value)}
                placeholder="e.g. 3500"
                style={{
                  width: '100%',
                  height: '46px',
                  paddingLeft: '32px',
                  paddingRight: '14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1.2px solid var(--border-light)',
                  fontSize: '1.125rem',
                  fontWeight: 800
                }}
              />
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
              Current spend on this utility: <strong>{editingCapUtility ? formatINR(editingCapUtility.amount) : '₹0'}</strong>
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setEditingCapUtility(null)}
              style={{
                flex: 1,
                height: '44px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--surface-muted)',
                color: 'var(--text-primary)',
                fontWeight: 700,
                fontSize: '0.875rem',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                flex: 1,
                height: '44px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '0.875rem',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Save Cap
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
