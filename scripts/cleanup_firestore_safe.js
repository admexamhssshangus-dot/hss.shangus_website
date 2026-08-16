'use strict';

// Deletes only Firestore data that is proven redundant by an exact fingerprint
// match. Dry-run by default; pass --apply-safe to perform the delete.
const path = require('path');
const crypto = require('crypto');

const functionDirectory = path.join(__dirname, '..', 'netlify', 'functions');
const { initializeApp, cert } = require(require.resolve('firebase-admin/app', { paths: [functionDirectory] }));
const { getFirestore } = require(require.resolve('firebase-admin/firestore', { paths: [functionDirectory] }));
const serviceAccount = require(path.join(__dirname, 'serviceAccount.json'));

const apply = process.argv.includes('--apply-safe');
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

function canonicalize(value) {
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((acc, key) => {
    acc[key] = canonicalize(value[key]);
    return acc;
  }, {});
}

function logFingerprint(data) {
  const clean = { ...data };
  delete clean.createdAt;
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(clean))).digest('hex');
}

async function main() {
  const [adminLogs, activityLogs] = await Promise.all([
    db.collection('adminActivityLogs').get(),
    db.collection('activityLogs').get(),
  ]);

  const activityFingerprints = new Set(activityLogs.docs.map(doc => logFingerprint(doc.data())));
  const mirroredDocs = adminLogs.docs.filter(doc => activityFingerprints.has(logFingerprint(doc.data())));
  const unmatched = adminLogs.size - mirroredDocs.length;

  console.log(`adminActivityLogs documents: ${adminLogs.size}`);
  console.log(`Exact mirrors already present in activityLogs: ${mirroredDocs.length}`);
  console.log(`Unmatched adminActivityLogs documents: ${unmatched}`);

  if (unmatched > 0) {
    console.log('Aborting: not every adminActivityLogs document is safely mirrored.');
    process.exitCode = 1;
    return;
  }

  if (!apply) {
    console.log('Dry run only. Re-run with --apply-safe to delete these mirrored adminActivityLogs documents.');
    console.log('No student, admission, master-register, recycle-bin, or configuration documents were changed.');
    return;
  }

  const writer = db.bulkWriter();
  mirroredDocs.forEach(doc => writer.delete(doc.ref));
  await writer.close();
  console.log(`Deleted ${mirroredDocs.length} mirrored adminActivityLogs documents.`);
  console.log('No student, admission, master-register, recycle-bin, or configuration documents were changed.');
}

main().then(() => process.exit(process.exitCode || 0)).catch(error => {
  console.error(`Safe Firestore cleanup failed: ${error.message}`);
  process.exit(1);
});
