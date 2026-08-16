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

function httpDelete(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = { hostname: u.hostname, path: u.pathname, method: 'DELETE' };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.end();
  });
}

async function deleteNumericFlatDocs() {
  console.log('🔍 Scanning masterRegisters for numeric-ID flat docs to delete...\n');

  let pageToken = '';
  let totalDocs = 0;
  const toDelete = [];

  do {
    const url = `${BASE_URL}/masterRegisters?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await httpGet(url);
    const docs = res.documents || [];
    pageToken = res.nextPageToken || '';

    for (const docObj of docs) {
      totalDocs++;
      const docId = docObj.name.split('/').pop();
      const fields = docObj.fields || {};

      // Legitimate part docs have: items, part, groupKey, parentGroup
      const hasItems = !!fields.items;
      const hasPart = !!fields.part;
      const hasGroupKey = !!fields.groupKey;

      // If it's NOT a legitimate part doc (no items/part/groupKey), it's a stale flat doc
      if (!hasItems && !hasPart && !hasGroupKey) {
        const name = fields["Student's Name (as per school records)"]?.stringValue
          || fields.studentName?.stringValue
          || 'N/A';
        const fieldCount = Object.keys(fields).length;
        toDelete.push({ docId, name, fieldCount });
      }
    }
  } while (pageToken);

  console.log(`Total masterRegisters docs scanned: ${totalDocs}`);
  console.log(`Stale flat docs to delete: ${toDelete.length}\n`);

  if (toDelete.length > 0) {
    console.log('Documents to delete:');
    for (const d of toDelete) {
      console.log(`  - "${d.docId}" | ${d.name} | ${d.fieldCount} fields`);
    }

    console.log(`\n🗑️ Deleting ${toDelete.length} stale flat docs from masterRegisters...`);
    let deleted = 0;
    for (const d of toDelete) {
      try {
        await httpDelete(`${BASE_URL}/masterRegisters/${encodeURIComponent(d.docId)}`);
        deleted++;
        console.log(`  ✅ Deleted "${d.docId}"`);
      } catch (e) {
        console.error(`  ❌ Failed "${d.docId}":`, e.message);
      }
    }
    console.log(`\n🎉 Deleted ${deleted}/${toDelete.length} stale flat docs from masterRegisters.`);
  } else {
    console.log('✅ No stale flat docs found — masterRegisters is clean!');
  }
}

deleteNumericFlatDocs().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
