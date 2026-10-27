import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { aiService } from '../../services/aiService';
import { GROQ_MODELS, DEFAULT_GROQ_MODEL } from '../../services/storageService';
import { Server, CheckCircle, AlertCircle, ShieldCheck, RefreshCw } from 'lucide-react';

export default function GroqKeyModal({ isOpen, onClose }) {
  const [model, setModel] = useState(aiService.getModel());
  const [serverStatus, setServerStatus] = useState(null); // { configured, model }
  const [testResult, setTestResult] = useState(null); // { success, message }
  const [isLoading, setIsLoading] = useState(false);

  const fetchStatus = async () => {
    setIsLoading(true);
    const st = await aiService.getServerStatus();
    setServerStatus(st);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      setModel(aiService.getModel());
      setTestResult(null);
      fetchStatus();
    }
  }, [isOpen]);

  const handleTest = async () => {
    setIsLoading(true);
    setTestResult(null);
    const result = await aiService.testServerConnection(model);
    setTestResult(result);
    setIsLoading(false);
  };

  const handleSave = () => {
    aiService.saveModel(model);
    onClose();
  };

  const isConfigured = serverStatus?.configured;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Groq AI Live Configuration"
      subtitle="Fast LPU inference connected securely through your backend"
      maxWidth="480px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Compact Server Status Pill */}
        <div style={{
          padding: '12px 14px',
          borderRadius: '12px',
          backgroundColor: isConfigured ? 'var(--income-light)' : 'var(--expense-light)',
          color: isConfigured ? 'var(--income-green)' : 'var(--expense-red)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isConfigured ? (
              <CheckCircle size={18} style={{ flexShrink: 0 }} />
            ) : (
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
            )}
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.8125rem' }}>
                {isConfigured ? 'Groq AI Backend Connected' : 'Groq AI Backend Status'}
              </div>
              <div style={{ fontSize: '0.6875rem', opacity: 0.85, marginTop: '1px' }}>
                {isConfigured ? 'Connected securely via server environment (GROQ_API_KEY)' : 'Server environment variable (GROQ_API_KEY) managed in Vercel'}
              </div>
            </div>
          </div>
          <button
            onClick={fetchStatus}
            disabled={isLoading}
            style={{ color: 'inherit', padding: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
            title="Refresh status"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Model Selection */}
        <div>
          <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '5px', textTransform: 'uppercase' }}>
            Select Groq Production Model
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={{
              width: '100%',
              height: '40px',
              padding: '0 12px',
              borderRadius: 'var(--radius-md)',
              border: '1.2px solid var(--border-light)',
              backgroundColor: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.8125rem',
              color: 'var(--text-primary)'
            }}
          >
            {GROQ_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Recommended: <code>openai/gpt-oss-120b</code> (500 tokens/sec reasoning).
          </div>
        </div>

        {/* Test Result Message */}
        {testResult && (
          <div style={{
            padding: '10px 14px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: testResult.success ? 'var(--income-light)' : 'var(--expense-light)',
            color: testResult.success ? 'var(--income-green)' : 'var(--expense-red)',
            fontSize: '0.75rem',
            fontWeight: 700
          }}>
            {testResult.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            <span>{testResult.message}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
          <button
            type="button"
            onClick={handleTest}
            disabled={isLoading || !isConfigured}
            style={{
              flex: 1,
              height: '42px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--surface-muted)',
              color: isConfigured ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: 800,
              fontSize: '0.8125rem',
              border: 'none',
              cursor: isConfigured ? 'pointer' : 'not-allowed'
            }}
          >
            {isLoading ? 'Testing...' : 'Test Connection'}
          </button>

          <button
            type="button"
            onClick={handleSave}
            style={{
              flex: 1.2,
              height: '42px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.8125rem',
              border: 'none',
              boxShadow: 'var(--shadow-sm)',
              cursor: 'pointer'
            }}
          >
            Save Model Preference
          </button>
        </div>
      </div>
    </Modal>

  );
}
