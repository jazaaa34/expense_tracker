import React, { useState, useEffect, useRef } from 'react';
import Modal from '../common/Modal';
import { PAYMENT_METHODS, formatINR } from '../../services/storageService';
import confetti from 'canvas-confetti';
import {
  Camera,
  UploadCloud,
  CheckCircle2,
  Eye,
  Trash2,
  Sparkles,
  Clock,
  Download
} from 'lucide-react';

const Icons = {
  Camera,
  UploadCloud,
  CheckCircle2,
  Eye,
  Trash2,
  Sparkles,
  Clock,
  Download
};

// Smart auto-categorization based on payee/description
const detectCategory = (payeeName, isExp) => {
  if (!isExp) return 'Salary';
  const lower = (payeeName || '').toLowerCase();
  if (lower.includes('bescom') || lower.includes('electric') || lower.includes('power')) return 'Electricity Bill';
  if (lower.includes('water') || lower.includes('bwssb')) return 'Water Bill';
  if (lower.includes('wifi') || lower.includes('broadband') || lower.includes('airtel') || lower.includes('jio') || lower.includes('act')) return 'Broadband / WiFi';
  if (lower.includes('lpg') || lower.includes('gas') || lower.includes('cylinder') || lower.includes('indane') || lower.includes('hp gas')) return 'LPG Cylinder';
  if (lower.includes('swiggy') || lower.includes('zomato') || lower.includes('food') || lower.includes('cafe') || lower.includes('restaurant') || lower.includes('dinner') || lower.includes('lunch') || lower.includes('burger') || lower.includes('pizza') || lower.includes('kfc')) return 'Food & Dining';
  if (lower.includes('grocery') || lower.includes('blinkit') || lower.includes('zepto') || lower.includes('instamart') || lower.includes('market') || lower.includes('supermarket') || lower.includes('milk') || lower.includes('vegetable')) return 'Groceries';
  if (lower.includes('rent') || lower.includes('house') || lower.includes('flat') || lower.includes('pg') || lower.includes('maintenance')) return 'Rent & Housing';
  if (lower.includes('metro') || lower.includes('uber') || lower.includes('ola') || lower.includes('cab') || lower.includes('petrol') || lower.includes('fuel') || lower.includes('diesel') || lower.includes('toll')) return 'Transportation';
  if (lower.includes('amazon') || lower.includes('flipkart') || lower.includes('myntra') || lower.includes('shopping') || lower.includes('mall') || lower.includes('clothes') || lower.includes('shoes')) return 'Shopping';
  if (lower.includes('gym') || lower.includes('doctor') || lower.includes('med') || lower.includes('pharmacy') || lower.includes('hospital') || lower.includes('clinic') || lower.includes('apollo')) return 'Healthcare';
  if (lower.includes('netflix') || lower.includes('prime') || lower.includes('movie') || lower.includes('cinema') || lower.includes('spotify') || lower.includes('game') || lower.includes('pvr')) return 'Entertainment';
  if (lower.includes('course') || lower.includes('tuition') || lower.includes('book') || lower.includes('school') || lower.includes('college') || lower.includes('udemy')) return 'Education';
  return 'Food & Dining';
};

export default function TransactionModal({ isOpen, onClose, onSave, editingTxn }) {
  const [isExpense, setIsExpense] = useState(true);
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isMonthly, setIsMonthly] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotName, setScreenshotName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(false);

  // 10-Second Thinking Pause State for payments above 1000
  const [isThinkingPauseOpen, setIsThinkingPauseOpen] = useState(false);
  const [pendingTxnData, setPendingTxnData] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(10);
  const [canProceed, setCanProceed] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (editingTxn) {
      setIsExpense(editingTxn.isExpense);
      setAmount(editingTxn.amount.toString());
      setName(editingTxn.name);
      setPaymentMethod(editingTxn.paymentMethod || 'UPI');
      setDate(new Date(editingTxn.date).toISOString().split('T')[0]);
      setIsMonthly(Boolean(editingTxn.isMonthly));
      setScreenshot(editingTxn.screenshot || null);
      setScreenshotName(editingTxn.screenshotName || '');
    } else {
      setIsExpense(true);
      setAmount('');
      setName('');
      setPaymentMethod('UPI');
      setDate(new Date().toISOString().split('T')[0]);
      setIsMonthly(false);
      setScreenshot(null);
      setScreenshotName('');
    }
    setIsThinkingPauseOpen(false);
    setPendingTxnData(null);
  }, [editingTxn, isOpen]);

  // 10-Second Countdown Timer
  useEffect(() => {
    let timer = null;
    if (isThinkingPauseOpen) {
      setSecondsLeft(10);
      setCanProceed(false);
      timer = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setCanProceed(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isThinkingPauseOpen]);

  // Handle clipboard paste (e.g. screenshot pasted with Ctrl+V)
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            processImageFile(file, 'Pasted_Screenshot.jpg');
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  const processImageFile = (file, customName) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDimension = 1200;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
        setScreenshot(compressedDataUrl);
        setScreenshotName(customName || file.name || 'Transaction_Receipt.jpg');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return alert('Please enter a description/name for this transaction.');
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return alert('Please enter a valid amount.');

    const resolvedCategory = editingTxn?.category || detectCategory(name.trim(), isExpense);

    const txnData = {
      ...(editingTxn ? { id: editingTxn.id } : {}),
      name: name.trim(),
      category: resolvedCategory,
      amount: parsedAmount,
      isExpense,
      paymentMethod,
      tag: editingTxn?.tag || 'Personal',
      note: editingTxn?.note || '',
      date: new Date(date).toISOString(),
      isMonthly: Boolean(isMonthly),
      screenshot: screenshot || null,
      screenshotName: screenshotName || ''
    };

    // 10-second thinking pause if paying above 1000 for an expense
    if (isExpense && parsedAmount > 1000) {
      setPendingTxnData(txnData);
      setIsThinkingPauseOpen(true);
      return;
    }

    onSave(txnData);
    onClose();
  };

  const handleConfirmPayment = () => {
    if (!pendingTxnData) return;
    onSave(pendingTxnData);
    setIsThinkingPauseOpen(false);
    setPendingTxnData(null);
    onClose();
  };

  const handleSkipAndSave = () => {
    try {
      confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
    } catch (err) {}
    setIsThinkingPauseOpen(false);
    setPendingTxnData(null);
    onClose();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={editingTxn ? 'Edit Transaction' : 'Add New Transaction'}
        subtitle={editingTxn ? 'Update details, proof, and payment mode' : 'Record an expense or income entry'}
        maxWidth="580px"
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Row 1: Type Toggle + Amount */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '12px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Type
              </label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                padding: '3px',
                backgroundColor: 'var(--surface-muted)',
                borderRadius: '12px',
                height: '46px',
                border: '1.2px solid var(--border-light)'
              }}>
                <button
                  type="button"
                  onClick={() => setIsExpense(true)}
                  style={{
                    borderRadius: '9px',
                    fontWeight: 800,
                    fontSize: '0.875rem',
                    backgroundColor: isExpense ? '#FFFFFF' : 'transparent',
                    color: isExpense ? 'var(--expense-red)' : 'var(--text-secondary)',
                    boxShadow: isExpense ? '0 2px 6px rgba(220, 38, 38, 0.15)' : 'none',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  💸 Expense
                </button>
                <button
                  type="button"
                  onClick={() => setIsExpense(false)}
                  style={{
                    borderRadius: '9px',
                    fontWeight: 800,
                    fontSize: '0.875rem',
                    backgroundColor: !isExpense ? '#FFFFFF' : 'transparent',
                    color: !isExpense ? 'var(--income-green)' : 'var(--text-secondary)',
                    boxShadow: !isExpense ? '0 2px 6px rgba(16, 185, 129, 0.15)' : 'none',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  💰 Income
                </button>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Amount (INR ₹)
                </label>
                {isExpense && parseFloat(amount) > 1000 && (
                  <span style={{
                    fontSize: '0.6875rem',
                    fontWeight: 800,
                    color: '#D97706',
                    backgroundColor: '#FEF3C7',
                    padding: '2px 6px',
                    borderRadius: '6px'
                  }}>
                    ⏱️ 10s thinking pause active
                  </span>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-secondary)' }}>
                  ₹
                </span>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{
                    width: '100%',
                    height: '46px',
                    paddingLeft: '34px',
                    paddingRight: '14px',
                    fontSize: '1.3rem',
                    fontWeight: 900,
                    borderRadius: '12px',
                    border: '1.5px solid var(--border-light)',
                    backgroundColor: 'var(--surface-card)',
                    color: isExpense ? 'var(--expense-red)' : 'var(--income-green)'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Row 2: Description / Payee */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Description / Payee Name
            </label>
            <input
              type="text"
              placeholder="e.g. Swiggy Gourmet, BESCOM Electricity, Amazon, Salary"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                height: '44px',
                padding: '0 14px',
                borderRadius: '12px',
                border: '1.2px solid var(--border-light)',
                fontSize: '0.9375rem',
                backgroundColor: '#FFFFFF'
              }}
            />
          </div>

          {/* Row 3: Date & Payment Method */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 12px',
                  borderRadius: '12px',
                  border: '1.2px solid var(--border-light)',
                  fontSize: '0.875rem',
                  backgroundColor: '#FFFFFF'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 12px',
                  borderRadius: '12px',
                  border: '1.2px solid var(--border-light)',
                  backgroundColor: '#FFFFFF',
                  fontSize: '0.875rem'
                }}
              >
                {PAYMENT_METHODS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4: Screenshot & Receipt Attachment Section */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Transaction Screenshot / Bill Receipt
            </label>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            {!screenshot ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: isDragging ? '2px dashed var(--primary)' : '2px dashed var(--border-light)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  backgroundColor: isDragging ? 'rgba(235, 94, 40, 0.05)' : 'var(--surface-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary)'
                  }}>
                    <Icons.Camera size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Attach Payment Screenshot or Bill
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                      Click to upload, drag image here, or paste from clipboard (Ctrl+V)
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#FFFFFF',
                    border: '1.2px solid var(--border-light)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    pointerEvents: 'none'
                  }}
                >
                  <Icons.UploadCloud size={14} color="var(--primary)" />
                  <span>Browse</span>
                </button>
              </div>
            ) : (
              <div style={{
                borderRadius: '12px',
                border: '1.5px solid rgba(16, 185, 129, 0.4)',
                backgroundColor: 'rgba(16, 185, 129, 0.04)',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                  <div 
                    onClick={() => setPreviewZoom(true)}
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: '1px solid var(--border-light)',
                      backgroundColor: '#FFFFFF',
                      flexShrink: 0,
                      cursor: 'zoom-in'
                    }}
                    title="Click to view full screenshot"
                  >
                    <img 
                      src={screenshot} 
                      alt="Receipt preview" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Icons.CheckCircle2 size={14} color="var(--income-green)" />
                      <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        Screenshot Attached
                      </span>
                    </div>
                    <div style={{
                      fontSize: '0.6875rem',
                      color: 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '260px'
                    }}>
                      {screenshotName || 'Attached receipt proof'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(true)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '7px',
                      backgroundColor: '#FFFFFF',
                      border: '1.2px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    <Icons.Eye size={12} />
                    <span>View</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setScreenshot(null);
                      setScreenshotName('');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    style={{
                      padding: '5px 8px',
                      borderRadius: '7px',
                      backgroundColor: '#FEE2E2',
                      border: '1px solid #FECACA',
                      color: '#DC2626',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer'
                    }}
                    title="Remove attached screenshot"
                  >
                    <Icons.Trash2 size={12} />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Row 5: Monthly Recurring / Autopay Section */}
          <div
            onClick={() => setIsMonthly(!isMonthly)}
            style={{
              padding: '8px 12px',
              borderRadius: '12px',
              backgroundColor: isMonthly ? 'rgba(59, 130, 246, 0.08)' : 'var(--surface-muted)',
              border: isMonthly ? '1.5px solid #3B82F6' : '1.2px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.1rem' }}>🔄</span>
              <div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {isMonthly ? 'Monthly Recurring (Autopay Active)' : 'One-Time Payment'}
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                  {isMonthly 
                    ? 'Monitored for monthly price increases & auto-renewal alert' 
                    : 'Tap to switch to monthly recurring autopay'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMonthly(!isMonthly);
              }}
              style={{
                padding: '5px 12px',
                borderRadius: '7px',
                backgroundColor: isMonthly ? '#3B82F6' : '#FFFFFF',
                color: isMonthly ? '#FFFFFF' : 'var(--text-secondary)',
                border: isMonthly ? 'none' : '1.2px solid var(--border-light)',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              {isMonthly ? '✓ Monthly Autopay' : 'One-Time'}
            </button>
          </div>

          {/* Row 6: Action Buttons */}
          <div style={{
            display: 'flex',
            gap: '10px',
            marginTop: '2px'
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'var(--surface-muted)',
                color: 'var(--text-primary)',
                fontWeight: 800,
                fontSize: '0.875rem',
                border: '1.2px solid var(--border-light)',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                flex: 2,
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '0.875rem',
                boxShadow: 'var(--shadow-sm)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <span>{editingTxn ? 'Save Changes' : (isExpense && parseFloat(amount) > 1000 ? 'Review & Pay (10s Pause)' : 'Record Transaction')}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* 10-Second Mindful Thinking Pause Modal (for expenses > ₹1000) */}
      {isThinkingPauseOpen && pendingTxnData && (
        <Modal
          isOpen={isThinkingPauseOpen}
          onClose={() => setIsThinkingPauseOpen(false)}
          title="Mindful Thinking Pause"
          subtitle="Impulse breaker active for purchases above ₹1,000"
          maxWidth="460px"
        >
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 4px 0' }}>
            {/* Amount & Payee Badge */}
            <div style={{
              padding: '6px 14px',
              borderRadius: '20px',
              backgroundColor: '#FEF3C7',
              border: '1.2px solid #FCD34D',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8125rem',
              fontWeight: 800,
              color: '#92400E',
              marginBottom: '16px'
            }}>
              <span>⚠️ Big Purchase Alert:</span>
              <span>{formatINR(pendingTxnData.amount)}</span>
            </div>

            <p style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', fontWeight: 700, marginBottom: '6px', lineHeight: 1.4 }}>
              Are you sure you want to spend {formatINR(pendingTxnData.amount)} on "{pendingTxnData.name}"?
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.4, maxWidth: '380px' }}>
              Take 10 seconds to pause, breathe, and reflect. Is this purchase essential, or can it wait?
            </p>

            {/* Breathing Animation Countdown Circle */}
            <div
              className="animate-breathe"
              style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                backgroundColor: canProceed ? '#ECFDF5' : '#FFFBEB',
                border: `3px solid ${canProceed ? 'var(--income-green)' : '#F59E0B'}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: canProceed ? '0 4px 18px rgba(16, 185, 129, 0.25)' : '0 4px 18px rgba(245, 158, 11, 0.2)'
              }}
            >
              <span style={{
                fontSize: canProceed ? '2.5rem' : '2.75rem',
                fontWeight: 900,
                color: canProceed ? 'var(--income-green)' : '#B45309',
                lineHeight: 1
              }}>
                {canProceed ? '✓' : secondsLeft}
              </span>
              <span style={{ fontSize: '0.625rem', fontWeight: 800, color: 'var(--text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {canProceed ? 'Ready' : 'Seconds'}
              </span>
            </div>

            {/* Grounding Message */}
            <div style={{
              padding: '12px 16px',
              borderRadius: '12px',
              backgroundColor: 'var(--surface-muted)',
              border: '1px solid var(--border-light)',
              fontStyle: 'italic',
              fontSize: '0.78125rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.4,
              marginBottom: '20px',
              width: '100%'
            }}>
              "Delaying a purchase by just a few moments gives your rational brain time to take over from impulse."
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              {/* Skip & Save button (always clickable!) */}
              <button
                type="button"
                onClick={handleSkipAndSave}
                style={{
                  width: '100%',
                  height: '46px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--income-green)',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '0.9375rem',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icons.Sparkles size={16} />
                <span>Skip & Save {formatINR(pendingTxnData.amount)}!</span>
              </button>

              {/* Proceed button (disabled for 10 seconds) */}
              <button
                type="button"
                disabled={!canProceed}
                onClick={handleConfirmPayment}
                style={{
                  width: '100%',
                  height: '44px',
                  borderRadius: '12px',
                  border: canProceed ? '1.5px solid var(--border-light)' : '1px dashed var(--border-light)',
                  color: canProceed ? 'var(--text-primary)' : 'var(--text-muted)',
                  backgroundColor: canProceed ? '#FFFFFF' : 'var(--surface-muted)',
                  fontWeight: 800,
                  fontSize: '0.875rem',
                  cursor: canProceed ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
              >
                {canProceed ? (
                  <>
                    <Icons.CheckCircle2 size={16} color="var(--primary)" />
                    <span>I've Reflected — Proceed & Pay {formatINR(pendingTxnData.amount)}</span>
                  </>
                ) : (
                  <>
                    <Icons.Clock size={15} />
                    <span>Please Reflect ({secondsLeft}s remaining...)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Screenshot Zoom Modal */}
      {previewZoom && screenshot && (
        <Modal
          isOpen={previewZoom}
          onClose={() => setPreviewZoom(false)}
          title="Screenshot / Receipt Preview"
          subtitle={screenshotName || 'Attached transaction receipt proof'}
          maxWidth="640px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '100%',
              maxHeight: '65vh',
              overflow: 'auto',
              borderRadius: '12px',
              border: '1.2px solid var(--border-light)',
              backgroundColor: '#000000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <img 
                src={screenshot} 
                alt="Receipt Full View" 
                style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }} 
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', gap: '10px' }}>
              <a
                href={screenshot}
                download={screenshotName || 'receipt.jpg'}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--surface-muted)',
                  border: '1.2px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Icons.Download size={14} />
                <span>Download Screenshot</span>
              </a>
              <button
                type="button"
                onClick={() => setPreviewZoom(false)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '0.8125rem',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Close Preview
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
