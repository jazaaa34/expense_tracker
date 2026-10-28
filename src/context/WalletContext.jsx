
import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { 
  storageService, 
  STORAGE_KEYS, 
  DEFAULT_TRANSACTIONS, 
  DEFAULT_BUDGETS, 
  DEFAULT_ALERTS, 
  DEFAULT_GOALS,
  formatINR,
  isExpenseTxn,
  isIncomeTxn
} from '../services/storageService';
import { useAuth } from './AuthContext';
import { apiRequest } from '../services/apiClient';

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

  // Synchronous state ref ensures pushToDb never sends stale closure state
  const stateRef = useRef({
    transactions: [],
    budgets: {},
    alerts: [],
    goals: [],
    savedAmount: 0,
    aiQuestions: [],
    utilityCaps: {}
  });

  const pushTimerRef = useRef(null);

  // Schedule an atomic debounced push to MongoDB Atlas
  const scheduleDbPush = (immediate = false) => {
    if (!user?.email) return;
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    if (immediate) {
      pushCurrentStateToDb();
      return;
    }
    pushTimerRef.current = setTimeout(() => {
      pushCurrentStateToDb();
    }, 350);
  };

  const pushCurrentStateToDb = async () => {
    if (!user?.email) return;
    const email = user.email.toLowerCase().trim();
    const nowTime = Date.now();
    const payload = {
      transactions: stateRef.current.transactions,
      budgets: stateRef.current.budgets,
      goals: stateRef.current.goals,
      alerts: stateRef.current.alerts,
      utilityCaps: stateRef.current.utilityCaps,
      savedAmount: stateRef.current.savedAmount,
      lastModified: nowTime
    };
    try {
      storageService.setUserData(email, 'last_local_update', nowTime);
      await apiRequest('/api/db/sync', {
        method: 'POST',
        body: JSON.stringify({ email, data: payload })
      });
    } catch (err) {
      console.warn('[MongoDB] Sync error:', err.message);
    }
  };

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

    const txns = storageService.getUserData(email, 'transactions', defaultTxns) || [];
    const bdgs = storageService.getUserData(email, 'budgets', defaultBudgets) || {};
    const alrts = storageService.getUserData(email, 'alerts', defaultAlerts) || [];
    const gls = storageService.getUserData(email, 'goals', defaultGoals) || [];
    const saved = storageService.getUserData(email, 'saved_amount', defaultSaved);
    const aiQ = storageService.getUserData(email, 'ai_questions', []) || [];
    const uCaps = storageService.getUserData(email, 'utility_caps', defaultUtilCaps) || {};

    // Filter out any locally deleted transactions so deletions never resurrect
    const deletedList = storageService.getUserData(email, 'deleted_txn_ids', []) || [];
    const deletedSet = new Set(deletedList.map(String));
    const cleanTxns = (Array.isArray(txns) ? txns : []).filter(t => t && t.id && !deletedSet.has(String(t.id)));
    cleanTxns.sort((a, b) => new Date(b.date) - new Date(a.date));

    const initialSavedAmt = typeof saved === 'number' ? saved : 0;

    stateRef.current = {
      transactions: cleanTxns,
      budgets: bdgs,
      alerts: Array.isArray(alrts) ? alrts : [],
      goals: Array.isArray(gls) ? gls : [],
      savedAmount: initialSavedAmt,
      aiQuestions: Array.isArray(aiQ) ? aiQ : [],
      utilityCaps: uCaps
    };

    setTransactions(cleanTxns);
    setBudgets(bdgs);
    setAlerts(Array.isArray(alrts) ? alrts : []);
    setGoals(Array.isArray(gls) ? gls : []);
    setSavedAmount(initialSavedAmt);
    setAiQuestions(Array.isArray(aiQ) ? aiQ : []);
    setUtilityCaps(uCaps);
    setIsLoaded(true);

    // Asynchronously pull latest from database if user is authenticated
    if (user?.email) {
      apiRequest('/api/db/sync', {
        method: 'POST',
        body: JSON.stringify({ email: user.email })
      }).then(({ ok, data }) => {
        if (!ok || !data?.data) return;
        const cloudData = data.data;
        const cloudTxns = Array.isArray(cloudData.transactions) ? cloudData.transactions : [];
        const localLastUpdate = Number(storageService.getUserData(email, 'last_local_update', 0)) || 0;
        const cloudUpdatedAt = Number(data.updatedAt) || Number(cloudData.lastModified) || 0;

        // Current local state snapshot
        const currentLocal = stateRef.current.transactions;
        const activeDeleted = new Set((storageService.getUserData(email, 'deleted_txn_ids', []) || []).map(String));

        // Smart merge: local edits take priority unless cloud is strictly newer
        const txnMap = new Map();

        // 1. Seed with local transactions
        for (const t of currentLocal) {
          if (t && t.id && !activeDeleted.has(String(t.id))) {
            txnMap.set(String(t.id), t);
          }
        }

        // 2. Merge cloud transactions
        for (const t of cloudTxns) {
          if (!t || !t.id || activeDeleted.has(String(t.id))) continue;
          const idStr = String(t.id);
          const existing = txnMap.get(idStr);
          if (!existing) {
            txnMap.set(idStr, t);
          } else {
            const cloudTime = new Date(t.updatedAt || t.date || 0).getTime();
            const localTime = new Date(existing.updatedAt || existing.date || 0).getTime();
            // Cloud wins only if newer than local record
            if (cloudTime > localTime) {
              txnMap.set(idStr, t);
            }
          }
        }

        const mergedTxns = Array.from(txnMap.values());
        mergedTxns.sort((a, b) => new Date(b.date) - new Date(a.date));

        const isCloudNewer = cloudUpdatedAt > localLastUpdate;

        // Merge budgets
        const mergedBudgets = (isCloudNewer && cloudData.budgets && Object.keys(cloudData.budgets).length > 0)
          ? cloudData.budgets
          : (Object.keys(stateRef.current.budgets).length > 0 ? stateRef.current.budgets : cloudData.budgets || {});

        // Merge goals
        const mergedGoals = (isCloudNewer && Array.isArray(cloudData.goals) && cloudData.goals.length > 0)
          ? cloudData.goals
          : (stateRef.current.goals.length > 0 ? stateRef.current.goals : cloudData.goals || []);

        // Merge alerts
        const mergedAlerts = (isCloudNewer && Array.isArray(cloudData.alerts) && cloudData.alerts.length > 0)
          ? cloudData.alerts
          : (stateRef.current.alerts.length > 0 ? stateRef.current.alerts : cloudData.alerts || []);

        // Merge saved amount
        const mergedSaved = (isCloudNewer && typeof cloudData.savedAmount === 'number')
          ? cloudData.savedAmount
          : stateRef.current.savedAmount;

        // Merge utility caps
        const mergedCaps = (isCloudNewer && cloudData.utilityCaps && Object.keys(cloudData.utilityCaps).length > 0)
          ? cloudData.utilityCaps
          : (Object.keys(stateRef.current.utilityCaps).length > 0 ? stateRef.current.utilityCaps : cloudData.utilityCaps || {});

        stateRef.current = {
          transactions: mergedTxns,
          budgets: mergedBudgets,
          goals: mergedGoals,
          alerts: mergedAlerts,
          savedAmount: mergedSaved,
          utilityCaps: mergedCaps,
          aiQuestions: stateRef.current.aiQuestions
        };

        setTransactions(mergedTxns);
        setBudgets(mergedBudgets);
        setGoals(mergedGoals);
        setAlerts(mergedAlerts);
        setSavedAmount(mergedSaved);
        setUtilityCaps(mergedCaps);

        // Update local storage cache
        storageService.setUserData(email, 'transactions', mergedTxns);
        storageService.setUserData(email, 'budgets', mergedBudgets);
        storageService.setUserData(email, 'goals', mergedGoals);
        storageService.setUserData(email, 'alerts', mergedAlerts);
        storageService.setUserData(email, 'saved_amount', mergedSaved);
        storageService.setUserData(email, 'utility_caps', mergedCaps);
        storageService.setUserData(email, 'last_local_update', Math.max(localLastUpdate, cloudUpdatedAt));

        // If local had newer items not yet in cloud, push the unified merged data to Atlas
        if (localLastUpdate > cloudUpdatedAt || mergedTxns.length > cloudTxns.length) {
          pushCurrentStateToDb();
        }
      }).catch((err) => {
        console.warn('[Sync] Pull error:', err.message);
      });
    }

    const handleBeforeUnload = () => {
      if (pushTimerRef.current) {
        clearTimeout(pushTimerRef.current);
        pushCurrentStateToDb();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, [user?.email]);

  // Sync to local storage and schedule database push
  const syncTransactions = (newTxns) => {
    const email = user?.email?.toLowerCase().trim() || 'guest';
    const sorted = [...newTxns].sort((a, b) => new Date(b.date) - new Date(a.date));
    stateRef.current.transactions = sorted;
    setTransactions(sorted);
    storageService.setUserData(email, 'transactions', sorted);
    storageService.setUserData(email, 'last_local_update', Date.now());
    scheduleDbPush();
  };

  const syncBudgets = (newBudgets) => {
    const email = user?.email?.toLowerCase().trim() || 'guest';
    stateRef.current.budgets = newBudgets;
    setBudgets(newBudgets);
    storageService.setUserData(email, 'budgets', newBudgets);
    storageService.setUserData(email, 'last_local_update', Date.now());
    scheduleDbPush();
  };

  const syncAlerts = (newAlerts) => {
    const email = user?.email?.toLowerCase().trim() || 'guest';
    stateRef.current.alerts = newAlerts;
    setAlerts(newAlerts);
    storageService.setUserData(email, 'alerts', newAlerts);
    storageService.setUserData(email, 'last_local_update', Date.now());
    scheduleDbPush();
  };

  const syncGoals = (newGoals) => {
    const email = user?.email?.toLowerCase().trim() || 'guest';
    stateRef.current.goals = newGoals;
    setGoals(newGoals);
    storageService.setUserData(email, 'goals', newGoals);
    storageService.setUserData(email, 'last_local_update', Date.now());
    scheduleDbPush();
  };

  const syncSavedAmount = (amt) => {
    const email = user?.email?.toLowerCase().trim() || 'guest';
    stateRef.current.savedAmount = amt;
    setSavedAmount(amt);
    storageService.setUserData(email, 'saved_amount', amt);
    storageService.setUserData(email, 'last_local_update', Date.now());
    scheduleDbPush();
  };

  const syncAiQuestions = (questions) => {
    const email = user?.email?.toLowerCase().trim() || 'guest';
    stateRef.current.aiQuestions = questions;
    setAiQuestions(questions);
    storageService.setUserData(email, 'ai_questions', questions);
  };

  // Financial Computations
  const income = useMemo(() => {
    return transactions
      .filter(isIncomeTxn)
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [transactions]);

  const expense = useMemo(() => {
    return transactions
      .filter(isExpenseTxn)
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [transactions]);

  const billExpense = useMemo(() => {
    return transactions
      .filter(t => isExpenseTxn(t) && (t.source === 'bill' || Boolean(t.screenshot)))
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
    const isExp = isExpenseTxn(t);
    const newTxn = {
      id: t.id || Date.now().toString(),
      name: t.name || (isExp ? 'Unnamed Expense' : 'Income Entry'),
      category: t.category || (isExp ? 'Other Expense' : 'Salary'),
      amount: parseFloat(t.amount) || 0,
      isExpense: isExp,
      date: t.date || new Date().toISOString(),
      paymentMethod: t.paymentMethod || 'UPI',
      note: t.note || '',
      tag: t.tag || 'Personal',
      isMonthly: Boolean(t.isMonthly),
      screenshot: t.screenshot || null,
      screenshotName: t.screenshotName || '',
      source: t.source || 'manual',
      confidence: t.confidence !== undefined ? t.confidence : null,
      updatedAt: new Date().toISOString()
    };

    const currentTxns = stateRef.current.transactions || transactions;
    const updated = [newTxn, ...currentTxns];
    syncTransactions(updated);

    // Money Guard intelligent alert generation
    const newAlerts = [];
    
    // 1. Check for Duplicate
    const dupAlert = checkForDuplicateAlert(newTxn);
    if (dupAlert) newAlerts.push(dupAlert);

    // 2. Check for Price Increase this month vs previous payment
    const incAlert = checkForPriceIncreaseAlert(newTxn, currentTxns);
    if (incAlert) newAlerts.push(incAlert);

    // 3. Check for Category Spending Cap Exceeded
    const capAlert = checkForCapAlert(newTxn, updated);
    if (capAlert) newAlerts.push(capAlert);

    if (newAlerts.length > 0) {
      const currentAlerts = stateRef.current.alerts || alerts;
      syncAlerts([...newAlerts, ...currentAlerts]);
    }
  };

  const updateTransaction = (updatedTxn) => {
    const isExp = isExpenseTxn(updatedTxn);
    const stamp = {
      ...updatedTxn,
      isExpense: isExp,
      amount: parseFloat(updatedTxn.amount) || 0,
      updatedAt: new Date().toISOString()
    };
    const currentTxns = stateRef.current.transactions || transactions;
    const updated = currentTxns.map(t => t.id === stamp.id ? stamp : t);
    syncTransactions(updated);
  };

  const deleteTransaction = (id) => {
    const currentTxns = stateRef.current.transactions || transactions;
    const updated = currentTxns.filter(t => t.id !== id);
    const email = user?.email?.toLowerCase().trim() || 'guest';
    const deletedList = storageService.getUserData(email, 'deleted_txn_ids', []) || [];
    if (!deletedList.includes(String(id))) {
      storageService.setUserData(email, 'deleted_txn_ids', [...deletedList, String(id)]);
    }
    syncTransactions(updated);
  };

  const addSavedAmount = (amount) => {
    const val = parseFloat(amount) || 0;
    const currentSaved = typeof stateRef.current.savedAmount === 'number' ? stateRef.current.savedAmount : savedAmount;
    syncSavedAmount(currentSaved + val);
  };

  const setBudget = (category, limit) => {
    const currentBudgets = stateRef.current.budgets || budgets;
    const updated = { ...currentBudgets, [category]: parseFloat(limit) || 0 };
    syncBudgets(updated);
  };

  const resolveAlert = (alertId) => {
    const currentAlerts = stateRef.current.alerts || alerts;
    const updated = currentAlerts.map(a => a.id === alertId ? { ...a, isResolved: true } : a);
    syncAlerts(updated);
  };

  const addGoal = (goal) => {
    const newGoal = {
      id: goal.id || `goal_${Date.now()}`,
      title: goal.title || 'New Goal',
      targetAmount: parseFloat(goal.targetAmount) || 10000,
      savedAmount: parseFloat(goal.savedAmount) || 0,
      iconEmoji: goal.iconEmoji || '🎯',
      updatedAt: new Date().toISOString()
    };
    const currentGoals = stateRef.current.goals || goals;
    syncGoals([...currentGoals, newGoal]);
  };

  const addGoalSaving = (goalId, amount) => {
    const val = parseFloat(amount) || 0;
    const currentGoals = stateRef.current.goals || goals;
    const updated = currentGoals.map(g => {
      if (g.id === goalId) {
        return {
          ...g,
          savedAmount: (parseFloat(g.savedAmount) || 0) + val,
          updatedAt: new Date().toISOString()
        };
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
    const currentAiQuestions = stateRef.current.aiQuestions || aiQuestions;
    syncAiQuestions([record, ...currentAiQuestions]);
  };

  const deleteAiQuestion = (id) => {
    const currentAiQuestions = stateRef.current.aiQuestions || aiQuestions;
    syncAiQuestions(currentAiQuestions.filter(q => q.id !== id));
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
    const currentCaps = stateRef.current.utilityCaps || utilityCaps;
    const updated = { ...currentCaps, [utilId]: num };
    stateRef.current.utilityCaps = updated;
    setUtilityCaps(updated);
    storageService.setUserData(email, 'utility_caps', updated);
    storageService.setUserData(email, 'last_local_update', Date.now());
    scheduleDbPush();
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
    const currentAlerts = stateRef.current.alerts || alerts;
    syncAlerts([newAlert, ...currentAlerts]);
  };

  // Wipes all data clean to start completely fresh from ₹0 balance & 0 history
  const resetAllToZero = async () => {
    const email = user?.email?.toLowerCase().trim() || 'guest';
    storageService.setUserData(email, 'deleted_txn_ids', []);
    syncTransactions([]);
    syncBudgets({});
    syncAlerts([]);
    syncGoals([]);
    syncSavedAmount(0);
    syncAiQuestions([]);

    const nowTime = Date.now();
    const payload = {
      transactions: [],
      budgets: {},
      goals: [],
      alerts: [],
      utilityCaps: {},
      savedAmount: 0,
      lastModified: nowTime
    };
    storageService.setUserData(email, 'last_local_update', nowTime);
    try {
      await apiRequest('/api/db/sync', {
        method: 'POST',
        body: JSON.stringify({ email, data: payload })
      });
    } catch (err) {
      console.warn('[MongoDB] Sync reset error:', err.message);
    }
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
      resetToDefaultData,
      resetAllToZero
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
