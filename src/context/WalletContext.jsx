
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { 
  storageService, 
  STORAGE_KEYS, 
  DEFAULT_TRANSACTIONS, 
  DEFAULT_BUDGETS, 
  DEFAULT_ALERTS, 
  DEFAULT_GOALS,
  formatINR
} from '../services/storageService';
import { useAuth } from './AuthContext';

const WalletContext = createContext();

export function WalletProvider({ children }) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [goals, setGoals] = useState([]);
  const [savedAmount, setSavedAmount] = useState(0);
  const [aiQuestions, setAiQuestions] = useState([]);
  const [utilityCaps, setUtilityCaps] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from local storage scoped by current user email
  useEffect(() => {
    storageService.initStorage();
    const email = user?.email?.toLowerCase().trim() || 'guest';
    const isDemo = email === 'jazaaa34@gmail.com' || email === 'aysha@example.com';

    // Only jazaaa34@gmail.com in name Aysha receives the pre-populated demo records;
    // other accounts start completely clean so they enter everything manually.
    const defaultTxns = isDemo ? DEFAULT_TRANSACTIONS : [];
    const defaultBudgets = isDemo ? DEFAULT_BUDGETS : {};
    const defaultAlerts = isDemo ? DEFAULT_ALERTS : [];
    const defaultGoals = isDemo ? DEFAULT_GOALS : [];
    const defaultSaved = isDemo ? 3400 : 0;
    const defaultUtilCaps = isDemo ? {
      electricity: 3500,
      broadband: 1500,
      water: 1200,
      mobile: 900,
      gas: 1200,
      streaming: 800,
      maintenance: 4500
    } : {};

    const txns = storageService.getUserData(email, 'transactions', defaultTxns);
    const bdgs = storageService.getUserData(email, 'budgets', defaultBudgets);
    const alrts = storageService.getUserData(email, 'alerts', defaultAlerts);
    const gls = storageService.getUserData(email, 'goals', defaultGoals);
    const saved = storageService.getUserData(email, 'saved_amount', defaultSaved);
    const aiQ = storageService.getUserData(email, 'ai_questions', []);
    const uCaps = storageService.getUserData(email, 'utility_caps', defaultUtilCaps);

    // Sort transactions newest first
    const sortedTxns = Array.isArray(txns) ? [...txns] : [];
    sortedTxns.sort((a, b) => new Date(b.date) - new Date(a.date));

    setTransactions(sortedTxns);
    setBudgets(bdgs || {});
    setAlerts(Array.isArray(alrts) ? alrts : []);
    setGoals(Array.isArray(gls) ? gls : []);
    setSavedAmount(typeof saved === 'number' ? saved : 0);
    setAiQuestions(Array.isArray(aiQ) ? aiQ : []);
    setUtilityCaps(uCaps || {});
    setIsLoaded(true);
  }, [user?.email]);

  // Sync to local storage for the current user
  const syncTransactions = (newTxns) => {
    const email = user?.email?.toLowerCase().trim() || 'guest';
    newTxns.sort((a, b) => new Date(b.date) - new Date(a.date));
    setTransactions(newTxns);
    storageService.setUserData(email, 'transactions', newTxns);
  };

  const syncBudgets = (newBudgets) => {
    const email = user?.email?.toLowerCase().trim() || 'guest';
    setBudgets(newBudgets);
    storageService.setUserData(email, 'budgets', newBudgets);
  };

  const syncAlerts = (newAlerts) => {
    const email = user?.email?.toLowerCase().trim() || 'guest';
    setAlerts(newAlerts);
    storageService.setUserData(email, 'alerts', newAlerts);
  };

  const syncGoals = (newGoals) => {
    const email = user?.email?.toLowerCase().trim() || 'guest';
    setGoals(newGoals);
    storageService.setUserData(email, 'goals', newGoals);
  };

  const syncSavedAmount = (amt) => {
    const email = user?.email?.toLowerCase().trim() || 'guest';
    setSavedAmount(amt);
    storageService.setUserData(email, 'saved_amount', amt);
  };

  const syncAiQuestions = (questions) => {
    const email = user?.email?.toLowerCase().trim() || 'guest';
    setAiQuestions(questions);
    storageService.setUserData(email, 'ai_questions', questions);
  };

  // Financial Computations
  const income = useMemo(() => {
    return transactions
      .filter(t => !t.isExpense)
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [transactions]);

  const expense = useMemo(() => {
    return transactions
      .filter(t => t.isExpense)
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [transactions]);

  const billExpense = useMemo(() => {
    return transactions
      .filter(t => t.isExpense && (t.source === 'bill' || Boolean(t.screenshot)))
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [transactions]);

  const balance = useMemo(() => income - expense, [income, expense]);

  const days = useMemo(() => {
    if (transactions.length === 0) return 1;
    const oldestDate = transactions.reduce((oldest, t) => {
      const d = new Date(t.date);
      return d < oldest ? d : oldest;
    }, new Date());
    const now = new Date();
    const diffDays = Math.floor((now - oldestDate) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diffDays);
  }, [transactions]);

  const dailyAvg = useMemo(() => (days > 0 ? expense / days : 0), [expense, days]);
  const weeklyAvg = useMemo(() => dailyAvg * 7, [dailyAvg]);

  // Current Month Expenses
  const currentMonthExpense = useMemo(() => {
    const now = new Date();
    return transactions
      .filter(t => {
        if (!t.isExpense) return false;
        const d = new Date(t.date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [transactions]);

  // Category Breakdown for current month or all expenses
  const categoryBreakdown = useMemo(() => {
    const map = {};
    for (const t of transactions) {
      if (t.isExpense) {
        map[t.category] = (map[t.category] || 0) + Number(t.amount || 0);
      }
    }
    return map;
  }, [transactions]);

  // Last 7 Days Daily Spending for Bar Chart
  const last7DaysSpend = useMemo(() => {
    const daysArr = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dayName = dayNames[d.getDay()];
      const dateStr = d.toISOString().split('T')[0];
      
      const dayTotal = transactions
        .filter(t => {
          if (!t.isExpense) return false;
          const tDate = new Date(t.date).toISOString().split('T')[0];
          return tDate === dateStr;
        })
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      daysArr.push({
        day: dayName,
        date: dateStr,
        amount: dayTotal,
        isToday: i === 0
      });
    }
    return daysArr;
  }, [transactions]);

  const totalBudget = useMemo(() => {
    return Object.values(budgets).reduce((sum, b) => sum + Number(b || 0), 0);
  }, [budgets]);

  const budgetRatio = useMemo(() => {
    return totalBudget > 0 ? Math.min(1, currentMonthExpense / totalBudget) : 0;
  }, [totalBudget, currentMonthExpense]);

  // Dynamic Risk Calculation matching Flutter store.calculateTodayRisk()
  const todayRisk = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const isFriday = day === 5;
    const isWeekend = day === 0 || day === 6;

    let risk = 30;
    if (isFriday) risk += 35;
    if (isWeekend) risk += 40;

    const todayDateStr = now.toISOString().split('T')[0];
    const todaySpend = transactions
      .filter(t => t.isExpense && new Date(t.date).toISOString().split('T')[0] === todayDateStr)
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    if (todaySpend > dailyAvg * 1.5) {
      risk += 25;
    } else if (todaySpend > dailyAvg) {
      risk += 15;
    }

    if (totalBudget > 0 && currentMonthExpense > (totalBudget * 0.8)) {
      risk += 15;
    }

    return Math.max(10, Math.min(95, risk));
  }, [transactions, dailyAvg, totalBudget, currentMonthExpense]);

  // Auto alert detector for duplicate transactions
  const checkForDuplicateAlert = (newTxn) => {
    if (!newTxn.isExpense) return null;
    const newDateStr = new Date(newTxn.date).toISOString().split('T')[0];
    
    const duplicates = transactions.filter(t => 
      t.id !== newTxn.id &&
      t.name.trim().toLowerCase() === newTxn.name.trim().toLowerCase() &&
      Math.abs(t.amount - newTxn.amount) < 0.01 &&
      new Date(t.date).toISOString().split('T')[0] === newDateStr
    );

    if (duplicates.length > 0) {
      return {
        id: `auto_dup_${Date.now()}`,
        title: 'Potential Double Charge Detected',
        description: `"${newTxn.name}" of ${formatINR(newTxn.amount)} was recorded twice on ${newDateStr}.`,
        actionLabel: 'Review',
        iconType: 'copy',
        color: '#FF6584',
        isResolved: false
      };
    }
    return null;
  };

  // Auto alert detector for monthly payment increases compared to previous month
  const checkForPriceIncreaseAlert = (newTxn, currentTxns) => {
    if (!newTxn.isExpense) return null;
    const cleanName = (newTxn.name || '').trim().toLowerCase();
    const newDate = new Date(newTxn.date);

    // Look for earlier transactions with the same or similar payee/name
    const matches = currentTxns.filter(t => {
      if (t.id === newTxn.id || !t.isExpense) return false;
      const tName = (t.name || '').trim().toLowerCase();
      const isSamePayee = tName === cleanName || 
                          (cleanName.length >= 4 && tName.includes(cleanName)) || 
                          (tName.length >= 4 && cleanName.includes(tName));
      if (!isSamePayee) return false;

      const tDate = new Date(t.date);
      // Prior transaction from earlier date
      return tDate < newDate;
    });

    if (matches.length > 0) {
      // Sort newest earlier transaction first
      matches.sort((a, b) => new Date(b.date) - new Date(a.date));
      const lastPayment = matches[0];

      // If amount increased compared to last payment
      if (newTxn.amount > lastPayment.amount) {
        const diff = newTxn.amount - lastPayment.amount;
        const percentIncrease = Math.round((diff / lastPayment.amount) * 100);

        return {
          id: `increase_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          title: `Payment Increase: ${newTxn.name}`,
          description: `${newTxn.name} increased by ${formatINR(diff)} (${percentIncrease}%) this month compared to previous payment (${formatINR(lastPayment.amount)} → ${formatINR(newTxn.amount)}).`,
          actionLabel: 'Review Bill',
          iconType: 'trending-up',
          color: '#FF6584',
          isResolved: false
        };
      }
    }
    return null;
  };

  // Auto alert detector for spending caps exceeded
  const checkForCapAlert = (newTxn, updatedTxns) => {
    if (!newTxn.isExpense) return null;
    const cat = newTxn.category;
    const cap = budgets[cat];

    if (cap && cap > 0) {
      const targetDate = new Date(newTxn.date);
      const targetYear = targetDate.getFullYear();
      const targetMonth = targetDate.getMonth();

      const catMonthSpend = updatedTxns
        .filter(t => {
          if (!t.isExpense || t.category !== cat) return false;
          const d = new Date(t.date);
          return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
        })
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      if (catMonthSpend > cap) {
        const over = catMonthSpend - cap;
        return {
          id: `cap_${cat.replace(/\s+/g, '_')}_${Date.now()}`,
          title: `Monthly Cap Exceeded: ${cat}`,
          description: `Total spend in ${cat} reached ${formatINR(catMonthSpend)}, exceeding your monthly cap of ${formatINR(cap)} by ${formatINR(over)}.`,
          actionLabel: 'Review Budget',
          iconType: 'warning',
          color: '#EF4444',
          isResolved: false
        };
      }
    }
    return null;
  };

  // Actions
  const addTransaction = (t) => {
    const newTxn = {
      id: t.id || Date.now().toString(),
      name: t.name || 'Unnamed',
      category: t.category || 'Other Expense',
      amount: parseFloat(t.amount) || 0,
      isExpense: t.isExpense !== undefined ? t.isExpense : true,
      date: t.date || new Date().toISOString(),
      paymentMethod: t.paymentMethod || 'UPI',
      note: t.note || '',
      tag: t.tag || 'Personal',
      isMonthly: Boolean(t.isMonthly),
      screenshot: t.screenshot || null,
      screenshotName: t.screenshotName || '',
      source: t.source || 'manual',
      confidence: t.confidence !== undefined ? t.confidence : null
    };

    const updated = [newTxn, ...transactions];
    syncTransactions(updated);

    // Money Guard intelligent alert generation
    const newAlerts = [];
    
    // 1. Check for Duplicate
    const dupAlert = checkForDuplicateAlert(newTxn);
    if (dupAlert) newAlerts.push(dupAlert);

    // 2. Check for Price Increase this month vs previous payment
    const incAlert = checkForPriceIncreaseAlert(newTxn, transactions);
    if (incAlert) newAlerts.push(incAlert);

    // 3. Check for Category Spending Cap Exceeded
    const capAlert = checkForCapAlert(newTxn, updated);
    if (capAlert) newAlerts.push(capAlert);

    if (newAlerts.length > 0) {
      syncAlerts([...newAlerts, ...alerts]);
    }
  };

  const updateTransaction = (updatedTxn) => {
    const updated = transactions.map(t => t.id === updatedTxn.id ? updatedTxn : t);
    syncTransactions(updated);
  };

  const deleteTransaction = (id) => {
    const updated = transactions.filter(t => t.id !== id);
    syncTransactions(updated);
  };

  const addSavedAmount = (amount) => {
    const val = parseFloat(amount) || 0;
    syncSavedAmount(savedAmount + val);
  };

  const setBudget = (category, limit) => {
    const updated = { ...budgets, [category]: parseFloat(limit) || 0 };
    syncBudgets(updated);
  };

  const resolveAlert = (alertId) => {
    const updated = alerts.map(a => a.id === alertId ? { ...a, isResolved: true } : a);
    syncAlerts(updated);
  };

  const addGoal = (goal) => {
    const newGoal = {
      id: goal.id || `goal_${Date.now()}`,
      title: goal.title || 'New Goal',
      targetAmount: parseFloat(goal.targetAmount) || 10000,
      savedAmount: parseFloat(goal.savedAmount) || 0,
      iconEmoji: goal.iconEmoji || '🎯'
    };
    syncGoals([...goals, newGoal]);
  };

  const addGoalSaving = (goalId, amount) => {
    const val = parseFloat(amount) || 0;
    const updated = goals.map(g => {
      if (g.id === goalId) {
        return { ...g, savedAmount: g.savedAmount + val };
      }
      return g;
    });
    syncGoals(updated);
  };

  const addAiQuestion = (question, answer) => {
    const record = {
      id: Date.now().toString(),
      question,
      answer,
      timestamp: new Date().toISOString(),
      userEmail: user?.email || 'aysha@example.com'
    };
    syncAiQuestions([record, ...aiQuestions]);
  };

  const deleteAiQuestion = (id) => {
    syncAiQuestions(aiQuestions.filter(q => q.id !== id));
  };

  const clearAiQuestions = () => {
    syncAiQuestions([]);
  };

  const resetToDefaultData = () => {
    const email = user?.email?.toLowerCase().trim() || 'guest';
    const isDemo = email === 'jazaaa34@gmail.com' || email === 'aysha@example.com';
    if (isDemo) {
      syncTransactions([...DEFAULT_TRANSACTIONS]);
      syncBudgets({ ...DEFAULT_BUDGETS });
      syncAlerts([...DEFAULT_ALERTS]);
      syncGoals([...DEFAULT_GOALS]);
      syncSavedAmount(3400);
      syncAiQuestions([]);
    } else {
      syncTransactions([]);
      syncBudgets({});
      syncAlerts([]);
      syncGoals([]);
      syncSavedAmount(0);
      syncAiQuestions([]);
    }
  };

  const setUtilityCap = (utilId, capAmount) => {
    const email = user?.email?.toLowerCase().trim() || 'guest';
    const num = Math.max(0, parseFloat(capAmount) || 0);
    const updated = { ...utilityCaps, [utilId]: num };
    setUtilityCaps(updated);
    storageService.setUserData(email, 'utility_caps', updated);
  };

  const addAlert = (alertObj) => {
    const newAlert = {
      id: alertObj.id || `alert_${Date.now()}`,
      title: alertObj.title || 'Notice',
      description: alertObj.description || '',
      actionLabel: alertObj.actionLabel || 'Acknowledge',
      iconType: alertObj.iconType || 'warning',
      color: alertObj.color || '#F59E0B',
      isResolved: false
    };
    syncAlerts([newAlert, ...alerts]);
  };

  return (
    <WalletContext.Provider value={{
      isLoaded,
      user,
      transactions,
      budgets,
      alerts,
      goals,
      savedAmount,
      aiQuestions,
      utilityCaps,
      income,
      expense,
      billExpense,
      balance,
      days,
      dailyAvg,
      weeklyAvg,
      currentMonthExpense,
      categoryBreakdown,
      last7DaysSpend,
      totalBudget,
      budgetRatio,
      todayRisk,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addSavedAmount,
      setBudget,
      setUtilityCap,
      addAlert,
      resolveAlert,
      addGoal,
      addGoalSaving,
      addAiQuestion,
      deleteAiQuestion,
      clearAiQuestions,
      resetToDefaultData
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within a WalletProvider');
  return context;
}
