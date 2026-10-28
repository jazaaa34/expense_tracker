// Prototype GPay statement & receipt parser
import { cleanAmount, parseDateFlexible, extractUpiDetails, classifyTransaction } from '../lib/statementParser.js';

export function parseGPayStatement(text) {
  if (!text || typeof text !== 'string') return [];

  const cleanText = text
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, '\n')
    .replace(/--\s*page\s*\d+\s*--/gi, '\n');

  const lines = cleanText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const transactions = [];

  // 1. Identify transaction chunk boundaries
  // Boundaries in GPay can be:
  // - "Paid to", "Payment to", "Received from", "Payment from"
  // - Or UPI transaction ID line
  // - Or line with currency symbol ₹ / INR / Rs
  const chunks = [];
  let currentChunk = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this line starts a new transaction block
    const isNewTxnStart = (
      /^(?:paid\s*to|payment\s*to|received\s*from|payment\s*from)\b/i.test(line) ||
      /^google\s*pay\b/i.test(line)
    );

    if (isNewTxnStart && currentChunk.length > 0) {
      // Check if current chunk already contains an amount
      const hasAmount = currentChunk.some(l => /(?:₹|INR|Rs\.?)\s*[0-9]+|(?:^|[+\-\s])(?:₹|INR|Rs\.?)\s*[0-9,.]+/i.test(l));
      if (hasAmount) {
        chunks.push(currentChunk);
        currentChunk = [];
      }
    }

    currentChunk.push(line);

    // If chunk has reached end of a transaction (e.g. UPI transaction ID or Bank info) and already contains an amount
    const isEndMarker = /^(?:UPI\s*(?:transaction\s*id|ref|reference|id)|Google\s*transaction\s*id|From:|Debited\s*from|Credited\s*to)/i.test(line);
    const hasAmount = currentChunk.some(l => /(?:₹|INR|Rs\.?)\s*[0-9]+|(?:^|[+\-\s])(?:₹|INR|Rs\.?)\s*[0-9,.]+/i.test(l));

    if (isEndMarker && hasAmount) {
      chunks.push(currentChunk);
      currentChunk = [];
    } else if (i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      if (/^(?:paid\s*to|payment\s*to|received\s*from|payment\s*from)\b/i.test(nextLine) && hasAmount) {
        chunks.push(currentChunk);
        currentChunk = [];
      }
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  // Parse each chunk
  for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
    const chunk = chunks[cIdx];
    const chunkText = chunk.join(' \n ');

    // Extract Amount (specifically avoiding times like 1:15 pm, 4:30 pm)
    // In GPay, amount has ₹ or INR or Rs or is a standalone positive/negative number with decimals
    let amount = 0;
    let isDebit = true; // default expense

    // Check +/- sign or Paid/Received
    if (/received\s*from|payment\s*from|\+\s*₹|\+₹|credited\s*to/i.test(chunkText)) {
      isDebit = false;
    }

    const amtMatch = chunkText.match(/(?:[+\-]?\s*(?:₹|INR|Rs\.?)\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?))|(?:(?:₹|INR|Rs\.?)\s*([0-9,.]+))/i);
    if (amtMatch) {
      amount = cleanAmount(amtMatch[1] || amtMatch[2]);
    } else {
      // Look for standalone decimal numbers that are NOT times
      for (const line of chunk) {
        if (/:\d{2}\s*(?:am|pm)/i.test(line)) continue; // skip time
        const m = line.match(/(?:^|\s)(?:-|\+)?\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{2})|[0-9]+\.[0-9]{2})(?:\s|$)/);
        if (m) {
          const val = cleanAmount(m[1]);
          if (val > 0 && val !== 2024 && val !== 2025 && val !== 2026) {
            amount = val;
            break;
          }
        }
      }
    }

    if (amount <= 0) continue; // Skip if no valid payment amount

    // Extract Payee / Merchant Name
    let payeeName = '';
    for (let i = 0; i < chunk.length; i++) {
      const l = chunk[i];
      if (/^paid\s*to\s*(.+)$/i.test(l)) {
        payeeName = l.replace(/^paid\s*to\s*/i, '').trim();
        break;
      }
      if (/^payment\s*to\s*(.+)$/i.test(l)) {
        payeeName = l.replace(/^payment\s*to\s*/i, '').trim();
        break;
      }
      if (/^received\s*from\s*(.+)$/i.test(l)) {
        payeeName = l.replace(/^received\s*from\s*/i, '').trim();
        break;
      }
      if (/^payment\s*from\s*(.+)$/i.test(l)) {
        payeeName = l.replace(/^payment\s*from\s*/i, '').trim();
        break;
      }
      if (/^(?:paid\s*to|payment\s*to|received\s*from|payment\s*from)$/i.test(l)) {
        // Name is on the next line!
        if (i + 1 < chunk.length) {
          payeeName = chunk[i + 1].trim();
          break;
        }
      }
      if (/^to:\s*(.+)$/i.test(l)) {
        payeeName = l.replace(/^to:\s*/i, '').trim();
        break;
      }
    }

    // Fallback payee name if not prefixed with "Paid to"
    if (!payeeName) {
      for (const l of chunk) {
        if (
          !/^google\s*pay/i.test(l) &&
          !/^transaction\s*history/i.test(l) &&
          !/^completed/i.test(l) &&
          !/^upi\s*transaction\s*id/i.test(l) &&
          !/^google\s*transaction\s*id/i.test(l) &&
          !/^from:/i.test(l) &&
          !/(?:₹|INR|Rs\.?)/i.test(l) &&
          !/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(l) &&
          l.length >= 2 && l.length <= 40
        ) {
          payeeName = l;
          break;
        }
      }
    }

    if (!payeeName) payeeName = isDebit ? 'Google Pay Expense' : 'Google Pay Payment';

    // Extract Date
    let dateStr = '';
    const dateMatch = chunkText.match(/\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(?:,?\s+\d{2,4})?|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,?\s+\d{2,4})?|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/i);
    if (dateMatch) {
      dateStr = dateMatch[0];
      // If year is missing (e.g. "25 Oct" or "25 Oct, 1:15 pm"), append current year
      if (!/\d{4}/.test(dateStr)) {
        dateStr = `${dateStr} ${new Date().getFullYear()}`;
      }
    }

    const isoDate = parseDateFlexible(dateStr);

    // Extract UPI Reference ID (12-digit UTR)
    const upiMatch = chunkText.match(/(?:UPI\s*(?:transaction\s*id|ref\s*no|ref|reference\s*id)?[:\s\-]+)([0-9]{12})\b/i) ||
                     chunkText.match(/\b([0-9]{12})\b/);
    const refId = upiMatch ? upiMatch[1] : null;

    // Extract VPA
    const vpaMatch = chunkText.match(/([a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64})/i);
    const vpa = vpaMatch ? vpaMatch[1] : null;

    const classification = classifyTransaction(payeeName, isDebit ? amount : 0, !isDebit ? amount : 0);

    transactions.push({
      tempId: `import_${Date.now()}_gpay_${cIdx}_${Math.random().toString(36).substring(2, 6)}`,
      date: isoDate,
      name: payeeName,
      rawDescription: `Google Pay: ${payeeName} ${refId ? `UPI:${refId}` : ''}`,
      amount,
      isExpense: isDebit,
      type: classification.type,
      category: classification.suggestedCategory,
      paymentMethod: 'UPI',
      refId,
      merchant: payeeName,
      vpa,
      isUpi: true,
      needsReview: classification.confidence !== 'high',
      selected: true
    });
  }

  return transactions;
}

// -----------------------------------------------------------------------------
// TEST WITH REAL GPAY FORMATS
// -----------------------------------------------------------------------------
const gpayReceipt = `Google Pay
Paid to
Swiggy
₹340.00
Completed
25 Oct 2026, 1:15 pm
UPI transaction ID: 430192837492
Google transaction ID: CICAgICAgICA
From: State Bank of India •••• 1234`;

const gpayHistory = `Google Pay
Transaction History

Paid to Zomato
₹450.00
24 Oct 2026, 8:45 pm
Completed
UPI ref: 430192837493

Received from Ramesh Kumar
₹1,500.00
23 Oct 2026, 11:20 am
Completed
UPI ref: 430192837494`;

const gpayFormat3 = `Google Pay
Swiggy
Paid • 25 Oct, 1:15 pm
- ₹340.00
UPI transaction ID: 430192837492

Bescom Electricity
Paid • 20 Oct, 10:00 am
- ₹1,450.00
UPI transaction ID: 430192837495`;

console.log('Testing GPay Receipt:');
const t1 = parseGPayStatement(gpayReceipt);
console.log('T1:', t1.length, t1[0]);

console.log('\nTesting GPay History:');
const t2 = parseGPayStatement(gpayHistory);
console.log('T2:', t2.length, t2);

console.log('\nTesting GPay Format 3 (Minus sign and abbreviated date):');
const t3 = parseGPayStatement(gpayFormat3);
console.log('T3:', t3.length, t3);
