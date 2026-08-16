const path = require('node:path');
const admin = require('firebase-admin');
const XLSX = require('xlsx');

const root = path.resolve(__dirname, '..');
const workbookPath = path.join(root, 'db_30 Jul 2026.xlsx');
const serviceAccountPath = path.join(root, 'scripts', 'serviceAccount.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'hsssdb',
});

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizeRole = (value) => String(value || '').replace(/\s+/g, '').trim().toLowerCase();
const credentialFieldPattern = /(^|_)(pass(word)?|passwordplain|passwordhash|hash|salt|md5|sha1|sha256|sha512)($|_)/i;

const workbook = XLSX.readFile(workbookPath, { cellDates: true });
const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Users, { defval: null });
const workbookByEmail = new Map();
for (const [index, row] of rows.entries()) {
  const email = normalizeEmail(row.Email);
  if (!email) continue;
  if (!workbookByEmail.has(email)) workbookByEmail.set(email, []);
  workbookByEmail.get(email).push({ excelRow: index + 2, role: String(row.Role || '').trim() });
}

async function listAllAuthUsers() {
  const users = [];
  let pageToken;
  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

function first(items, max = 30) {
  return items.slice(0, max);
}

(async () => {
  const [authUsers, usersSnapshot] = await Promise.all([
    listAllAuthUsers(),
    admin.firestore().collection('users').get(),
  ]);

  const authByEmail = new Map(authUsers.map((user) => [normalizeEmail(user.email), user]));
  const firestoreByEmail = new Map();
  const firestoreCredentialFields = [];
  for (const doc of usersSnapshot.docs) {
    const data = doc.data() || {};
    const email = normalizeEmail(data.email || data.Email || (doc.id.includes('@') ? doc.id : ''));
    if (email) {
      if (!firestoreByEmail.has(email)) firestoreByEmail.set(email, []);
      firestoreByEmail.get(email).push({ id: doc.id, data });
    }
    const credentialFields = Object.keys(data).filter((key) => credentialFieldPattern.test(key));
    if (credentialFields.length) {
      firestoreCredentialFields.push({ id: doc.id, email: email || null, fields: credentialFields });
    }
  }

  const uniqueWorkbookEmails = [...workbookByEmail.keys()];
  const missingInAuth = uniqueWorkbookEmails.filter((email) => !authByEmail.has(email));
  const existingInAuth = uniqueWorkbookEmails.filter((email) => authByEmail.has(email));
  const authExtras = [...authByEmail.keys()].filter((email) => email && !workbookByEmail.has(email));
  const missingInFirestore = uniqueWorkbookEmails.filter((email) => !firestoreByEmail.has(email));
  const firestoreExtras = [...firestoreByEmail.keys()].filter((email) => !workbookByEmail.has(email));

  const claimIssues = [];
  const matchedAuthSummary = { disabled: 0, emailVerified: 0, noRoleClaim: 0 };
  for (const email of existingInAuth) {
    const user = authByEmail.get(email);
    if (user.disabled) matchedAuthSummary.disabled += 1;
    if (user.emailVerified) matchedAuthSummary.emailVerified += 1;
    const claimRole = normalizeRole(user.customClaims?.role);
    if (!claimRole) matchedAuthSummary.noRoleClaim += 1;
    const workbookRoles = [...new Set(workbookByEmail.get(email).map((entry) => normalizeRole(entry.role)))];
    if (!claimRole || workbookRoles.length !== 1 || !workbookRoles.includes(claimRole)) {
      claimIssues.push({
        email,
        excelRows: workbookByEmail.get(email).map((entry) => entry.excelRow),
        workbookRoles: workbookByEmail.get(email).map((entry) => entry.role),
        firebaseRoleClaim: user.customClaims?.role || null,
      });
    }
  }

  const firestoreRoleIssues = [];
  for (const email of uniqueWorkbookEmails) {
    const docs = firestoreByEmail.get(email) || [];
    if (!docs.length) continue;
    const workbookRoles = [...new Set(workbookByEmail.get(email).map((entry) => normalizeRole(entry.role)))];
    const docRoles = [...new Set(docs.map(({ data }) => normalizeRole(data.role || data.Role)).filter(Boolean))];
    if (workbookRoles.length !== 1 || docRoles.length !== 1 || docRoles[0] !== workbookRoles[0]) {
      firestoreRoleIssues.push({
        email,
        excelRows: workbookByEmail.get(email).map((entry) => entry.excelRow),
        workbookRoles: workbookByEmail.get(email).map((entry) => entry.role),
        firestoreDocIds: docs.map((doc) => doc.id),
        firestoreRoles: docs.map(({ data }) => data.role || data.Role || null),
      });
    }
  }

  console.log(JSON.stringify({
    projectId: serviceAccount.project_id,
    workbook: {
      rows: rows.length,
      uniqueEmails: uniqueWorkbookEmails.length,
      duplicateEmails: [...workbookByEmail.entries()]
        .filter(([, entries]) => entries.length > 1)
        .map(([email, entries]) => ({ email, entries })),
    },
    authentication: {
      totalUsers: authUsers.length,
      workbookUsersPresent: existingInAuth.length,
      workbookUsersMissing: missingInAuth.length,
      firebaseUsersNotInWorkbook: authExtras.length,
      matchedAuthSummary,
      claimIssueCount: claimIssues.length,
      missingExamples: first(missingInAuth),
      extraExamples: first(authExtras),
      claimIssueExamples: first(claimIssues),
    },
    firestore: {
      totalUserDocuments: usersSnapshot.size,
      workbookUsersPresent: uniqueWorkbookEmails.length - missingInFirestore.length,
      workbookUsersMissing: missingInFirestore.length,
      firestoreUsersNotInWorkbook: firestoreExtras.length,
      credentialMaterialDocumentCount: firestoreCredentialFields.length,
      roleIssueCount: firestoreRoleIssues.length,
      missingExamples: first(missingInFirestore),
      extraExamples: first(firestoreExtras),
      credentialMaterialExamples: first(firestoreCredentialFields),
      roleIssueExamples: first(firestoreRoleIssues),
    },
  }, null, 2));
})().finally(async () => {
  await admin.app().delete();
}).catch((error) => {
  console.error(JSON.stringify({ error: error.code || error.name, message: error.message }, null, 2));
  process.exitCode = 1;
});
