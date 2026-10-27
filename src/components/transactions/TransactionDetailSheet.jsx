import React, { useState, useRef } from 'react';
import Modal from '../common/Modal';
import * as Icons from 'lucide-react';
import { getCategoryMeta, formatINR, formatDateTime } from '../../services/storageService';

export default function TransactionDetailSheet({ txn, isOpen, onClose, onEdit, onDelete, onUpdate }) {
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const fileInputRef = useRef(null);

  if (!txn) return null;
  const meta = getCategoryMeta(txn.category, txn.isExpense);
  const IconComp = Icons[meta.icon] || Icons.Tag;

  const handleUploadNewScreenshot = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, WEBP).');
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

        const compressed = canvas.toDataURL('image/jpeg', 0.82);
        if (onUpdate) {
          onUpdate({
            ...txn,
            screenshot: compressed,
            screenshotName: file.name || 'Payment_Proof.jpg'
          });
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUploadNewScreenshot(file);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Transaction Details"
        subtitle={`ID: #${txn.id.slice(0, 8)}`}
        maxWidth="540px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Category Header Card */}
          <div style={{
            padding: '18px 20px',
            borderRadius: '16px',
            backgroundColor: meta.bg || 'var(--surface-muted)',
            border: `1.2px solid ${meta.color}40`,
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}>
            <div style={{
              width: '50px',
              height: '50px',
              borderRadius: '14px',
              backgroundColor: meta.color,
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <IconComp size={26} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1.1875rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                {txn.name}
              </div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {txn.category}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: 900,
                color: txn.isExpense ? 'var(--expense-red)' : 'var(--income-green)'
              }}>
                {txn.isExpense ? '-' : '+'}{formatINR(txn.amount)}
              </div>
              <span style={{
                fontSize: '0.6875rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '6px',
                backgroundColor: '#FFFFFF',
                color: txn.isExpense ? 'var(--expense-red)' : 'var(--income-green)'
              }}>
                {txn.isExpense ? 'EXPENSE' : 'INCOME'}
              </span>
            </div>
          </div>

          {/* Detailed Attribute Rows */}
          <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Date & Time</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatDateTime(txn.date)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Payment Method</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{txn.paymentMethod || 'UPI'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Billing Frequency</span>
              <span style={{
                fontWeight: 800,
                color: txn.isMonthly ? '#3B82F6' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                {txn.isMonthly ? '🔄 Monthly Autopay' : '⚡ One-Time Payment'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Tag</span>
              <span style={{ fontWeight: 700, color: 'var(--accent-honey)' }}>#{txn.tag || 'Personal'}</span>
            </div>

            {txn.note && (
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '10px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  NOTE
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontStyle: 'italic', lineHeight: 1.4 }}>
                  "{txn.note}"
                </p>
              </div>
            )}
          </div>

          {/* Attached Receipt / Payment Screenshot Card */}
          <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icons.Camera size={18} color="var(--primary)" />
                <span style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Payment Screenshot / Receipt Photo
                </span>
              </div>
              {txn.source === 'bill' ? (
                <span style={{
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: '#ECFDF5',
                  color: '#065F46',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <Icons.CheckCircle2 size={12} color="#10B981" />
                  <span>Verified Bill OCR ({Math.round((txn.confidence || 0.95) * 100)}%)</span>
                </span>
              ) : txn.screenshot ? (
                <span style={{
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <Icons.CheckCircle2 size={12} />
                  <span>Proof Attached</span>
                </span>
              ) : (
                <span style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--surface-muted)',
                  color: 'var(--text-muted)'
                }}>
                  No photo attached
                </span>
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            {txn.screenshot ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Image Preview Box */}
                <div 
                  onClick={() => setIsZoomOpen(true)}
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '200px',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1.5px solid var(--border-light)',
                    backgroundColor: '#0F172A',
                    cursor: 'zoom-in',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Click to enlarge screenshot"
                >
                  <img 
                    src={txn.screenshot} 
                    alt="Transaction receipt photo" 
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                  />
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.28)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0,
                    transition: 'opacity 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                  >
                    <div style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      color: '#FFFFFF',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <Icons.ZoomIn size={14} />
                      <span>Click to Enlarge Full Photo</span>
                    </div>
                  </div>
                </div>

                {/* Info & Action Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {txn.screenshotName || 'receipt_proof.jpg'}
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setIsZoomOpen(true)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--surface-muted)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-primary)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Icons.Eye size={13} />
                      <span>View Full</span>
                    </button>
                    <a
                      href={txn.screenshot}
                      download={txn.screenshotName || 'receipt_proof.jpg'}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--surface-muted)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-primary)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Icons.Download size={13} />
                      <span>Download</span>
                    </a>
                    {onUpdate && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--surface-muted)',
                          border: '1px solid var(--border-light)',
                          color: 'var(--text-secondary)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                        title="Upload a different photo"
                      >
                        Replace
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                padding: '16px',
                borderRadius: '12px',
                border: '1.5px dashed var(--border-light)',
                backgroundColor: 'var(--surface-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  No payment screenshot or bill attached for this transaction.
                </div>
                {onUpdate && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '8px',
                      backgroundColor: '#FFFFFF',
                      border: '1.2px solid var(--border-light)',
                      color: 'var(--primary)',
                      fontWeight: 800,
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexShrink: 0
                    }}
                  >
                    <Icons.UploadCloud size={14} />
                    <span>+ Add Photo</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Actions: Edit & Delete */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => {
                onClose();
                onDelete(txn.id);
              }}
              style={{
                flex: 1,
                height: '46px',
                borderRadius: 'var(--radius-md)',
                border: '1.2px solid var(--expense-red)',
                color: 'var(--expense-red)',
                backgroundColor: '#FFFFFF',
                fontWeight: 800,
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <Icons.Trash2 size={16} />
              <span>Delete</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onEdit(txn);
              }}
              style={{
                flex: 2,
                height: '46px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '0.875rem',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <Icons.Edit3 size={16} />
              <span>Edit Transaction</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Zoom Modal for Full Receipt View */}
      {isZoomOpen && txn.screenshot && (
        <Modal
          isOpen={isZoomOpen}
          onClose={() => setIsZoomOpen(false)}
          title={txn.name}
          subtitle={`Attached Screenshot - ${txn.screenshotName || 'Payment Proof'}`}
          maxWidth="720px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '100%',
              maxHeight: '70vh',
              overflow: 'auto',
              borderRadius: '12px',
              border: '1.2px solid var(--border-light)',
              backgroundColor: '#0F172A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <img 
                src={txn.screenshot} 
                alt="Full receipt view" 
                style={{ maxWidth: '100%', maxHeight: '68vh', objectFit: 'contain' }} 
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                {formatINR(txn.amount)} • {txn.category}
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <a
                  href={txn.screenshot}
                  download={txn.screenshotName || 'receipt_proof.jpg'}
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
                  <span>Download Image</span>
                </a>
                <button
                  type="button"
                  onClick={() => setIsZoomOpen(false)}
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
                  Close
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
