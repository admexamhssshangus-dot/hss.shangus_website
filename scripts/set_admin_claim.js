/**
 * Usage:
 *   node scripts/set_admin_claim.js /path/to/serviceAccountKey.json user@example.com
 *
 * This script uses firebase-admin to set a custom claim `admin: true` on the specified user.
 * It requires a service account JSON with appropriate permissions.
 */
const admin = require('firebase-admin');
let getAuthFunc = null;
try {
  getAuthFunc = require('firebase-admin/auth').getAuth;
} catch (e) {
  // older firebase-admin versions expose auth via admin.auth()
}
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

const credential = (admin.credential && typeof admin.credential.cert === 'function')
  ? admin.credential.cert(serviceAccount)
  : (typeof admin.cert === 'function' ? admin.cert(serviceAccount) : null);

if (!credential) {
  console.error('Unable to construct firebase-admin credential from installed firebase-admin package.');
  process.exit(1);
}

admin.initializeApp({ credential });

(async () => {
  try {
    const auth = (typeof getAuthFunc === 'function') ? getAuthFunc() : ((typeof admin.auth === 'function') ? admin.auth() : (typeof admin.getAuth === 'function' ? admin.getAuth() : null));
    if (!auth) throw new Error('firebase-admin auth API not available');
    try {
      const user = await auth.getUserByEmail(email);
      await auth.setCustomUserClaims(user.uid, { admin: true });
      console.log('Set admin claim for', email);
      process.exit(0);
    } catch (e) {
      if (e && e.code === 'auth/user-not-found') {
        console.log('User not found — creating user with provided password.');
        // create user with default password. For safety, the password can be passed as an env var or arg.
        const defaultPassword = process.argv[4] || 'admin@2122';
        const newUser = await auth.createUser({ email, emailVerified: true, password: defaultPassword });
        await auth.setCustomUserClaims(newUser.uid, { admin: true });
        console.log('Created user and set admin claim for', email);
        console.log('Temporary password:', defaultPassword);
        process.exit(0);
      }
      throw e;
    }
  } catch (err) {
    console.error('Error setting claim:', err);
    process.exit(1);
  }
})();
