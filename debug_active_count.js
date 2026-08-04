const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'db_30 Jul 2026.xlsx');
const wb = XLSX.readFile(filePath);
const admWs = wb.Sheets['adm_form'];

const currentAdmissions = XLSX.utils.sheet_to_json(admWs, { defval: '' });
console.log('Total raw currentAdmissions count:', currentAdmissions.length);

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

const extractClassRoll = (st) => {
  if (!st) return '';
  const raw = String(
    st['Class Roll No'] ||
    st['Class Roll No.'] ||
    st['RL. NO.'] ||
    st['RL. NO'] ||
    st['Class R.No.'] ||
    st['Class R.No'] ||
    st['Class R. No.'] ||
    st['Class R. No'] ||
    st.classRollNo ||
    st.rollNo ||
    st.roll ||
    ''
  ).trim();
  if (!raw || raw === '—' || raw === 'N/A' || raw === 'null' || raw === 'undefined') return '';
  return raw;
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

// 1. Current ActiveSeenIdentities logic
const activeSeenIdentities = new Map();
const prunedList = [];
const keptList = [];

currentAdmissions.forEach((a, idx) => {
  const regClean = extractRegNoClean(a);
  const nameClean = getStudentName(a).toLowerCase();
  const fnameClean = getFatherName(a).toLowerCase();
  const clsClean = normalizeClassVal(a['Admission sought for class'] || a['Class']);
  const sessClean = normalizeSessionVal(a['Session']);
  const rollNo = extractClassRoll(a);

  const dupKeys = [];
  const scope = `${clsClean}_${sessClean}`;
  if (regClean && regClean !== '—' && isValidRegNo(regClean)) {
    dupKeys.push(`dup_${scope}_reg_${regClean}`);
  }
  if (nameClean && nameClean.length > 2 && fnameClean && fnameClean.length > 1) {
    dupKeys.push(`dup_${scope}_identity_${nameClean}_${fnameClean.slice(0, 8)}`);
  }
  if (rollNo) {
    dupKeys.push(`dup_${scope}_roll_${rollNo}`);
  }

  let isDuplicate = false;
  for (const k of dupKeys) {
    if (activeSeenIdentities.has(k)) {
      const existing = activeSeenIdentities.get(k);
      if (rollNo && existing.roll && rollNo === existing.roll) {
        isDuplicate = true;
        break;
      }
      if (nameClean && existing.name === nameClean) {
        isDuplicate = true;
        break;
      }
    }
  }

  if (isDuplicate) {
    prunedList.push({ fNo: a['Form Number'], name: nameClean, cls: clsClean, sess: sessClean, roll: rollNo });
  } else {
    dupKeys.forEach(k => activeSeenIdentities.set(k, { roll: rollNo, name: nameClean }));
    keptList.push({ fNo: a['Form Number'], name: nameClean, cls: clsClean, sess: sessClean, roll: rollNo });
  }
});

console.log('Kept active count:', keptList.length);
console.log('Pruned active count:', prunedList.length);
console.log('Pruned list sample:', prunedList.slice(0, 10));
