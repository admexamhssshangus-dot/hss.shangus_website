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

const extractClassRoll = (st) => {
  const r = String(st['Class Roll No'] || st['Class R.No.'] || st['Class Roll No.'] || st['RL. NO.'] || st['RL. NO'] || st.classRollNo || st.rollNo || '').trim();
  if (!r || r === '—' || r === 'N/A' || r.toLowerCase() === 'undefined') return '';
  return r;
};

const getStudentName = (st) => {
  if (!st) return '';
  return String(
    st["Student's Name (as per school records)"] ||
    st["Student's Name"] ||
    st['Student Name'] ||
    ''
  ).replace(/^(N\/A|—)$/i, '').trim();
};

// SIMULATE COMBINED (masterRecords + currentAdmissions) EXACTLY LIKE AdvancedReports.jsx
const masterRecordByIdentity = new Map();
const assignedRollByIdentity = new Map();

const allRawDocs = [...masterRecords, ...currentAdmissions];

allRawDocs.forEach(rec => {
  const name = getStudentName(rec).toLowerCase();
  const rollVal = extractClassRoll(rec);
  const recCls = normalizeClassVal(rec['Admission sought for class'] || rec['Class']);
  const recSess = normalizeSessionVal(rec['Session']);
  const k = `name_${name}`;

  if (rollVal) {
    assignedRollByIdentity.set(`${recCls}_${recSess}_${k}`, rollVal);
  }
  if (!masterRecordByIdentity.has(k)) {
    masterRecordByIdentity.set(k, rec);
  }
});

const activeSeenMap = new Map();
const acceptedActive = [];

const sortedActive = [...currentAdmissions].sort((a1, a2) => {
  const hasRoll1 = !!extractClassRoll(a1);
  const hasRoll2 = !!extractClassRoll(a2);
  if (hasRoll1 && !hasRoll2) return -1;
  if (!hasRoll1 && hasRoll2) return 1;
  const num1 = parseInt(String(a1['Form Number'] || a1['FormNo'] || '0').replace(/^'/, ''), 10) || 0;
  const num2 = parseInt(String(a2['Form Number'] || a2['FormNo'] || '0').replace(/^'/, ''), 10) || 0;
  return num2 - num1;
});

sortedActive.forEach((a) => {
  const nameClean = getStudentName(a).toLowerCase();
  const clsClean = normalizeClassVal(a['Admission sought for class'] || a['Class']);
  const sessClean = normalizeSessionVal(a['Session']);
  const rollNo = extractClassRoll(a);

  const scope = `${clsClean}_${sessClean}`;
  const key = `dup_${scope}_name_${nameClean}`;

  if (activeSeenMap.has(key)) {
    const existing = activeSeenMap.get(key);
    if (rollNo && existing.roll && rollNo === existing.roll) return;
    if (nameClean && existing.name === nameClean) return;
  }

  activeSeenMap.set(key, { roll: rollNo, name: nameClean });

  const knownRoll = assignedRollByIdentity.get(`${clsClean}_${sessClean}_name_${nameClean}`);
  const finalRoll = rollNo || knownRoll || '';
  const finalStatus = finalRoll ? 'Approved' : 'Submitted';

  acceptedActive.push({
    ...a,
    class: clsClean,
    session: sessClean,
    roll: finalRoll,
    status: finalStatus,
    name: getStudentName(a)
  });
});

console.log('=== COMBINED DATASET BREAKDOWN ===');
['12th', '11th'].forEach(c => {
  const activeClass = acceptedActive.filter(r => r.class === c && r.session === '2025-26');
  const approvedClass = activeClass.filter(r => r.status === 'Approved');
  console.log(`Class ${c} (2025-26):`);
  console.log(`  Total Active Applications: ${activeClass.length}`);
  console.log(`  Approved (Roll assigned): ${approvedClass.length}`);

  const approvedRolls = new Set(approvedClass.map(r => r.roll));
  const missing = [];
  const max = c === '12th' ? 196 : 198;
  for (let i = 1; i <= max; i++) {
    if (!approvedRolls.has(String(i))) missing.push(i);
  }
  console.log(`  Missing Roll numbers between 1 and ${max}:`, missing, '\n');
});
