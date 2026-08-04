const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'db_30 Jul 2026.xlsx');
const wb = XLSX.readFile(filePath);
const srcWs = wb.Sheets['source_data'];
const admWs = wb.Sheets['adm_form'];

const masterRecords = XLSX.utils.sheet_to_json(srcWs, { defval: '' });
const currentAdmissions = XLSX.utils.sheet_to_json(admWs, { defval: '' });

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

const getStudentName = (st) => {
  if (!st) return '';
  return String(
    st["Student's Name (as per school records)"] ||
    st["Student's Name"] ||
    st['Student Name'] ||
    ''
  ).replace(/^(N\/A|—)$/i, '').trim();
};

const getFatherName = (st) => {
  if (!st) return '';
  return String(
    st["Father's/Guardian's Name (as per school records)"] ||
    st["Father's Name"] ||
    st['Father Name'] ||
    ''
  ).replace(/^(N\/A|—)$/i, '').trim();
};

const cleanFormNo = (val) => {
  if (!val || val === '—') return '—';
  return String(val).replace(/^'/, '').trim();
};

const getStudentEmail = (rec) => {
  if (!rec) return '';
  return String(
    rec['email1'] || rec['Email'] || rec['Email Address'] || rec['E-mail ID'] || rec.email || ''
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
    st['Reg. No.'] ||
    ''
  ).replace(/^(N\/A|—)$/i, '').trim();
  return cleanRegNoVal(raw);
};

const extractRegNoClean = (st) => {
  const raw = extractRegNo(st);
  if (!raw || raw === '—') return '';
  return raw.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
};

const isValidRegNo = (reg) => {
  if (!reg || reg.length < 6) return false;
  if (/[eE]/.test(reg)) return false;
  if (/0{5,}$/.test(reg)) return false;
  const zeros = (reg.match(/0/g) || []).length;
  if (zeros / reg.length >= 0.75) return false;
  return true;
};

const getIdentityKeys = (rec) => {
  const keys = [];
  const reg = extractRegNoClean(rec);
  const sName = getStudentName(rec).toLowerCase();
  const fName = getFatherName(rec).toLowerCase();
  const fNo = cleanFormNo(rec['Form Number'] || rec['FormNo'] || rec['Form No.'] || rec.formNo);
  const email = getStudentEmail(rec);
  const cls = normalizeClassVal(rec['Admission sought for class'] || rec['Class']);
  const sess = normalizeSessionVal(rec['Session']);
  const scope = `${cls}_${sess}`;

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
  if (fNo && fNo !== '—' && fNo.length > 2 && scope) {
    keys.push(`form_${scope}_${fNo.toLowerCase()}`);
  }

  return keys;
};

const masterRecordByIdentity = new Map();
const allRawDocs = [...masterRecords, ...currentAdmissions];

allRawDocs.forEach(rec => {
  const keys = getIdentityKeys(rec);
  keys.forEach(k => {
    if (!masterRecordByIdentity.has(k)) {
      masterRecordByIdentity.set(k, rec);
    }
  });
});

const resolveMasterMatch = (rec) => {
  const keys = getIdentityKeys(rec);
  for (const k of keys) {
    const match = masterRecordByIdentity.get(k);
    if (match) {
      const matchName = getStudentName(match).toLowerCase();
      const recName = getStudentName(rec).toLowerCase();
      if (matchName && recName && matchName !== recName) {
        continue;
      }
      return match;
    }
  }
  return null;
};

const f250272 = currentAdmissions.find(r => String(r['Form Number'] || r['FormNo'] || '').trim() === '250272');
console.log('Active Admission Form 250272:', getStudentName(f250272), '| Reg:', extractRegNo(f250272));

const masterMatch = resolveMasterMatch(f250272);
console.log('Resolved Master Match for Form 250272:', masterMatch ? getStudentName(masterMatch) : 'NONE', '| Reg:', masterMatch ? extractRegNo(masterMatch) : 'N/A');
