import crypto from 'node:crypto';

console.log('🧪 Testing AdMob Server-to-Server Verification (S2SV) logic...\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failed++;
  }
}

// 1. Generate ECDSA P-256 test key pair matching Google AdMob S2SV key specs
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const keyId = '1234567890';
const customDataPayload = JSON.stringify({
  userId: 'test-user-uuid-1234',
  streakType: 'daily',
  restoreSession: 'test-session-uuid-5678',
});

const baseParams = [
  'ad_network=54321',
  'ad_unit=ca-app-pub-3940256099942544/1712485313',
  `custom_data=${encodeURIComponent(customDataPayload)}`,
  'reward_amount=1',
  'reward_item=streak',
  `timestamp=${Date.now()}`,
  'transaction_id=txn_test_abc123',
  'user_id=test-user-uuid-1234',
].join('&');

// AdMob specifies that the query parameters before signature are the payload to be verified
const signer = crypto.createSign('SHA256');
signer.update(baseParams);
const signatureDer = signer.sign(privateKey);
const signatureBase64Url = signatureDer.toString('base64url');

// Full callback query string as sent by AdMob:
const fullQuery = `${baseParams}&signature=${signatureBase64Url}&key_id=${keyId}`;

// --- Test 1: Query Isolation ---
const sigIndex = fullQuery.indexOf('&signature=');
assert(sigIndex !== -1, 'Isolated &signature= in query string');
const extractedContent = fullQuery.substring(0, sigIndex);
assert(extractedContent === baseParams, 'Extracted content exactly matches signed content');

// --- Test 2: Signature Validation ---
const normalizedSig = signatureBase64Url.replace(/-/g, '+').replace(/_/g, '/');
const sigBuffer = Buffer.from(normalizedSig, 'base64');
const verifier = crypto.createVerify('SHA256');
verifier.update(extractedContent);
const isValid = verifier.verify(publicKey, sigBuffer);
assert(isValid === true, 'Signature correctly validated with public key');

// --- Test 3: Tamper Detection (Tampered user_id) ---
const tamperedParams = baseParams.replace('test-user-uuid-1234', 'attacker-user-uuid-9999');
const tamperedVerifier = crypto.createVerify('SHA256');
tamperedVerifier.update(tamperedParams);
const isTamperedValid = tamperedVerifier.verify(publicKey, sigBuffer);
assert(isTamperedValid === false, 'Tampered parameters correctly rejected');

// --- Test 4: Tamper Detection (Tampered custom_data) ---
const tamperedCustomData = baseParams.replace(encodeURIComponent(customDataPayload), encodeURIComponent('{"userId":"attacker"}'));
const tamperedCustomVerifier = crypto.createVerify('SHA256');
tamperedCustomVerifier.update(tamperedCustomData);
const isCustomDataTamperedValid = tamperedCustomVerifier.verify(publicKey, sigBuffer);
assert(isCustomDataTamperedValid === false, 'Tampered custom_data correctly rejected');

// --- Test 5: Parsing custom_data payload ---
const urlObj = new URL(`https://example.com/verify-ad-reward?${fullQuery}`);
const parsedCustomData = JSON.parse(decodeURIComponent(urlObj.searchParams.get('custom_data') || ''));
assert(parsedCustomData.userId === 'test-user-uuid-1234', 'Parsed userId matches');
assert(parsedCustomData.streakType === 'daily', 'Parsed streakType matches');
assert(parsedCustomData.restoreSession === 'test-session-uuid-5678', 'Parsed restoreSession matches');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 All AdMob S2SV unit tests passed successfully!\n');
}
