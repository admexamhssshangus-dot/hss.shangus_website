const path = require('path');
const functionDirectory = path.join(__dirname, '../netlify/functions');
const { initializeApp, cert } = require(require.resolve('firebase-admin/app', { paths: [functionDirectory] }));
const { getFirestore } = require(require.resolve('firebase-admin/firestore', { paths: [functionDirectory] }));

const serviceAccount = require('./serviceAccount.json');

const app = initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore(app);

// Mapping requested by user:
// 2023-24 is okay
// 2024-25 (Mar-Apr) is okay
// 2025-26 -> 2024-25 (Oct-Nov)
// 2026-27 -> 2025-26

function mapSession(s) {
  if (!s || typeof s !== 'string') return s;
  const trimmed = s.trim();
  if (trimmed === '2025-26') return '2024-25 (Oct-Nov)';
  if (trimmed === '2026-27') return '2025-26';
  return s;
}

function mapCompositeYear(y) {
  if (!y || typeof y !== 'string') return y;
  // If format is like "2025-26"
  if (y.trim() === '2025-26') return '2024-25 (Oct-Nov)';
  if (y.trim() === '2026-27') return '2025-26';
  
  // If format is like "2025 (2025-26)" or "2026 (2026-27)"
  let updated = y;
  if (updated.includes('2025-26') && !updated.includes('2024-25 (Oct-Nov)')) {
    updated = updated.replace(/2025-26/g, '2024-25 (Oct-Nov)');
  }
  if (updated.includes('2026-27')) {
    updated = updated.replace(/2026-27/g, '2025-26');
  }
  return updated;
}

async function runUpdate() {
  console.log('🚀 Starting Firestore Sessions Update...');

  // 1. fund_distributions
  console.log('\n--- Checking fund_distributions ---');
  const fundDistSnap = await db.collection('fund_distributions').get();
  console.log(`Found ${fundDistSnap.size} fund_distributions documents.`);

  let fundUpdatedCount = 0;
  for (const docSnap of fundDistSnap.docs) {
    const data = docSnap.data();
    let needsUpdate = false;
    const updates = {};

    if (data.academicSession) {
      const newAcademicSession = mapSession(data.academicSession);
      if (newAcademicSession !== data.academicSession) {
        updates.academicSession = newAcademicSession;
        needsUpdate = true;
      }
    }

    if (data.session) {
      const newSession = mapSession(data.session);
      if (newSession !== data.session) {
        updates.session = newSession;
        needsUpdate = true;
      }
    }

    if (data.year) {
      const newYear = mapCompositeYear(data.year);
      if (newYear !== data.year) {
        updates.year = newYear;
        needsUpdate = true;
      }
    }

    // Also if academicSession / session wasn't set, set it from year
    if (!data.academicSession && data.year) {
      if (data.year.includes('2023-24')) {
        updates.academicSession = '2023-24';
        updates.session = '2023-24';
        needsUpdate = true;
      } else if (data.year.includes('2024-25 (Mar-Apr)')) {
        updates.academicSession = '2024-25 (Mar-Apr)';
        updates.session = '2024-25 (Mar-Apr)';
        needsUpdate = true;
      } else if (data.year.includes('2025-26')) {
        updates.academicSession = '2024-25 (Oct-Nov)';
        updates.session = '2024-25 (Oct-Nov)';
        needsUpdate = true;
      } else if (data.year.includes('2026-27')) {
        updates.academicSession = '2025-26';
        updates.session = '2025-26';
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      console.log(`Updating doc ${docSnap.id}:`, updates);
      await docSnap.ref.update(updates);
      fundUpdatedCount++;
    }
  }
  console.log(`Updated ${fundUpdatedCount} fund_distributions records.`);

  // 2. fund_config/subsidiary_accounts
  console.log('\n--- Checking fund_config/subsidiary_accounts ---');
  const fundConfigRef = db.collection('fund_config').doc('subsidiary_accounts');
  const fundConfigSnap = await fundConfigRef.get();
  if (fundConfigSnap.exists) {
    const d = fundConfigSnap.data();
    if (d.defaultSession) {
      const newDef = mapSession(d.defaultSession);
      if (newDef !== d.defaultSession) {
        console.log(`Updating fund_config defaultSession from ${d.defaultSession} to ${newDef}`);
        await fundConfigRef.update({ defaultSession: newDef });
      }
    }
  }

  // 3. site/settings or app_settings
  console.log('\n--- Checking site collection ---');
  const siteSnap = await db.collection('site').get();
  for (const sDoc of siteSnap.docs) {
    const sData = sDoc.data();
    let sNeedsUpdate = false;
    const sUpdates = {};
    if (sData.academicYear) {
      const newAY = mapSession(sData.academicYear);
      if (newAY !== sData.academicYear) {
        sUpdates.academicYear = newAY;
        sNeedsUpdate = true;
      }
    }
    if (sData.currentSession) {
      const newCS = mapSession(sData.currentSession);
      if (newCS !== sData.currentSession) {
        sUpdates.currentSession = newCS;
        sNeedsUpdate = true;
      }
    }
    if (sData.sessions && Array.isArray(sData.sessions)) {
      const mappedArr = sData.sessions.map(mapSession);
      if (JSON.stringify(mappedArr) !== JSON.stringify(sData.sessions)) {
        sUpdates.sessions = mappedArr;
        sNeedsUpdate = true;
      }
    }
    if (sNeedsUpdate) {
      console.log(`Updating site/${sDoc.id}:`, sUpdates);
      await sDoc.ref.update(sUpdates);
    }
  }

  // 4. Verify results
  console.log('\n=== Verifying distinct sessions in fund_distributions ===');
  const verifySnap = await db.collection('fund_distributions').get();
  const distinctSessions = new Set();
  verifySnap.forEach(d => {
    const dat = d.data();
    distinctSessions.add(dat.academicSession || dat.session || dat.year);
  });
  console.log('Final fund_distributions sessions:', Array.from(distinctSessions).sort());

  console.log('\n✅ All Firestore session updates completed successfully!');
  process.exit(0);
}

runUpdate().catch(err => {
  console.error('Error running update:', err);
  process.exit(1);
});
