'use strict';
// Requires the local emulator; deliberately cannot connect to a live project.
const assert = require('node:assert/strict');
const admin = require('../functions/firebaseAdmin');
if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Run with the local Firestore emulator.');
const app = admin.initializeApp({ projectId: 'demo-hss-security' }, 'integrity-tests');
const db = admin.firestore(app);
const facade = { firestore: Object.assign(() => db, { FieldValue: admin.firestore.FieldValue, Timestamp: admin.firestore.Timestamp }) };
class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
const dependencies = { admin: facade, functions: { https: { onCall: callback => callback, HttpsError } }, requireAppCheck: () => {} };
const submit = require('../functions/academicRecords')(dependencies);
const distribute = require('../functions/fundLedger')(dependencies);
const { lookupResult } = require('../netlify/functions/public-result');
const publicRequire = require('node:module').createRequire(require.resolve('../netlify/functions/package.json'));
const publicAppModule = publicRequire('firebase-admin/app');
const publicApp = publicAppModule.initializeApp({ projectId: 'demo-hss-security' }, 'public-integrity-tests');
const publicDb = publicRequire('firebase-admin/firestore').getFirestore(publicApp);
const now = Math.floor(Date.now() / 1000);
const context = uid => ({ auth: { uid, token: { email: `${uid}@example.test`, email_verified: true, auth_time: now } } });
let count = 0;
async function check(name, body) { await body(); count++; console.log(`PASS ${name}`); }
async function main() {
  const rows = Object.fromEntries(Array.from({ length: 3 }, (_, index) => [`admissions/integrity-${index}`, {
    formNo: `TEST${index}`, boardRegNo: `REG${index}`, classRollNo: String(index + 1), studentName: `Synthetic ${index}`, Status: 'Approved', Class: '11th', Session: '2025-26', Stream: 'Science', subjects: ['PH', 'CH']
  }]));
  Object.assign(rows, {
    'users/integrityTeacher': { role: 'Teacher', active: true, subject: 'Physics', assignedClasses: ['11th'] },
    'users/integrityFinance': { role: 'Admin', active: true, perms: ['funds'] },
    'adminSessions/integrityFinance': { authTime: now, expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 3600000) },
    'adminPracticalsSettings/config': { customEvaluations: [{ id: 'test', title: 'Unit Test', evalType: 'Unit Test', session: '2025-26', classes: ['11th'], maxMarks: 20, minMarks: 7, isPublishedForStudents: true }] },
    'site/settings': { session: '2025-26' },
    'fund_config/subsidiary_accounts': { accounts: [{ key: 'testFee', isScienceOnly: false }] },
    'fund_rates/11th': { testFee: 100 }
  });
  for (const [path, data] of Object.entries(rows)) await db.doc(path).set(data);
  const base = { type: 'practicalsData', action: 'save', docId: '11th_Physics_Unit Test_2025-26', payload: {
    className: '11th', subject: 'Physics', subjectCode: 'PH', practicalType: 'Unit Test', yearSuffix: '2025-26',
    records: [{ formNo: 'TEST0', regNo: 'REG0', name: 'Synthetic 0', practicalMarks: '12', vivaMarks: '3', totalMarks: 15 }]
  } };
  await check('off-cohort academic row is rejected', () => assert.rejects(submit({ ...base, payload: { ...base.payload, records: [{ ...base.payload.records[0], formNo: 'UNKNOWN' }] } }, context('integrityTeacher')), /missing from this cohort/));
  await check('a teacher cannot choose an unassigned subject', () => assert.rejects(submit({ ...base, docId: '11th_Chemistry_Unit Test_2025-26', payload: { ...base.payload, subject: 'Chemistry', subjectCode: 'CH' } }, context('integrityTeacher')), /not assigned/));
  await check('forged document ID cannot bypass a submission lock', () => assert.rejects(submit({ ...base, docId: 'alternate-id' }, context('integrityTeacher')), /submission ID/));
  await check('empty components cannot become zero marks', () => assert.rejects(submit({ ...base, payload: { ...base.payload, records: [{ ...base.payload.records[0], practicalMarks: '', vivaMarks: '', totalMarks: 0 }] } }, context('integrityTeacher')), /components/));
  await check('assigned teacher submits valid marks and retains components', async () => {
    await submit(base, context('integrityTeacher'));
    const saved = (await db.doc(`practicalsData/${base.docId}`).get()).data();
    assert.equal(saved.records[0].practicalMarks, '12'); assert.equal(saved.records[0].vivaMarks, '3'); assert.equal(saved.isLocked, true);
  });
  await check('submitted marks cannot be overwritten by the teacher', () => assert.rejects(submit(base, context('integrityTeacher')), /locked/));
  await check('missing subject keeps the public result pending', async () => {
    const result = await lookupResult(publicDb, { query: 'TEST0', type: 'formNo', className: '11th', session: '2025-26', evaluation: 'Unit Test' });
    assert.equal(result.result.resultStatus, 'PENDING'); assert.equal(result.result.percentage, null);
  });
  await check('unpublished assessment is unavailable', async () => {
    await db.doc('adminPracticalsSettings/config').set({ customEvaluations: [] });
    await assert.rejects(lookupResult(publicDb, { query: 'TEST0', className: '11th', session: '2025-26', evaluation: 'Unit Test' }), /not published/);
  });
  const record = { class: '11th', academicSession: '2025-26', date: '2026-04-01', paidStudents: 2, scienceStudents: 2, totalAmount: 1 };
  await check('concurrent fund requests cannot overspend the same enrollment', async () => {
    const outcomes = await Promise.allSettled(['integrity-dist-a', 'integrity-dist-b'].map(id => distribute({ action: 'create', id, record }, context('integrityFinance'))));
    assert.equal(outcomes.filter(item => item.status === 'fulfilled').length, 1);
    assert.equal(outcomes.filter(item => item.status === 'rejected').length, 1);
    const saved = outcomes.find(item => item.status === 'fulfilled').value.record;
    assert.equal(saved.totalAmount, 200);
    const retry = await distribute({ action: 'create', id: saved.id, record }, context('integrityFinance'));
    assert.equal(retry.record.id, saved.id);
    assert.equal((await db.collection('fund_distributions').get()).size, 1);
  });
  console.log(`${count} backend integrity checks passed.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => Promise.all([admin.deleteApp(app), publicAppModule.deleteApp(publicApp)]));
