const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'db_30 Jul 2026.xlsx');
const wb = XLSX.readFile(filePath);

const srcWs = wb.Sheets['source_data'];
const admWs = wb.Sheets['adm_form'];

const masterRecords = XLSX.utils.sheet_to_json(srcWs, { defval: '' });
const currentAdmissions = XLSX.utils.sheet_to_json(admWs, { defval: '' });

const extractRegNo = (st) => {
  if (!st) return '';
  return String(
    st['Board Registration Number'] ||
    st['Board Registration No. (Class 11th)'] ||
    st['Board Registration No. (Class 10th)'] ||
    st['Board Reg. No.'] ||
    st['Reg. No.'] ||
    ''
  ).trim();
};

const extractPhoto = (st) => {
  if (!st) return '';
  return String(
    st['photo'] || st['Photo'] || st['Photo ID'] || st['photoUrl'] || st['photoID'] || st['Student Photo'] || st['PHOTO'] || st['photoId'] || ''
  ).trim();
};

console.log('=== ABROO ASHRAF (Reg 2101010001170008) ===');
const abrooMaster = masterRecords.filter(r => extractRegNo(r).includes('2101010001170008'));
console.log('Master rows count:', abrooMaster.length);
abrooMaster.forEach((r, i) => {
  console.log(`Master Row ${i+1}: Class=${r.Class}, Session=${r.Session}, Photo=${extractPhoto(r)}`);
});
const abrooAdm = currentAdmissions.filter(r => extractRegNo(r).includes('2101010001170008'));
console.log('Active adm rows count:', abrooAdm.length);
abrooAdm.forEach((r, i) => {
  console.log(`Adm Form ${r['Form Number']}: Class=${r.Class || r['Admission sought for class']}, Session=${r.Session}, Photo=${extractPhoto(r)}`);
});

console.log('\n=== HAMID MANZOOR BHAT (Reg 2301000000610005) ===');
const hamidMaster = masterRecords.filter(r => extractRegNo(r).includes('2301000000610005'));
console.log('Master rows count:', hamidMaster.length);
hamidMaster.forEach((r, i) => {
  console.log(`Master Row ${i+1}: Class=${r.Class}, Session=${r.Session}, Photo=${extractPhoto(r)}`);
});
const hamidAdm = currentAdmissions.filter(r => extractRegNo(r).includes('2301000000610005'));
console.log('Active adm rows count:', hamidAdm.length);
hamidAdm.forEach((r, i) => {
  console.log(`Adm Form ${r['Form Number']}: Class=${r.Class || r['Admission sought for class']}, Session=${r.Session}, Photo=${extractPhoto(r)}`);
});
