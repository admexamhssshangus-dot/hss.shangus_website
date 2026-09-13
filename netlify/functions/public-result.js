'use strict';
const { createHandler, findStudent, normalize, classKey, sessionKey, first, FIELDS } = require('./lib/publicRecords');
const { expectedSubjectCodes, gradeAssessment } = require('../../src/shared/assessment');
async function lookupResult(db, body) {
  if (body.action === 'config') {
    const snapshot = await db.collection('adminPracticalsSettings').doc('config').get();
    const evaluations = (snapshot.data()?.customEvaluations || []).filter(item => item.isPublishedForStudents === true)
      .map(({ id, title, evalType, session, classes, biologyDisplayMode, maxMarks, minMarks, subjectOverrides, normalizeTo50, allowedStatuses, description }) => ({
        id, title, evalType, session, classes, biologyDisplayMode, maxMarks, minMarks, subjectOverrides, normalizeTo50, allowedStatuses, description
      }));
    return { evaluations };
  }
  if (!/^[a-zA-Z0-9/_.-]{1,64}$/.test(body.query || '') || !['9th', '10th', '11th', '12th'].includes(body.className) ||
      !/^20\d{2}-\d{2}$/.test(body.session || '') || typeof body.evaluation !== 'string' || body.evaluation.length > 100) {
    throw Object.assign(new Error('Enter a valid student identifier, class, session and assessment.'), { status: 400 });
  }
  const settings = await db.collection('adminPracticalsSettings').doc('config').get();
  const evaluation = (settings.data()?.customEvaluations || []).find(item =>
    normalize(item.evalType || item.title) === normalize(body.evaluation) && item.session === body.session &&
    Array.isArray(item.classes) && item.classes.includes(body.className));
  if (!evaluation || evaluation.isPublishedForStudents !== true) throw Object.assign(new Error('Results for this assessment are not published.'), { status: 404 });
  const { data, student } = await findStudent(db, body);
  // One bounded class query, then exact assessment/session matching. No full
  // collection downloads and no sample data presented as student results.
  const snapshot = await db.collection('practicalsData').where('className', '==', body.className).limit(200).get();
  if (snapshot.size === 200) throw Object.assign(new Error('Results require an index refresh. Please contact the school.'), { status: 503 });
  const subjects = [];
  for (const snap of snapshot.docs) {
    const section = snap.data();
    if (section.isDraft === true || section.status !== 'submitted' ||
        classKey(section.className) !== classKey(body.className) ||
        sessionKey(section.sessionCanonical || section.yearSuffix || section.session || section.sessionText) !== body.session ||
        normalize(section.practicalType) !== normalize(body.evaluation)) continue;
    const matches = (section.records || []).filter(record => {
      const form = first(record, FIELDS.formNo), reg = first(record, FIELDS.regNo), roll = first(record, FIELDS.rollNo);
      if (form && normalize(form) === normalize(student.formNo) && (!reg || normalize(reg) === normalize(student.boardRegNo))) return true;
      if (reg && normalize(reg) === normalize(student.boardRegNo)) return true;
      if (roll && student.classRollNo && normalize(roll) === normalize(student.classRollNo)) return true;
      return false;
    });
    if (matches.length > 1) throw Object.assign(new Error('A duplicate result needs school review.'), { status: 409 });
    if (!matches.length) continue;
    const subjOverride = evaluation.subjectOverrides?.[section.subjectCode];
    const resolvedMax = section.maxMarks ?? subjOverride?.maxMarks ?? evaluation.maxMarks ?? 50;
    const resolvedMin = section.minMarks ?? subjOverride?.minMarks ?? evaluation.minMarks ?? Math.ceil(resolvedMax * 0.36);
    subjects.push({ subjectCode: section.subjectCode, subjectName: section.subjectName || section.subject,
      marksObtained: matches[0].totalMarks ?? matches[0].practicalMarks,
      maxMarks: resolvedMax, minMarks: resolvedMin });
  }
  const grade = gradeAssessment(subjects, expectedSubjectCodes(data));
  if (!grade.hasMarks) throw Object.assign(new Error('Marks for this student are not yet available.'), { status: 404 });
  return { result: { ...student, ...grade, evalTitle: evaluation.title || body.evaluation } };
}
exports.handler = createHandler(lookupResult);
exports.lookupResult = lookupResult;
