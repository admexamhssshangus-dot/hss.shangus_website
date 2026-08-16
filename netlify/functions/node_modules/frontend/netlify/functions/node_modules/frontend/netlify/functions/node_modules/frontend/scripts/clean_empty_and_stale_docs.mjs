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

async function findAndCleanEmptyAdmissions() {
  console.log('🔍 Scanning admissions for empty/junk records...\n');

  let pageToken = '';
  let totalDocs = 0;
  let emptyDocs = [];
  let staleMasterDocs = [];

  // 1. Scan admissions for empty records
  do {
    const url = `${BASE_URL}/admissions?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await httpGet(url);
    const docs = res.documents || [];
    pageToken = res.nextPageToken || '';

    for (const docObj of docs) {
      totalDocs++;
      const docId = docObj.name.split('/').pop();
      const fields = docObj.fields || {};

      const studentName = fields["Student's Name (as per school records)"]?.stringValue
        || fields.studentName?.stringValue
        || fields["Student's Name"]?.stringValue
        || '';
      const fatherName = fields["Father's/Guardian's Name (as per school records)"]?.stringValue
        || fields.fatherName?.stringValue
        || fields["Father's Name"]?.stringValue
        || '';
      const className = fields.Class?.stringValue || fields.class?.stringValue || '';
      const session = fields.Session?.stringValue || fields.session?.stringValue || '';
      const formNo = fields['Form Number']?.stringValue || fields.formNo?.stringValue || '';
      const status = fields.Status?.stringValue || fields.status?.stringValue || '';

      // Record is "empty/junk" if it has no student name AND no father name AND no class
      if (!studentName.trim() && !fatherName.trim() && !className.trim()) {
        emptyDocs.push({ docId, formNo, status, session, fieldCount: Object.keys(fields).length });
      }
    }
  } while (pageToken);

  console.log(`Total admissions docs scanned: ${totalDocs}`);
  console.log(`Empty/junk docs found: ${emptyDocs.length}\n`);

  if (emptyDocs.length > 0) {
    console.log('Empty Documents:');
    for (const d of emptyDocs) {
      console.log(`  - "${d.docId}" | Form: ${d.formNo || 'N/A'} | Status: ${d.status || 'N/A'} | Session: ${d.session || 'N/A'} | Fields: ${d.fieldCount}`);
    }

    console.log(`\n🗑️ Deleting ${emptyDocs.length} empty/junk docs from admissions...`);
    let deleted = 0;
    for (const d of emptyDocs) {
      try {
        await httpDelete(`${BASE_URL}/admissions/${encodeURIComponent(d.docId)}`);
        deleted++;
        console.log(`  ✅ Deleted "${d.docId}" from admissions`);
      } catch (e) {
        console.error(`  ❌ Failed "${d.docId}":`, e.message);
      }
    }
    console.log(`\n🎉 Deleted ${deleted}/${emptyDocs.length} empty/junk docs from admissions.`);
  }

  // 2. Now find and delete stale flat docs from masterRegisters
  console.log('\n\n🔍 Scanning masterRegisters for stale flat docs (should be in admissions only)...\n');

  pageToken = '';
  let masterTotal = 0;

  do {
    const url = `${BASE_URL}/masterRegisters?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await httpGet(url);
    const docs = res.documents || [];
    pageToken = res.nextPageToken || '';

    for (const docObj of docs) {
      masterTotal++;
      const docId = docObj.name.split('/').pop();
      const fields = docObj.fields || {};

      // Legitimate masterRegisters docs have: items (array), part, groupKey
      const hasItems = !!fields.items;
      const hasPart = !!fields.part;
      const hasGroupKey = !!fields.groupKey;

      // Flat admission-style docs have: Form Number, Status, etc. but NO items/part/groupKey
      const hasFormNumber = !!fields['Form Number'];
      const hasStatus = !!fields.Status || !!fields.status;

      if (!hasItems && !hasPart && !hasGroupKey && (hasFormNumber || hasStatus)) {
        const name = fields["Student's Name (as per school records)"]?.stringValue
          || fields.studentName?.stringValue || 'Unknown';
        staleMasterDocs.push({ docId, name });
      }
    }
  } while (pageToken);

  console.log(`Total masterRegisters docs scanned: ${masterTotal}`);
  console.log(`Stale flat docs found: ${staleMasterDocs.length}\n`);

  if (staleMasterDocs.length > 0) {
    console.log('Stale Documents:');
    for (const d of staleMasterDocs) {
      console.log(`  - "${d.docId}" | ${d.name}`);
    }

    console.log(`\n🗑️ Deleting ${staleMasterDocs.length} stale flat docs from masterRegisters...`);
    let deleted = 0;
    for (const d of staleMasterDocs) {
      try {
        await httpDelete(`${BASE_URL}/masterRegisters/${encodeURIComponent(d.docId)}`);
        deleted++;
        console.log(`  ✅ Deleted "${d.docId}" from masterRegisters`);
      } catch (e) {
        console.error(`  ❌ Failed "${d.docId}":`, e.message);
      }
    }
    console.log(`\n🎉 Deleted ${deleted}/${staleMasterDocs.length} stale flat docs from masterRegisters.`);
  } else {
    console.log('✅ No stale flat docs found in masterRegisters.');
  }
}

findAndCleanEmptyAdmissions().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
