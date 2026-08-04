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

const formatPhotoDisplayUrl = (val) => {
  if (!val || typeof val !== 'string') return '';
  const str = val.trim();
  if (!str || str === '—' || str === 'N/A' || str === 'null' || str === 'undefined') return '';

  if (str.startsWith('data:image/') || str.startsWith('http://') || str.startsWith('https://')) {
    if (str.includes('drive.google.com')) {
      const match = str.match(/\/d\/([a-zA-Z0-9_-]+)/) || str.match(/id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return `https://lh3.googleusercontent.com/d/${match[1]}`;
      }
    }
    return str;
  }

  if (/^[a-zA-Z0-9_-]{20,}$/.test(str)) {
    return `https://lh3.googleusercontent.com/d/${str}`;
  }

  return '';
};

const extractPhotoVal = (st) => {
  if (!st) return '';
  const raw = String(
    st['photo_id'] ||
    st['Student Photo'] ||
    st['photoUrl'] ||
    st['Student Photo URL'] ||
    st['Photo'] ||
    st.photo_id ||
    st.photoUrl ||
    st.photoId ||
    ''
  ).trim();
  return formatPhotoDisplayUrl(raw);
};

const photoByIdentity = new Map();
const allRawDocs = [...masterRecords, ...currentAdmissions];

// PASS 1: Index photo for every identity
allRawDocs.forEach(rec => {
  const keys = getIdentityKeys(rec);
  const photoVal = extractPhotoVal(rec);
  if (photoVal) {
    keys.forEach(k => {
      if (!photoByIdentity.has(k)) {
        photoByIdentity.set(k, photoVal);
      }
    });
  }
});

const getResolvedPhoto = (st) => {
  const explicit = extractPhotoVal(st);
  if (explicit) return explicit;
  const keys = getIdentityKeys(st);
  for (const k of keys) {
    const found = photoByIdentity.get(k);
    if (found) return found;
  }
  return '';
};

let totalStudentsWithPhoto = 0;
let inheritedPhotoCount = 0;
let activePhotosCount = 0;

allRawDocs.forEach(st => {
  const resolved = getResolvedPhoto(st);
  const explicit = extractPhotoVal(st);
  if (resolved) {
    totalStudentsWithPhoto++;
    if (explicit) activePhotosCount++;
    else inheritedPhotoCount++;
  }
});

console.log('Total student records inspected:', allRawDocs.length);
console.log('Total records with a displayable photo:', totalStudentsWithPhoto);
console.log('Direct explicit photos:', activePhotosCount);
console.log('Cross-session inherited photos:', inheritedPhotoCount);
