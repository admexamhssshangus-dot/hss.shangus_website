'use strict';
const { requireStaff, roleKey } = require('./access');
const { key, sessionKey, classKey, studentForm, studentReg, loadCohort } = require('./academicData');
const { getSubjectMarksConfig } = require('./marksPolicy');
const subjectDefinitions = require('./subjectDefinitions.json');
module.exports = ({ functions, admin, requireAppCheck }) => functions.https.onCall(async (data, context) => {
  requireAppCheck(context);
  try {
    const db = admin.firestore(), type = data?.type;
    if (!['attendance', 'practicalsData'].includes(type) || !/^[^/]{1,240}$/.test(data.docId || '')) throw new Error('Invalid academic record.');
    const staff = await requireStaff(db, { ...context.auth?.token, uid: context.auth?.uid }, { module: type === 'attendance' ? 'attendanceMgmt' : 'practicals' });
    const isAdmin = roleKey(staff.role) !== 'teacher';
    const payload = data.payload || {};
    const reference = db.collection(type).doc(data.docId);
    return await db.runTransaction(async tx => {
      const [prior, settings, site] = await Promise.all([tx.get(reference), tx.get(db.collection('adminPracticalsSettings').doc('config')), tx.get(db.collection('site').doc('settings'))]);
      if (data.action === 'delete') {
        if (!isAdmin) throw new Error('Only an authorized administrator can remove a submission.');
        if (prior.exists) {
          tx.create(db.collection('academicRecordHistory').doc(), { source: reference.path, before: prior.data(), action: 'delete', actorUid: staff.uid, at: admin.firestore.FieldValue.serverTimestamp() });
          tx.delete(reference);
        }
        return { success: true };
      }
      if (!['9th', '10th', '11th', '12th'].includes(payload.className) || typeof payload.subject !== 'string' || payload.subject.length > 100 || !payload.subject ||
          !Array.isArray(payload.records) || !payload.records.length || payload.records.length > 500) throw new Error('Choose a class, subject and between 1 and 500 student records.');
      const config = settings.data() || {};
      const session = sessionKey(payload.yearSuffix || payload.sessionYear || payload.sessionCanonical);
      if (!/^20\d{2}-\d{2}$/.test(session)) throw new Error('A valid academic session is required.');
      if (type === 'practicalsData') {
        const definition = subjectDefinitions.find(subject => subject.name === payload.subject);
        if (!definition || definition.code !== payload.subjectCode) throw new Error('Select a configured subject and its matching code.');
      }
      const expectedId = type === 'attendance'
        ? `${payload.className}_${payload.date}_${payload.subject === 'General' ? 'general' : payload.subject}`
        : `${payload.className}_${payload.subject}_${payload.practicalType}_${payload.yearSuffix || session}`;
      if (!isAdmin && data.docId !== expectedId) throw new Error('The submission ID does not match this class, subject and date or assessment.');
      const explicitAssignment = (config.permissions || []).some(permission => key(permission.email) === key(staff.email) &&
        classKey(permission.className) === classKey(payload.className) && [key(payload.subject), key(payload.subjectCode)].includes(key(permission.subject)));
      const profileAssignment = Array.isArray(staff.assignedClasses) && staff.assignedClasses.includes(payload.className) && key(staff.subject) === key(payload.subject);
      if (!isAdmin && !explicitAssignment && !profileAssignment) throw new Error('This class and subject are not assigned to your account.');
      if (!isAdmin && site.data()?.[type === 'attendance' ? 'attendanceSubmissionOpen' : 'practicalsSubmissionOpen'] === false) throw new Error('Submissions are currently closed.');
      if (!isAdmin && prior.exists && (prior.data().isLocked || prior.data().status === 'submitted' ||
        (prior.data().teacherUid ? prior.data().teacherUid !== staff.uid : prior.data().submittedByEmail && key(prior.data().submittedByEmail) !== key(staff.email)))) throw new Error('This submission is locked or belongs to another teacher. Request an administrator correction.');
      const roster = await loadCohort(tx, db, session, payload.className);
      const identities = new Set();
      let maximum, minimum;
      if (type === 'practicalsData') {
        const evaluation = (config.customEvaluations || []).find(item => item.evalType === payload.practicalType && item.session === session && item.classes?.includes(payload.className));
        if (evaluation && !isAdmin && evaluation.isOpenForTeachers === false) throw new Error('This assessment is closed.');
        const policy = evaluation ? { max: Number(evaluation.maxMarks), min: Number(evaluation.minMarks) } : getSubjectMarksConfig(config, payload.className, payload.practicalType, payload.subjectCode);
        maximum = policy.max; minimum = policy.min;
        if (!Number.isFinite(maximum) || maximum <= 0 || !Number.isFinite(minimum) || minimum <= 0 || minimum > maximum) throw new Error('The marks scheme needs administrator configuration.');
      }
      const records = payload.records.map(row => {
        const form = studentForm(row), reg = studentReg(row);
        if (!form && !reg) throw new Error('Every row needs a form or registration number.');
        const matches = roster.filter(student => (!form || studentForm(student) === form) && (!reg || studentReg(student) === reg));
        if (matches.length !== 1) throw new Error('A student is missing from this cohort or has a duplicate identity. Refresh the roster.');
        const identity = studentForm(matches[0]) || studentReg(matches[0]);
        if (identities.has(identity)) throw new Error('A student appears more than once.');
        identities.add(identity);
        const clean = { formNo: String(row.formNo || ''), regNo: String(row.regNo || row.boardRegNo || ''), name: String(row.name || '').slice(0, 100),
          rollNo: String(row.rollNo || '').slice(0, 40), examRollNo: String(row.examRollNo || '').slice(0, 40) };
        if (type === 'attendance') {
          if (!['P', 'A', 'L', 'H', 'E'].includes(row.status)) throw new Error('Invalid attendance status.');
          clean.status = row.status;
        } else {
          const absent = /^(a|ab|absent)$/i.test(String(row.totalMarks));
          const value = Number(row.totalMarks);
          if (!absent && (row.totalMarks === '' || row.totalMarks == null || !Number.isFinite(value) || value < 0 || value > maximum)) throw new Error('Marks must be within the configured range; blank marks cannot be submitted.');
          clean.totalMarks = absent ? 'AB' : value;
          const practical = Number(row.practicalMarks), viva = row.vivaMarks === '' || row.vivaMarks == null ? 0 : Number(row.vivaMarks);
          if (!absent && (row.practicalMarks === '' || row.practicalMarks == null || !Number.isFinite(practical) || !Number.isFinite(viva) || practical < 0 || viva < 0 || practical + viva !== value)) throw new Error('The marks components must be complete and agree with the total.');
          clean.practicalMarks = absent ? 'AB' : String(practical);
          clean.vivaMarks = absent ? 'AB' : (row.vivaMarks === '' || row.vivaMarks == null ? '' : String(viva));
        }
        return clean;
      });
      const document = { docId: data.docId, className: payload.className, subject: payload.subject, sessionCanonical: session, records,
        teacherUid: staff.uid, submittedByEmail: staff.email, submittedByName: staff.name || '', updatedAt: new Date().toISOString() };
      if (type === 'attendance') {
        if (!/^20\d{2}-\d{2}-\d{2}$/.test(payload.date || '')) throw new Error('A valid attendance date is required.');
        const date = new Date(`${payload.date}T12:00:00Z`);
        if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== payload.date) throw new Error('The attendance date is invalid.');
        Object.assign(document, { date: payload.date, sessionYear: session });
      } else Object.assign(document, { yearSuffix: session, subjectCode: String(payload.subjectCode || ''), practicalType: String(payload.practicalType || ''),
        maxMarks: maximum, minMarks: minimum, status: 'submitted', isDraft: false, isLocked: true });
      if (prior.exists) tx.create(db.collection('academicRecordHistory').doc(), { source: reference.path, before: prior.data(), action: 'update', actorUid: staff.uid, at: admin.firestore.FieldValue.serverTimestamp() });
      tx.set(reference, document);
      return { success: true };
    });
  } catch (error) { throw new functions.https.HttpsError(error.status === 403 ? 'permission-denied' : 'failed-precondition', error.message); }
});
