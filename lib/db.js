// ==============================================================================
// DATABASE LAYER - WALLETWEATHER WEB
// MongoDB integration with automatic fallback to persistent JSON store
// Ensures seamless data persistence across sessions and server restarts
// ==============================================================================

import { MongoClient } from 'mongodb';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fallback file-based database path (isolated to local development only)
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_REGION);
const LOCAL_DB_DIR = isServerless ? '/tmp' : path.join(__dirname, '..', 'data');
const LOCAL_DB_FILE = path.join(LOCAL_DB_DIR, 'db.json');

let mongoClient = null;
let mongoDb = null;
let isConnected = false;
let clientPromise = null;

// Ensure local db directory exists (no-op in serverless)
function ensureLocalDb() {
  if (isServerless) return;
  try {
    if (!fs.existsSync(LOCAL_DB_DIR)) {
      fs.mkdirSync(LOCAL_DB_DIR, { recursive: true });
    }
    if (!fs.existsSync(LOCAL_DB_FILE)) {
      fs.writeFileSync(
        LOCAL_DB_FILE,
        JSON.stringify({
          users: {},
          user_data: {},
          otps: {}
        }, null, 2),
        'utf8'
      );
    }
  } catch {
    // Ignore filesystem limitations
  }
}

function readLocalDb() {
  if (isServerless) {
    return { users: {}, user_data: {}, otps: {} };
  }
  ensureLocalDb();
  try {
    if (fs.existsSync(LOCAL_DB_FILE)) {
      const raw = fs.readFileSync(LOCAL_DB_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch {
    // Return empty store on read error
  }
  return { users: {}, user_data: {}, otps: {} };
}

function writeLocalDb(data) {
  // Never attempt to write local disk files in cloud serverless environment
  if (isServerless) return;
  try {
    ensureLocalDb();
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch {
    // Silent in cloud environments
  }
}

// Read .env if environment variables are not yet loaded into process.env
function loadEnvSafely() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let val = match[2] || '';
          val = val.trim().replace(/^['"]|['"]$/g, '');
          if (!process.env[key] || process.env[key].trim() === '') {
            process.env[key] = val;
          }
        }
      }
    } catch {
      // ignore
    }
  }
}
loadEnvSafely();

/**
 * Connect to MongoDB using MONGODB_URI environment variable
 */
export async function connectToDatabase(forceReconnect = false) {
  loadEnvSafely();
  const uri = (process.env.MONGODB_URI || '').trim();
  const dbName = (process.env.MONGODB_DB_NAME || 'walletweather').trim();

  if (!uri) {
    return { connected: false, type: 'local', reason: 'MONGODB_URI not configured in .env' };
  }

  if (forceReconnect) {
    if (mongoClient) {
      try { await mongoClient.close(); } catch {}
    }
    mongoClient = null;
    mongoDb = null;
    clientPromise = null;
    isConnected = false;
  }

  // If already connected, verify connection socket is alive with a fast ping
  if (mongoClient && mongoDb && isConnected) {
    try {
      await mongoDb.command({ ping: 1 });
      return { connected: true, db: mongoDb, client: mongoClient, type: 'mongodb' };
    } catch {
      // Idle socket closed by remote Atlas cluster, reset client
      mongoClient = null;
      mongoDb = null;
      clientPromise = null;
      isConnected = false;
    }
  }

  if (!clientPromise) {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
      maxPoolSize: 10
    });

    clientPromise = client.connect().then(async (c) => {
      mongoClient = c;
      mongoDb = c.db(dbName);
      isConnected = true;

      // Ensure TTL index on otps collection so expired codes are automatically purged
      try {
        await mongoDb.collection('otps').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      } catch {}

      // Ensure index on email for high-speed queries
      try {
        await mongoDb.collection('otps').createIndex({ email: 1 });
      } catch {}

      return { connected: true, db: mongoDb, client: mongoClient, type: 'mongodb' };
    }).catch(err => {
      clientPromise = null;
      mongoClient = null;
      mongoDb = null;
      isConnected = false;
      console.warn(`[MongoDB] Connection warning (${err.message}). Using local persistent database.`);
      return { connected: false, type: 'local', error: err.message };
    });
  }

  return clientPromise;
}

/**
 * Health check that performs an actual real MongoDB ping command ({ ping: 1 }).
 * Accurately verifies whether Atlas/remote MongoDB is alive.
 * Never leaks the connection string, password, or credentials.
 */
export async function checkDatabaseHealth() {
  loadEnvSafely();
  const uri = (process.env.MONGODB_URI || '').trim();
  const dbName = (process.env.MONGODB_DB_NAME || 'walletweather').trim();

  if (!uri) {
    return {
      atlasConnected: false,
      isAtlas: false,
      hasMongoUri: false,
      database: dbName,
      storageType: 'local_fallback',
      ping: false,
      message: 'MONGODB_URI is not set in .env. Local JSON fallback is currently active.'
    };
  }

  const isAtlas = uri.includes('.mongodb.net') || uri.startsWith('mongodb+srv://');
  const startTime = Date.now();

  try {
    const conn = await connectToDatabase();
    if (!conn.connected || !mongoDb) {
      return {
        atlasConnected: false,
        isAtlas,
        hasMongoUri: true,
        database: dbName,
        storageType: 'local_fallback',
        ping: false,
        error: conn.error || 'Connection failed',
        message: `Could not connect to MongoDB: ${conn.error || 'Check network / IP whitelist / credentials'}`
      };
    }

    // Execute real database ping command
    const pingResult = await mongoDb.command({ ping: 1 });
    const latencyMs = Date.now() - startTime;
    const isPingSuccess = pingResult && (pingResult.ok === 1 || pingResult.ok === true);

    if (isPingSuccess) {
      return {
        connected: true,
        atlasConnected: true,
        isAtlas,
        hasMongoUri: true,
        database: dbName,
        storageType: isAtlas ? 'mongodb_atlas' : 'mongodb',
        ping: 'ok',
        latencyMs,
        message: isAtlas
          ? 'Verified! Successfully connected to MongoDB Atlas and ping succeeded.'
          : 'Verified! Successfully connected to MongoDB and ping succeeded.'
      };
    }

    return {
      connected: false,
      atlasConnected: false,
      isAtlas,
      hasMongoUri: true,
      database: dbName,
      storageType: 'local_fallback',
      ping: 'failed',
      message: 'MongoDB responded but ping command did not return ok'
    };
  } catch (err) {
    return {
      atlasConnected: false,
      isAtlas,
      hasMongoUri: true,
      database: dbName,
      storageType: 'local_fallback',
      ping: false,
      error: err.message,
      message: `MongoDB ping failed: ${err.message}`
    };
  }
}

export function isDbConnected() {
  return isConnected;
}

// ==============================================================================
// OTP OPERATIONS
// Active OTP memory store for fast local lookup
const activeOtps = new Map();

export async function saveOtp(email, otp, name = '') {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanOtp = String(otp || '').replace(/\D/g, '').trim();

  if (!cleanEmail || !cleanOtp) {
    return { success: false, error: 'Email and 6-digit verification code are required.' };
  }

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins validity
  let mongoSaved = false;
  let lastError = null;

  // 1. Primary Store: MongoDB Atlas otps collection
  try {
    const conn = await connectToDatabase();
    if (conn.connected && conn.db) {
      await conn.db.collection('otps').updateOne(
        { email: cleanEmail },
        {
          $set: {
            email: cleanEmail,
            otp: cleanOtp,
            name: name ? name.trim() : '',
            createdAt: new Date(),
            expiresAt,
            attempts: 0,
            verified: false,
            verifiedAt: null
          }
        },
        { upsert: true }
      );
      mongoSaved = true;
    } else {
      lastError = conn.error || conn.reason || 'MongoDB connection not active';
    }
  } catch (mongoErr) {
    lastError = mongoErr.message;
    console.error('[MongoDB] Error saving OTP to database:', mongoErr.message);
  }

  // 2. In-memory cache for fast same-process lookup
  activeOtps.set(cleanEmail, {
    email: cleanEmail,
    otp: cleanOtp,
    name: name ? name.trim() : '',
    createdAt: Date.now(),
    expiresAt: expiresAt.getTime(),
    attempts: 0,
    verified: false,
    verifiedAt: 0
  });

  // 3. Local persistent store for standalone local development only
  if (!isServerless && !mongoSaved) {
    try {
      const db = readLocalDb();
      if (!db.otps) db.otps = {};
      db.otps[cleanEmail] = {
        email: cleanEmail,
        otp: cleanOtp,
        name: name ? name.trim() : '',
        createdAt: Date.now(),
        expiresAt: expiresAt.getTime(),
        attempts: 0,
        verified: false,
        verifiedAt: 0
      };
      writeLocalDb(db);
    } catch {
      // local fallback write notice
    }
  }

  // If MongoDB is configured but failed to save, report failure so we don't dispatch an unsaved OTP
  const uri = (process.env.MONGODB_URI || '').trim();
  if (uri && !mongoSaved) {
    const errorDetail = lastError ? `: ${lastError}` : '';
    return {
      success: false,
      error: `Database connection failed${errorDetail}. Please ensure MongoDB Atlas Network Access allows 0.0.0.0/0.`
    };
  }

  return { success: true };
}

export async function verifyOtp(email, submittedOtp) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanOtp = String(submittedOtp || '').replace(/\D/g, '').trim();

  if (!cleanEmail || !cleanOtp) {
    return { success: false, error: 'Email and 6-digit verification code are required.' };
  }

  let record = null;

  // 1. Primary Lookup: MongoDB Atlas otps collection (shared across all Vercel Lambdas)
  try {
    const conn = await connectToDatabase();
    if (conn.connected && conn.db) {
      const mongoRec = await conn.db.collection('otps').findOne({ email: cleanEmail });
      if (mongoRec) {
        record = {
          email: mongoRec.email,
          otp: String(mongoRec.otp || '').trim(),
          expiresAt: mongoRec.expiresAt instanceof Date ? mongoRec.expiresAt.getTime() : new Date(mongoRec.expiresAt).getTime(),
          attempts: mongoRec.attempts || 0,
          verified: Boolean(mongoRec.verified),
          verifiedAt: mongoRec.verifiedAt ? new Date(mongoRec.verifiedAt).getTime() : 0
        };
      }
    }
  } catch (mongoErr) {
    console.error('[MongoDB] Error finding OTP:', mongoErr.message);
  }

  // 2. In-memory check (for fast single-process local server lookup)
  if (!record && activeOtps.has(cleanEmail)) {
    record = activeOtps.get(cleanEmail);
  }

  // 3. Local JSON check (standalone local file fallback)
  if (!record) {
    try {
      const db = readLocalDb();
      if (db.otps && db.otps[cleanEmail]) {
        record = db.otps[cleanEmail];
      }
    } catch (e) {
      // local db read notice
    }
  }

  // If no record found in any tier
  if (!record) {
    return { success: false, error: 'No active verification code found for this email. Please request a new code.' };
  }

  // 0. Double-submit protection across Vercel serverless lambdas:
  // If this code was already successfully verified within the last 3 minutes for this email
  if (record.verified && record.otp === cleanOtp) {
    const timeSinceVerified = Date.now() - (record.verifiedAt || 0);
    if (timeSinceVerified < 180000) {
      return { success: true, verified: true, message: 'Email verified successfully.' };
    }
  }

  // Check expiration (15 minutes validity)
  const expTime = typeof record.expiresAt === 'number' ? record.expiresAt : new Date(record.expiresAt).getTime();
  if (Date.now() > expTime) {
    activeOtps.delete(cleanEmail);
    try {
      const conn = await connectToDatabase();
      if (conn.connected && conn.db) {
        await conn.db.collection('otps').deleteOne({ email: cleanEmail });
      }
    } catch {}
    return { success: false, error: 'Verification code has expired. Please request a new code.' };
  }

  // Check attempt limit (max 5 attempts)
  const attempts = (record.attempts || 0) + 1;
  record.attempts = attempts;
  if (attempts > 5) {
    activeOtps.delete(cleanEmail);
    try {
      const conn = await connectToDatabase();
      if (conn.connected && conn.db) {
        await conn.db.collection('otps').deleteOne({ email: cleanEmail });
      }
    } catch {}
    return { success: false, error: 'Too many incorrect attempts. Please request a fresh verification code.' };
  }

  // Verify OTP digits match
  if (String(record.otp || '').trim() !== cleanOtp) {
    // Record incremented attempt count in MongoDB
    try {
      const conn = await connectToDatabase();
      if (conn.connected && conn.db) {
        await conn.db.collection('otps').updateOne({ email: cleanEmail }, { $set: { attempts } });
      }
    } catch {}
    activeOtps.set(cleanEmail, record);

    const remaining = 5 - attempts;
    return {
      success: false,
      error: `Incorrect verification code. ${remaining > 0 ? `${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` : 'Code expired.'}`
    };
  }

  // Valid OTP! Mark as verified in MongoDB Atlas (retained for 5 minutes for race-condition protection, then cleaned up by TTL)
  const verifiedAt = new Date();
  try {
    const conn = await connectToDatabase();
    if (conn.connected && conn.db) {
      await conn.db.collection('otps').updateOne(
        { email: cleanEmail },
        {
          $set: {
            verified: true,
            verifiedAt,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000)
          }
        }
      );
    }
  } catch (cleanErr) {
    console.error('Error marking OTP verified:', cleanErr.message);
  }

  // Update in-memory record
  activeOtps.set(cleanEmail, {
    ...record,
    verified: true,
    verifiedAt: verifiedAt.getTime()
  });

  return { success: true, verified: true };
}

// ==============================================================================
// USER ACCOUNT OPERATIONS
// ==============================================================================

export async function findUserByEmail(email) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const conn = await connectToDatabase();

  if (conn.connected && conn.db) {
    try {
      const user = await conn.db.collection('users').findOne({ email: cleanEmail });
      if (user) return user;
    } catch (e) {
      console.error('[MongoDB] Error finding user:', e.message);
    }
  }

  const db = readLocalDb();
  return (db.users && db.users[cleanEmail]) || null;
}

export async function saveUserAccount(userObj) {
  const cleanEmail = (userObj.email || '').trim().toLowerCase();
  const record = {
    ...userObj,
    email: cleanEmail,
    updatedAt: new Date()
  };

  const conn = await connectToDatabase();
  if (conn.connected && conn.db) {
    try {
      await conn.db.collection('users').updateOne(
        { email: cleanEmail },
        { $set: record },
        { upsert: true }
      );
      return { success: true, storage: 'mongodb' };
    } catch (e) {
      console.error('[MongoDB] Error saving user:', e.message);
    }
  }

  const db = readLocalDb();
  if (!db.users) db.users = {};
  db.users[cleanEmail] = record;
  writeLocalDb(db);
  return { success: true, storage: 'local' };
}

// ==============================================================================
// USER DATA SYNC (TRANSACTIONS, BUDGETS, ALERTS, GOALS)
// ==============================================================================

export async function getUserAllData(email) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const conn = await connectToDatabase();

  if (conn.connected && conn.db) {
    try {
      const doc = await conn.db.collection('user_data').findOne({ email: cleanEmail });
      if (doc) {
        return {
          data: doc.data || {},
          updatedAt: doc.updatedAt ? new Date(doc.updatedAt).getTime() : (doc.data?.lastModified || 0),
          storage: 'mongodb'
        };
      }
    } catch (e) {
      console.error('[MongoDB] Error getting user data:', e.message);
    }
  }

  const db = readLocalDb();
  return {
    data: (db.user_data && db.user_data[cleanEmail]) || {},
    updatedAt: 0,
    storage: 'local'
  };
}

export async function syncUserData(email, incomingData) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const conn = await connectToDatabase();
  const now = new Date();

  if (conn.connected && conn.db) {
    try {
      await conn.db.collection('user_data').updateOne(
        { email: cleanEmail },
        {
          $set: {
            email: cleanEmail,
            data: incomingData,
            updatedAt: now
          }
        },
        { upsert: true }
      );
      return { success: true, storage: 'mongodb', updatedAt: now.getTime() };
    } catch (e) {
      console.error('[MongoDB] Error syncing user data:', e.message);
      if (isServerless) {
        throw new Error(`MongoDB sync failed: ${e.message}`);
      }
    }
  } else if (isServerless && process.env.MONGODB_URI) {
    throw new Error(`MongoDB database unreachable: ${conn.error || conn.reason || 'Check network whitelist'}`);
  }

  const db = readLocalDb();
  if (!db.user_data) db.user_data = {};
  db.user_data[cleanEmail] = incomingData;
  writeLocalDb(db);
  return { success: true, storage: 'local', updatedAt: now.getTime() };
}

export default async function handler(req, res) {
  const health = await checkDatabaseHealth();
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify({
    success: true,
    service: 'WalletWeather Database Module',
    ...health
  }));
}
