import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDhVgqXBo93FGXAm9YrG8x40Oa9pApu0bo",
  authDomain: "hsssdb.firebaseapp.com",
  projectId: "hsssdb",
  storageBucket: "hsssdb.firebasestorage.app",
  messagingSenderId: "894258649787",
  appId: "1:894258649787:web:8e1f77202b304f48f2279e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function inspect() {
  console.log("Fetching practicalsData...");
  const snap = await getDocs(collection(db, 'practicalsData'));
  console.log(`Total practicalsData docs: ${snap.size}`);

  const docs = [];
  snap.forEach(d => {
    const data = d.data();
    docs.push({
      id: d.id,
      className: data.className || data.class,
      subject: data.subject || data.subjectName,
      subjectCode: data.subjectCode,
      practicalType: data.practicalType || data.evaluationType || data.type,
      yearSuffix: data.yearSuffix || data.session || data.sessionCanonical,
      status: data.status,
      isDraft: data.isDraft,
      recordsCount: Array.isArray(data.records) ? data.records.length : 0,
      updatedAt: data.updatedAt,
      submittedAt: data.submittedAt,
      approvedAt: data.approvedAt
    });
  });

  console.table(docs);

  // Detail for English, Environmental Science, Political Science, and 12th/11th
  for (const doc of docs) {
    const sName = String(doc.subject || '').toLowerCase();
    const sCode = String(doc.subjectCode || '').toLowerCase();
    if (sName.includes('eng') || sName.includes('env') || sName.includes('pol') || doc.id.includes('eng') || doc.id.includes('env') || doc.id.includes('pol')) {
      console.log('\n--- TARGET DOC DETAIL ---');
      console.log('ID:', doc.id);
      console.log('Class:', doc.className, 'Subject:', doc.subject, 'Code:', doc.subjectCode);
      console.log('practicalType:', doc.practicalType, 'yearSuffix:', doc.yearSuffix, 'status:', doc.status, 'records:', doc.recordsCount);
    }
  }
}

inspect().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
