// ==============================================================================
// BANK STATEMENT PARSER & UPI EXTRACTOR - WALLETWEATHER WEB
// Supports CSV, XLSX, and Text-Based PDF Bank Statements
// ==============================================================================

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

let cachedPdfParse = null;
async function getPdfParseModule() {
  if (cachedPdfParse) return cachedPdfParse;
  try {
    cachedPdfParse = require('pdf-parse');
    return cachedPdfParse;
  } catch (err) {
    console.warn('[PDF Parser] Native module could not be loaded:', err.message);
    return null;
  }
}

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

/**
 * Detects whether a transaction is Debit (money sent by user / expense)
 * or Credit (money sent to user / income / deposit) with high precision.
 */
export function detectDebitOrCredit(rawText = '', debitVal = 0, creditVal = 0, amountVal = 0, rawAmountStr = '') {
  // 1. Explicit debit column
  if (debitVal > 0 && creditVal === 0) {
    return { isDebit: true, isCredit: false, amount: debitVal };
  }
  // 2. Explicit credit column
  if (creditVal > 0 && debitVal === 0) {
    return { isDebit: false, isCredit: true, amount: creditVal };
  }
  if (debitVal > 0 && creditVal > 0) {
    return { isDebit: true, isCredit: false, amount: debitVal };
  }

  const text = String(rawText || '').toUpperCase();
  const amtStr = String(rawAmountStr || '').trim();

  // Negative sign indicates money went out (debit)
  if (amtStr.startsWith('-') || amtStr.endsWith('-') || /^\(.*\)$/.test(amtStr)) {
    const val = amountVal > 0 ? amountVal : cleanAmount(amtStr);
    return { isDebit: true, isCredit: false, amount: val };
  }
  // Positive sign indicates money came in (credit)
  if (amtStr.startsWith('+')) {
    const val = amountVal > 0 ? amountVal : cleanAmount(amtStr);
    return { isDebit: false, isCredit: true, amount: val };
  }

  // UPI Specific Indicators
  // UPI/DR/ or UPI-DR- means DEBIT (I sent money)
  // UPI/CR/ or UPI-CR- means CREDIT (Someone sent money to me)
  if (/\bUPI[/-]DR[/-]/i.test(text) || /\/DR\//i.test(text) || /-DR-/i.test(text) || /\bDR\b/i.test(text) || /\bDEBIT\b/i.test(text)) {
    return { isDebit: true, isCredit: false, amount: amountVal };
  }
  if (/\bUPI[/-]CR[/-]/i.test(text) || /\/CR\//i.test(text) || /-CR-/i.test(text) || /\bCR\b/i.test(text) || /\bCREDIT\b/i.test(text)) {
    return { isDebit: false, isCredit: true, amount: amountVal };
  }

  // Credit / Inflow Keywords (Someone sent money to me)
  const creditKeywords = [
    /\bRECEIVED\s+FROM\b/i,
    /\bRECVD\s+FROM\b/i,
    /\bRCVD\s+FROM\b/i,
    /\bTRANSFER\s+FROM\b/i,
    /\bTRANSFERRED\s+FROM\b/i,
    /\bCREDITED\b/i,
    /\bDEPOSIT\b/i,
    /\bDEPOSITED\b/i,
    /\bSALARY\b/i,
    /\bPAYROLL\b/i,
    /\bSTIPEND\b/i,
    /\bREFUND\b/i,
    /\bREVERSAL\b/i,
    /\bCASHBACK\b/i,
    /\bINTEREST\s+CREDIT\b/i,
    /\bDIVIDEND\b/i
  ];
  if (creditKeywords.some(r => r.test(text))) {
    return { isDebit: false, isCredit: true, amount: amountVal };
  }

  // Debit / Outflow Keywords (I sent money to someone)
  const debitKeywords = [
    /\bPAID\s+TO\b/i,
    /\bPAY\s+TO\b/i,
    /\bPAYMENT\s+TO\b/i,
    /\bSENT\s+TO\b/i,
    /\bTRANSFER\s+TO\b/i,
    /\bTRANSFERRED\s+TO\b/i,
    /\bDEBITED\b/i,
    /\bWITHDRAWAL\b/i,
    /\bPURCHASE\b/i,
    /\bPOS\b/i,
    /\bATM\b/i,
    /\bBILL\s+PAYMENT\b/i,
    /\bRECHARGE\b/i
  ];
  if (debitKeywords.some(r => r.test(text))) {
    return { isDebit: true, isCredit: false, amount: amountVal };
  }

  // Default: In personal bank statements, standard row entries are debits (expenses)
  return { isDebit: true, isCredit: false, amount: amountVal };
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
    const isInvest = desc.includes('DIVIDEND') || desc.includes('INTEREST') || desc.includes('ZERODHA') || desc.includes('GROWW');
    const isFreelance = desc.includes('FREELANCE') || desc.includes('UPWORK') || desc.includes('FIVERR') || desc.includes('CLIENT');
    const isRent = desc.includes('RENT') || desc.includes('TENANT');

    let cat = 'Other Income';
    if (isSalary) cat = 'Salary';
    else if (isInvest) cat = 'Investments & Dividends';
    else if (isFreelance) cat = 'Freelance / Projects';
    else if (isRent) cat = 'Rental Income';

    return {
      type: 'income',
      isExpense: false,
      confidence: 'high',
      suggestedCategory: cat
    };
  }

  // Expense Categorization
  let cat = 'Other Expense';
  if (desc.includes('SWIGGY') || desc.includes('ZOMATO') || desc.includes('RESTAURANT') || desc.includes('CAFE') || desc.includes('MCDONALD') || desc.includes('KFC') || desc.includes('BURGER') || desc.includes('PIZZA') || desc.includes('STARBUCKS')) {
    cat = 'Food & Dining';
  } else if (desc.includes('ZEPTO') || desc.includes('BLINKIT') || desc.includes('INSTAMART') || desc.includes('BIGBASKET') || desc.includes('DMART') || desc.includes('GROCERY') || desc.includes('SUPERMARKET') || desc.includes('VEGETABLE') || desc.includes('MILK')) {
    cat = 'Groceries';
  } else if (desc.includes('UBER') || desc.includes('OLA') || desc.includes('RAPIDO') || desc.includes('METRO') || desc.includes('PETROL') || desc.includes('FUEL') || desc.includes('DIESEL') || desc.includes('INDIAN OIL') || desc.includes('BHARAT PETROL') || desc.includes('HPCL')) {
    cat = 'Transport & Fuel';
  } else if (desc.includes('BESCOM') || desc.includes('ELECTRIC') || desc.includes('POWER') || desc.includes('AIRTEL') || desc.includes('JIO') || desc.includes('VODAFONE') || desc.includes('ACT') || desc.includes('BROADBAND') || desc.includes('WIFI') || desc.includes('WATER') || desc.includes('GAS') || desc.includes('CYLINDER') || desc.includes('INDANE') || desc.includes('BILL')) {
    cat = 'Bills & Utilities';
  } else if (desc.includes('AMAZON') || desc.includes('FLIPKART') || desc.includes('MYNTRA') || desc.includes('ZARA') || desc.includes('AJIO') || desc.includes('SHOPPING') || desc.includes('MALL') || desc.includes('CROMA') || desc.includes('RELIANCE DIGITAL')) {
    cat = 'Shopping & Tech';
  } else if (desc.includes('NETFLIX') || desc.includes('SPOTIFY') || desc.includes('PRIME') || desc.includes('HOTSTAR') || desc.includes('YOUTUBE') || desc.includes('BOOKMYSHOW') || desc.includes('PVR') || desc.includes('INOX') || desc.includes('CINEMA')) {
    cat = 'Entertainment & Subscriptions';
  } else if (desc.includes('APOLLO') || desc.includes('PHARMEASY') || desc.includes('1MG') || desc.includes('HOSPITAL') || desc.includes('CLINIC') || desc.includes('PHARMACY') || desc.includes('MED') || desc.includes('DOCTOR')) {
    cat = 'Healthcare';
  } else if (desc.includes('UDEMY') || desc.includes('COURSERA') || desc.includes('BOOK') || desc.includes('SCHOOL') || desc.includes('COLLEGE') || desc.includes('TUITION')) {
    cat = 'Education & Books';
  } else if (desc.includes('MAKEMYTRIP') || desc.includes('CLEARTRIP') || desc.includes('INDIGO') || desc.includes('AIR INDIA') || desc.includes('IRCTC') || desc.includes('HOTEL') || desc.includes('AIRBNB') || desc.includes('FLIGHT') || desc.includes('TRAVEL')) {
    cat = 'Travel & Vacation';
  }

  return {
    type: 'expense',
    isExpense: true,
    confidence: cat !== 'Other Expense' ? 'high' : 'medium',
    suggestedCategory: cat
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

    const rawAmt = colMap.amount !== -1 ? cols[colMap.amount] : '';
    const detection = detectDebitOrCredit(
      `${rawDesc} ${cols.join(' ')}`,
      debit,
      credit,
      debit || credit || cleanAmount(rawAmt),
      rawAmt
    );

    if (detection.amount === 0) continue;

    const refColVal = colMap.ref !== -1 ? cols[colMap.ref] : '';
    const isoDate = parseDateFlexible(rawDate);
    const upiInfo = extractUpiDetails(rawDesc, refColVal);
    const amount = detection.amount;
    const isExpense = detection.isDebit;
    const classification = classifyTransaction(rawDesc, isExpense ? amount : 0, !isExpense ? amount : 0);

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

    const rawAmt = colMap.amount !== -1 ? cols[colMap.amount] : '';
    const detection = detectDebitOrCredit(
      `${rawDesc} ${cols.join(' ')}`,
      debit,
      credit,
      debit || credit || cleanAmount(rawAmt),
      rawAmt
    );

    if (detection.amount === 0) continue;

    const refColVal = colMap.ref !== -1 ? cols[colMap.ref] : '';
    const isoDate = parseDateFlexible(rawDate);
    const upiInfo = extractUpiDetails(String(rawDesc), String(refColVal));
    const amount = detection.amount;
    const isExpense = detection.isDebit;
    const classification = classifyTransaction(String(rawDesc), isExpense ? amount : 0, !isExpense ? amount : 0);

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

export async function extractRawTextFromPdf(buffer) {
  const pdfParse = await getPdfParseModule();
  if (!pdfParse) {
    throw new Error('PDF parsing library is unavailable in this environment. Please export as CSV or Excel.');
  }

  // 1. pdf-parse v2+ (PDFParse class)
  if (pdfParse && typeof pdfParse.PDFParse === 'function') {
    const parser = new pdfParse.PDFParse({ data: buffer });
    try {
      const res = await parser.getText();
      await parser.destroy().catch(() => {});
      if (res && typeof res.text === 'string') return res.text;
      if (res && Array.isArray(res.pages)) return res.pages.map(p => p.text || '').join('\n');
      return '';
    } catch (e) {
      await parser.destroy().catch(() => {});
      throw e;
    }
  }

  // 2. pdf-parse v1 (callable function)
  if (typeof pdfParse === 'function') {
    const res = await pdfParse(buffer);
    return res?.text || '';
  }

  // 3. Default export callable
  if (pdfParse && typeof pdfParse.default === 'function') {
    const res = await pdfParse.default(buffer);
    return res?.text || '';
  }

  throw new Error('PDF parsing module could not be initialized.');
}

const DATE_REGEX = /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(?:,?\s+\d{2,4})?|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,?\s+\d{2,4})?|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/i;
const AMOUNT_REGEX = /(?:Rs\.?|INR|₹)?\s*(-?\b\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?\b|-?\b\d+(?:\.\d{1,2})?\b|-?\b\d{1,3}(?:,\d{2,3})+\b)\s*(?:Dr|Cr|\(Dr\)|\(Cr\)|-|\+)?/gi;

/**
 * Specialized parser for Google Pay (GPay) receipts, exported transaction history, and UPI statements
 */
export function parseGPayStatement(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) return [];

  const isGPayOrBlockFormat = /(?:google\s*pay|gpay|paid\s*to|payment\s*to|received\s*from|payment\s*from|completed\s*•|upi\s*(?:transaction\s*id|ref\s*no|reference\s*id))/i.test(text);
  if (!isGPayOrBlockFormat) return [];

  const cleanText = text
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, '\n')
    .replace(/--\s*page\s*\d+\s*--/gi, '\n');

  const lines = cleanText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const transactions = [];
  const chunks = [];
  let currentChunk = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const isNewTxnStart = (
      /^(?:paid\s*to|payment\s*to|received\s*from|payment\s*from)\b/i.test(line) ||
      /^google\s*pay\b/i.test(line)
    );

    const hasAmount = currentChunk.some(l => /(?:₹|INR|Rs\.?)\s*[0-9]+|(?:^|[+\-\s])(?:₹|INR|Rs\.?)\s*[0-9,.]+/i.test(l));

    if (isNewTxnStart && currentChunk.length > 0 && hasAmount) {
      chunks.push(currentChunk);
      currentChunk = [];
    }

    currentChunk.push(line);

    // End markers: UPI ID, Google transaction ID, Bank info
    const isEndMarker = /^(?:UPI\s*(?:transaction\s*id|ref|reference|id)|Google\s*transaction\s*id|From:|Debited\s*from|Credited\s*to)/i.test(line);

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

  for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
    const chunk = chunks[cIdx];
    const chunkText = chunk.join(' \n ');

    let amount = 0;
    let isDebit = true;

    if (/received\s*from|payment\s*from|\+\s*₹|\+₹|credited\s*to/i.test(chunkText)) {
      isDebit = false;
    }

    // Strip time representations like 1:15 pm or 11:20 am to prevent time colliding with amounts
    const textWithoutTimes = chunkText.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?\b/gi, ' ');

    const amtMatch = textWithoutTimes.match(/(?:[+\-]?\s*(?:₹|INR|Rs\.?)\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?))|(?:(?:₹|INR|Rs\.?)\s*([0-9,.]+))/i);
    if (amtMatch) {
      amount = cleanAmount(amtMatch[1] || amtMatch[2]);
    } else {
      for (const line of chunk) {
        if (/:\d{2}\s*(?:am|pm)/i.test(line)) continue;
        const m = line.match(/(?:^|\s)(?:-|\+)?\s*(?:₹|INR|Rs\.?)?\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{2})|[0-9]+\.[0-9]{2})(?:\s|$)/);
        if (m) {
          const val = cleanAmount(m[1]);
          if (val > 0 && val !== 2024 && val !== 2025 && val !== 2026) {
            amount = val;
            break;
          }
        }
      }
    }

    if (amount <= 0) continue;

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

    if (!payeeName) {
      for (const l of chunk) {
        if (
          !/^google\s*pay/i.test(l) &&
          !/^transaction\s*history/i.test(l) &&
          !/^completed/i.test(l) &&
          !/^upi\s*(?:transaction\s*id|ref|id)/i.test(l) &&
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

    if (!payeeName) {
      const upiMeta = extractUpiDetails(chunkText);
      if (upiMeta.merchant) payeeName = upiMeta.merchant;
    }

    if (!payeeName) payeeName = isDebit ? 'Google Pay Expense' : 'Google Pay Payment';

    // Extract Date
    let dateStr = '';
    const dateMatch = chunkText.match(DATE_REGEX);
    if (dateMatch) {
      dateStr = dateMatch[0];
      if (!/\d{4}/.test(dateStr)) {
        dateStr = `${dateStr} ${new Date().getFullYear()}`;
      }
    }

    const isoDate = parseDateFlexible(dateStr);

    // Extract UPI Reference ID (12-digit UTR)
    const upiMatch = chunkText.match(/(?:UPI\s*(?:transaction\s*id|ref\s*no|ref|reference\s*id)?[:\s\-]+)([0-9]{12})\b/i) ||
                     chunkText.match(/\b([0-9]{12})\b/);
    const refId = upiMatch ? upiMatch[1] : null;

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

/**
 * Parses raw text extracted from PDF or plain text statements using multi-strategy fallback
 */
export function parseStatementTextMultiStrategy(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return [];
  }

  const cleanText = text
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, ' ')
    .replace(/--\s*page\s*\d+\s*--/gi, ' ');

  const lines = cleanText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => Boolean(l) && !/^--\s*\d+\s+of\s+\d+\s*--$/i.test(l) && !/^--\s*page\b/i.test(l));

  const isNoiseOrHeader = (desc = '') => {
    const d = String(desc || '').toUpperCase();
    const noisePhrases = [
      'STATEMENT GENERATED',
      'STATEMENT PERIOD',
      'ACCOUNT SUMMARY',
      'OPENING BALANCE',
      'CLOSING BALANCE',
      'AVAILABLE BALANCE',
      'TOTAL WITHDRAWAL',
      'TOTAL DEPOSIT',
      'CUSTOMER ID',
      'NOMINEE',
      'BRANCH ADDRESS',
      'IFSC CODE',
      'MICR CODE',
      'STATEMENT OF ACCOUNT'
    ];
    return noisePhrases.some(p => d.includes(p));
  };

  // ============================================================================
  // STRATEGY 0: Specialized GPay / UPI Receipt & Statement Parser
  // ============================================================================
  const stratGPay = parseGPayStatement(text);

  // ============================================================================
  // STRATEGY 1: Single-line row parser (Date + Narration + Amount on same line)
  // ============================================================================
  const strat1 = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dateMatch = line.match(DATE_REGEX);
    if (!dateMatch) continue;

    const lineWithoutDate = line.replace(dateMatch[0], ' ');
    // Strip time to avoid 1:15 pm becoming ₹1
    const lineWithoutTime = lineWithoutDate.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?\b/gi, ' ');
    const amtMatches = [...lineWithoutTime.matchAll(AMOUNT_REGEX)];
    const validAmounts = [];

    for (const m of amtMatches) {
      const raw = m[1] || m[0];
      const digitsOnly = raw.replace(/\D/g, '');
      if (digitsOnly.length >= 10) continue; // Skip 10+ digit account numbers or UTRs
      const cleaned = cleanAmount(raw);
      if (cleaned === 2026 || cleaned === 2025 || cleaned === 2024) continue; // Skip year
      if (cleaned > 0) validAmounts.push({ amt: cleaned, raw: m[0] });
    }

    if (validAmounts.length === 0) continue;

    const isoDate = parseDateFlexible(dateMatch[0]);
    const amtVal = validAmounts[0].amt;

    let rawDesc = lineWithoutTime;
    for (const v of validAmounts) {
      rawDesc = rawDesc.replace(v.raw, ' ');
    }
    rawDesc = rawDesc.replace(/\s+/g, ' ').trim();
    if (!rawDesc || rawDesc.length < 2) rawDesc = `Bank Transaction ${dateMatch[0]}`;
    if (isNoiseOrHeader(rawDesc)) continue;

    const detection = detectDebitOrCredit(line, 0, 0, amtVal, line);
    const isDebit = detection.isDebit;
    const isCredit = !isDebit;
    const upiInfo = extractUpiDetails(rawDesc);
    const classification = classifyTransaction(rawDesc, isDebit ? amtVal : 0, isCredit ? amtVal : 0);

    const rowId = `import_${Date.now()}_s1_${i}_${Math.random().toString(36).substring(2, 7)}`;
    const displayName = upiInfo.merchant || (rawDesc.length > 36 ? rawDesc.substring(0, 36) + '...' : rawDesc);

    strat1.push({
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

  // ============================================================================
  // STRATEGY 2: Multi-line / Stacked block chunking parser
  // (Handles statements where Date, Narration, UTR, and Amount are on separate lines)
  // ============================================================================
  const strat2 = [];
  const dateIndices = [];
  lines.forEach((l, idx) => {
    if (DATE_REGEX.test(l)) {
      dateIndices.push(idx);
    }
  });

  if (dateIndices.length > 0) {
    for (let i = 0; i < dateIndices.length; i++) {
      // Look 4 lines back and 8 lines forward to catch payees & amounts above/below date
      const dateIdx = dateIndices[i];
      const start = Math.max(0, dateIdx - 4);
      const end = (i + 1 < dateIndices.length) ? Math.min(dateIndices[i + 1], dateIdx + 8) : Math.min(dateIdx + 8, lines.length);
      const blockLines = lines.slice(start, end);
      const blockText = blockLines.join(' \n ');

      const dateMatch = blockText.match(DATE_REGEX);
      if (!dateMatch) continue;

      const blockWithoutDate = blockText.replace(dateMatch[0], ' ');
      // Strip times to prevent 1:15 pm becoming ₹1
      const blockWithoutTime = blockWithoutDate.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?\b/gi, ' ');
      const amtMatches = [...blockWithoutTime.matchAll(AMOUNT_REGEX)];
      const candidateAmounts = [];

      for (const m of amtMatches) {
        const raw = m[1] || m[0];
        const digitsOnly = raw.replace(/\D/g, '');
        if (digitsOnly.length >= 10) continue; // Skip 10+ digit UTR/account numbers
        const cleaned = cleanAmount(raw);
        if (cleaned === 2026 || cleaned === 2025 || cleaned === 2024) continue;
        if (cleaned > 0) candidateAmounts.push({ amt: cleaned, raw: m[0] });
      }

      if (candidateAmounts.length === 0) continue;

      const isoDate = parseDateFlexible(dateMatch[0]);
      const amtVal = candidateAmounts[0].amt;

      let rawDesc = blockWithoutTime;
      for (const v of candidateAmounts) {
        rawDesc = rawDesc.replace(v.raw, ' ');
      }
      rawDesc = rawDesc.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (!rawDesc || rawDesc.length < 2) rawDesc = `Bank Transaction ${dateMatch[0]}`;
      if (isNoiseOrHeader(rawDesc)) continue;

      const detection = detectDebitOrCredit(blockText, 0, 0, amtVal, blockText);
      const isDebit = detection.isDebit;
      const isCredit = !isDebit;
      const upiInfo = extractUpiDetails(rawDesc);
      const classification = classifyTransaction(rawDesc, isDebit ? amtVal : 0, isCredit ? amtVal : 0);

      const rowId = `import_${Date.now()}_s2_${i}_${Math.random().toString(36).substring(2, 7)}`;
      const displayName = upiInfo.merchant || (rawDesc.length > 36 ? rawDesc.substring(0, 36) + '...' : rawDesc);

      strat2.push({
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
  }

  // ============================================================================
  // STRATEGY 3: Continuous Stream Token Scanner (if all line breaks were stripped)
  // ============================================================================
  const strat3 = [];
  const streamRegex = /(?:(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2}))\s+([A-Za-z0-9_.\-/@\s]{4,60}?)\s+([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{2})|[0-9]+(?:\.[0-9]{2}))/gi;
  let match;
  let streamIdx = 0;
  while ((match = streamRegex.exec(text)) !== null) {
    const rawDate = match[1];
    const rawDesc = match[2].trim();
    const rawAmt = cleanAmount(match[3]);
    if (rawAmt <= 0) continue;
    if (isNoiseOrHeader(rawDesc)) continue;

    const isoDate = parseDateFlexible(rawDate);
    const detection = detectDebitOrCredit(rawDesc, 0, 0, rawAmt, rawDesc);
    const isExpense = detection.isDebit;
    const upiInfo = extractUpiDetails(rawDesc);
    const classification = classifyTransaction(rawDesc, isExpense ? rawAmt : 0, !isExpense ? rawAmt : 0);

    strat3.push({
      tempId: `import_${Date.now()}_stream_${streamIdx++}`,
      date: isoDate,
      name: upiInfo.merchant || (rawDesc.length > 36 ? rawDesc.substring(0, 36) + '...' : rawDesc),
      rawDescription: rawDesc,
      amount: rawAmt,
      isExpense: isExpense,
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

  // Quality-based score for selecting the best parsing strategy
  function scoreCandidate(txns) {
    if (!Array.isArray(txns) || txns.length === 0) return -100;
    let score = txns.length * 15;
    for (const t of txns) {
      // Heavily penalize garbage names starting with punctuation
      if (!t.name || t.name.startsWith(',') || t.name.startsWith(':') || t.name.length < 3) {
        score -= 30;
      }
      // Penalize time-collision amounts (e.g. amount=1 with no real merchant)
      if (t.amount <= 12 && (!t.merchant || t.name.startsWith(','))) {
        score -= 30;
      }
      // Reward clean merchant names
      if (t.merchant && t.merchant.length >= 3 && !t.merchant.startsWith(',') && !t.merchant.startsWith(':')) {
        score += 10;
      }
      // Reward 12-digit UPI reference IDs
      if (t.refId && t.refId.length === 12) {
        score += 10;
      }
      // Reward valid expense amounts
      if (t.amount >= 10) {
        score += 5;
      }
    }
    return score;
  }

  const candidates = [stratGPay, strat2, strat1, strat3]
    .filter(c => Array.isArray(c) && c.length > 0)
    .sort((a, b) => scoreCandidate(b) - scoreCandidate(a));

  return candidates[0] || [];
}

/**
 * Parses text-based PDF buffer into normalized transactions
 * Detects password protection with friendly error handling
 */
export async function parsePdfStatement(buffer) {
  if (!buffer || buffer.length === 0) {
    throw new Error('Empty PDF file provided.');
  }

  let text = '';
  try {
    text = await extractRawTextFromPdf(buffer);
  } catch (err) {
    const msg = (err && err.message) ? err.message.toLowerCase() : '';
    const errName = (err && err.name) ? err.name : '';
    if (msg.includes('password') || msg.includes('encrypted') || errName === 'PasswordException') {
      throw new Error('This PDF is password-protected. Please remove the password protection before uploading.');
    }
    throw new Error(`Failed to parse PDF statement: ${err.message || 'Unknown PDF reading error'}`);
  }

  const transactions = (text && text.trim().length > 0) ? parseStatementTextMultiStrategy(text) : [];

  return {
    success: true,
    text: text || '',
    transactions,
    totalRows: transactions.length
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
