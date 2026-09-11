'use strict';
const fs = require('node:fs');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, getDoc, Timestamp } = require('firebase/firestore');
async function main() {
  const environment = await initializeTestEnvironment({ projectId: 'demo-hss-security', firestore: {
    host: '127.0.0.1', port: 8089, rules: fs.readFileSync('firestore.rules', 'utf8')
  } });
  let count = 0;
  const check = async (label, promise) => { await promise; count++; process.stdout.write(`PASS ${label}\n`); };
  const authTime = Math.floor(Date.now() / 1000);
  const token = email => ({ email, email_verified: true, auth_time: authTime });
  try {
    await environment.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      for (const [path, data] of Object.entries({
        'site/recycle_bin': { faculty: [{ name: 'PRIVATE TEST', phone: '0000000000' }] },
        'site/settings': { session: '2025-26' },
        'users/reporter': { uid: 'reporter', email: 'reporter@example.test', name: 'Reporter', role: 'Admin', perms: ['reports'], active: true },
        'users/finance': { uid: 'finance', email: 'finance@example.test', name: 'Finance', role: 'Admin', perms: ['funds'], active: true },
        'users/teacher': { uid: 'teacher', email: 'teacher@example.test', name: 'Teacher', role: 'Teacher', perms: [], active: true },
        'users/disabled': { uid: 'disabled', email: 'disabled@example.test', role: 'Admin', perms: ['reports'], active: false },
        'users/legacy@example.test': { email: 'legacy@example.test', role: 'Admin', perms: ['*'] },
        'admissions/example': { ownerUid: 'student', studentName: 'Synthetic Student', Status: 'Approved' },
        'admissions/legacy': { emailNormalized: 'legacy@example.test', studentName: 'Synthetic Legacy', Status: 'Approved' },
        'adminAuthHandshakes/challenge': { uid: 'reporter', email: 'reporter@example.test', status: 'pending', expiresAt: Date.now() + 60000 },
        'adminSessions/reporter': { authTime, expiresAt: Timestamp.fromMillis(Date.now() + 60000) },
        'adminSessions/finance': { authTime, expiresAt: Timestamp.fromMillis(Date.now() + 60000) },
        'adminSessions/disabled': { authTime, expiresAt: Timestamp.fromMillis(Date.now() + 60000) }
      })) await setDoc(doc(db, path), data);
    });
    const anonymous = environment.unauthenticatedContext().firestore();
    const reporter = environment.authenticatedContext('reporter', token('reporter@example.test')).firestore();
    const teacher = environment.authenticatedContext('teacher', token('teacher@example.test')).firestore();
    const finance = environment.authenticatedContext('finance', token('finance@example.test')).firestore();
    const unverified = environment.authenticatedContext('unknown', { ...token('legacy@example.test'), email_verified: false }).firestore();
    const legacy = environment.authenticatedContext('legacy-user', token('legacy@example.test')).firestore();
    const disabled = environment.authenticatedContext('disabled', { ...token('disabled@example.test'), admin: true, role: 'Admin' }).firestore();
    const oldLogin = environment.authenticatedContext('reporter', { ...token('reporter@example.test'), auth_time: authTime - 60 }).firestore();
    for (const [uid, perms] of Object.entries({ certificate: ['certStudio'], attendanceAdmin: ['attendanceMgmt'], cms: ['cms'], practicalAdmin: ['practicals'] })) {
      await environment.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), 'users', uid), { uid, role: 'Admin', perms, active: true });
        await setDoc(doc(context.firestore(), 'adminSessions', uid), { authTime, expiresAt: Timestamp.fromMillis(Date.now() + 60000) });
      });
    }
    await check('public CMS remains available', assertSucceeds(getDoc(doc(anonymous, 'site/settings'))));
    await check('anonymous employee trash is private', assertFails(getDoc(doc(anonymous, 'site/recycle_bin'))));
    await check('anonymous admission reads denied', assertFails(getDoc(doc(anonymous, 'admissions/example'))));
    await check('unverified legacy-email admission reads denied', assertFails(getDoc(doc(unverified, 'admissions/legacy'))));
    await check('legacy email profile cannot grant staff privileges', assertFails(getDoc(doc(legacy, 'admissions/example'))));
    await check('administrator with current proof and assigned module succeeds', assertSucceeds(getDoc(doc(reporter, 'admissions/example'))));
    await check('a proof from another sign-in is rejected', assertFails(getDoc(doc(oldLogin, 'admissions/example'))));
    await check('disabled account loses privileges despite old claims', assertFails(getDoc(doc(disabled, 'admissions/example'))));
    await check('staff cannot approve their own handshake', assertFails(updateDoc(doc(reporter, 'adminAuthHandshakes/challenge'), { status: 'approved' })));
    await check('anonymous handshake approval denied', assertFails(updateDoc(doc(anonymous, 'adminAuthHandshakes/challenge'), { status: 'approved' })));
    await check('another user cannot read a pending handshake', assertFails(getDoc(doc(teacher, 'adminAuthHandshakes/challenge'))));
    await check('admin cannot mint their own proof', assertFails(setDoc(doc(reporter, 'adminSessions/reporter'), { authTime, expiresAt: Timestamp.fromMillis(Date.now() + 86400000) })));
    await check('administrator cannot elevate own role', assertFails(updateDoc(doc(reporter, 'users/reporter'), { role: 'SuperAdmin', perms: ['*'] })));
    await check('teacher cannot change own assigned subject', assertFails(updateDoc(doc(teacher, 'users/teacher'), { subject: 'Physics' })));
    await check('funds-only administrator cannot edit admissions', assertFails(updateDoc(doc(finance, 'admissions/example'), { studentName: 'Changed' })));
    await check('reports-only administrator cannot change school settings', assertFails(updateDoc(doc(reporter, 'site/settings'), { session: '2026-27' })));
    await check('teacher cannot bypass academic submission validation', assertFails(setDoc(doc(teacher, 'practicalsData/forged'), { records: [], status: 'submitted' })));
    await check('admin cannot bypass fund transaction', assertFails(setDoc(doc(finance, 'fund_distributions/forged'), { id: 'forged' })));
    await check('issued document writes are server-only', assertFails(setDoc(doc(reporter, 'issuedDocuments/forged'), { status: 'Active' })));
    await check('rollback snapshots reject anonymous access', assertFails(getDoc(doc(anonymous, 'csvImportBatches/job/entries/0'))));
    await check('reports admin can update a student', assertSucceeds(updateDoc(doc(reporter, 'admissions/example'), { studentName: 'Updated synthetic student' })));
    await check('express entry fails when disabled', assertFails(setDoc(doc(reporter, 'admissions/express'), { studentName: 'Synthetic', ingestionType: 'admin_express_direct' })));
    const certificate = environment.authenticatedContext('certificate', token('certificate@example.test')).firestore();
    await check('certificate operator can maintain its registry settings', assertSucceeds(setDoc(doc(certificate, 'systemSettings/certificateRegistry'), { nextNumber: 1 })));
    const attendanceAdmin = environment.authenticatedContext('attendanceAdmin', token('attendanceAdmin@example.test')).firestore();
    await check('attendance operator can save attendance configuration', assertSucceeds(setDoc(doc(attendanceAdmin, 'systemSettings/attendanceConfig'), { enabled: true })));
    const cms = environment.authenticatedContext('cms', token('cms@example.test')).firestore();
    await check('CMS operator can read the private recycle bin', assertSucceeds(getDoc(doc(cms, 'site/recycle_bin'))));
    const practicalAdmin = environment.authenticatedContext('practicalAdmin', token('practicalAdmin@example.test')).firestore();
    await check('practicals administrator can import academic records', assertSucceeds(setDoc(doc(practicalAdmin, 'practicalsData/import'), { records: [], status: 'submitted' })));
    process.stdout.write(`${count} authorization checks passed.\n`);
  } finally { await environment.cleanup(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
