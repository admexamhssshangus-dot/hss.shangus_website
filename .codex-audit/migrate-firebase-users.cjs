const crypto = require('node:crypto');
const path = require('node:path');
const admin = require('firebase-admin');
const XLSX = require('xlsx');

const APPLY = process.argv.includes('--apply');
const PROJECT_ID = 'hsssdb';
const ALLOWED_ROLES = new Set(['Student', 'Teacher', 'Admin', 'SuperAdmin']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CREDENTIAL_KEY_RE = /^(?:password|passwordplain|passwordhash|pass|passwd|pwd|hash|salt|md5|sha1|sha256|sha512)$/i;
const LEGACY_FIELDS = [
  'Email', 'Name', 'Mobile', 'Role', 'UpdatedOn', 'Residence', 'Permissions',
  'InitialClass', 'InitialSubject', 'Class', '__EMPTY_1', 'Active',
  'authMigratedAt', 'authMigrationVersion', 'classRegisteredFor',
  'subjectRegisteredFor', 'authProvisioned',
  'PasswordPlain', 'PasswordHash', 'password',
];
const EMAIL_RENAMES = new Map([
  ['yganie227@gamil.com', 'yganie227@gmail.com'],
]);

const root = path.resolve(__dirname, '..');
const serviceAccount = require(path.join(root, 'scripts', 'serviceAccount.json'));
if (serviceAccount.project_id !== PROJECT_ID) {
  throw new Error(`Service account project mismatch: expected ${PROJECT_ID}`);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const cleanString = (value, max = 500) => String(value || '').trim().slice(0, max);
const randomPassword = () => crypto.randomBytes(32).toString('base64url');

function readWorkbookUsers() {
  const workbook = XLSX.readFile(path.join(root, 'db_30 Jul 2026.xlsx'), { cellDates: true });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Users, { defval: null });
  const users = rows.map((row, index) => ({
    excelRow: index + 2,
    email: normalizeEmail(row.Email),
    displayName: cleanString(row.Name, 128),
    role: cleanString(row.Role, 32),
    mobile: cleanString(row.Mobile, 32),
    classRegisteredFor: cleanString(row.Class_registered_for, 256),
    subjectRegisteredFor: cleanString(row.Subject_registered_for, 512),
  }));
  const seen = new Map();
  for (const user of users) {
    if (!EMAIL_RE.test(user.email)) throw new Error(`Invalid email at workbook row ${user.excelRow}`);
    if (!ALLOWED_ROLES.has(user.role)) throw new Error(`Invalid role at workbook row ${user.excelRow}`);
    if (seen.has(user.email)) throw new Error(`Duplicate email at workbook rows ${seen.get(user.email)} and ${user.excelRow}`);
    seen.set(user.email, user.excelRow);
  }
  return users;
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

function claimsFor(role, existingClaims = {}) {
  const claims = { ...existingClaims };
  delete claims.role;
  delete claims.admin;
  delete claims.teacher;
  delete claims.permissions;
  return {
    ...claims,
    role,
    admin: role === 'Admin' || role === 'SuperAdmin',
    teacher: role === 'Teacher',
    permissions: role === 'SuperAdmin' ? ['*'] : [],
  };
}

async function withRetry(task, label, attempts = 5) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      const delay = Math.min(5000, 250 * (2 ** (attempt - 1))) + Math.floor(Math.random() * 200);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error(`${label}: ${lastError?.code || lastError?.message || lastError}`);
}

async function runPool(items, concurrency, worker) {
  let cursor = 0;
  const errors = [];
  const runners = Array.from({ length: concurrency }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        await worker(items[index], index);
      } catch (error) {
        errors.push({ email: items[index].email, message: error.message });
      }
    }
  });
  await Promise.all(runners);
  return errors;
}

async function main() {
  const workbookUsers = readWorkbookUsers();
  const [authUsers, firestoreUsers] = await Promise.all([
    listAllAuthUsers(),
    admin.firestore().collection('users').get(),
  ]);
  const authByEmail = new Map(authUsers.map((user) => [normalizeEmail(user.email), user]));
  const firestoreById = new Map(firestoreUsers.docs.map((doc) => [doc.id, doc]));

  for (const [oldEmail, newEmail] of EMAIL_RENAMES) {
    const oldAuth = authByEmail.get(oldEmail);
    const newAuth = authByEmail.get(newEmail);
    if (oldAuth && newAuth && oldAuth.uid !== newAuth.uid) {
      throw new Error(`Both old and corrected Auth accounts exist for ${newEmail}; refusing to merge`);
    }
  }

  const preview = {
    mode: APPLY ? 'apply' : 'dry-run',
    projectId: PROJECT_ID,
    workbookUsers: workbookUsers.length,
    authCreate: workbookUsers.filter((user) => !authByEmail.has(user.email) && ![...EMAIL_RENAMES].some(([oldEmail, newEmail]) => newEmail === user.email && authByEmail.has(oldEmail))).length,
    authUpdate: workbookUsers.filter((user) => authByEmail.has(user.email) || [...EMAIL_RENAMES].some(([oldEmail, newEmail]) => newEmail === user.email && authByEmail.has(oldEmail))).length,
    roleCounts: workbookUsers.reduce((acc, user) => ({ ...acc, [user.role]: (acc[user.role] || 0) + 1 }), {}),
    firestoreCredentialDocsToSanitize: firestoreUsers.docs.filter((doc) => Object.keys(doc.data() || {}).some((key) => CREDENTIAL_KEY_RE.test(key))).length,
    emailRenames: [...EMAIL_RENAMES].map(([from, to]) => ({ from, to, firestoreSourceExists: firestoreById.has(from) })),
  };
  console.log(JSON.stringify(preview, null, 2));
  if (!APPLY) return;

  const counters = { created: 0, updated: 0, claimsAssigned: 0, tokensRevoked: 0 };
  const authErrors = await runPool(workbookUsers, 5, async (user) => {
    let authUser = authByEmail.get(user.email);
    const rename = [...EMAIL_RENAMES].find(([oldEmail, newEmail]) => newEmail === user.email && authByEmail.has(oldEmail));
    if (!authUser && rename) {
      authUser = await withRetry(
        () => admin.auth().updateUser(authByEmail.get(rename[0]).uid, { email: user.email, displayName: user.displayName, password: randomPassword(), disabled: false }),
        `rename Auth email ${rename[0]}`,
      );
      authByEmail.delete(rename[0]);
      authByEmail.set(user.email, authUser);
      counters.updated += 1;
    } else if (authUser) {
      authUser = await withRetry(
        () => admin.auth().updateUser(authUser.uid, { displayName: user.displayName, password: randomPassword(), disabled: false }),
        `update Auth user ${user.email}`,
      );
      counters.updated += 1;
    } else {
      authUser = await withRetry(
        () => admin.auth().createUser({ email: user.email, displayName: user.displayName, password: randomPassword(), emailVerified: false, disabled: false }),
        `create Auth user ${user.email}`,
      );
      authByEmail.set(user.email, authUser);
      counters.created += 1;
    }

    await withRetry(
      () => admin.auth().setCustomUserClaims(authUser.uid, claimsFor(user.role, authUser.customClaims || {})),
      `assign claims ${user.email}`,
    );
    counters.claimsAssigned += 1;
    await withRetry(() => admin.auth().revokeRefreshTokens(authUser.uid), `revoke sessions ${user.email}`);
    counters.tokensRevoked += 1;
    user.uid = authUser.uid;
  });
  if (authErrors.length) {
    console.error(JSON.stringify({ phase: 'auth', failureCount: authErrors.length, failures: authErrors.slice(0, 25) }, null, 2));
    throw new Error('Authentication phase incomplete. Re-run the idempotent migration after correcting the reported errors.');
  }

  const db = admin.firestore();
  const renameWriter = db.bulkWriter();
  for (const [oldEmail, newEmail] of EMAIL_RENAMES) {
    const oldDoc = firestoreById.get(oldEmail);
    if (oldDoc) {
      const oldData = oldDoc.data() || {};
      const copied = { ...oldData, email: newEmail };
      for (const field of LEGACY_FIELDS) delete copied[field];
      for (const key of Object.keys(copied)) {
        if (CREDENTIAL_KEY_RE.test(key)) delete copied[key];
      }
      renameWriter.set(db.collection('users').doc(newEmail), copied, { merge: true });
      renameWriter.delete(db.collection('users').doc(oldEmail));
    }
  }
  await renameWriter.close();

  const currentSnapshot = await db.collection('users').get();
  const currentById = new Map(currentSnapshot.docs.map((doc) => [doc.id, doc]));
  const workbookByEmail = new Map(workbookUsers.map((user) => [user.email, user]));
  const writer = db.bulkWriter();
  let sanitizedDocuments = 0;
  let duplicateFieldsRemoved = 0;
  for (const doc of currentSnapshot.docs) {
    const data = doc.data() || {};
    const patch = {};
    for (const key of Object.keys(data)) {
      if (CREDENTIAL_KEY_RE.test(key)) patch[key] = admin.firestore.FieldValue.delete();
    }
    if (Object.keys(data).some((key) => CREDENTIAL_KEY_RE.test(key))) sanitizedDocuments += 1;

    if (!data.email && data.Email) patch.email = normalizeEmail(data.Email);
    if (!data.name && data.Name) patch.name = cleanString(data.Name, 128);
    if (!data.mobile && data.Mobile) patch.mobile = cleanString(data.Mobile, 32);
    if (!data.role && data.Role) patch.role = cleanString(data.Role, 32);
    if (!data.residence && data.Residence) patch.residence = cleanString(data.Residence, 256);
    if (!data.perms && Array.isArray(data.Permissions)) patch.perms = data.Permissions.slice(0, 50);
    if (data.active === undefined && data.Active !== undefined) patch.active = Boolean(data.Active);

    const workbookUser = workbookByEmail.get(doc.id);
    if (workbookUser) {
      patch.uid = workbookUser.uid;
      patch.email = workbookUser.email;
      patch.name = workbookUser.displayName;
      patch.role = workbookUser.role;
      if (workbookUser.mobile) patch.mobile = workbookUser.mobile;
      if (workbookUser.role === 'Teacher') {
        if (workbookUser.classRegisteredFor) patch.assignedClass = workbookUser.classRegisteredFor;
        if (workbookUser.subjectRegisteredFor) patch.teachingSubject = workbookUser.subjectRegisteredFor;
      } else {
        patch.assignedClass = admin.firestore.FieldValue.delete();
        patch.teachingSubject = admin.firestore.FieldValue.delete();
        patch.designation = admin.firestore.FieldValue.delete();
        patch.academicSession = admin.firestore.FieldValue.delete();
      }
    }

    for (const field of LEGACY_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(data, field)) {
        patch[field] = admin.firestore.FieldValue.delete();
        duplicateFieldsRemoved += 1;
      }
    }
    if (Object.keys(patch).length) writer.update(doc.ref, patch);
  }

  for (const user of workbookUsers) {
    if (currentById.has(user.email)) continue;
    const profile = { uid: user.uid, email: user.email, name: user.displayName, role: user.role };
    if (user.mobile) profile.mobile = user.mobile;
    if (user.role === 'Teacher') {
      if (user.classRegisteredFor) profile.assignedClass = user.classRegisteredFor;
      if (user.subjectRegisteredFor) profile.teachingSubject = user.subjectRegisteredFor;
    }
    writer.set(db.collection('users').doc(user.email), profile, { merge: true });
  }
  await writer.close();

  await db.collection('securityAuditLogs').add({
    action: 'firebase_auth_users_migrated',
    migrationVersion: 1,
    workbookUsers: workbookUsers.length,
    createdUsers: counters.created,
    updatedUsers: counters.updated,
    claimsAssigned: counters.claimsAssigned,
    sessionsRevoked: counters.tokensRevoked,
    credentialDocumentsSanitized: sanitizedDocuments,
    duplicateLegacyFieldsRemoved: duplicateFieldsRemoved,
    actor: serviceAccount.client_email,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(JSON.stringify({ success: true, ...counters, sanitizedDocuments, duplicateFieldsRemoved }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ success: false, message: error.message }, null, 2));
  process.exitCode = 1;
}).finally(async () => {
  await admin.app().delete();
});
