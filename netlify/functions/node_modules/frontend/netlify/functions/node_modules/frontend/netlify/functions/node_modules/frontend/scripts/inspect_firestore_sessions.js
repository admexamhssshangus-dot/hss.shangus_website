const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');

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

async function inspectSessions() {
  console.log('=== 1. fund_distributions ===');
  const fundDistSnap = await getDocs(collection(db, 'fund_distributions'));
  console.log(`fund_distributions total count: ${fundDistSnap.size}`);
  fundDistSnap.forEach(d => {
    const data = d.data();
    console.log(`Doc ID: ${d.id} | Class: ${data.class} | Month: ${data.month} | Year: ${data.year} | AcademicSession: ${data.academicSession} | Session: ${data.session} | Date: ${data.date}`);
  });

  console.log('\n=== 2. fund_config ===');
  const fundConfigSnap = await getDocs(collection(db, 'fund_config'));
  fundConfigSnap.forEach(d => {
    console.log(`fund_config/${d.id}:`, JSON.stringify(d.data(), null, 2));
  });

  console.log('\n=== 3. site collection ===');
  const siteSnap = await getDocs(collection(db, 'site'));
  siteSnap.forEach(d => {
    console.log(`site/${d.id}:`, JSON.stringify(d.data(), null, 2));
  });

  console.log('\n=== 4. admissions sessions ===');
  const admSnap = await getDocs(collection(db, 'admissions'));
  console.log(`admissions total count: ${admSnap.size}`);
  const admSessionsMap = {};
  admSnap.forEach(d => {
    const data = d.data();
    const s = data.session || data.academicSession || 'UNKNOWN';
    admSessionsMap[s] = (admSessionsMap[s] || 0) + 1;
  });
  console.log('admissions session counts:', admSessionsMap);

  console.log('\n=== 5. practicals sessions ===');
  const pracSnap = await getDocs(collection(db, 'practicals'));
  console.log(`practicals total count: ${pracSnap.size}`);
  const pracSessionsMap = {};
  pracSnap.forEach(d => {
    const data = d.data();
    const s = data.session || data.academicSession || 'UNKNOWN';
    pracSessionsMap[s] = (pracSessionsMap[s] || 0) + 1;
  });
  console.log('practicals session counts:', pracSessionsMap);

  process.exit(0);
}

inspectSessions().catch(e => {
  console.error(e);
  process.exit(1);
});
