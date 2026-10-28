// ==============================================================================
// TEST DATA PERSISTENCE & MULTI-USER ISOLATION
// Verifies data persistence, cloud sync, and isolation in MongoDB Atlas
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const k = match[1];
      let v = match[2] || '';
      v = v.trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

async function run() {
  console.log('[Test] Importing db handlers...');
  const { connectToDatabase, syncUserData, getUserAllData } = await import('../api/db.js');

  const conn = await connectToDatabase();
  console.log('[Test] MongoDB connected:', conn.connected, 'Storage:', conn.storage);

  if (!conn.connected || !conn.db) {
    console.error('[Test] FAIL: Could not connect to live MongoDB Atlas.');
    process.exit(1);
  }

  const testEmailA = `test_persist_a_${Date.now()}@example.com`;
  const testEmailB = `test_persist_b_${Date.now()}@example.com`;

  try {
    // 1. Prepare sample user data for User A
    const sampleDataA = {
      transactions: [
        {
          id: 'txn_101',
          name: 'Supermarket Grocery Restock',
          category: 'Groceries',
          amount: 2850,
          isExpense: true,
          date: '2026-10-28T09:00:00.000Z',
          updatedAt: '2026-10-28T09:00:00.000Z'
        },
        {
          id: 'txn_102',
          name: 'Consulting Payout',
          category: 'Salary',
          amount: 35000,
          isExpense: false,
          date: '2026-10-28T10:00:00.000Z',
          updatedAt: '2026-10-28T10:00:00.000Z'
        }
      ],
      budgets: {
        'Groceries': 5000,
        'Food & Dining': 3000
      },
      goals: [
        { id: 'g_1', title: 'New Laptop', targetAmount: 85000, savedAmount: 25000 }
      ],
      alerts: [
        { id: 'al_1', title: 'Price Increase Notice', isResolved: false }
      ],
      savedAmount: 25000,
      utilityCaps: { electricity: 3000 }
    };

    console.log('[Test] 1. Syncing data for User A:', testEmailA);
    const syncResA = await syncUserData(testEmailA, sampleDataA);
    console.log('[Test] User A sync result:', syncResA.storage, 'Success:', syncResA.success);
    if (!syncResA.success || syncResA.storage !== 'mongodb') {
      throw new Error(`Failed to save User A data to MongoDB (storage was ${syncResA.storage})`);
    }

    // 2. Fetch data for User A
    console.log('[Test] 2. Fetching saved data for User A...');
    const fetchResA = await getUserAllData(testEmailA);
    console.log('[Test] Fetched data for User A:', {
      txns: fetchResA.data?.transactions?.length,
      budgets: Object.keys(fetchResA.data?.budgets || {}),
      savedAmount: fetchResA.data?.savedAmount,
      storage: fetchResA.storage,
      updatedAt: fetchResA.updatedAt
    });

    if (fetchResA.data?.transactions?.length !== 2) {
      throw new Error(`Expected 2 transactions for User A, got ${fetchResA.data?.transactions?.length}`);
    }
    if (fetchResA.data?.savedAmount !== 25000) {
      throw new Error(`Expected savedAmount 25000 for User A, got ${fetchResA.data?.savedAmount}`);
    }
    if (fetchResA.data?.budgets?.['Groceries'] !== 5000) {
      throw new Error(`Expected Groceries budget 5000 for User A, got ${fetchResA.data?.budgets?.['Groceries']}`);
    }

    // 3. User B isolation check: User B has separate data
    console.log('[Test] 3. Syncing distinct data for User B:', testEmailB);
    const sampleDataB = {
      transactions: [
        {
          id: 'txn_201',
          name: 'Bookstore',
          category: 'Education & Books',
          amount: 450,
          isExpense: true,
          date: '2026-10-28T08:30:00.000Z',
          updatedAt: '2026-10-28T08:30:00.000Z'
        }
      ],
      budgets: { 'Education & Books': 2000 },
      goals: [],
      alerts: [],
      savedAmount: 500,
      utilityCaps: {}
    };

    const syncResB = await syncUserData(testEmailB, sampleDataB);
    if (!syncResB.success || syncResB.storage !== 'mongodb') {
      throw new Error(`Failed to save User B data to MongoDB`);
    }

    console.log('[Test] 4. Verifying User B data does not overwrite User A...');
    const verifyA = await getUserAllData(testEmailA);
    const verifyB = await getUserAllData(testEmailB);

    if (verifyA.data?.transactions?.length !== 2) {
      throw new Error('User A data was corrupted by User B');
    }
    if (verifyB.data?.transactions?.length !== 1) {
      throw new Error('User B data was not saved correctly');
    }

    // 4. Update data for User A: add a 3rd transaction
    console.log('[Test] 5. Simulating user adding a 3rd transaction after some time...');
    const updatedSampleA = {
      ...sampleDataA,
      transactions: [
        {
          id: 'txn_103',
          name: 'Weekend Coffee',
          category: 'Food & Dining',
          amount: 220,
          isExpense: true,
          date: '2026-10-28T11:00:00.000Z',
          updatedAt: '2026-10-28T11:00:00.000Z'
        },
        ...sampleDataA.transactions
      ]
    };
    await syncUserData(testEmailA, updatedSampleA);

    const reFetchA = await getUserAllData(testEmailA);
    console.log('[Test] Re-fetched User A after update:', {
      txns: reFetchA.data?.transactions?.length,
      firstTxn: reFetchA.data?.transactions?.[0]?.name
    });

    if (reFetchA.data?.transactions?.length !== 3) {
      throw new Error(`Expected 3 transactions after update, got ${reFetchA.data?.transactions?.length}`);
    }
    if (reFetchA.data?.transactions?.[0]?.id !== 'txn_103') {
      throw new Error('First transaction should be txn_103');
    }

    console.log('[Test] SUCCESS: Data persistence, multi-user isolation, and re-entry sync verified in MongoDB Atlas!');
  } finally {
    // Clean up test documents
    console.log('[Test] Cleaning up test records in Atlas...');
    await conn.db.collection('user_data').deleteMany({
      email: { $in: [testEmailA, testEmailB] }
    });
    console.log('[Test] Cleanup complete.');
  }
}

run().catch((err) => {
  console.error('[Test] Unhandled error:', err.message);
  process.exit(1);
});
