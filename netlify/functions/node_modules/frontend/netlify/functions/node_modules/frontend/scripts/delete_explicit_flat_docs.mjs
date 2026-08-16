import https from 'https';

const BASE_URL = 'https://firestore.googleapis.com/v1/projects/hsssdb/databases/(default)/documents';

function httpDelete(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = { hostname: u.hostname, path: u.pathname, method: 'DELETE' };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

// All the flat doc IDs visible in the Firebase console screenshots
const docsToDelete = [
  '250218', '250429', '2604', '3189', '3209', '3215', '3259', '3261',
  '3264', '3266', '3273', '3280', '3300', '3338', '3428', '3454',
  '3464', '3479', '3483'
];

async function deleteExplicit() {
  console.log(`🗑️ Deleting ${docsToDelete.length} flat docs from masterRegisters...\n`);

  let deleted = 0;
  let notFound = 0;

  for (const docId of docsToDelete) {
    const url = `${BASE_URL}/masterRegisters/${docId}`;
    try {
      const res = await httpDelete(url);
      if (res.status === 200) {
        deleted++;
        console.log(`  ✅ Deleted "${docId}"`);
      } else if (res.status === 404) {
        notFound++;
        console.log(`  ⏭️ "${docId}" not found (already deleted)`);
      } else {
        console.log(`  ⚠️ "${docId}" status ${res.status}: ${res.body.substring(0, 100)}`);
      }
    } catch (e) {
      console.error(`  ❌ "${docId}":`, e.message);
    }
  }

  console.log(`\n🎉 Done! Deleted: ${deleted}, Not Found: ${notFound}, Total: ${docsToDelete.length}`);
}

deleteExplicit().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
