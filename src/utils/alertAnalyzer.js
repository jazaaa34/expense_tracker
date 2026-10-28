// ==============================================================================
// ALERT ANALYZER UTILITY - WALLETWEATHER WEB
// Detects duplicates (including imported statement txns) & constant payment increases
// ==============================================================================

import { formatINR } from '../services/storageService';

/**
 * Normalizes a payee name for resilient duplicate and recurring matching
 */
export function cleanPayeeName(name = '') {
  return String(name)
    .toLowerCase()
    .replace(/^(upi\/|dr\/|cr\/|pay to|paid to|sent to|transfer to|to )/i, '')
    .replace(/(pvt ltd|ltd|limited|llp|store|shop|online)$/i, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Common recurring billing keywords (utilities, telecom, subscriptions, rent, gym, etc.)
 */
export const RECURRING_KEYWORDS = [
  'rent', 'bescom', 'electricity', 'power', 'water', 'gas', 'cylinder', 
  'broadband', 'wifi', 'internet', 'airtel', 'jio', 'vi', 'vodafone', 
  'act fibernet', 'actfibernet', 'tata sky', 'tata play', 'dish tv',
  'netflix', 'spotify', 'prime', 'amazon prime', 'hotstar', 'disney',
  'youtube', 'gym', 'fitness', 'cult', 'milk', 'newspaper', 'maintenance', 
  'society', 'tuition', 'school', 'insurance', 'lic', 'emi', 'sip', 
  'icloud', 'google one', 'google storage', 'apple'
];

/**
 * Identifies duplicate transactions across transactions, especially those from import
 */
export function detectDuplicatesInTransactions(transactions = []) {
  if (!Array.isArray(transactions) || transactions.length < 2) return [];

  const duplicates = [];
  const visitedPairs = new Set();
  const duplicateTxnIds = new Set();

  for (let i = 0; i < transactions.length; i++) {
    const t1 = transactions[i];
    if (!t1 || !t1.id) continue;

    for (let j = i + 1; j < transactions.length; j++) {
      const t2 = transactions[j];
      if (!t2 || !t2.id || t1.id === t2.id) continue;

      const pairKey = [String(t1.id), String(t2.id)].sort().join('__');
      if (visitedPairs.has(pairKey)) continue;

      let isDup = false;
      let reason = '';
      let confidence = 'normal';

      // 1. UPI Reference ID (UTR / RRN) match
      const ref1 = String(t1.refId || '').trim().toLowerCase();
      const ref2 = String(t2.refId || '').trim().toLowerCase();
      if (ref1 && ref2 && ref1 === ref2) {
        isDup = true;
        confidence = 'exact';
        reason = `Identical UPI Reference UTR #${t1.refId}`;
      } else if (
        Math.abs(Number(t1.amount || 0) - Number(t2.amount || 0)) < 0.01 && 
        Boolean(t1.isExpense) === Boolean(t2.isExpense) &&
        Number(t1.amount || 0) > 0
      ) {
        // 2. Same amount + payee similarity + dates within 48 hours
        const c1 = cleanPayeeName(t1.name || t1.merchant);
        const c2 = cleanPayeeName(t2.name || t2.merchant);

        const isSamePayee = c1 && c2 && (
          c1 === c2 || 
          (c1.length >= 4 && c2.includes(c1)) || 
          (c2.length >= 4 && c1.includes(c2))
        );

        if (isSamePayee) {
          const d1 = new Date(t1.date || 0).getTime();
          const d2 = new Date(t2.date || 0).getTime();
          const diffHours = Math.abs(d1 - d2) / (1000 * 3600);

          if (diffHours <= 48) {
            isDup = true;
            confidence = 'high';
            const hoursRounded = Math.round(diffHours);
            reason = hoursRounded === 0 
              ? 'Recorded on the same date with identical amount' 
              : `Recorded within ${hoursRounded} hours with identical amount`;
          }
        }
      }

      if (isDup) {
        visitedPairs.add(pairKey);

        // Determine which transaction was imported or recorded second
        const isT1Import = t1.source === 'import' || Boolean(t1.refId);
        const isT2Import = t2.source === 'import' || Boolean(t2.refId);
        
        let duplicateTxn = t2;
        let originalTxn = t1;

        if (isT2Import && !isT1Import) {
          duplicateTxn = t2;
          originalTxn = t1;
        } else if (isT1Import && !isT2Import) {
          duplicateTxn = t1;
          originalTxn = t2;
        } else {
          // Compare dates or timestamps
          const time1 = new Date(t1.createdAt || t1.date || 0).getTime();
          const time2 = new Date(t2.createdAt || t2.date || 0).getTime();
          if (time2 >= time1) {
            duplicateTxn = t2;
            originalTxn = t1;
          } else {
            duplicateTxn = t1;
            originalTxn = t2;
          }
        }

        duplicateTxnIds.add(String(duplicateTxn.id));

        const formattedAmt = formatINR(duplicateTxn.amount || 0);
        const dateStr = duplicateTxn.date ? new Date(duplicateTxn.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'recently';

        duplicates.push({
          id: `dup_${originalTxn.id}_${duplicateTxn.id}`,
          type: 'duplicate',
          title: 'Duplicate Transaction Detected',
          description: `"${duplicateTxn.name}" of ${formattedAmt} appears to be recorded twice (${reason}).`,
          actionLabel: 'Review Duplicate',
          iconType: 'copy',
          color: '#EF4444',
          isResolved: false,
          confidence,
          isImported: isT1Import || isT2Import,
          originalTxn,
          duplicateTxn,
          txnId: duplicateTxn.id,
          duplicateWithId: originalTxn.id,
          amount: Number(duplicateTxn.amount || 0),
          refId: duplicateTxn.refId || originalTxn.refId || null,
          merchant: duplicateTxn.name || duplicateTxn.merchant,
          dateStr
        });
      }
    }
  }

  return duplicates;
}

/**
 * Detects price increases for constant/recurring payments (utilities, subscriptions, rent, etc.)
 */
export function detectPriceIncreasesInTransactions(transactions = []) {
  if (!Array.isArray(transactions) || transactions.length < 2) return [];

  const expenseTxns = transactions.filter(t => t && t.isExpense && Number(t.amount || 0) > 0);
  const groups = new Map();

  for (const t of expenseTxns) {
    const rawName = String(t.name || t.merchant || '').trim();
    const cleanKey = cleanPayeeName(rawName) || rawName.toLowerCase();
    if (!cleanKey) continue;

    if (!groups.has(cleanKey)) {
      groups.set(cleanKey, {
        payee: rawName,
        category: t.category,
        isMonthly: Boolean(t.isMonthly),
        items: []
      });
    }
    const g = groups.get(cleanKey);
    if (t.isMonthly) g.isMonthly = true;
    g.items.push(t);
  }

  const increases = [];

  for (const [key, group] of groups.entries()) {
    const items = group.items;
    
    // Check if this payee is a constant/recurring payment
    const isKeyword = RECURRING_KEYWORDS.some(kw => key.includes(kw.replace(/[^a-z0-9]/g, '')));
    const isCategory = [
      'Bills & Utilities', 
      'Subscription', 
      'Rent', 
      'Insurance', 
      'Education', 
      'Fitness', 
      'Utilities',
      'Broadband',
      'Telecom',
      'Health'
    ].includes(group.category);

    const hasMultiplePayments = items.length >= 2;
    const isConstantPayment = group.isMonthly || isKeyword || isCategory || hasMultiplePayments;

    if (!isConstantPayment || items.length < 2) continue;

    // Sort chronologically ascending (oldest first)
    items.sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());

    const latest = items[items.length - 1];
    const previous = items[items.length - 2];

    const prevAmt = Number(previous.amount || 0);
    const latestAmt = Number(latest.amount || 0);

    // Check if price increased
    if (latestAmt > prevAmt && prevAmt > 0) {
      const diff = latestAmt - prevAmt;
      const percent = Math.round((diff / prevAmt) * 100);

      // Flag if increase is noticeable (>= ₹5 or >= 1%)
      if (diff >= 5 || percent >= 1) {
        const prevDateStr = previous.date ? new Date(previous.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'previous';
        const latestDateStr = latest.date ? new Date(latest.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'latest';

        increases.push({
          id: `hike_${key}_${latest.id}`,
          type: 'price_increase',
          title: `Payment Increase: ${group.payee}`,
          description: `Constant payment to ${group.payee} increased by ${formatINR(diff)} (${percent}%) from ${formatINR(prevAmt)} (${prevDateStr}) to ${formatINR(latestAmt)} (${latestDateStr}).`,
          actionLabel: 'Review Hike',
          iconType: 'trending-up',
          color: '#F59E0B',
          isResolved: false,
          merchant: group.payee,
          category: group.category || 'Bills & Utilities',
          previousAmount: prevAmt,
          previousDate: previous.date,
          latestAmount: latestAmt,
          latestDate: latest.date,
          diffAmount: diff,
          percentIncrease: percent,
          txnId: latest.id,
          previousTxnId: previous.id,
          isImported: latest.source === 'import' || previous.source === 'import'
        });
      }
    }
  }

  // Sort increases by highest difference first
  increases.sort((a, b) => b.diffAmount - a.diffAmount);
  return increases;
}

/**
 * Combines existing alerts with freshly analyzed duplicates and constant price increases
 */
export function buildUnifiedAlerts(transactions = [], existingAlerts = []) {
  const duplicates = detectDuplicatesInTransactions(transactions);
  const hikes = detectPriceIncreasesInTransactions(transactions);

  const existingMap = new Map();
  for (const a of existingAlerts) {
    if (a && a.id) {
      existingMap.set(String(a.id), a);
    }
  }

  // Preserve user-resolved status if alert ID was already resolved
  const processedDuplicates = duplicates.map(d => {
    const existing = existingMap.get(String(d.id));
    if (existing && existing.isResolved) {
      return { ...d, isResolved: true };
    }
    return d;
  });

  const processedHikes = hikes.map(h => {
    const existing = existingMap.get(String(h.id));
    if (existing && existing.isResolved) {
      return { ...h, isResolved: true };
    }
    return h;
  });

  // Keep other custom/system alerts that aren't dynamic duplicates or hikes
  const dynamicIds = new Set([
    ...processedDuplicates.map(d => String(d.id)),
    ...processedHikes.map(h => String(h.id))
  ]);

  const otherAlerts = existingAlerts.filter(a => a && !dynamicIds.has(String(a.id)));

  return {
    duplicates: processedDuplicates,
    hikes: processedHikes,
    allAlerts: [...processedDuplicates, ...processedHikes, ...otherAlerts]
  };
}
