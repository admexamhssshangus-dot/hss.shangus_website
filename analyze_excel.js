const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'db_30 Jul 2026.xlsx');
const wb = XLSX.readFile(filePath);

// 1. Analyze source_data sheet - the master register
const srcWs = wb.Sheets['source_data'];
const srcData = XLSX.utils.sheet_to_json(srcWs, { defval: '' });

console.log('=== SOURCE_DATA SHEET ANALYSIS ===');
console.log('Total rows:', srcData.length);

if (srcData.length > 0) {
  const cols = Object.keys(srcData[0]);
  console.log('\nAll columns:');
  cols.forEach(c => console.log(' -', c));
}

// Find all unique sessions
const sessions = new Set();
const sessionColCandidates = ['Session', 'session', 'Academic Session', 'Year', 'year'];
let sessionCol = null;

if (srcData.length > 0) {
  for (const col of sessionColCandidates) {
    if (srcData[0][col] !== undefined) { sessionCol = col; break; }
  }
  // If not found by name, look for any column containing session-like values
  if (!sessionCol) {
    const cols = Object.keys(srcData[0]);
    for (const col of cols) {
      const sample = String(srcData[0][col] || '');
      if (/20\d\d/.test(sample)) { sessionCol = col; break; }
    }
  }
}

console.log('\nSession column found:', sessionCol);

// Find class column
const classColCandidates = ['Class', 'class', 'Class for which Admission Sought', 'Admission sought for class', 'Class Enrolled', 'className'];
let classCol = null;
if (srcData.length > 0) {
  for (const col of classColCandidates) {
    if (srcData[0][col] !== undefined) { classCol = col; break; }
  }
}
console.log('Class column found:', classCol);

// Find Class Roll No column
const rollColCandidates = ['Class Roll No', 'Class Roll No.', 'Class R.No.', 'Class R.No', 'Class R. No.', 'classRollNo', 'rollNo', 'Roll No.', 'Roll No'];
let rollCol = null;
if (srcData.length > 0) {
  for (const col of rollColCandidates) {
    if (srcData[0][col] !== undefined) { rollCol = col; break; }
  }
}
console.log('Class Roll No column found:', rollCol);

// Group by class + session
console.log('\n=== COUNTS BY CLASS + SESSION ===');
const groups = {};
srcData.forEach(row => {
  const cls = classCol ? String(row[classCol] || '').trim() : '';
  const ses = sessionCol ? String(row[sessionCol] || '').trim() : '';
  const roll = rollCol ? String(row[rollCol] || '').trim() : '';
  if (!cls && !ses) return;
  const key = `${cls} | ${ses}`;
  if (!groups[key]) groups[key] = { total: 0, withRoll: 0 };
  groups[key].total++;
  if (roll && roll !== '—' && roll !== 'N/A' && roll.toLowerCase() !== 'undefined') {
    groups[key].withRoll++;
  }
});

Object.keys(groups).sort().forEach(k => {
  console.log(`  ${k} -> total: ${groups[k].total}, with roll: ${groups[k].withRoll}`);
});

// 2. Analyze practical_data sheet
const pracWs = wb.Sheets['practical_data'];
if (pracWs) {
  const pracData = XLSX.utils.sheet_to_json(pracWs, { defval: '' });
  console.log('\n\n=== PRACTICAL_DATA SHEET ===');
  console.log('Total rows:', pracData.length);
  if (pracData.length > 0) {
    console.log('Columns:', Object.keys(pracData[0]).join(', '));
    // Find unique class + yearSuffix combos
    const pracGroups = {};
    pracData.forEach(row => {
      const cls = String(row['Class'] || row['class'] || '').trim();
      const yr = String(row['YearSuffix'] || row['yearSuffix'] || row['Year'] || row['year'] || '').trim();
      const key = `${cls} | ${yr}`;
      if (!pracGroups[key]) pracGroups[key] = 0;
      pracGroups[key]++;
    });
    console.log('\nCounts by Class + YearSuffix:');
    Object.keys(pracGroups).sort().forEach(k => console.log(`  ${k} -> ${pracGroups[k]} rows`));
  }
}

// 3. Check adm_form for 11th/12th 2025-26
const admWs = wb.Sheets['adm_form'];
if (admWs) {
  const admData = XLSX.utils.sheet_to_json(admWs, { defval: '' });
  console.log('\n\n=== ADM_FORM SHEET (11th/12th 2025-26 with Class Roll) ===');

  function isClassMatch(c, target) {
    const c1 = String(c).toLowerCase().replace(/class/gi,'').trim();
    const c2 = String(target).toLowerCase().replace(/class/gi,'').trim();
    const d1 = c1.match(/\d+/)?.[0];
    const d2 = c2.match(/\d+/)?.[0];
    return d1 && d2 && d1 === d2;
  }

  const cls11 = admData.filter(r => {
    const cls = r['Admission sought for class'] || r['Class'] || '';
    const roll = r['Class Roll No'] || '';
    const ses = r['Session'] || '';
    return isClassMatch(cls, '11') && roll && String(roll).trim() !== '' && String(ses).includes('2026');
  });
  const cls12 = admData.filter(r => {
    const cls = r['Admission sought for class'] || r['Class'] || '';
    const roll = r['Class Roll No'] || '';
    const ses = r['Session'] || '';
    return isClassMatch(cls, '12') && roll && String(roll).trim() !== '' && String(ses).includes('2026');
  });

  console.log('11th 2025-26 with Class Roll:', cls11.length);
  console.log('12th 2025-26 with Class Roll:', cls12.length);

  // Check for session field variations in adm_form
  const sessionsInAdm = new Set();
  admData.forEach(r => { if (r['Session']) sessionsInAdm.add(String(r['Session']).trim()); });
  console.log('\nUnique session values in adm_form:', Array.from(sessionsInAdm).sort());
}
