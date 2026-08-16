import https from 'https';

const PROJECT_ID = 'hsssdb';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function httpPatch(url, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runDeepRestCleanup() {
  console.log('⚡ Starting High-Speed REST API masterRegisters Deep Clean...\n');

  let pageToken = '';
  let totalDocsScanned = 0;
  let totalDocsCleaned = 0;
  let totalItemsCleaned = 0;
  let totalBytesSaved = 0;

  do {
    const url = `${BASE_URL}/masterRegisters?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await httpGet(url);
    const docs = res.documents || [];
    pageToken = res.nextPageToken || '';

    console.log(`Fetched page of ${docs.length} part documents...`);

    for (const docObj of docs) {
      totalDocsScanned++;
      const fullPath = docObj.name;
      const docId = fullPath.split('/').pop();
      const fields = docObj.fields || {};

      if (!fields.items || !fields.items.arrayValue || !Array.isArray(fields.items.arrayValue.values)) {
        continue;
      }

      const values = fields.items.arrayValue.values;
      let docModified = false;
      let docBytesSaved = 0;
      let itemsCleanedInDoc = 0;

      for (const valObj of values) {
        if (!valObj.mapValue || !valObj.mapValue.fields) continue;
        const itemFields = valObj.mapValue.fields;

        const pPrimary = itemFields.photo_id?.stringValue || '';
        const pAlt1 = itemFields.photoId?.stringValue || '';
        const pAlt2 = itemFields['Student Photo']?.stringValue || '';
        const pAlt3 = itemFields.photoUrl?.stringValue || '';
        const mainPhoto = pPrimary || pAlt1 || pAlt2 || pAlt3;

        if (!mainPhoto || !mainPhoto.startsWith('data:image')) continue;

        itemFields.photo_id = { stringValue: mainPhoto };

        if ('photoId' in itemFields) {
          const sz = itemFields.photoId.stringValue?.length || 0;
          docBytesSaved += sz;
          delete itemFields.photoId;
          docModified = true;
        }
        if ('Student Photo' in itemFields) {
          const sz = itemFields['Student Photo'].stringValue?.length || 0;
          docBytesSaved += sz;
          delete itemFields['Student Photo'];
          docModified = true;
        }

        if (docModified) itemsCleanedInDoc++;
      }

      if (docModified) {
        totalDocsCleaned++;
        totalItemsCleaned += itemsCleanedInDoc;
        totalBytesSaved += docBytesSaved;

        console.log(`🔥 [${totalDocsScanned}] Cleaned "${docId}": Purged duplicate photo fields from ${itemsCleanedInDoc} items (Saved ${(docBytesSaved / 1024).toFixed(1)} KB)...`);

        const patchUrl = `${BASE_URL}/masterRegisters/${encodeURIComponent(docId)}`;
        await httpPatch(patchUrl, { fields });
      }
    }
  } while (pageToken);

  const totalSavedMB = (totalBytesSaved / (1024 * 1024)).toFixed(3);
  console.log(`\n======================================================`);
  console.log(`🎉 HIGH-SPEED REST MASTER REGISTERS CLEANUP COMPLETE!`);
  console.log(` Total Part Docs Scanned: ${totalDocsScanned}`);
  console.log(` Part Docs Cleaned: ${totalDocsCleaned}`);
  console.log(` Total Student Array Items Cleaned: ${totalItemsCleaned}`);
  console.log(` Real Storage Saved in masterRegisters: ${totalSavedMB} MB`);
  console.log(`======================================================\n`);
}

runDeepRestCleanup().then(() => process.exit(0)).catch(e => {
  console.error('Fatal REST cleanup error:', e);
  process.exit(1);
});
