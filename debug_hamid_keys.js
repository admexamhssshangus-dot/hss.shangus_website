const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'db_30 Jul 2026.xlsx');
const wb = XLSX.readFile(filePath);
const srcWs = wb.Sheets['source_data'];
const admWs = wb.Sheets['adm_form'];

const masterRecords = XLSX.utils.sheet_to_json(srcWs, { defval: '' });
const currentAdmissions = XLSX.utils.sheet_to_json(admWs, { defval: '' });

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

const getIdentityKeys = (rec) => {
  const keys = [];
  const reg = extractRegNoClean(rec);
  const sName = getStudentName(rec).toLowerCase();
  const fName = getFatherName(rec).toLowerCase();
  const fNo = cleanFormNo(rec['Form Number'] || rec['FormNo'] || rec['Form No.'] || rec.formNo);
  const cls = rec['Admission sought for class'] || rec['Class'];
  const sess = rec['Session'];

  if (reg && isValidRegNo(reg)) {
    keys.push(`reg_${reg}`);
  }
  if (sName && sName !== 'student' && sName.length > 2) {
    const fatherPart = fName && fName !== '—' ? fName.slice(0, 8) : '';
    keys.push(`name_${sName}_${fatherPart}`);
  }
  return keys;
};

const hamidMaster11 = masterRecords.find(r => getStudentName(r).includes('Hamid Manzoor') && String(r.Class).includes('11'));
const hamidAdm12 = currentAdmissions.find(r => getStudentName(r).includes('Hamid Manzoor'));

console.log('Hamid Class 11 Master Row:', hamidMaster11);
console.log('Hamid Class 11 Master Keys:', getIdentityKeys(hamidMaster11));
console.log('Hamid Class 12 Adm Keys:', getIdentityKeys(hamidAdm12));
