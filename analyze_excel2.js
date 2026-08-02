const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'db_30 Jul 2026.xlsx');
const wb = XLSX.readFile(filePath);
const srcWs = wb.Sheets['source_data'];
const srcData = XLSX.utils.sheet_to_json(srcWs, { defval: '' });

console.log('=== EXCEL SOURCE_DATA: CLASS + SESSION BREAKDOWN ===');
console.log('Total rows:', srcData.length, '\n');

function isClassMatch(c, target) {
  const c1 = String(c).toLowerCase().replace(/class/gi,'').trim();
  const c2 = String(target).toLowerCase().replace(/class/gi,'').trim();
  const d1 = c1.match(/\d+/)?.[0];
  const d2 = c2.match(/\d+/)?.[0];
  return !!(d1 && d2 && d1 === d2);
}

function hasRoll(row) {
  const roll = String(row['Class R.No.'] || '').trim();
  return roll && roll !== '—' && roll !== 'N/A' && roll.toLowerCase() !== 'undefined' && roll !== '';
}

// Group by Class + Session, show both total and those with class roll
const groups = {};
srcData.forEach(row => {
  const cls = String(row['Class'] || '').trim();
  const ses = String(row['Session'] || '').trim();
  if (!cls && !ses) return;
  const key = `${cls} | "${ses}"`;
  if (!groups[key]) groups[key] = { total: 0, withRoll: 0 };
  groups[key].total++;
  if (hasRoll(row)) groups[key].withRoll++;
});

Object.keys(groups).sort().forEach(k => {
  const g = groups[k];
  console.log(`  ${k} -> total: ${g.total}, withRoll: ${g.withRoll}`);
});

// Specific checks
const targets = [
  { label: '11th 2024-25 (Mar-Apr)', sesCheck: s => s === '2024-25 (Mar-Apr)' || s === '2024-25' || s === '2025', clsCheck: r => isClassMatch(r['Class'], '11') },
  { label: '11th 2024-25 (Oct-Nov)', sesCheck: s => s === '2024-25 (Oct-Nov)' || s === '2024-25 (revised)', clsCheck: r => isClassMatch(r['Class'], '11') },
  { label: '11th 2025-26', sesCheck: s => s === '2025-26' || s === '2026', clsCheck: r => isClassMatch(r['Class'], '11') },
  { label: '12th 2024-25 (Mar-Apr)', sesCheck: s => s === '2024-25 (Mar-Apr)' || s === '2024-25' || s === '2025', clsCheck: r => isClassMatch(r['Class'], '12') },
  { label: '12th 2024-25 (Oct-Nov)', sesCheck: s => s === '2024-25 (Oct-Nov)' || s === '2024-25 (revised)', clsCheck: r => isClassMatch(r['Class'], '12') },
  { label: '12th 2025-26', sesCheck: s => s === '2025-26' || s === '2026', clsCheck: r => isClassMatch(r['Class'], '12') },
];

console.log('\n=== SPECIFIC SESSION COUNTS (Excel Source) ===');
targets.forEach(t => {
  const matching = srcData.filter(r => t.clsCheck(r) && t.sesCheck(String(r['Session'] || '').trim()));
  const withRoll = matching.filter(r => hasRoll(r));
  console.log(`  ${t.label}: total=${matching.length}, withRoll=${withRoll.length}`);
  // Show a sample session value
  if (matching.length > 0) {
    const sessionValues = [...new Set(matching.map(r => String(r['Session'] || '').trim()))];
    console.log(`    Session values in Excel: ${sessionValues.join(', ')}`);
  }
});

// Now check adm_form 
const admWs = wb.Sheets['adm_form'];
if (admWs) {
  const admData = XLSX.utils.sheet_to_json(admWs, { defval: '' });
  console.log('\n=== ADM_FORM SPECIFIC SESSION COUNTS ===');

  const admTargets = [
    { label: '11th 2025-26', sesCheck: s => s === '2025-26', clsCheck: r => isClassMatch(r['Admission sought for class'] || r['Class'] || '', '11') },
    { label: '12th 2025-26', sesCheck: s => s === '2025-26', clsCheck: r => isClassMatch(r['Admission sought for class'] || r['Class'] || '', '12') },
  ];

  admTargets.forEach(t => {
    const matching = admData.filter(r => t.clsCheck(r) && t.sesCheck(String(r['Session'] || '').trim()));
    const withRoll = matching.filter(r => {
      const roll = String(r['Class Roll No'] || '').trim();
      return roll && roll !== '—' && roll !== 'N/A';
    });
    console.log(`  ${t.label}: total=${matching.length}, withRoll=${withRoll.length}`);
    if (matching.length > 0) {
      console.log(`    Sample statuses: ${[...new Set(matching.slice(0,10).map(r => String(r['Status'] || '')))].join(', ')}`);
    }
  });
}

// Check unique session values in source_data for 11th and 12th
const sesValues11 = new Set(srcData.filter(r => isClassMatch(r['Class'], '11')).map(r => String(r['Session'] || '').trim()));
const sesValues12 = new Set(srcData.filter(r => isClassMatch(r['Class'], '12')).map(r => String(r['Session'] || '').trim()));
console.log('\n=== UNIQUE SESSION VALUES IN source_data ===');
console.log('11th sessions:', Array.from(sesValues11).sort());
console.log('12th sessions:', Array.from(sesValues12).sort());
