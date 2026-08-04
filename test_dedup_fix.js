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

// Fixed Deduplication
const activeSeenIdentities = new Map();
const prunedList = [];
const keptList = [];

currentAdmissions.forEach((a) => {
  const nameClean = getStudentName(a).toLowerCase();
  const fnameClean = getFatherName(a).toLowerCase();
  const clsClean = normalizeClassVal(a['Admission sought for class'] || a['Class']);
  const sessClean = normalizeSessionVal(a['Session']);
  const rollNo = extractClassRoll(a);
  const scope = `${clsClean}_${sessClean}`;

  let isDuplicate = false;

  // 1. Roll No based duplicate check (same class + session + roll no = duplicate submission for same student)
  if (rollNo) {
    const rollKey = `roll_${scope}_${rollNo}`;
    if (activeSeenIdentities.has(rollKey)) {
      isDuplicate = true;
    } else {
      activeSeenIdentities.set(rollKey, { name: nameClean, fname: fnameClean });
    }
  }

  // 2. Name + Father Name based duplicate check (same class + session + name + father name = duplicate submission for same student)
  if (!isDuplicate && nameClean && nameClean.length > 2 && fnameClean && fnameClean.length > 1) {
    const nameKey = `name_${scope}_${nameClean}_${fnameClean}`;
    if (activeSeenIdentities.has(nameKey)) {
      isDuplicate = true;
    } else {
      activeSeenIdentities.set(nameKey, { roll: rollNo });
    }
  }

  if (isDuplicate) {
    prunedList.push({ fNo: a['Form Number'], name: nameClean, cls: clsClean, sess: sessClean, roll: rollNo });
  } else {
    keptList.push({ fNo: a['Form Number'], name: nameClean, cls: clsClean, sess: sessClean, roll: rollNo });
  }
});

console.log('Fixed Kept active count:', keptList.length);
console.log('Fixed Pruned active count:', prunedList.length);
console.log('Pruned duplicate forms sample:', prunedList);
