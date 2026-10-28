// ==============================================================================
// BACKEND STATEMENT API HANDLER - WALLETWEATHER WEB
// Handles Statement Parsing, In-Memory File Processing, AI Category Suggestions,
// and Secure MongoDB Atlas Persistence
// ==============================================================================

import { 
  parseCsvStatement, 
  parseXlsxStatement, 
  parsePdfStatement, 
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
    // Replace 9-18 digit numbers (bank account numbers, card numbers, phone numbers)
    .replace(/\b\d{9,18}\b/g, '[NUM]')
    // Replace IFSC codes
    .replace(/\b[A-Z]{4}0[A-Z0-9]{6}\b/gi, '[IFSC]')
    // Replace VPA handles with domain only
    .replace(/([a-zA-Z0-9.\-_]+)@([a-zA-Z]+)/g, 'payee@$2')
    .trim();
}

export async function handleStatementApi(req, res, groqKey = '', groqModel = DEFAULT_GROQ_MODEL) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.end();
  }

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
          error: 'No file data provided. Please upload a CSV, XLSX, or PDF statement.'
        });
      }

      const cleanEmail = (userEmail || '').trim().toLowerCase();
      const ext = (fileName.split('.').pop() || '').toLowerCase();
      const effectiveType = (fileType || ext).toLowerCase();

      let parseResult;

      if (effectiveType === 'csv' || effectiveType.includes('csv')) {
        // fileData can be base64 or raw string
        let text = fileData;
        if (fileData.startsWith('data:') || !fileData.includes('\n')) {
          const base64Content = fileData.replace(/^data:.*?;base64,/, '');
          text = Buffer.from(base64Content, 'base64').toString('utf8');
        }
        parseResult = parseCsvStatement(text);
      } else if (effectiveType === 'xlsx' || effectiveType === 'xls' || effectiveType.includes('spreadsheet')) {
        const base64Content = fileData.replace(/^data:.*?;base64,/, '');
        const buffer = Buffer.from(base64Content, 'base64');
        parseResult = parseXlsxStatement(buffer);
      } else if (effectiveType === 'pdf' || effectiveType.includes('pdf')) {
        const base64Content = fileData.replace(/^data:.*?;base64,/, '');
        const buffer = Buffer.from(base64Content, 'base64');
        parseResult = await parsePdfStatement(buffer);
      } else {
        return sendJson(res, 400, {
          success: false,
          error: `Unsupported file format ".${ext}". Please upload a CSV, XLSX, or PDF bank statement.`
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

      const deduplicated = detectDuplicates(parseResult.transactions, existingTxns);
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
        error: err.message || 'Failed to parse bank statement.'
      });
    }
  }

  // 2. POST /api/statements/ai-categories
  if (req.method === 'POST' && (pathname === '/api/statements/ai-categories' || pathname.endsWith('/ai-categories'))) {
    try {
      const body = await parseJsonBody(req);
      const items = Array.isArray(body.items) ? body.items.slice(0, 30) : []; // Max 30 items per batch

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

      // Build safe sanitized list
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

      // Check MongoDB Atlas availability (Requirement 19: Do not claim saved if MongoDB Atlas is unavailable)
      const conn = await connectToDatabase();
      if (!conn.connected || !conn.db) {
        return sendJson(res, 503, {
          success: false,
          error: 'MongoDB Atlas is currently unavailable. Transactions were not saved. Please verify your database connection.'
        });
      }

      // Fetch user's current data
      const existingDataRes = await getUserAllData(cleanEmail);
      const currentData = existingDataRes.data || {};
      const currentTxns = currentData.transactions || [];

      // Format incoming transactions into standard transaction schema
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

  // Not found
  return sendJson(res, 404, {
    success: false,
    error: `Statement route not found: ${pathname}`
  });
}
