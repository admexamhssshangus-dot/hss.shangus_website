import https from 'https';

const PROJECT_ID = 'hsssdb';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
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
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function cleanPart109() {
  const url = `${BASE_URL}/masterRegisters/2022-23_11th_part109`;
  console.log('Fetching 2022-23_11th_part109...');
  const res = await httpGet(url);

  if (!res || !res.fields) {
    console.log('Document 2022-23_11th_part109 not found:', res);
    return;
  }

  const fields = res.fields;
  console.log('Original fields present in 2022-23_11th_part109:');
  console.log('  - photoId:', !!fields.photoId);
  console.log('  - photo_id:', !!fields.photo_id);
  console.log('  - Student Photo:', !!fields['Student Photo']);

  // Remove photoId and Student Photo
  const newFields = { ...fields };
  delete newFields.photoId;
  delete newFields['Student Photo'];

  console.log('\nPatching 2022-23_11th_part109 to remove photoId & Student Photo...');
  const patchRes = await httpPatch(url, { fields: newFields });
  console.log('Patch response fields remaining:');
  console.log('  - photoId:', !!patchRes.fields?.photoId);
  console.log('  - photo_id:', !!patchRes.fields?.photo_id);
  console.log('  - Student Photo:', !!patchRes.fields?.['Student Photo']);
}

cleanPart109().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
