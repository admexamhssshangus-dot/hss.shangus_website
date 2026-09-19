const subjectDefinitions = require('./subjectDefinitions.json');
const key = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
function expectedSubjectCodes(student) {
  const raw = student.expectedSubjectCodes || student.selectedSubjects || student.subjects || student.subs || student.Subjects || student.Subs ||
    student['Subjects to be taken in Class 11th'] || student['Subjects to be taken in Class 12th'] || student['Subjects to be taken in Class 10th'] ||
    student['Subjects Studied in Class 11th'] || student['Subjects Studied in Class 12th'] || student['Subjects Studied in Class 10th'] ||
    student['Subjects Offered'] ||
    Array.from({ length: 6 }, (_, index) => student[`Subjects${index + 1}`] || student[`subject${index + 1}`] || student[`Subject ${index + 1}`]).filter(Boolean);
  const subjects = Array.isArray(raw) ? raw : String(raw || '').split(/[,;|+]/);
  const aliases = {
    english: 'EN', generalenglish: 'EN', ge: 'EN', en: 'EN',
    botany: 'BO', zoology: 'ZO', biology: 'BI',
    biotechnology: 'BT',
    physics: 'PH', chemistry: 'CH',
    math: 'MA', maths: 'MA', mathematics: 'MA',
    environmentalscience: 'ES', evs: 'ES', es: 'ES',
    physicaleducation: 'PD', pd: 'PD', pe: 'PD', pet: 'PD',
    homescience: 'HSC', computerscience: 'CS',
    politicalscience: 'PS', polscience: 'PS', polsci: 'PS', pol: 'PS', ps: 'PS',
    education: 'ED', edu: 'ED', ed: 'ED',
    history: 'HT', hist: 'HT', ht: 'HT',
    economics: 'EC', eco: 'EC', ec: 'EC',
    sociology: 'SO', soc: 'SO', so: 'SO',
    geography: 'GG', gg: 'GG',
    arabic: 'AR', ar: 'AR',
    kashmiri: 'KS', ks: 'KS',
    persian: 'PE',
    science: 'SC', sci: 'SC', generalscience: 'SC',
    socialscience: 'SS', socialstudies: 'SS', sst: 'SS',
    urdu: 'UR', hindi: 'HN',
    healthcare: 'HTC', health: 'HTC', hc: 'HTC', htc: 'HTC',
    it: 'ITE', ites: 'ITE', itandites: 'ITE', ite: 'ITE'
  };
  const codes = subjects.map(value => {
    const normalized = key(typeof value === 'object' ? (value.code || value.name) : value);
    if (!normalized) return '';
    return aliases[normalized] || subjectDefinitions.find(subject => [key(subject.code), key(subject.name)].includes(normalized))?.code || `UNKNOWN:${normalized}`;
  }).filter(Boolean);
  const distinctCodes = [...new Set(codes)];
  if (distinctCodes.length > 0) return distinctCodes;

  const normCls = key(student.className || student.Class || student.selectedClass || '');
  if (['10th', '9th', '10', '9', 'x', 'ix'].includes(normCls)) {
    return ['EN', 'MA', 'SC', 'SS', 'UR'];
  }
  return [];
}
function gradeAssessment(subjects, expectedCodes) {
  const expected = [...new Set(expectedCodes || [])];
  const byCode = new Map();
  let ambiguous = false;
  subjects.forEach(subject => {
    if (byCode.has(subject.subjectCode)) ambiguous = true;
    byCode.set(subject.subjectCode, subject);
  });
  let incomplete = !expected.length || ambiguous;
  let totalObtained = 0, totalMax = 0, hasFail = false, appeared = false;
  const rows = expected.map(code => {
    const subject = byCode.get(code) || { subjectCode: code, subjectName: code };
    const raw = subject.marksObtained;
    const absent = /^(a|ab|absent)$/i.test(String(raw));
    const maximum = Number(subject.maxMarks), minimum = Number(subject.minMarks);
    const validScale = Number.isFinite(maximum) && maximum > 0 && Number.isFinite(minimum) && minimum > 0 && minimum <= maximum;
    const numeric = typeof raw === 'number' ? raw : (/^\d+(\.\d+)?$/.test(String(raw).trim()) ? Number(raw) : NaN);
    const valid = validScale && (absent || (Number.isFinite(numeric) && numeric >= 0 && numeric <= maximum));
    if (!valid) incomplete = true;
    const isPass = valid && !absent && numeric >= minimum;
    if (valid) {
      totalMax += maximum;
      if (!absent) { totalObtained += numeric; appeared = true; }
      if (!isPass) hasFail = true;
    }
    return { ...subject, marksObtained: absent ? 'AB' : valid ? numeric : '—', isAbsent: absent, isPass,
      status: !valid ? 'Pending' : absent ? 'Absent' : isPass ? 'Pass' : 'Needs Improvement' };
  });
  const percentage = !incomplete && totalMax ? (totalObtained / totalMax * 100).toFixed(1) : null;
  const division = incomplete ? 'Pending / Incomplete' : !appeared ? 'Absent' : hasFail ? 'Reappear / Needs Work' :
    Number(percentage) >= 75 ? 'Distinction (Grade A)' : Number(percentage) >= 60 ? 'First Division' :
    Number(percentage) >= 45 ? 'Second Division' : 'Third Division';
  return { subjects: rows, totalObtained, totalMax, percentage, division, hasFail, incomplete, appeared,
    hasMarks: subjects.some(subject => subject.marksObtained !== '' && subject.marksObtained != null),
    resultStatus: incomplete ? 'PENDING' : !appeared ? 'ABSENT' : hasFail ? 'RE-APPEAR' : 'PASS' };
}
module.exports = { expectedSubjectCodes, gradeAssessment };
