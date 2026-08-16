'use strict';

const admin = require('firebase-admin');

const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const email = String(args.email || '').trim().toLowerCase();
const role = String(args.role || '').trim();
const allowed = new Set(['Student', 'Teacher', 'Admin', 'SuperAdmin']);

if (!email || !allowed.has(role) || args.confirm !== 'SET-SECURE-CLAIMS') {
  console.error('Usage: node scripts/set_firebase_role.js --email=user@example.com --role=Admin --confirm=SET-SECURE-CLAIMS');
  process.exitCode = 2;
  return;
}

admin.initializeApp({ credential: admin.credential.applicationDefault() });

(async () => {
  const user = await admin.auth().getUserByEmail(email);
  const claims = {
    role,
    admin: role === 'Admin' || role === 'SuperAdmin',
    teacher: role === 'Teacher',
    permissions: role === 'SuperAdmin' ? ['*'] : [],
  };
  await admin.auth().setCustomUserClaims(user.uid, claims);
  console.log(`Secure claims assigned to UID ${user.uid}. The user must sign out and sign in again.`);
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});

