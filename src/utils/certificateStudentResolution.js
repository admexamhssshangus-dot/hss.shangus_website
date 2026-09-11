import { extractStudentResultMarks } from './jkboseResultManager';

const usable = value => {
  const text = String(value ?? '').trim();
  return Boolean(text && !/^(—|-|n\/?a|null|undefined|none|same as.*)$/i.test(text));
};

const rawRecord = record => record?.raw || record || {};

export const normalizeRegistrationKey = value => {
  const cleaned = String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (!cleaned || cleaned.length < 5) return '';
  if (/^(na|nil|null|undefined|none|0+|placeholder)$/i.test(cleaned)) return '';
  if (/0{5,}$/.test(cleaned) || (cleaned.match(/0/g) || []).length / cleaned.length >= 0.75) {
    return '';
  }
  return cleaned;
};

export const areNamesCompatible = (n1, n2) => {
  if (!n1 || !n2) return true;
  const clean1 = String(n1).toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const clean2 = String(n2).toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  if (!clean1 || !clean2 || clean1 === 'student' || clean2 === 'student' || clean1 === '—' || clean2 === '—') return true;
  if (clean1 === clean2) return true;

  if (clean1.startsWith(clean2) || clean2.startsWith(clean1)) return true;
  if (clean1.includes(clean2) || clean2.includes(clean1)) return true;

  const tokens1 = clean1.split(/\s+/).filter(t => t.length > 2);
  const tokens2 = clean2.split(/\s+/).filter(t => t.length > 2);
  if (tokens1.length === 0 || tokens2.length === 0) return true;

  const common = tokens1.filter(t => tokens2.includes(t));
  if (common.length >= 2) return true;
  if (common.length >= 1 && (tokens1.length === 1 || tokens2.length === 1)) return true;

  return false;
};

export function normalizeCertificateClass(value) {
  const inner = typeof value === 'object' ? rawRecord(value) : null;
  const raw = inner
    ? (inner.class || inner.Class || inner.className || inner['Admission sought for class'] || value.class || value.Class || value.className || value['Admission sought for class'] || '')
    : value;
  const text = String(raw || '').toLowerCase();
  if (text.includes('12') || /\bxii\b/.test(text)) return '12';
  if (text.includes('11') || /\bxi\b/.test(text)) return '11';
  if (text.includes('10') || /\bx\b/.test(text)) return '10';
  if (text.includes('9') || /\bix\b/.test(text)) return '9';
  return text.replace(/[^a-z0-9]/g, '');
}

export function normalizeCertificateSession(value) {
  const inner = typeof value === 'object' ? rawRecord(value) : null;
  const raw = inner
    ? (inner.session || inner.Session || inner.academicSession || inner['Academic Session'] || inner.sessionBatch || inner['Session / Batch'] || value.session || value.Session || value.academicSession || value['Academic Session'] || '')
    : value;
  const text = String(raw || '').trim().toLowerCase();
  if (!text) return '';
  const years = Array.from(text.matchAll(/(?:19|20)\d{2}/g), match => match[0]);
  const shortRange = text.match(/((?:19|20)\d{2})\s*[-/]\s*(\d{2})(?!\d)/);
  const yearKey = shortRange ? `${shortRange[1]}-${shortRange[2]}` : years.join('-');
  let cycle = '';
  if (/\b(apr|bian|bi[\s-]*annual|private|supplementary)\b/.test(text)) cycle = 'bian';
  else if (/\b(reg|regular)\b/.test(text)) cycle = 'regular';
  else if (/\bannual\b/.test(text) && !/bi[\s-]*annual/.test(text)) cycle = 'annual';
  const residual = text.replace(/[^a-z0-9]/g, '');
  return `${yearKey || residual}:${cycle || 'unspecified'}`;
}

export function isExactCertificateScope(record, targetSession, targetClass) {
  const sessionKey = normalizeCertificateSession(record);
  const classKey = normalizeCertificateClass(record);
  const targetSessionKey = normalizeCertificateSession(targetSession);
  const targetClassKey = normalizeCertificateClass(targetClass);

  if (!sessionKey || !classKey || sessionKey !== targetSessionKey || classKey !== targetClassKey) {
    return false;
  }

  // Validate explicit exam mode cycle against target session. An archived exam mode
  // from a prior year (e.g. 2024) must never be applied to a subsequent session (e.g. 2026).
  const raw = rawRecord(record);
  const examMode = raw['Exam Mode (Current)'] || raw.currExamMode || raw.examMode || raw['Exam Mode'] || record?.examMode || '';
  if (examMode) {
    const examModeKey = normalizeCertificateSession(examMode);
    if (examModeKey && examModeKey !== targetSessionKey && !examModeKey.startsWith('unspecified:')) {
      return false;
    }
  }

  return true;
}

const resultCompleteness = result => [
  result.hasResult,
  result.examRoll,
  result.examMode,
  result.marksObtained,
  result.reappSubjects,
  result.division
].filter(Boolean).length;

export function resolveScopedCertificateResult(records, targetSession, targetClass) {
  const scoped = (records || []).filter(record => isExactCertificateScope(record, targetSession, targetClass));
  const candidates = scoped
    .map(record => ({ record, result: extractStudentResultMarks(record) }))
    .filter(candidate => candidate.result.hasResult)
    .sort((a, b) => resultCompleteness(b.result) - resultCompleteness(a.result));
  const winner = candidates[0] || null;
  return {
    scopedRecords: scoped,
    resultRecord: winner?.record || null,
    resultInfo: winner?.result || extractStudentResultMarks({})
  };
}

const explicitStream = (record, classKey = '') => {
  const raw = rawRecord(record);
  const candidates = [
    raw.Stream, raw.stream, raw.selectedStream, raw['Stream for Class 11th'], raw['Stream opted in Class 11th'],
    raw['Stream & Subjects for Class 12th'], raw['Stream / Faculty'], raw.Faculty, raw.faculty,
    record?.Stream, record?.stream, record?.selectedStream, record?.['Stream for Class 11th'], record?.['Stream opted in Class 11th'],
    record?.['Stream & Subjects for Class 12th'], record?.['Stream / Faculty'], record?.Faculty, record?.faculty
  ];
  const value = candidates.find(usable);
  if (!value) return '';
  const text = String(value).toLowerCase().trim();
  // In senior secondary (11th & 12th), "General" is never an explicit stream.
  if (text.includes('gen') && (classKey === '11' || classKey === '12')) {
    return '';
  }
  if (text.includes('sci') || text.includes('med')) return 'Science';
  if (text.includes('hum') || text.includes('art')) return 'Humanities';
  if (text.includes('com')) return 'Commerce';
  if (text.includes('gen')) return 'General';
  return '';
};

const fullSubjectHistory = record => {
  const raw = rawRecord(record);
  const keys = [
    'Subjects to be taken in Class 12th', 'Stream & Subjects for Class 12th',
    'Subjects Studied in Class 11th', 'Subjects to be taken in Class 11th',
    'selectedSubjects', 'Subjects', 'subjects', 'Subs', 'subs', 'Subjects Offered',
    'Subjects1', 'Subjects2', 'Subjects3', 'Subjects4', 'Subjects5', 'Subjects6', 'Subject6',
    'subject1', 'subject2', 'subject3', 'subject4', 'subject5', 'subject6'
  ];
  return keys.flatMap(key => {
    const value = raw[key] ?? record?.[key];
    if (Array.isArray(value)) return value.filter(usable).map(String);
    return usable(value) ? [String(value)] : [];
  }).join(' ');
};

export function inferStreamFromFullSubjects(value) {
  const text = String(value || '').toLowerCase();
  if (!text) return '';
  const tokens = new Set(text.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean));
  if (/accountan|business studies|commerce|entrepreneur/.test(text) || ['AC', 'AY', 'BS', 'BST', 'EP', 'BE', 'CO'].some(code => tokens.has(code))) return 'Commerce';
  if (/physics|chemistry|biology|botany|zoology|mathematics|computer science|informatics|biotech|geology|electronics/.test(text) || ['PH', 'CH', 'BI', 'BO', 'ZO', 'MA', 'CS', 'IP', 'BT', 'GL', 'EL'].some(code => tokens.has(code))) return 'Science';
  if (/political|history|education|sociology|economics|urdu|kashmiri|arabic|geography|islamic|philosophy|psychology|public administration|hindi|sanskrit/.test(text) || ['PS', 'HT', 'ED', 'SO', 'EC', 'UR', 'KA', 'AR', 'GG', 'PA', 'IS', 'PY', 'PL', 'HI', 'SN', 'FA'].some(code => tokens.has(code))) return 'Humanities';
  return '';
}

export function normalizeStreamName(streamStr) {
  const text = String(streamStr || '').trim().toLowerCase();
  if (text.includes('hum') || text.includes('art')) return 'Humanities';
  if (text.includes('com')) return 'Commerce';
  if (text.includes('non')) return 'Non-Medical';
  if (text.includes('med')) return 'Medical';
  if (text.includes('sci')) return 'Science';
  if (text.includes('gen')) return 'General';
  return streamStr || 'Humanities';
}

export function streamMatches(studentStream, targetStream) {
  if (!targetStream || targetStream === 'All') return true;
  const s1 = String(studentStream || '').trim().toLowerCase();
  const s2 = String(targetStream || '').trim().toLowerCase();
  if (s1 === s2) return true;

  const isHum1 = s1.includes('hum') || s1.includes('art');
  const isHum2 = s2.includes('hum') || s2.includes('art');
  if (isHum1 && isHum2) return true;

  const isSci1 = s1.includes('sci') || s1.includes('med');
  const isSci2 = s2.includes('sci');
  if (isSci1 && isSci2) return true;

  const isMed2 = s2 === 'medical';
  if (isMed2 && (s1 === 'medical' || s1.includes('medical') || s1.includes('sci'))) return true;

  const isNonMed2 = s2 === 'non-medical' || s2 === 'non medical' || s2 === 'nonmed';
  if (isNonMed2 && (s1.includes('non') || s1.includes('math') || s1.includes('sci'))) return true;

  const isCom1 = s1.includes('com');
  const isCom2 = s2.includes('com');
  if (isCom1 && isCom2) return true;

  return s1.includes(s2) || s2.includes(s1);
}

export function resolveCertificateStream(currentRecord, registrationHistory = [], targetClass = '') {
  const classKey = normalizeCertificateClass(targetClass || currentRecord);
  if (classKey === '9' || classKey === '10') return 'General';

  // 1. Check if current record has sufficient stream-identifying subjects
  const currentSubs = fullSubjectHistory(currentRecord);
  const currentSubjStream = inferStreamFromFullSubjects(currentSubs);
  if (currentSubjStream) return currentSubjStream;

  // 2. Check explicit stream on current record (ignoring 'General' for 11th/12th)
  const currentExplicit = explicitStream(currentRecord, classKey);
  if (currentExplicit) return currentExplicit;

  // 3. IF CURRENT SUBJECTS NOT SUFFICIENT: Use previous record(s) for that registration number!
  const targetGrade = Number(classKey) || 12;
  const orderedHistory = [...(registrationHistory || [])].sort((a, b) => {
    // Prefer history records that actually have subjects
    const aHasSubs = Boolean(fullSubjectHistory(a));
    const bHasSubs = Boolean(fullSubjectHistory(b));
    if (aHasSubs !== bHasSubs) return bHasSubs ? 1 : -1;

    const aGrade = Number(normalizeCertificateClass(a)) || 0;
    const bGrade = Number(normalizeCertificateClass(b)) || 0;
    const aScore = aGrade <= targetGrade ? targetGrade - aGrade : 100 + aGrade - targetGrade;
    const bScore = bGrade <= targetGrade ? targetGrade - bGrade : 100 + bGrade - targetGrade;
    return aScore - bScore;
  });

  for (const record of orderedHistory) {
    // Check subject history first
    const histSubs = fullSubjectHistory(record);
    const histSubjStream = inferStreamFromFullSubjects(histSubs);
    if (histSubjStream) return histSubjStream;

    // Check explicit stream second
    const histExplicit = explicitStream(record, classKey);
    if (histExplicit) return histExplicit;
  }

  return 'Humanities';
}

export function resolveCcDcVal(rec) {
  if (!rec) return '—';
  const raw = rec.raw || rec;
  const candidates = [
    raw['No. & Date of CC/DC Issued (This Institution)'],
    raw['No. & Date of CC/DC Issued'],
    raw['No. and Date of CC/DC Issued (This Institution)'],
    raw['No. and Date of CC/DC Issued'],
    raw['CC/DC No. & Date'],
    raw['CC/DC No. and Date'],
    raw['CC DC Number'],
    raw['TC/DC Number'],
    raw['TC/DC No.'],
    raw.currCcDc,
    raw.dischargeCertNo,
    raw.ccDcNo,
    raw.certificateNo,
    raw.certNo
  ];
  for (const c of candidates) {
    if (c !== undefined && c !== null) {
      const s = String(c).trim();
      if (s && !/^(—|-|n\/?a|null|undefined|none|0)$/i.test(s)) {
        const issueDate = raw.dischargeIssueDate || raw.withdrawalDate || raw['Date of withdrawl'] || raw['Date of Withdrawal'] || raw.resultDate || raw.issueDate;
        if (/^\d+$/.test(s) && issueDate && !/^(—|-|n\/?a|null|undefined)$/i.test(String(issueDate).trim())) {
          return `${s} (${String(issueDate).trim()})`;
        }
        return s;
      }
    }
  }
  return '—';
}

export const normalizeSubjectCode = (rawCode) => {
  const token = String(rawCode || '').trim();
  if (!token) return '';
  const upper = token.toUpperCase();
  if (['GN', 'EN', 'GE'].includes(upper) || /general english|english/i.test(token)) return 'GE';
  if (['UD', 'UR'].includes(upper) || /urdu/i.test(token)) return 'UR';
  if (['CH'].includes(upper) || /chemistry/i.test(token)) return 'CH';
  if (['PH'].includes(upper) || /physics/i.test(token)) return 'PH';
  if (['BI', 'BIO', 'BO', 'ZO'].includes(upper) || /biology|botany|zoology/i.test(token)) return 'BI';
  if (['MA', 'MTH'].includes(upper) || /math/i.test(token)) return 'MA';
  if (['ES', 'EVS'].includes(upper) || /environmental/i.test(token)) return 'ES';
  if (['PD', 'PES'].includes(upper) || /physical education/i.test(token)) return 'PD';
  if (['ED'].includes(upper) || /education/i.test(token)) return 'ED';
  if (['HT', 'HIS'].includes(upper) || /history/i.test(token)) return 'HT';
  if (['PS', 'PLS'].includes(upper) || /political/i.test(token)) return 'PS';
  if (['SO', 'SOC'].includes(upper) || /sociology/i.test(token)) return 'SO';
  if (['EC', 'ECO'].includes(upper) || /economics/i.test(token)) return 'EC';
  if (['AR', 'ARB'].includes(upper) || /arabic/i.test(token)) return 'AR';
  if (['KA', 'KAS'].includes(upper) || /kashmiri/i.test(token)) return 'KA';
  if (['HI', 'HND'].includes(upper) || /hindi/i.test(token)) return 'HI';
  if (['HTC'].includes(upper) || /health/i.test(token)) return 'HTC';
  if (['ITE'].includes(upper) || /it\s*&|ites/i.test(token)) return 'ITE';
  if (['PA', 'PUB'].includes(upper) || /public admin/i.test(token)) return 'PA';
  if (['AC', 'AY'].includes(upper) || /account/i.test(token)) return 'AY';
  if (['BS', 'BST'].includes(upper) || /business/i.test(token)) return 'BS';
  if (['GG', 'GEO'].includes(upper) || /geography/i.test(token)) return 'GG';
  if (!/\s/.test(upper) && upper.length >= 2 && upper.length <= 4) return upper;
  return '';
};

export function extractReappearCodes(student) {
  if (!student) return new Set();
  const raw = student.raw || student;
  const res = String(raw.currResult || raw['Result (Current)'] || raw.result || '').toLowerCase();
  const isPassed = /^(pass|passed|qualified|first|second|third|distinction)\b/.test(res);
  if (isPassed) return new Set();

  const rawReappSources = [
    raw.reappSubjects,
    raw['Reappear Subjects'],
    raw['Subjects to Reappear (Class 11th)'],
    raw['Subjects to Reappear (Class 10th)'],
    raw.currMarksReapp,
    raw['Marks/Reapp (Current)'],
    raw['Marks/Reapp'],
    raw.marksReapp,
    student._rawExamineeSubs,
    raw._rawExamineeSubs
  ];

  const reappearTokens = [];

  rawReappSources.forEach(src => {
    if (!src || src === '—' || src === '-') return;
    const str = String(src).trim();
    if (/^\d+(\s*\/\s*\d+)?$/.test(str)) return;
    if (/^(pass|passed|qualified)$/i.test(str)) return;
    reappearTokens.push(str);
  });

  if (res.includes('reap') && /[a-z]{2,}/i.test(res)) {
    const cleanedRes = res.replace(/^(re-?appear|reap|fail|compartment)[\s:-]*/i, '');
    if (cleanedRes.trim()) {
      reappearTokens.push(cleanedRes.trim());
    }
  }

  const codeSet = new Set();
  reappearTokens.forEach(token => {
    const commaParts = String(token).split(/[,/;+\n\r]+/).map(s => s.trim()).filter(Boolean);
    commaParts.forEach(chunk => {
      const wholeNorm = normalizeSubjectCode(chunk);
      if (wholeNorm && wholeNorm.length >= 2 && !/^(AND|THE|FOR|IN|OF|TO|OR|WITH)$/i.test(wholeNorm)) {
        codeSet.add(wholeNorm);
        return;
      }
      const parts = chunk.split(/\s+/).map(s => s.trim()).filter(Boolean);
      parts.forEach(part => {
        const code = normalizeSubjectCode(part);
        if (code && code.length >= 2 && !/^(AND|THE|FOR|IN|OF|TO|OR|WITH)$/i.test(code)) {
          codeSet.add(code);
        }
      });
    });
  });

  return codeSet;
}
