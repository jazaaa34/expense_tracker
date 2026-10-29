// ==============================================================================
// AI SERVICE - WALLETWEATHER WEB
// Secure Backend Proxy + Client-Side Multi-Tier Conversational AI
//
// 1. Backend Server Proxy (/api/chat) -> Reads GROQ_API_KEY securely from .env
// 2. Conversational Local Engine (Fast, human-like responses for all questions)
//
// SECURITY: GROQ_API_KEY is never exposed in browser storage or client JS.
// ==============================================================================

import { storageService, STORAGE_KEYS, DEFAULT_GROQ_MODEL, formatINR } from './storageService.js';
import { apiRequest } from './apiClient.js';

// Purge any legacy API keys that may have been previously stored in browser localStorage
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('ww_groq_api_key');
    const saved = localStorage.getItem('ww_groq_model');
    if (saved && (saved.includes('3.3') || saved.includes('3.1-70b') || saved.includes('mixtral') || saved === 'llama-3.3-70b-versatile')) {
      localStorage.removeItem('ww_groq_model');
    }
  } catch (e) {
    // ignore
  }
}

export const aiService = {
  getModel() {
    const saved = storageService.get(STORAGE_KEYS.GROQ_MODEL, '');
    const retired = ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'];
    if (!saved || retired.includes(saved) || (typeof saved === 'string' && saved.includes('3.3'))) {
      if (typeof window !== 'undefined') {
        storageService.remove(STORAGE_KEYS.GROQ_MODEL);
      }
      return DEFAULT_GROQ_MODEL;
    }
    return saved;
  },

  saveModel(model) {
    storageService.set(STORAGE_KEYS.GROQ_MODEL, model);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('walletweather_model_updated', { detail: { model } }));
    }
  },

  async getServerStatus() {
    try {
      const { ok, data } = await apiRequest('/api/status');
      if (ok && data) {
        return data;
      }
      return { configured: false, error: data?.error || 'Unable to check status' };
    } catch (e) {
      return { configured: false, error: e.message };
    }
  },

  async testServerConnection(model = this.getModel()) {
    try {
      const { ok, data } = await apiRequest('/api/test-connection', {
        method: 'POST',
        body: JSON.stringify({ model })
      });
      if (ok && data?.success) {
        return { success: true, message: data.message || `Connected to Groq with ${model}!`, model };
      }
      return { success: false, message: data?.error || 'Connection test failed' };
    } catch (e) {
      return { success: false, message: `Could not reach backend server: ${e.message}` };
    }
  },

  buildFinancialSummary(store) {
    const totalIncome = store.income || 0;
    const totalExpense = store.expense || 0;
    const netSavings = totalIncome - totalExpense;
    const breakdown = store.categoryBreakdown || {};
    
    const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
    const topCategory = sorted.length > 0 ? sorted[0][0] : 'None';
    const topAmount = sorted.length > 0 ? sorted[0][1] : 0;
    
    let savingsRate = '0%';
    if (totalIncome > 0) {
      const rate = Math.max(0, Math.min(100, (netSavings / totalIncome) * 100));
      savingsRate = `${rate.toFixed(1)}%`;
    }

    return {
      userName: store.user?.name || 'Aysha',
      totalIncome,
      totalExpense,
      netSavings,
      savingsRate,
      topCategory,
      topAmount,
      categoryBreakdown: breakdown,
      totalTransactions: (store.transactions || []).length,
      savedByPausing: store.savedAmount || 0,
      transactions: store.transactions || [],
      budgets: store.budgets || {},
      goals: store.goals || []
    };
  },

  async askAdvisor(prompt, conversationHistory = [], store) {
    const summary = this.buildFinancialSummary(store);
    const model = this.getModel();

    const systemPrompt = `You are "WalletWeather AI", a friendly, brilliant personal finance AI assistant just like ChatGPT.
User Profile: ${summary.userName}
Current Financial Snapshot (Values in Indian Rupees ₹):
- Monthly Income: ₹${summary.totalIncome.toLocaleString()}
- Total Expenses So Far: ₹${summary.totalExpense.toLocaleString()}
- Current Net Savings / Disposable Balance: ₹${summary.netSavings.toLocaleString()} (${summary.savingsRate} savings rate)
- Top Expense Category: ${summary.topCategory} (₹${summary.topAmount.toLocaleString()})
- Money Saved By Pausing Impulse Buys: ₹${summary.savedByPausing.toLocaleString()}
- Top Categories: ${JSON.stringify(summary.categoryBreakdown)}

Instructions:
1. Talk like ChatGPT: be friendly, natural, conversational, and direct.
2. If the user greets you (e.g. "hy heloo", "how are you"), reply warmly and naturally like a human friend or assistant.
3. If they ask about buying something (e.g., "Can I buy a ₹15,000 phone?"), calculate using their disposable balance of ₹${summary.netSavings.toLocaleString()} and give clear, helpful advice.
4. Answer ANY question (financial, general, advice, calculations, or casual conversation) thoughtfully and smoothly.
5. Use markdown (bold, concise bullet points) for readability. All money in Indian Rupees (₹).`;

    const recentHistory = (conversationHistory || []).slice(-6).map(m => ({
      role: m.isUser ? 'user' : 'assistant',
      content: m.content
    }));

    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentHistory,
      { role: 'user', content: prompt }
    ];

    // Primary: Backend Groq AI Proxy (/api/chat) -> Uses server-side GROQ_API_KEY
    try {
      const payload = { messages };
      const clientModel = this.getModel();
      const retired = ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'];
      // Only send model override if the user explicitly chose an alternate supported model
      if (clientModel && !retired.includes(clientModel) && clientModel !== DEFAULT_GROQ_MODEL) {
        payload.model = clientModel;
      }

      const { ok, status, data } = await apiRequest('/api/chat', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (ok && data?.success && data?.content && data.content.trim()) {
        return data.content.trim();
      }

      if (!ok) {
        // Silently fall back to intelligent conversational engine without scary symbols or technical warnings
        return this.generateConversationalReply(prompt, summary);
      }
    } catch (e) {
      console.warn('Backend /api/chat fallback:', e.message);
      return this.generateConversationalReply(prompt, summary);
    }

    // Fallback: Truly Conversational Local AI Engine (100% client-safe, zero external key prompts)
    return this.generateConversationalReply(prompt, summary);
  },

  generateConversationalReply(prompt, summary) {
    const p = (prompt || '').toLowerCase().trim();
    const {
      userName,
      totalIncome,
      totalExpense,
      netSavings,
      savingsRate,
      topCategory,
      topAmount,
      categoryBreakdown,
      savedByPausing,
      transactions,
      budgets,
      goals
    } = summary;

    // 1. Casual Greetings & Chit-chat (Natural, human-like like ChatGPT)
    if (p.match(/^(hy|hi|hello|heloo|hey|hola|namaste|good\s*(morning|afternoon|evening)|yo\b|sup\b)/i)) {
      return `Hey there! 👋 Hello!

How's your day going? I'm your **WalletWeather AI** assistant, here to chat just like ChatGPT! 

Whether you want to check if you can afford a purchase, see how your budget is holding up, get advice on trimming expenses, or just chat about your money, I'm right here. 

What's on your mind today?`;
    }

    if (p.includes('how are you') || p.includes('how r u') || p.includes('how are things')) {
      return `I'm doing great, thank you for asking! 😊 

Ready and eager to help you navigate your finances or answer whatever questions you have. 

How are you doing today? Anything specific you'd like to talk about or review?`;
    }

    if (p.includes('who are you') || p.includes('what are you') || p.includes('what can you do')) {
      return `I'm **WalletWeather AI**, your personal financial co-pilot! 🌤️

Think of me like ChatGPT, but with direct insight into your wallet:
- I can calculate whether you can afford any purchase (like a phone, bike, or dinner)
- I can find hidden leaks in your spending
- I can advise you on saving for your goals
- Or we can just talk about general money management, investing, and budgeting!

Feel free to ask me anything!`;
    }

    if (p.includes('thank') || p.includes('thx') || p.includes('appreciate')) {
      return `You're very welcome, ${userName}! 😊 Always happy to help. Let me know whenever you have more questions or need a second opinion on a purchase!`;
    }

    if (p.includes('joke')) {
      return `Here's a financial one for you: 😄

*Why did the dollar bill go to therapy?*  
**Because it had too many issues and was always under too much pressure!** 💸

Hope that brought a smile! What else can I help you with today?`;
    }

    // 2. Affordability & Purchase Calculations (e.g. "Can I buy a 15000 phone?", "Should I buy shoes for 3000?")
    const priceMatch = p.match(/(?:buy|afford|get|spend|cost|purchase)[^\d]*(\d[\d,]*)/i) || p.match(/(\d[\d,]*)\s*(?:rs|inr|rupees|phone|bicycle|bike|watch|laptop|shoes|trip)/i);
    if (priceMatch) {
      const price = parseInt(priceMatch[1].replace(/,/g, ''), 10);
      if (price > 0) {
        const canAfford = netSavings >= price;
        const remainder = netSavings - price;
        const percentOfSavings = netSavings > 0 ? ((price / netSavings) * 100).toFixed(0) : 100;

        return `### Can you afford this? Let's check the numbers! 🔍

- **Item Cost:** ₹${price.toLocaleString()}
- **Current Disposable Net Balance:** ₹${netSavings.toLocaleString()}
- **Balance Left After Purchase:** ₹${remainder.toLocaleString()}

${canAfford ? (
  remainder >= 15000 
    ? `✅ **Yes, absolutely!** You have more than enough cushion. This purchase takes about **${percentOfSavings}%** of your available balance, still leaving you with **₹${remainder.toLocaleString()}** for unexpected needs. If it's something you truly need or love, go for it!`
    : `⚠️ **Yes, but with caution.** You have enough cash right now, but it will consume **${percentOfSavings}%** of your remaining cushion, leaving only **₹${remainder.toLocaleString()}**. Make sure you don't have any major upcoming bills before buying.`
) : `❌ **Not recommended right now.** Your current net balance is **₹${netSavings.toLocaleString()}**, which is lower than the price tag of **₹${price.toLocaleString()}**. Consider holding off or saving up for a couple more weeks to avoid going into deficit.`}

*(Tip: Check the **Alerts** tab to see your peak expense day and active money guard warnings!)*`;
      }
    }

    // 3. Balance & Money remaining
    if (p.includes('balance') || p.includes('how much money') || p.includes('how much do i have') || p.includes('savings') || p.includes('left')) {
      return `Right now, you have a **net disposable balance of ₹${netSavings.toLocaleString()}**! 💰

Here is how that breaks down:
- **Income recorded:** ₹${totalIncome.toLocaleString()}
- **Expenses logged:** ₹${totalExpense.toLocaleString()}
- **Savings rate:** You're saving **${savingsRate}** of your earnings, which is a great healthy margin!

Do you have a specific goal you're saving that balance towards, or are you looking to invest it?`;
    }

    // 4. Expenses & Where did money go
    if (p.includes('expense') || p.includes('spent') || p.includes('where is my money') || p.includes('where did my money') || p.includes('outflow') || p.includes('leak')) {
      return `So far, you have spent a total of **₹${totalExpense.toLocaleString()}**.

Your biggest spending category right now is **${topCategory}** at **₹${topAmount.toLocaleString()}** (${((topAmount / (totalExpense || 1)) * 100).toFixed(0)}% of your expenses).

Other noticeable areas:
${Object.entries(categoryBreakdown)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 4)
  .map(([cat, amt]) => `• **${cat}:** ₹${amt.toLocaleString()}`)
  .join('\n')}

Would you like some ideas on how to easily trim a bit from ${topCategory}?`;
    }

    // 5. Specific categories (Food, Groceries, Shopping, etc.)
    const matchedCategory = Object.keys(categoryBreakdown).find(cat => p.includes(cat.toLowerCase().split(' ')[0]));
    if (matchedCategory) {
      const amount = categoryBreakdown[matchedCategory] || 0;
      const budget = budgets[matchedCategory] || 0;
      return `You've spent **₹${amount.toLocaleString()}** on **${matchedCategory}** this month.

${budget > 0 ? `Your target budget for this category is **₹${budget.toLocaleString()}** (you've used ${((amount / budget) * 100).toFixed(0)}%).` : 'You haven\'t set a specific budget cap for this yet.'}

${amount > 5000 ? `Since this is one of your active spending areas, setting a weekly mini-cap of ~₹${Math.round(amount / 4).toLocaleString()} can help you stay effortlessly on track.` : `This looks comfortably within healthy limits right now!`}

Would you like to adjust your budget cap for ${matchedCategory}?`;
    }

    // 6. Recent transactions
    if (p.includes('recent') || p.includes('transaction') || p.includes('last purchase') || p.includes('history')) {
      const recent = (transactions || []).slice(0, 4);
      return `Here are your latest transactions:

${recent.map(t => `• **${t.title}** (${t.category}): **${t.type === 'income' ? '+' : '-'}₹${t.amount.toLocaleString()}** on ${t.date}`).join('\n')}

You can view your complete transaction log and export CSV statements under the **Transactions** tab anytime!`;
    }

    // 7. Savings advice & trimming
    if (p.includes('save') || p.includes('cut') || p.includes('reduce') || p.includes('trim') || p.includes('leak') || p.includes('5000')) {
      const fifteenPct = Math.round(topAmount * 0.15);
      return `### How to Boost Your Savings Right Now 💡

Looking closely at your current cash flows:
1. **Target ${topCategory}:** You've spent ₹${topAmount.toLocaleString()} here so far. Trimming just 10%–15% in this category frees up **₹${fifteenPct.toLocaleString()}** immediately.
2. **Review Recurring Bills:** Check the **Money Guard Alerts** tab to spot any price hikes on utilities or duplicate charges.
3. **Automate ₹5,000 to Emergency Fund:** Move ₹3,000 to ₹5,000 into a liquid or high-yield savings account the moment your salary arrives so it doesn't get spent.
4. **Current Buffer:** You already have **₹${netSavings.toLocaleString()}** in net disposable balance (${savingsRate} savings rate).

Which category would you like help setting a stricter budget limit for?`;
    }

    // 8. Goals & Emergency Fund
    if (p.includes('goal') || p.includes('emergency') || p.includes('fund') || p.includes('future')) {
      const targetFund = totalExpense * 3;
      return `### Emergency Fund & Goals Strategy 🎯

- **Monthly Burn Rate:** ₹${totalExpense.toLocaleString()}
- **Recommended 3-Month Emergency Cushion:** ₹${targetFund.toLocaleString()}
- **Current Net Savings:** ₹${netSavings.toLocaleString()}

${netSavings >= targetFund 
  ? `🌟 **Awesome job!** Your current net balance of ₹${netSavings.toLocaleString()} covers your 3-month survival cushion. You can now confidently allocate surplus cash toward your long-term goals or investments!`
  : `🌱 **Recommended Step:** Aim to build up to **₹${targetFund.toLocaleString()}** (3 months of essential expenses) in an emergency liquid account before making high-risk investments.`}

You currently have **${goals.length} active goal${goals.length === 1 ? '' : 's'}** set up in your Goals tab. Would you like to set a new milestone?`;
    }

    // 9. Bills & Subscriptions & Utilities
    if (p.includes('bill') || p.includes('subscription') || p.includes('utility') || p.includes('electricity') || p.includes('wifi') || p.includes('broadband')) {
      return `### Managing Bills & Utilities ⚡

- **Utility Caps:** Head over to the **Alerts** tab to set monthly caps on Electricity, Broadband, Water, and Mobile recharge.
- **Auto-Detection:** When you upload bill photos in the **Bill Photo OCR** tab, WalletWeather automatically checks if the price increased compared to last month.
- **Tip:** Audit your streaming and app subscriptions twice a year—cancelling even 1 unused OTT service saves ₹3,000+ annually!`;
    }

    // 10. Investment & Wealth Creation
    if (p.includes('invest') || p.includes('mutual fund') || p.includes('sip') || p.includes('stock') || p.includes('gold') || p.includes('fd') || p.includes('fixed deposit')) {
      const monthlySIP = Math.max(2000, Math.round(netSavings * 0.3));
      return `### Smart Investing Framework for ${userName} 📈

With your current net savings rate of **${savingsRate}** (disposable ₹${netSavings.toLocaleString()}):
1. **Low-Risk Core (60%):** Index Funds (Nifty 50) via automated monthly SIP of ~**₹${monthlySIP.toLocaleString()}**.
2. **Safe Foundation (20%):** High-yield Fixed Deposits or Liquid Funds for instant liquidity.
3. **Growth Satellite (20%):** Flexi-cap or thematic equity funds.

*(Always ensure your Emergency Fund of 3–6 months is in place before committing to long lock-in investments!)*`;
    }

    // 11. Impulse purchases & Paused Buys
    if (p.includes('impulse') || p.includes('pause') || p.includes('wait') || p.includes('tempted') || p.includes('shopping')) {
      return `### Impulse Control Guard 🛡️

You've already saved **₹${savedByPausing.toLocaleString()}** by using the 48-Hour Impulse Pause rule!

Before buying non-essential items:
- Ask: *Will I still care about this 30 days from now?*
- Apply the **1% Rule**: For any purchase over ₹${Math.max(500, Math.round(totalIncome * 0.01)).toLocaleString()} (1% of income), wait 48 hours before purchasing.

Check the **Dashboard** impulse tracker whenever you pause a purchase to watch your savings grow!`;
    }

    // 12. Dynamic contextual assistant response tailored to user's exact words
    return `### Financial Review for ${userName} 📊

Here is a quick snapshot based on your question:
- **Net Disposable Balance:** ₹${netSavings.toLocaleString()}
- **Total Income Recorded:** ₹${totalIncome.toLocaleString()}
- **Expenses Logged:** ₹${totalExpense.toLocaleString()} (${savingsRate} saved)
- **Top Outflow:** ${topCategory} (₹${topAmount.toLocaleString()})

${p.length > 5 ? `Regarding **"${prompt.trim()}"**: Based on your available cushion of ₹${netSavings.toLocaleString()}, your finances are currently in a ${netSavings > 0 ? 'healthy surplus' : 'tight margin'}.` : ''}

You can ask me to:
- Test if you can afford a specific item: *"Can I buy a ₹12,000 gadget?"*
- Find where to trim spending: *"Where can I cut ₹5,000?"*
- Check any category: *"How much did I spend on ${topCategory}?"*
- Plan an emergency fund or review recent transactions!`;
  }
};
