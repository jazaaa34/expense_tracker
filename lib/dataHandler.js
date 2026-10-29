// ==============================================================================
// BACKEND DATA SYNC & DATABASE API HANDLER - WALLETWEATHER WEB
// Handles MongoDB synchronization for transactions, budgets, goals, and users
// ==============================================================================

import { connectToDatabase, checkDatabaseHealth, isDbConnected, getUserAllData, syncUserData, findUserByEmail, saveUserAccount } from './db.js';

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) {
      try {
        return Promise.resolve(JSON.parse(req.body.toString('utf8')));
      } catch {
        return Promise.reject(new Error('Invalid JSON payload'));
      }
    }
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
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5e6) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

export async function handleDataApi(req, res, explicitAction = null) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.end();
  }

  const url = new URL(req.url || '/', `http://${req.headers?.host || 'localhost'}`);
  const pathname = url.pathname.replace(/\/+$/, '');

  const isStatus = explicitAction === 'status' || pathname === '/api/db/status' || pathname === '/db/status' || pathname === '/status';
  const isSync = explicitAction === 'sync' || pathname === '/api/db/sync' || pathname === '/db/sync' || pathname === '/sync';
  const isUserSave = explicitAction === 'user_save' || pathname === '/api/db/user/save' || pathname === '/db/user/save' || pathname === '/user/save';
  const isUserFind = explicitAction === 'user_find' || pathname === '/api/db/user/find' || pathname === '/db/user/find' || pathname === '/user/find';

  // 1. GET /api/db/status - Safe database health check with real MongoDB ping
  if (req.method === 'GET' && isStatus) {
    const health = await checkDatabaseHealth();
    return sendJson(res, 200, {
      success: true,
      ...health
    });
  }

  // 2. POST /api/db/sync - Push or pull user data to/from MongoDB
  if (req.method === 'POST' && isSync) {
    try {
      const body = await parseBody(req);
      const email = (body.email || '').toLowerCase().trim();

      if (!email) {
        return sendJson(res, 400, {
          success: false,
          error: 'Email is required for syncing data.'
        });
      }

      // If payload includes `data` to push
      if (body.data) {
        const result = await syncUserData(email, body.data);
        return sendJson(res, 200, {
          success: true,
          synced: true,
          storage: result.storage,
          updatedAt: result.updatedAt
        });
      }

      // Otherwise fetch latest data
      const existingData = await getUserAllData(email);
      return sendJson(res, 200, {
        success: true,
        data: existingData.data || {},
        updatedAt: existingData.updatedAt || 0,
        storage: existingData.storage
      });
    } catch (e) {
      return sendJson(res, 500, {
        success: false,
        error: `Database sync error: ${e.message}`
      });
    }
  }

  // 3. POST /api/db/user/save - Verify or create user in MongoDB
  if (req.method === 'POST' && isUserSave) {
    try {
      const body = await parseBody(req);
      const email = (body.email || '').toLowerCase().trim();
      if (!email) {
        return sendJson(res, 400, { success: false, error: 'Email required' });
      }

      await saveUserAccount({
        email,
        name: body.name || '',
        password: body.password || '',
        updatedAt: new Date()
      });

      return sendJson(res, 200, { success: true, message: 'User updated in database' });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // 4. POST /api/db/user/find - Look up user in MongoDB
  if (req.method === 'POST' && isUserFind) {
    try {
      const body = await parseBody(req);
      const email = (body.email || '').toLowerCase().trim();
      if (!email) {
        return sendJson(res, 400, { success: false, error: 'Email required' });
      }

      const user = await findUserByEmail(email);
      if (!user) {
        return sendJson(res, 404, { success: false, error: 'User not found in database' });
      }

      return sendJson(res, 200, {
        success: true,
        user: {
          email: user.email,
          name: user.name,
          password: user.password
        }
      });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  return sendJson(res, 404, {
    success: false,
    error: `Data route not found: ${pathname}`
  });
}

export default async function handler(req, res) {
  return handleDataApi(req, res);
}
