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

async function findAndRemoveStaleCurrentDocs() {
  console.log('🔍 Scanning masterRegisters for flat docs that should be in admissions only...\n');

  let pageToken = '';
  let totalDocs = 0;
  let staleDocs = [];

  do {
    const url = `${BASE_URL}/masterRegisters?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await httpGet(url);
    const docs = res.documents || [];
    pageToken = res.nextPageToken || '';

    for (const docObj of docs) {
      totalDocs++;
      const docId = docObj.name.split('/').pop();
      const fields = docObj.fields || {};

      // Legitimate masterRegisters docs have: items (array), part, totalParts, groupKey, parentGroup
      const hasItems = !!fields.items;
      const hasPart = !!fields.part;
      const hasGroupKey = !!fields.groupKey;

      // Flat admission-style docs have: Form Number, Status, studentName, etc. but NO items/part/groupKey
      const hasFormNumber = !!fields['Form Number'];
      const hasStatus = !!fields.Status;

      if (!hasItems && !hasPart && !hasGroupKey && (hasFormNumber || hasStatus)) {
        const name = fields["Student's Name (as per school records)"]?.stringValue
          || fields.studentName?.stringValue
          || fields["Student's Name"]?.stringValue
          || 'Unknown';
        const formNo = fields['Form Number']?.stringValue || docId;
        const status = fields.Status?.stringValue || fields.status?.stringValue || 'N/A';
        const session = fields.Session?.stringValue || fields.session?.stringValue || 'N/A';

        staleDocs.push({ docId, name, formNo, status, session });
      }
    }
  } while (pageToken);

  console.log(`Total masterRegisters docs scanned: ${totalDocs}`);
  console.log(`Stale flat docs found (should be in admissions only): ${staleDocs.length}\n`);

  if (staleDocs.length > 0) {
    console.log('Stale Documents:');
    for (const d of staleDocs) {
      console.log(`  - "${d.docId}" | ${d.name} | Form: ${d.formNo} | Status: ${d.status} | Session: ${d.session}`);
    }

    console.log(`\n🗑️ Deleting ${staleDocs.length} stale flat docs from masterRegisters...`);
    let deleted = 0;
    for (const d of staleDocs) {
      try {
        await httpDelete(`${BASE_URL}/masterRegisters/${encodeURIComponent(d.docId)}`);
        deleted++;
        console.log(`  ✅ Deleted "${d.docId}"`);
      } catch (e) {
        console.error(`  ❌ Failed to delete "${d.docId}":`, e.message);
      }
    }
    console.log(`\n🎉 Deleted ${deleted}/${staleDocs.length} stale flat docs from masterRegisters.`);
  } else {
    console.log('✅ No stale flat docs found — masterRegisters is clean!');
  }
}

findAndRemoveStaleCurrentDocs().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
