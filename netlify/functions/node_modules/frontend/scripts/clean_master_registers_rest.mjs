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

async function runRestCleanup() {
  console.log('⚡ Fetching masterRegisters via REST API...');
  
  let pageToken = '';
  let totalDocs = 0;
  let cleanedDocs = 0;
  let bytesSaved = 0;

  do {
    const url = `${BASE_URL}/masterRegisters?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await httpGet(url);
    const docs = res.documents || [];
    pageToken = res.nextPageToken || '';

    console.log(`Fetched chunk of ${docs.length} part documents...`);

    for (const docObj of docs) {
      totalDocs++;
      const fullPath = docObj.name;
      const docId = fullPath.split('/').pop();
      const fields = docObj.fields || {};

      const hasPhoto_id = 'photo_id' in fields && !!fields.photo_id.stringValue;
      const hasPhotoId = 'photoId' in fields && !!fields.photoId.stringValue;
      const hasStudentPhoto = 'Student Photo' in fields && !!fields['Student Photo']?.stringValue;

      if (hasPhoto_id && (hasPhotoId || hasStudentPhoto)) {
        cleanedDocs++;
        const bytesToRemove = (hasPhotoId ? (fields.photoId.stringValue.length || 0) : 0) +
                              (hasStudentPhoto ? (fields['Student Photo']?.stringValue?.length || 0) : 0);
        bytesSaved += bytesToRemove;

        console.log(`🔥 Cleaning "${docId}": Removing duplicate photo fields (${(bytesToRemove / 1024).toFixed(1)} KB)...`);

        // Build updated fields without photoId or Student Photo
        const newFields = { ...fields };
        delete newFields.photoId;
        delete newFields['Student Photo'];

        // Patch document replacing fields mask
        const patchUrl = `${BASE_URL}/masterRegisters/${encodeURIComponent(docId)}`;
        await httpPatch(patchUrl, { fields: newFields });
      }
    }
  } while (pageToken);

  const mbSaved = (bytesSaved / (1024 * 1024)).toFixed(3);
  console.log(`\n======================================================`);
  console.log(`🎉 REST API MASTER REGISTERS CLEANUP COMPLETE!`);
  console.log(` Total masterRegisters Part Documents: ${totalDocs}`);
  console.log(` Cleaned Part Documents: ${cleanedDocs}`);
  console.log(` Total Storage Saved: ${mbSaved} MB`);
  console.log(`======================================================\n`);
}

runRestCleanup().then(() => process.exit(0)).catch(e => {
  console.error('REST cleanup error:', e);
  process.exit(1);
});
