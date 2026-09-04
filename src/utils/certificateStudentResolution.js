import { extractStudentResultMarks } from './jkboseResultManager';

const usable = value => {
  const text = String(value ?? '').trim();
  return Boolean(text && !/^(—|-|n\/?a|null|undefined|none|same as.*)$/i.test(text));
};

const rawRecord = record => record?.raw || record || {};

export const normalizeRegistrationKey = value => String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();

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
  return Boolean(
    sessionKey && classKey &&
    sessionKey === normalizeCertificateSession(targetSession) &&
    classKey === normalizeCertificateClass(targetClass)
  );
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

const explicitStream = record => {
  const raw = rawRecord(record);
  const candidates = [
    raw.Stream, raw.stream, raw['Stream for Class 11th'], raw['Stream opted in Class 11th'],
    raw['Stream / Faculty'], raw.Faculty,
    record?.Stream, record?.stream, record?.['Stream for Class 11th'], record?.['Stream opted in Class 11th'],
    record?.['Stream / Faculty'], record?.Faculty
  ];
  const value = candidates.find(usable);
  if (!value) return '';
  const text = String(value).toLowerCase();
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
    'selectedSubjects', 'Subjects', 'subjects', 'Subs', 'subs',
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
  if (/accountan|business studies|commerce|entrepreneur/.test(text) || ['AC', 'AY', 'BS', 'BST'].some(code => tokens.has(code))) return 'Commerce';
  if (/physics|chemistry|biology|botany|zoology|mathematics|computer science|informatics|biotech/.test(text) || ['PH', 'CH', 'BI', 'BO', 'ZO', 'MA', 'CS', 'IP', 'BT'].some(code => tokens.has(code))) return 'Science';
  if (/political|history|education|sociology|economics|urdu|kashmiri|arabic|geography|islamic|philosophy|psychology|public administration/.test(text) || ['PS', 'HT', 'ED', 'SO', 'EC', 'UR', 'KA', 'AR', 'GG', 'PA'].some(code => tokens.has(code))) return 'Humanities';
  return '';
}

export function resolveCertificateStream(currentRecord, registrationHistory = [], targetClass = '') {
  const classKey = normalizeCertificateClass(targetClass || currentRecord);
  if (classKey === '9' || classKey === '10') return 'General';

  const currentStream = explicitStream(currentRecord) || inferStreamFromFullSubjects(fullSubjectHistory(currentRecord));
  if (currentStream) return currentStream;

  const targetGrade = Number(classKey) || 12;
  const orderedHistory = [...(registrationHistory || [])].sort((a, b) => {
    const aGrade = Number(normalizeCertificateClass(a)) || 0;
    const bGrade = Number(normalizeCertificateClass(b)) || 0;
    const aScore = aGrade <= targetGrade ? targetGrade - aGrade : 100 + aGrade - targetGrade;
    const bScore = bGrade <= targetGrade ? targetGrade - bGrade : 100 + bGrade - targetGrade;
    return aScore - bScore;
  });
  for (const record of orderedHistory) {
    const stream = explicitStream(record) || inferStreamFromFullSubjects(fullSubjectHistory(record));
    if (stream) return stream;
  }
  return 'Unknown';
}
