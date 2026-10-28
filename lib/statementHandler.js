// ==============================================================================
// BACKEND STATEMENT API HANDLER - WALLETWEATHER WEB
// Handles Statement Parsing for ALL file types: CSV, XLSX, PDF, TXT, TSV & Images
// In-Memory Processing, Multi-Strategy Parsing, and Secure MongoDB Atlas Persistence
// ==============================================================================

import { 
  parseCsvStatement, 
  parseXlsxStatement, 
  parsePdfStatement, 
  parseStatementTextMultiStrategy,
  detectDuplicates 
} from './statementParser.js';
import { getUserAllData, syncUserData, connectToDatabase } from './db.js';
import { executeGroqWithFailover, DEFAULT_GROQ_MODEL } from './groqHandler.js';

const MAX_PAYLOAD_BYTES = 4.5 * 1024 * 1024; // 4.5 MB for Vercel Hobby limits

const VALID_CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Transport & Fuel',
  'Bills & Utilities',
  'Shopping & Tech',
  'Entertainment & Subscriptions',
  'Healthcare',
  'Education & Books',
  'Travel & Vacation',
  'Salary',
  'Freelance / Projects',
  'Investments & Dividends',
  'Gifts & Rewards',
  'Other Expense',
  'Other Income'
];

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object') return Promise.resolve(req.body);
    if (typeof req.body === 'string') {
      try {
        return Promise.resolve(req.body ? JSON.parse(req.body) : {});
      } catch {
        return Promise.reject(new Error('Invalid JSON payload'));
      }
    }
  }

  return new Promise((resolve, reject) => {
    let body = '';
    let bytesReceived = 0;

    req.on('data', chunk => {
      bytesReceived += chunk.length;
      if (bytesReceived > MAX_PAYLOAD_BYTES) {
        req.destroy();
        reject(new Error('Payload too large. Maximum statement size is 4.5 MB.'));
        return;
      }
      body += chunk;
    });

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON payload'));
      }
    });

    req.on('error', reject);
  });
}

/**
 * Strips account numbers, phone numbers, customer IDs, and sensitive tokens before sending to AI
 */
function sanitizeDescriptionForAi(desc = '') {
  return String(desc)
    .replace(/\b\d{9,18}\b/g, '[NUM]')
    .replace(/\b[A-Z]{4}0[A-Z0-9]{6}\b/gi, '[IFSC]')
    .replace(/([a-zA-Z0-9.\-_]+)@([a-zA-Z]+)/g, 'payee@$2')
    .trim();
}

/**
 * AI Fallback: Extracts structured transactions from non-standard or complex PDF/text statements
 */
async function extractTransactionsWithAi(sanitizedText, groqKey, groqModel) {
  if (!groqKey || !sanitizedText || sanitizedText.trim().length === 0) return [];
  const trimmed = sanitizedText.slice(0, 4500);

  const prompt = `You are an expert banking transaction extraction engine.
Extract all individual bank or UPI transactions from this bank statement text.
For each transaction, provide:
- "date": string in YYYY-MM-DD format (estimate recent month/year if only day/month given)
- "name": merchant or payee name (clean and short)
- "amount": numeric value only (positive number)
- "isExpense": boolean (true for debits/withdrawals/spent, false for credits/deposits/salary/refunds)
- "refId": 12-digit UPI reference ID / UTR or null
- "type": "expense", "income", "refund", or "transfer"
- "category": choose from Food & Dining, Groceries, Bills & Utilities, Transport & Fuel, Shopping & Tech, Healthcare, Entertainment & Subscriptions, Salary, Other Expense, Other Income

Bank Statement Text:
"""
${trimmed}
"""

Output ONLY valid JSON with this exact schema:
{"transactions": [{"date": "2026-10-24", "name": "Swiggy", "amount": 450, "isExpense": true, "refId": "430192837492", "type": "expense", "category": "Food & Dining"}]}`;

  const messages = [
    { role: 'system', content: 'You are a precise banking transaction extraction assistant. Output valid JSON only.' },
    { role: 'user', content: prompt }
  ];

  try {
    const res = await executeGroqWithFailover(groqKey, groqModel, messages, 0.1, 1500);
    if (res && res.content) {
      const jsonMatch = res.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.transactions) && parsed.transactions.length > 0) {
          return parsed.transactions.map((t, idx) => ({
            tempId: `import_ai_${Date.now()}_${idx}`,
            date: t.date || new Date().toISOString(),
            name: t.name || (t.isExpense ? 'Expense' : 'Income'),
            rawDescription: t.name || 'Statement entry',
            amount: parseFloat(t.amount) || 0,
            isExpense: Boolean(t.isExpense),
            type: t.type || (t.isExpense ? 'expense' : 'income'),
            category: t.category || (t.isExpense ? 'Other Expense' : 'Other Income'),
            paymentMethod: t.refId ? 'UPI' : 'Net Banking',
            refId: t.refId || null,
            merchant: t.name,
            isUpi: Boolean(t.refId),
            needsReview: false,
            selected: true
          })).filter(t => t.amount > 0);
        }
      }
    }
  } catch (aiErr) {
    console.warn('[Statement] AI extraction fallback notice:', aiErr.message);
  }

  return [];
}

/**
 * Image Statement Extractor: Extracts transactions from statement screenshots, passbooks or bill photos
 */
async function extractTransactionsFromImage(base64Data, mimeType, geminiKey) {
  if (!geminiKey) {
    throw new Error('Image statement extraction requires GEMINI_API_KEY to be configured.');
  }

  const cleanBase64 = base64Data.replace(/^data:.*?;base64,/, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;

  const prompt = `You are a bank statement OCR assistant.
Extract all transactions visible in this bank statement / passbook / UPI payment screenshot into a JSON array.
For each transaction, provide:
- "date": string in YYYY-MM-DD format
- "name": merchant or payee name
- "amount": numeric value only
- "isExpense": boolean (true for debits/withdrawals, false for credits/salary/refunds)
- "refId": 12-digit UPI reference ID or null
- "type": "expense", "income", "refund", or "transfer"
- "category": category name

Return ONLY valid JSON matching:
{"transactions": [{"date": "2026-10-24", "name": "Swiggy", "amount": 450, "isExpense": true, "refId": "430192837492", "type": "expense", "category": "Food & Dining"}]}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType || 'image/jpeg',
              data: cleanBase64
            }
          }
        ]
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1500 }
    })
  });

  if (!response.ok) {
    throw new Error(`Vision AI request failed with HTTP ${response.status}`);
  }

  const data = await response.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonMatch = textContent.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error('Could not identify transaction text in image.');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const txns = parsed.transactions || [];

  return txns.map((t, idx) => ({
    tempId: `import_img_${Date.now()}_${idx}`,
    date: t.date || new Date().toISOString(),
    name: t.name || (t.isExpense ? 'Expense' : 'Income'),
    rawDescription: t.name || 'Image statement entry',
    amount: parseFloat(t.amount) || 0,
    isExpense: Boolean(t.isExpense),
    type: t.type || (t.isExpense ? 'expense' : 'income'),
    category: t.category || (t.isExpense ? 'Other Expense' : 'Other Income'),
    paymentMethod: t.refId ? 'UPI' : 'Net Banking',
    refId: t.refId || null,
    merchant: t.name,
    isUpi: Boolean(t.refId),
    needsReview: false,
    selected: true
  })).filter(t => t.amount > 0);
}

export async function handleStatementApi(req, res, options = {}) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.end();
  }

  const groqKey = typeof options === 'string' ? options : (options.groqKey || process.env.GROQ_API_KEY || '');
  const groqModel = options.groqModel || process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
  const geminiKey = options.geminiKey || process.env.GEMINI_API_KEY || '';

  const url = new URL(req.url || '/', `http://${req.headers?.host || 'localhost'}`);
  const pathname = url.pathname.replace(/\/+$/, '');

  // 1. POST /api/statements/parse
  if (req.method === 'POST' && (pathname === '/api/statements/parse' || pathname.endsWith('/parse'))) {
    try {
      const body = await parseJsonBody(req);
      const { fileData, fileName = '', fileType = '', userEmail = '' } = body;

      if (!fileData) {
        return sendJson(res, 400, {
          success: false,
          error: 'No file data provided. Please upload a bank statement or receipt.'
        });
      }

      const cleanEmail = (userEmail || '').trim().toLowerCase();
      const ext = (fileName.split('.').pop() || '').toLowerCase();
      const effectiveType = (fileType || ext).toLowerCase();

      let extractedTransactions = [];

      // A. CSV / TSV / TXT formats
      if (['csv', 'tsv', 'txt'].includes(effectiveType) || effectiveType.includes('csv') || effectiveType.includes('text')) {
        let text = fileData;
        if (fileData.startsWith('data:') || !fileData.includes('\n')) {
          const base64Content = fileData.replace(/^data:.*?;base64,/, '');
          text = Buffer.from(base64Content, 'base64').toString('utf8');
        }

        try {
          const csvRes = parseCsvStatement(text);
          extractedTransactions = csvRes.transactions || [];
        } catch {
          // If CSV column mapping didn't find standard headers, use multi-strategy text parser
          extractedTransactions = parseStatementTextMultiStrategy(text);
        }

        // If rules found 0 rows, use AI extraction
        if (extractedTransactions.length === 0 && groqKey) {
          extractedTransactions = await extractTransactionsWithAi(sanitizeDescriptionForAi(text), groqKey, groqModel);
        }
      }
      // B. XLSX / XLS spreadsheet formats
      else if (['xlsx', 'xls'].includes(effectiveType) || effectiveType.includes('spreadsheet') || effectiveType.includes('excel')) {
        const base64Content = fileData.replace(/^data:.*?;base64,/, '');
        const buffer = Buffer.from(base64Content, 'base64');
        const xlsxRes = parseXlsxStatement(buffer);
        extractedTransactions = xlsxRes.transactions || [];
      }
      // C. PDF formats (Digital or Scanned)
      else if (effectiveType === 'pdf' || effectiveType.includes('pdf')) {
        const base64Content = fileData.replace(/^data:.*?;base64,/, '');
        const buffer = Buffer.from(base64Content, 'base64');

        let pdfText = '';
        try {
          const pdfRes = await parsePdfStatement(buffer);
          extractedTransactions = pdfRes.transactions || [];
          pdfText = pdfRes.text || '';
        } catch (pdfErr) {
          if (pdfErr.message.includes('password-protected')) {
            throw pdfErr;
          }
          console.warn('[Statement] PDF text extraction warning:', pdfErr.message);
        }

        // 1. If rule-based parser found 0 rows but text exists, use Groq AI fallback
        if (extractedTransactions.length === 0 && pdfText.trim().length > 10 && groqKey) {
          try {
            const sanitized = sanitizeDescriptionForAi(pdfText);
            extractedTransactions = await extractTransactionsWithAi(sanitized, groqKey, groqModel);
          } catch (groqErr) {
            console.warn('[Statement] Groq fallback error on PDF text:', groqErr.message);
          }
        }

        // 2. If still 0 rows (e.g. scanned image PDF or zero selectable text), use Gemini Vision fallback
        if (extractedTransactions.length === 0 && geminiKey) {
          try {
            extractedTransactions = await extractTransactionsFromImage(base64Content, 'application/pdf', geminiKey);
          } catch (geminiErr) {
            console.warn('[Statement] Gemini PDF fallback error:', geminiErr.message);
          }
        }
      }
      // D. Image formats (PNG, JPG, JPEG, WEBP, BMP, TIFF, HEIC, Screenshots)
      else if (
        ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'heic'].includes(effectiveType) ||
        effectiveType.includes('image')
      ) {
        const mimeType = effectiveType === 'png' ? 'image/png' : (effectiveType === 'webp' ? 'image/webp' : 'image/jpeg');
        extractedTransactions = await extractTransactionsFromImage(fileData, mimeType, geminiKey);
      }
      // E. Universal Fallback (Any other file type: TXT, DAT, LOG, PRN, JSON, TSV, etc.)
      else {
        let text = fileData;
        if (fileData.startsWith('data:') || !fileData.includes('\n')) {
          const base64Content = fileData.replace(/^data:.*?;base64,/, '');
          text = Buffer.from(base64Content, 'base64').toString('utf8');
        }

        try {
          const csvRes = parseCsvStatement(text);
          extractedTransactions = csvRes.transactions || [];
        } catch {
          extractedTransactions = parseStatementTextMultiStrategy(text);
        }

        if (extractedTransactions.length === 0 && groqKey) {
          try {
            const sanitized = sanitizeDescriptionForAi(text);
            extractedTransactions = await extractTransactionsWithAi(sanitized, groqKey, groqModel);
          } catch {}
        }
      }

      if (extractedTransactions.length === 0) {
        return sendJson(res, 400, {
          success: false,
          error: 'No transactions could be identified in this file. Please verify that the file contains bank or UPI statement entries.'
        });
      }

      // Fetch user's existing transactions from MongoDB to check for duplicates
      let existingTxns = [];
      if (cleanEmail) {
        try {
          const userData = await getUserAllData(cleanEmail);
          existingTxns = userData?.data?.transactions || [];
        } catch (dbErr) {
          console.warn('[Statement] Could not read existing transactions for duplicate check:', dbErr.message);
        }
      }

      const deduplicated = detectDuplicates(extractedTransactions, existingTxns);
      const duplicatesCount = deduplicated.filter(t => t.isDuplicate).length;
      const needsReviewCount = deduplicated.filter(t => t.needsReview).length;

      return sendJson(res, 200, {
        success: true,
        transactions: deduplicated,
        totalRows: deduplicated.length,
        duplicatesCount,
        needsReviewCount
      });
    } catch (err) {
      console.error('[Statement] Parse error:', err.message);
      return sendJson(res, 400, {
        success: false,
        error: err.message || 'Failed to parse statement.'
      });
    }
  }

  // 2. POST /api/statements/ai-categories
  if (req.method === 'POST' && (pathname === '/api/statements/ai-categories' || pathname.endsWith('/ai-categories'))) {
    try {
      const body = await parseJsonBody(req);
      const items = Array.isArray(body.items) ? body.items.slice(0, 30) : [];

      if (items.length === 0) {
        return sendJson(res, 200, { success: true, suggestions: {} });
      }

      const key = (groqKey || process.env.GROQ_API_KEY || '').trim();
      if (!key) {
        return sendJson(res, 200, {
          success: true,
          suggestions: {},
          note: 'Groq API key not configured; skipping AI categorization.'
        });
      }

      const promptItems = items.map((it, idx) => {
        const safeMerchant = sanitizeDescriptionForAi(it.merchant || it.name || '');
        const safeDesc = sanitizeDescriptionForAi(it.rawDescription || '');
        return `${idx + 1}. [ID: ${it.tempId}] Payee: "${safeMerchant}" | Desc: "${safeDesc}"`;
      }).join('\n');

      const systemPrompt = `You are a financial category assistant for Indian UPI and bank statements.
Given a list of transaction payees/descriptions, map each to ONE of these exact categories:
${VALID_CATEGORIES.join(', ')}

Return ONLY valid JSON in this exact structure:
{
  "suggestions": {
    "tempId1": "CategoryName",
    "tempId2": "CategoryName"
  }
}`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Categorize these transactions:\n${promptItems}` }
      ];

      const groqResult = await executeGroqWithFailover(key, groqModel, messages, 0.2, 512);

      let suggestions = {};
      try {
        const match = groqResult.content.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (parsed.suggestions && typeof parsed.suggestions === 'object') {
            for (const [id, cat] of Object.entries(parsed.suggestions)) {
              if (VALID_CATEGORIES.includes(cat)) {
                suggestions[id] = cat;
              }
            }
          }
        }
      } catch (parseErr) {
        console.warn('[Statement AI] JSON parse notice:', parseErr.message);
      }

      return sendJson(res, 200, {
        success: true,
        suggestions
      });
    } catch (err) {
      console.error('[Statement AI] Error:', err.message);
      return sendJson(res, 500, {
        success: false,
        error: `AI categorization error: ${err.message}`
      });
    }
  }

  // 3. POST /api/statements/confirm-import
  if (req.method === 'POST' && (pathname === '/api/statements/confirm-import' || pathname.endsWith('/confirm-import'))) {
    try {
      const body = await parseJsonBody(req);
      const { userEmail, transactions: incomingTxns } = body;

      const cleanEmail = (userEmail || '').trim().toLowerCase();
      if (!cleanEmail) {
        return sendJson(res, 400, {
          success: false,
          error: 'User email is required to save imported transactions.'
        });
      }

      if (!Array.isArray(incomingTxns) || incomingTxns.length === 0) {
        return sendJson(res, 400, {
          success: false,
          error: 'No confirmed transactions provided for import.'
        });
      }

      const conn = await connectToDatabase();
      if (!conn.connected || !conn.db) {
        return sendJson(res, 503, {
          success: false,
          error: 'MongoDB Atlas is currently unavailable. Transactions were not saved. Please verify your database connection.'
        });
      }

      const existingDataRes = await getUserAllData(cleanEmail);
      const currentData = existingDataRes.data || {};
      const currentTxns = currentData.transactions || [];

      const formatted = incomingTxns.map((t, idx) => ({
        id: `txn_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
        name: t.name || (t.isExpense ? 'Imported Expense' : 'Imported Income'),
        category: t.category || (t.isExpense ? 'Other Expense' : 'Other Income'),
        amount: parseFloat(t.amount) || 0,
        isExpense: Boolean(t.isExpense),
        date: t.date || new Date().toISOString(),
        paymentMethod: t.paymentMethod || 'UPI',
        note: t.rawDescription ? `Statement: ${t.rawDescription}` : '',
        tag: 'Personal',
        isMonthly: false,
        source: 'import',
        refId: t.refId || null,
        merchant: t.merchant || null,
        createdAt: new Date().toISOString()
      }));

      const mergedTransactions = [...formatted, ...currentTxns];
      const updatedData = {
        ...currentData,
        transactions: mergedTransactions,
        lastModified: Date.now()
      };

      const syncResult = await syncUserData(cleanEmail, updatedData);

      if (syncResult.storage !== 'mongodb') {
        return sendJson(res, 503, {
          success: false,
          error: 'Failed to write to MongoDB Atlas cloud. Import was aborted.'
        });
      }

      return sendJson(res, 200, {
        success: true,
        importedCount: formatted.length,
        totalTransactions: mergedTransactions.length,
        importedTransactions: formatted
      });
    } catch (err) {
      console.error('[Statement Import] Error saving:', err.message);
      return sendJson(res, 500, {
        success: false,
        error: `Error saving transactions to MongoDB: ${err.message}`
      });
    }
  }

  return sendJson(res, 404, {
    success: false,
    error: `Statement route not found: ${pathname}`
  });
}
