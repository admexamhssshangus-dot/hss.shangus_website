'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyStudent } = require('../netlify/functions/lookup-student');
const { authority, hasAdminSession } = require('../functions/access');
const { issueKey } = require('../netlify/functions/lib/publicRecords');
function fakeDb(entries) {
  const snapshot = path => ({ exists: Object.hasOwn(entries, path), data: () => entries[path] });
  return { collection: name => ({ doc: id => ({ get: async () => snapshot(`${name}/${id}`) }) }),
    doc: path => ({ get: async () => snapshot(path) }) };
}
const source = { studentName: 'Synthetic Student', boardRegNo: 'REG-1234', formNo: 'FORM-001', Class: '12th', Session: '2025-26' };
const lock = { certificateNo: '1368', status: 'Active', regNo: 'REG-1234', sourceDocument: 'admissions/physical', className: '12th', session: '2025-26' };
const request = { certificateNo: '1368', regNo: 'REG-1234', documentType: 'Discharge / Transfer Certificate' };
test('a student without an issuance entry cannot validate an arbitrary certificate', async () => {
  await assert.rejects(verifyStudent(fakeDb({ 'admissions/physical': source }), request), /not issued/);
});
test('exact active TC is verified using server labels', async () => {
  const result = await verifyStudent(fakeDb({ 'admissions/physical': source, 'certificateNumberLocks/1368': lock }), { ...request, name: 'Forged Name' });
  assert.equal(result.student.name, 'Synthetic Student'); assert.equal(result.verification.kind, 'certificate');
});
test('revoked issuance and mismatched registration fail', async () => {
  await assert.rejects(verifyStudent(fakeDb({ 'admissions/physical': source, 'certificateNumberLocks/1368': { ...lock, status: 'Revoked' } }), request), /revoked/);
  await assert.rejects(verifyStudent(fakeDb({ 'admissions/physical': source, 'certificateNumberLocks/1368': lock }), { ...request, regNo: 'OTHER' }), /does not match/);
});
test('a TC number does not authorize a different document type', async () => {
  await assert.rejects(verifyStudent(fakeDb({ 'admissions/physical': source, 'certificateNumberLocks/1368': lock }), { ...request, documentType: 'Bonafide Certificate' }), /not issued/);
});
test('server-registered bonafide is verified and revocation is immediate', async () => {
  const id = issueKey('B-5', 'Bonafide Certificate', 'REG-1234');
  const entries = { 'admissions/physical': source, [`issuedDocuments/${id}`]: { ...lock, certificateNo: 'B-5', documentType: 'bonafide certificate' } };
  const body = { ...request, certificateNo: 'B-5', documentType: 'Bonafide Certificate' };
  assert.equal((await verifyStudent(fakeDb(entries), body)).verification.certificateNo, 'B-5');
  entries[`issuedDocuments/${id}`].status = 'Revoked';
  await assert.rejects(verifyStudent(fakeDb(entries), body), /revoked/);
});
test('authority requires verified email, active UID profile and a non-revoked authentication time', () => {
  const token = { uid: 'user', email: 'user@example.test', email_verified: true, auth_time: 100, role: 'SuperAdmin', admin: true };
  assert.equal(authority(token, null), null);
  assert.equal(authority({ ...token, email_verified: false }, { role: 'Admin' }), null);
  assert.equal(authority(token, { role: 'Admin', active: false }), null);
  assert.equal(authority(token, { role: 'Admin', validAfter: 101 }), null);
  assert.equal(authority(token, { role: 'Admin', active: true }).role, 'Admin');
});
test('administrator proof is bound to auth_time and expires', () => {
  assert.equal(hasAdminSession({ auth_time: 100 }, { authTime: 99, expiresAt: 2000 }, 1000), false);
  assert.equal(hasAdminSession({ auth_time: 100 }, { authTime: 100, expiresAt: 900 }, 1000), false);
  assert.equal(hasAdminSession({ auth_time: 100 }, { authTime: 100, expiresAt: 2000 }, 1000), true);
});
test('archival follows one master-register locator without exposing trash', async () => {
  const entries = { 'certificateNumberLocks/1368': lock,
    'admissions/physical': { _deleted: true, _archivedTo: 'masterRegisters/archive_2025-26_physical' },
    'masterRegisters/archive_2025-26_physical': { ...source, archivedAt: 'timestamp' } };
  assert.equal((await verifyStudent(fakeDb(entries), request)).student.name, source.studentName);
  entries['admissions/physical']._archivedTo = 'archivalTrash/private';
  await assert.rejects(verifyStudent(fakeDb(entries), request), /unavailable/);
});
test('a changed class or session cannot validate an older issuance', async () => {
  await assert.rejects(verifyStudent(fakeDb({ 'certificateNumberLocks/1368': lock, 'admissions/physical': { ...source, Session: '2026-27' } }), request), /unavailable/);
});
