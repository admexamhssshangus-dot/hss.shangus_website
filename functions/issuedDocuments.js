'use strict';
const crypto = require('crypto');
const { requireStaff } = require('./access');
const normalize = value => String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');
const first = (data, keys) => keys.map(key => data?.[key]).find(Boolean) || '';
const regNo = data => first(data, ['boardRegNo', 'regNo', 'Board Registration Number', 'Board Reg. No.']);
const formNo = data => first(data, ['formNo', 'Form Number', 'Form No.']);
module.exports = ({ functions, admin, requireAppCheck }) => functions.https.onCall(async (data, context) => {
  requireAppCheck(context);
  const db = admin.firestore();
  try {
    await requireStaff(db, { ...context.auth?.token, uid: context.auth?.uid }, { adminOnly: true, module: 'certStudio' });
    const locator = data?.locator;
    const certificateNo = String(data?.certificateNo || '').trim();
    const documentType = String(data?.documentType || '').replace(/\s*\([^)]*\)/g, '').trim().slice(0, 32).toLowerCase();
    if (!certificateNo || certificateNo.length > 100 || !documentType || !['issue', 'revoke'].includes(data.action) ||
        !['admissions', 'masterRegisters'].includes(locator?.collection) || !/^[^/]{1,256}$/.test(locator?.documentId || '')) throw new Error('A valid certificate and source student are required.');
    if (/discharge|transfer|tc\s*\/\s*dc|character.*discharg/.test(documentType)) throw new Error('Use the permanent TC/DC numbering registry for this certificate.');
    const sourceDocument = `${locator.collection}/${locator.documentId}`;
    const source = db.doc(sourceDocument);
    return await db.runTransaction(async tx => {
      const snapshot = await tx.get(source);
      if (!snapshot.exists) throw new Error('The source student record no longer exists.');
      const parent = snapshot.data();
      const records = ['items', 'students', 'records', 'data'].map(key => parent[key]).find(Array.isArray);
      let student = parent;
      if (records) {
        const matches = records.filter(item => locator.identity?.reg && normalize(regNo(item)) === locator.identity.reg &&
          (!locator.identity.form || normalize(formNo(item)) === locator.identity.form));
        if (matches.length !== 1) throw new Error('The archived student identity is ambiguous.');
        student = { Session: parent.session || parent.Session, Class: parent.class || parent.Class, ...matches[0] };
      }
      const registration = String(regNo(student));
      if (!registration || student._deleted || student._purged) throw new Error('A current student registration is required.');
      const id = crypto.createHash('sha256').update(`${normalize(certificateNo)}::${documentType}::${normalize(registration)}`).digest('hex');
      const issueRef = db.collection('issuedDocuments').doc(id);
      const existing = await tx.get(issueRef);
      if (data.action === 'revoke') {
        if (!existing.exists || existing.data().sourceDocument !== sourceDocument) throw new Error('No matching issued document was found.');
        tx.update(issueRef, { status: 'Revoked', revokedAt: admin.firestore.FieldValue.serverTimestamp(), revokedBy: context.auth.uid });
      } else if (existing.exists) {
        if (existing.data().status !== 'Active' || existing.data().sourceDocument !== sourceDocument) throw new Error('This certificate number is retired or assigned to a different student.');
      } else {
        tx.create(issueRef, { certificateNo, documentType, regNo: registration, sourceDocument, status: 'Active',
          session: String(first(student, ['Session', 'session', 'Academic Session'])),
          className: String(first(student, ['Admission sought for class', 'Class', 'className', 'class'])),
          issueDate: new Date().toISOString().slice(0, 10), issuedAt: admin.firestore.FieldValue.serverTimestamp(), issuedBy: context.auth.uid });
      }
      return { success: true, id };
    });
  } catch (error) { throw new functions.https.HttpsError(error.status === 403 ? 'permission-denied' : 'failed-precondition', error.message); }
});
