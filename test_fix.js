const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'db_30 Jul 2026.xlsx');
const wb = XLSX.readFile(filePath);
const admWs = wb.Sheets['adm_form'];
const admData = XLSX.utils.sheet_to_json(admWs, { defval: '' });

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
  // Reject scientific notation (e.g. 230101e15, 2301e15)
  if (/[eE]/.test(reg)) return false;
  // Reject if ends in 5+ zeros
  if (/0{5,}$/.test(reg)) return false;
  // Reject if 75%+ zeros
  const zeros = (reg.match(/0/g) || []).length;
  if (zeros / reg.length >= 0.75) return false;
  return true;
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

const extractClassRoll = (st) => {
  const r = String(st['Class Roll No'] || st['Class R.No.'] || st['Class Roll No.'] || st['RL. NO.'] || st['RL. NO'] || st.classRollNo || st.rollNo || '').trim();
  if (!r || r === '—' || r === 'N/A' || r.toLowerCase() === 'undefined') return '';
  return r;
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

// Map of seen records: key -> { roll, name }
const activeSeenMap = new Map();

const sortedActive = [...admData].sort((a1, a2) => {
  const hasRoll1 = !!extractClassRoll(a1);
  const hasRoll2 = !!extractClassRoll(a2);
  if (hasRoll1 && !hasRoll2) return -1;
  if (!hasRoll1 && hasRoll2) return 1;
  const num1 = parseInt(String(a1['Form Number'] || a1['FormNo'] || '0').replace(/^'/, ''), 10) || 0;
  const num2 = parseInt(String(a2['Form Number'] || a2['FormNo'] || '0').replace(/^'/, ''), 10) || 0;
  return num2 - num1;
});

const acceptedRecords = [];

sortedActive.forEach((a) => {
  const regClean = extractRegNoClean(a);
  const nameClean = getStudentName(a).toLowerCase();
  const fnameClean = getFatherName(a).toLowerCase();
  const clsClean = normalizeClassVal(a['Admission sought for class'] || a['Class']);
  const sessClean = normalizeSessionVal(a['Session']);
  const rollNo = extractClassRoll(a);
  const formNo = a['Form Number'] || a['FormNo'];

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

  // Check if blocked by a record for the SAME student
  let isDuplicate = false;
  for (const k of dupKeys) {
    if (activeSeenMap.has(k)) {
      const existing = activeSeenMap.get(k);
      // Only prune if it's the SAME student (same roll or same name) or same roll number!
      // If two records have DIFFERENT roll numbers and DIFFERENT names, they are DIFFERENT students (e.g. shared typo reg)!
      if (rollNo && existing.roll && rollNo === existing.roll) {
        isDuplicate = true; // Same roll number in same class/session -> duplicate
        break;
      }
      if (nameClean && existing.name.toLowerCase() === nameClean) {
        isDuplicate = true; // Same student name -> duplicate form
        break;
      }
    }
  }

  if (isDuplicate) {
    return; // Skip duplicate form for the same student
  }

  // Record is valid & distinct! Add all keys to map
  dupKeys.forEach(k => activeSeenMap.set(k, { formNo, name: getStudentName(a), roll: rollNo }));
  acceptedRecords.push({
    ...a,
    class: clsClean,
    session: sessClean,
    roll: rollNo,
    name: getStudentName(a)
  });
});

console.log('=== TEST FIX RESULTS ===');
const active12 = acceptedRecords.filter(r => r.class === '12th' && r.session === '2025-26');
const active12_approved = active12.filter(r => !!r.roll);
console.log('Total 12th 2025-26 accepted:', active12.length);
console.log('Approved 12th 2025-26 accepted (with roll):', active12_approved.length);

const approvedRolls12 = new Set(active12_approved.map(r => r.roll));
const missing12 = [];
for (let i = 1; i <= 196; i++) {
  if (!approvedRolls12.has(String(i))) missing12.push(i);
}
console.log('Missing 12th Roll Numbers between 1 and 196:', missing12);

const active11 = acceptedRecords.filter(r => r.class === '11th' && r.session === '2025-26');
const active11_approved = active11.filter(r => !!r.roll);
console.log('\nTotal 11th 2025-26 accepted:', active11.length);
console.log('Approved 11th 2025-26 accepted (with roll):', active11_approved.length);

const approvedRolls11 = new Set(active11_approved.map(r => r.roll));
const missing11 = [];
for (let i = 1; i <= 198; i++) {
  if (!approvedRolls11.has(String(i))) missing11.push(i);
}
console.log('Missing 11th Roll Numbers between 1 and 198:', missing11);
