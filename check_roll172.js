const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'db_30 Jul 2026.xlsx');
const wb = XLSX.readFile(filePath);
const srcWs = wb.Sheets['source_data'];
const admWs = wb.Sheets['adm_form'];

const srcData = XLSX.utils.sheet_to_json(srcWs, { defval: '' });
const admData = XLSX.utils.sheet_to_json(admWs, { defval: '' });

console.log('=== ROLL NO 172 IN SOURCE_DATA ===');
const roll172_src = srcData.filter(r => {
  const cls = String(r['Class'] || '').toLowerCase();
  const ses = String(r['Session'] || '').trim();
  const roll = String(r['Class R.No.'] || r['Class Roll No'] || '').trim();
  return (cls.includes('12') || cls.includes('xii')) && ses === '2025-26' && roll === '172';
});
console.log(roll172_src);

console.log('\n=== ROLL NO 172 IN ADM_FORM ===');
const roll172_adm = admData.filter(r => {
  const cls = String(r['Admission sought for class'] || r['Class'] || '').toLowerCase();
  const ses = String(r['Session'] || '').trim();
  const roll = String(r['Class Roll No'] || '').trim();
  return (cls.includes('12') || cls.includes('xii')) && ses === '2025-26' && roll === '172';
});
console.log(roll172_adm);
