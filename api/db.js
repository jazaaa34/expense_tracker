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

// Fallback file-based database path
const LOCAL_DB_DIR = path.join(__dirname, '..', 'data');
const LOCAL_DB_FILE = path.join(LOCAL_DB_DIR, 'db.json');

// In-memory cache when running locally or during connection
let mongoClient = null;
let mongoDb = null;
let isConnected = false;
let connectionAttempted = false;

// Ensure local db directory exists
function ensureLocalDb() {
  if (!fs.existsSync(LOCAL_DB_DIR)) {
    try {
      fs.mkdirSync(LOCAL_DB_DIR, { recursive: true });
    } catch (e) {
      // ignore
    }
  }
  if (!fs.existsSync(LOCAL_DB_FILE)) {
    try {
      fs.writeFileSync(
        LOCAL_DB_FILE,
        JSON.stringify({
          users: {},
          user_data: {},
          otps: {}
        }, null, 2),
        'utf8'
      );
    } catch (e) {
      // ignore
    }
  }
}

function readLocalDb() {
  ensureLocalDb();
  try {
    const raw = fs.readFileSync(LOCAL_DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { users: {}, user_data: {}, otps: {} };
  }
}

function writeLocalDb(data) {
  ensureLocalDb();
  try {
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to write local database file:', e.message);
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

  if (!forceReconnect && isConnected && mongoDb) {
    return { connected: true, db: mongoDb, type: 'mongodb' };
  }

  if (!uri) {
    return { connected: false, type: 'local', reason: 'MONGODB_URI not configured in .env' };
  }

  try {
    if (forceReconnect && mongoClient) {
      try {
        await mongoClient.close();
      } catch {
        // ignore
      }
      mongoClient = null;
      mongoDb = null;
      isConnected = false;
    }

    if (!mongoClient) {
      mongoClient = new MongoClient(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000
      });
    }

    await mongoClient.connect();
    // Default db name walletweather if not specified in URI
    const dbName = (process.env.MONGODB_DB_NAME || 'walletweather').trim();
    mongoDb = mongoClient.db(dbName);
    isConnected = true;

    // Create TTL index on otps collection so OTPs automatically expire after 10 minutes
    try {
      await mongoDb.collection('otps').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    } catch (idxErr) {
      // Index may already exist or user doesn't have createIndex permissions
    }

    console.log(`[MongoDB] Connected successfully to database: ${dbName}`);
    return { connected: true, db: mongoDb, type: 'mongodb' };
  } catch (err) {
    console.warn(`[MongoDB] Connection warning (${err.message}). Using local persistent database.`);
    isConnected = false;
    mongoDb = null;
    return { connected: false, type: 'local', error: err.message };
  }
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
// ==============================================================================

export async function saveOtp(email, otp, name = '') {
  const cleanEmail = email.toLowerCase().trim();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

  const conn = await connectToDatabase();
  if (conn.connected && mongoDb) {
    try {
      await mongoDb.collection('otps').updateOne(
        { email: cleanEmail },
        {
          $set: {
            email: cleanEmail,
            otp: String(otp).trim(),
            name: name ? name.trim() : '',
            createdAt: new Date(),
            expiresAt,
            attempts: 0
          }
        },
        { upsert: true }
      );
      return { success: true };
    } catch (e) {
      console.error('[MongoDB] Error saving OTP:', e.message);
    }
  }

  // Fallback: Local persistent store
  const db = readLocalDb();
  if (!db.otps) db.otps = {};
  db.otps[cleanEmail] = {
    email: cleanEmail,
    otp: String(otp).trim(),
    name: name ? name.trim() : '',
    createdAt: Date.now(),
    expiresAt: expiresAt.getTime(),
    attempts: 0
  };
  writeLocalDb(db);
  return { success: true };
}

export async function verifyOtp(email, submittedOtp) {
  const cleanEmail = email.toLowerCase().trim();
  const cleanOtp = String(submittedOtp || '').trim();

  const conn = await connectToDatabase();
  if (conn.connected && mongoDb) {
    try {
      const record = await mongoDb.collection('otps').findOne({ email: cleanEmail });
      if (!record) {
        return { success: false, error: 'No active verification code found for this email. Please request a new code.' };
      }

      if (new Date() > new Date(record.expiresAt)) {
        await mongoDb.collection('otps').deleteOne({ email: cleanEmail });
        return { success: false, error: 'Verification code has expired. Please request a new code.' };
      }

      const attempts = (record.attempts || 0) + 1;
      if (attempts > 5) {
        await mongoDb.collection('otps').deleteOne({ email: cleanEmail });
        return { success: false, error: 'Too many incorrect attempts. Please request a fresh verification code.' };
      }

      if (record.otp !== cleanOtp) {
        await mongoDb.collection('otps').updateOne({ email: cleanEmail }, { $set: { attempts } });
        const remaining = 5 - attempts;
        return { success: false, error: `Incorrect verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Code expired.'}` };
      }

      // Valid OTP! Delete it
      await mongoDb.collection('otps').deleteOne({ email: cleanEmail });
      return { success: true, verified: true };
    } catch (e) {
      console.error('[MongoDB] Error verifying OTP:', e.message);
    }
  }

  // Fallback: Local persistent store
  const db = readLocalDb();
  const record = db.otps ? db.otps[cleanEmail] : null;

  if (!record) {
    return { success: false, error: 'No active verification code found for this email. Please request a new code.' };
  }

  if (Date.now() > record.expiresAt) {
    delete db.otps[cleanEmail];
    writeLocalDb(db);
    return { success: false, error: 'Verification code has expired. Please request a new code.' };
  }

  record.attempts = (record.attempts || 0) + 1;
  if (record.attempts > 5) {
    delete db.otps[cleanEmail];
    writeLocalDb(db);
    return { success: false, error: 'Too many incorrect attempts. Please request a fresh verification code.' };
  }

  if (record.otp !== cleanOtp) {
    writeLocalDb(db);
    const remaining = 5 - record.attempts;
    return { success: false, error: `Incorrect verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Code expired.'}` };
  }

  delete db.otps[cleanEmail];
  writeLocalDb(db);
  return { success: true, verified: true };
}

// ==============================================================================
// USER ACCOUNT OPERATIONS
// ==============================================================================

export async function findUserByEmail(email) {
  const cleanEmail = email.toLowerCase().trim();
  const conn = await connectToDatabase();

  if (conn.connected && mongoDb) {
    try {
      const user = await mongoDb.collection('users').findOne({ email: cleanEmail });
      if (user) return user;
    } catch (e) {
      console.error('[MongoDB] Error finding user:', e.message);
    }
  }

  const db = readLocalDb();
  return (db.users && db.users[cleanEmail]) || null;
}

export async function saveUserAccount(userObj) {
  const cleanEmail = userObj.email.toLowerCase().trim();
  const record = {
    ...userObj,
    email: cleanEmail,
    updatedAt: new Date()
  };

  const conn = await connectToDatabase();
  if (conn.connected && mongoDb) {
    try {
      await mongoDb.collection('users').updateOne(
        { email: cleanEmail },
        { $set: record },
        { upsert: true }
      );
      return { success: true };
    } catch (e) {
      console.error('[MongoDB] Error saving user:', e.message);
    }
  }

  const db = readLocalDb();
  if (!db.users) db.users = {};
  db.users[cleanEmail] = record;
  writeLocalDb(db);
  return { success: true };
}

// ==============================================================================
// USER DATA SYNC (TRANSACTIONS, BUDGETS, ALERTS, GOALS)
// ==============================================================================

export async function getUserAllData(email) {
  const cleanEmail = email.toLowerCase().trim();
  const conn = await connectToDatabase();

  if (conn.connected && mongoDb) {
    try {
      const doc = await mongoDb.collection('user_data').findOne({ email: cleanEmail });
      if (doc) return doc.data || {};
    } catch (e) {
      console.error('[MongoDB] Error getting user data:', e.message);
    }
  }

  const db = readLocalDb();
  return (db.user_data && db.user_data[cleanEmail]) || {};
}

export async function syncUserData(email, incomingData) {
  const cleanEmail = email.toLowerCase().trim();
  const conn = await connectToDatabase();

  if (conn.connected && mongoDb) {
    try {
      await mongoDb.collection('user_data').updateOne(
        { email: cleanEmail },
        {
          $set: {
            email: cleanEmail,
            data: incomingData,
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );
      return { success: true, storage: 'mongodb' };
    } catch (e) {
      console.error('[MongoDB] Error syncing user data:', e.message);
    }
  }

  const db = readLocalDb();
  if (!db.user_data) db.user_data = {};
  db.user_data[cleanEmail] = incomingData;
  writeLocalDb(db);
  return { success: true, storage: 'local' };
}
