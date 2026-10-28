// Test script to verify duplicate and recurring payment increase detection
import assert from 'node:assert';

function cleanPayeeName(name = '') {
  return String(name)
    .toLowerCase()
    .replace(/^(upi\/|pay to|paid to|sent to|transfer to)/i, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function detectDuplicatesInTransactions(transactions) {
  const duplicates = [];
  const visitedPairs = new Set();

  for (let i = 0; i < transactions.length; i++) {
    const t1 = transactions[i];
    if (!t1 || !t1.id) continue;

    for (let j = i + 1; j < transactions.length; j++) {
      const t2 = transactions[j];
      if (!t2 || !t2.id || t1.id === t2.id) continue;

      const pairKey = [t1.id, t2.id].sort().join('__');
      if (visitedPairs.has(pairKey)) continue;

      let isDup = false;
      let reason = '';
      let confidence = 'normal';

      // 1. RefId match
      if (t1.refId && t2.refId && String(t1.refId).trim().toLowerCase() === String(t2.refId).trim().toLowerCase()) {
        isDup = true;
        confidence = 'exact';
        reason = `Identical UPI Reference ID / UTR #${t1.refId}`;
      } else if (Math.abs(Number(t1.amount) - Number(t2.amount)) < 0.01 && Boolean(t1.isExpense) === Boolean(t2.isExpense)) {
        // 2. Same amount + payee similarity + date within 48h
        const c1 = cleanPayeeName(t1.name || t1.merchant);
        const c2 = cleanPayeeName(t2.name || t2.merchant);

        const isSamePayee = c1 && c2 && (c1 === c2 || (c1.length >= 4 && c2.includes(c1)) || (c2.length >= 4 && c1.includes(c2)));
        if (isSamePayee) {
          const d1 = new Date(t1.date).getTime();
          const d2 = new Date(t2.date).getTime();
          const diffHours = Math.abs(d1 - d2) / (1000 * 3600);
          if (diffHours <= 48) {
            isDup = true;
            confidence = 'high';
            reason = `Same payee "${t1.name}" and amount (₹${t1.amount}) within ${Math.round(diffHours)}h`;
          }
        }
      }

      if (isDup) {
        visitedPairs.add(pairKey);
        // Identify which one is the imported or newer transaction
        const isT1Import = t1.source === 'import' || Boolean(t1.refId);
        const isT2Import = t2.source === 'import' || Boolean(t2.refId);
        const importedTxn = isT2Import ? t2 : (isT1Import ? t1 : t2);
        const originalTxn = importedTxn.id === t2.id ? t1 : t2;

        duplicates.push({
          id: `dup_${originalTxn.id}_${importedTxn.id}`,
          type: 'duplicate',
          title: 'Duplicate Transaction Detected',
          description: `"${importedTxn.name}" of ₹${importedTxn.amount} was recorded twice (${reason}).`,
          actionLabel: 'Review Duplicate',
          iconType: 'copy',
          color: '#EF4444',
          isResolved: false,
          isImported: isT1Import || isT2Import,
          originalTxn,
          duplicateTxn: importedTxn,
          amount: importedTxn.amount,
          refId: importedTxn.refId || originalTxn.refId || null,
          merchant: importedTxn.name || importedTxn.merchant
        });
      }
    }
  }

  return duplicates;
}

const RECURRING_KEYWORDS = [
  'rent', 'bescom', 'electricity', 'power', 'water', 'gas', 'cylinder', 
  'broadband', 'wifi', 'internet', 'airtel', 'jio', 'vi', 'vodafone', 
  'act fibernet', 'netflix', 'spotify', 'prime', 'amazon prime', 'hotstar', 
  'youtube', 'gym', 'milk', 'newspaper', 'maintenance', 'tuition', 'insurance', 
  'emi', 'sip', 'icloud', 'google one', 'apple'
];

function detectPriceIncreasesInTransactions(transactions) {
  const expenseTxns = transactions.filter(t => t && t.isExpense && Number(t.amount) > 0);
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
    // Check if recurring / constant payment
    const isKeyword = RECURRING_KEYWORDS.some(kw => key.includes(kw.replace(/[^a-z0-9]/g, '')));
    const isCategory = ['Bills & Utilities', 'Subscription', 'Rent', 'Insurance', 'Education', 'Fitness', 'Utilities'].includes(group.category);
    const hasMultipleDates = items.length >= 2;

    const isConstantPayment = group.isMonthly || isKeyword || isCategory || hasMultipleDates;
    if (!isConstantPayment || items.length < 2) continue;

    // Sort chronologically ascending
    items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const latest = items[items.length - 1];
    const previous = items[items.length - 2];

    const prevAmt = Number(previous.amount || 0);
    const latestAmt = Number(latest.amount || 0);

    if (latestAmt > prevAmt && prevAmt > 0) {
      const diff = latestAmt - prevAmt;
      const percent = Math.round((diff / prevAmt) * 100);

      // Only alert if there is a real price increase
      if (diff >= 5 || percent >= 1) {
        increases.push({
          id: `hike_${key}_${latest.id}`,
          type: 'price_increase',
          title: `Payment Increase: ${group.payee}`,
          description: `Constant payment to ${group.payee} increased by ₹${diff} (${percent}%) from ₹${prevAmt} to ₹${latestAmt}.`,
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
          isImported: latest.source === 'import' || previous.source === 'import'
        });
      }
    }
  }

  return increases;
}

// -----------------------------------------------------------------------------
// RUN TESTS
// -----------------------------------------------------------------------------
console.log('Testing Duplicate Detection:');
const sampleTxns = [
  { id: '1', name: 'Swiggy', amount: 340, isExpense: true, date: '2026-10-25T12:00:00Z', source: 'manual' },
  { id: '2', name: 'Swiggy', amount: 340, isExpense: true, date: '2026-10-25T12:05:00Z', source: 'import', refId: '430192837492' },
  { id: '3', name: 'Bescom Power', amount: 1200, isExpense: true, date: '2026-09-10T10:00:00Z', category: 'Bills & Utilities' },
  { id: '4', name: 'Bescom Power', amount: 1450, isExpense: true, date: '2026-10-10T10:00:00Z', category: 'Bills & Utilities', source: 'import' },
  { id: '5', name: 'Netflix', amount: 499, isExpense: true, isMonthly: true, date: '2026-09-01T00:00:00Z' },
  { id: '6', name: 'Netflix', amount: 649, isExpense: true, isMonthly: true, date: '2026-10-01T00:00:00Z', source: 'import' }
];

const dups = detectDuplicatesInTransactions(sampleTxns);
console.log('Detected duplicates:', dups.length);
assert.strictEqual(dups.length, 1, 'Should find 1 duplicate (Swiggy)');
assert.strictEqual(dups[0].merchant, 'Swiggy');
assert.strictEqual(dups[0].amount, 340);
assert.strictEqual(dups[0].isImported, true);
console.log('  Passed: Swiggy duplicate identified.\n');

console.log('Testing Price Increase Detection:');
const hikes = detectPriceIncreasesInTransactions(sampleTxns);
console.log('Detected hikes:', hikes.length);
assert.strictEqual(hikes.length, 2, 'Should find 2 price hikes (Bescom and Netflix)');
const bescomHike = hikes.find(h => h.merchant.includes('Bescom'));
assert.ok(bescomHike, 'Bescom hike found');
assert.strictEqual(bescomHike.diffAmount, 250);
assert.strictEqual(bescomHike.percentIncrease, 21);

const netflixHike = hikes.find(h => h.merchant.includes('Netflix'));
assert.ok(netflixHike, 'Netflix hike found');
assert.strictEqual(netflixHike.diffAmount, 150);
assert.strictEqual(netflixHike.percentIncrease, 30);
console.log('  Passed: Bescom (+₹250 / 21%) and Netflix (+₹150 / 30%) identified.\n');

console.log('ALL TESTS PASSED!');
