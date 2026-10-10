'use strict';
const { requireStaff, roleKey } = require('./access');
const { key, sessionKey, classKey, studentForm, studentReg, loadCohort } = require('./academicData');
const { getAssignedClassRollNumber } = require('./admissionStatus');
const { getSubjectMarksConfig } = require('./marksPolicy');
const subjectDefinitions = require('./subjectDefinitions.json');

function isClassSubmissionOpen(config, className) {
  const windows = config?.submissionWindows || config?.classSubmissionStatus || {};
  const normalized = String(className || '').toLowerCase().replace(/class/g, '').trim();
  const keyWithTh = normalized.endsWith('th') ? normalized : `${normalized}th`;
  const window = windows[keyWithTh] ?? windows[normalized];
  if (window === undefined) return true;
  return typeof window === 'object' && window !== null
    ? window.enabled !== false
    : window !== false;
}

function normalizeStaffClasses(assignedClasses) {
  if (!assignedClasses) return [];
  const list = Array.isArray(assignedClasses) ? assignedClasses : [assignedClasses];
  const set = new Set();
  list.forEach(item => {
    if (!item) return;
    String(item).split(/[,;/|]+/).forEach(tok => {
      const clean = tok.trim().toLowerCase();
      if (!clean) return;
      if (clean.includes('9')) set.add('9th');
      else if (clean.includes('10')) set.add('10th');
      else if (clean.includes('11')) set.add('11th');
      else if (clean.includes('12')) set.add('12th');
    });
  });
  return Array.from(set);
}

function isStaffSubjectMatch(staffSubjectCandidate, targetSubject, targetSubjectCode) {
  if (!staffSubjectCandidate) return false;
  const staffStr = String(staffSubjectCandidate).trim();
  const targetSub = String(targetSubject || '').trim();
  const targetCode = String(targetSubjectCode || '').toUpperCase().trim();

  const staffKey = key(staffStr);
  const targetKey = key(targetSub);
  const targetCodeKey = key(targetCode);

  if (staffKey === targetKey || (targetCodeKey && staffKey === targetCodeKey)) return true;

  const staffUpper = staffStr.toUpperCase();
  if (targetCode && (staffUpper === targetCode || new RegExp(`(^|[^A-Z0-9])${targetCode}(?![A-Z0-9])`, 'i').test(staffUpper))) return true;

  const aliasGroups = [
    ['PD', 'PE', 'PHE', 'PHYSICALEDUCATION', 'PHYSICALED', 'PHYED'],
    ['ES', 'EVS', 'ENVIRONMENTALSCIENCE', 'ENVSCI'],
    ['ITE', 'IT', 'ITES', 'ITANDITES', 'ITITES', 'INFORMATIONTECHNOLOGY'],
    ['HTC', 'HC', 'HEALTHCARE', 'HEALTH'],
    ['BI', 'BIO', 'BIOLOGY', 'BOTANY', 'ZOOLOGY', 'BO', 'ZO'],
    ['BO', 'BOTANY', 'BIOLOGY', 'BI'],
    ['ZO', 'ZOOLOGY', 'BIOLOGY', 'BI'],
    ['PH', 'PHYSICS'],
    ['CH', 'CHEMISTRY'],
    ['MA', 'MATH', 'MATHS', 'MATHEMATICS'],
    ['SC', 'SCIENCE', 'SCIENCECLASS10TH'],
    ['SS', 'SST', 'SOCIALSCIENCE', 'SOCIALSTUDIES', 'SOCIALSCIENCECLASS10TH'],
    ['EN', 'ENGLISH', 'GENERALENGLISH'],
    ['UR', 'URDU'],
    ['HN', 'HINDI'],
    ['AR', 'ARABIC'],
    ['PS', 'POLITICALSCIENCE'],
    ['ED', 'EDUCATION'],
    ['SO', 'SOCIOLOGY'],
    ['EC', 'ECONOMICS'],
    ['HT', 'HISTORY'],
    ['GG', 'GEOGRAPHY'],
    ['CS', 'COMPUTERSCIENCE'],
    ['AY', 'ACCOUNTANCY', 'ACCOUNTS'],
    ['BS', 'BUSINESSSTUDIES', 'BUSINESS']
  ];

  for (const group of aliasGroups) {
    const staffMatches = group.some(alias => staffKey === key(alias));
    const targetMatches = group.some(alias => targetKey === key(alias) || targetCodeKey === key(alias));
    if (staffMatches && targetMatches) return true;
  }

  if (staffKey.length >= 4 && targetKey.length >= 4) {
    if (staffKey.includes(targetKey) || targetKey.includes(staffKey)) return true;
  }

  return false;
}

function checkTeacherAssignment(staff, payload, config) {
  const staffClasses = normalizeStaffClasses(staff.assignedClasses || staff.classes || staff.assignedClass);
  const classMatches = staffClasses.includes(payload.className);

  const staffSubjectCandidates = [];
  if (staff.subject) staffSubjectCandidates.push(staff.subject);
  if (Array.isArray(staff.assignedSubjects)) staffSubjectCandidates.push(...staff.assignedSubjects);
  else if (typeof staff.assignedSubjects === 'string') staffSubjectCandidates.push(...staff.assignedSubjects.split(/[,;/]+/));
  if (Array.isArray(staff.subjects)) staffSubjectCandidates.push(...staff.subjects);
  else if (typeof staff.subjects === 'string') staffSubjectCandidates.push(...staff.subjects.split(/[,;/]+/));
  if (Array.isArray(staff.assignedSubjectCodes)) staffSubjectCandidates.push(...staff.assignedSubjectCodes);

  const subjectMatches = staffSubjectCandidates.some(candidate =>
    isStaffSubjectMatch(candidate, payload.subject, payload.subjectCode)
  );

  if (classMatches && subjectMatches) return true;

  const explicit = (config.permissions || []).some(permission =>
    key(permission.email) === key(staff.email) &&
    classKey(permission.className) === classKey(payload.className) &&
    (isStaffSubjectMatch(permission.subject, payload.subject, payload.subjectCode) ||
     [key(payload.subject), key(payload.subjectCode)].includes(key(permission.subject)))
  );
  if (explicit) return true;

  return false;
}

const factory = ({ functions, admin, requireAppCheck }) => functions.https.onCall(async (data, context) => {
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
        const targetSubj = String(payload.subject || '').trim();
        const targetCode = String(payload.subjectCode || '').trim().toUpperCase();
        const definition = subjectDefinitions.find(subject =>
          (targetCode && subject.code.toUpperCase() === targetCode) ||
          key(subject.name) === key(targetSubj) ||
          (subject.code === 'SC' && key(targetSubj) === 'science') ||
          (subject.code === 'SS' && (key(targetSubj) === 'socialscience' || key(targetSubj) === 'socialstudies' || key(targetSubj) === 'sst'))
        );
        if (!definition) throw new Error('Select a configured subject and its matching code.');
      }
      const canonicalId = type === 'attendance'
        ? `${payload.className}_${payload.date}_${payload.subject === 'General' ? 'general' : payload.subject}`
        : `${payload.className}_${payload.subject}_${payload.practicalType}_${payload.yearSuffix || session}`;
      const expectedId = type === 'practicalsData' ? `pending_${canonicalId}` : canonicalId;
      if (!isAdmin && data.docId !== expectedId) throw new Error('The submission ID does not match this class, subject and date or assessment.');
      const isAssigned = checkTeacherAssignment(staff, payload, config);
      const isCrossSubjectAllowed = type === 'practicalsData' && (payload.isCrossSubject === true || payload.status === 'pending_approval' || payload.isDraft === true || data.docId.startsWith('pending_'));
      if (!isAdmin && !isAssigned && !isCrossSubjectAllowed) throw new Error('This class and subject are not assigned to your account.');
      if (!isAdmin && site.data()?.[type === 'attendance' ? 'attendanceSubmissionOpen' : 'practicalsSubmissionOpen'] === false) throw new Error('Submissions are currently closed.');
      if (!isAdmin && type === 'practicalsData' && !isClassSubmissionOpen(config, payload.className)) throw new Error(`Practical submissions are closed for ${payload.className}.`);
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
      const isDraft = type === 'practicalsData' && (payload.isDraft === true || payload.status === 'draft');
      const records = payload.records.map(row => {
        const form = studentForm(row), reg = studentReg(row);
        if (!form && !reg) throw new Error('Every row needs a form or registration number.');
        const matches = roster.filter(student => (!form || studentForm(student) === form) && (!reg || studentReg(student) === reg));
        if (matches.length === 0) throw new Error('A student is missing from this cohort. Refresh the roster.');
        const rosterStudent = matches.find(s => s._docId && !s._docId.startsWith('masterRegisters/')) || matches[0];
        const identity = studentForm(rosterStudent) || studentReg(rosterStudent);
        if (identities.has(identity)) throw new Error('A student appears more than once.');
        identities.add(identity);
        const classRollNo = getAssignedClassRollNumber(rosterStudent);
        if (!classRollNo) throw new Error('A student in this cohort has no assigned class roll number. Refresh the roster after assigning the roll.');
        const clean = { formNo: String(row.formNo || ''), regNo: String(row.regNo || row.boardRegNo || ''), name: String(row.name || '').slice(0, 100),
          classRollNo: String(classRollNo).slice(0, 40), rollNo: String(classRollNo).slice(0, 40), examRollNo: String(row.examRollNo || '').slice(0, 40) };
        if (type === 'attendance') {
          if (!['P', 'A', 'L', 'H', 'E'].includes(row.status)) throw new Error('Invalid attendance status.');
          clean.status = row.status;
        } else {
          const absent = /^(a|ab|absent)$/i.test(String(row.totalMarks));
          const value = Number(row.totalMarks);
          const blankDraftRow = isDraft && (row.totalMarks === '' || row.totalMarks == null) &&
            (row.practicalMarks === '' || row.practicalMarks == null) &&
            (row.vivaMarks === '' || row.vivaMarks == null);
          if (blankDraftRow) {
            clean.totalMarks = '';
            clean.practicalMarks = '';
            clean.vivaMarks = '';
            return clean;
          }
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
      } else Object.assign(document, {
        canonicalDocId: canonicalId,
        yearSuffix: session,
        subjectCode: String(payload.subjectCode || ''),
        practicalType: String(payload.practicalType || ''),
        maxMarks: maximum,
        minMarks: minimum,
        status: isDraft ? 'draft' : 'pending_approval',
        isDraft,
        isLocked: false
      });
      if (prior.exists) tx.create(db.collection('academicRecordHistory').doc(), { source: reference.path, before: prior.data(), action: 'update', actorUid: staff.uid, at: admin.firestore.FieldValue.serverTimestamp() });
      tx.set(reference, document);
      return { success: true };
    });
  } catch (error) { throw new functions.https.HttpsError(error.status === 403 ? 'permission-denied' : 'failed-precondition', error.message); }
});

factory.normalizeStaffClasses = normalizeStaffClasses;
factory.isStaffSubjectMatch = isStaffSubjectMatch;
factory.checkTeacherAssignment = checkTeacherAssignment;

module.exports = factory;
