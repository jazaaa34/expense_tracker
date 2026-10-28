// ==============================================================================
// MULTI-USER OTP VERIFICATION INTEGRATION TEST
// Verifies MongoDB Atlas persistence, email normalization, multi-user isolation,
// and double-submit resilience.
// ==============================================================================

import { saveOtp, verifyOtp, connectToDatabase } from '../api/db.js';
import { handleOtpApi } from '../api/otpHandler.js';

async function runTests() {
  console.log('--- Starting Multi-User OTP Verification Test ---');

  const conn = await connectToDatabase();
  if (!conn.connected || !conn.db) {
    throw new Error('Database not connected. Please check MONGODB_URI.');
  }
  console.log('✓ Connected to MongoDB Atlas:', conn.db.databaseName);

  const testEmailA = '  Alice.Weather@Example.Com  ';
  const normalizedEmailA = 'alice.weather@example.com';
  const testEmailB = 'bob.finance@example.com';

  // 1. Test Save OTP for User A with mixed case & padding
  console.log('\n[Test 1] Saving OTP for User A (email with padding/uppercase)...');
  const saveResA = await saveOtp(testEmailA, '812495', 'Alice');
  if (!saveResA.success) throw new Error('Save OTP A failed: ' + saveResA.error);
  console.log('✓ Save OTP A succeeded.');

  // Verify stored in MongoDB Atlas under clean normalized email
  const docA = await conn.db.collection('otps').findOne({ email: normalizedEmailA });
  if (!docA) throw new Error('Document for User A not found in MongoDB otps collection!');
  if (docA.otp !== '812495') throw new Error(`Document OTP mismatch! Expected 812495, got ${docA.otp}`);
  console.log('✓ Stored in MongoDB Atlas otps collection under normalized email:', docA.email);

  // 2. Test Verify OTP for User A
  console.log('\n[Test 2] Verifying OTP for User A with padded email and digits...');
  const verifyResA = await verifyOtp('  alice.weather@example.com ', ' 812495 ');
  if (!verifyResA.success || !verifyResA.verified) throw new Error('Verification for User A failed: ' + JSON.stringify(verifyResA));
  console.log('✓ User A verified successfully.');

  // 3. Test Double-Submit / Race Condition Resilience for User A
  console.log('\n[Test 3] Testing duplicate verification submission (double-submit / serverless race condition)...');
  const dupResA = await verifyOtp(normalizedEmailA, '812495');
  if (!dupResA.success || !dupResA.verified) {
    throw new Error('Double-submit test failed: User A received error on duplicate submit: ' + JSON.stringify(dupResA));
  }
  console.log('✓ Double-submit safely acknowledged as verified.');

  // 4. Test User B independently (isolation check)
  console.log('\n[Test 4] Saving and verifying User B independently...');
  const saveResB = await saveOtp(testEmailB, '194823', 'Bob');
  if (!saveResB.success) throw new Error('Save OTP B failed: ' + saveResB.error);
  
  // Wrong code test for User B
  const wrongResB = await verifyOtp(testEmailB, '999999');
  if (wrongResB.success) throw new Error('Wrong code should have failed!');
  console.log('✓ Incorrect code properly rejected:', wrongResB.error);

  // Correct code test for User B
  const correctResB = await verifyOtp(testEmailB, '194823');
  if (!correctResB.success || !correctResB.verified) throw new Error('User B verification failed!');
  console.log('✓ User B verified successfully.');

  // 5. Test Non-existent Email
  console.log('\n[Test 5] Testing non-existent email verification...');
  const noneRes = await verifyOtp('nonexistent@example.com', '123456');
  if (noneRes.success) throw new Error('Non-existent email should have failed!');
  console.log('✓ Non-existent email properly returned error:', noneRes.error);

  // 6. Test HTTP handler dispatch via handleOtpApi
  console.log('\n[Test 6] Testing HTTP handler interface (handleOtpApi)...');
  const mockReq = {
    method: 'POST',
    url: '/api/auth/send-otp',
    headers: { host: 'localhost:5173' },
    body: { email: 'charlie@example.com', name: 'Charlie' }
  };
  let httpOutput = null;
  const mockRes = {
    setHeader: () => {},
    end: (str) => { httpOutput = JSON.parse(str); }
  };
  await handleOtpApi(mockReq, mockRes, '', 'jazaaa34@gmail.com', 'WalletWeather', 'send');
  if (!httpOutput || !httpOutput.success) throw new Error('HTTP send-otp failed: ' + JSON.stringify(httpOutput));
  console.log('✓ HTTP send-otp returned success with token.');

  // Clean up test documents
  await conn.db.collection('otps').deleteMany({
    email: { $in: [normalizedEmailA, testEmailB, 'charlie@example.com'] }
  });
  console.log('✓ Cleaned up test documents from MongoDB Atlas.');

  console.log('\n========================================');
  console.log('ALL MULTI-USER OTP TESTS PASSED! 🎉');
  console.log('========================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ Test failed:', err.message);
  process.exit(1);
});
