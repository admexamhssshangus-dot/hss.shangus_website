const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'db_30 Jul 2026.xlsx');
const wb = XLSX.readFile(filePath);

const srcWs = wb.Sheets['source_data'];
const admWs = wb.Sheets['adm_form'];

const masterRecords = XLSX.utils.sheet_to_json(srcWs, { defval: '' });
const currentAdmissions = XLSX.utils.sheet_to_json(admWs, { defval: '' });

// Simulate exact logic from AdvancedReports.jsx
function normalizeClassVal(cls) {
  if (!cls) return '';
  const str = String(cls).trim().toLowerCase();
  if (str.includes('12') || str.includes('xii')) return '12th';
  if (str.includes('11') || str.includes('xi')) return '11th';
  if (str.includes('10') || str.includes('x')) return '10th';
  if (str.includes('9') || str.includes('ix')) return '9th';
  return str;
}

function normalizeSessionVal(sess) {
  if (!sess) return '';
  const str = String(sess).trim();
  if (/oct|nov|mar|apr|bian|bi-annual|revised/i.test(str)) {
    return str;
  }
  const match = str.match(/(\d{4})\s*[-/]\s*(\d{2,4})/);
  if (match) {
    const yr1 = match[1];
    let yr2 = match[2];
    if (yr2.length === 4) yr2 = yr2.slice(2);
    return `${yr1}-${yr2}`;
  }
  return str;
}

const isValidRegNo = (reg) => {
  if (!reg || reg.length < 6) return false;
  if (/0{5,}$/.test(reg)) return false;
  const zeros = (reg.match(/0/g) || []).length;
  if (zeros / reg.length >= 0.75) return false;
  return true;
};

const getStudentEmail = (rec) => {
  if (!rec) return '';
  return String(
    rec['email1'] || rec['Email'] || rec['Email Address'] || rec['E-mail ID'] || rec.email || rec.email1 || ''
  ).trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '');
};

const cleanRegNoVal = (val) => {
  if (val === null || val === undefined) return '';
  let s = String(val).trim();
  if (!s || /^(N\/A|#N\/A|—|-|null|undefined)$/i.test(s)) return '';
  return s.replace(/\.0+$/, '');
};

const extractRegNo = (st) => {
  if (!st) return '';
  const raw = String(
    st['Board Registration Number'] ||
    st['Board Registration No. (Class 11th)'] ||
    st['Board Registration No. (Class 10th)'] ||
    st['Board Reg. No.'] ||
    st['Board Reg No'] ||
    st['Reg. No.'] ||
    st['Reg No'] ||
    st['Registration No'] ||
    st['Registration Number'] ||
    st.boardRegNo ||
    st.regNo ||
    st.registrationNo ||
    ''
  ).replace(/^(N\/A|—)$/i, '').trim();

  return cleanRegNoVal(raw);
};

const extractRegNoClean = (st) => {
  const raw = extractRegNo(st);
  if (!raw || raw === '—') return '';
  return raw.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
};

const getStudentName = (st) => {
  if (!st) return '';
  return String(
    st["Student's Name (as per school records)"] ||
    st["Student's Name"] ||
    st['Student Name'] ||
    st['Name of Student'] ||
    st['Account Name'] ||
    st.studentName ||
    st['Name'] ||
    st['name'] ||
    ''
  ).replace(/^(N\/A|—)$/i, '').trim();
};

const getFatherName = (st) => {
  if (!st) return '';
  return String(
    st["Father's/Guardian's Name (as per school records)"] ||
    st["Father's Name"] ||
    st['Father Name'] ||
    st.fatherName ||
    st["Parent's Name"] ||
    ''
  ).replace(/^(N\/A|—)$/i, '').trim();
};

const cleanFormNo = (val) => {
  if (!val || val === '—') return '—';
  return String(val).replace(/^'/, '').trim();
};

const extractClassRoll = (st) => {
  if (!st) return '';
  const r = String(st['Class Roll No'] || st['Class R.No.'] || st['Class Roll No.'] || st['RL. NO.'] || st['RL. NO'] || st.classRollNo || st.rollNo || '').trim();
  if (!r || r === '—' || r === 'N/A' || r.toLowerCase() === 'undefined') return '';
  return r;
};

const getIdentityKeys = (rec) => {
  const keys = [];
  const reg = extractRegNoClean(rec);
  const sName = getStudentName(rec).toLowerCase();
  const fName = getFatherName(rec).toLowerCase();
  const fNo = cleanFormNo(rec['Form Number'] || rec['FormNo'] || rec['Form No.'] || rec.formNo);
  const email = getStudentEmail(rec);

  if (email && email.includes('@') && email.length > 5) {
    keys.push(`email_${email}`);
  }
  if (reg && isValidRegNo(reg)) {
    keys.push(`reg_${reg}`);
  }
  if (sName && sName !== 'student' && sName.length > 2) {
    const fatherPart = fName && fName !== '—' ? fName.slice(0, 8) : '';
    keys.push(`name_${sName}_${fatherPart}`);
  }
  if (fNo && fNo !== '—' && fNo.length > 2) {
    keys.push(`form_${fNo.toLowerCase()}`);
  }
  return keys;
};

// SIMULATE DATA LOADING
const masterRecordByIdentity = new Map();
const assignedRollByIdentity = new Map();

const allRawDocs = [...masterRecords, ...currentAdmissions];

allRawDocs.forEach(rec => {
  const keys = getIdentityKeys(rec);
  const rollVal = extractClassRoll(rec);
  const recCls = normalizeClassVal(rec['Admission sought for class'] || rec['Class']);
  const recSess = normalizeSessionVal(rec['Session']);

  keys.forEach(k => {
    if (rollVal && rollVal !== '—' && rollVal !== 'N/A') {
      assignedRollByIdentity.set(`${recCls}_${recSess}_${k}`, rollVal);
    }
    if (!masterRecordByIdentity.has(k)) {
      masterRecordByIdentity.set(k, rec);
    }
  });
});

const activeSeenIdentities = new Set();
const combined = [];

const sortedActive = [...currentAdmissions].sort((a1, a2) => {
  const hasRoll1 = !!extractClassRoll(a1);
  const hasRoll2 = !!extractClassRoll(a2);
  if (hasRoll1 && !hasRoll2) return -1;
  if (!hasRoll1 && hasRoll2) return 1;
  const num1 = parseInt(cleanFormNo(a1['Form Number'] || a1['FormNo'] || a1['formNumber']), 10) || 0;
  const num2 = parseInt(cleanFormNo(a2['Form Number'] || a2['FormNo'] || a2['formNumber']), 10) || 0;
  return num2 - num1;
});

sortedActive.forEach((a, idx) => {
  const regClean = extractRegNoClean(a);
  const nameClean = getStudentName(a).toLowerCase();
  const fnameClean = getFatherName(a).toLowerCase();
  const clsClean = normalizeClassVal(a['Admission sought for class'] || a['Class']);
  const sessClean = normalizeSessionVal(a['Session']);
  const emailClean = getStudentEmail(a);

  const dupKeys = [];
  const scope = `${clsClean}_${sessClean}`;
  if (emailClean && emailClean.includes('@')) {
    dupKeys.push(`dup_${scope}_email_${emailClean}`);
  }
  if (regClean && regClean !== '—' && isValidRegNo(regClean)) {
    dupKeys.push(`dup_${scope}_reg_${regClean}`);
  }
  if (nameClean && nameClean.length > 2 && fnameClean && fnameClean.length > 1) {
    dupKeys.push(`dup_${scope}_identity_${nameClean}_${fnameClean.slice(0, 8)}`);
  }

  if (dupKeys.length > 0 && dupKeys.some(k => activeSeenIdentities.has(k))) {
    // SKIPPED RECORD
    const sName = getStudentName(a);
    const rNo = extractClassRoll(a);
    console.log(`SKIPPED IN SORTED_ACTIVE (${scope}):`, sName, '| Form:', a['Form Number'] || a['FormNo'], '| Roll:', rNo, '| Reg:', regClean);
    return;
  }

  dupKeys.forEach(k => activeSeenIdentities.add(k));

  const targetClass = normalizeClassVal(a['Admission sought for class'] || a['Class'] || '11th');
  const targetSession = normalizeSessionVal(a['Session'] || '2025-26');
  const rollScope = `${targetClass}_${targetSession}`;

  const knownRoll = dupKeys.reduce((found, k) => {
    if (found) return found;
    const rawKey = k.replace(`dup_${rollScope}_`, '');
    return assignedRollByIdentity.get(`${rollScope}_${rawKey}`) || '';
  }, '') || (regClean ? assignedRollByIdentity.get(`${rollScope}_reg_${regClean}`) : '');

  const activeClassRoll = knownRoll || extractClassRoll(a);
  let activeResolvedStatus = (activeClassRoll && activeClassRoll !== '—' && activeClassRoll !== 'N/A') ? 'Approved' : 'Submitted';

  combined.push({
    ...a,
    _isCurrentScope: true,
    classRollNo: activeClassRoll,
    class: targetClass,
    session: targetSession,
    status: activeResolvedStatus,
    studentName: getStudentName(a),
    boardRegNo: regClean
  });
});

console.log('\n=== COMBINED ACTIVE ADMISSIONS RESULTS ===');
const active12_25 = combined.filter(s => s.class === '12th' && s.session === '2025-26');
const active12_25_approved = active12_25.filter(s => s.status === 'Approved');
console.log('Total 12th 2025-26 in combined:', active12_25.length);
console.log('Approved 12th 2025-26 in combined:', active12_25_approved.length);

const rollsFound = new Set(active12_25_approved.map(s => s.classRollNo));
const missing = [];
for (let i = 1; i <= 196; i++) {
  if (!rollsFound.has(String(i))) missing.push(i);
}
console.log('Missing Roll Numbers in 12th 2025-26 Approved:', missing);
