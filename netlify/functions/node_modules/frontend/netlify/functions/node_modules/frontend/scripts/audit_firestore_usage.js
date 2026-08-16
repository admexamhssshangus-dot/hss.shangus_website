'use strict';

// Read-efficient Firestore inventory for Spark projects. Default mode uses
// aggregation counts only; deep mode downloads documents for aggregate sizing.
const path = require('path');
const crypto = require('crypto');
const functionDirectory = path.join(__dirname, '..', 'netlify', 'functions');
const { initializeApp, cert } = require(require.resolve('firebase-admin/app', { paths: [functionDirectory] }));
const { getFirestore } = require(require.resolve('firebase-admin/firestore', { paths: [functionDirectory] }));
const serviceAccount = require(path.join(__dirname, 'serviceAccount.json'));

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function countCollection(collectionRef) {
  const snapshot = await collectionRef.count().get();
  return Number(snapshot.data().count || 0);
}

async function main() {
  const collections = await db.listCollections();
  const rows = [];
  for (const collectionRef of collections.sort((a, b) => a.id.localeCompare(b.id))) {
    try {
      rows.push({ Collection: collectionRef.id, Documents: await countCollection(collectionRef) });
    } catch (error) {
      rows.push({ Collection: collectionRef.id, Documents: `ERROR: ${error.message}` });
    }
  }

  const total = rows.reduce((sum, row) => sum + (Number.isFinite(row.Documents) ? row.Documents : 0), 0);
  console.table(rows);
  console.log(`Top-level collections: ${rows.length}`);
  console.log(`Top-level documents: ${total}`);
  if (!process.argv.includes('--deep')) {
    console.log('No documents were downloaded, changed, or deleted.');
    return;
  }
  console.log('Deep mode downloads documents for aggregate measurement only. No document data is printed, changed, or deleted.');

  const deepRows = [];
  const photoHashes = new Map();
  let expiredDocuments = 0;
  let explicitlyDeletedDocuments = 0;
  let duplicatedPhotoFields = 0;
  const softDeletedByCollection = new Map();
  const photoPathCounts = new Map();
  const photoLocations = new Map();

  for (const collectionRef of collections.sort((a, b) => a.id.localeCompare(b.id))) {
    const snapshot = await collectionRef.get();
    let payloadBytes = 0;
    let inlinePhotoBytes = 0;
    let inlinePhotoFields = 0;
    let collectionExpired = 0;

    snapshot.docs.forEach(documentSnapshot => {
      const data = documentSnapshot.data();
      const json = JSON.stringify(data);
      payloadBytes += Buffer.byteLength(json, 'utf8') + Buffer.byteLength(documentSnapshot.id, 'utf8');

      const expiry = data.expiresAt?.toMillis?.() || Date.parse(data.expiresAt || '') || 0;
      if (expiry && expiry < Date.now()) {
        collectionExpired += 1;
        expiredDocuments += 1;
      }
      if ((data.Status === 'Deleted' || data.status === 'Deleted') && data._deleted === true) {
        explicitlyDeletedDocuments += 1;
        softDeletedByCollection.set(collectionRef.id, (softDeletedByCollection.get(collectionRef.id) || 0) + 1);
      }

      const photosInDocument = [];
      const visit = (value, currentPath = '') => {
        if (!value || typeof value !== 'object') return;
        Object.entries(value).forEach(([key, child]) => {
          const normalizedKey = /^\d+$/.test(key) ? '[]' : key;
          const childPath = currentPath ? `${currentPath}.${normalizedKey}` : normalizedKey;
          if (typeof child === 'string' && /^data:image\/(jpeg|png|webp);base64,/i.test(child)) {
            const encoded = child.slice(child.indexOf(',') + 1);
            const bytes = Math.floor(encoded.length * 3 / 4);
            const hash = crypto.createHash('sha256').update(child).digest('hex');
            inlinePhotoFields += 1;
            inlinePhotoBytes += bytes;
            photosInDocument.push(hash);
            photoHashes.set(hash, (photoHashes.get(hash) || 0) + 1);
            const pathKey = `${collectionRef.id}:${childPath}`;
            photoPathCounts.set(pathKey, (photoPathCounts.get(pathKey) || 0) + 1);
            const locations = photoLocations.get(hash) || new Set();
            locations.add(collectionRef.id);
            photoLocations.set(hash, locations);
          } else if (child && typeof child === 'object') visit(child, childPath);
        });
      };
      visit(data);
      duplicatedPhotoFields += photosInDocument.length - new Set(photosInDocument).size;
    });

    deepRows.push({
      Collection: collectionRef.id,
      Documents: snapshot.size,
      'Payload MiB': (payloadBytes / 1048576).toFixed(3),
      'Inline photos': inlinePhotoFields,
      'Photo MiB': (inlinePhotoBytes / 1048576).toFixed(3),
      Expired: collectionExpired,
    });
  }

  const repeatedPhotoPayloads = [...photoHashes.values()].filter(count => count > 1);
  console.table(deepRows);
  console.log(`Expired documents: ${expiredDocuments}`);
  console.log(`Explicitly soft-deleted active documents: ${explicitlyDeletedDocuments}`);
  console.log(`Duplicate inline-photo fields within the same document: ${duplicatedPhotoFields}`);
  console.log(`Photo payloads repeated across documents/collections: ${repeatedPhotoPayloads.length}`);
  console.log('Explicitly soft-deleted documents by collection:', Object.fromEntries(softDeletedByCollection));
  console.log('Inline photo fields by normalized path:', Object.fromEntries([...photoPathCounts.entries()].sort((a, b) => b[1] - a[1])));
  const crossCollectionPhotos = [...photoLocations.values()].filter(locations => locations.size > 1).length;
  console.log(`Photo payloads present in more than one collection: ${crossCollectionPhotos}`);

  const [adminLogs, activityLogs] = await Promise.all([
    db.collection('adminActivityLogs').get(),
    db.collection('activityLogs').get(),
  ]);
  const canonicalize = value => {
    if (value && typeof value.toMillis === 'function') return value.toMillis();
    if (Array.isArray(value)) return value.map(canonicalize);
    if (!value || typeof value !== 'object') return value;
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = canonicalize(value[key]);
      return acc;
    }, {});
  };
  const logFingerprint = data => {
    const clean = { ...data };
    delete clean.createdAt;
    return crypto.createHash('sha256').update(JSON.stringify(canonicalize(clean))).digest('hex');
  };
  const activityFingerprints = new Set(activityLogs.docs.map(doc => logFingerprint(doc.data())));
  const mirroredAdminLogs = adminLogs.docs.filter(doc => activityFingerprints.has(logFingerprint(doc.data()))).length;
  console.log(`adminActivityLogs mirrored in activityLogs: ${mirroredAdminLogs}/${adminLogs.size}`);
  console.log('Deep mode downloaded documents for measurement but did not print, change, or delete document data.');
}

main().then(() => process.exit(0)).catch(error => {
  console.error(`Firestore usage audit failed: ${error.message}`);
  process.exit(1);
});
