import React, { useState, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WalletProvider, useWallet } from './context/WalletContext';
import AppLayout from './components/layout/AppLayout';
import { formatINR } from './services/storageService';
import { CheckCircle2, X } from 'lucide-react';

// Dynamic imports with React lazy loading for optimal bundle splitting
const IntroPage = lazy(() => import('./pages/IntroPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const AlertsPage = lazy(() => import('./pages/AlertsPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const AiChatPage = lazy(() => import('./pages/AiChatPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const BillsPage = lazy(() => import('./pages/BillsPage'));

// Lazy load dialogs and heavy sheets
const TransactionModal = lazy(() => import('./components/transactions/TransactionModal'));
const TransactionDetailSheet = lazy(() => import('./components/transactions/TransactionDetailSheet'));
const ExitConfirmModal = lazy(() => import('./components/common/ExitConfirmModal'));
const BillUploadModal = lazy(() => import('./components/bills/BillUploadModal'));

const PageLoader = () => (
  <div style={{
    minHeight: '360px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px'
  }}>
    <div style={{
      width: '44px',
      height: '44px',
      borderRadius: '14px',
      backgroundColor: 'var(--primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#FFFFFF',
      marginBottom: '14px',
      boxShadow: 'var(--shadow-sm)'
    }} className="animate-breathe">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
        <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
      </svg>
    </div>
    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
      Loading...
    </div>
  </div>
);

function MainApp() {
  const { isLoggedIn, isLoading, logout } = useAuth();
  const { addTransaction, updateTransaction, deleteTransaction } = useWallet();

  const [authView, setAuthView] = useState('intro'); // 'intro', 'login', 'signup'
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  const [isAddTxnOpen, setIsAddTxnOpen] = useState(false);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState(null);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  React.useEffect(() => {
    const handleLogout = () => {
      setAuthView('login');
    };
    const handleOpenExitDialog = () => {
      setIsExitModalOpen(true);
    };
    window.addEventListener('walletweather_logout', handleLogout);
    window.addEventListener('walletweather_open_exit_dialog', handleOpenExitDialog);
    return () => {
      window.removeEventListener('walletweather_logout', handleLogout);
      window.removeEventListener('walletweather_open_exit_dialog', handleOpenExitDialog);
    };
  }, []);

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)'
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '18px',
          backgroundColor: 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          marginBottom: '20px',
          boxShadow: 'var(--shadow-md)'
        }} className="animate-breathe">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
            <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
          </svg>
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
          WalletWeather
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Loading your financial alerts...
        </div>
      </div>
    );
  }

  // Not logged in -> Show Auth Gate (Intro / Login / Signup)
  if (!isLoggedIn) {
    return (
      <Suspense fallback={<PageLoader />}>
        {authView === 'login' && (
          <LoginPage
            onNavigateIntro={() => setAuthView('intro')}
            onNavigateSignup={() => setAuthView('signup')}
          />
        )}
        {authView === 'signup' && (
          <SignupPage
            onNavigateIntro={() => setAuthView('intro')}
            onNavigateLogin={() => setAuthView('login')}
          />
        )}
        {authView === 'intro' && (
          <IntroPage
            onNavigateLogin={() => setAuthView('login')}
            onNavigateSignup={() => setAuthView('signup')}
          />
        )}
      </Suspense>
    );
  }

  // Logged in -> Render Main Dashboard App
  const handleOpenAddTxn = () => {
    setEditingTxn(null);
    setIsAddTxnOpen(true);
  };

  const handleEditTxn = (txn) => {
    setEditingTxn(txn);
    setSelectedTxn(null);
    setIsAddTxnOpen(true);
  };

  const handleSaveTxn = (txnData) => {
    if (editingTxn) {
      updateTransaction(txnData);
    } else {
      addTransaction(txnData);
    }
  };

  return (
    <AppLayout
      currentTab={currentTab}
      onSelectTab={setCurrentTab}
      onOpenAddTxn={handleOpenAddTxn}
      onOpenScanBill={() => setIsBillModalOpen(true)}
      searchQuery={searchQuery}
      onSearchChange={(q) => {
        setSearchQuery(q);
        if (q && currentTab !== 'history') {
          setCurrentTab('history');
        }
      }}
    >
      <Suspense fallback={<PageLoader />}>
        {currentTab === 'dashboard' && (
          <DashboardPage
            onOpenAddTxn={handleOpenAddTxn}
            onSelectTxn={setSelectedTxn}
            onNavigateTab={setCurrentTab}
          />
        )}

        {currentTab === 'history' && (
          <HistoryPage
            onSelectTxn={setSelectedTxn}
            onOpenAddTxn={handleOpenAddTxn}
            onOpenScanBill={() => setIsBillModalOpen(true)}
            initialQuery={searchQuery}
          />
        )}

        {currentTab === 'bills' && (
          <BillsPage
            onSelectTxn={setSelectedTxn}
            onOpenScanBill={() => setIsBillModalOpen(true)}
            onOpenAddTxn={handleOpenAddTxn}
          />
        )}

        {(currentTab === 'alerts' || currentTab === 'forecast') && (
          <AlertsPage />
        )}

        {currentTab === 'analytics' && (
          <AnalyticsPage onOpenAddTxn={handleOpenAddTxn} />
        )}

        {currentTab === 'ai-chat' && (
          <AiChatPage />
        )}

        {currentTab === 'profile' && (
          <ProfilePage />
        )}
      </Suspense>

      {/* Global Modals loaded lazily */}
      <Suspense fallback={null}>
        {isAddTxnOpen && (
          <TransactionModal
            isOpen={isAddTxnOpen}
            onClose={() => setIsAddTxnOpen(false)}
            onSave={handleSaveTxn}
            editingTxn={editingTxn}
          />
        )}

        {isBillModalOpen && (
          <BillUploadModal
            isOpen={isBillModalOpen}
            onClose={() => setIsBillModalOpen(false)}
            onSaveExpense={(payload) => {
              addTransaction(payload);
              setToast({
                type: 'success',
                title: 'Bill Saved to History!',
                message: `"${payload.name}" (${formatINR(payload.amount)}) has been recorded in your history & Bills Vault.`,
                actionLabel: 'View in Bills Vault',
                onAction: () => {
                  setCurrentTab('bills');
                  setToast(null);
                }
              });
            }}
            onFallbackManual={() => {
              setIsBillModalOpen(false);
              setIsAddTxnOpen(true);
            }}
          />
        )}

        {Boolean(selectedTxn) && (
          <TransactionDetailSheet
            txn={selectedTxn}
            isOpen={Boolean(selectedTxn)}
            onClose={() => setSelectedTxn(null)}
            onEdit={handleEditTxn}
            onDelete={deleteTransaction}
            onUpdate={(updatedTxn) => {
              updateTransaction(updatedTxn);
              setSelectedTxn(updatedTxn);
            }}
          />
        )}

        {isExitModalOpen && (
          <ExitConfirmModal
            isOpen={isExitModalOpen}
            onClose={() => setIsExitModalOpen(false)}
            onConfirm={() => {
              setIsExitModalOpen(false);
              logout();
            }}
          />
        )}
      </Suspense>

      {/* Floating Success Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          maxWidth: '420px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 12px 36px rgba(15, 23, 42, 0.18), 0 4px 12px rgba(15, 23, 42, 0.08)',
          border: '1.5px solid #A7F3D0',
          padding: '16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            backgroundColor: '#ECFDF5',
            color: '#10B981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <CheckCircle2 size={20} />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
              {toast.title}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.4 }}>
              {toast.message}
            </div>

            {toast.actionLabel && (
              <button
                onClick={toast.onAction}
                style={{
                  marginTop: '8px',
                  padding: '5px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--primary-teal, #0D9488)',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                {toast.actionLabel} →
              </button>
            )}
          </div>

          <button
            onClick={() => setToast(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '2px'
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <WalletProvider>
        <MainApp />
      </WalletProvider>
    </AuthProvider>
  );
}
