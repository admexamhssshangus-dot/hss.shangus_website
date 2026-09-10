// Display form numbers must never replace physical Firestore document IDs.
export const identityKey = value => String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');
export const classKey = value => {
  const key = identityKey(value).replace(/^class/, '');
  return key.match(/\d+/)?.[0] || ({ ix: '9', x: '10', xi: '11', xii: '12' }[key] || key);
};
export const sessionKey = value => {
  const text = String(value ?? '').trim();
  const match = text.match(/(20\d{2})\s*[-/]\s*(\d{2,4})/);
  return match ? `${match[1]}-${match[2].slice(-2)}` : identityKey(text);
};
export function recordIdentity(student = {}) {
  const s = { ...(student.raw || {}), ...student };
  return {
    form: identityKey(s.formNo || s['Form Number'] || s['Form No.']),
    reg: identityKey(s.boardRegNo || s.regNo || s['Board Registration Number'] || s['Board Reg. No.']),
    roll: identityKey(s.classRollNo || s['Class Roll No'] || s['Class Roll No.'] || s.rollNo),
    adm: identityKey(s.admNo || s['Admission No.'] || s['Adm. No.']),
    className: classKey(s.classCanonical || s.selectedClass || s.className || s.Class || s.class || s['Admission sought for class']),
    session: sessionKey(s.sessionCanonical || s.selectedSession || s.Session || s.session || s['Academic Session'])
  };
}
export function sameCohort(student, session, className) {
  const identity = recordIdentity(student);
  return (!session || session === 'All' || identity.session === sessionKey(session)) &&
    (!className || className === 'All' || identity.className === classKey(className));
}
export function uniqueStudentMatch(students, identifiers, session, className) {
  const provided = Object.entries(identifiers).filter(([, value]) => identityKey(value));
  if (!provided.length) return null;
  const matches = students.filter(student => {
    if (!sameCohort(student, session, className)) return false;
    const actual = recordIdentity(student);
    // All supplied identifiers must agree; never fall through after a conflict.
    return provided.every(([key, value]) => actual[key] === identityKey(value));
  });
  return matches.length === 1 ? matches[0] : null;
}
export function recordLocator(student = {}) {
  const s = { ...(student.raw || {}), ...student };
  const parent = s._parentDocId || s.parentDocId;
  const collection = s._srcCollection || s._sourceCollection || s._source || s.sourceCollection ||
    (parent || s._isHistorical || s.isHistoricalMasterRegister ? 'masterRegisters' : 'admissions');
  const documentId = parent || s._docId || s.docId || s.id;
  if (!['admissions', 'masterRegisters'].includes(collection) || !documentId || String(documentId).includes('/')) {
    throw new Error('The source document is missing. Refresh the student list before editing.');
  }
  return { collection, documentId: String(documentId), arrayKey: parent ? (s._arrayKey || s.arrayKey || '') : '',
    nested: Boolean(parent), identity: recordIdentity(s) };
}
export function locateNestedRecord(data, locator) {
  const arrayKey = locator.arrayKey || ['items', 'students', 'records', 'data'].find(key => Array.isArray(data[key]));
  const records = data[arrayKey];
  if (!Array.isArray(records)) throw new Error('The archived student list no longer exists.');
  const expected = locator.identity;
  if (!expected.form && !expected.reg) throw new Error('A unique form or registration number is required for an archived edit.');
  const matches = records.map((record, index) => ({ record, index })).filter(({ record }) => {
    const actual = recordIdentity({ Session: data.Session || data.session, Class: data.Class || data.class || data.className, ...record });
    return (!expected.form || actual.form === expected.form) && (!expected.reg || actual.reg === expected.reg) &&
      (!expected.session || actual.session === expected.session) && (!expected.className || actual.className === expected.className);
  });
  if (matches.length !== 1) throw new Error('Archived student identity is missing or ambiguous. No records were changed.');
  return { arrayKey, records, ...matches[0] };
}
