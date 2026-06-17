/**
 * Usage:
 *   node scripts/set_admin_claim.js /path/to/serviceAccountKey.json user@example.com
 *
 * This script uses firebase-admin to set a custom claim `admin: true` on the specified user.
 * It requires a service account JSON with appropriate permissions.
 */
const admin = require('firebase-admin');
const fs = require('fs');

if (process.argv.length < 4) {
  console.error('Usage: node scripts/set_admin_claim.js <serviceAccount.json> <userEmail>');
  process.exit(2);
}

const svc = process.argv[2];
const email = process.argv[3];

if (!fs.existsSync(svc)) {
  console.error('Service account file not found:', svc);
  process.exit(2);
}

const serviceAccount = require(svc);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

(async () => {
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });
    console.log('Set admin claim for', email);
    process.exit(0);
  } catch (err) {
    console.error('Error setting claim:', err);
    process.exit(1);
  }
})();
