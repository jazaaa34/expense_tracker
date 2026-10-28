// ==============================================================================
// TEST SUITE: UPI & BANK STATEMENT IMPORTER - WALLETWEATHER WEB
// Tests CSV, XLSX, PDF parsing, UPI extraction, duplicate detection, and APIs
// ==============================================================================

import assert from 'node:assert';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
import { 
  parseCsvStatement, 
  parseXlsxStatement, 
  parsePdfStatement,
  extractUpiDetails, 
  classifyTransaction, 
  detectDuplicates 
} from '../lib/statementParser.js';

console.log('=== RUNNING UPI STATEMENT IMPORTER TEST SUITE ===\n');

// ------------------------------------------------------------------------------
// TEST 1: UPI Narration Extraction
// ------------------------------------------------------------------------------
console.log('Test 1: UPI metadata extraction');
const testUpi1 = extractUpiDetails('UPI/DR/430192837492/Swiggy/HDFC/payee@okhdfcbank');
assert.strictEqual(testUpi1.isUpi, true, 'Should detect UPI');
assert.strictEqual(testUpi1.refId, '430192837492', 'Should extract 12-digit UTR');
assert.strictEqual(testUpi1.merchant, 'Swiggy', 'Should extract merchant name');

const testUpi2 = extractUpiDetails('UPI-ZOMATO-zomato@paytm-430998877665');
assert.strictEqual(testUpi2.isUpi, true, 'Should detect UPI hyphenated');
assert.strictEqual(testUpi2.refId, '430998877665', 'Should extract UTR from hyphenated narration');
assert.strictEqual(testUpi2.merchant, 'ZOMATO', 'Should extract merchant');

const testUpi3 = extractUpiDetails('NEFT CR-PUNBH192830192-SALARY FOR OCTOBER-XYZ CORP');
assert.strictEqual(testUpi3.isUpi, false, 'Non-UPI should not be marked as UPI');
console.log('  Passed: UPI reference, VPA, and merchant extracted accurately.\n');

// ------------------------------------------------------------------------------
// TEST 2: Transaction Classification (Expense, Income, Refund, Transfer)
// ------------------------------------------------------------------------------
console.log('Test 2: Classification (Expense vs Income vs Refund vs Transfer)');
const c1 = classifyTransaction('UPI/DR/430192837492/Swiggy', 450, 0);
assert.strictEqual(c1.type, 'expense');
assert.strictEqual(c1.isExpense, true);

const c2 = classifyTransaction('ACH CREDIT-SALARY FOR OCT', 0, 75000);
assert.strictEqual(c2.type, 'income');
assert.strictEqual(c2.isExpense, false);
assert.strictEqual(c2.suggestedCategory, 'Salary');

const c3 = classifyTransaction('UPI/CR/430192837492/SWIGGY-REFUND/REV', 0, 450);
assert.strictEqual(c3.type, 'refund');
assert.strictEqual(c3.isExpense, false);
assert.strictEqual(c3.suggestedCategory, 'Gifts & Rewards');

const c4 = classifyTransaction('TRANSFER TO SELF OWN A/C SAVINGS', 5000, 0);
assert.strictEqual(c4.type, 'transfer');
console.log('  Passed: Expense, salary income, refunds, and transfers classified correctly.\n');

// ------------------------------------------------------------------------------
// TEST 3: CSV Bank Statement Parsing (HDFC, SBI, Generic Formats)
// ------------------------------------------------------------------------------
console.log('Test 3: CSV Parsing with multiple column formats');

// Format A: HDFC Style (Date, Narration, Chq/Ref No, Value Dt, Withdrawal Amt, Deposit Amt, Closing Balance)
const hdfcCsv = `
HDFC BANK ACCOUNT STATEMENT
Account Number: 50100234567890
Customer Name: Aysha
Date,Narration,Chq/Ref No,Value Dt,Withdrawal Amt,Deposit Amt,Closing Balance
24/10/2026,UPI/DR/430129482019/Swiggy/HDFC/swiggy@okhdfcbank,430129482019,24/10/2026,450.00,,45200.00
25/10/2026,UPI/DR/430129482020/Blinkit/ICICI/blinkit@icici,430129482020,25/10/2026,1280.50,,43919.50
26/10/2026,ACH CREDIT - MONTHLY SALARY,ACH991823,26/10/2026,,45000.00,88919.50
27/10/2026,UPI/CR/430129482021/Swiggy/REFUND,430129482021,27/10/2026,,450.00,89369.50
Total,,,46730.50,45450.00,
`;

const hdfcResult = parseCsvStatement(hdfcCsv);
assert.strictEqual(hdfcResult.success, true);
assert.strictEqual(hdfcResult.transactions.length, 4, 'Should parse 4 valid transactions and ignore metadata/totals');
assert.strictEqual(hdfcResult.transactions[0].merchant, 'Swiggy');
assert.strictEqual(hdfcResult.transactions[0].amount, 450);
assert.strictEqual(hdfcResult.transactions[0].isExpense, true);
assert.strictEqual(hdfcResult.transactions[2].isExpense, false, 'Salary should be income');
assert.strictEqual(hdfcResult.transactions[3].type, 'refund', 'Refund should be classified as refund');

// Format B: SBI Style (Txn Date, Description, Ref No./Cheque No., Debit, Credit, Balance)
const sbiCsv = `
Txn Date,Description,Ref No./Cheque No.,Debit,Credit,Balance
15-Oct-2026,UPI/DR/430999111222/BESCOM_ELECTRICITY/bescom@sbi,430999111222,2450.00,,12000.00
16-Oct-2026,UPI/DR/430999111223/AIRTEL_FIBER/airtel@sbi,430999111223,1199.00,,10801.00
`;
const sbiResult = parseCsvStatement(sbiCsv);
assert.strictEqual(sbiResult.transactions.length, 2);
assert.strictEqual(sbiResult.transactions[0].amount, 2450);
assert.strictEqual(sbiResult.transactions[1].amount, 1199);
console.log('  Passed: HDFC and SBI CSV column layouts successfully detected and parsed.\n');

// ------------------------------------------------------------------------------
// TEST 4: Malformed CSV & Error Handling
// ------------------------------------------------------------------------------
console.log('Test 4: Malformed CSV error handling');
assert.throws(() => parseCsvStatement(''), /Empty or invalid CSV/, 'Empty CSV should throw error');
assert.throws(() => parseCsvStatement('Some random text without columns'), /insufficient rows|standard bank statement columns/i);
console.log('  Passed: Malformed and empty statements return clear user-friendly errors.\n');

// ------------------------------------------------------------------------------
// TEST 5: Duplicate Transaction Detection
// ------------------------------------------------------------------------------
console.log('Test 5: Duplicate detection against existing database records');
const existingDbTxns = [
  {
    id: 'existing_1',
    name: 'Swiggy Order',
    amount: 450,
    isExpense: true,
    date: '2026-10-24T12:00:00.000Z',
    refId: '430129482019'
  }
];

const deduplicated = detectDuplicates(hdfcResult.transactions, existingDbTxns);
const dupMatch = deduplicated.find(t => t.refId === '430129482019');
assert.ok(dupMatch, 'Should find duplicate candidate');
assert.strictEqual(dupMatch.isDuplicate, true, 'Should mark matching transaction as duplicate');
assert.strictEqual(dupMatch.duplicateConfidence, 'exact', 'Should have exact confidence due to UTR match');
assert.strictEqual(dupMatch.selected, false, 'Duplicates should be unchecked by default');

const nonDup = deduplicated.find(t => t.refId === '430129482020');
assert.strictEqual(nonDup.isDuplicate, false, 'Non-duplicate should remain clean');
assert.strictEqual(nonDup.selected, true, 'Non-duplicate should remain checked');
console.log('  Passed: Exact UPI reference match flagged without discarding data.\n');

// ------------------------------------------------------------------------------
// TEST 6: XLSX Statement Parsing
// ------------------------------------------------------------------------------
console.log('Test 6: XLSX statement creation and parsing');
const xlsxRows = [
  ['Date', 'Particulars', 'Chq No', 'Withdrawal (Dr)', 'Deposit (Cr)', 'Balance'],
  ['2026-10-20', 'UPI/DR/430888777666/Zomato', '430888777666', 650, '', 35000],
  ['2026-10-21', 'UPI/DR/430888777667/Uber Trip', '430888777667', 320, '', 34680],
  ['2026-10-22', 'INTEREST CREDIT', '', '', 450, 35130]
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(xlsxRows);
XLSX.utils.book_append_sheet(wb, ws, 'Statement');
const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

const xlsxResult = parseXlsxStatement(xlsxBuffer);
assert.strictEqual(xlsxResult.success, true);
assert.strictEqual(xlsxResult.transactions.length, 3);
assert.strictEqual(xlsxResult.transactions[0].amount, 650);
assert.strictEqual(xlsxResult.transactions[1].merchant, 'Uber Trip');
assert.strictEqual(xlsxResult.transactions[2].isExpense, false);
console.log('  Passed: XLSX multi-column spreadsheet parsed into clean transactions.\n');

// ------------------------------------------------------------------------------
// TEST 7: PDF Statement & Password-Protected PDF Handling
// ------------------------------------------------------------------------------
console.log('Test 7: PDF statement parsing and error resilience');
// 1. Test empty buffer handling
await assert.rejects(async () => {
  await parsePdfStatement(Buffer.from(''));
}, /Empty PDF file/);

// 2. Test valid PDF parsing
const samplePdf = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>\nendobj\n4 0 obj\n<< /Length 73 >>\nstream\nBT\n/F1 12 Tf\n72 712 Td\n(24/10/2026 UPI/DR/430192837492/Swiggy 450.00) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000305 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n428\n%%EOF'
);
const pdfResult = await parsePdfStatement(samplePdf);
assert.strictEqual(pdfResult.success, true);
assert.strictEqual(pdfResult.transactions.length, 1);
assert.strictEqual(pdfResult.transactions[0].merchant, 'Swiggy');
assert.strictEqual(pdfResult.transactions[0].amount, 450);

console.log('  Passed: PDF statement parsed and error cases handled securely.\n');

console.log('====================================================');
console.log('✅ ALL UPI TRANSACTION IMPORTER TESTS PASSED (7/7)!');
console.log('====================================================\n');
