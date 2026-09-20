import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || process.env.REACT_APP_FIREBASE_API_KEY || "",
  authDomain: "hsssdb.firebaseapp.com",
  projectId: "hsssdb",
  storageBucket: "hsssdb.firebasestorage.app",
  messagingSenderId: "894258649787",
  appId: "1:894258649787:web:8e1f77202b304f48f2279e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  console.log("=== CHECKING PRACTICALSBIN ===");
  const binSnap = await getDocs(collection(db, 'practicalsBin'));
  console.log(`Total bin docs: ${binSnap.size}`);
  binSnap.forEach(d => {
    const data = d.data();
    console.log(`Bin ID: ${d.id} | targetDocId: ${data.canonicalDocId || data.targetDocId} | reason: ${data.archiveReason || data.reason} | archivedAt: ${data.archivedAt} | count: ${data.records?.length}`);
  });

  console.log("\n=== CHECKING ALL PRACTICALSDATA DOCS FOR 11TH & 12TH ===");
  const pracSnap = await getDocs(collection(db, 'practicalsData'));
  pracSnap.forEach(d => {
    if (d.id.includes('11th') || d.id.includes('12th')) {
      const data = d.data();
      console.log(`ID: ${d.id} | status: ${data.status} | isDraft: ${data.isDraft} | isPending: ${data.isPendingApproval} | subject: ${data.subject} | recs: ${data.records?.length} | updated: ${data.updatedAt || data.submittedAt}`);
    }
  });

  console.log("\n=== CHECKING RECENT ACTIVITY LOGS ===");
  try {
    const logsSnap = await getDocs(collection(db, 'activityLogs'));
    const logs = [];
    logsSnap.forEach(d => logs.push({ id: d.id, ...d.data() }));
    // filter practical or exam related
    const examLogs = logs.filter(l => 
      JSON.stringify(l).toLowerCase().includes('practical') || 
      JSON.stringify(l).toLowerCase().includes('award') ||
      JSON.stringify(l).toLowerCase().includes('pre-board') ||
      JSON.stringify(l).toLowerCase().includes('political') ||
      JSON.stringify(l).toLowerCase().includes('english') ||
      JSON.stringify(l).toLowerCase().includes('environmental')
    );
    console.log(`Matching activity logs: ${examLogs.length}`);
    examLogs.slice(-15).forEach(l => {
      console.log(`- [${l.timestamp || l.createdAt || l.date}] ${l.actionTitle || l.activityType}: ${l.details}`);
    });
  } catch (e) {
    console.log("Activity logs error:", e.message);
  }
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
