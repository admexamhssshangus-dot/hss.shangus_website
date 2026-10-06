'use strict';
const { createHandler, findStudent, normalize, classKey, sessionKey, first, FIELDS } = require('./lib/publicRecords');
const { expectedSubjectCodes, gradeAssessment } = require('../../src/shared/assessment');

// A public result can only ever be a School Based Assessment result.  Practical
// awards (Internal/External, viva, lab and award rolls) remain confidential even
// when an old, mixed legacy document is accidentally marked as published.
const PRACTICAL_EVALUATION = /practical|internal|external|viva|lab|award/;
const SCHOOL_ASSESSMENT_EVALUATION = /preboard|golden|midterm|unit|termend|competitive|omr|schoolbased/;
function isPublishedSchoolAssessment(item) {
  const key = normalize(item?.evalType || item?.title || item?.id || '');
  return Boolean(key) && SCHOOL_ASSESSMENT_EVALUATION.test(key) && !PRACTICAL_EVALUATION.test(key);
}
async function publishedSchoolEvaluations(db) {
  // New authoritative settings live with the School Based Assessment suite.
  // Filtered legacy fallback maintains existing published school results while
  // a production installation completes its data migration.
  const school = await db.collection('schoolAssessmentSettings').doc('config').get();
  const legacy = school.exists ? null : await db.collection('adminPracticalsSettings').doc('config').get();
  const settings = school.exists ? school.data() : legacy?.data();
  return (settings?.customEvaluations || []).filter(item =>
    item?.isPublishedForStudents === true && isPublishedSchoolAssessment(item)
  );
}

async function lookupResult(db, body) {
  if (body.action === 'config') {
    const evaluations = (await publishedSchoolEvaluations(db))
      .map(({ id, title, evalType, session, classes, biologyDisplayMode, maxMarks, minMarks, subjectOverrides, normalizeTo50, allowedStatuses, description }) => ({
        id, title, evalType, session, classes, biologyDisplayMode, maxMarks, minMarks, subjectOverrides, normalizeTo50, allowedStatuses, description
      }));
    return { evaluations };
  }
  if (!/^[a-zA-Z0-9/_.-]{1,64}$/.test(body.query || '') || !['9th', '10th', '11th', '12th'].includes(body.className) ||
      !/^20\d{2}-\d{2}$/.test(body.session || '') || typeof body.evaluation !== 'string' || body.evaluation.length > 100) {
    throw Object.assign(new Error('Enter a valid student identifier, class, session and assessment.'), { status: 400 });
  }
  const evaluation = (await publishedSchoolEvaluations(db)).find(item =>
    normalize(item.evalType || item.title) === normalize(body.evaluation) && item.session === body.session &&
    Array.isArray(item.classes) && item.classes.includes(body.className));
  if (!evaluation || evaluation.isPublishedForStudents !== true) throw Object.assign(new Error('Results for this assessment are not published.'), { status: 404 });
  const { data, student } = await findStudent(db, body);
  // One bounded class query, then exact assessment/session matching. No full
  // collection downloads and no sample data presented as student results.
  // School assessments are read from their own collection. A temporary,
  // bounded legacy fallback is filtered by the classifier below so a practical
  // award can never be projected through this public endpoint.
  let snapshot = await db.collection('schoolAssessmentsData').where('className', '==', body.className).limit(500).get();
  if (snapshot.empty) {
    snapshot = await db.collection('practicalsData').where('className', '==', body.className).limit(500).get();
  }

  // 1. Identify and deduplicate matching sections (prioritize latest pending_ or newer submission per subject)
  const sectionsBySubj = new Map();
  for (const snap of snapshot.docs) {
    const section = snap.data();
    if ((section.isDraft === true && section.status !== 'approved') || (section.status === 'draft' && section.status !== 'approved') || section.status === 'rejected') continue;
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

    // Evaluation matching - strictly school-based assessments (Pre-board,
    // golden test, unit test, etc.). Never project practical awards.
    const targetEval = normalize(body.evaluation);
    const docEval = normalize(section.practicalType || section.evaluationType || section.examTitle || section.type || section.docId || snap.id || '');
    if (!isPublishedSchoolAssessment({ evalType: docEval })) continue;

    const isEvalMatched = docEval === targetEval ||
      docEval.includes(targetEval) || targetEval.includes(docEval) ||
      (targetEval.includes('preboard') && docEval.includes('preboard')) ||
      (targetEval.includes('golden') && docEval.includes('golden')) ||
      (targetEval.includes('unit') && docEval.includes('unit'));
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
  const expectedCodes = expectedSubjectCodes(data);
  const expectsBio = expectedCodes.includes('BI') || (!expectedCodes.includes('BO') && !expectedCodes.includes('ZO'));

  const subjects = [];
  let botanyEntry = null;
  let zoologyEntry = null;

  for (const [subjCode, section] of sectionsBySubj.entries()) {
    const sCodeNorm = (section.subjectCode || subjCode || '').toUpperCase().trim();
    if (expectedCodes.length > 0) {
      const isExpected = expectedCodes.includes(sCodeNorm) ||
        ((sCodeNorm === 'EN' || sCodeNorm === 'GE') && (expectedCodes.includes('EN') || expectedCodes.includes('GE'))) ||
        (['BO', 'ZO'].includes(sCodeNorm) && (expectedCodes.includes('BI') || expectedCodes.includes('BO') || expectedCodes.includes('ZO')));
      if (!isExpected) continue;
    }

    const matches = (section.records || []).filter(record => {
      const form = first(record, FIELDS.formNo);
      const reg = first(record, FIELDS.regNo);
      const roll = first(record, FIELDS.rollNo);
      const recName = normalize(first(record, ['name', 'studentName']));
      const stuName = normalize(student.name);

      const isNameMatch = recName && stuName && recName.length > 3 && stuName.length > 3 && (recName === stuName || recName.includes(stuName) || stuName.includes(recName));

      if (reg && student.boardRegNo) {
        const cReg = normalize(reg);
        const cStuReg = normalize(student.boardRegNo);
        const isFullReg = cReg.length >= 10 && cStuReg.length >= 10;
        if (isFullReg ? cReg === cStuReg : (cReg === cStuReg || cReg.endsWith(cStuReg) || cStuReg.endsWith(cReg))) {
          if (recName && stuName && !isNameMatch) {
            // Suffix collision across different students; reject
          } else {
            return true;
          }
        }
      }
      if (form && student.formNo && normalize(form) === normalize(student.formNo)) {
        if (recName && stuName && !isNameMatch) {
          // Cross-student form collision; reject
        } else {
          return true;
        }
      }
      if (roll && student.classRollNo && normalize(roll) === normalize(student.classRollNo)) {
        if (recName && stuName && recName.length > 3 && stuName.length > 3) {
          if (!isNameMatch) {
            return false;
          }
        }
        return true;
      }
      if (isNameMatch) {
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
