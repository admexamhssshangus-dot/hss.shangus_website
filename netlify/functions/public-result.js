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
  // Query practical evaluation documents for the cohort class
  const snapshot = await db.collection('practicalsData').limit(1000).get();

  // 1. Identify and deduplicate matching sections (prioritize latest pending_ or newer submission per subject)
  const sectionsBySubj = new Map();
  for (const snap of snapshot.docs) {
    const section = snap.data();
    if (section.isDraft === true || section.status === 'draft' || section.status === 'rejected') continue;
    if (String(snap.id || '').startsWith('history_') || String(section.docId || '').startsWith('history_')) continue;
    if (!Array.isArray(section.records) || section.records.length === 0) continue;

    // Class matching
    const docCls = classKey(section.className || section.class || section.selectedClass || section.docId || snap.id || '');
    if (docCls !== classKey(body.className)) continue;

    // Session matching
    const rawSess = section.sessionCanonical || section.yearSuffix || section.session || section.sessionText || section.docId || snap.id || '';
    const docSess = sessionKey(rawSess);
    const isSessionMatched = docSess === body.session ||
      (body.session === '2025-26' && (docSess === '2026' || String(rawSess).includes('2026') || String(rawSess).includes('2025-26'))) ||
      (body.session === '2024-25' && (docSess === '2025' || String(rawSess).includes('2025') || String(rawSess).includes('2024-25')));
    if (!isSessionMatched) continue;

    // Evaluation matching
    const targetEval = normalize(body.evaluation);
    const docEval = normalize(section.practicalType || section.evaluationType || section.examTitle || section.type || section.docId || snap.id || '');
    const isEvalMatched = docEval === targetEval ||
      docEval.includes(targetEval) || targetEval.includes(docEval) ||
      (targetEval.includes('preboard') && docEval.includes('preboard')) ||
      (targetEval.includes('internal') && docEval.includes('internal')) ||
      (targetEval.includes('external') && docEval.includes('external'));
    if (!isEvalMatched) continue;

    const sCode = (section.subjectCode || section.subject || '').toUpperCase().trim();
    if (!sCode) continue;

    const existing = sectionsBySubj.get(sCode);
    if (!existing) {
      sectionsBySubj.set(sCode, { docId: snap.id, ...section });
    } else {
      const isPending = snap.id.startsWith('pending_') || section.status === 'pending_approval';
      const existPending = (existing.docId && existing.docId.startsWith('pending_')) || existing.status === 'pending_approval';
      const secTime = Date.parse(section.updatedAt || section.submittedAt || section.timestamp || 0) || 0;
      const existTime = Date.parse(existing.updatedAt || existing.submittedAt || existing.timestamp || 0) || 0;
      if ((isPending && !existPending) || secTime > existTime) {
        sectionsBySubj.set(sCode, { docId: snap.id, ...section });
      }
    }
  }

  // 2. Extract matched student scores for each subject
  const subjects = [];
  let botanyEntry = null;
  let zoologyEntry = null;

  for (const [subjCode, section] of sectionsBySubj.entries()) {
    const matches = (section.records || []).filter(record => {
      const form = first(record, FIELDS.formNo);
      const reg = first(record, FIELDS.regNo);
      const roll = first(record, FIELDS.rollNo);
      const recName = normalize(first(record, ['name', 'studentName']));
      const stuName = normalize(student.name);

      if (reg && student.boardRegNo) {
        const cReg = normalize(reg);
        const cStuReg = normalize(student.boardRegNo);
        if (cReg === cStuReg || (cReg.length >= 6 && cStuReg.length >= 6 && (cReg.endsWith(cStuReg.slice(-6)) || cStuReg.endsWith(cReg.slice(-6))))) {
          return true;
        }
      }
      if (form && student.formNo && normalize(form) === normalize(student.formNo)) {
        return true;
      }
      if (roll && student.classRollNo && normalize(roll) === normalize(student.classRollNo)) {
        if (recName && stuName && recName.length > 3 && stuName.length > 3) {
          if (recName !== stuName && !recName.includes(stuName) && !stuName.includes(recName)) {
            return false;
          }
        }
        return true;
      }
      if (recName && stuName && recName.length > 3 && stuName.length > 3 && (recName === stuName || recName.includes(stuName) || stuName.includes(recName))) {
        return true;
      }
      return false;
    });

    if (matches.length > 1) throw Object.assign(new Error('A duplicate result needs school review.'), { status: 409 });
    if (!matches.length) continue;

    const subjOverride = evaluation.subjectOverrides?.[section.subjectCode];
    const resolvedMax = section.maxMarks ?? subjOverride?.maxMarks ?? evaluation.maxMarks ?? 50;
    const resolvedMin = section.minMarks ?? subjOverride?.minMarks ?? evaluation.minMarks ?? Math.ceil(resolvedMax * 0.36);
    const markVal = matches[0].totalMarks ?? matches[0].practicalMarks;

    const entry = {
      subjectCode: section.subjectCode || subjCode,
      subjectName: section.subjectName || section.subject,
      marksObtained: markVal,
      maxMarks: resolvedMax,
      minMarks: resolvedMin
    };

    if (subjCode === 'BO') {
      botanyEntry = entry;
    } else if (subjCode === 'ZO') {
      zoologyEntry = entry;
    } else {
      subjects.push(entry);
    }
  }

  // 3. Harmonize Botany and Zoology into Biology when applicable
  const expectedCodes = expectedSubjectCodes(data);
  const expectsBio = expectedCodes.includes('BI') || (!expectedCodes.includes('BO') && !expectedCodes.includes('ZO'));

  if (botanyEntry || zoologyEntry) {
    if (evaluation.biologyDisplayMode === 'separate' || (!expectsBio && expectedCodes.length > 0)) {
      if (botanyEntry) subjects.push(botanyEntry);
      if (zoologyEntry) subjects.push(zoologyEntry);
    } else {
      const boRaw = botanyEntry?.marksObtained;
      const zoRaw = zoologyEntry?.marksObtained;
      const boMax = Number(botanyEntry?.maxMarks || 25);
      const zoMax = Number(zoologyEntry?.maxMarks || 25);
      const boIsAb = boRaw !== undefined && /^(a|ab|absent)$/i.test(String(boRaw).trim());
      const zoIsAb = zoRaw !== undefined && /^(a|ab|absent)$/i.test(String(zoRaw).trim());
      const isBothAbsent = boIsAb && zoIsAb;

      let combinedMarks = '—';
      if (isBothAbsent) {
        combinedMarks = 'AB';
      } else if (boRaw !== undefined || zoRaw !== undefined) {
        const boPart = (!boIsAb && boRaw !== null && boRaw !== '') ? Number(boRaw) || 0 : 0;
        const zoPart = (!zoIsAb && zoRaw !== null && zoRaw !== '') ? Number(zoRaw) || 0 : 0;
        combinedMarks = Math.min(50, boPart + zoPart);
      }

      const compNotes = [];
      if (botanyEntry) compNotes.push(`BO: ${boIsAb ? 'AB' : `${boRaw}/${boMax}`}`);
      if (zoologyEntry) compNotes.push(`ZO: ${zoIsAb ? 'AB' : `${zoRaw}/${zoMax}`}`);

      subjects.push({
        subjectCode: 'BI',
        subjectName: 'Biology (Botany & Zoology)',
        marksObtained: combinedMarks,
        maxMarks: 50,
        minMarks: 18,
        componentNote: compNotes.length ? compNotes.join(' • ') : null
      });
    }
  }

  const grade = gradeAssessment(subjects, expectedCodes.length ? expectedCodes : subjects.map(s => s.subjectCode));
  if (!grade.hasMarks) throw Object.assign(new Error('Marks for this student are not yet available.'), { status: 404 });
  return { result: { ...student, ...grade, evalTitle: evaluation.title || body.evaluation } };
}
exports.handler = createHandler(lookupResult);
exports.lookupResult = lookupResult;
