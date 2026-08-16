const path = require('node:path');
const admin = require('firebase-admin');

const root = path.resolve(__dirname, '..');
const serviceAccount = require(path.join(root, 'scripts', 'serviceAccount.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'hsssdb' });

(async () => {
  const snapshot = await admin.firestore().collection('users').get();
  const counts = new Map();
  const casePairs = new Map();
  const legacyAssignmentExamples = [];
  for (const doc of snapshot.docs) {
    const keys = Object.keys(doc.data() || {});
    const data = doc.data() || {};
    if (data.InitialClass !== undefined || data.InitialSubject !== undefined || data.Class !== undefined) {
      legacyAssignmentExamples.push({
        id: doc.id,
        role: data.role || data.Role || null,
        InitialClass: data.InitialClass || null,
        InitialSubject: data.InitialSubject || null,
        Class: data.Class || null,
      });
    }
    for (const key of keys) counts.set(key, (counts.get(key) || 0) + 1);
    const byLower = new Map();
    for (const key of keys) {
      const lower = key.toLowerCase();
      if (!byLower.has(lower)) byLower.set(lower, []);
      byLower.get(lower).push(key);
    }
    for (const [lower, variants] of byLower) {
      if (variants.length > 1) {
        const pair = `${lower}: ${variants.sort().join(', ')}`;
        casePairs.set(pair, (casePairs.get(pair) || 0) + 1);
      }
    }
  }
  console.log(JSON.stringify({
    documents: snapshot.size,
    fieldCounts: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([field, documents]) => ({ field, documents })),
    duplicateCaseVariants: [...casePairs.entries()].sort((a, b) => b[1] - a[1]).map(([fields, documents]) => ({ fields, documents })),
    legacyAssignmentExamples,
  }, null, 2));
})().finally(() => admin.app().delete()).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
