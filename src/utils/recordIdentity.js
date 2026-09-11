// Display form numbers must never replace physical Firestore document IDs.
export const identityKey = value => String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');
export const classKey = value => {
  const key = identityKey(value).replace(/^class/, '');
  return key.match(/\d+/)?.[0] || ({ ix: '9', x: '10', xi: '11', xii: '12' }[key] || key);
};
export const sessionKey = value => {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return '';
  const match = text.match(/(20\d{2})\s*[-/]\s*(\d{2,4})/);
  if (match) return `${match[1]}-${match[2].slice(-2)}`;
  // Handle sessions like "2026 APR/BIAN" or "2026-APR/BIAN"
  const yearMatch = text.match(/\b(20\d{2})\b/);
  const isBian = /bian|bi-annual|apr/i.test(text);
  if (yearMatch && isBian) return `${yearMatch[1]}-bian`;
  if (yearMatch) return yearMatch[1];
  return identityKey(text);
};

export function recordIdentity(student = {}) {
  const s = { ...(student.raw || {}), ...student };
  return {
    form: identityKey(s.formNo || s['Form Number'] || s['Form No.'] || s['Form No']),
    reg: identityKey(s.boardRegNo || s.regNo || s.boardReg || s['Board Registration Number'] || s['Board Registration No.'] || s['Board Registration No'] || s['Board Reg. No.'] || s['Board Reg No'] || s['Registration No. (allotted by JKBOSE)'] || s['Registration No. (allotted by JKBOSE )'] || s['Registration No.'] || s['Registration No'] || s['Reg. No.'] || s['Reg No'] || s['REG. NO.'] || s['REG NO']),
    roll: identityKey(s.classRollNo || s['Class Roll No'] || s['Class Roll No.'] || s['RL. NO.'] || s['RL. NO'] || s['Class R.No.'] || s.rollNo),
    adm: identityKey(s.admNo || s['Admission No.'] || s['Admission No'] || s['Admission Number'] || s['Adm. No.'] || s['Adm No'] || s.admissionNo),
    className: classKey(s.classCanonical || s.selectedClass || s.className || s.Class || s.class || s['Admission sought for class']),
    session: sessionKey(s.sessionCanonical || s.selectedSession || s.Session || s.session || s['Academic Session'])
  };
}

export function sameCohort(student, session, className) {
  const identity = recordIdentity(student);
  const targetSessionKey = sessionKey(session);
  const targetClassKey = classKey(className);

  const matchSession = !session || session === 'All' || !targetSessionKey || identity.session === targetSessionKey;
  const matchClass = !className || className === 'All' || !targetClassKey || identity.className === targetClassKey;

  return matchSession && matchClass;
}

export function uniqueStudentMatch(students, identifiers, session, className) {
  const cleanIdentifiers = Object.fromEntries(
    Object.entries(identifiers).map(([k, v]) => [k, identityKey(v)]).filter(([, v]) => v)
  );
  if (!Object.keys(cleanIdentifiers).length) return null;

  const cohortStudents = students.filter(student => sameCohort(student, session, className));

  // 1. Primary Authority: Board Registration Number (100% unique nationwide / boardwide)
  if (cleanIdentifiers.reg) {
    const regMatches = cohortStudents.filter(student => {
      const actual = recordIdentity(student);
      if (cleanIdentifiers.form && actual.form && actual.form !== cleanIdentifiers.form) return false;
      if (cleanIdentifiers.adm && actual.adm && actual.adm !== cleanIdentifiers.adm) return false;
      return actual.reg && actual.reg === cleanIdentifiers.reg;
    });
    if (regMatches.length === 1) return regMatches[0];
  }

  // 2. Secondary Authority: Admission Number or Form Number
  if (cleanIdentifiers.adm || cleanIdentifiers.form) {
    const idMatches = cohortStudents.filter(student => {
      const actual = recordIdentity(student);
      const matchAdm = cleanIdentifiers.adm && actual.adm === cleanIdentifiers.adm;
      const matchForm = cleanIdentifiers.form && actual.form === cleanIdentifiers.form;
      return matchAdm || matchForm;
    });
    if (idMatches.length === 1) return idMatches[0];
  }

  // 3. Fallback Authority: Class Roll Number within the confirmed cohort
  if (cleanIdentifiers.roll) {
    const rollMatches = cohortStudents.filter(student => {
      const actual = recordIdentity(student);
      if (!actual.roll) return false;
      if (actual.roll === cleanIdentifiers.roll) return true;
      const numActual = parseInt(actual.roll.replace(/\D/g, ''), 10);
      const numProv = parseInt(cleanIdentifiers.roll.replace(/\D/g, ''), 10);
      return !isNaN(numActual) && !isNaN(numProv) && numActual === numProv;
    });
    if (rollMatches.length === 1) return rollMatches[0];
  }

  return null;
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
