const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const svcPath = process.argv[2] || './scripts/serviceAccount.json';
if (!fs.existsSync(svcPath)) {
  console.error('serviceAccount.json not found at', svcPath);
  process.exit(2);
}
const serviceAccount = require(path.resolve(svcPath));

const credential = (admin.credential && typeof admin.credential.cert === 'function')
  ? admin.credential.cert(serviceAccount)
  : (typeof admin.cert === 'function' ? admin.cert(serviceAccount) : null);
if (!credential) {
  console.error('Cannot construct firebase-admin credential');
  process.exit(1);
}

const projectId = serviceAccount.project_id || process.env.REACT_APP_FIREBASE_PROJECT_ID || '';
const envBucket = process.env.REACT_APP_FIREBASE_STORAGE_BUCKET;
// Try a couple of common bucket name patterns used by Firebase
const fallbackBuckets = [];
if (projectId) {
  // prefer the newer firebase bucket hostname
  fallbackBuckets.push(`${projectId}.firebasestorage.app`);
  fallbackBuckets.push(`${projectId}.appspot.com`);
}
const storageBucket = envBucket || (fallbackBuckets.length ? fallbackBuckets[0] : null);

console.log('Using storage bucket:', storageBucket);
admin.initializeApp({ credential, storageBucket });

let bucket;
try {
  // newer firebase-admin versions provide storage via separate package
  const { getStorage } = require('firebase-admin/storage');
  bucket = getStorage().bucket();
} catch (e) {
  // fallback to older API
  if (typeof admin.storage === 'function') bucket = admin.storage().bucket();
}

if (!bucket) {
  console.error('Storage API not available in this firebase-admin installation');
  process.exit(1);
}

(async () => {
  try {
    const tmpFile = path.join(__dirname, 'upload-test.txt');
    fs.writeFileSync(tmpFile, `upload test at ${new Date().toISOString()}`);
    const destName = `tests/upload-test-${Date.now()}.txt`;
    await bucket.upload(tmpFile, { destination: destName });
    console.log('Upload successful to', destName);
    // cleanup
    fs.unlinkSync(tmpFile);
    process.exit(0);
  } catch (err) {
    console.error('Upload failed:', err);
    process.exit(1);
  }
})();
