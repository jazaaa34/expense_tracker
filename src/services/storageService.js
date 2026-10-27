
// ==============================================================================
// STORAGE SERVICE - WALLETWEATHER WEB
// Adapts Flutter SharedPreferences & SecureStorage to browser localStorage
// ==============================================================================

export const STORAGE_KEYS = {
  TRANSACTIONS: 'ww_transactions',
  BUDGETS: 'ww_budgets',
  ALERTS: 'ww_alerts',
  GOALS: 'ww_goals',
  AI_QUESTIONS: 'ww_ai_questions',
  REGISTERED_USERS: 'ww_registered_users',
  CURRENT_USER: 'ww_current_user',
  SAVED_AMOUNT: 'ww_saved_amount',
  GROQ_KEY: 'ww_groq_api_key',
  GROQ_MODEL: 'ww_groq_model'
};

export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';
export const GROQ_MODELS = [
  { id: 'openai/gpt-oss-120b', name: 'OpenAI GPT-OSS 120B (Recommended)' },
  { id: 'openai/gpt-oss-20b', name: 'OpenAI GPT-OSS 20B (Ultra Fast)' },
  { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B' }
];

// Category Definitions matching Flutter CategoryRegistry
export const EXPENSE_CATEGORIES = [
  { name: 'Food & Dining', icon: 'Utensils', color: '#FF6584', bg: '#FFF0F3' },
  { name: 'Groceries', icon: 'ShoppingCart', color: '#38BDF8', bg: '#F0F9FF' },
  { name: 'Transport & Fuel', icon: 'Car', color: '#FBBF24', bg: '#FEFCE8' },
  { name: 'Bills & Utilities', icon: 'Zap', color: '#A78BFA', bg: '#F5F3FF' },
  { name: 'Shopping & Tech', icon: 'ShoppingBag', color: '#F472B6', bg: '#FDF2F8' },
  { name: 'Entertainment & Subscriptions', icon: 'Film', color: '#818CF8', bg: '#EEF2FF' },
  { name: 'Healthcare', icon: 'HeartPulse', color: '#34D399', bg: '#ECFDF5' },
  { name: 'Education & Books', icon: 'BookOpen', color: '#60A5FA', bg: '#EFF6FF' },
  { name: 'Travel & Vacation', icon: 'Plane', color: '#FB923C', bg: '#FFF7ED' },
  { name: 'Other Expense', icon: 'MoreHorizontal', color: '#94A3B8', bg: '#F8FAFC' }
];

export const INCOME_CATEGORIES = [
  { name: 'Salary', icon: 'Wallet', color: '#10B981', bg: '#ECFDF5' },
  { name: 'Freelance / Projects', icon: 'Laptop', color: '#06B6D4', bg: '#ECFEFF' },
  { name: 'Investments & Dividends', icon: 'TrendingUp', color: '#8B5CF6', bg: '#F5F3FF' },
  { name: 'Gifts & Rewards', icon: 'Gift', color: '#EC4899', bg: '#FDF2F8' },
  { name: 'Rental Income', icon: 'Building2', color: '#14B8A6', bg: '#F0FDFA' },
  { name: 'Other Income', icon: 'CircleDollarSign', color: '#84CC16', bg: '#F7FEE7' }
];

export const PAYMENT_METHODS = [
  'UPI',
  'Credit Card',
  'Debit Card',
  'Cash',
  'Net Banking'
];

export const TAGS = ['Personal', 'Work', 'Family', 'Travel', 'Bills', 'Commute', 'Social'];

export function getCategoryMeta(name, isExpense = true) {
  const pool = isExpense ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const match = pool.find(c => c.name.toLowerCase() === (name || '').toLowerCase());
  if (match) return match;
  
  // Fallback check in all
  const fallback = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].find(c => 
    c.name.toLowerCase().includes((name || '').toLowerCase()) || (name || '').toLowerCase().includes(c.name.toLowerCase())
  );
  if (fallback) return fallback;

  return isExpense ? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1] : INCOME_CATEGORIES[INCOME_CATEGORIES.length - 1];
}

// Indian Rupee Currency Formatter
export function formatINR(val) {
  if (val === undefined || val === null || isNaN(val)) return '₹0';
  const num = Math.round(Math.abs(val));
  const s = num.toString();
  let out = s;
  if (s.length > 3) {
    let rest = s.substring(0, s.length - 3);
    const last3 = s.substring(s.length - 3);
    const parts = [];
    while (rest.length > 2) {
      parts.unshift(rest.substring(rest.length - 2));
      rest = rest.substring(0, rest.length - 2);
    }
    if (rest.length > 0) parts.unshift(rest);
    out = `${parts.join(',')},${last3}`;
  }
  return `${val < 0 ? '-' : ''}₹${out}`;
}

export function formatDate(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  const now = new Date();
  
  const isToday = d.getDate() === now.getDate() &&
                  d.getMonth() === now.getMonth() &&
                  d.getFullYear() === now.getFullYear();
                  
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.getDate() === yesterday.getDate() &&
                      d.getMonth() === yesterday.getMonth() &&
                      d.getFullYear() === yesterday.getFullYear();
                      
  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateTime(dateInput) {
  const datePart = formatDate(dateInput);
  const d = new Date(dateInput);
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${datePart} at ${hours}:${minutes} ${ampm}`;
}

export function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// Default Seed Data
function getAgo(days, hours = 14, mins = 30) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hours, mins, 0, 0);
  return d.toISOString();
}

export const DEFAULT_TRANSACTIONS = [
  {
    id: '1',
    name: 'Salary Credit',
    category: 'Salary',
    amount: 45000,
    isExpense: false,
    date: getAgo(12, 10, 0),
    paymentMethod: 'Net Banking',
    note: 'Monthly salary credited from Acme Corp',
    tag: 'Work'
  },
  {
    id: '2',
    name: 'Apartment Rent',
    category: 'Bills & Utilities',
    amount: 9500,
    isExpense: true,
    date: getAgo(11, 11, 15),
    paymentMethod: 'UPI',
    note: 'Monthly apartment rent transfer',
    tag: 'Bills'
  },
  {
    id: '3',
    name: 'Grocery Mart',
    category: 'Groceries',
    amount: 2450,
    isExpense: true,
    date: getAgo(9, 18, 45),
    paymentMethod: 'Debit Card',
    note: 'Weekly essentials and pantry restock',
    tag: 'Personal'
  },
  {
    id: '4',
    name: 'Italian Bistro',
    category: 'Food & Dining',
    amount: 850,
    isExpense: true,
    date: getAgo(7, 20, 30),
    paymentMethod: 'UPI',
    note: 'Dinner with friends',
    tag: 'Social'
  },
  {
    id: '5',
    name: 'Freelance UI Design',
    category: 'Freelance / Projects',
    amount: 7500,
    isExpense: false,
    date: getAgo(5, 16, 20),
    paymentMethod: 'UPI',
    note: 'Mobile app design deliverables milestone 1',
    tag: 'Work'
  },
  {
    id: '6',
    name: 'Metro Smart Card',
    category: 'Transport & Fuel',
    amount: 500,
    isExpense: true,
    date: getAgo(4, 9, 10),
    paymentMethod: 'UPI',
    note: 'Metro card monthly recharge',
    tag: 'Commute'
  },
  {
    id: '7',
    name: 'Cafe Aroma',
    category: 'Food & Dining',
    amount: 340,
    isExpense: true,
    date: getAgo(2, 15, 40),
    paymentMethod: 'Credit Card',
    note: 'Espresso and brownie',
    tag: 'Personal'
  },
  {
    id: '8',
    name: 'Spotify Premium',
    category: 'Entertainment & Subscriptions',
    amount: 149,
    isExpense: true,
    date: getAgo(1, 12, 0),
    paymentMethod: 'Credit Card',
    note: 'Family subscription renewal',
    tag: 'Bills'
  },
  {
    id: '9',
    name: 'Swiggy Gourmet',
    category: 'Food & Dining',
    amount: 480,
    isExpense: true,
    date: getAgo(0, 13, 20),
    paymentMethod: 'UPI',
    note: 'Lunch bowl delivery',
    tag: 'Personal'
  }
];

export const DEFAULT_BUDGETS = {
  'Food & Dining': 6000,
  'Groceries': 5000,
  'Shopping & Tech': 4000,
  'Bills & Utilities': 12000,
  'Transport & Fuel': 2500,
  'Entertainment & Subscriptions': 1500
};

export const DEFAULT_ALERTS = [
  {
    id: 'alert_1',
    title: 'Duplicate charge detected',
    description: 'Cafe Aroma charged ₹340 twice within 3 minutes on Saturday.',
    actionLabel: 'Draft Dispute',
    iconType: 'copy',
    color: '#F59E0B',
    isResolved: false
  },
  {
    id: 'alert_2',
    title: 'Subscription price increased',
    description: 'Your music streaming plan increased by 25% from ₹119 to ₹149.',
    actionLabel: 'Review Plan',
    iconType: 'trending-up',
    color: '#FF6584',
    isResolved: false
  },
  {
    id: 'alert_3',
    title: 'Trial expiring soon',
    description: 'Cloud storage free trial ends in 48 hours. Auto-renews at ₹399/mo.',
    actionLabel: 'Cancel Reminder',
    iconType: 'timer',
    color: '#38BDF8',
    isResolved: false
  }
];

export const DEFAULT_GOALS = [
  {
    id: 'goal_1',
    title: 'Goa Summer Trip',
    targetAmount: 20000,
    savedAmount: 13600,
    iconEmoji: '🏖️'
  },
  {
    id: 'goal_2',
    title: 'Emergency Fund',
    targetAmount: 50000,
    savedAmount: 32000,
    iconEmoji: '🛡️'
  }
];

export const DEFAULT_FORECAST = [
  { day: 'Mon', risk: 25, reason: 'Quiet spending day, low temptation.' },
  { day: 'Tue', risk: 45, reason: 'Grocery restock scheduled.' },
  { day: 'Wed', risk: 30, reason: 'Normal weekday routine.' },
  { day: 'Thu', risk: 60, reason: 'Online shopping sale alerts detected.' },
  { day: 'Fri', risk: 85, reason: 'Weekend dining out and entertainment surge expected.' },
  { day: 'Sat', risk: 90, reason: 'High social spending risk day.' },
  { day: 'Sun', risk: 40, reason: 'Relaxed recovery day.' }
];

export const DEFAULT_INFLATION = [
  { name: 'Dining & Cafes', icon: 'Utensils', official: 5.2, personal: 12.5 },
  { name: 'Groceries', icon: 'ShoppingCart', official: 4.8, personal: 7.1 },
  { name: 'Subscriptions', icon: 'Tv', official: 2.0, personal: 15.0 },
  { name: 'Transport', icon: 'Car', official: 6.0, personal: 8.4 },
  { name: 'Utilities', icon: 'Zap', official: 3.5, personal: 4.2 }
];

export const storageService = {
  get(key, fallback = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Storage error:', e);
      // If quota exceeded, attempt to trim heavy screenshots from older transactions to prevent data loss
      if ((e.name === 'QuotaExceededError' || e.code === 22) && Array.isArray(value)) {
        try {
          const trimmed = value.map((item, index) => {
            // keep screenshot on the latest 5 transactions, prune older heavy base64
            if (index > 4 && item && item.screenshot) {
              return { ...item, screenshot: null };
            }
            return item;
          });
          localStorage.setItem(key, JSON.stringify(trimmed));
        } catch (innerErr) {
          console.error('Secondary storage error on trimmed set:', innerErr);
        }
      }
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {}
  },

  getUserData(email, key, fallback = null) {
    if (!email) return fallback;
    const cleanEmail = email.toLowerCase().trim();
    const userKey = `ww_user_${cleanEmail}_${key}`;
    const data = this.get(userKey, null);
    if (data !== null) return data;

    // Only for saved demo email jazaaa34@gmail.com (or legacy aysha@example.com) in name Aysha,
    // seed with the full pre-populated details!
    if (cleanEmail === 'jazaaa34@gmail.com' || cleanEmail === 'aysha@example.com') {
      if (key === 'transactions') {
        const legacy = this.get(STORAGE_KEYS.TRANSACTIONS, DEFAULT_TRANSACTIONS);
        this.set(userKey, legacy);
        return legacy;
      }
      if (key === 'budgets') {
        const legacy = this.get(STORAGE_KEYS.BUDGETS, DEFAULT_BUDGETS);
        this.set(userKey, legacy);
        return legacy;
      }
      if (key === 'alerts') {
        const legacy = this.get(STORAGE_KEYS.ALERTS, DEFAULT_ALERTS);
        this.set(userKey, legacy);
        return legacy;
      }
      if (key === 'goals') {
        const legacy = this.get(STORAGE_KEYS.GOALS, DEFAULT_GOALS);
        this.set(userKey, legacy);
        return legacy;
      }
      if (key === 'saved_amount') {
        const legacy = this.get(STORAGE_KEYS.SAVED_AMOUNT, 3400);
        this.set(userKey, legacy);
        return legacy;
      }
      return fallback;
    }

    // For any other email ID logging in:
    // It must be clean! No details should be there, user enters everything manually!
    return fallback;
  },

  setUserData(email, key, value) {
    if (!email) return;
    const cleanEmail = email.toLowerCase().trim();
    const userKey = `ww_user_${cleanEmail}_${key}`;
    this.set(userKey, value);
  },

  initStorage() {
    const users = this.get(STORAGE_KEYS.REGISTERED_USERS, {});
    // Ensure jazaaa34@gmail.com exists with name Aysha
    if (!users['jazaaa34@gmail.com']) {
      users['jazaaa34@gmail.com'] = {
        name: 'Aysha',
        password: 'password123'
      };
      this.set(STORAGE_KEYS.REGISTERED_USERS, users);
    }
    if (!users['aysha@example.com']) {
      users['aysha@example.com'] = {
        name: 'Aysha',
        password: 'password123'
      };
      this.set(STORAGE_KEYS.REGISTERED_USERS, users);
    }

    // Pre-populate demo user data for jazaaa34@gmail.com
    if (this.get('ww_user_jazaaa34@gmail.com_transactions') === null) {
      this.set('ww_user_jazaaa34@gmail.com_transactions', DEFAULT_TRANSACTIONS);
    }
    if (this.get('ww_user_jazaaa34@gmail.com_budgets') === null) {
      this.set('ww_user_jazaaa34@gmail.com_budgets', DEFAULT_BUDGETS);
    }
    if (this.get('ww_user_jazaaa34@gmail.com_alerts') === null) {
      this.set('ww_user_jazaaa34@gmail.com_alerts', DEFAULT_ALERTS);
    }
    if (this.get('ww_user_jazaaa34@gmail.com_goals') === null) {
      this.set('ww_user_jazaaa34@gmail.com_goals', DEFAULT_GOALS);
    }
    if (this.get('ww_user_jazaaa34@gmail.com_saved_amount') === null) {
      this.set('ww_user_jazaaa34@gmail.com_saved_amount', 3400);
    }

    const currentModel = this.get(STORAGE_KEYS.GROQ_MODEL);
    if (currentModel && (currentModel.includes('3.3') || currentModel.includes('3.1-70b') || currentModel === 'llama-3.3-70b-versatile')) {
      this.remove(STORAGE_KEYS.GROQ_MODEL);
    }
  }
};
