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

// Removed email from identity keys because emails are shared by siblings/friends filling forms on same device
const getIdentityKeys = (rec) => {
  const keys = [];
  const reg = extractRegNoClean(rec);
  const sName = getStudentName(rec).toLowerCase();
  const fName = getFatherName(rec).toLowerCase();
  const fNo = cleanFormNo(rec['Form Number'] || rec['FormNo'] || rec['Form No.'] || rec.formNo);
  const cls = normalizeClassVal(rec['Admission sought for class'] || rec['Class']);
  const sess = normalizeSessionVal(rec['Session']);
  const scope = `${cls}_${sess}`;

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

const cleanAdmNoVal = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') return String(val);
  const str = String(val).trim();
  if (!str || /^(#N\/A|#VALUE!|#REF!|N\/A|NA|—|-|null|undefined)$/i.test(str)) return '';
  return str;
};

const extractRawAdmNo = (rec) => {
  if (!rec) return '';
  const candidates = [
    rec['admNo'], rec['Adm. No.'], rec['Adm No.'], rec['Adm No'], rec['Adm. No'], rec['Adm.No.'], rec['Adm.No'], rec['AdmNo'], rec['adm_no'], rec['ADM. NO.'], rec['ADM NO'], rec['ADM_NO'], rec['Admission No.'], rec['Admission No'], rec['Admission Number'], rec['Adm. Number'], rec['Adm. #'], rec['Adm #'], rec['Adm_No'], rec['adm_number'], rec['Admission_No'], rec['Admission_Number'], rec['Adm. No. (if allotted)'], rec['Adm No (if allotted)'], rec['Admitted S.No'], rec['Admitted S. No.'], rec['S.No'], rec['S. No.']
  ];
  for (const c of candidates) {
    const cleaned = cleanAdmNoVal(c);
    if (cleaned) return cleaned;
  }
  return '';
};

const admNoSetByIdentity = new Map();
const oldAdmNoByIdentity = new Map();
const allRawDocs = [...masterRecords, ...currentAdmissions];

allRawDocs.forEach(rec => {
  const keys = getIdentityKeys(rec);
  const rawAdm = extractRawAdmNo(rec);
  const cleanedAdm = cleanAdmNoVal(rawAdm);
  const rawOldAdm = cleanAdmNoVal(rec['Old Admission No.'] || rec['Old Adm. No.'] || rec['oldAdmNo']);

  keys.forEach(k => {
    if (!admNoSetByIdentity.has(k)) admNoSetByIdentity.set(k, new Set());
    if (cleanedAdm) admNoSetByIdentity.get(k).add(cleanedAdm);

    if (!oldAdmNoByIdentity.has(k)) oldAdmNoByIdentity.set(k, new Set());
    if (rawOldAdm) oldAdmNoByIdentity.get(k).add(rawOldAdm);
  });
});

const resolveAdmNo = (rec) => {
  const keys = getIdentityKeys(rec);
  const collectedAdms = new Set();
  const collectedOldAdms = new Set();

  keys.forEach(k => {
    const adms = admNoSetByIdentity.get(k);
    if (adms) adms.forEach(a => collectedAdms.add(a));

    const oldAdms = oldAdmNoByIdentity.get(k);
    if (oldAdms) oldAdms.forEach(a => collectedOldAdms.add(a));
  });

  const admsList = Array.from(collectedAdms);
  const oldAdmsList = Array.from(collectedOldAdms);

  if (admsList.length === 0 && oldAdmsList.length === 0) return '—';

  const isRe = String(rec['readmission'] || rec['Re-admission'] || rec['isReadmission'] || '').toLowerCase() === 'yes';

  const oldAdmVal = oldAdmsList[0] || (admsList.length > 1 ? admsList[0] : null);
  const newAdmVal = admsList.length > 0 ? admsList[admsList.length - 1] : oldAdmVal;

  if ((isRe || oldAdmsList.length > 0 || admsList.length > 1) && oldAdmVal && newAdmVal && oldAdmVal !== newAdmVal) {
    return `${newAdmVal} (${oldAdmVal})`;
  }

  return newAdmVal || oldAdmVal || '—';
};

const f250272 = currentAdmissions.find(r => String(r['Form Number'] || r['FormNo'] || '').trim() === '250272');
console.log('Khushboo Ishaq Form 250272 Resolved Adm No:', resolveAdmNo(f250272));
