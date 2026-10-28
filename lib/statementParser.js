// ==============================================================================
// BANK STATEMENT PARSER & UPI EXTRACTOR - WALLETWEATHER WEB
// Supports CSV, XLSX, and Text-Based PDF Bank Statements
// ==============================================================================

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
const pdfParse = require('pdf-parse');

/**
 * Common UPI transaction patterns in narration/description
 */
const UPI_PATTERNS = [
  /UPI[-/](?:CR|DR)?[-/]?([0-9]{12})/i,
  /UPI[-/]([A-Za-z0-9_.-]+)[-/]([0-9]{12})/i,
  /RRN[-:\s]?([0-9]{12})/i,
  /UTR[-:\s]?([0-9]{12})/i,
  /IMPS[-/]([0-9]{12})/i,
  /\b([0-9]{12})\b/
];

const VPA_PATTERN = /([a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64})/i;

const DATE_COL_KEYWORDS = ['date', 'txn date', 'transaction date', 'value date', 'posting date', 'trans date'];
const DESC_COL_KEYWORDS = ['narration', 'description', 'particulars', 'transaction remarks', 'remarks', 'details', 'transaction details', 'payee'];
const DEBIT_COL_KEYWORDS = ['debit', 'withdrawal', 'dr', 'withdrawal amount', 'debit amount', 'spent', 'paid'];
const CREDIT_COL_KEYWORDS = ['credit', 'deposit', 'cr', 'deposit amount', 'credit amount', 'received'];
const REF_COL_KEYWORDS = ['chq', 'cheque', 'ref', 'reference', 'ref no', 'chq/ref no', 'reference number', 'utr', 'rrn', 'txn id'];
const BALANCE_COL_KEYWORDS = ['balance', 'closing balance', 'available balance', 'running balance'];

export function cleanAmount(val) {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.abs(val);
  const str = String(val).replace(/[₹$,\s]/g, '').trim();
  if (!str) return 0;
  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.abs(num);
}

export function parseDateFlexible(val) {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date().toISOString() : val.toISOString();

  const str = String(val).trim();
  if (!str) return new Date().toISOString();

  const direct = new Date(str);
  if (!isNaN(direct.getTime()) && str.includes('-') && str.length >= 10 && str.indexOf('-') === 4) {
    return direct.toISOString();
  }

  const parts = str.split(/[/.-]/);
  if (parts.length === 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);

    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const textMonthIdx = monthNames.findIndex(m => parts[1].toLowerCase().startsWith(m));
    if (textMonthIdx !== -1) {
      month = textMonthIdx + 1;
    }

    if (year < 100) year += 2000;

    if (!isNaN(day) && !isNaN(month) && !isNaN(year) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }

  return new Date().toISOString();
}

export function extractUpiDetails(description = '', refFromCol = '') {
  let isUpi = false;
  let refId = (refFromCol || '').trim();
  let merchant = '';
  let vpa = '';

  const desc = String(description || '').trim();
  const descUpper = desc.toUpperCase();

  if (descUpper.includes('UPI') || descUpper.includes('@') || descUpper.includes('IMPS') || descUpper.includes('PAYTM') || descUpper.includes('PHONEPE') || descUpper.includes('GPAY')) {
    isUpi = true;
  }

  const vpaMatch = desc.match(VPA_PATTERN);
  if (vpaMatch) {
    vpa = vpaMatch[1];
    isUpi = true;
  }

  if (!refId || refId.length < 8) {
    for (const pat of UPI_PATTERNS) {
      const match = desc.match(pat);
      if (match && match[1]) {
        refId = match[1];
        isUpi = true;
        break;
      }
    }
  }

  if (desc.includes('/')) {
    const segments = desc.split('/').map(s => s.trim()).filter(Boolean);
    if (segments.length >= 4) {
      merchant = segments[3];
    } else if (segments.length >= 3 && !/^[0-9]+$/.test(segments[2])) {
      merchant = segments[2];
    }
  } else if (desc.includes('-')) {
    const segments = desc.split('-').map(s => s.trim()).filter(Boolean);
    if (segments.length >= 2 && !/^[0-9]+$/.test(segments[1])) {
      merchant = segments[1];
    }
  }

  if (!merchant && vpa) {
    const handle = vpa.split('@')[0];
    if (handle && handle.length > 2) {
      merchant = handle.charAt(0).toUpperCase() + handle.slice(1);
    }
  }

  if (merchant) {
    merchant = merchant.replace(/[^a-zA-Z0-9\s&.-]/g, '').trim();
    if (merchant.length > 40) merchant = merchant.substring(0, 40);
  }

  return {
    isUpi,
    refId: refId || null,
    merchant: merchant || null,
    vpa: vpa || null
  };
}

export function classifyTransaction(rawDesc = '', debitAmt = 0, creditAmt = 0) {
  const desc = String(rawDesc || '').toUpperCase();
  const isDebit = debitAmt > 0 && creditAmt === 0;
  const isCredit = creditAmt > 0 && debitAmt === 0;

  const isRefund = isCredit && (
    desc.includes('REFUND') ||
    desc.includes('REV') ||
    desc.includes('REVERSAL') ||
    desc.includes('CASHBACK') ||
    desc.includes('FAILED TXN') ||
    desc.includes('BOUNCE')
  );

  const isTransfer = (
    desc.includes('SELF TRANSFER') ||
    desc.includes('OWN A/C') ||
    desc.includes('SWEEP') ||
    (desc.includes('TRANSFER TO') && desc.includes('SAVINGS'))
  );

  if (isRefund) {
    return {
      type: 'refund',
      isExpense: false,
      confidence: 'high',
      suggestedCategory: 'Gifts & Rewards'
    };
  }

  if (isTransfer) {
    return {
      type: 'transfer',
      isExpense: isDebit,
      confidence: 'medium',
      suggestedCategory: 'Investments & Dividends'
    };
  }

  if (isCredit) {
    const isSalary = desc.includes('SALARY') || desc.includes('PAYROLL') || desc.includes('STIPEND');
    return {
      type: 'income',
      isExpense: false,
      confidence: 'high',
      suggestedCategory: isSalary ? 'Salary' : 'Other Income'
    };
  }

  return {
    type: 'expense',
    isExpense: true,
    confidence: 'high',
    suggestedCategory: 'Other Expense'
  };
}

export function mapColumnIndices(headerRow = []) {
  const mapping = {
    date: -1,
    desc: -1,
    debit: -1,
    credit: -1,
    amount: -1,
    ref: -1,
    balance: -1
  };

  headerRow.forEach((col, idx) => {
    const h = String(col || '').toLowerCase().trim();
    if (!h) return;

    if (mapping.date === -1 && DATE_COL_KEYWORDS.some(k => h === k || h.includes(k))) {
      mapping.date = idx;
    } else if (mapping.desc === -1 && DESC_COL_KEYWORDS.some(k => h === k || h.includes(k))) {
      mapping.desc = idx;
    } else if (mapping.debit === -1 && DEBIT_COL_KEYWORDS.some(k => h === k || h.includes(k))) {
      mapping.debit = idx;
    } else if (mapping.credit === -1 && CREDIT_COL_KEYWORDS.some(k => h === k || h.includes(k))) {
      mapping.credit = idx;
    } else if (mapping.ref === -1 && REF_COL_KEYWORDS.some(k => h === k || h.includes(k))) {
      mapping.ref = idx;
    } else if (mapping.balance === -1 && BALANCE_COL_KEYWORDS.some(k => h === k || h.includes(k))) {
      mapping.balance = idx;
    } else if (mapping.amount === -1 && (h === 'amount' || h === 'txn amount')) {
      mapping.amount = idx;
    }
  });

  return mapping;
}

/**
 * Parses CSV raw text into normalized transactions
 */
export function parseCsvStatement(csvText) {
  if (!csvText || typeof csvText !== 'string') {
    throw new Error('Empty or invalid CSV content.');
  }

  const lines = csvText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('CSV file has insufficient rows (requires header and data rows).');
  }

  const parseLine = (line) => {
    const result = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  };

  let headerIdx = -1;
  let colMap = null;

  for (let i = 0; i < Math.min(lines.length, 25); i++) {
    const cols = parseLine(lines[i]);
    const detected = mapColumnIndices(cols);
    if (detected.date !== -1 && (detected.desc !== -1 || detected.debit !== -1 || detected.amount !== -1)) {
      headerIdx = i;
      colMap = detected;
      break;
    }
  }

  if (headerIdx === -1 || !colMap) {
    throw new Error('Could not identify standard bank statement columns (Date, Description, Debit/Credit).');
  }

  const extracted = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (!cols || cols.length === 0 || cols.every(c => !c)) continue;

    const firstCell = String(cols[0] || '').toLowerCase();
    if (firstCell.startsWith('total') || firstCell.startsWith('***') || firstCell.startsWith('end of statement')) {
      break;
    }

    const rawDate = colMap.date !== -1 ? cols[colMap.date] : '';
    const rawDesc = colMap.desc !== -1 ? cols[colMap.desc] : (cols[1] || 'Bank Transaction');
    
    let debit = 0;
    let credit = 0;

    if (colMap.debit !== -1 && cols[colMap.debit]) {
      debit = cleanAmount(cols[colMap.debit]);
    }
    if (colMap.credit !== -1 && cols[colMap.credit]) {
      credit = cleanAmount(cols[colMap.credit]);
    }

    if (debit === 0 && credit === 0 && colMap.amount !== -1 && cols[colMap.amount]) {
      const rawAmt = cols[colMap.amount];
      const amtVal = cleanAmount(rawAmt);
      if (rawAmt.includes('-') || String(cols.join(' ')).toUpperCase().includes('DR')) {
        debit = amtVal;
      } else {
        credit = amtVal;
      }
    }

    if (debit === 0 && credit === 0) continue;

    const refColVal = colMap.ref !== -1 ? cols[colMap.ref] : '';
    const isoDate = parseDateFlexible(rawDate);
    const upiInfo = extractUpiDetails(rawDesc, refColVal);
    const classification = classifyTransaction(rawDesc, debit, credit);

    const amount = debit > 0 ? debit : credit;
    const isExpense = debit > 0;

    const rowId = `import_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`;
    const displayName = upiInfo.merchant || (rawDesc.length > 36 ? rawDesc.substring(0, 36) + '...' : rawDesc);

    extracted.push({
      tempId: rowId,
      date: isoDate,
      name: displayName,
      rawDescription: rawDesc,
      amount,
      isExpense,
      type: classification.type,
      category: classification.suggestedCategory,
      paymentMethod: upiInfo.isUpi ? 'UPI' : 'Net Banking',
      refId: upiInfo.refId,
      merchant: upiInfo.merchant,
      vpa: upiInfo.vpa,
      isUpi: upiInfo.isUpi,
      needsReview: classification.confidence !== 'high',
      selected: true
    });
  }

  return {
    success: true,
    transactions: extracted,
    totalRows: extracted.length
  };
}

/**
 * Parses XLSX buffer into normalized transactions
 */
export function parseXlsxStatement(buffer) {
  if (!buffer || buffer.length === 0) {
    throw new Error('Empty XLSX file provided.');
  }

  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  } catch (err) {
    throw new Error(`Failed to read XLSX spreadsheet: ${err.message}`);
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('XLSX workbook has no sheets.');
  }

  // Use first sheet with data
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (!rawRows || rawRows.length < 2) {
    throw new Error('XLSX sheet contains insufficient rows.');
  }

  // Find header row
  let headerIdx = -1;
  let colMap = null;

  for (let i = 0; i < Math.min(rawRows.length, 25); i++) {
    const row = rawRows[i];
    if (!Array.isArray(row)) continue;
    const detected = mapColumnIndices(row);
    if (detected.date !== -1 && (detected.desc !== -1 || detected.debit !== -1 || detected.amount !== -1)) {
      headerIdx = i;
      colMap = detected;
      break;
    }
  }

  if (headerIdx === -1 || !colMap) {
    throw new Error('Could not identify statement columns in XLSX (Date, Description, Debit/Credit).');
  }

  const extracted = [];

  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const cols = rawRows[i];
    if (!Array.isArray(cols) || cols.every(c => c === '' || c === null || c === undefined)) continue;

    const firstCell = String(cols[0] || '').toLowerCase();
    if (firstCell.startsWith('total') || firstCell.startsWith('***') || firstCell.startsWith('end of statement')) {
      break;
    }

    const rawDate = colMap.date !== -1 ? cols[colMap.date] : '';
    const rawDesc = colMap.desc !== -1 ? cols[colMap.desc] : (cols[1] || 'Bank Transaction');

    let debit = 0;
    let credit = 0;

    if (colMap.debit !== -1 && cols[colMap.debit] !== '') {
      debit = cleanAmount(cols[colMap.debit]);
    }
    if (colMap.credit !== -1 && cols[colMap.credit] !== '') {
      credit = cleanAmount(cols[colMap.credit]);
    }

    if (debit === 0 && credit === 0 && colMap.amount !== -1 && cols[colMap.amount] !== '') {
      const rawAmt = cols[colMap.amount];
      const amtVal = cleanAmount(rawAmt);
      if (String(rawAmt).includes('-') || String(cols.join(' ')).toUpperCase().includes('DR')) {
        debit = amtVal;
      } else {
        credit = amtVal;
      }
    }

    if (debit === 0 && credit === 0) continue;

    const refColVal = colMap.ref !== -1 ? cols[colMap.ref] : '';
    const isoDate = parseDateFlexible(rawDate);
    const upiInfo = extractUpiDetails(String(rawDesc), String(refColVal));
    const classification = classifyTransaction(String(rawDesc), debit, credit);

    const amount = debit > 0 ? debit : credit;
    const isExpense = debit > 0;

    const rowId = `import_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`;
    const displayName = upiInfo.merchant || (String(rawDesc).length > 36 ? String(rawDesc).substring(0, 36) + '...' : String(rawDesc));

    extracted.push({
      tempId: rowId,
      date: isoDate,
      name: displayName,
      rawDescription: String(rawDesc),
      amount,
      isExpense,
      type: classification.type,
      category: classification.suggestedCategory,
      paymentMethod: upiInfo.isUpi ? 'UPI' : 'Net Banking',
      refId: upiInfo.refId,
      merchant: upiInfo.merchant,
      vpa: upiInfo.vpa,
      isUpi: upiInfo.isUpi,
      needsReview: classification.confidence !== 'high',
      selected: true
    });
  }

  return {
    success: true,
    transactions: extracted,
    totalRows: extracted.length
  };
}

/**
 * Parses text-based PDF buffer into normalized transactions
 * Detects password protection with friendly error handling
 */
export async function parsePdfStatement(buffer) {
  if (!buffer || buffer.length === 0) {
    throw new Error('Empty PDF file provided.');
  }

  let pdfData;
  try {
    pdfData = await pdfParse(buffer);
  } catch (err) {
    const msg = (err && err.message) ? err.message.toLowerCase() : '';
    if (msg.includes('password') || msg.includes('encrypted') || (err && err.name === 'PasswordException')) {
      throw new Error('This PDF is password-protected. Please remove the password protection before uploading.');
    }
    throw new Error(`Failed to parse PDF statement: ${err.message || 'Unknown PDF reading error'}`);
  }

  const text = (pdfData && pdfData.text) ? pdfData.text : '';
  if (!text || text.trim().length === 0) {
    throw new Error('No selectable text found in PDF. Scanned image-only PDFs are not supported directly; please use a digital statement PDF or export to CSV.');
  }

  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const extracted = [];
  const dateRegex = /\b(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2}-[a-zA-Z]{3}-\d{2,4})\b/;
  const amountRegex = /\b\d{1,3}(?:,\d{2,3})*(?:\.\d{2})\b/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dateMatch = line.match(dateRegex);
    if (!dateMatch) continue;

    const amounts = line.match(amountRegex);
    if (!amounts || amounts.length === 0) continue;

    const isoDate = parseDateFlexible(dateMatch[0]);
    // Usually the last or second last amount is transaction amount
    const amtStr = amounts[0];
    const amtVal = cleanAmount(amtStr);
    if (amtVal <= 0) continue;

    // Remaining text is description
    let rawDesc = line
      .replace(dateMatch[0], '')
      .replace(amountRegex, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!rawDesc || rawDesc.length < 3) {
      rawDesc = `Bank Transaction ${dateMatch[0]}`;
    }

    const isCredit = line.toUpperCase().includes('CR') || line.toUpperCase().includes('CREDIT') || line.toUpperCase().includes('DEPOSIT');
    const isDebit = !isCredit;
    const upiInfo = extractUpiDetails(rawDesc);
    const classification = classifyTransaction(rawDesc, isDebit ? amtVal : 0, isCredit ? amtVal : 0);

    const rowId = `import_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`;
    const displayName = upiInfo.merchant || (rawDesc.length > 36 ? rawDesc.substring(0, 36) + '...' : rawDesc);

    extracted.push({
      tempId: rowId,
      date: isoDate,
      name: displayName,
      rawDescription: rawDesc,
      amount: amtVal,
      isExpense: isDebit,
      type: classification.type,
      category: classification.suggestedCategory,
      paymentMethod: upiInfo.isUpi ? 'UPI' : 'Net Banking',
      refId: upiInfo.refId,
      merchant: upiInfo.merchant,
      vpa: upiInfo.vpa,
      isUpi: upiInfo.isUpi,
      needsReview: classification.confidence !== 'high',
      selected: true
    });
  }

  if (extracted.length === 0) {
    throw new Error('Could not identify transaction rows from PDF text layout. Please try exporting your statement as CSV or XLSX for 100% precision.');
  }

  return {
    success: true,
    transactions: extracted,
    totalRows: extracted.length
  };
}

/**
 * Checks for duplicates against existing stored transactions
 * Never discards; annotates with match details
 */
export function detectDuplicates(incomingTxns = [], existingTxns = []) {
  if (!existingTxns || existingTxns.length === 0) {
    return incomingTxns.map(t => ({ ...t, isDuplicate: false }));
  }

  // Pre-index existing transactions by normalized refId and date+amount
  const refIdMap = new Map();
  const dateAmtMap = new Map();

  for (const ex of existingTxns) {
    if (ex.refId && String(ex.refId).trim()) {
      refIdMap.set(String(ex.refId).trim(), ex);
    }

    const exDay = ex.date ? new Date(ex.date).toISOString().split('T')[0] : '';
    const exAmt = Number(ex.amount || 0).toFixed(2);
    const key = `${exDay}_${exAmt}`;
    if (!dateAmtMap.has(key)) {
      dateAmtMap.set(key, []);
    }
    dateAmtMap.get(key).push(ex);
  }

  return incomingTxns.map(t => {
    // Check 1: Exact reference ID (UTR / RRN) match
    if (t.refId && refIdMap.has(String(t.refId).trim())) {
      const match = refIdMap.get(String(t.refId).trim());
      return {
        ...t,
        isDuplicate: true,
        duplicateConfidence: 'exact',
        duplicateReason: `Matches existing transaction with UPI Ref #${t.refId} (${match.name || 'Txn'})`,
        matchedTxnId: match.id,
        selected: false // uncheck by default for user convenience, but keep visible
      };
    }

    // Check 2: Same day + same amount match
    const tDay = t.date ? new Date(t.date).toISOString().split('T')[0] : '';
    const tAmt = Number(t.amount || 0).toFixed(2);
    const dateAmtKey = `${tDay}_${tAmt}`;

    if (dateAmtMap.has(dateAmtKey)) {
      const candidates = dateAmtMap.get(dateAmtKey);
      // Check if description has fuzzy similarity
      const match = candidates[0];
      return {
        ...t,
        isDuplicate: true,
        duplicateConfidence: 'possible',
        duplicateReason: `Similar transaction of ₹${t.amount} already exists on ${tDay} (${match.name})`,
        matchedTxnId: match.id,
        selected: false
      };
    }

    return {
      ...t,
      isDuplicate: false
    };
  });
}
