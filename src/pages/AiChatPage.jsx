import React, { useState, useRef, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { aiService } from '../services/aiService';
import { formatINR } from '../services/storageService';
import { Sparkles, Send, Bot, User, Key, RefreshCw, Trash2, HelpCircle } from 'lucide-react';

export default function AiChatPage({ onOpenApiKeyModal }) {
  const store = useWallet();
  const { user, aiQuestions, addAiQuestion, deleteAiQuestion, clearAiQuestions } = store;
  
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      isUser: false,
      content: `Hello ${user?.name || 'Aysha'}! 👋 I am **WalletWeather AI**, your personalized financial advisor.\n\nI've analyzed your active transactions and net balance. Feel free to ask me how to trim leaks, optimize your category budgets, or accelerate your savings goals!`,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const [hasKey, setHasKey] = useState(false);
  const [currentModel, setCurrentModel] = useState(aiService.getModel());

  useEffect(() => {
    let isMounted = true;
    const checkStatus = async () => {
      const st = await aiService.getServerStatus();
      if (isMounted) {
        setHasKey(Boolean(st.configured));
        setCurrentModel(aiService.getModel());
      }
    };
    checkStatus();

    const handleUpdate = () => checkStatus();
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('walletweather_model_updated', handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('walletweather_model_updated', handleUpdate);
    };
  }, []);

  const promptSuggestions = [
    'Where can I cut ₹5,000 from my spending?',
    'Review my monthly budget health',
    'How can I optimize food & dining expenses?',
    'How much should I allocate to my emergency fund?'
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (textToSend) => {
    const text = (textToSend || input).trim();
    if (!text || isTyping) return;

    const userMsg = {
      id: Date.now().toString(),
      isUser: true,
      content: text,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const responseText = await aiService.askAdvisor(text, messages, store);
      const assistantMsg = {
        id: (Date.now() + 1).toString(),
        isUser: false,
        content: responseText,
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, assistantMsg]);
      addAiQuestion(text, responseText);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          isUser: false,
          content: 'I encountered an issue processing your request. Please check your network or try again.',
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: '24px', alignItems: 'start' }}>
      {/* Main Chat Stream */}
      <div className="card" style={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Chat Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#FFFFFF'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Bot size={22} />
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                WalletWeather AI Advisor
              </div>
              <div style={{ fontSize: '0.75rem', color: hasKey ? 'var(--income-green)' : 'var(--accent-honey)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: hasKey ? 'var(--income-green)' : 'var(--accent-honey)', display: 'inline-block' }}></span>
                <span>{hasKey ? `Groq Backend (${currentModel})` : `AI Assistant (${currentModel})`}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onOpenApiKeyModal}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              backgroundColor: 'var(--surface-muted)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--text-secondary)'
            }}
          >
            <Key size={14} />
            <span>AI Backend & Models</span>
          </button>
        </div>

        {/* Message Stream */}
        <div style={{
          flex: 1,
          padding: '24px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          backgroundColor: 'var(--bg-primary)'
        }}>
          {messages.map((m) => {
            const isUser = m.isUser;
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  gap: '12px',
                  justifyContent: isUser ? 'flex-end' : 'flex-start',
                  alignItems: 'flex-start'
                }}
              >
                {!isUser && (
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--primary)',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Bot size={18} />
                  </div>
                )}

                <div style={{
                  maxWidth: '75%',
                  padding: '14px 18px',
                  borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  backgroundColor: isUser ? 'var(--primary)' : '#FFFFFF',
                  color: isUser ? '#FFFFFF' : 'var(--text-primary)',
                  boxShadow: 'var(--shadow-xs)',
                  border: isUser ? 'none' : '1.2px solid var(--border-light)',
                  lineHeight: 1.6,
                  fontSize: '0.9375rem'
                }}>
                  <FormattedMessage content={m.content} isUser={isUser} />
                </div>

                {isUser && (
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--surface-muted)',
                    color: 'var(--primary)',
                    border: '1.5px solid var(--primary)',
                    fontWeight: 800,
                    fontSize: '0.8125rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {(user?.name || 'A')[0].toUpperCase()}
                  </div>
                )}
              </div>
            );
          })}

          {isTyping && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Bot size={18} />
              </div>
              <div style={{
                padding: '12px 18px',
                borderRadius: '18px',
                backgroundColor: '#FFFFFF',
                border: '1.2px solid var(--border-light)',
                fontSize: '0.875rem',
                color: 'var(--text-secondary)'
              }}>
                Analyzing your financial snapshot...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        <div style={{
          padding: '10px 20px',
          backgroundColor: '#FFFFFF',
          borderTop: '1px solid var(--border-light)',
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          whiteSpace: 'nowrap'
        }}>
          {promptSuggestions.map((s) => (
            <button
              key={s}
              onClick={() => handleSend(s)}
              style={{
                padding: '6px 12px',
                borderRadius: '16px',
                backgroundColor: 'var(--surface-muted)',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: '1px solid var(--border-light)',
                flexShrink: 0
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          style={{
            padding: '16px 20px',
            backgroundColor: '#FFFFFF',
            borderTop: '1px solid var(--border-light)',
            display: 'flex',
            gap: '12px',
            alignItems: 'center'
          }}
        >
          <input
            type="text"
            placeholder="Ask anything about your money, budgets, or savings..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            style={{
              flex: 1,
              height: '46px',
              padding: '0 16px',
              borderRadius: 'var(--radius-md)',
              border: '1.2px solid var(--border-light)',
              fontSize: '0.875rem'
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            style={{
              width: '46px',
              height: '46px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: !input.trim() || isTyping ? 0.6 : 1
            }}
          >
            <Send size={18} />
          </button>
        </form>
      </div>

      {/* Right Column: Q&A History */}
      <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Saved Consultations
          </div>
          {aiQuestions.length > 0 && (
            <button
              onClick={clearAiQuestions}
              style={{ fontSize: '0.75rem', color: 'var(--expense-red)', fontWeight: 700 }}
            >
              Clear All
            </button>
          )}
        </div>

        {aiQuestions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            No saved questions yet. Answers to your prompts are saved here for reference.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {aiQuestions.map((q) => (
              <div
                key={q.id}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--surface-muted)',
                  border: '1px solid var(--border-light)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div 
                    onClick={() => handleSend(q.question)}
                    style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--text-primary)', cursor: 'pointer', flex: 1 }}
                  >
                    "{q.question}"
                  </div>
                  <button
                    onClick={() => deleteAiQuestion(q.id)}
                    style={{ color: 'var(--text-muted)' }}
                    title="Delete record"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FormattedMessage({ content, isUser }) {
  if (isUser) {
    return <div style={{ whiteSpace: 'pre-wrap' }}>{content}</div>;
  }

  const lines = (content || '').split('\n');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} style={{ height: '4px' }} />;
        }
        if (trimmed.startsWith('### ')) {
          return (
            <div key={idx} style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)', marginTop: idx > 0 ? '6px' : 0 }}>
              {formatInline(trimmed.replace(/^###\s+/, ''))}
            </div>
          );
        }
        if (trimmed.startsWith('#### ')) {
          return (
            <div key={idx} style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
              {formatInline(trimmed.replace(/^####\s+/, ''))}
            </div>
          );
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || /^\d+\.\s+/.test(trimmed)) {
          const isOrdered = /^\d+\.\s+/.test(trimmed);
          const prefix = isOrdered ? trimmed.match(/^\d+\./)[0] : '•';
          const text = trimmed.replace(/^(-\s+|•\s+|\d+\.\s+)/, '');
          return (
            <div key={idx} style={{ display: 'flex', gap: '8px', paddingLeft: '4px', alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--accent-honey)', fontWeight: 800, flexShrink: 0 }}>{prefix}</span>
              <span style={{ flex: 1 }}>{formatInline(text)}</span>
            </div>
          );
        }
        return (
          <div key={idx} style={{ whiteSpace: 'pre-wrap' }}>
            {formatInline(line)}
          </div>
        );
      })}
    </div>
  );
}

function formatInline(text) {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} style={{ color: 'var(--text-secondary)' }}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}
