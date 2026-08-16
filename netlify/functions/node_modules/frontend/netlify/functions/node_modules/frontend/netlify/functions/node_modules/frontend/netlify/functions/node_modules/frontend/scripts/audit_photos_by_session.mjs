import https from 'https';

const BASE_URL = 'https://firestore.googleapis.com/v1/projects/hsssdb/databases/(default)/documents';

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });
}

async function auditPhotosBySession() {
  console.log('🔍 Auditing which sessions have photo data in masterRegisters...\n');

  let pageToken = '';
  let totalDocs = 0;
  const sessionPhotoStats = {}; // { "2022-23_11th": { totalItems: 100, itemsWithPhoto: 50, samplePhoto: "data:image..." } }

  do {
    const url = `${BASE_URL}/masterRegisters?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await httpGet(url);
    const docs = res.documents || [];
    pageToken = res.nextPageToken || '';

    for (const docObj of docs) {
      totalDocs++;
      const fields = docObj.fields || {};
      const parentGroup = fields.parentGroup?.stringValue || 'unknown';

      if (!sessionPhotoStats[parentGroup]) {
        sessionPhotoStats[parentGroup] = { totalItems: 0, itemsWithPhoto: 0, samplePhotoLen: 0 };
      }

      if (!fields.items?.arrayValue?.values) continue;

      const values = fields.items.arrayValue.values;
      for (const valObj of values) {
        if (!valObj.mapValue?.fields) continue;
        const itemFields = valObj.mapValue.fields;
        sessionPhotoStats[parentGroup].totalItems++;

        const photoVal = itemFields.photo_id?.stringValue
          || itemFields.photoId?.stringValue
          || itemFields['Student Photo']?.stringValue
          || '';

        if (photoVal && photoVal.startsWith('data:image')) {
          sessionPhotoStats[parentGroup].itemsWithPhoto++;
          if (!sessionPhotoStats[parentGroup].samplePhotoLen) {
            sessionPhotoStats[parentGroup].samplePhotoLen = photoVal.length;
          }
        }
      }
    }
  } while (pageToken);

  console.log(`Total part docs scanned: ${totalDocs}\n`);
  console.log('Session Photo Audit:');
  console.log('─'.repeat(90));
  console.log(`${'Session'.padEnd(25)} ${'Total Items'.padEnd(15)} ${'With Photo'.padEnd(15)} ${'% With Photo'.padEnd(15)} ${'Sample Size'}`);
  console.log('─'.repeat(90));

  const sorted = Object.entries(sessionPhotoStats).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [session, stats] of sorted) {
    const pct = stats.totalItems > 0 ? ((stats.itemsWithPhoto / stats.totalItems) * 100).toFixed(1) : '0.0';
    const sampleKB = stats.samplePhotoLen > 0 ? `${(stats.samplePhotoLen / 1024).toFixed(0)} KB` : 'N/A';
    console.log(`${session.padEnd(25)} ${String(stats.totalItems).padEnd(15)} ${String(stats.itemsWithPhoto).padEnd(15)} ${(pct + '%').padEnd(15)} ${sampleKB}`);
  }
  console.log('─'.repeat(90));

  // Identify suspicious sessions (old sessions with photos)
  const suspicious = sorted.filter(([session, stats]) => {
    const year = parseInt(session.split('-')[0]);
    return year < 2020 && stats.itemsWithPhoto > 0;
  });

  if (suspicious.length > 0) {
    console.log('\n⚠️ SUSPICIOUS: Old sessions (pre-2020) with photo data:');
    for (const [session, stats] of suspicious) {
      console.log(`  ⚠️ ${session}: ${stats.itemsWithPhoto} items have photos`);
    }
  }
}

auditPhotosBySession().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
