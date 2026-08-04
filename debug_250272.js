const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'db_30 Jul 2026.xlsx');
const wb = XLSX.readFile(filePath);
const srcWs = wb.Sheets['source_data'];
const admWs = wb.Sheets['adm_form'];

const srcData = XLSX.utils.sheet_to_json(srcWs, { defval: '' });
const admData = XLSX.utils.sheet_to_json(admWs, { defval: '' });

console.log('=== FORM 250272 IN ADM_FORM ===');
const f250272_adm = admData.filter(r => {
  const fNo = String(r['Form Number'] || r['FormNo'] || r['Form No.'] || '').trim();
  return fNo === '250272' || fNo === "'250272";
});
console.log(f250272_adm);

console.log('\n=== FORM 250272 IN SOURCE_DATA ===');
const f250272_src = srcData.filter(r => {
  const fNo = String(r['Form No.'] || r['Form Number'] || '').trim();
  return fNo === '250272' || fNo === "'250272";
});
console.log(f250272_src);

console.log('\n=== SEARCH BY REG 2301010000900054 IN SOURCE_DATA & ADM_FORM ===');
const reg54_src = srcData.filter(r => JSON.stringify(r).includes('2301010000900054'));
console.log('Reg 54 in source_data:', reg54_src.map(r => ({ name: r["Student's Name"], cls: r['Class'], sess: r['Session'], fNo: r['Form No.'], roll: r['Class R.No.'] })));

const reg54_adm = admData.filter(r => JSON.stringify(r).includes('2301010000900054'));
console.log('Reg 54 in adm_form:', reg54_adm.map(r => ({ name: r["Student's Name (as per school records)"], cls: r['Admission sought for class'], sess: r['Session'], fNo: r['Form Number'], roll: r['Class Roll No'] })));

console.log('\n=== SEARCH BY REG 2301010000900068 IN SOURCE_DATA & ADM_FORM ===');
const reg68_src = srcData.filter(r => JSON.stringify(r).includes('2301010000900068'));
console.log('Reg 68 in source_data:', reg68_src.map(r => ({ name: r["Student's Name"], cls: r['Class'], sess: r['Session'], fNo: r['Form No.'], roll: r['Class R.No.'] })));

const reg68_adm = admData.filter(r => JSON.stringify(r).includes('2301010000900068'));
console.log('Reg 68 in adm_form:', reg68_adm.map(r => ({ name: r["Student's Name (as per school records)"], cls: r['Admission sought for class'], sess: r['Session'], fNo: r['Form Number'], roll: r['Class Roll No'] })));
