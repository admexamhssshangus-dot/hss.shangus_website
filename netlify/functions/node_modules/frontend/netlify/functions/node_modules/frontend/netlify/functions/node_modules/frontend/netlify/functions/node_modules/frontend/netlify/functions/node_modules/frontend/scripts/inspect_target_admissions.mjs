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

async function inspectAdmissions() {
  console.log('🔍 Inspecting admissions for Uzma Jan / Muneeb Qadir Shergojri...\n');

  let pageToken = '';
  let found = [];

  do {
    const url = `${BASE_URL}/admissions?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await httpGet(url);
    const docs = res.documents || [];
    pageToken = res.nextPageToken || '';

    for (const docObj of docs) {
      const docId = docObj.name.split('/').pop();
      const fields = docObj.fields || {};

      const name = fields["Student's Name (as per school records)"]?.stringValue
        || fields.studentName?.stringValue
        || fields["Student's Name"]?.stringValue
        || '';
      const formNo = fields['Form Number']?.stringValue || fields.formNo?.stringValue || '—';
      const status = fields.Status?.stringValue || fields.status?.stringValue || '—';

      if (name.toLowerCase().includes('uzma') || name.toLowerCase().includes('muneeb') || !name) {
        found.push({ docId, name, formNo, status, fields: Object.keys(fields) });
      }
    }
  } while (pageToken);

  console.log(`Found ${found.length} matching/relevant docs in admissions:`);
  for (const f of found) {
    console.log(`  - docId: "${f.docId}" | Name: "${f.name}" | Form: "${f.formNo}" | Status: "${f.status}" | FieldCount: ${f.fields.length}`);
  }
}

inspectAdmissions().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
