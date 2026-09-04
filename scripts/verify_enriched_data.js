const path = require('path');
const functionDirectory = path.join(__dirname, '..', 'netlify', 'functions');
const { initializeApp, cert } = require(require.resolve('firebase-admin/app', { paths: [functionDirectory] }));
const { getFirestore } = require(require.resolve('firebase-admin/firestore', { paths: [functionDirectory] }));
const serviceAccount = require(path.join(__dirname, 'serviceAccount.json'));

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

function isEmpty(val) {
  if (val === undefined || val === null) return true;
  const s = String(val).trim();
  return s === '' || s === '—' || s === '-' || s === 'N/A' || s === 'NA' || s === 'Nill' || s === 'null' || s === 'undefined';
}

async function verifyFirestore() {
  const targetDocIds = ['chunk_005', 'chunk_006'];
  const students = [];

  for (const docId of targetDocIds) {
    const snap = await db.collection('masterRegisters').doc(docId).get();
    const data = snap.data();
    data.items.forEach(st => {
      const cls = String(st.Class || st.class || '').trim().toLowerCase();
      const sess = String(st.Session || st.session || '').trim().toLowerCase();
      if ((cls === '10th' || cls.includes('10th')) && sess.includes('2024-25') && sess.includes('oct')) {
        students.push(st);
      }
    });
  }

  console.log(`Total 10th 2024-25 (Oct-Nov) in chunk_005 & chunk_006: ${students.length}`);

  const checkFields = [
    'Student\'s Name', 'Father\'s Name', 'Mother\'s Name', 'Board Reg. No.', 'Form No.',
    'Adm. No.', 'Adm. Date', 'DoB (figures)', 'DoB (words)', 'Village/Town', 'District',
    'Gender', 'Subs', 'Student\'s Contact', 'Parent\'s Contact', 'Aadhar No.',
    'Bank Account Number', 'Bank Name', 'IFSC Code', 'Exam R.No. (Current)', 'Previous School',
    'photo_id', 'PDF_URL'
  ];

  console.log('\nField fill rate verification:');
  checkFields.forEach(f => {
    const filled = students.filter(s => !isEmpty(s[f])).length;
    console.log(`  ${f}: ${filled}/${students.length} filled (${((filled/students.length)*100).toFixed(0)}%)`);
  });

  console.log('\nSample Student Record after enrichment:');
  const s = students[0];
  console.log(`Name: ${s["Student's Name"]}, Reg: ${s["Board Reg. No."]}`);
  console.log(`Adm No: ${s['Adm. No.']} (alias admNo: ${s.admNo})`);
  console.log(`Adm Date: ${s['Adm. Date']} (alias admDate: ${s.admDate})`);
  console.log(`Village: ${s['Village/Town']} (alias village: ${s.village})`);
  console.log(`Contact: ${s["Student's Contact"]}, Aadhar: ${s['Aadhar No.']}`);
  console.log(`Bank: ${s['Bank Name']} - ${s['Bank Account Number']} (${s['IFSC Code']})`);
}

verifyFirestore().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
