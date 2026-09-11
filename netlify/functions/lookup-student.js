'use strict';
const { createHandler, findStudent, studentProjection, documentType, issueKey, loadSource, normalize, first, FIELDS } = require('./lib/publicRecords');
async function verifyStudent(db, body) {
  const certNo = String(body.certificateNo || '').trim();
  const reg = String(body.regNo || '').trim();
  if (certNo || body.documentType) {
    if (!certNo || certNo.length > 100 || !reg || reg.length > 64 || !body.documentType || body.documentType.length > 100) {
      throw Object.assign(new Error('The certificate number, document type and registration number are required.'), { status: 400 });
    }
    const type = documentType(body.documentType);
    let issue;
    if (type === 'tc-dc' && /^\d{1,6}$/.test(certNo)) {
      const lock = await db.collection('certificateNumberLocks').doc(certNo).get();
      issue = lock.exists ? lock.data() : null;
    } else {
      const entry = await db.collection('issuedDocuments').doc(issueKey(certNo, type, reg)).get();
      issue = entry.exists ? entry.data() : null;
    }
    if (!issue || issue.status !== 'Active' || normalize(issue.regNo) !== normalize(reg) ||
        (issue.documentType && documentType(issue.documentType) !== type)) {
      throw Object.assign(new Error('This certificate is not issued, has been revoked, or does not match the student.'), { status: 404 });
    }
    const source = await loadSource(db, issue.sourceDocument, issue);
    if (!source || source._deleted || source._purged || normalize(first(source, FIELDS.regNo)) !== normalize(reg)) {
      throw Object.assign(new Error('The issuing student record is unavailable or has been withdrawn.'), { status: 404 });
    }
    // Identity and labels are returned from trusted records, never from URL text.
    return { student: studentProjection(source), verification: { kind: 'certificate', certificateNo: issue.certificateNo,
      documentType: issue.documentType || 'Discharge / Transfer Certificate', issuedAt: issue.issueDate || '', status: 'Active' } };
  }
  const formNo = String(body.formNo || '').trim();
  if (!formNo || !reg || formNo.length > 64 || reg.length > 64) throw Object.assign(new Error('The form and registration numbers are required.'), { status: 400 });
  const { student } = await findStudent(db, { type: 'formNo', query: formNo, className: body.className, session: body.session });
  if (normalize(student.boardRegNo) !== normalize(reg)) throw Object.assign(new Error('The student identifiers do not match.'), { status: 404 });
  return { student, verification: { kind: 'enrollment', status: 'Approved' } };
}
exports.handler = createHandler(verifyStudent);
exports.verifyStudent = verifyStudent;
