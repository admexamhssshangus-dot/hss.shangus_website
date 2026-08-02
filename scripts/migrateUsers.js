const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc } = require('firebase/firestore');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');

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
const auth = getAuth(app);

async function runMigration() {
  console.log('🚀 Starting User Migration to Firebase Auth & Standardizing Firestore...');
  try {
    const snap = await getDocs(collection(db, 'users'));
    console.log(`Found ${snap.docs.length} user documents in Firestore.`);

    let migrated = 0;
    let authCreated = 0;
    let errors = 0;

    for (const d of snap.docs) {
      const data = d.data();
      const rawEmail = data.email || data.Email || d.id;
      if (!rawEmail || !rawEmail.includes('@')) {
        console.warn(`Skipping invalid email doc: ${d.id}`);
        continue;
      }

      const email = rawEmail.trim().toLowerCase();
      const name = (data.name || data.Name || email.split('@')[0]).trim();
      const role = data.role || data.Role || 'Student';
      const mobile = (data.mobile || data.Mobile || '').trim();
      const password = data.password || data.PasswordPlain || data.Password || '';

      // Standardize Firestore Document
      const updatedDoc = {
        ...data,
        email,
        Email: email,
        name,
        Name: name,
        role,
        Role: role,
        mobile,
        Mobile: mobile,
        password,
        PasswordPlain: password,
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', d.id), updatedDoc, { merge: true });
      migrated++;

      // Create Firebase Auth User if password is at least 6 characters
      if (password && password.length >= 6) {
        try {
          await createUserWithEmailAndPassword(auth, email, password);
          console.log(`✅ Auth created for: ${email}`);
          authCreated++;
        } catch (authErr) {
          if (authErr.code === 'auth/email-already-in-use') {
            // Already created
          } else {
            console.warn(`⚠️ Could not create Auth for ${email}: ${authErr.message}`);
            errors++;
          }
        }
      } else {
        console.warn(`⚠️ Skipped Auth creation for ${email} (Password missing or under 6 chars)`);
      }
    }

    console.log(`\n🎉 Migration Complete Summary:`);
    console.log(`- Standardized Firestore User Docs: ${migrated}`);
    console.log(`- New Firebase Auth Accounts Created: ${authCreated}`);
    console.log(`- Auth Creation Warnings/Skips: ${errors}`);

  } catch (err) {
    console.error('Fatal Migration Error:', err);
  }
}

runMigration();
